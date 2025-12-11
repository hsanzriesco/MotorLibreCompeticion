// clubs.js - VERSIÓN CON LIMPIEZA PROFUNDA (SOLUCIÓN ERROR 500)
import { Pool } from "pg";
import formidable from "formidable";
import fs from "fs";
import jwt from "jsonwebtoken";
import { v2 as cloudinary } from 'cloudinary';
import { promisify } from 'util';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_no_usar_en_produccion';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const unlinkAsync = promisify(fs.unlink);

export const config = {
    api: {
        bodyParser: false,
        externalResolver: true,
    },
};

const getBody = async (req) => {
    try {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const buffer = Buffer.concat(chunks);
        if (buffer.length === 0) return null;
        return JSON.parse(buffer.toString('utf8'));
    } catch (e) {
        console.warn("ADVERTENCIA: Falló el parseo del cuerpo JSON:", e.message);
        return null;
    }
};

async function deleteFromCloudary(imageUrl) {
    if (!imageUrl) return;
    try {
        const parts = imageUrl.split('/');
        const folder = 'motor-libre-clubs';
        const filenameWithExt = parts[parts.length - 1];
        const publicIdWithoutExt = filenameWithExt.split('.')[0];
        const publicId = `${folder}/${publicIdWithoutExt}`;

        await cloudinary.uploader.destroy(publicId);
    } catch (e) {
        console.warn("ADVERTENCIA: Falló la eliminación de la imagen en Cloudinary:", e.message);
    }
}

