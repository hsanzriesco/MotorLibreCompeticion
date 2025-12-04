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
    const { id } = req.query;

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
        // GET
        // ============================================================
        if (req.method === "GET") {

            if (id) {
                const result = await client.query(
                    "SELECT * FROM clubs WHERE id = $1",
                    [id]
                );
                return res.json({ success: true, data: result.rows[0] });
            }

            const result = await client.query(
                "SELECT * FROM clubs ORDER BY id ASC"
            );
            return res.json({ success: true, data: result.rows });
        }

        // ============================================================
        // POST / PUT
        // ============================================================
        if (req.method === "POST" || req.method === "PUT") {
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

            // ------------------------
            // CREATE
            // ------------------------
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

                return res.status(201).json({
                    success: true,
                    data: result.rows[0]
                });
            }

            // ------------------------
            // UPDATE
            // ------------------------
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
        // DELETE
        // ============================================================
        if (req.method === "DELETE") {
            await client.query("DELETE FROM clubs WHERE id=$1", [id]);
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
