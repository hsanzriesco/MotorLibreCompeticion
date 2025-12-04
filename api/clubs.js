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
                Object.entries(fields).map(([k, v]) => [k, v[0]])
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
        ssl: { rejectUnauthorized: false }
    });

    const client = await pool.connect();

    try {

        // ============================================================
        // 👉 JOIN: Unirse a un club
        // POST /api/clubs?action=join
        // ============================================================
        if (req.method === "POST" && action === "join") {
            const { user_id, club_id } = req.body;

            if (!user_id || !club_id) {
                return res.status(400).json({
                    success: false,
                    message: "Faltan datos: user_id y club_id son obligatorios."
                });
            }

            // 1️⃣ Verificar si ya pertenece a un club
            const check = await client.query(
                "SELECT club_id FROM users WHERE id = $1",
                [user_id]
            );

            if (check.rows[0].club_id) {
                return res.status(409).json({
                    success: false,
                    message: "Este usuario ya pertenece a un club."
                });
            }

            // 2️⃣ Verificar que el club existe
            const exists = await client.query(
                "SELECT id FROM clubs WHERE id = $1",
                [club_id]
            );

            if (exists.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "El club no existe."
                });
            }

            // 3️⃣ Asignarlo al usuario
            await client.query(
                "UPDATE users SET club_id = $1 WHERE id = $2",
                [club_id, user_id]
            );

            return res.status(200).json({
                success: true,
                message: "Usuario unido al club correctamente."
            });
        }

        // ============================================================
        // 👉 LEAVE: Salir del club
        // POST /api/clubs?action=leave
        // ============================================================
        if (req.method === "POST" && action === "leave") {
            const { user_id } = req.body;

            if (!user_id) {
                return res.status(400).json({
                    success: false,
                    message: "Falta user_id."
                });
            }

            const user = await client.query(
                "SELECT club_id FROM users WHERE id = $1",
                [user_id]
            );

            if (!user.rows[0].club_id) {
                return res.status(400).json({
                    success: false,
                    message: "Este usuario no está en ningún club."
                });
            }

            await client.query(
                "UPDATE users SET club_id = NULL WHERE id = $1",
                [user_id]
            );

            return res.status(200).json({
                success: true,
                message: "Has salido del club correctamente."
            });
        }

        // ============================================================
        // GET: Obtener club o lista de clubs
        // ============================================================
        if (req.method === "GET") {

            // Obtener un club por ID
            if (id) {
                const result = await client.query(
                    "SELECT * FROM clubs WHERE id = $1",
                    [id]
                );

                const members = await client.query(
                    "SELECT COUNT(*) FROM users WHERE club_id = $1",
                    [id]
                );

                return res.json({
                    success: true,
                    data: {
                        ...result.rows[0],
                        miembros: members.rows[0].count
                    }
                });
            }

            // Obtener todos los clubs
            const result = await client.query("SELECT * FROM clubs ORDER BY id ASC");
            return res.json({ success: true, data: result.rows });
        }

        // ============================================================
        // POST / PUT: Crear o editar club
        // (Ignorar si es JOIN o LEAVE)
        // ============================================================
        if (req.method === "POST" || req.method === "PUT") {
            if (action === "join" || action === "leave") return;

            const { fields, files } = await parseMultipart(req);

            let imageUrl = null;

            if (files.imagen_club?.[0]) {
                const upload = await cloudinary.uploader.upload(
                    files.imagen_club[0].filepath,
                    {
                        folder: "motor_libre_competicion_clubs",
                        resource_type: "auto"
                    }
                );

                imageUrl = upload.secure_url;
            }

            // Crear club
            if (req.method === "POST") {
                const result = await client.query(
                    `INSERT INTO clubs (nombre_evento, descripcion, imagen_club)
                     VALUES ($1, $2, $3)
                     RETURNING *`,
                    [
                        fields.nombre_evento,
                        fields.descripcion,
                        imageUrl
                    ]
                );

                return res.status(201).json({ success: true, data: result.rows[0] });
            }

            // Editar club
            if (req.method === "PUT") {
                const result = await client.query(
                    `UPDATE clubs
                     SET nombre_evento=$1,
                         descripcion=$2,
                         imagen_club = COALESCE($3, imagen_club)
                     WHERE id=$4
                     RETURNING *`,
                    [
                        fields.nombre_evento,
                        fields.descripcion,
                        imageUrl,
                        id
                    ]
                );

                return res.json({ success: true, data: result.rows[0] });
            }
        }

        // ============================================================
        // DELETE: Eliminar club
        // ============================================================
        if (req.method === "DELETE") {
            await client.query("DELETE FROM clubs WHERE id=$1", [id]);
            return res.json({ success: true });
        }

        return res.status(405).json({ success: false, message: "Método no permitido." });

    } catch (err) {
        console.error("ERROR /api/clubs:", err);
        res.status(500).json({ success: false, error: err.message });
    } finally {
        client.release();
    }
}
