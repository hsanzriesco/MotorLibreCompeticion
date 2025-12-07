// api/clubs.js
// Maneja la gestión de clubes y solicitudes de clubes pendientes

import { Pool } from "pg";
import formidable from "formidable";
import fs from "fs";
import jwt from "jsonwebtoken";
import { v2 as cloudinary } from 'cloudinary';

// --- CONFIGURACIÓN DE BASE DE DATOS ---
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Asegúrate de que esta opción esté configurada si usas servicios como Supabase o Heroku Postgres.
    ssl: { rejectUnauthorized: false },
});

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_no_usar_en_produccion';

// --- CONFIGURACIÓN DE CLOUDINARY ---
cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});


// Desactiva el body parser de Next.js para permitir que formidable lea el cuerpo del request
export const config = {
    api: { bodyParser: false, },
};

// ------------------------------------------------------------------------------------------------
// 🛠️ HELPERS
// ------------------------------------------------------------------------------------------------

/**
 * 1. Parsear FormData (Estabilizado para Vercel/Serverless)
 */
const parseForm = (req) => {
    return new Promise((resolve, reject) => {
        const form = formidable({
            multiples: false,
            keepExtensions: true,
            maxFileSize: 5 * 1024 * 1024, // 5MB 
        });

        form.parse(req, (err, fields, files) => {
            if (err) {
                console.error("Error parsing form:", err);
                // 🚨 Limpieza del archivo temporal de formidable en caso de error de parseo 🚨
                if (files.imagen_club && files.imagen_club[0]?.filepath && fs.existsSync(files.imagen_club[0].filepath)) {
                    fs.unlinkSync(files.imagen_club[0].filepath);
                }
                return reject(err);
            }

            // Normalizar fields y files de arrays a objetos simples
            const fieldData = Object.keys(fields).reduce((acc, key) => {
                acc[key] = fields[key][0];
                return acc;
            }, {});

            const fileData = Object.keys(files).reduce((acc, key) => {
                acc[key] = files[key][0];
                return acc;
            }, {});

            resolve({ fields: fieldData, files: fileData });
        });
    });
};

/**
 * 2. Subir Archivo a Cloudinary y Limpiar Temporal
 */
async function uploadToCloudinary(filePath) {
    if (!filePath) return null;

    try {
        const result = await cloudinary.uploader.upload(filePath, {
            folder: 'motor-libre-clubs', // Carpeta específica en tu Cloudinary
        });

        // Importante: Eliminar el archivo temporal de /tmp
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        return result.secure_url; // Devuelve la URL pública
    } catch (error) {
        // Intentamos limpiar incluso si la subida falla
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        throw new Error(`Cloudinary upload failed: ${error.message}`);
    }
}

/**
 * 3. Verificar JWT y Rol
 */
const verifyToken = (req) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { authorized: false, message: 'Token no proporcionado.' };
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        return { authorized: true, user: decoded };
    } catch (e) {
        return { authorized: false, message: 'Token inválido o expirado.' };
    }
};

/**
 * 4. Verificar si es Administrador
 */
const verifyAdmin = (req) => {
    const verification = verifyToken(req);
    if (!verification.authorized) throw new Error(verification.message);
    if (verification.user.role !== 'admin') throw new Error('Acceso denegado: Se requiere rol de administrador.');
    return verification.user;
};


