// api/clubs.js
// Maneja la gestión de clubes y solicitudes de clubes pendientes

import { Pool } from "pg";
import formidable from "formidable";
import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";

// --- CONFIGURACIÓN DE BASE DE DATOS ---
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_no_usar_en_produccion';

// Directorio de subida (Debe existir)
const UPLOAD_DIR = path.join(process.cwd(), 'public/uploads/clubs');

// Asegúrate de que el body parser esté desactivado para manejar 'formidable'
export const config = {
    api: { bodyParser: false },
};

// ------------------------------------------------------------------------------------------------
// 🛠️ HELPERS
// ------------------------------------------------------------------------------------------------

/**
 * 1. Parsear FormData (para POST/PUT con imágenes)
 */
const parseForm = (req) => {
    return new Promise((resolve, reject) => {
        // Asegurar que el directorio existe
        if (!fs.existsSync(UPLOAD_DIR)) {
            fs.mkdirSync(UPLOAD_DIR, { recursive: true });
        }

        const form = formidable({
            multitudes: false,
            uploadDir: UPLOAD_DIR,
            keepExtensions: true,
            maxFileSize: 5 * 1024 * 1024, // 5MB
        });

        form.parse(req, (err, fields, files) => {
            if (err) {
                console.error("Error parsing form:", err);
                // Si hay error (ej: tamaño), intenta limpiar el archivo temporal que se haya podido crear
                const uploadedFile = files.imagen_club ? files.imagen_club[0] : null;
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
 * 2. Verificar JWT y Rol
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
 * 3. Verificar si es Administrador
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
/**
 * Gestiona la aprobación (PUT) o el rechazo (DELETE) de solicitudes en clubs_pendientes.
 */
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
        if (method === "GET") {
            const { id } = query;
            let result;

            if (id) {
                // Obtener club por ID (busca en ambas tablas si es Admin)
                let clubQuery = `
                    SELECT c.id, c.nombre_evento, c.descripcion, c.imagen_club, c.fecha_creacion, c.estado, c.id_presidente, u.name as nombre_presidente
                    FROM clubs c
                    LEFT JOIN users u ON c.id_presidente = u.id
                    WHERE c.id = $1 AND c.estado = 'activo'
                `;

                if (isAdmin) {
                    let activeClub = await pool.query(clubQuery, [id]);
                    if (activeClub.rows.length > 0) {
                        return res.status(200).json({ success: true, data: activeClub.rows[0] });
                    }

                    let pendingClub = await pool.query(
                        "SELECT id, nombre_evento, descripcion, imagen_club, fecha_creacion, 'pendiente' as estado, id_presidente, (SELECT name FROM users WHERE id = id_presidente) as nombre_presidente FROM clubs_pendientes WHERE id = $1",
                        [id]
                    );
                    if (pendingClub.rows.length > 0) {
                        return res.status(200).json({ success: true, data: pendingClub.rows[0] });
                    }
                    return res.status(404).json({ success: false, message: "Club no encontrado." });
                }

                result = await pool.query(clubQuery, [id]);
                if (result.rows.length === 0) return res.status(404).json({ success: false, message: "Club no encontrado." });
                result = { rows: result.rows };

            } else {
                // Listar todos los clubes (Admin lista activos + pendientes, Público solo activos)
                if (isAdmin) {
                    const activosResult = await pool.query(
                        `SELECT c.id, c.nombre_evento, c.descripcion, c.imagen_club, c.fecha_creacion, c.estado, c.id_presidente, u.name as nombre_presidente
                         FROM clubs c
                         LEFT JOIN users u ON c.id_presidente = u.id`
                    );
                    const pendientesResult = await pool.query(
                        `SELECT id, nombre_evento, descripcion, imagen_club, fecha_creacion, 'pendiente' as estado, id_presidente, (SELECT name FROM users WHERE id = id_presidente) as nombre_presidente
                         FROM clubs_pendientes`
                    );

                    const allClubs = [
                        ...activosResult.rows.map(c => ({ ...c, estado: 'activo' })),
                        ...pendientesResult.rows.map(c => ({ ...c, estado: 'pendiente' }))
                    ];
                    return res.status(200).json({ success: true, data: allClubs });

                } else {
                    result = await pool.query(
                        `SELECT c.id, c.nombre_evento, c.descripcion, c.imagen_club, c.fecha_creacion, c.estado, c.id_presidente, u.name as nombre_presidente
                         FROM clubs c
                         LEFT JOIN users u ON c.id_presidente = u.id
                         WHERE c.estado = 'activo'`
                    );
                }
            }

            if (result && result.rows) {
                return res.status(200).json({ success: true, data: result.rows });
            }
        }


        // --- 2.2. POST: Crear nuevo club o solicitud de club ---
        if (method === "POST") {
            const { fields, files } = await parseForm(req);
            const { nombre_evento, descripcion } = fields;
            const imagenFile = files.imagen_club ? files.imagen_club[0] : null;

            // 🚨 CORRECCIÓN 1: La ruta del archivo en el servidor debe ser la ruta temporal de formidable
            const imagenFilePathTemp = imagenFile ? imagenFile.filepath : null;
            // La ruta pública a guardar en la DB (para acceder desde el frontend)
            const imagen_club_path = imagenFile ? `/uploads/clubs/${path.basename(imagenFile.filepath)}` : null;

            if (!nombre_evento || !descripcion) {
                // 🚨 CORRECCIÓN 2: Usar la ruta temporal para limpieza en caso de error
                if (imagenFilePathTemp && fs.existsSync(imagenFilePathTemp)) fs.unlinkSync(imagenFilePathTemp);
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
                if (!authVerification.authorized || !userId) { // Asegurarse de que userId existe
                    if (imagenFilePathTemp && fs.existsSync(imagenFilePathTemp)) fs.unlinkSync(imagenFilePathTemp);
                    return res.status(401).json({ success: false, message: "Debe iniciar sesión para solicitar un club." });
                }

                // 🚨 CORRECCIÓN 3: Verificar club ACTIVO y PENDIENTE
                const checkClub = await pool.query("SELECT club_id, role FROM users WHERE id = $1", [userId]);
                if (checkClub.rows.length === 0 || checkClub.rows[0].role === 'presidente') {
                    if (imagenFilePathTemp && fs.existsSync(imagenFilePathTemp)) fs.unlinkSync(imagenFilePathTemp);
                    return res.status(403).json({ success: false, message: "Ya eres presidente de un club activo." });
                }

                const checkPending = await pool.query("SELECT id FROM clubs_pendientes WHERE id_presidente = $1", [userId]);
                if (checkPending.rows.length > 0) {
                    if (imagenFilePathTemp && fs.existsSync(imagenFilePathTemp)) fs.unlinkSync(imagenFilePathTemp);
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
                imagen_club_path,
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
                // Verificar si el usuario logeado es el presidente de este club
                const checkPresidente = await pool.query("SELECT id_presidente FROM clubs WHERE id = $1", [id]);
                if (checkPresidente.rows.length === 0 || checkPresidente.rows[0].id_presidente !== userId) {
                    // Limpieza si se subió un archivo y no tiene permisos
                    const imagenFilePathTemp = imagenFile ? imagenFile.filepath : null;
                    if (imagenFilePathTemp && fs.existsSync(imagenFilePathTemp)) fs.unlinkSync(imagenFilePathTemp);
                    return res.status(403).json({ success: false, message: "No tienes permisos para editar este club." });
                }
            }

            let imagen_club_path = null;
            let imagenFilePathTemp = null; // Ruta temporal para limpieza si falla la DB
            if (imagenFile) {
                imagenFilePathTemp = imagenFile.filepath; // Usar la ruta completa de formidable
                imagen_club_path = `/uploads/clubs/${path.basename(imagenFile.filepath)}`;
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
            if (imagen_club_path) {
                updates.push(`imagen_club = $${paramIndex++}`);
                values.push(imagen_club_path);
            }

            if (updates.length === 0) {
                // Limpiar si no hay cambios válidos, pero se subió imagen
                if (imagenFilePathTemp && fs.existsSync(imagenFilePathTemp)) fs.unlinkSync(imagenFilePathTemp);
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
                // Limpiar si no se encontró el club
                if (imagenFilePathTemp && fs.existsSync(imagenFilePathTemp)) fs.unlinkSync(imagenFilePathTemp);
                return res.status(404).json({ success: false, message: "Club no encontrado para actualizar." });
            }

            return res.status(200).json({ success: true, message: "Club actualizado.", club: result.rows[0] });
        }


        // --- 2.4. DELETE: Eliminar club (Solo Admin) ---
        if (method === "DELETE") {
            verifyAdmin(req);
            const { id } = query;
            if (!id) return res.status(400).json({ success: false, message: "ID del club es requerido para eliminar." });

            let result = await pool.query("DELETE FROM clubs WHERE id = $1 RETURNING id", [id]);
            let tabla = 'activos';

            if (result.rows.length === 0) {
                result = await pool.query("DELETE FROM clubs_pendientes WHERE id = $1 RETURNING id", [id]);
                tabla = 'pendientes';
            }

            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, message: "Club no encontrado para eliminar." });
            }

            if (tabla === 'activos') {
                // 🚨 CORRECCIÓN 4: Limpiar club_id en users
                await pool.query("UPDATE users SET role = 'user', club_id = NULL WHERE club_id = $1", [id]);
                // TODO: Limpiar la imagen del disco
            }

            return res.status(200).json({ success: true, message: "Club eliminado correctamente." });
        }


        return res.status(405).json({ success: false, message: "Método no permitido." });

    } catch (error) {
        console.error("Error en clubsHandler:", error);

        if (error.message.includes('Acceso denegado') || error.message.includes('Token')) {
            return res.status(401).json({ success: false, message: error.message });
        }
        if (error.code === '42P01') {
            return res.status(500).json({ success: false, message: "Error: Tabla de base de datos no encontrada. Verifique que sus tablas se llamen 'clubs' y 'clubs_pendientes'." });
        }
        if (error.message.includes('maxFileSize')) {
            return res.status(400).json({ success: false, message: "Error: La imagen es demasiado grande (máx. 5MB)." });
        }

        // Error de la base de datos (Ej: NOT NULL violation)
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