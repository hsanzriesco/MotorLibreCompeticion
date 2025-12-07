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

// Asegúrate de que el body parser esté desactivado para manejar 'formidable'
export const config = {
    api: { bodyParser: false },
};

// ------------------------------------------------------------------------------------------------
// 🛠️ HELPERS
// ------------------------------------------------------------------------------------------------

// 1. Parsear FormData (para POST/PUT con imágenes)
const parseForm = (req) => {
    return new Promise((resolve, reject) => {
        const form = formidable({
            multiples: false,
            uploadDir: path.join(process.cwd(), 'public/uploads/clubs'),
            keepExtensions: true,
            maxFileSize: 5 * 1024 * 1024, // 5MB
        });

        form.parse(req, (err, fields, files) => {
            if (err) {
                console.error("Error parsing form:", err);
                return reject(err);
            }

            // Convertir 'fields' a un objeto plano si es necesario (depende de la versión de formidable)
            const fieldData = Object.keys(fields).reduce((acc, key) => {
                acc[key] = fields[key][0]; // Tomar el primer valor si son arrays
                return acc;
            }, {});

            resolve({ fields: fieldData, files });
        });
    });
};

// 2. Verificar JWT y Rol
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
        verifyAdmin(req); // Solo Admin puede usar este endpoint
        if (!id) return res.status(400).json({ success: false, message: "ID del club es requerido." });

        // PUT (APROBAR/ACTIVAR) o DELETE (RECHAZAR/ELIMINAR)
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

                // 1. Obtener datos del club pendiente
                const pendingClubRes = await client.query(
                    "SELECT nombre_evento, descripcion, imagen_club, id_presidente, (SELECT name FROM users WHERE id = id_presidente) as nombre_presidente FROM clubes_pendientes WHERE id = $1",
                    [id]
                );

                if (pendingClubRes.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(404).json({ success: false, message: "Solicitud de club pendiente no encontrada." });
                }

                const club = pendingClubRes.rows[0];

                // 2. Mover el club a la tabla principal 'clubes'
                const insertRes = await client.query(
                    "INSERT INTO clubes (nombre_evento, descripcion, imagen_club, fecha_creacion, id_presidente, nombre_presidente, estado) VALUES ($1, $2, $3, NOW(), $4, $5, $6) RETURNING id",
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

                // 4. Eliminar la solicitud de la tabla de pendientes
                await client.query("DELETE FROM clubes_pendientes WHERE id = $1", [id]);

                await client.query('COMMIT');
                return res.status(200).json({ success: true, message: "Club aprobado y activado correctamente." });

            } catch (error) {
                await client.query('ROLLBACK');
                throw error; // Re-lanzar para que sea capturado por el catch exterior
            } finally {
                client.release();
            }
            // 🌟 FIN TRANSACCIÓN ATÓMICA 🌟

        } else if (method === 'DELETE') {
            // RECHAZAR SOLICITUD (Eliminar de pendientes)
            const result = await pool.query("DELETE FROM clubes_pendientes WHERE id = $1 RETURNING id", [id]);

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
        // --- 2.1. GET: Obtener clubes (Admin obtiene todos, Público/User obtiene activos) ---
        if (method === "GET") {
            const { id } = query;
            let result;

            if (id) {
                // Obtener club por ID (busca en ambas tablas si es Admin)
                let clubQuery = `
                    SELECT c.id, c.nombre_evento, c.descripcion, c.imagen_club, c.fecha_creacion, c.estado, c.id_presidente, u.name as nombre_presidente
                    FROM clubes c
                    LEFT JOIN users u ON c.id_presidente = u.id
                    WHERE c.id = $1 AND c.estado = 'activo'
                `;

                if (isAdmin) {
                    // Admin busca primero en activos, si no existe, busca en pendientes
                    let activeClub = await pool.query(clubQuery, [id]);
                    if (activeClub.rows.length > 0) {
                        return res.status(200).json({ success: true, data: activeClub.rows[0] });
                    }

                    let pendingClub = await pool.query(
                        "SELECT id, nombre_evento, descripcion, imagen_club, fecha_creacion, estado, id_presidente FROM clubes_pendientes WHERE id = $1",
                        [id]
                    );
                    if (pendingClub.rows.length > 0) {
                        return res.status(200).json({ success: true, data: pendingClub.rows[0] });
                    }
                    return res.status(404).json({ success: false, message: "Club no encontrado." });
                }

                // User normal solo busca en activos
                result = await pool.query(clubQuery, [id]);
                if (result.rows.length === 0) return res.status(404).json({ success: false, message: "Club no encontrado." });

            } else {
                // Listar todos los clubes (Admin lista activos + pendientes, Público solo activos)
                if (isAdmin) {
                    // ⚠️ Admin lista todos los clubes activos + todos los pendientes
                    const activosResult = await pool.query(
                        `SELECT c.id, c.nombre_evento, c.descripcion, c.imagen_club, c.fecha_creacion, c.estado, c.id_presidente, u.name as nombre_presidente
                         FROM clubes c
                         LEFT JOIN users u ON c.id_presidente = u.id`
                    );
                    const pendientesResult = await pool.query(
                        `SELECT id, nombre_evento, descripcion, imagen_club, fecha_creacion, 'pendiente' as estado, id_presidente, (SELECT name FROM users WHERE id = id_presidente) as nombre_presidente
                         FROM clubes_pendientes`
                    );

                    const allClubs = [...activosResult.rows.map(c => ({ ...c, estado: 'activo' })), ...pendientesResult.rows.map(c => ({ ...c, estado: 'pendiente' }))];
                    return res.status(200).json({ success: true, data: allClubs });

                } else {
                    // Público/User normal solo ve los activos
                    result = await pool.query(
                        `SELECT c.id, c.nombre_evento, c.descripcion, c.imagen_club, c.fecha_creacion, c.estado, c.id_presidente, u.name as nombre_presidente
                         FROM clubes c
                         LEFT JOIN users u ON c.id_presidente = u.id
                         WHERE c.estado = 'activo'`
                    );
                }
            }

            return res.status(200).json({ success: true, data: result.rows });
        }


        // --- 2.2. POST: Crear nuevo club o solicitud de club ---
        if (method === "POST") {
            const { fields, files } = await parseForm(req);
            const { nombre_evento, descripcion, estado } = fields;
            const imagenFile = files.imagen_club ? files.imagen_club[0] : null;

            if (!nombre_evento || !descripcion) {
                // Si la imagen se subió pero faltan campos, eliminamos el archivo subido
                if (imagenFile && imagenFile.filepath) fs.unlinkSync(imagenFile.filepath);
                return res.status(400).json({ success: false, message: "Faltan campos obligatorios: nombre o descripción." });
            }

            const imagen_club_path = imagenFile ? `/uploads/clubs/${path.basename(imagenFile.filepath)}` : null;

            // ⚠️ Lógica de estado/rol crucial ⚠️
            let tabla;
            let clubEstado;
            let idPresidente = isAdmin ? null : userId; // Si es Admin, el presidente es nulo (creado por Admin)

            if (isAdmin) {
                // 🚀 ADMIN CREA DIRECTAMENTE (se asume activo)
                verifyAdmin(req);
                tabla = 'clubes';
                clubEstado = 'activo';
            } else {
                // 👥 USUARIO NORMAL SOLICITA CREACIÓN (va a pendientes)
                if (!authVerification.authorized) {
                    if (imagen_club_path) fs.unlinkSync(path.join(process.cwd(), 'public', imagen_club_path));
                    return res.status(401).json({ success: false, message: "Debe iniciar sesión para solicitar un club." });
                }

                // Checkear si ya tiene un club o una solicitud pendiente
                const checkUser = await pool.query("SELECT role, club_id FROM users WHERE id = $1", [userId]);
                if (checkUser.rows[0].role !== 'user' || checkUser.rows[0].club_id !== null) {
                    if (imagen_club_path) fs.unlinkSync(path.join(process.cwd(), 'public', imagen_club_path));
                    return res.status(403).json({ success: false, message: "Ya eres presidente de un club o tienes un rol superior." });
                }

                const checkPending = await pool.query("SELECT id FROM clubes_pendientes WHERE id_presidente = $1", [userId]);
                if (checkPending.rows.length > 0) {
                    if (imagen_club_path) fs.unlinkSync(path.join(process.cwd(), 'public', imagen_club_path));
                    return res.status(403).json({ success: false, message: "Ya tienes una solicitud de club pendiente." });
                }

                tabla = 'clubes_pendientes';
                clubEstado = 'pendiente';
            }

            // Obtener el nombre del presidente para el registro
            const presidenteName = await pool.query("SELECT name FROM users WHERE id = $1", [idPresidente || userId]);
            const nombrePresidente = idPresidente ? presidenteName.rows[0]?.name : 'Admin';


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
                // Lógica de verificación de presidente. Asumimos que solo activos se pueden editar.
                const checkPresidente = await pool.query("SELECT id_presidente FROM clubes WHERE id = $1", [id]);
                if (checkPresidente.rows.length === 0 || checkPresidente.rows[0].id_presidente !== userId) {
                    return res.status(403).json({ success: false, message: "No tienes permisos para editar este club." });
                }
            }

            // Si se sube una nueva imagen, la subimos y obtenemos la ruta
            let imagen_club_path = null;
            if (imagenFile) {
                imagen_club_path = `/uploads/clubs/${path.basename(imagenFile.filepath)}`;
            }

            // Construir dinámicamente el query de actualización
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
                if (imagen_club_path) fs.unlinkSync(path.join(process.cwd(), 'public', imagen_club_path));
                return res.status(400).json({ success: false, message: "No hay campos válidos para actualizar." });
            }

            // Añadir el ID del club al final de los valores
            values.push(id);
            const idParam = paramIndex;

            const updateQuery = `
                UPDATE clubes SET ${updates.join(', ')} WHERE id = $${idParam}
                RETURNING id, nombre_evento, descripcion, imagen_club
            `;

            const result = await pool.query(updateQuery, values);

            if (result.rows.length === 0) {
                if (imagen_club_path) fs.unlinkSync(path.join(process.cwd(), 'public', imagen_club_path));
                return res.status(404).json({ success: false, message: "Club no encontrado para actualizar." });
            }

            return res.status(200).json({ success: true, message: "Club actualizado.", club: result.rows[0] });
        }


        // --- 2.4. DELETE: Eliminar club (Solo Admin) ---
        if (method === "DELETE") {
            verifyAdmin(req); // Solo Admin puede eliminar un club.
            const { id } = query;
            if (!id) return res.status(400).json({ success: false, message: "ID del club es requerido para eliminar." });

            // Buscamos si existe en activos o pendientes
            let result = await pool.query("DELETE FROM clubes WHERE id = $1 RETURNING id", [id]);
            let tabla = 'activos';

            if (result.rows.length === 0) {
                result = await pool.query("DELETE FROM clubes_pendientes WHERE id = $1 RETURNING id", [id]);
                tabla = 'pendientes';
            }

            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, message: "Club no encontrado para eliminar." });
            }

            // Si el club eliminado estaba activo y tenía presidente, desvincularlo.
            if (tabla === 'activos') {
                await pool.query("UPDATE users SET role = 'user', club_id = NULL WHERE club_id = $1", [id]);
            }

            return res.status(200).json({ success: true, message: "Club eliminado correctamente." });
        }


        // Si el método no es reconocido
        return res.status(405).json({ success: false, message: "Método no permitido." });

    } catch (error) {
        console.error("Error en clubsHandler:", error);

        if (error.message.includes('Acceso denegado') || error.message.includes('Token')) {
            return res.status(401).json({ success: false, message: error.message });
        }
        if (error.code === '42P01') {
            return res.status(500).json({ success: false, message: "Error: Tabla de base de datos no encontrada." });
        }
        if (error.message.includes('maxFileSize')) {
            return res.status(400).json({ success: false, message: "Error: La imagen es demasiado grande (máx. 5MB)." });
        }

        return res.status(500).json({ success: false, message: "Error interno del servidor." });
    }
}


// ------------------------------------------------------------------------------------------------
// 3. EXPORTACIONES DEL HANDLER PRINCIPAL (Ruteador)
// ------------------------------------------------------------------------------------------------
export default async function clubsCombinedHandler(req, res) {
    const { method, query } = req;

    // Ruta específica para el cambio de estado (Aprobación/Rechazo)
    if (query.status && query.id) {
        return statusChangeHandler(req, res);
    }

    // Rutas de CRUD principal
    return clubsHandler(req, res);
}