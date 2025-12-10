// clubs.js - CORREGIDO (El rol 'admin' se preserva durante la aprobación/eliminación de clubes)
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
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Convertir fs.unlink en una función Promise para usar con async/await
const unlinkAsync = promisify(fs.unlink);

// Función de utilidad para eliminar una imagen de Cloudinary
async function deleteFromCloudinary(imageUrl) {
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


// Desactiva el body parser de Next.js para permitir que formidable lea el cuerpo del request
export const config = {
    api: { bodyParser: false, },
};
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
        return { authorized: true, user: decoded };
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
        throw new Error(verification.message || 'Debe iniciar sesión para realizar esta acción.');
    }

    const decodedUser = verification.user;

    // A. Permiso de Administrador
    if (decodedUser.role === 'admin') {
        return decodedUser;
    }

    // B. Permiso de Presidente (Verificado por ID)
    if (!clubId) {
        throw new Error('ID de club requerido para la verificación de propiedad.');
    }

    // 1. Verificar si el club existe y obtener el id_presidente
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
        throw new Error('Acceso denegado: Solo el administrador o el presidente de este club pueden editarlo.');
    }

    // Nota: La verificación de si el usuario tiene is_presidente=TRUE se asume
    // al momento de la creación del token. Aquí solo se verifica la propiedad del club.
    return decodedUser;
};

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
                    try { resolve(JSON.parse(Buffer.concat(chunks).toString())); } catch (e) { resolve({}); }
                });
            });

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
                // 💡 FIX 1: Obtener el rol actual del usuario antes de actualizarlo
                const presidenteUserRes = await client.query('SELECT name, role FROM public."users" WHERE id = $1', [club.id_presidente]);
                nombrePresidente = presidenteUserRes.rows[0]?.name || 'Usuario desconocido';
                const currentPresidenteRole = presidenteUserRes.rows[0]?.role || 'user'; // 'user' o 'admin'

                // Usamos la URL de la imagen que ya está guardada en clubs_pendientes
                // ⭐ MODIFICACIÓN INSERT: Añadir campo 'enfoque'
                const insertRes = await client.query(
                    'INSERT INTO public.clubs (nombre_evento, descripcion, imagen_club, fecha_creacion, id_presidente, nombre_presidente, estado, ciudad, enfoque) VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8) RETURNING id',
                    [club.nombre_evento, club.descripcion, club.imagen_url, club.id_presidente, nombrePresidente, 'activo', club.ciudad, club.enfoque]
                );
                const newClubId = insertRes.rows[0].id;

                // 🚨 CAMBIO CRÍTICO: Usar el rol actual del presidente (currentPresidenteRole) 
                // en lugar de forzar a 'user'. Si era 'admin', se queda como 'admin'.
                await client.query(
                    'UPDATE public."users" SET role = $1, club_id = $2, is_presidente = TRUE WHERE id = $3',
                    [currentPresidenteRole, newClubId, club.id_presidente]
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
                await deleteFromCloudinary(clubRes.rows[0].imagen_club);
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
    const { estado, id } = query;

    let isAdmin = false;
    let userId = null;

    let authVerification = verifyToken(req);

    if (authVerification.authorized) {
        userId = authVerification.user.id;
        isAdmin = authVerification.user.role === 'admin';
    }


    try {
        if (method === "GET") {
            // ... (Lógica GET sin cambios críticos en esta sección)
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
            // ... (Lógica POST sin cambios críticos en esta sección, ya maneja bien el rol 'admin')
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

                        let nombrePresidente = 'Admin';
                        const presidenteNameRes = await client.query('SELECT name FROM public."users" WHERE id = $1', [idPresidente]);
                        nombrePresidente = presidenteNameRes.rows[0]?.name || 'Admin';

                        // 1. Inserción del Club
                        // ⭐ MODIFICACIÓN INSERT: Añadir 'enfoque'
                        insertColumns = `nombre_evento, descripcion, imagen_club, id_presidente, nombre_presidente, estado, fecha_creacion, ciudad, enfoque`;
                        insertValues = `($1, $2, $3, $4, $5, $6, NOW(), $7, $8)`;
                        params = [
                            nombre_evento,
                            descripcion,
                            imagen_club_url,
                            idPresidente,
                            nombrePresidente,
                            clubEstado, // 'activo' ($6)
                            ciudad, // Ciudad ($7)
                            enfoque // Enfoque ($8)
                        ];

                        const insertQuery = `
                            INSERT INTO public."${tabla}" (${insertColumns}) 
                            VALUES ${insertValues}
                            RETURNING id, nombre_evento, descripcion
                        `;

                        const result = await client.query(insertQuery, params);
                        const newClubId = result.rows[0].id;

                        // 🚨 CAMBIO CRÍTICO: Actualización para el nuevo esquema de usuario (Admin)
                        // El rol se mantiene como 'admin' y se activa la bandera is_presidente = TRUE
                        await client.query(
                            'UPDATE public."users" SET role = $1, club_id = $2, is_presidente = TRUE WHERE id = $3',
                            ['admin', newClubId, idPresidente]
                        );

                        await client.query('COMMIT');

                        return res.status(201).json({
                            success: true,
                            message: "Club creado y activado (por admin).",
                            club: result.rows[0]
                        });

                    } catch (error) {
                        await client.query('ROLLBACK');
                        throw error; // Lanzar para que el catch externo maneje la limpieza de Cloudinary si aplica
                    } finally {
                        client.release();
                    }
                    // --- FIN MODIFICACIÓN CLAVE ---

                } else {
                    // Lógica para usuario normal (Solicitud Pendiente) - Sin transacción (solo una inserción)

                    // 🚨 CAMBIO CRÍTICO: Seleccionar el campo is_presidente
                    const checkUser = await pool.query('SELECT role, club_id, is_presidente FROM public."users" WHERE id = $1', [userId]);
                    if (checkUser.rows.length === 0) {
                        return res.status(403).json({ success: false, message: "Usuario no encontrado." });
                    }
                    const userDetails = checkUser.rows[0];

                    // 🚨 CAMBIO CRÍTICO: Verificar si ya es presidente usando la nueva columna
                    if (userDetails.is_presidente === true && userDetails.club_id !== null) {
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
                        RETURNING id, nombre_evento, descripcion
                    `;

                    const result = await pool.query(insertQuery, params);

                    return res.status(201).json({
                        success: true,
                        message: "Solicitud de club enviada y pendiente de aprobación.",
                        club: result.rows[0]
                    });
                }
            } catch (uploadError) {
                // ... (El manejo de errores sigue igual)
                if (isCloudinaryUploadSuccess && imagen_club_url) {
                    await deleteFromCloudinary(imagen_club_url);
                }
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
                if (uploadError.message.includes('Acceso denegado') || uploadError.message.includes('Token') || uploadError.message.includes('Ya tienes')) {
                    return res.status(401).json({ success: false, message: uploadError.message });
                }
                if (uploadError.message.includes('nombre_evento') || uploadError.message.includes('descripcion') || uploadError.message.includes('ciudad') || uploadError.message.includes('enfoque')) {
                    return res.status(400).json({ success: false, message: uploadError.message });
                }

                return res.status(500).json({ success: false, message: "Error interno en la creación del club." });
            }
        }


        if (method === "PUT") {
            // ... (Lógica PUT sin cambios críticos en esta sección, la verificación de ownership es suficiente)
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
                const {
                    nombre_evento,
                    descripcion,
                    ciudad: newCiudad,
                    enfoque: newEnfoque, // Nuevo campo
                    estado: newEstado,
                    id_presidente: newIdPresidente
                } = fields;

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
                if (newCiudad) {
                    updates.push(`ciudad = $${paramIndex++}`);
                    values.push(newCiudad);
                }
                // ⭐ MODIFICACIÓN PUT: Incluir 'enfoque' en las actualizaciones
                if (newEnfoque) {
                    updates.push(`enfoque = $${paramIndex++}`);
                    values.push(newEnfoque);
                }
                if (imagen_club_url) {
                    updates.push(`imagen_club = $${paramIndex++}`);
                    values.push(imagen_club_url);
                }

                if (!isOnlyPresident) {
                    if (newEstado) {
                        updates.push(`estado = $${paramIndex++}`);
                        values.push(newEstado);
                    }
                    if (newIdPresidente) {
                        updates.push(`id_presidente = $${paramIndex++}`);
                        values.push(newIdPresidente);
                    }
                }

                if (updates.length === 0) {
                    return res.status(400).json({ success: false, message: "No hay campos válidos para actualizar." });
                }

                values.push(id);
                const idParam = paramIndex;

                // ⭐ MODIFICACIÓN PUT: Añadir 'enfoque' a la respuesta RETURNING
                const updateQuery = `
                    UPDATE public.clubs SET ${updates.join(', ')} WHERE id = $${idParam}
                    RETURNING id, nombre_evento, descripcion, imagen_club as imagen_url, ciudad, enfoque
                `;

                const result = await pool.query(updateQuery, values);

                if (result.rows.length === 0) {
                    return res.status(404).json({ success: false, message: "Club no encontrado para actualizar." });
                }

                // Si la actualización de DB fue exitosa y se subió una nueva imagen,
                // eliminamos la imagen antigua de Cloudinary.
                if (imagen_club_url && old_imagen_club_url) {
                    await deleteFromCloudinary(old_imagen_club_url);
                }

                return res.status(200).json({ success: true, message: "Club actualizado.", club: result.rows[0] });

            } catch (uploadError) {
                // ... (El manejo de errores sigue igual)
                if (isCloudinaryUploadSuccess && imagen_club_url) {
                    await deleteFromCloudinary(imagen_club_url);
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
                if (uploadError.message.includes('Acceso denegado') || uploadError.message.includes('Token') || uploadError.message.includes('Club no encontrado')) {
                    return res.status(401).json({ success: false, message: uploadError.message });
                }

                return res.status(500).json({ success: false, message: "Error interno en la actualización del club." });
            }
        }


        if (method === "DELETE") {
            const { id } = query;
            if (!id) return res.status(400).json({ success: false, message: "ID del club es requerido para eliminar." });

            try {
                verifyAdmin(req);
            } catch (error) {
                return res.status(401).json({ success: false, message: error.message });
            }

            const clubRes = await pool.query('SELECT id_presidente, imagen_club FROM public.clubs WHERE id = $1', [id]);
            if (clubRes.rows.length === 0) {
                return res.status(404).json({ success: false, message: "Club no encontrado para eliminar." });
            }
            const { id_presidente, imagen_club } = clubRes.rows[0];

            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                const deleteRes = await client.query('DELETE FROM public.clubs WHERE id = $1 RETURNING id', [id]);

                if (deleteRes.rows.length > 0) {
                    if (id_presidente) {

                        // 💡 FIX 1 (DELETION): Obtener el rol actual del usuario antes de actualizar
                        const userRoleRes = await client.query('SELECT role FROM public."users" WHERE id = $1', [id_presidente]);
                        const currentRole = userRoleRes.rows[0]?.role || 'user'; // Por si acaso

                        // 🚨 CAMBIO CRÍTICO: Usar el rol actual (currentRole) en la actualización
                        // El rol se mantiene (admin o user) y se desactiva la bandera is_presidente = FALSE
                        await client.query('UPDATE public."users" SET role = $1, club_id = NULL, is_presidente = FALSE WHERE id = $2', [currentRole, id_presidente]);
                    }

                    // Eliminación de Cloudinary fuera de la transacción para evitar fallos de commit, 
                    // ya que la transacción se centra en la integridad de la DB.
                    await client.query('COMMIT');

                    if (imagen_club) {
                        await deleteFromCloudinary(imagen_club);
                    }


                    return res.status(200).json({ success: true, message: "Club eliminado y rol de presidente restablecido." });
                }

                await client.query('ROLLBACK');
                return res.status(404).json({ success: false, message: "Club no encontrado para eliminar." });


            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
        }

        return res.status(405).json({ success: false, message: "Método no permitido." });

    } catch (error) {
        console.error("Error en clubsHandler:", error);

        if (error.message.includes('Acceso denegado') || error.message.includes('No autorizado') || error.message.includes('Token')) {
            return res.status(401).json({ success: false, message: error.message });
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

    if (query.status === 'change' && query.id) {
        return statusChangeHandler(req, res);
    }
    return clubsHandler(req, res);
}