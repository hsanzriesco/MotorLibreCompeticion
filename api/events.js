import { Pool } from "pg";
import { v2 as cloudinary } from 'cloudinary';
import formidable from 'formidable';

export const config = {
    api: {
        bodyParser: false,
    },
};

function parseMultipart(req) {
    return new Promise((resolve, reject) => {
        const form = formidable({
            multiples: false,
            maxFileSize: 10 * 1024 * 1024
        });

        form.parse(req, (err, fields, files) => {
            if (err) {
                console.error("Error parsing form data:", err);
                return reject(err);
            }

            const singleFields = Object.fromEntries(
                Object.entries(fields).map(([key, value]) => [key, value[0]])
            );

            resolve({ fields: singleFields, files });
        });
    });
}

export default async function handler(req, res) {
    const { id } = req.query;
    let pool; 

    const requiredEnvVars = [
        "DATABASE_URL",
        "CLOUDINARY_CLOUD_NAME",
        "CLOUDINARY_API_KEY",
        "CLOUDINARY_API_SECRET",
    ];

    const missingVars = requiredEnvVars.filter(name => !process.env[name]);

    if (missingVars.length > 0) {
        console.error("FATAL ERROR: Faltan variables de entorno:", missingVars.join(", "));
        return res.status(500).json({
            success: false,
            message: `Error de configuración del servidor. Faltan las variables de entorno: ${missingVars.join(", ")}.`,
        });
    }

    try {
        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET,
        });
    } catch (configError) {
        console.error("Error al configurar Cloudinary:", configError.message);
        return res.status(500).json({
            success: false,
            message: "Error de autenticación de Cloudinary. Revisa que las claves sean correctas.",
        });
    }

    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });

    let client;

    try {
        client = await pool.connect();

        if (req.method === "GET") {
            const result = await client.query(
                `SELECT id, title, description, location, event_start AS start, event_end AS "end", image_url
                FROM events
                ORDER BY start ASC`
            );
            return res.status(200).json({ success: true, data: result.rows });
        }

        if (req.method === "POST" || req.method === "PUT") {

            const { fields, files } = await parseMultipart(req);

            const { title, description, location, start, end, imageURL } = fields;
            const file = files.imageFile?.[0];

            if (!title || !start || !end) {
                return res.status(400).json({
                    success: false,
                    message: "Faltan campos obligatorios (título, inicio, fin).",
                });
            }

            let finalImageUrl = imageURL || null;

            if (file && file.size > 0) {
                try {
                    const uploadResponse = await cloudinary.uploader.upload(file.filepath, {
                        folder: "motor_libre_competicion_events",
                        resource_type: "auto",
                    });
                    finalImageUrl = uploadResponse.secure_url;
                } catch (cloudinaryError) {
                    console.error("Cloudinary Upload Error:", cloudinaryError);
                    const errorDetails = cloudinaryError.http_code ? ` (Code: ${cloudinaryError.http_code})` : '';
                    throw new Error(`Cloudinary Upload Failed${errorDetails}: ${cloudinaryError.message}`);
                }

            } else if (req.method === "PUT" && imageURL === '') {
                finalImageUrl = null;
            }

            let result;

            if (req.method === "POST") {
                result = await client.query(
                    `INSERT INTO events (title, description, location, event_start, event_end, image_url)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *`,
                    [title, description, location, start, end, finalImageUrl]
                );
                return res.status(201).json({ success: true, data: result.rows[0] });

            } else if (req.method === "PUT") {
                if (!id) return res.status(400).json({ success: false, message: "Falta el ID del evento." });

                result = await client.query(
                    `UPDATE events
                SET title = $1, description = $2, location = $3, event_start = $4, event_end = $5, image_url = $6
                WHERE id = $7
                RETURNING *`,
                    [title, description, location, start, end, finalImageUrl, id]
                );

                if (result.rows.length === 0) return res.status(404).json({ success: false, message: "Evento no encontrado." });
                return res.status(200).json({ success: true, data: result.rows[0] });
            }
        }

        if (req.method === "DELETE") {
            if (!id) return res.status(400).json({ success: false, message: "Falta el ID del evento." });
            await client.query("DELETE FROM events WHERE id = $1", [id]);
            return res.status(200).json({ success: true, message: "Evento eliminado correctamente." });
        }

        res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
        return res.status(405).json({ success: false, message: `Método ${req.method} no permitido.` });

    } catch (error) {
        console.error("Error general en /api/events:", error);

        let errorMessage = 'Error interno del servidor.';

        if (error.message.includes('Cloudinary Upload Failed')) {
            errorMessage = `Error al subir la imagen: ${error.message}`;
        } else if (error.message.includes('Cloudinary')) {
            errorMessage = 'Error de autenticación de Cloudinary. Revisa tus credenciales.';
        } else if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND') || error.message.includes('timeout')) {
            errorMessage = 'Error de conexión a la base de datos o timeout. Revisa la DATABASE_URL.';
        } else if (error.code === '22007' || error.code === '22P02') {
            errorMessage = 'Error de formato de fecha/hora o ID inválido al intentar guardar en la DB.';
        }

        return res.status(500).json({ success: false, message: errorMessage });
    } finally {
        if (client) {
            client.release();
        }
    }
}