// ------------------------------------------------------------------------------------------------
// 1. MANEJADOR DE CAMBIO DE ESTADO (Aprobar/Rechazar)
// ------------------------------------------------------------------------------------------------
async function statusChangeHandler(req, res) {
    const { method, query } = req;
    const { id } = query;

    try {
        verifyAdmin(req);
        if (!id) return res.status(400).json({ success: false, message: "ID del club es requerido." });

        if (method === 'PUT') {
            const body = await new Promise(resolve => {
                const chunks = [];
                req.on('data', chunk => chunks.push(chunk));
                req.on('end', () => {
                    try {
                        resolve(JSON.parse(Buffer.concat(chunks).toString()));
                    } catch (e) {
                        resolve({});
                    }
                });
            });

            const { estado } = body;
            if (estado !== 'activo') return res.status(400).json({ success: false, message: "Estado de actualización no válido." });

            // 🌟 INICIO TRANSACCIÓN ATÓMICA DE APROBACIÓN 🌟
            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                // 1. Obtener datos del club pendiente (clubs_pendientes)
                // CORRECCIÓN: Usando public.clubs_pendientes
                const pendingClubRes = await client.query(
                    'SELECT nombre_evento, descripcion, imagen_club, id_presidente FROM public.clubs_pendientes WHERE id = $1',
                    [id]
                );

                if (pendingClubRes.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(404).json({ success: false, message: "Solicitud de club pendiente no encontrada." });
                }

                const club = pendingClubRes.rows[0];

                if (!club.id_presidente) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ success: false, message: "El solicitante (id_presidente) no está definido." });
                }

                // Obtener el nombre del presidente para la tabla 'clubs'
                let nombrePresidente;
                // CORRECCIÓN: Usando public."users"
                const presidenteNameRes = await client.query('SELECT name FROM public."users" WHERE id = $1', [club.id_presidente]);
                nombrePresidente = presidenteNameRes.rows[0]?.name || 'Usuario desconocido';


                // 2. Mover el club a la tabla principal 'clubs' (Aquí SÍ usamos nombre_presidente y estado)
                // CORRECCIÓN: Usando public.clubs
                const insertRes = await client.query(
                    'INSERT INTO public.clubs (nombre_evento, descripcion, imagen_club, fecha_creacion, id_presidente, nombre_presidente, estado) VALUES ($1, $2, $3, NOW(), $4, $5, $6) RETURNING id',
                    [club.nombre_evento, club.descripcion, club.imagen_club, club.id_presidente, nombrePresidente, 'activo']
                );
                const newClubId = insertRes.rows[0].id;

                // 3. Actualizar el usuario solicitante a presidente y asignarle el club_id
                // CORRECCIÓN: Usando public."users"
                await client.query(
                    'UPDATE public."users" SET role = $1, club_id = $2 WHERE id = $3',
                    ['presidente', newClubId, club.id_presidente]
                );

                // 4. Eliminar la solicitud de la tabla de pendientes (clubs_pendientes)
                // CORRECCIÓN: Usando public.clubs_pendientes
                await client.query('DELETE FROM public.clubs_pendientes WHERE id = $1', [id]);

                await client.query('COMMIT');
                return res.status(200).json({ success: true, message: "Club aprobado y activado correctamente." });

            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }

        } else if (method === 'DELETE') {
            // RECHAZAR SOLICITUD (Eliminar de clubs_pendientes)
            // CORRECCIÓN: Usando public.clubs_pendientes
            const result = await pool.query('DELETE FROM public.clubs_pendientes WHERE id = $1 RETURNING id', [id]);

            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, message: "Solicitud de club pendiente no encontrada para rechazar." });
            }
            return res.status(200).json({ success: true, message: "Solicitud de club rechazada y eliminada." });
        }

        return res.status(405).json({ success: false, message: "Método no permitido." });

    } catch (error) {
        console.error("Error en statusChangeHandler:", error);
        if (error.message.includes('Acceso denegado') || error.message.includes('Token')) {
            return res.status(401).json({ success: false, message: error.message });
        }
        return res.status(500).json({ success: false, message: "Error interno del servidor." });
    }
}


