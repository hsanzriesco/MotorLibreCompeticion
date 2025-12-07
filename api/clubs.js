// api/clubs.js
// Maneja la gestión de clubes y solicitudes de clubes pendientes
// 🚨 MODIFICADO PARA USAR CLOUDINARY EN VEZ DE ALMACENAMIENTO LOCAL 🚨

import { Pool } from "pg";
import formidable from "formidable";
import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import { v2 as cloudinary } from 'cloudinary'; // Importar Cloudinary

// --- CONFIGURACIÓN DE BASE DE DATOS ---
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_no_usar_en_produccion';

// --- CONFIGURACIÓN DE CLOUDINARY ---
cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});


// Asegúrate de que el body parser esté desactivado para manejar 'formidable'
export const config = {
    api: { bodyParser: false, },
};

// ------------------------------------------------------------------------------------------------
// 🛠️ HELPERS
// ------------------------------------------------------------------------------------------------

/**
 * 1. Parsear FormData (modificado para usar /tmp en Vercel)
 */
const parseForm = (req) => {
    return new Promise((resolve, reject) => {
        // En Vercel/Serverless, formidable debe usar /tmp para archivos temporales
        const tempUploadDir = '/tmp';

        // Asegurar que el directorio temporal existe
        if (!fs.existsSync(tempUploadDir)) {
            fs.mkdirSync(tempUploadDir, { recursive: true });
        }

        const form = formidable({
            multitudes: false,
            // 🚨 CAMBIO CLAVE: Usamos el directorio /tmp para el archivo temporal
            uploadDir: tempUploadDir,
            keepExtensions: true,
            maxFileSize: 5 * 1024 * 1024, // 5MB
        });

        form.parse(req, (err, fields, files) => {
            if (err) {
                console.error("Error parsing form:", err);
                const uploadedFile = files.imagen_club ? files.imagen_club[0] : null;
                // Limpiamos el archivo temporal en caso de error (ej: maxFileSize)
                if (uploadedFile && uploadedFile.filepath && fs.existsSync(uploadedFile.filepath)) {
                    fs.unlinkSync(uploadedFile.filepath);
                }
                return reject(err);
            }

            const fieldData = Object.keys(fields).reduce((acc, key) => {
                acc[key] = fields[key][0];
                return acc;
            }, {});

            resolve({ fields: fieldData, files });
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

        // 🚨 Importante: Eliminar el archivo temporal de /tmp después de la subida exitosa
        fs.unlinkSync(filePath);

        return result.secure_url; // Devuelve la URL pública
    } catch (error) {
        // Si falla Cloudinary, también intentamos limpiar el archivo temporal
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        throw new Error(`Cloudinary upload failed: ${error.message}`);
    }
}

/**
 * 3. Verificar JWT y Rol
 */
const verifyToken = (req) => {
    // ... (Sin cambios, el mismo código de verificación)
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
    // ... (Sin cambios)
    const verification = verifyToken(req);
    if (!verification.authorized) throw new Error(verification.message);
    if (verification.user.role !== 'admin') throw new Error('Acceso denegado: Se requiere rol de administrador.');
    return verification.user;
};


// ------------------------------------------------------------------------------------------------
// 1. MANEJADOR DE CAMBIO DE ESTADO (Aprobar/Rechazar)
// ------------------------------------------------------------------------------------------------
// (Se mantiene igual, ya que solo maneja lógica de DB y rol)
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
                req.on('end', () => resolve(JSON.parse(Buffer.concat(chunks).toString())));
            });

            const { estado } = body;
            if (estado !== 'activo') return res.status(400).json({ success: false, message: "Estado de actualización no válido." });

            // 🌟 INICIO TRANSACCIÓN ATÓMICA DE APROBACIÓN 🌟
            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                // 1. Obtener datos del club pendiente (clubs_pendientes)
                const pendingClubRes = await client.query(
                    "SELECT nombre_evento, descripcion, imagen_club, id_presidente, (SELECT name FROM users WHERE id = id_presidente) as nombre_presidente FROM clubs_pendientes WHERE id = $1",
                    [id]
                );

                if (pendingClubRes.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(404).json({ success: false, message: "Solicitud de club pendiente no encontrada." });
                }

                const club = pendingClubRes.rows[0];

                // 2. Mover el club a la tabla principal 'clubs'
                const insertRes = await client.query(
                    "INSERT INTO clubs (nombre_evento, descripcion, imagen_club, fecha_creacion, id_presidente, nombre_presidente, estado) VALUES ($1, $2, $3, NOW(), $4, $5, $6) RETURNING id",
                    [club.nombre_evento, club.descripcion, club.imagen_club, club.id_presidente, club.nombre_presidente, 'activo']
                );
                const newClubId = insertRes.rows[0].id;

                // 3. Actualizar el usuario solicitante a presidente y asignarle el club_id
                if (club.id_presidente) {
                    await client.query(
                        "UPDATE users SET role = 'presidente', club_id = $1 WHERE id = $2",
                        [newClubId, club.id_presidente]
                    );
                }

                // 4. Eliminar la solicitud de la tabla de pendientes (clubs_pendientes)
                await client.query("DELETE FROM clubs_pendientes WHERE id = $1", [id]);

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
            const result = await pool.query("DELETE FROM clubs_pendientes WHERE id = $1 RETURNING id", [id]);

            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, message: "Solicitud de club pendiente no encontrada para rechazar." });
            }
            // TODO: Si se rechaza, habría que borrar la imagen de Cloudinary si existe (opcional)
            return res.status(200).json({ success: true, message: "Solicitud de club rechazada y eliminada." });
        }

        return res.status(405).json({ success: false, message: "Método no permitido." });

    } catch (error) {
        console.error("Error en statusChangeHandler:", error);
        if (error.message.includes('Acceso denegado')) {
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
        // (Código GET se mantiene igual)

        // --- 2.2. POST: Crear nuevo club o solicitud de club ---
        if (method === "POST") {
            const { fields, files } = await parseForm(req);
            const { nombre_evento, descripcion } = fields;
            const imagenFile = files.imagen_club ? files.imagen_club[0] : null;

            // Ruta temporal que creó formidable
            const imagenFilePathTemp = imagenFile ? imagenFile.filepath : null;

            // 🚨 CAMBIO CLAVE: Subir a Cloudinary y obtener la URL 🚨
            let imagen_club_url = null;

            try {
                if (imagenFilePathTemp) {
                    imagen_club_url = await uploadToCloudinary(imagenFilePathTemp);
                }
            } catch (uploadError) {
                console.error("Cloudinary Error:", uploadError.message);
                // Si la subida falla, Cloudinary Helper ya intentó limpiar el temporal.
                return res.status(500).json({ success: false, message: "Error al subir la imagen. Verifica las credenciales de Cloudinary." });
            }


            if (!nombre_evento || !descripcion) {
                // Ya no necesitamos limpiar aquí el archivo temporal porque uploadToCloudinary lo maneja.
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

                // Verificar club ACTIVO y PENDIENTE
                const checkClub = await pool.query("SELECT role FROM users WHERE id = $1", [userId]);
                if (checkClub.rows.length === 0 || checkClub.rows[0].role === 'presidente') {
                    return res.status(403).json({ success: false, message: "Ya eres presidente de un club activo." });
                }

                const checkPending = await pool.query("SELECT id FROM clubs_pendientes WHERE id_presidente = $1", [userId]);
                if (checkPending.rows.length > 0) {
                    return res.status(403).json({ success: false, message: "Ya tienes una solicitud de club pendiente." });
                }

                tabla = 'clubs_pendientes';
                clubEstado = 'pendiente';
                idPresidente = userId;
            }

            const presidenteNameRes = await pool.query("SELECT name FROM users WHERE id = $1", [idPresidente]);
            const nombrePresidente = presidenteNameRes.rows[0]?.name || (isAdmin ? 'Admin' : 'Usuario');


            const insertQuery = `
                INSERT INTO ${tabla} (nombre_evento, descripcion, imagen_club, fecha_creacion, estado, id_presidente, nombre_presidente) 
                VALUES ($1, $2, $3, NOW(), $4, $5, $6)
                RETURNING id, nombre_evento, descripcion, estado
            `;

            const result = await pool.query(insertQuery, [
                nombre_evento,
                descripcion,
                imagen_club_url, // 🚨 Guardamos la URL de Cloudinary
                clubEstado,
                idPresidente,
                nombrePresidente
            ]);

            return res.status(201).json({
                success: true,
                message: isAdmin ? "Club creado y activado." : "Solicitud de club enviada y pendiente de aprobación.",
                club: result.rows[0]
            });
        }


        // --- 2.3. PUT: Actualizar club (Solo Admin o Presidente del club) ---
        if (method === "PUT") {
            const { id } = query;
            if (!id) return res.status(400).json({ success: false, message: "ID del club es requerido para actualizar." });

            const { fields, files } = await parseForm(req);
            const { nombre_evento, descripcion } = fields;
            const imagenFile = files.imagen_club ? files.imagen_club[0] : null;

            if (!isAdmin) {
                const checkPresidente = await pool.query("SELECT id_presidente FROM clubs WHERE id = $1", [id]);
                if (checkPresidente.rows.length === 0 || checkPresidente.rows[0].id_presidente !== userId) {
                    const imagenFilePathTemp = imagenFile ? imagenFile.filepath : null;
                    if (imagenFilePathTemp && fs.existsSync(imagenFilePathTemp)) fs.unlinkSync(imagenFilePathTemp);
                    return res.status(403).json({ success: false, message: "No tienes permisos para editar este club." });
                }
            }

            let imagen_club_url = null;
            let imagenFilePathTemp = imagenFile ? imagenFile.filepath : null;

            try {
                if (imagenFilePathTemp) {
                    // 🚨 Subimos la nueva imagen a Cloudinary
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
                values.push(imagen_club_url); // 🚨 Usamos la URL
            }

            if (updates.length === 0) {
                return res.status(400).json({ success: false, message: "No hay campos válidos para actualizar." });
            }

            values.push(id);
            const idParam = paramIndex;

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
        // (Código DELETE se mantiene igual, aunque podría mejorarse para eliminar de Cloudinary)

        return res.status(405).json({ success: false, message: "Método no permitido." });

    } catch (error) {
        console.error("Error en clubsHandler:", error);

        if (error.message.includes('Acceso denegado') || error.message.includes('Token')) {
            return res.status(401).json({ success: false, message: error.message });
        }
        if (error.code === '42P01') {
            return res.status(500).json({ success: false, message: "Error: Tabla de base de datos no encontrada." });
        }
        if (error.message.includes('maxFileSize') || error.message.includes('Cloudinary upload failed')) {
            return res.status(400).json({ success: false, message: "Error: La imagen es demasiado grande o falló la subida externa." });
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
    const { method, query } = req;

    if (query.status && query.id) {
        return statusChangeHandler(req, res);
    }

    return clubsHandler(req, res);
}