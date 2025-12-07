// api/clubs.js
// Maneja la gestión de clubes y solicitudes de clubes pendientes

import { Pool } from "pg";
import formidable from "formidable";
import fs from "fs";
import jwt from "jsonwebtoken";
import { v2 as cloudinary } from 'cloudinary';
import { promisify } from 'util'; // Para la limpieza de archivos

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

// Convertir fs.unlink en una función Promise para usar con async/await
const unlinkAsync = promisify(fs.unlink);

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
            // ⭐ Aumentado ligeramente para mejor manejo de archivos ⭐
            multiples: false,
            keepExtensions: true,
            maxFileSize: 5 * 1024 * 1024, // 5MB 
        });

        form.parse(req, async (err, fields, files) => {
            let imagenFilePathTemp = files.imagen_club && files.imagen_club[0] ? files.imagen_club[0].filepath : null;

            if (err) {
                console.error("Error parsing form:", err);
                // 🚨 Limpieza del archivo temporal de formidable en caso de error de parseo 🚨
                if (imagenFilePathTemp && fs.existsSync(imagenFilePathTemp)) {
                    try { await unlinkAsync(imagenFilePathTemp); } catch (e) { console.error("Error al limpiar temp file:", e); }
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

            resolve({ fields: fieldData, files: fileData, imagenFilePathTemp });
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
            await unlinkAsync(filePath);
        }

        return result.secure_url; // Devuelve la URL pública
    } catch (error) {
        // Intentamos limpiar incluso si la subida falla
        if (fs.existsSync(filePath)) {
            await unlinkAsync(filePath);
        }
        // ⭐ Mejor manejo de error para el frontend ⭐
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
    if (!verification.authorized) {
        // Mejor respuesta para frontend (401)
        throw new Error(verification.message);
    }
    if (verification.user.role !== 'admin') {
        throw new Error('Acceso denegado: Se requiere rol de administrador.');
    }
    return verification.user;
};


// ------------------------------------------------------------------------------------------------
// 1. MANEJADOR DE CAMBIO DE ESTADO (Aprobar/Rechazar)
// ------------------------------------------------------------------------------------------------
async function statusChangeHandler(req, res) {
    const { method, query } = req;
    const { id } = query;

    try {
        // ⭐ CRÍTICO: Verificar Admin al inicio ⭐
        verifyAdmin(req);
        if (!id) return res.status(400).json({ success: false, message: "ID del club es requerido." });

        if (method === 'PUT') {
            // --- APROBAR SOLICITUD ---

            // ⭐ CRÍTICO: Manejar el cuerpo JSON para el estado ('activo') ⭐
            const body = await new Promise(resolve => {
                const chunks = [];
                req.on('data', chunk => chunks.push(chunk));
                req.on('end', () => {
                    try { resolve(JSON.parse(Buffer.concat(chunks).toString())); } catch (e) { resolve({}); }
                });
            });

            const { estado } = body;
            if (estado !== 'activo') return res.status(400).json({ success: false, message: "Estado de actualización no válido." });

            // 🌟 INICIO TRANSACCIÓN ATÓMICA DE APROBACIÓN 🌟
            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                // 1. Obtener datos del club pendiente (clubs_pendientes)
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

                // 2. Obtener el nombre del presidente para la tabla 'clubs'
                let nombrePresidente;
                const presidenteNameRes = await client.query('SELECT name FROM public."users" WHERE id = $1', [club.id_presidente]);
                nombrePresidente = presidenteNameRes.rows[0]?.name || 'Usuario desconocido';

                // 3. Mover el club a la tabla principal 'clubs'
                const insertRes = await client.query(
                    'INSERT INTO public.clubs (nombre_evento, descripcion, imagen_club, fecha_creacion, id_presidente, nombre_presidente, estado) VALUES ($1, $2, $3, NOW(), $4, $5, $6) RETURNING id',
                    [club.nombre_evento, club.descripcion, club.imagen_club, club.id_presidente, nombrePresidente, 'activo']
                );
                const newClubId = insertRes.rows[0].id;

                // 4. Actualizar el usuario solicitante a presidente y asignarle el club_id
                await client.query(
                    'UPDATE public."users" SET role = $1, club_id = $2 WHERE id = $3',
                    ['presidente', newClubId, club.id_presidente]
                );

                // 5. Eliminar la solicitud de la tabla de pendientes (clubs_pendientes)
                await client.query('DELETE FROM public.clubs_pendientes WHERE id = $1', [id]);

                await client.query('COMMIT');
                return res.status(200).json({ success: true, message: "Club aprobado y activado correctamente." });

            } catch (error) {
                await client.query('ROLLBACK');
                throw error; // Deja que el catch exterior maneje el error 500
            } finally {
                client.release();
            }

        } else if (method === 'DELETE') {
            // --- RECHAZAR SOLICITUD --- (Eliminar de clubs_pendientes)
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
        return res.status(500).json({ success: false, message: "Error interno del servidor en cambio de estado." });
    }
}


// ------------------------------------------------------------------------------------------------
// 2. CRUD PRINCIPAL DE CLUBES (GET, POST, PUT, DELETE)
// ------------------------------------------------------------------------------------------------
async function clubsHandler(req, res) {
    const { method, query } = req;
    let isAdmin = false;
    let userId = null;
    // ⭐ Importante: verificar token para saber si es ADMIN o PRESIDENTE ⭐
    let authVerification = verifyToken(req);

    if (authVerification.authorized) {
        userId = authVerification.user.id;
        isAdmin = authVerification.user.role === 'admin';
    }


    try {
        // --- 2.1. GET: Obtener clubes ---
        if (method === "GET") {
            const { estado, id } = query;

            // ... Lógica de GET (Activos y Pendientes) ...

            let queryText = `
                SELECT 
                    id, nombre_evento, descripcion, imagen_club, fecha_creacion, 
                    estado, id_presidente, nombre_presidente, 
                    0 as miembros 
                FROM public.clubs 
            `;
            const values = [];

            if (id) {
                // Obtener un club activo específico por ID
                queryText += " WHERE id = $1 AND estado = 'activo'";
                values.push(id);
                const result = await pool.query(queryText, values);

                // ⭐ CRÍTICO: Si no se encuentra en clubs, buscar en clubs_pendientes si es ADMIN ⭐
                if (result.rows.length === 0 && isAdmin) {
                    const pendingRes = await pool.query(
                        'SELECT id, nombre_evento, descripcion, imagen_club, fecha_solicitud as fecha_creacion, id_presidente, NULL as nombre_presidente, \'pendiente\' as estado FROM public.clubs_pendientes WHERE id = $1',
                        [id]
                    );
                    if (pendingRes.rows.length > 0) {
                        // El frontend de admin necesita el club_id y el nombre_presidente, 
                        // pero para un simple GET por ID, podemos devolver lo básico si lo encuentra.
                        return res.status(200).json({ success: true, club: pendingRes.rows[0], pending_club: pendingRes.rows[0] });
                    }
                }

                if (result.rows.length === 0) {
                    return res.status(404).json({ success: false, message: "Club no encontrado." });
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
                // ⭐ CRÍTICO: parseForm ahora devuelve imagenFilePathTemp ⭐
                const { fields, files, imagenFilePathTemp: tempPath } = await parseForm(req);
                imagenFilePathTemp = tempPath;

                const { nombre_evento, descripcion } = fields;

                if (!nombre_evento || !descripcion) {
                    return res.status(400).json({ success: false, message: "Faltan campos obligatorios: nombre o descripción." });
                }

                if (imagenFilePathTemp) {
                    imagen_club_url = await uploadToCloudinary(imagenFilePathTemp);
                }

                // ... Lógica de estado/rol crucial ...
                let tabla;
                let clubEstado;
                let idPresidente = userId;
                let fechaColumna;
                let insertColumns;
                let insertValues;
                let params;

                if (isAdmin) {
                    // Admin crea club activo
                    tabla = 'clubs';
                    clubEstado = 'activo';
                    fechaColumna = 'fecha_creacion';

                    let nombrePresidente = 'Admin';
                    if (idPresidente) {
                        const presidenteNameRes = await pool.query('SELECT name FROM public."users" WHERE id = $1', [idPresidente]);
                        nombrePresidente = presidenteNameRes.rows[0]?.name || 'Admin';
                    }

                    // ✅ Consulta para tabla 'clubs'
                    insertColumns = `nombre_evento, descripcion, imagen_club, id_presidente, nombre_presidente, estado, ${fechaColumna}`;
                    insertValues = `($1, $2, $3, $4, $5, $6, NOW())`;
                    params = [
                        nombre_evento, // $1
                        descripcion,   // $2
                        imagen_club_url, // $3
                        idPresidente, // $4
                        nombrePresidente, // $5
                        clubEstado // 'activo' ($6)
                    ];

                } else {
                    // Usuario solicita club pendiente
                    if (!authVerification.authorized || !userId) {
                        return res.status(401).json({ success: false, message: "Debe iniciar sesión para solicitar un club." });
                    }

                    // Verificar si el usuario ya es presidente o tiene una solicitud pendiente
                    const checkUser = await pool.query('SELECT role, club_id FROM public."users" WHERE id = $1', [userId]);
                    if (checkUser.rows.length === 0) {
                        return res.status(403).json({ success: false, message: "Usuario no encontrado." });
                    }
                    const userDetails = checkUser.rows[0];

                    if (userDetails.role === 'presidente' && userDetails.club_id !== null) {
                        return res.status(403).json({ success: false, message: "Ya eres presidente de un club activo." });
                    }

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

                if (!tabla || (tabla !== 'clubs' && tabla !== 'clubs_pendientes')) {
                    return res.status(500).json({ success: false, message: "Error interno: La tabla de destino SQL es inválida." });
                }

                // Ejecutar la inserción
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
                // 🚨 Limpieza de archivo temporal si falla el proceso 🚨
                if (imagenFilePathTemp && fs.existsSync(imagenFilePathTemp)) {
                    await unlinkAsync(imagenFilePathTemp).catch(e => console.error("Error al limpiar temp file:", e));
                }
                console.error("Error durante la subida/inserción (POST):", uploadError.message);

                if (uploadError.message.includes('Cloudinary upload failed')) {
                    return res.status(500).json({ success: false, message: "Error al subir la imagen. Verifica las credenciales de Cloudinary." });
                }
                if (uploadError.message.includes('maxFileSize')) {
                    return res.status(400).json({ success: false, message: "El archivo de imagen es demasiado grande. El límite es de 5MB." });
                }

                // Delegamos la mayoría de errores al catch principal
                throw uploadError;
            }
        }


        // --- 2.3. PUT: Actualizar club (Solo Admin o Presidente del club) ---
        if (method === "PUT") {
            const { id } = query;
            if (!id) return res.status(400).json({ success: false, message: "ID del club es requerido para actualizar." });

            let imagenFilePathTemp = null;
            let imagen_club_url = null;

            try {
                // ⭐ CRÍTICO: parseForm ahora devuelve imagenFilePathTemp ⭐
                const { fields, files, imagenFilePathTemp: tempPath } = await parseForm(req);
                imagenFilePathTemp = tempPath;

                const { nombre_evento, descripcion } = fields;

                // ⭐ CRÍTICO: Verificar permisos ANTES de la subida a Cloudinary ⭐
                if (!isAdmin) {
                    const checkPresidente = await pool.query('SELECT id_presidente FROM public.clubs WHERE id = $1', [id]);
                    if (checkPresidente.rows.length === 0 || checkPresidente.rows[0].id_presidente !== userId) {
                        // 🚨 Limpieza si no hay permisos 🚨 
                        if (imagenFilePathTemp && fs.existsSync(imagenFilePathTemp)) {
                            await unlinkAsync(imagenFilePathTemp).catch(e => console.error("Error al limpiar temp file:", e));
                        }
                        return res.status(403).json({ success: false, message: "No tienes permisos para editar este club." });
                    }
                }

                if (imagenFilePathTemp) {
                    // Subimos la nueva imagen a Cloudinary (y se encarga de limpiar el temporal)
                    imagen_club_url = await uploadToCloudinary(imagenFilePathTemp);
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

                const updateQuery = `
                    UPDATE public.clubs SET ${updates.join(', ')} WHERE id = $${idParam}
                    RETURNING id, nombre_evento, descripcion, imagen_club
                `;

                const result = await pool.query(updateQuery, values);

                if (result.rows.length === 0) {
                    return res.status(404).json({ success: false, message: "Club no encontrado para actualizar." });
                }

                return res.status(200).json({ success: true, message: "Club actualizado.", club: result.rows[0] });

            } catch (uploadError) {
                // 🚨 Limpieza de archivo temporal si falla el proceso 🚨
                if (imagenFilePathTemp && fs.existsSync(imagenFilePathTemp)) {
                    await unlinkAsync(imagenFilePathTemp).catch(e => console.error("Error al limpiar temp file:", e));
                }
                console.error("Error durante la subida/actualización (PUT):", uploadError.message);

                if (uploadError.message.includes('Cloudinary upload failed')) {
                    return res.status(500).json({ success: false, message: "Error al subir la imagen. Verifica las credenciales de Cloudinary." });
                }
                if (uploadError.message.includes('maxFileSize')) {
                    return res.status(400).json({ success: false, message: "El archivo de imagen es demasiado grande. El límite es de 5MB." });
                }

                // Delegamos la mayoría de errores al catch principal
                throw uploadError;
            }
        }


        // --- 2.4. DELETE: Eliminar club (Solo Admin) ---
        if (method === "DELETE") {
            const { id } = query;
            if (!id) return res.status(400).json({ success: false, message: "ID del club es requerido para eliminar." });

            // ⭐ CRÍTICO: Verificar Admin ⭐
            verifyAdmin(req);

            // 1. Obtener URL de imagen para posible eliminación de Cloudinary 
            const clubRes = await pool.query('SELECT id_presidente, imagen_club FROM public.clubs WHERE id = $1', [id]);
            if (clubRes.rows.length === 0) {
                return res.status(404).json({ success: false, message: "Club no encontrado para eliminar." });
            }
            const { id_presidente, imagen_club } = clubRes.rows[0];

            // 2. Eliminar club de la tabla principal
            const deleteRes = await pool.query('DELETE FROM public.clubs WHERE id = $1 RETURNING id', [id]);

            if (deleteRes.rows.length > 0) {
                // 3. Resetear rol y club_id del presidente asociado
                await pool.query('UPDATE public."users" SET role = $1, club_id = NULL WHERE id = $2', ['user', id_presidente]);

                // 4. Implementar borrado de Cloudinary (Opcional, pero recomendado)
                if (imagen_club) {
                    try {
                        // Función helper para extraer public_id de la URL de Cloudinary
                        const publicId = imagen_club.split('/').pop().split('.')[0];
                        await cloudinary.uploader.destroy(`motor-libre-clubs/${publicId}`);
                        console.log(`Imagen ${publicId} eliminada de Cloudinary.`);
                    } catch (e) {
                        console.warn("ADVERTENCIA: Falló la eliminación de la imagen en Cloudinary.", e.message);
                    }
                }

                return res.status(200).json({ success: true, message: "Club eliminado y rol de presidente restablecido." });
            }

            return res.status(404).json({ success: false, message: "Club no encontrado para eliminar." });
        }

        return res.status(405).json({ success: false, message: "Método no permitido." });

    } catch (error) {
        // ... Manejo de errores ...
        console.error("Error en clubsHandler:", error);

        if (error.message.includes('Acceso denegado') || error.message.includes('Token')) {
            // El error de verifyToken cae aquí y devuelve 401
            return res.status(401).json({ success: false, message: error.message });
        }
        if (error.code === '42P01') {
            return res.status(500).json({ success: false, message: "Error: La tabla de base de datos no fue encontrada. Revisa 'DATABASE_URL' y los nombres de las tablas (public.clubs, public.clubs_pendientes, public.users)." });
        }
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

    // Si la URL es /api/clubs?status=change&id=..., lo envía a statusChangeHandler
    if (query.status === 'change' && query.id) {
        return statusChangeHandler(req, res);
    }
    // Para todos los demás casos (CRUD de clubes)
    return clubsHandler(req, res);
}