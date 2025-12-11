// clubs.js - VERSIÓN FINAL CON DESVINCULACIÓN DE USUARIOS TRAS BORRADO DE CLUB Y PERMISO DE PRESIDENTE
import { Pool } from "pg";
import formidable from "formidable";
import fs from "fs";
import jwt from "jsonwebtoken";
import { v2 as cloudinary } from 'cloudinary';
import { promisify } from 'util';

// --- CONFIGURACIÓN DE BASE DE DATOS ---
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_no_usar_en_produccion';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.CLOUDINARY_API_SECRET
});

// Convertir fs.unlink en una función Promise para usar con async/await
const unlinkAsync = promisify(fs.unlink);

// Desactiva el body parser de Next.js para permitir que formidable lea el cuerpo del request
export const config = {
    api: { bodyParser: false, },
};

// 🛠️ HELPER: Función para leer el cuerpo JSON (para join/leave)
const getBody = async (req) => {
    try {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const buffer = Buffer.concat(chunks);
        if (buffer.length === 0) return null;
        return JSON.parse(buffer.toString());
    } catch (e) {
        return null;
    }
};

// Función de utilidad para eliminar una imagen de Cloudinary
async function deleteFromCloudary(imageUrl) {
    if (!imageUrl) return;

    try {
        const parts = imageUrl.split('/');
        // La carpeta es 'motor-libre-clubs'
        const folder = 'motor-libre-clubs';
        const filenameWithExt = parts[parts.length - 1];
        // Asumiendo que la imagen_club contiene el public_id completo (incluyendo la extensión) al final
        const publicIdWithoutExt = filenameWithExt.split('.')[0];
        const publicId = `${folder}/${publicIdWithoutExt}`;

        const result = await cloudinary.uploader.destroy(publicId);

        if (result.result === 'not found') {
            console.warn(`ADVERTENCIA: Imagen no encontrada en Cloudinary: ${publicId}`);
        } else {
            console.log(`Imagen ${publicId} eliminada de Cloudinary (Fallback).`);
        }
    } catch (e) {
        console.warn("ADVERTENCIA: Falló la eliminación de la imagen en Cloudinary (en deleteFromCloudinary):", e.message);
    }
}


