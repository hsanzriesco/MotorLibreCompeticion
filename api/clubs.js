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
                // ✅ CORRECCIÓN: Usar 'clubs_pendientes' sin 'public.' ni comillas dobles
                const pendingClubRes = await client.query(
                    'SELECT nombre_evento, descripcion, imagen_club, id_presidente, (SELECT name FROM "users" WHERE id = clubs_pendientes.id_presidente) as nombre_presidente FROM clubs_pendientes WHERE id = $1',
                    [id]
                );

                if (pendingClubRes.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(404).json({ success: false, message: "Solicitud de club pendiente no encontrada." });
                }

                const club = pendingClubRes.rows[0];

                // 🚨 VERIFICACIÓN AÑADIDA 🚨
                if (!club.id_presidente) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ success: false, message: "El solicitante (id_presidente) no está definido." });
                }


                // 2. Mover el club a la tabla principal 'clubs'
                // ✅ CORRECCIÓN: Usar 'clubs' sin 'public.' ni comillas dobles
                const insertRes = await client.query(
                    'INSERT INTO clubs (nombre_evento, descripcion, imagen_club, fecha_creacion, id_presidente, nombre_presidente, estado) VALUES ($1, $2, $3, NOW(), $4, $5, $6) RETURNING id',
                    [club.nombre_evento, club.descripcion, club.imagen_club, club.id_presidente, club.nombre_presidente, 'activo']
                );
                const newClubId = insertRes.rows[0].id;

                // 3. Actualizar el usuario solicitante a presidente y asignarle el club_id
                await client.query(
                    'UPDATE "users" SET role = $1, club_id = $2 WHERE id = $3',
                    ['presidente', newClubId, club.id_presidente]
                );

                // 4. Eliminar la solicitud de la tabla de pendientes (clubs_pendientes)
                // ✅ CORRECCIÓN: Usar 'clubs_pendientes' sin 'public.' ni comillas dobles
                await client.query('DELETE FROM clubs_pendientes WHERE id = $1', [id]);

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
            // ✅ CORRECCIÓN: Usar 'clubs_pendientes' sin 'public.' ni comillas dobles
            const result = await pool.query('DELETE FROM clubs_pendientes WHERE id = $1 RETURNING id', [id]);

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

            // ✅ CORRECCIÓN: Usar 'clubs' sin 'public.' ni comillas dobles
            let queryText = `
                SELECT 
                    id, nombre_evento, descripcion, imagen_club, fecha_creacion, 
                    estado, id_presidente, nombre_presidente, 
                    0 as miembros 
                FROM clubs 
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
                    // ✅ CORRECCIÓN: Usar 'clubs_pendientes' sin 'public.' ni comillas dobles
                    queryText = 'SELECT id, nombre_evento, descripcion, imagen_club, fecha_creacion, estado, id_presidente, nombre_presidente FROM clubs_pendientes ORDER BY fecha_creacion DESC';
                    const result = await pool.query(queryText);
                    return res.status(200).json({ success: true, pending_clubs: result.rows });
                } else if (estado === 'pendiente' && !isAdmin) {
                    return res.status(403).json({ success: false, message: "Acceso denegado a solicitudes pendientes." });
                }
            }

            // Si no se especifica ID ni estado, devolver todos los clubes activos por defecto.
            // ✅ CORRECCIÓN: Usar 'clubs' sin 'public.' ni comillas dobles
            const defaultResult = await pool.query(`
                SELECT 
                    id, nombre_evento, descripcion, imagen_club, fecha_creacion, 
                    estado, id_presidente, nombre_presidente, 
                    0 as miembros 
                FROM clubs WHERE estado = 'activo' ORDER BY fecha_creacion DESC
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

                if (isAdmin) {
                    tabla = 'clubs';
                    clubEstado = 'activo';
                } else {
                    if (!authVerification.authorized || !userId) {
                        return res.status(401).json({ success: false, message: "Debe iniciar sesión para solicitar un club." });
                    }

                    // 🚨 VERIFICACIÓN ADICIONAL DE EXISTENCIA DE USUARIO 🚨
                    // 🚨 CORRECCIÓN: Se usan comillas para "users" 🚨
                    const checkUser = await pool.query('SELECT role, club_id, name FROM "users" WHERE id = $1', [userId]);
                    if (checkUser.rows.length === 0) {
                        return res.status(403).json({ success: false, message: "Usuario no encontrado." });
                    }
                    const userDetails = checkUser.rows[0];

                    if (userDetails.role === 'presidente' && userDetails.club_id !== null) {
                        return res.status(403).json({ success: false, message: "Ya eres presidente de un club activo." });
                    }

                    // 🚨 CORRECCIÓN: Usar clubs_pendientes sin public. 🚨
                    const checkPending = await pool.query('SELECT id FROM clubs_pendientes WHERE id_presidente = $1', [userId]);
                    if (checkPending.rows.length > 0) {
                        return res.status(403).json({ success: false, message: "Ya tienes una solicitud de club pendiente." });
                    }

                    tabla = 'clubs_pendientes';
                    clubEstado = 'pendiente';
                    idPresidente = userId;
                }

                // 🚨 CORRECCIÓN CLAVE APLICADA AQUÍ 🚨
                console.log("Tabla de inserción determinada:", tabla);
                if (!tabla || (tabla !== 'clubs' && tabla !== 'clubs_pendientes')) {
                    // Este error se activará si la lógica de rol falla y 'tabla' no se define correctamente.
                    return res.status(500).json({ success: false, message: "Error interno: La tabla de destino SQL es inválida. Revise la lógica de rol y autenticación." });
                }

                // Obtenemos el nombre del presidente
                // 🚨 CORRECCIÓN: Se usan comillas para "users" 🚨
                let nombrePresidente;
                const presidenteNameRes = await pool.query('SELECT name FROM "users" WHERE id = $1', [idPresidente]);
                nombrePresidente = presidenteNameRes.rows[0]?.name || (isAdmin ? 'Admin' : 'Usuario desconocido');


                const insertQuery = `
                    -- Usar "${tabla}" para asegurar la resolución de nombres de tabla
                    INSERT INTO "${tabla}" (nombre_evento, descripcion, imagen_club, fecha_creacion, estado, id_presidente, nombre_presidente) 
                    VALUES ($1, $2, $3, NOW(), $4, $5, $6)
                    RETURNING id, nombre_evento, descripcion, estado
                `;

                const result = await pool.query(insertQuery, [
                    nombre_evento,
                    descripcion,
                    imagen_club_url,
                    clubEstado,
                    idPresidente,
                    nombrePresidente
                ]);

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

                // Manejo de errores específicos para POST
                if (uploadError.message.includes('Cloudinary upload failed')) {
                    return res.status(500).json({ success: false, message: "Error al subir la imagen. Verifica las credenciales de Cloudinary." });
                }
                // Si el error es formidable (tamaño de archivo)
                if (uploadError.message.includes('maxFileSize')) {
                    return res.status(400).json({ success: false, message: "El archivo de imagen es demasiado grande. El límite es de 5MB." });
                }
                // Si el error es de DB
                if (uploadError.code && uploadError.code.startsWith('23')) {
                    return res.status(500).json({ success: false, message: `Error de DB: Falla de integridad de datos. Revise campos NOT NULL en la tabla ${tabla || 'clubs_pendientes'}. (${uploadError.code})` });
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
                // ✅ CORRECCIÓN: Usar 'clubs' sin 'public.' ni comillas dobles
                const checkPresidente = await pool.query('SELECT id_presidente FROM clubs WHERE id = $1', [id]);
                if (checkPresidente.rows.length === 0 || checkPresidente.rows[0].id_presidente !== userId) {
                    // 🚨 Limpieza si no hay permisos 🚨
                    if (imagenFilePathTemp && fs.existsSync(imagenFilePathTemp)) fs.unlinkSync(imagenFilePathTemp);
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

            // ✅ CORRECCIÓN: Usar 'clubs' sin 'public.' ni comillas dobles
            const updateQuery = `
                UPDATE clubs SET ${updates.join(', ')} WHERE id = $${idParam}
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
            // ✅ CORRECCIÓN: Usar 'clubs' sin 'public.' ni comillas dobles
            const clubRes = await pool.query('SELECT id_presidente, imagen_club FROM clubs WHERE id = $1', [id]);
            if (clubRes.rows.length === 0) {
                return res.status(404).json({ success: false, message: "Club no encontrado para eliminar." });
            }
            const { id_presidente, imagen_club } = clubRes.rows[0];

            // 2. Eliminar club de la tabla principal
            // ✅ CORRECCIÓN: Usar 'clubs' sin 'public.' ni comillas dobles
            const deleteRes = await pool.query('DELETE FROM clubs WHERE id = $1 RETURNING id', [id]);

            if (deleteRes.rows.length > 0) {
                // 3. Resetear rol y club_id del presidente asociado
                // 🚨 CORRECCIÓN: Usar comillas para "users" 🚨
                await pool.query('UPDATE "users" SET role = $1, club_id = NULL WHERE id = $2', ['user', id_presidente]);

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
            return res.status(500).json({ success: false, message: "Error: La tabla de base de datos no fue encontrada. Revisa 'DATABASE_URL' y los nombres de las tablas." });
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
    const { method, query } = req;

    // Si la URL es /api/clubs?status=...&id=..., lo envía a statusChangeHandler
    if (query.status && query.id) {
        return statusChangeHandler(req, res);
    }
    // Si la URL es /api/clubs o /api/clubs?estado=... o /api/clubs?id=..., lo envía a clubsHandler
    return clubsHandler(req, res);
}