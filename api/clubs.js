// api/clubs.js - MODIFICADO
import { Pool } from "pg";
import { v2 as cloudinary } from "cloudinary";
import formidable from "formidable";

export const config = { api: { bodyParser: false } };

function parseMultipart(req) {
    return new Promise((resolve, reject) => {
        const form = formidable({ multiples: false });
        form.parse(req, (err, fields, files) => {
            if (err) return reject(err);
            const clean = Object.fromEntries(
                Object.entries(fields).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])
            );
            resolve({ fields: clean, files });
        });
    });
}

// -----------------------------------------------------------
// 🔑 Función para obtener el ID de usuario del cuerpo o consulta
// Necesaria para saber quién registra el club (ID Presidente)
// -----------------------------------------------------------
async function getBody(req) {
    try {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const buffer = Buffer.concat(chunks);
        if (buffer.length === 0) return null;
        return JSON.parse(buffer.toString());
    } catch (e) {
        return null;
    }
}

export default async function handler(req, res) {
    const { id, action } = req.query;

    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });

    const client = await pool.connect();

    try {
        // --------------------------
        // POST?action=join/leave
        // --------------------------
        if (req.method === "POST" && (action === "join" || action === "leave")) {
            const body = req.headers["content-type"]?.includes("application/json")
                ? await getBody(req)
                : req.body || {};

            const user_id = body.user_id;
            const club_id = body.club_id;

            if (action === "join") {
                if (!user_id || !club_id) {
                    return res.status(400).json({ success: false, message: "Faltan user_id o club_id." });
                }

                const check = await client.query("SELECT club_id FROM users WHERE id = $1", [user_id]);
                if (check.rowCount === 0) {
                    return res.status(404).json({ success: false, message: "Usuario no encontrado." });
                }
                if (check.rows[0].club_id) {
                    return res.status(409).json({ success: false, message: "El usuario ya pertenece a un club." });
                }

                const clubCheck = await client.query("SELECT id FROM clubs WHERE id = $1", [club_id]);
                if (clubCheck.rowCount === 0) {
                    return res.status(404).json({ success: false, message: "Club no encontrado." });
                }

                await client.query("UPDATE users SET club_id = $1 WHERE id = $2", [club_id, user_id]);
                return res.status(200).json({ success: true, message: "Usuario unido al club." });
            }

            if (action === "leave") {
                if (!user_id) {
                    return res.status(400).json({ success: false, message: "Falta user_id." });
                }
                const check = await client.query("SELECT club_id FROM users WHERE id = $1", [user_id]);
                if (check.rowCount === 0) {
                    return res.status(404).json({ success: false, message: "Usuario no encontrado." });
                }
                if (!check.rows[0].club_id) {
                    return res.status(400).json({ success: false, message: "El usuario no pertenece a ningún club." });
                }
                await client.query("UPDATE users SET club_id = NULL WHERE id = $1", [user_id]);
                return res.status(200).json({ success: true, message: "Usuario salido del club." });
            }
        }

        // -----------------------------------------------------
        // 🆕 GET: Listar clubes pendientes (para el administrador)
        // -----------------------------------------------------
        if (req.method === "GET" && action === "pendientes") {
            // Se asume que solo el administrador llama a esta ruta, si necesitas seguridad, añádela aquí.
            const result = await client.query(
                `SELECT 
                    cp.id, cp.nombre_evento, cp.descripcion, cp.imagen_club, cp.fecha_solicitud, cp.id_presidente,
                    u.name AS nombre_presidente 
                FROM clubes_pendientes cp
                JOIN users u ON cp.id_presidente = u.id
                ORDER BY cp.fecha_solicitud DESC`
            );
            return res.json({ success: true, data: result.rows });
        }


        // --------------------------
        // GET: listado o detalle de clubes ACTIVOS
        // --------------------------
        if (req.method === "GET") {
            if (id) {
                const result = await client.query("SELECT * FROM clubs WHERE id = $1", [id]);
                if (result.rowCount === 0) return res.status(404).json({ success: false, message: "Club no encontrado." });

                const members = await client.query("SELECT COUNT(*) FROM users WHERE club_id = $1", [id]);
                return res.json({ success: true, data: { ...result.rows[0], miembros: members.rows[0].count } });
            }

            // Listado de clubes ACTIVOS
            const result = await client.query("SELECT * FROM clubs ORDER BY id ASC");
            return res.json({ success: true, data: result.rows });
        }


        // -------------------------------------------------------
        // 🆕 POST: APROBAR CLUB (Transacción atómica)
        // Ruta: POST /api/clubs?action=aprobar&id=X
        // -------------------------------------------------------
        if (req.method === "POST" && action === "aprobar") {
            if (!id) return res.status(400).json({ success: false, message: "Falta ID del club pendiente a aprobar." });

            await client.query('BEGIN'); // Iniciar Transacción

            // 1. Obtener datos del club pendiente
            const pendienteResult = await client.query(
                "SELECT nombre_evento, descripcion, imagen_club, fecha_solicitud, id_presidente FROM clubes_pendientes WHERE id = $1",
                [id]
            );

            if (pendienteResult.rowCount === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ success: false, message: "Club pendiente no encontrado." });
            }

            const clubData = pendienteResult.rows[0];
            const fechaCreacion = clubData.fecha_solicitud; // Usamos la fecha de solicitud como fecha de creación
            const idPresidente = clubData.id_presidente;

            // 2. Insertar en la tabla de clubes activos
            const clubInsertResult = await client.query(
                `INSERT INTO clubs (nombre_evento, descripcion, imagen_club, fecha_creacion, id_presidente)
                 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
                [clubData.nombre_evento, clubData.descripcion, clubData.imagen_club, fechaCreacion, idPresidente]
            );
            const newClubId = clubInsertResult.rows[0].id;

            // 3. Actualizar el rol del usuario solicitante a 'presidente'
            await client.query(
                "UPDATE users SET role = $1, club_id = $2 WHERE id = $3",
                ['presidente', newClubId, idPresidente]
            );

            // 4. Eliminar de la tabla de clubes pendientes
            await client.query("DELETE FROM clubes_pendientes WHERE id = $1", [id]);

            await client.query('COMMIT'); // Confirmar Transacción
            return res.status(200).json({ success: true, message: "Club aprobado y presidente asignado correctamente." });
        }


        // -------------------------------------------------------
        // 🆕 DELETE: RECHAZAR SOLICITUD
        // Ruta: DELETE /api/clubs/pendientes/:id
        // -------------------------------------------------------
        if (req.method === "DELETE" && action === "pendientes") {
            if (!id) return res.status(400).json({ success: false, message: "Falta ID del club pendiente a rechazar." });

            // Simplemente elimina de la tabla de pendientes
            const result = await client.query("DELETE FROM clubes_pendientes WHERE id = $1 RETURNING id", [id]);

            if (result.rowCount === 0) {
                return res.status(404).json({ success: false, message: "Club pendiente no encontrado para rechazar." });
            }

            return res.status(200).json({ success: true, message: "Solicitud de club rechazada y eliminada." });
        }


        // --------------------------
        // Crear / Editar clubs (multipart) (POST/PUT)
        // --------------------------
        if (req.method === "POST" || req.method === "PUT") {
            // Si action es join/leave/aprobar ya lo hemos manejado arriba
            if (["join", "leave", "aprobar"].includes(action)) return res.status(400).json({ success: false, message: "Acción inválida para este método." });

            const { fields, files } = await parseMultipart(req);

            let imageUrl = null;
            if (files.imagen_club?.[0]) {
                const upload = await cloudinary.uploader.upload(files.imagen_club[0].filepath, {
                    folder: "motor_libre_competicion_clubs",
                    resource_type: "auto",
                });
                imageUrl = upload.secure_url;
            }

            if (req.method === "POST") {
                // 🛑 CREAR (Registro inicial): Inserta en la tabla de PENDIENTES

                // ⭐ VALIDACIÓN CRÍTICA: Necesitas el ID del usuario que registra el club (ID_PRESIDENTE)
                // Debes enviar este ID en el formulario (o extraerlo del JWT si usas sesión)
                const id_presidente = fields.id_presidente;
                if (!id_presidente) {
                    return res.status(400).json({ success: false, message: "Falta el ID del presidente solicitante." });
                }

                const result = await client.query(
                    `INSERT INTO clubes_pendientes (nombre_evento, descripcion, imagen_club, fecha_solicitud, id_presidente)
                     VALUES ($1, $2, COALESCE($3, NULL), $4, $5) RETURNING *`,
                    [fields.nombre_evento, fields.descripcion, imageUrl, fields.fecha_creacion || new Date().toISOString(), id_presidente]
                );

                return res.status(201).json({ success: true, data: result.rows[0], message: "Solicitud de club enviada y pendiente de aprobación." });
            }

            if (req.method === "PUT") {
                // Editar club ACTIVO
                const result = await client.query(
                    `UPDATE clubs SET nombre_evento=$1, descripcion=$2, imagen_club=COALESCE($3, imagen_club) WHERE id=$4 RETURNING *`,
                    [fields.nombre_evento, fields.descripcion, imageUrl, id]
                );
                return res.json({ success: true, data: result.rows[0] });
            }
        }

        // --------------------------
        // DELETE club ACTIVO
        // --------------------------
        if (req.method === "DELETE") {
            await client.query("DELETE FROM clubs WHERE id = $1", [id]);
            return res.json({ success: true, message: "Club activo eliminado." });
        }

        return res.status(405).json({ success: false, message: "Método no permitido" });
    } catch (err) {
        console.error("ERROR /api/clubs:", err);
        // Si hay un error en la transacción (por ejemplo, ROLLBACK ya ejecutado)
        if (err.message.includes('current transaction is aborted')) {
            await client.query('ROLLBACK');
        }
        res.status(500).json({ success: false, error: err.message });
    } finally {
        client.release();
    }
}