const parseForm = (req) => {
    return new Promise((resolve, reject) => {
        const form = formidable({
            multiples: false,
            keepExtensions: true,
            maxFileSize: 5 * 1024 * 1024, // 5MB 
        });

        form.parse(req, async (err, fields, files) => {

            let imagenFilePathTemp = null;

            // Buscar por los nombres comunes que vienen del cliente
            if (files.imagen && files.imagen[0]) {
                imagenFilePathTemp = files.imagen[0].filepath;
            } else if (files.imagen_club_nueva && files.imagen_club_nueva[0]) {
                imagenFilePathTemp = files.imagen_club_nueva[0].filepath;
            } else if (files.imagen_club && files.imagen_club[0]) {
                imagenFilePathTemp = files.imagen_club[0].filepath;
            }

            if (err) {
                console.error("Error parsing form:", err);
                if (imagenFilePathTemp && fs.existsSync(imagenFilePathTemp)) {
                    try { await unlinkAsync(imagenFilePathTemp); } catch (e) { console.error("Error al limpiar temp file:", e); }
                }
                return reject(err);
            }

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

async function uploadToCloudinary(filePath) {
    if (!filePath) return null;

    try {
        const result = await cloudinary.uploader.upload(filePath, {
            folder: 'motor-libre-clubs', // Carpeta específica en tu Cloudinary
        });

        if (fs.existsSync(filePath)) {
            await unlinkAsync(filePath);
        }

        return result.secure_url;
    } catch (error) {
        if (fs.existsSync(filePath)) {
            await unlinkAsync(filePath);
        }
        console.error("Cloudinary Error Detallado:", error);
        throw new Error(`Cloudinary upload failed: ${error.message}`);
    }
}

const verifyToken = (req) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { authorized: false, message: 'Token no proporcionado.' };
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        // ⭐ Corregir la estructura de retorno para incluir 'id' y 'user'
        return { authorized: true, user: decoded, id: decoded.id };
    } catch (e) {
        return { authorized: false, message: 'Token inválido o expirado.' };
    }
};

const verifyAdmin = (req) => {
    const verification = verifyToken(req);
    if (!verification.authorized) {
        throw new Error(verification.message);
    }
    if (verification.user.role !== 'admin') {
        throw new Error('Acceso denegado: Se requiere rol de administrador.');
    }
    return verification.user;
};

const verifyClubOwnershipOrAdmin = async (req, clubId) => {
    const verification = verifyToken(req);

    if (!verification.authorized) {
        // 🛑 MENSAJE ESTANDARIZADO 401
        throw new Error('Necesitas iniciar sesión para acceder a esta página.');
    }

    const decodedUser = verification.user;

    // A. Permiso de Administrador
    if (decodedUser.role === 'admin') {
        return decodedUser;
    }

    // B. Permiso de Presidente
    if (!clubId) {
        throw new Error('ID de club requerido para la verificación de propiedad.');
    }

    // 1. Verificar si el usuario es presidente y el club_id coincide con el solicitado
    const clubIdNum = parseInt(clubId);

    const checkPresidente = await pool.query(
        'SELECT id_presidente FROM public.clubs WHERE id = $1',
        [clubIdNum]
    );

    if (checkPresidente.rows.length === 0) {
        // Club no encontrado o no activo
        throw new Error('Club no encontrado o no activo.');
    }

    const presidenteClubId = checkPresidente.rows[0].id_presidente;

    // El usuario logueado (decodedUser.id) debe ser el id_presidente del club
    if (presidenteClubId !== decodedUser.id) {
        // 🛑 MENSAJE ESTANDARIZADO 403
        throw new Error('Necesitas ser presidente de un club para acceder a esta página.');
    }

    return decodedUser;
};

async function statusChangeHandler(req, res) {
    const { method, query } = req;
    const { id } = query;

    try {
        verifyAdmin(req);

        if (!id) return res.status(400).json({ success: false, message: "ID del club es requerido." });

        if (method === 'PUT') {
            // El body es JSON simple, usamos getBody
            const body = await getBody(req);

            const { estado } = body;
            if (estado !== 'activo') return res.status(400).json({ success: false, message: "Estado de actualización no válido." });

            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                const pendingClubRes = await client.query(
                    // ⭐ MODIFICACIÓN GET: Añadir campo 'enfoque'
                    'SELECT nombre_evento, descripcion, imagen_club as imagen_url, id_presidente, ciudad, enfoque FROM public.clubs_pendientes WHERE id = $1 FOR UPDATE',
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

                let nombrePresidente;
                const presidenteNameRes = await client.query('SELECT name FROM public."users" WHERE id = $1', [club.id_presidente]);
                nombrePresidente = presidenteNameRes.rows[0]?.name || 'Usuario desconocido';

                // Usamos la URL de la imagen que ya está guardada en clubs_pendientes
                // ⭐ MODIFICACIÓN INSERT: Añadir campo 'enfoque'
                const insertRes = await client.query(
                    'INSERT INTO public.clubs (nombre_evento, descripcion, imagen_club, fecha_creacion, id_presidente, nombre_presidente, estado, ciudad, enfoque) VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8) RETURNING id',
                    [club.nombre_evento, club.descripcion, club.imagen_url, club.id_presidente, nombrePresidente, 'activo', club.ciudad, club.enfoque]
                );
                const newClubId = insertRes.rows[0].id;

                // 🚨 IMPORTANTE: CORRECCIÓN EN statusChangeHandler 
                // Al aprobar un club pendiente, el usuario debe cambiar a rol 'presidente' y establecerse is_presidente = TRUE.
                // Asumo que un club pendiente siempre lo solicita un 'user' regular.
                await client.query(
                    'UPDATE public."users" SET role = $1, club_id = $2, is_presidente = TRUE WHERE id = $3',
                    ['presidente', newClubId, club.id_presidente]
                );

                await client.query('DELETE FROM public.clubs_pendientes WHERE id = $1', [id]);

                await client.query('COMMIT');
                return res.status(200).json({ success: true, message: "Club aprobado y activado correctamente." });

            } catch (error) {
                await client.query('ROLLBACK');
                // Si el error es una duplicidad de clave o algo grave, loguear y lanzar
                throw error;
            } finally {
                client.release();
            }

        } else if (method === 'DELETE') {
            const clubRes = await pool.query('SELECT imagen_club FROM public.clubs_pendientes WHERE id = $1', [id]);

            const result = await pool.query('DELETE FROM public.clubs_pendientes WHERE id = $1 RETURNING id', [id]);

            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, message: "Solicitud de club pendiente no encontrada para rechazar." });
            }

            // Eliminar imagen de Cloudinary si existe
            if (clubRes.rows.length > 0 && clubRes.rows[0].imagen_club) {
                await deleteFromCloudary(clubRes.rows[0].imagen_club);
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

async function clubsHandler(req, res) {
    const { method, query } = req;

    // 🛑 CORRECCIÓN CLAVE 1: Permite leer 'id' (de URL) o 'clubId' (del cliente JS) 🛑
    const id = query.id || query.clubId;
    const estado = query.estado;
    // ----------------------------------------------------

    let isAdmin = false;
    let userId = null;

    let authVerification = verifyToken(req);

    if (authVerification.authorized) {
        userId = authVerification.user.id;
        isAdmin = authVerification.user.role === 'admin';
    }


    try {
        if (method === "GET") {

            // --- Lógica GET para obtener miembros ---
            if (id && query.includeMembers === 'true') {
                const clubIdNum = parseInt(id);
                if (isNaN(clubIdNum)) {
                    return res.status(400).json({ success: false, message: "ID del club debe ser un número válido." });
                }

                // 1. Obtener datos del club
                let clubQueryText = `
                    SELECT 
                        id, nombre_evento as name, descripcion, imagen_club as imagen_url, 
                        fecha_creacion, estado, id_presidente as president_id, 
                        nombre_presidente as president_name, ciudad, enfoque
                    FROM public.clubs 
                    WHERE id = $1 AND estado = 'activo'
                `;
                const clubResult = await pool.query(clubQueryText, [clubIdNum]);

                if (clubResult.rows.length === 0) {
                    return res.status(404).json({ success: false, message: "Club no encontrado." });
                }
                const club = clubResult.rows[0];

                // 2. Obtener la lista de miembros
                // 🛑 CORRECCIÓN: Se debe seleccionar 'is_presidente' y ordenar por ella.
                const membersQueryText = `
                    SELECT 
                        id as user_id, name as username, email, club_id, is_presidente 
                    FROM public."users" 
                    WHERE club_id = $1
                    ORDER BY is_presidente DESC, name ASC 
                `; // ✅ CORRECCIÓN FINAL: Incluye 'is_presidente' en SELECT y en ORDER BY para poner al presidente primero.
                const membersResult = await pool.query(membersQueryText, [clubIdNum]);

                // Se añade una propiedad 'is_president' a cada miembro en el JS si es necesario, 
                // pero por ahora el cliente puede determinarlo comparando user_id con club.president_id

                return res.status(200).json({ success: true, club: club, members: membersResult.rows });
            }
            // --- Fin Lógica GET para obtener miembros ---

            if (estado === 'pendiente') {
                try {
                    verifyAdmin(req);
                } catch (error) {
                    return res.status(401).json({ success: false, message: "Acceso denegado a solicitudes pendientes. Se requiere rol de administrador." });
                }
                isAdmin = true;
            }

            if (id) {
                const clubIdNum = parseInt(id);
                if (isNaN(clubIdNum)) {
                    return res.status(400).json({ success: false, message: "ID del club debe ser un número válido." });
                }

                // 🛑 MODIFICACIÓN CRÍTICA: Bloquear acceso a los datos del club si no es Admin o Presidente 🛑
                try {
                    // Si se pide un club por ID, se asume que es para edición, por lo que se requiere autorización.
                    await verifyClubOwnershipOrAdmin(req, id);
                } catch (error) {
                    // Si falla la verificación (no logueado, token inválido o no es presidente/admin),
                    // se lanza el error para que el catch final devuelva el 401/403.
                    throw error;
                }
                // 🛑 FIN MODIFICACIÓN CRÍTICA 🛑

                // ⭐ MODIFICACIÓN GET: Añadir 'enfoque' a la consulta de clubs
                let queryText = `
                    SELECT 
                        id, nombre_evento, descripcion, imagen_club as imagen_url, fecha_creacion, 
                        estado, id_presidente, nombre_presidente, ciudad, enfoque, 
                        0 as miembros 
                    FROM public.clubs 
                    WHERE id = $1 AND estado = 'activo'
                `;
                const result = await pool.query(queryText, [clubIdNum]);

                if (result.rows.length === 0 && isAdmin) {
                    // ⭐ MODIFICACIÓN GET: Añadir 'enfoque' a la consulta de clubs_pendientes
                    const pendingRes = await pool.query(
                        `SELECT 
                            p.id, p.nombre_evento, p.descripcion, p.imagen_club as imagen_url, 
                            p.fecha_solicitud as fecha_creacion, p.ciudad, p.enfoque,
                            p.id_presidente, 
                            u.name as nombre_presidente, 
                            'pendiente' as estado 
                        FROM public.clubs_pendientes p
                        JOIN public."users" u ON p.id_presidente = u.id 
                        WHERE p.id = $1`,
                        [clubIdNum]
                    );
                    if (pendingRes.rows.length > 0) {
                        return res.status(200).json({ success: true, club: pendingRes.rows[0], pending_club: pendingRes.rows[0] });
                    }
                }

                if (result.rows.length === 0) {
                    return res.status(404).json({ success: false, message: "Club no encontrado." });
                }
                return res.status(200).json({ success: true, club: result.rows[0] });

            }

            else if (estado) {
                if (estado === 'activo') {
                    // ⭐ MODIFICACIÓN GET: Añadir 'enfoque'
                    const result = await pool.query(`
                        SELECT 
                            id, nombre_evento, descripcion, imagen_club as imagen_url, fecha_creacion, 
                            estado, id_presidente, nombre_presidente, ciudad, enfoque,
                            0 as miembros 
                        FROM public.clubs WHERE estado = $1 ORDER BY fecha_creacion DESC
                    `, ['activo']);
                    return res.status(200).json({ success: true, clubs: result.rows });
                } else if (estado === 'pendiente' && isAdmin) {
                    // ⭐ MODIFICACIÓN GET: Añadir 'enfoque'
                    const queryText = `
                        SELECT 
                            p.id, 
                            p.nombre_evento, 
                            p.descripcion, 
                            p.imagen_club as imagen_url, 
                            p.fecha_solicitud as fecha_creacion, 
                            p.ciudad,
                            p.enfoque,
                            'pendiente' as estado,
                            p.id_presidente,
                            u.name as nombre_presidente 
                        FROM public.clubs_pendientes p
                        JOIN public."users" u ON p.id_presidente = u.id 
                        ORDER BY p.fecha_solicitud DESC
                    `;
                    const result = await pool.query(queryText);
                    return res.status(200).json({ success: true, pending_clubs: result.rows });
                }

                return res.status(400).json({ success: false, message: "Estado no válido o permiso denegado." });
            }

            // ⭐ MODIFICACIÓN GET: Añadir 'enfoque'
            const defaultResult = await pool.query(`
                SELECT 
                    id, nombre_evento, descripcion, imagen_club as imagen_url, fecha_creacion, 
                    estado, id_presidente, nombre_presidente, ciudad, enfoque,
                    0 as miembros 
                FROM public.clubs WHERE estado = 'activo' ORDER BY fecha_creacion DESC
            `);
            return res.status(200).json({ success: true, clubs: defaultResult.rows });
        }

        if (method === "POST") {

            // 🛑 FIX CLAVE: Manejar JOIN (y antes LEAVE) antes de intentar parsear el formulario
            if (query.action === 'join' || query.action === 'leave') {
                const verification = verifyToken(req);
                if (!verification.authorized) {
                    return res.status(401).json({ success: false, message: verification.message });
                }
                const requestingUserId = verification.user.id;

                // Usamos getBody para leer el JSON simple
                const body = await getBody(req);
                const { club_id } = body || {};

                if (!club_id) return res.status(400).json({ success: false, message: "ID del club es requerido para la acción." });

                const client = await pool.connect();
                try {
                    await client.query('BEGIN');

                    if (query.action === 'join') {
                        // 1. Verificar si ya es presidente o miembro de otro club
                        // CONSULTA: Se obtienen club_id e is_presidente
                        const userRes = await client.query('SELECT club_id, is_presidente FROM public."users" WHERE id = $1 FOR UPDATE', [requestingUserId]);

                        if (userRes.rows.length === 0) {
                            await client.query('ROLLBACK');
                            return res.status(404).json({ success: false, message: "Usuario no encontrado." });
                        }

                        // ✅ CORRECCIÓN: Desestructuramos club_id e is_presidente
                        const { club_id: currentClubId, is_presidente } = userRes.rows[0];

                        if (currentClubId !== null) {
                            await client.query('ROLLBACK');
                            // ✅ LÓGICA AGREGADA: Si es presidente, rechazar con mensaje específico
                            if (is_presidente) {
                                return res.status(403).json({ success: false, message: "Como presidente, no puedes unirte a otro club. Debes disolver o transferir tu club actual primero." });
                            }
                            // Lógica para miembros regulares de otro club
                            return res.status(400).json({ success: false, message: "Ya eres miembro de un club. Primero debes abandonarlo." });
                        }

                        // 2. Unir al usuario al club (Actualizar tabla users)
                        await client.query('UPDATE public."users" SET club_id = $1 WHERE id = $2', [club_id, requestingUserId]);

                        // --- SINCRONIZACIÓN DE TOKEN (JOIN) ---
                        // 3. Obtener los datos del usuario actualizados (con el nuevo club_id)
                        const updatedUserRes = await client.query(
                            'SELECT id, name, email, role, club_id, is_presidente FROM public."users" WHERE id = $1',
                            [requestingUserId]
                        );
                        const updatedUser = updatedUserRes.rows[0];

                        // 4. Generar un nuevo token con los datos frescos
                        const newToken = jwt.sign(updatedUser, JWT_SECRET, { expiresIn: '1d' });
                        // --- FIN SINCRONIZACIÓN DE TOKEN ---

                        await client.query('COMMIT');
                        return res.status(200).json({
                            success: true,
                            message: "Te has unido al club.",
                            token: newToken // <-- Devolver el nuevo token
                        });

                    }
                    /* // Se remueve la lógica LEAVE de POST para usarla en PUT (más limpio)
                    else if (query.action === 'leave') {
                        // ...
                    } 
                    */

                    // Si la acción existe pero no fue 'join' ni 'leave' (e.g. action=unknown)
                    return res.status(400).json({ success: false, message: "Acción POST no válida." });

                } catch (error) {
                    await client.query('ROLLBACK');
                    console.error("Error en join club:", error);
                    return res.status(500).json({ success: false, message: "Error interno al procesar la solicitud de club." });
                } finally {
                    client.release();
                }
            }
            // 🛑 FIN BLOQUE JOIN

            // --- Lógica de Creación de Club (Existente) ---
            let imagenFilePathTemp = null;
            let imagen_club_url = null;
            let isCloudinaryUploadSuccess = false;

            try {
                const { fields, files, imagenFilePathTemp: tempPath } = await parseForm(req);
                imagenFilePathTemp = tempPath;

                // ⭐ MODIFICACIÓN POST: Obtener 'enfoque' de los campos
                const { nombre_evento, descripcion, ciudad, enfoque } = fields;

                if (!nombre_evento || !descripcion || !ciudad || !enfoque) {
                    return res.status(400).json({ success: false, message: "Faltan campos obligatorios: nombre_evento, descripcion, ciudad o enfoque." });
                }

                if (!authVerification.authorized || !userId) {
                    return res.status(401).json({ success: false, message: "Debe iniciar sesión para crear o solicitar un club." });
                }

                if (imagenFilePathTemp) {
                    imagen_club_url = await uploadToCloudinary(imagenFilePathTemp);
                    isCloudinaryUploadSuccess = true;
                }

                let tabla;
                let clubEstado;
                let idPresidente = userId;
                let insertColumns;
                let insertValues;
                let params;

                if (isAdmin) {
                    // --- MODIFICACIÓN CLAVE: ADMINISTRADOR USA TRANSACCIÓN ---
                    const client = await pool.connect();
                    try {
                        await client.query('BEGIN');

                        tabla = 'clubs';
                        clubEstado = 'activo';

                        // ⭐ MODIFICACIÓN INSERT: Añadir 'enfoque'
                        insertColumns = `nombre_evento, descripcion, imagen_club, fecha_creacion, id_presidente, nombre_presidente, estado, ciudad, enfoque`;

                        let nombrePresidente;
                        const presidenteNameRes = await client.query('SELECT name FROM public."users" WHERE id = $1', [idPresidente]);
                        nombrePresidente = presidenteNameRes.rows[0]?.name || 'Admin';

                        params = [
                            nombre_evento,
                            descripcion,
                            imagen_club_url,
                            idPresidente,
                            nombrePresidente,
                            clubEstado,
                            ciudad,
                            enfoque // Enfoque ($8)
                        ];

                        const insertQuery = `
                            INSERT INTO public."${tabla}" (${insertColumns}) 
                            VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8) 
                            RETURNING id, nombre_evento, imagen_club
                        `;
                        const result = await client.query(insertQuery, params);
                        const newClubId = result.rows[0].id;

                        // Asignar club_id y rol 'presidente' al usuario
                        await client.query(
                            'UPDATE public."users" SET club_id = $1, is_presidente = TRUE WHERE id = $2',
                            [newClubId, idPresidente]
                        );

                        await client.query('COMMIT');

                        return res.status(201).json({ success: true, message: "Club creado y activado (por admin).", club: result.rows[0] });
                    } catch (error) {
                        await client.query('ROLLBACK');
                        throw error; // Lanzar para que el catch externo maneje la limpieza de Cloudinary si aplica
                    } finally {
                        client.release();
                    }
                    // --- FIN MODIFICACIÓN CLAVE ---
                } else {
                    // Lógica para usuario normal (Solicitud Pendiente) - Sin transacción (solo una inserción)
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
                    idPresidente = userId;

                    // ⭐ MODIFICACIÓN INSERT: Añadir 'enfoque'
                    insertColumns = `nombre_evento, descripcion, imagen_club, fecha_solicitud, id_presidente, ciudad, enfoque`;
                    insertValues = `($1, $2, $3, NOW(), $4, $5, $6)`;

                    params = [
                        nombre_evento,
                        descripcion,
                        imagen_club_url,
                        idPresidente, // id_presidente es $4
                        ciudad, // Ciudad ($5)
                        enfoque // Enfoque ($6)
                    ];

                    const insertQuery = `
                        INSERT INTO public."${tabla}" (${insertColumns}) 
                        VALUES ${insertValues} 
                        RETURNING id, nombre_evento
                    `;
                    const result = await pool.query(insertQuery, params);

                    return res.status(201).json({ success: true, message: "Solicitud de club enviada y pendiente de aprobación.", pending_club: result.rows[0] });
                }
            } catch (uploadError) {
                // Limpiar Cloudinary si la subida fue exitosa pero la inserción falló
                if (isCloudinaryUploadSuccess && imagen_club_url) {
                    await deleteFromCloudary(imagen_club_url);
                }
                console.error("Error durante la creación (POST):", uploadError.message);

                if (uploadError.message.includes('Cloudinary upload failed')) {
                    return res.status(500).json({ success: false, message: "Error al subir la imagen. Verifica las credenciales de Cloudinary." });
                }
                if (uploadError.message.includes('maxFileSize')) {
                    return res.status(400).json({ success: false, message: "El archivo de imagen es demasiado grande. El límite es de 5MB." });
                }
                // Manejo de errores de campos obligatorios, etc.
                if (uploadError.message.includes('nombre_evento') || uploadError.message.includes('descripcion') || uploadError.message.includes('ciudad') || uploadError.message.includes('enfoque')) {
                    return res.status(400).json({ success: false, message: uploadError.message });
                }
                return res.status(500).json({ success: false, message: "Error interno en la creación del club." });
            }
        }

        if (method === "PUT") {

            // --- INICIO: Lógica para Salir del Club (Action: leave) ---
            const body = await getBody(req);
            if (body && body.action === 'leave') {
                const verification = verifyToken(req);
                if (!verification.authorized) {
                    return res.status(401).json({ success: false, message: verification.message });
                }
                const requestingUserId = verification.user.id;

                let client;
                try {
                    client = await pool.connect();
                    await client.query('BEGIN');

                    // 1. Verificar el club actual del usuario y si es presidente
                    const userRes = await client.query('SELECT club_id, is_presidente, role FROM public."users" WHERE id = $1 FOR UPDATE', [requestingUserId]);

                    if (userRes.rows.length === 0) {
                        await client.query('ROLLBACK');
                        return res.status(404).json({ success: false, message: "Usuario no encontrado." });
                    }

                    const { club_id: currentClubId, is_presidente, role } = userRes.rows[0];

                    if (!currentClubId) {
                        await client.query('ROLLBACK');
                        return res.status(400).json({ success: false, message: "Actualmente no eres miembro de ningún club para poder salir." });
                    }

                    if (is_presidente || role === 'presidente') {
                        await client.query('ROLLBACK');
                        return res.status(403).json({ success: false, message: "El presidente debe eliminar o transferir el club, no puede usar 'salir'." });
                    }

                    // 2. Abandonar el club (Actualizar tabla users)
                    await client.query('UPDATE public."users" SET club_id = NULL WHERE id = $1', [requestingUserId]);

                    // --- SINCRONIZACIÓN DE TOKEN (LEAVE) ---
                    // 3. Obtener los datos del usuario actualizados (club_id = NULL)
                    const updatedUserRes = await client.query(
                        'SELECT id, name, email, role, club_id, is_presidente FROM public."users" WHERE id = $1',
                        [requestingUserId]
                    );
                    const updatedUser = updatedUserRes.rows[0];

                    // 4. Generar un nuevo token con los datos frescos
                    const newToken = jwt.sign(updatedUser, JWT_SECRET, { expiresIn: '1d' });
                    // --- FIN SINCRONIZACIÓN DE TOKEN ---

                    await client.query('COMMIT');
                    return res.status(200).json({
                        success: true,
                        message: "Has abandonado el club.",
                        token: newToken
                    });

                } catch (error) {
                    await client.query('ROLLBACK');
                    console.error("Error al salir del club (PUT action=leave):", error);
                    // Si el error es el mensaje del presidente, lo devolvemos
                    if (error.message.includes('presidente debe eliminar')) {
                        return res.status(403).json({ success: false, message: error.message });
                    }
                    return res.status(500).json({ success: false, message: "Error interno al procesar la salida del club." });
                } finally {
                    if (client) client.release();
                }
            }
            // --- FIN: Lógica para Salir del Club (Action: leave) ---

            // --- Lógica para Actualizar Club por Formulario (Requiere ID) ---
            const { id } = query;
            if (!id) return res.status(400).json({ success: false, message: "ID del club es requerido para actualizar." });

            let imagenFilePathTemp = null;
            let imagen_club_url = null;
            let old_imagen_club_url = null;
            let isCloudinaryUploadSuccess = false;

            try {
                const { fields, files, imagenFilePathTemp: tempPath } = await parseForm(req);
                imagenFilePathTemp = tempPath;

                // ⭐ MODIFICACIÓN PUT: Obtener 'enfoque' de los campos
                const { nombre_evento, descripcion, ciudad: newCiudad, enfoque: newEnfoque, // Nuevo campo
                    estado: newEstado, id_presidente: newIdPresidente } = fields;

                // Solo Admin o Presidente pueden editar
                const authorizedUser = await verifyClubOwnershipOrAdmin(req, id);
                const isOnlyPresident = authorizedUser.role !== 'admin';


                // 1. Subir nueva imagen si existe
                if (imagenFilePathTemp) {
                    imagen_club_url = await uploadToCloudinary(imagenFilePathTemp);
                    isCloudinaryUploadSuccess = true;
                }

                // Obtener la URL de la imagen actual del club antes de la actualización
                const clubCheckRes = await pool.query('SELECT imagen_club FROM public.clubs WHERE id = $1', [id]);
                if (clubCheckRes.rows.length > 0) {
                    old_imagen_club_url = clubCheckRes.rows[0].imagen_club;
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
                if (imagen_club_url) { // Solo si se subió una nueva
                    updates.push(`imagen_club = $${paramIndex++}`);
                    values.push(imagen_club_url);
                }
                if (newCiudad) {
                    updates.push(`ciudad = $${paramIndex++}`);
                    values.push(newCiudad);
                }
                // ⭐ MODIFICACIÓN PUT: Añadir enfoque
                if (newEnfoque) {
                    updates.push(`enfoque = $${paramIndex++}`);
                    values.push(newEnfoque);
                }

                // Si se intenta cambiar el estado o presidente, solo el admin puede hacerlo
                if (!isOnlyPresident) {
                    if (newEstado) {
                        updates.push(`estado = $${paramIndex++}`);
                        values.push(newEstado);
                    }
                    if (newIdPresidente) {
                        // Lógica de transferencia de presidencia (más compleja, asumiendo que solo el admin lo hace simple)
                        updates.push(`id_presidente = $${paramIndex++}`);
                        values.push(newIdPresidente);
                    }
                }

                if (updates.length === 0) {
                    return res.status(400).json({ success: false, message: "No se proporcionaron campos para actualizar." });
                }

                values.push(id); // ID siempre es el último parámetro

                const updateQuery = `
                    UPDATE public.clubs 
                    SET ${updates.join(', ')} 
                    WHERE id = $${paramIndex} 
                    RETURNING id, nombre_evento, imagen_club, fecha_creacion, estado, nombre_presidente
                `;

                const result = await pool.query(updateQuery, values);

                if (result.rows.length === 0) {
                    // Limpiar Cloudinary si falló la actualización pero se subió la imagen
                    if (isCloudinaryUploadSuccess && imagen_club_url) {
                        await deleteFromCloudary(imagen_club_url);
                    }
                    return res.status(404).json({ success: false, message: "Club no encontrado para actualizar." });
                }

                // Si se subió una nueva imagen,
                // eliminamos la imagen antigua de Cloudinary.
                if (imagen_club_url && old_imagen_club_url) {
                    await deleteFromCloudary(old_imagen_club_url);
                }

                return res.status(200).json({ success: true, message: "Club actualizado.", club: result.rows[0] });

            } catch (uploadError) {
                // Limpiar Cloudinary si falló algo después de la subida
                if (isCloudinaryUploadSuccess && imagen_club_url) {
                    await deleteFromCloudary(imagen_club_url);
                }
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

                // Captura de errores de autorización/propiedad
                if (uploadError.message.includes('Acceso denegado') || uploadError.message.includes('Token') || uploadError.message.includes('Debe iniciar sesión') || uploadError.message.includes('presidente de un club')) {
                    // Usa el catch principal para manejar los errores de auth/permisos con los códigos correctos
                    throw uploadError;
                }

                return res.status(500).json({ success: false, message: "Error interno en la actualización del club." });
            }
        }

        // --- LÓGICA DE ELIMINACIÓN DE CLUB ACTIVO (CORREGIDA) ---
        if (method === "DELETE") {
            const clubId = parseInt(id);
            if (!clubId || isNaN(clubId)) {
                return res.status(400).json({ success: false, message: "ID del club es requerido para eliminar." });
            }

            // Verificar si es administrador O el presidente del club
            try {
                // CORRECCIÓN CLAVE: Usamos la función que permite eliminar al Admin O al Presidente del club
                await verifyClubOwnershipOrAdmin(req, clubId);
            } catch (error) {
                // Si la verificación falla (no es admin ni presidente), lanzamos el error
                // para que el catch general lo maneje y devuelva el 401 o 403 con el mensaje específico.
                throw error;
            }

            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                // 1. Obtener datos del club (imagen y presidente) antes de eliminar
                const clubInfoRes = await client.query(
                    'SELECT imagen_club, id_presidente FROM public.clubs WHERE id = $1 FOR UPDATE',
                    [clubId]
                );

                if (clubInfoRes.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(404).json({ success: false, message: "Club no encontrado para eliminar." });
                }

                const { imagen_club, id_presidente } = clubInfoRes.rows[0];

                // 2. Desvincular a todos los miembros (incluyendo al presidente)
                // Se actualizan: club_id = NULL, role = 'user', is_presidente = FALSE.
                await client.query(
                    `UPDATE public."users" 
                    SET club_id = NULL, role = 'user', is_presidente = FALSE 
                    WHERE club_id = $1`,
                    [clubId]
                );

                // 3. Eliminar el club de la tabla 'clubs'
                const deleteClubRes = await client.query(
                    'DELETE FROM public.clubs WHERE id = $1 RETURNING id',
                    [clubId]
                );

                if (deleteClubRes.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(404).json({ success: false, message: "Club no encontrado para eliminar (fallo de concurrencia)." });
                }

                // 4. Eliminar imagen de Cloudinary
                if (imagen_club) {
                    await deleteFromCloudary(imagen_club);
                }

                await client.query('COMMIT');
                return res.status(200).json({ success: true, message: "Club y miembros desvinculados correctamente." });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error("Error en DELETE de club activo:", error);
                // Re-lanza el error para que el catch externo lo maneje
                throw error;
            } finally {
                client.release();
            }
        }
        // --- FIN LÓGICA DE ELIMINACIÓN DE CLUB ACTIVO ---

        return res.status(405).json({ success: false, message: "Método no permitido." });

    } catch (error) {
        console.error("Error en clubsHandler:", error);

        // 🛑 LÓGICA DE CAPTURA DE ERRORES MEJORADA (401 vs 403) 🛑
        const isLoginRequired = error.message.includes('Necesitas iniciar sesión');
        const isPresidentRequired = error.message.includes('Necesitas ser presidente');
        const isTokenInvalid = error.message.includes('Token');

        if (isLoginRequired || isTokenInvalid) {
            // Caso 1: No logueado o token inválido -> 401
            return res.status(401).json({ success: false, message: error.message });
        }

        if (isPresidentRequired) {
            // Caso 2: Logueado pero sin permisos de presidente -> 403
            return res.status(403).json({ success: false, message: error.message });
        }

        if (error.message.includes('Club no encontrado')) {
            return res.status(404).json({ success: false, message: error.message });
        }

        if (error.code === '42P01') {
            return res.status(500).json({ success: false, message: "Error: La tabla de base de datos no fue encontrada." });
        }
        if (error.code && error.code.startsWith('23')) {
            return res.status(500).json({ success: false, message: `Error de DB: Falla de integridad de datos. (${error.code})` });
        }

        if (error.message.includes('Cloudinary')) {
            return res.status(500).json({ success: false, message: "Error en Cloudinary. Revise los logs del servidor para detalles." });
        }


        return res.status(500).json({ success: false, message: "Error interno del servidor. Consulte la consola para más detalles." });
    }
}

export default async function clubsCombinedHandler(req, res) {
    const { query } = req;

    // Si la query incluye 'status=change', se usa el handler específico de aprobación/rechazo
    if (query.status === 'change') {
        return statusChangeHandler(req, res);
    }

    // Si no, se usa el handler principal para CRUD y Join/Leave
    return clubsHandler(req, res);
}