// ------------------------------------------------------------------------------------------------
// 2. CRUD PRINCIPAL DE CLUBES (GET, POST, PUT, DELETE)
// ------------------------------------------------------------------------------------------------
async function clubsHandler(req, res) {
    const { method, query } = req;
    let isAdmin = false;
    let userId = null;
    let authVerification = verifyToken(req);

    if (authVerification.authorized) {
        userId = authVerification.user.id;
        isAdmin = authVerification.user.role === 'admin';
    }


    try {
        // --- 2.1. GET: Obtener clubes ---
        if (method === "GET") {
            const { estado, id } = query;

            // La consulta general siempre apunta a la tabla 'clubs' (activos).
            let queryText = `
                SELECT 
                    id, nombre_evento, descripcion, imagen_club, fecha_creacion, 
                    estado, id_presidente, nombre_presidente, 
                    0 as miembros 
                FROM public.clubs -- CORRECCIÓN: Usando public.clubs
            `;
            const values = [];

            if (id) {
                // Obtener un club activo específico por ID
                queryText += " WHERE id = $1 AND estado = 'activo'";
                values.push(id);
                const result = await pool.query(queryText, values);
                if (result.rows.length === 0) {
                    return res.status(404).json({ success: false, message: "Club activo no encontrado." });
                }
                return res.status(200).json({ success: true, club: result.rows[0] });

            } else if (estado) {
                if (estado === 'activo') {
                    // Obtener todos los clubes activos
                    queryText += " WHERE estado = $1 ORDER BY fecha_creacion DESC";
                    values.push('activo');
                    const result = await pool.query(queryText, values);
                    return res.status(200).json({ success: true, clubs: result.rows });
                } else if (estado === 'pendiente' && isAdmin) {
                    // Obtener solicitudes pendientes (requiere Admin)
                    // ✅ CORRECCIÓN INTEGRADA: JOIN con la tabla users para obtener el nombre del solicitante.
                    queryText = `
                        SELECT 
                            p.id, 
                            p.nombre_evento, 
                            p.descripcion, 
                            p.imagen_club, 
                            p.fecha_solicitud as fecha_creacion, 
                            'pendiente' as estado,
                            p.id_presidente,
                            u.name as nombre_presidente
                        FROM public.clubs_pendientes p
                        JOIN public."users" u ON p.id_presidente = u.id 
                        ORDER BY p.fecha_solicitud DESC
                    `;
                    const result = await pool.query(queryText);
                    return res.status(200).json({ success: true, pending_clubs: result.rows });
                } else if (estado === 'pendiente' && !isAdmin) {
                    return res.status(403).json({ success: false, message: "Acceso denegado a solicitudes pendientes." });
                }
            }

            // Si no se especifica ID ni estado, devolver todos los clubes activos por defecto.
            // CORRECCIÓN: Usando public.clubs
            const defaultResult = await pool.query(`
                SELECT 
                    id, nombre_evento, descripcion, imagen_club, fecha_creacion, 
                    estado, id_presidente, nombre_presidente, 
                    0 as miembros 
                FROM public.clubs WHERE estado = 'activo' ORDER BY fecha_creacion DESC
            `);
            return res.status(200).json({ success: true, clubs: defaultResult.rows });
        }

        // --- 2.2. POST: Crear nuevo club o solicitud de club ---
        if (method === "POST") {
            let imagenFilePathTemp = null;
            let imagen_club_url = null;

            try {
                const { fields, files } = await parseForm(req);
                const { nombre_evento, descripcion } = fields;
                const imagenFile = files.imagen_club ? files.imagen_club : null;

                imagenFilePathTemp = imagenFile ? imagenFile.filepath : null;


                if (imagenFilePathTemp) {
                    imagen_club_url = await uploadToCloudinary(imagenFilePathTemp);
                }


                if (!nombre_evento || !descripcion) {
                    return res.status(400).json({ success: false, message: "Faltan campos obligatorios: nombre o descripción." });
                }

                // ⚠️ Lógica de estado/rol crucial ⚠️
                let tabla;
                let clubEstado;
                let idPresidente = userId;
                let fechaColumna;

                // Variables para la construcción dinámica de la consulta
                let insertColumns;
                let insertValues;
                let params;

                if (isAdmin) {
                    tabla = 'clubs';
                    clubEstado = 'activo';
                    fechaColumna = 'fecha_creacion';

                    // Solo necesitamos el nombre del presidente para la tabla 'clubs'
                    let nombrePresidente;
                    // CORRECCIÓN: Usando public."users"
                    const presidenteNameRes = await pool.query('SELECT name FROM public."users" WHERE id = $1', [idPresidente]);
                    nombrePresidente = presidenteNameRes.rows[0]?.name || 'Admin';

                    // ✅ CORRECCIÓN INTEGRADA: Se asegura que el orden de columnas y placeholders
                    // sea claro y conciso para evitar errores de conteo.
                    insertColumns = `nombre_evento, descripcion, imagen_club, id_presidente, nombre_presidente, estado, ${fechaColumna}`;
                    insertValues = `($1, $2, $3, $4, $5, $6, NOW())`;
                    params = [
                        nombre_evento, // $1
                        descripcion,   // $2
                        imagen_club_url, // $3
                        idPresidente, // $4
                        nombrePresidente, // $5
                        clubEstado // 'activo' ($6)
                    ];

                } else {
                    if (!authVerification.authorized || !userId) {
                        return res.status(401).json({ success: false, message: "Debe iniciar sesión para solicitar un club." });
                    }

                    // CORRECCIÓN: Usando public."users"
                    const checkUser = await pool.query('SELECT role, club_id FROM public."users" WHERE id = $1', [userId]);
                    if (checkUser.rows.length === 0) {
                        return res.status(403).json({ success: false, message: "Usuario no encontrado." });
                    }
                    const userDetails = checkUser.rows[0];

                    if (userDetails.role === 'presidente' && userDetails.club_id !== null) {
                        return res.status(403).json({ success: false, message: "Ya eres presidente de un club activo." });
                    }

                    // CORRECCIÓN: Usando public.clubs_pendientes
                    const checkPending = await pool.query('SELECT id FROM public.clubs_pendientes WHERE id_presidente = $1', [userId]);
                    if (checkPending.rows.length > 0) {
                        return res.status(403).json({ success: false, message: "Ya tienes una solicitud de club pendiente." });
                    }

                    tabla = 'clubs_pendientes';
                    clubEstado = 'pendiente';
                    idPresidente = userId;
                    fechaColumna = 'fecha_solicitud';

                    // ✅ Consulta para tabla 'clubs_pendientes' (Solo columnas básicas)
                    insertColumns = `nombre_evento, descripcion, imagen_club, ${fechaColumna}, id_presidente`;
                    insertValues = `($1, $2, $3, NOW(), $4)`;
                    params = [
                        nombre_evento,
                        descripcion,
                        imagen_club_url,
                        idPresidente // id_presidente es $4
                    ];
                }

                console.log("Tabla de inserción determinada:", tabla);
                if (!tabla || (tabla !== 'clubs' && tabla !== 'clubs_pendientes')) {
                    return res.status(500).json({ success: false, message: "Error interno: La tabla de destino SQL es inválida. Revise la lógica de rol y autenticación." });
                }

                // CORRECCIÓN: Usando public."${tabla}"
                const insertQuery = `
                    INSERT INTO public."${tabla}" (${insertColumns}) 
                    VALUES ${insertValues}
                    RETURNING id, nombre_evento, descripcion
                `;

                const result = await pool.query(insertQuery, params);

                return res.status(201).json({
                    success: true,
                    message: isAdmin ? "Club creado y activado." : "Solicitud de club enviada y pendiente de aprobación.",
                    club: result.rows[0]
                });
            } catch (uploadError) {
                // 🚨 Asegurarse de limpiar el archivo temporal si falla Cloudinary 🚨
                if (imagenFilePathTemp && fs.existsSync(imagenFilePathTemp)) {
                    fs.unlinkSync(imagenFilePathTemp);
                }
                console.error("Error durante la subida/inserción (POST):", uploadError.message);

                if (uploadError.message.includes('Cloudinary upload failed')) {
                    return res.status(500).json({ success: false, message: "Error al subir la imagen. Verifica las credenciales de Cloudinary." });
                }
                if (uploadError.message.includes('maxFileSize')) {
                    return res.status(400).json({ success: false, message: "El archivo de imagen es demasiado grande. El límite es de 5MB." });
                }
                if (uploadError.code && uploadError.code.startsWith('23')) {
                    let tablaError = tabla || 'clubs_pendientes'; // Usamos la tabla estimada en el error
                    return res.status(500).json({ success: false, message: `Error de DB: Falla de integridad de datos. Revise campos NOT NULL en la tabla ${tablaError}. (${uploadError.code})` });
                }

                return res.status(500).json({ success: false, message: `Error interno del servidor. Consulte la consola para más detalles. (${uploadError.message})` });
            }
        }


        // --- 2.3. PUT: Actualizar club (Solo Admin o Presidente del club) ---
        if (method === "PUT") {
            const { id } = query;
            if (!id) return res.status(400).json({ success: false, message: "ID del club es requerido para actualizar." });

            const { fields, files } = await parseForm(req);
            const { nombre_evento, descripcion } = fields;
            const imagenFile = files.imagen_club ? files.imagen_club : null;

            let imagenFilePathTemp = imagenFile ? imagenFile.filepath : null;


            if (!isAdmin) {
                // CORRECCIÓN: Usando public.clubs
                const checkPresidente = await pool.query('SELECT id_presidente FROM public.clubs WHERE id = $1', [id]);
                if (checkPresidente.rows.length === 0 || checkPresidente.rows[0].id_presidente !== userId) {
                    // 🚨 Limpieza si no hay permisos 🚨 (Corrección de robustez)
                    if (imagenFilePathTemp && fs.existsSync(imagenFilePathTemp)) {
                        fs.unlinkSync(imagenFilePathTemp);
                    }
                    return res.status(403).json({ success: false, message: "No tienes permisos para editar este club." });
                }
            }

            let imagen_club_url = null;

            try {
                if (imagenFilePathTemp) {
                    // Subimos la nueva imagen a Cloudinary
                    imagen_club_url = await uploadToCloudinary(imagenFilePathTemp);
                }
            } catch (uploadError) {
                return res.status(500).json({ success: false, message: "Error al subir la nueva imagen a Cloudinary." });
            }


            const updates = [];
            const values = [];
            let paramIndex = 1;

            if (nombre_evento) {
                updates.push(`nombre_evento = $${paramIndex++}`);
                values.push(nombre_evento);
            }
            if (descripcion) {
                updates.push(`descripcion = $${paramIndex++}`);
                values.push(descripcion);
            }
            if (imagen_club_url) {
                updates.push(`imagen_club = $${paramIndex++}`);
                values.push(imagen_club_url); // Usamos la URL
            }

            if (updates.length === 0) {
                return res.status(400).json({ success: false, message: "No hay campos válidos para actualizar." });
            }

            values.push(id);
            const idParam = paramIndex;

            // CORRECCIÓN: Usando public.clubs
            const updateQuery = `
                UPDATE public.clubs SET ${updates.join(', ')} WHERE id = $${idParam}
                RETURNING id, nombre_evento, descripcion, imagen_club
            `;

            const result = await pool.query(updateQuery, values);

            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, message: "Club no encontrado para actualizar." });
            }

            return res.status(200).json({ success: true, message: "Club actualizado.", club: result.rows[0] });
        }


        // --- 2.4. DELETE: Eliminar club (Solo Admin) ---
        if (method === "DELETE") {
            const { id } = query;
            if (!id) return res.status(400).json({ success: false, message: "ID del club es requerido para eliminar." });

            verifyAdmin(req); // Requiere ser administrador

            // 1. Obtener URL de imagen para posible eliminación de Cloudinary (opcional, pero recomendado)
            // CORRECCIÓN: Usando public.clubs
            const clubRes = await pool.query('SELECT id_presidente, imagen_club FROM public.clubs WHERE id = $1', [id]);
            if (clubRes.rows.length === 0) {
                return res.status(404).json({ success: false, message: "Club no encontrado para eliminar." });
            }
            const { id_presidente, imagen_club } = clubRes.rows[0];

            // 2. Eliminar club de la tabla principal
            // CORRECCIÓN: Usando public.clubs
            const deleteRes = await pool.query('DELETE FROM public.clubs WHERE id = $1 RETURNING id', [id]);

            if (deleteRes.rows.length > 0) {
                // 3. Resetear rol y club_id del presidente asociado
                // CORRECCIÓN: Usando public."users"
                await pool.query('UPDATE public."users" SET role = $1, club_id = NULL WHERE id = $2', ['user', id_presidente]);

                // 4. TODO: Implementar borrado de Cloudinary usando imagen_club (requiere parsear la URL para obtener el public_id)
                console.log(`Club eliminado. Imagen URL para Cloudinary (borrado manual pendiente): ${imagen_club}`);

                return res.status(200).json({ success: true, message: "Club eliminado y rol de presidente restablecido." });
            }

            return res.status(404).json({ success: false, message: "Club no encontrado para eliminar." });
        }

        return res.status(405).json({ success: false, message: "Método no permitido." });

    } catch (error) {
        console.error("Error en clubsHandler:", error);

        if (error.message.includes('Acceso denegado') || error.message.includes('Token')) {
            return res.status(401).json({ success: false, message: error.message });
        }
        if (error.code === '42P01') {
            // Este es el error específico de relación no encontrada
            return res.status(500).json({ success: false, message: "Error: La tabla de base de datos no fue encontrada. Revisa 'DATABASE_URL' y los nombres de las tablas (public.nombre_tabla)." });
        }

        // Manejo de errores de Formidable (maxFileSize)
        if (error.message.includes('maxFileSize')) {
            return res.status(400).json({ success: false, message: "Error: La imagen es demasiado grande. Límite de 5MB." });
        }

        // Manejo de errores de Postgres (Integridad de datos)
        if (error.code && error.code.startsWith('23')) {
            return res.status(500).json({ success: false, message: `Error de DB: Falla de integridad de datos. (${error.code})` });
        }

        return res.status(500).json({ success: false, message: "Error interno del servidor. Consulte la consola para más detalles." });
    }
}


// ------------------------------------------------------------------------------------------------
// 3. EXPORTACIONES DEL HANDLER PRINCIPAL (Ruteador)
// ------------------------------------------------------------------------------------------------
export default async function clubsCombinedHandler(req, res) {
    const { query } = req;

    // Si la URL es /api/clubs?status=...&id=..., lo envía a statusChangeHandler
    if (query.status && query.id) {
        return statusChangeHandler(req, res);
    }
    // Si la URL es /api/clubs o /api/clubs?estado=... o /api/clubs?id=..., lo envía a clubsHandler
    return clubsHandler(req, res);
}