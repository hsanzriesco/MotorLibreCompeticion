import { Pool } from "pg";
import { v2 as cloudinary } from 'cloudinary';
import formidable from 'formidable';

// Configuración de Cloudinary
// ASEGÚRATE DE QUE ESTAS VARIABLES ESTÁN EN TU ENTORNO (.env)
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Desactiva el parser de body de Vercel/Next.js para que formidable pueda manejar el archivo
export const config = {
    api: {
        bodyParser: false,
    },
};

// Conexión al pool PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

// Función auxiliar para parsear el cuerpo multipart (archivos y campos)
function parseMultipart(req) {
    return new Promise((resolve, reject) => {
        const form = formidable({
            multiples: false,
            maxFileSize: 10 * 1024 * 1024 // Límite de 10MB
        });

        form.parse(req, (err, fields, files) => {
            if (err) {
                console.error("Error parsing form data:", err);
                return reject(err);
            }

            // Formidable devuelve campos y archivos como arrays, los convertimos a un solo valor para facilitar su uso
            const singleFields = Object.fromEntries(
                Object.entries(fields).map(([key, value]) => [key, value[0]])
            );

            resolve({ fields: singleFields, files });
        });
    });
}

export default async function handler(req, res) {
    const { id } = req.query;

    try {
        // === 🟢 GET: Obtener todos los eventos ===
        if (req.method === "GET") {
            const result = await pool.query(
                `SELECT id, title, description, location, event_start AS start, event_end AS "end", image_url
         FROM events
         ORDER BY start ASC`
            );
            return res.status(200).json({ success: true, data: result.rows });
        }

        // El resto de métodos requiere analizar el cuerpo, que ahora puede ser multipart/form-data
        if (req.method === "POST" || req.method === "PUT") {

            // 1. Parsear el cuerpo y los archivos (FormData)
            const { fields, files } = await parseMultipart(req);

            const { title, description, location, start, end, imageURL } = fields; // imageURL es el campo hidden
            const file = files.imageFile?.[0]; // imageFile es el archivo subido

            // Validación de campos obligatorios
            if (!title || !start || !end) {
                return res.status(400).json({
                    success: false,
                    message: "Faltan campos obligatorios (título, inicio, fin).",
                });
            }

            let finalImageUrl = imageURL || null; // URL existente por defecto

            // 2. Procesar imagen si se ha subido un nuevo archivo
            if (file && file.size > 0) {
                const uploadResponse = await cloudinary.uploader.upload(file.filepath, {
                    folder: "motor_libre_competicion_events",
                    resource_type: "auto",
                });
                finalImageUrl = uploadResponse.secure_url; // Obtenemos la URL pública

            } else if (req.method === "PUT" && imageURL === '') {
                // Si es una actualización y el campo hidden se envió vacío (es decir, se pulsó 'Quitar imagen')
                finalImageUrl = null;
            }

            let result;

            if (req.method === "POST") {
                // 3. Insertar el nuevo evento
                result = await pool.query(
                    `INSERT INTO events (title, description, location, event_start, event_end, image_url)
               VALUES ($1, $2, $3, $4, $5, $6)
               RETURNING *`,
                    [title, description, location, start, end, finalImageUrl]
                );
                return res.status(201).json({ success: true, data: result.rows[0] });

            } else if (req.method === "PUT") {
                // 4. Actualizar el evento
                if (!id) return res.status(400).json({ success: false, message: "Falta el ID del evento." });

                result = await pool.query(
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

        // === 🔴 DELETE: Eliminar evento ===
        if (req.method === "DELETE") {
            if (!id) return res.status(400).json({ success: false, message: "Falta el ID del evento." });
            await pool.query("DELETE FROM events WHERE id = $1", [id]);
            return res.status(200).json({ success: true, message: "Evento eliminado correctamente." });
        }

        // === 🚫 Método no permitido ===
        res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
        return res.status(405).json({ success: false, message: `Método ${req.method} no permitido.` });

    } catch (error) {
        console.error("Error general en /api/events:", error);
        // Verificar si el error es de Cloudinary o de la base de datos
        const errorMessage = error.message.includes('Cloudinary') ? 'Error al subir la imagen.' : 'Error interno del servidor.';
        return res.status(500).json({ success: false, message: errorMessage });
    }
}