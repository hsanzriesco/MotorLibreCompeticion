// api/clubs.js
import { Pool } from "pg";
import { v2 as cloudinary } from "cloudinary";
import formidable from "formidable";

export const config = { api: { bodyParser: false } };

function parseMultipart(req) {
    return new Promise((resolve, reject) => {
        const form = formidable({ multiples: false });
        form.parse(req, (err, fields, files) => {
            if (err) return reject(err);
            // formidable devuelve arrays por defecto en algunos entornos, normalizamos:
            const clean = Object.fromEntries(
                Object.entries(fields).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])
            );
            resolve({ fields: clean, files });
        });
    });
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
        // POST?action=join   -> unirse (asigna users.club_id)
        // POST?action=leave  -> salirse (pone users.club_id = NULL)
        // --------------------------
        if (req.method === "POST" && action === "join") {
            // Se espera JSON con user_id y club_id
            const body = req.headers["content-type"]?.includes("application/json")
                ? await new Promise(r => {
                    let buf = "";
                    req.on("data", c => (buf += c.toString()));
                    req.on("end", () => r(buf ? JSON.parse(buf) : {}));
                })
                : req.body || {};

            const user_id = body.user_id;
            const club_id = body.club_id;

            if (!user_id || !club_id) {
                return res.status(400).json({ success: false, message: "Faltan user_id o club_id." });
            }

            // 1) comprobar si usuario ya pertenece a un club
            const check = await client.query("SELECT club_id FROM users WHERE id = $1", [user_id]);
            if (check.rowCount === 0) {
                return res.status(404).json({ success: false, message: "Usuario no encontrado." });
            }
            if (check.rows[0].club_id) {
                return res.status(409).json({ success: false, message: "El usuario ya pertenece a un club." });
            }

            // 2) comprobar club existe
            const clubCheck = await client.query("SELECT id FROM clubs WHERE id = $1", [club_id]);
            if (clubCheck.rowCount === 0) {
                return res.status(404).json({ success: false, message: "Club no encontrado." });
            }

            // 3) actualizar user
            await client.query("UPDATE users SET club_id = $1 WHERE id = $2", [club_id, user_id]);
            return res.status(200).json({ success: true, message: "Usuario unido al club." });
        }

        if (req.method === "POST" && action === "leave") {
            // Se espera JSON { user_id }
            const body = req.headers["content-type"]?.includes("application/json")
                ? await new Promise(r => {
                    let buf = "";
                    req.on("data", c => (buf += c.toString()));
                    req.on("end", () => r(buf ? JSON.parse(buf) : {}));
                })
                : req.body || {};

            const user_id = body.user_id;
            if (!user_id) {
                return res.status(400).json({ success: false, message: "Falta user_id." });
            }

            // comprobar usuario existe
            const check = await client.query("SELECT club_id FROM users WHERE id = $1", [user_id]);
            if (check.rowCount === 0) {
                return res.status(404).json({ success: false, message: "Usuario no encontrado." });
            }

            if (!check.rows[0].club_id) {
                return res.status(400).json({ success: false, message: "El usuario no pertenece a ningún club." });
            }

            // actualizar a NULL
            await client.query("UPDATE users SET club_id = NULL WHERE id = $1", [user_id]);
            return res.status(200).json({ success: true, message: "Usuario salido del club." });
        }

        // --------------------------
        // GET: listado o detalle
        // --------------------------
        if (req.method === "GET") {
            if (id) {
                const result = await client.query("SELECT * FROM clubs WHERE id = $1", [id]);
                if (result.rowCount === 0) return res.status(404).json({ success: false, message: "Club no encontrado." });

                const members = await client.query("SELECT COUNT(*) FROM users WHERE club_id = $1", [id]);
                return res.json({ success: true, data: { ...result.rows[0], miembros: members.rows[0].count } });
            }

            const result = await client.query("SELECT * FROM clubs ORDER BY id ASC");
            return res.json({ success: true, data: result.rows });
        }

        // --------------------------
        // Crear / Editar clubs (multipart) (POST/PUT)
        // --------------------------
        if (req.method === "POST" || req.method === "PUT") {
            // Si action es join/leave ya lo hemos manejado arriba
            if (action === "join" || action === "leave") return res.status(400).json({ success: false, message: "Acción inválida para este método." });

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
                // Crear
                const result = await client.query(
                    `INSERT INTO clubs (nombre_evento, descripcion, imagen_club, fecha_creacion)
           VALUES ($1, $2, COALESCE($3, NULL), $4) RETURNING *`,
                    [fields.nombre_evento, fields.descripcion, imageUrl, fields.fecha_creacion || new Date().toISOString()]
                );

                return res.status(201).json({ success: true, data: result.rows[0] });
            }

            if (req.method === "PUT") {
                const result = await client.query(
                    `UPDATE clubs SET nombre_evento=$1, descripcion=$2, imagen_club=COALESCE($3, imagen_club) WHERE id=$4 RETURNING *`,
                    [fields.nombre_evento, fields.descripcion, imageUrl, id]
                );
                return res.json({ success: true, data: result.rows[0] });
            }
        }

        // --------------------------
        // DELETE club
        // --------------------------
        if (req.method === "DELETE") {
            await client.query("DELETE FROM clubs WHERE id = $1", [id]);
            return res.json({ success: true });
        }

        return res.status(405).json({ success: false, message: "Método no permitido" });
    } catch (err) {
        console.error("ERROR /api/clubs:", err);
        res.status(500).json({ success: false, error: err.message });
    } finally {
        client.release();
    }
}