const parseForm = (req) => {
    return new Promise((resolve, reject) => {
        const form = formidable({
            multiples: false,
            keepExtensions: true,
            maxFileSize: 5 * 1024 * 1024,
        });

        form.parse(req, async (err, fields, files) => {
            let imagenFilePathTemp = null;
            if (files.imagen && files.imagen[0]) {
                imagenFilePathTemp = files.imagen[0].filepath;
            } else if (files.imagen_club_nueva && files.imagen_club_nueva[0]) {
                imagenFilePathTemp = files.imagen_club_nueva[0].filepath;
            } else if (files.imagen_club && files.imagen_club[0]) {
                imagenFilePathTemp = files.imagen_club[0].filepath;
            }

            if (err) {
                if (imagenFilePathTemp && fs.existsSync(imagenFilePathTemp)) {
                    try { await unlinkAsync(imagenFilePathTemp); } catch (e) { }
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
            folder: 'motor-libre-clubs',
        });
        if (fs.existsSync(filePath)) await unlinkAsync(filePath);
        return result.secure_url;
    } catch (error) {
        if (fs.existsSync(filePath)) await unlinkAsync(filePath);
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
        return { authorized: true, user: decoded, id: decoded.id };
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

const verifyClubOwnershipOrAdmin = async (req, clubId) => {
    const verification = verifyToken(req);
    if (!verification.authorized) throw new Error(verification.message || 'Debe iniciar sesión para realizar esta acción.');
    const decodedUser = verification.user;
    if (decodedUser.role === 'admin') return decodedUser;
    if (!clubId) throw new Error('ID de club requerido para la verificación de propiedad.');

    const clubIdNum = parseInt(clubId);
    const checkPresidente = await pool.query('SELECT id_presidente FROM public.clubs WHERE id = $1', [clubIdNum]);

    if (checkPresidente.rows.length === 0) throw new Error('Club no encontrado o no activo.');
    const presidenteClubId = checkPresidente.rows[0].id_presidente;
    if (presidenteClubId !== decodedUser.id) throw new Error('Acceso denegado: Solo el administrador o el presidente de este club pueden editarlo.');
    return decodedUser;
};

async function statusChangeHandler(req, res) {
    const { method, query } = req;
    const { id } = query;

    try {
        verifyAdmin(req);
        if (!id) return res.status(400).json({ success: false, message: "ID del club es requerido." });

        if (method === 'PUT') {
            const body = await getBody(req);
            const { estado } = body || {};
            if (estado !== 'activo') return res.status(400).json({ success: false, message: "Estado de actualización no válido." });

            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                const pendingClubRes = await client.query(
                    'SELECT nombre_evento, descripcion, imagen_club as imagen_url, id_presidente, ciudad, enfoque FROM public.clubs_pendientes WHERE id = $1 FOR UPDATE',
                    [id]
                );

                if (pendingClubRes.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(404).json({ success: false, message: "Solicitud de club pendiente no encontrada." });
                }

                const club = pendingClubRes.rows[0];
                let nombrePresidente;
                const presidenteNameRes = await client.query('SELECT name FROM public."users" WHERE id = $1', [club.id_presidente]);
                nombrePresidente = presidenteNameRes.rows[0]?.name || 'Usuario desconocido';

                const insertRes = await client.query(
                    'INSERT INTO public.clubs (nombre_evento, descripcion, imagen_club, fecha_creacion, id_presidente, nombre_presidente, estado, ciudad, enfoque) VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8) RETURNING id',
                    [club.nombre_evento, club.descripcion, club.imagen_url, club.id_presidente, nombrePresidente, 'activo', club.ciudad, club.enfoque]
                );
                const newClubId = insertRes.rows[0].id;

                await client.query(
                    'UPDATE public."users" SET role = $1, club_id = $2, is_presidente = TRUE WHERE id = $3',
                    ['presidente', newClubId, club.id_presidente]
                );
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
            const clubRes = await pool.query('SELECT imagen_club FROM public.clubs_pendientes WHERE id = $1', [id]);
            const result = await pool.query('DELETE FROM public.clubs_pendientes WHERE id = $1 RETURNING id', [id]);

            if (result.rows.length === 0) return res.status(404).json({ success: false, message: "Solicitud no encontrada." });
            if (clubRes.rows.length > 0 && clubRes.rows[0].imagen_club) await deleteFromCloudary(clubRes.rows[0].imagen_club);
            return res.status(200).json({ success: true, message: "Solicitud de club rechazada y eliminada." });
        }
        return res.status(405).json({ success: false, message: "Método no permitido." });

    } catch (error) {
        return res.status(500).json({ success: false, message: "Error interno en cambio de estado." });
    }
}

async function clubsHandler(req, res) {
    const { method, query } = req;
    let { estado, clubId: queryClubId, id: queryId } = query;
    let id = queryId || queryClubId;

    if (!id && req.url) {
        const parts = req.url.split('?')[0].split('/');
        const possibleId = parts[parts.length - 1];
        if (possibleId && !isNaN(parseInt(possibleId)) && possibleId !== 'clubs') id = possibleId;
    }

    let isAdmin = false;
    let userId = null;
    let authVerification = verifyToken(req);

    if (authVerification.authorized) {
        userId = authVerification.user.id;
        isAdmin = authVerification.user.role === 'admin';
    }

    try {
        if (method === "GET") {
            if (id && query.includeMembers === 'true') {
                const clubIdNum = parseInt(id);
                if (!authVerification.authorized) return res.status(401).json({ success: false, message: "Debe iniciar sesión." });
                const clubResult = await pool.query(`SELECT id, nombre_evento as name, descripcion, imagen_club as imagen_url, fecha_creacion, estado, id_presidente as president_id, nombre_presidente as president_name, ciudad, enfoque FROM public.clubs WHERE id = $1 AND estado = 'activo'`, [clubIdNum]);
                if (clubResult.rows.length === 0) return res.status(404).json({ success: false, message: "Club no encontrado." });
                const membersResult = await pool.query(`SELECT id as user_id, name as username, email, club_id FROM public."users" WHERE club_id = $1 ORDER BY name ASC`, [clubIdNum]);
                return res.status(200).json({ success: true, club: clubResult.rows[0], members: membersResult.rows });
            }

            if (estado === 'pendiente') {
                try { verifyAdmin(req); isAdmin = true; } catch (e) { return res.status(401).json({ success: false, message: "Acceso denegado." }); }
            }

            if (id) {
                const clubIdNum = parseInt(id);
                let queryText = `SELECT id, nombre_evento, descripcion, imagen_club as imagen_url, fecha_creacion, estado, id_presidente, nombre_presidente, ciudad, enfoque, 0 as miembros FROM public.clubs WHERE id = $1 AND estado = 'activo'`;
                const result = await pool.query(queryText, [clubIdNum]);

                if (result.rows.length === 0 && isAdmin) {
                    const pendingRes = await pool.query(`SELECT p.id, p.nombre_evento, p.descripcion, p.imagen_club as imagen_url, p.fecha_solicitud as fecha_creacion, p.ciudad, p.enfoque, p.id_presidente, u.name as nombre_presidente, 'pendiente' as estado FROM public.clubs_pendientes p JOIN public."users" u ON p.id_presidente = u.id WHERE p.id = $1`, [clubIdNum]);
                    if (pendingRes.rows.length > 0) return res.status(200).json({ success: true, club: pendingRes.rows[0], pending_club: pendingRes.rows[0] });
                }
                if (result.rows.length === 0) return res.status(404).json({ success: false, message: "Club no encontrado." });
                return res.status(200).json({ success: true, club: result.rows[0] });

            } else if (estado) {
                if (estado === 'activo') {
                    const result = await pool.query(`SELECT id, nombre_evento, descripcion, imagen_club as imagen_url, fecha_creacion, estado, id_presidente, nombre_presidente, ciudad, enfoque, 0 as miembros FROM public.clubs WHERE estado = 'activo' ORDER BY fecha_creacion DESC`);
                    return res.status(200).json({ success: true, clubs: result.rows });
                } else if (estado === 'pendiente' && isAdmin) {
                    const result = await pool.query(`SELECT p.id, p.nombre_evento, p.descripcion, p.imagen_club as imagen_url, p.fecha_solicitud as fecha_creacion, p.ciudad, p.enfoque, 'pendiente' as estado, p.id_presidente, u.name as nombre_presidente FROM public.clubs_pendientes p JOIN public."users" u ON p.id_presidente = u.id ORDER BY p.fecha_solicitud DESC`);
                    return res.status(200).json({ success: true, pending_clubs: result.rows });
                }
                return res.status(400).json({ success: false, message: "Estado no válido." });
            }

            const defaultResult = await pool.query(`SELECT id, nombre_evento, descripcion, imagen_club as imagen_url, fecha_creacion, estado, id_presidente, nombre_presidente, ciudad, enfoque, 0 as miembros FROM public.clubs WHERE estado = 'activo' ORDER BY fecha_creacion DESC`);
            return res.status(200).json({ success: true, clubs: defaultResult.rows });
        }

        if (method === "POST") {
            if (query.action === 'join') {
                const verification = verifyToken(req);
                if (!verification.authorized) return res.status(401).json({ success: false, message: verification.message });
                const requestingUserId = verification.user.id;
                const body = await getBody(req);
                const { club_id } = body || {};
                if (!club_id) return res.status(400).json({ success: false, message: "ID del club requerido." });

                const client = await pool.connect();
                try {
                    await client.query('BEGIN');
                    const userRes = await client.query('SELECT club_id, is_presidente FROM public."users" WHERE id = $1 FOR UPDATE', [requestingUserId]);
                    if (userRes.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, message: "Usuario no encontrado." }); }
                    const { club_id: currentClubId, is_presidente } = userRes.rows[0];

                    if (currentClubId !== null) {
                        await client.query('ROLLBACK');
                        if (is_presidente) return res.status(403).json({ success: false, message: "Eres presidente, no puedes unirte a otro club." });
                        return res.status(400).json({ success: false, message: "Ya eres miembro de un club." });
                    }

                    await client.query('UPDATE public."users" SET club_id = $1 WHERE id = $2', [club_id, requestingUserId]);
                    const updatedUserRes = await pool.query('SELECT id, name, email, role, club_id, is_presidente FROM public."users" WHERE id = $1', [requestingUserId]);
                    const newToken = jwt.sign(updatedUserRes.rows[0], JWT_SECRET, { expiresIn: '1d' });
                    await client.query('COMMIT');
                    return res.status(200).json({ success: true, message: "Te has unido al club.", token: newToken });
                } catch (error) {
                    await client.query('ROLLBACK');
                    return res.status(500).json({ success: false, message: "Error interno." });
                } finally { client.release(); }
            }

            let imagenFilePathTemp = null;
            let imagen_club_url = null;
            let isCloudinaryUploadSuccess = false;

            try {
                const { fields, files, imagenFilePathTemp: tempPath } = await parseForm(req);
                imagenFilePathTemp = tempPath;
                const { nombre_club, nombre_evento, descripcion, ciudad, enfoque } = fields;
                const final_nombre_evento = nombre_club || nombre_evento;

                if (!final_nombre_evento || !descripcion || !ciudad || !enfoque) return res.status(400).json({ success: false, message: "Faltan campos obligatorios." });
                if (!authVerification.authorized || !userId) return res.status(401).json({ success: false, message: "Debe iniciar sesión." });

                if (imagenFilePathTemp) {
                    imagen_club_url = await uploadToCloudinary(imagenFilePathTemp);
                    isCloudinaryUploadSuccess = true;
                }

                if (isAdmin) {
                    const client = await pool.connect();
                    try {
                        await client.query('BEGIN');
                        let nombrePresidente;
                        const presidenteNameRes = await pool.query('SELECT name FROM public."users" WHERE id = $1', [userId]);
                        nombrePresidente = presidenteNameRes.rows[0]?.name || 'Admin';

                        const result = await client.query(
                            `INSERT INTO public."clubs" (nombre_evento, descripcion, imagen_club, fecha_creacion, id_presidente, nombre_presidente, estado, ciudad, enfoque) VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8) RETURNING id, nombre_evento, imagen_club`,
                            [final_nombre_evento, descripcion, imagen_club_url, userId, nombrePresidente, 'activo', ciudad, enfoque]
                        );
                        await client.query('UPDATE public."users" SET club_id = $1, is_presidente = TRUE WHERE id = $2', [result.rows[0].id, userId]);
                        await client.query('COMMIT');
                        return res.status(201).json({ success: true, message: "Club creado y activado.", club: result.rows[0] });
                    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
                } else {
                    const checkUser = await pool.query('SELECT role, club_id FROM public."users" WHERE id = $1', [userId]);
                    if (checkUser.rows[0].role === 'presidente' && checkUser.rows[0].club_id !== null) return res.status(403).json({ success: false, message: "Ya eres presidente de un club activo." });
                    const checkPending = await pool.query('SELECT id FROM public.clubs_pendientes WHERE id_presidente = $1', [userId]);
                    if (checkPending.rows.length > 0) return res.status(403).json({ success: false, message: "Ya tienes una solicitud pendiente." });

                    const result = await pool.query(
                        `INSERT INTO public."clubs_pendientes" (nombre_evento, descripcion, imagen_club, fecha_solicitud, id_presidente, ciudad, enfoque) VALUES ($1, $2, $3, NOW(), $4, $5, $6) RETURNING id, nombre_evento`,
                        [final_nombre_evento, descripcion, imagen_club_url, userId, ciudad, enfoque]
                    );
                    return res.status(201).json({ success: true, message: "Solicitud enviada.", pending_club: result.rows[0] });
                }
            } catch (uploadError) {
                if (isCloudinaryUploadSuccess && imagen_club_url) await deleteFromCloudary(imagen_club_url);
                return res.status(500).json({ success: false, message: uploadError.message });
            }
        }

        if (method === "PUT") {
            const contentType = req.headers['content-type'] || '';

            if (contentType.includes('application/json')) {
                const body = await getBody(req);
                if (body && body.action === 'leave') {
                    const verification = verifyToken(req);
                    if (!verification.authorized) return res.status(401).json({ success: false, message: verification.message });
                    const requestingUserId = verification.user.id;
                    let client = await pool.connect();
                    try {
                        await client.query('BEGIN');
                        const userRes = await pool.query('SELECT club_id, is_presidente, role FROM public."users" WHERE id = $1 FOR UPDATE', [requestingUserId]);
                        const { club_id: currentClubId, is_presidente, role } = userRes.rows[0];
                        if (!currentClubId) { await client.query('ROLLBACK'); return res.status(400).json({ success: false, message: "No eres miembro de ningún club." }); }
                        if (is_presidente || role === 'presidente') { await client.query('ROLLBACK'); return res.status(403).json({ success: false, message: "El presidente debe eliminar el club." }); }
                        await client.query('UPDATE public."users" SET club_id = NULL WHERE id = $1', [requestingUserId]);
                        const updatedUserRes = await pool.query('SELECT id, name, email, role, club_id, is_presidente FROM public."users" WHERE id = $1', [requestingUserId]);
                        const newToken = jwt.sign(updatedUserRes.rows[0], JWT_SECRET, { expiresIn: '1d' });
                        await client.query('COMMIT');
                        return res.status(200).json({ success: true, message: "Has abandonado el club.", token: newToken });
                    } catch (error) { await client.query('ROLLBACK'); return res.status(500).json({ success: false, message: "Error interno." }); } finally { if (client) client.release(); }
                }
            }

            const clubIdToUpdate = id;
            if (!clubIdToUpdate) return res.status(400).json({ success: false, message: "ID requerido." });

            let imagenFilePathTemp = null, imagen_club_url = null, old_imagen_club_url = null, isCloudinaryUploadSuccess = false;

            try {
                const { fields, files, imagenFilePathTemp: tempPath } = await parseForm(req);
                imagenFilePathTemp = tempPath;
                const { nombre_club, nombre_evento, descripcion, ciudad: newCiudad, enfoque: newEnfoque, estado: newEstado, id_presidente: newIdPresidente } = fields;
                const final_nombre_evento = nombre_club || nombre_evento;
                const authorizedUser = await verifyClubOwnershipOrAdmin(req, clubIdToUpdate);
                const isOnlyPresident = authorizedUser.role !== 'admin';

                if (imagenFilePathTemp) {
                    imagen_club_url = await uploadToCloudinary(imagenFilePathTemp);
                    isCloudinaryUploadSuccess = true;
                }
                const clubCheckRes = await pool.query('SELECT imagen_club FROM public.clubs WHERE id = $1', [clubIdToUpdate]);
                if (clubCheckRes.rows.length > 0) old_imagen_club_url = clubCheckRes.rows[0].imagen_club;

                const updates = []; const values = []; let paramIndex = 1;
                if (final_nombre_evento) { updates.push(`nombre_evento = $${paramIndex++}`); values.push(final_nombre_evento); }
                if (descripcion) { updates.push(`descripcion = $${paramIndex++}`); values.push(descripcion); }
                if (imagen_club_url) { updates.push(`imagen_club = $${paramIndex++}`); values.push(imagen_club_url); }
                if (newCiudad) { updates.push(`ciudad = $${paramIndex++}`); values.push(newCiudad); }
                if (newEnfoque) { updates.push(`enfoque = $${paramIndex++}`); values.push(newEnfoque); }
                if (!isOnlyPresident) {
                    if (newEstado) { updates.push(`estado = $${paramIndex++}`); values.push(newEstado); }
                    if (newIdPresidente && !isNaN(parseInt(newIdPresidente))) { updates.push(`id_presidente = $${paramIndex++}`); values.push(parseInt(newIdPresidente)); }
                }

                if (updates.length === 0) return res.status(400).json({ success: false, message: "Sin cambios." });
                values.push(clubIdToUpdate);
                const result = await pool.query(`UPDATE public.clubs SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`, values);

                if (imagen_club_url && old_imagen_club_url) await deleteFromCloudary(old_imagen_club_url);
                return res.status(200).json({ success: true, message: "Club actualizado.", club: result.rows[0] });

            } catch (uploadError) {
                if (isCloudinaryUploadSuccess && imagen_club_url) await deleteFromCloudary(imagen_club_url);
                return res.status(500).json({ success: false, message: uploadError.message });
            }
        }

        if (method === "DELETE") {
            const clubId = parseInt(id);
            if (!clubId || isNaN(clubId)) return res.status(400).json({ success: false, message: "ID requerido." });

            const authorizedUser = await verifyClubOwnershipOrAdmin(req, clubId);
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                const clubInfoRes = await client.query('SELECT imagen_club, id_presidente FROM public.clubs WHERE id = $1 FOR UPDATE', [clubId]);

                if (clubInfoRes.rows.length === 0) {
                    const pendingInfoRes = await pool.query('SELECT imagen_club FROM public.clubs_pendientes WHERE id = $1', [clubId]);
                    if (pendingInfoRes.rows.length > 0) {
                        await client.query('DELETE FROM public.clubs_pendientes WHERE id = $1', [clubId]);
                        if (pendingInfoRes.rows[0].imagen_club) await deleteFromCloudary(pendingInfoRes.rows[0].imagen_club);
                        await client.query('COMMIT');
                        return res.status(200).json({ success: true, message: "Solicitud pendiente eliminada." });
                    }
                    await client.query('ROLLBACK');
                    return res.status(404).json({ success: false, message: "Club no encontrado." });
                }

                const { imagen_club, id_presidente } = clubInfoRes.rows[0];

                // 🛑 LIMPIEZA PROFUNDA (Deep Clean) - CORRECCIÓN CLAVE
                // La eliminación de dependencias se hace secuencialmente. Si una falla,
                // la transacción entera fallará al instante y el catch lo detectará correctamente.

                // 1. Borrar inscripciones de eventos del club
                // Si la tabla 'inscripciones' no existe o falla, el catch final te dirá por qué.
                await client.query('DELETE FROM public.inscripciones WHERE event_id IN (SELECT id FROM public.events WHERE club_id = $1)', [clubId]);

                // 2. Borrar eventos
                await client.query('DELETE FROM public.events WHERE club_id = $1', [clubId]);

                // 3. Borrar posts, noticias, o publicaciones del club
                await client.query('DELETE FROM public.posts WHERE club_id = $1', [clubId]);
                await client.query('DELETE FROM public.noticias WHERE club_id = $1', [clubId]);
                await client.query('DELETE FROM public.comentarios WHERE club_id = $1', [clubId]);

                // 4. Desvincular usuarios y borrar el club
                await client.query(`UPDATE public."users" SET club_id = NULL, role = 'user', is_presidente = FALSE WHERE club_id = $1`, [clubId]);
                await client.query('DELETE FROM public.clubs WHERE id = $1', [clubId]);
                if (imagen_club) await deleteFromCloudary(imagen_club);

                // 5. Generar nuevo token
                let newToken = null;
                if (authorizedUser.id === id_presidente) {
                    const updatedUserRes = await client.query('SELECT id, name, email, role, club_id, is_presidente FROM public."users" WHERE id = $1', [id_presidente]);
                    if (updatedUserRes.rows[0]) newToken = jwt.sign(updatedUserRes.rows[0], JWT_SECRET, { expiresIn: '1d' });
                }

                // 6. Finalizar Transacción
                await client.query('COMMIT');
                return res.status(200).json({ success: true, message: "Club eliminado.", token: newToken });

            } catch (error) {
                // 🛑 CORRECTO: Si algo falla, el ROLLBACK se ejecuta y luego se lanza el error al manejador final.
                await client.query('ROLLBACK');
                throw error;
            } finally { client.release(); }
        }

        return res.status(405).json({ success: false, message: "Método no permitido." });

    } catch (error) {
        // --- 🛑 BLOQUE DE DIAGNÓSTICO MEJORADO ("EL CHIVATO") 🛑 ---
        console.error("Error DETALLADO en clubsHandler:", error);

        if (error.message.includes('Acceso denegado') || error.message.includes('No autorizado') || error.message.includes('Token') || error.message.includes('Debe iniciar sesión')) {
            return res.status(401).json({ success: false, message: error.message });
        }

        // 42P01: Tabla no existe. Esto ocurrirá si una de las tablas de limpieza profunda no existe.
        if (error.code === '42P01') {
            const tableName = error.message.match(/relation "public\.(.+?)"/)?.[1] || 'una tabla desconocida';
            return res.status(500).json({ success: false, message: `Error de la base de datos: La tabla "${tableName}" no fue encontrada.` });
        }

        // 23xxx: Violación de integridad (Foreign Key). Esto ocurrirá si la limpieza no fue suficiente.
        if (error.code && error.code.startsWith('23')) {
            const detalle = error.detail ? error.detail : `Código de error: ${error.code}`;
            let mensajeAmigable = "No se puede eliminar el club porque tiene elementos asociados (posts, inscripciones, etc.) que no se pudieron borrar.";
            if (detalle.includes('table')) {
                mensajeAmigable += ` La tabla vinculada es: ${detalle.split('table')[1]}`;
            }

            return res.status(500).json({
                success: false,
                message: `${mensajeAmigable} (Detalle técnico: ${detalle})`
            });
        }

        if (error.message.includes('Cloudinary')) {
            return res.status(500).json({ success: false, message: "Error en Cloudinary. Revise los logs." });
        }

        return res.status(500).json({ success: false, message: `Error interno: ${error.message}` });
    }
}

export default async function clubsCombinedHandler(req, res) {
    if (req.query.status === 'change') return statusChangeHandler(req, res);
    return clubsHandler(req, res);
}