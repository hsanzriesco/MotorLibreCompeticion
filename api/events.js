import { Pool } from "pg";
import { v2 as cloudinary } from 'cloudinary';
import formidable from 'formidable';

export const config = {
    api: {
        bodyParser: false,
    },
};

// ===============================================
// FUNCIONES DE PARSEO
// ===============================================

// Función para leer el cuerpo JSON puro (usado solo por 'register')
function readJsonBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                if (!body) return resolve({});
                resolve(JSON.parse(body));
            } catch (e) {
                // Error de JSON vacío o malformado
                reject(new Error("Error al parsear el cuerpo JSON de la solicitud (Unexpected end of JSON input)."));
            }
        });
    });
}

// Función para parsear Multipart/Form-Data (usado por POST/PUT para eventos con imagen)
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
// ===============================================

export default async function handler(req, res) {
    const { id, action } = req.query;
    let pool;
    let client;

    // 1. VERIFICACIÓN DE ENTORNO
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
            message: `Error de configuración: Faltan las variables de entorno: ${missingVars.join(", ")}.`,
        });
    }

    try {
        // Configuración de Cloudinary
        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET,
        });

        // Inicialización de Pool y conexión a DB
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false },
        });
        client = await pool.connect();

        // ===============================================
        // MANEJADOR GET
        // ===============================================
        if (req.method === "GET") {
            // GET: Cargar todos los eventos (si no hay 'action')
            if (!action) {
                // CONSULTA SQL CORREGIDA: Eliminamos el carácter \u00A0
                const result = await client.query(
                    `SELECT id, title, description, location, event_start AS start, event_end AS "end", image_url
                    FROM events
                    ORDER BY start ASC`
                );
                return res.status(200).json({ success: true, data: result.rows });
            }

            // GET: Verificar inscripción
            if (action === 'checkRegistration') {
                const { user_id, event_id } = req.query;

                if (!user_id || !event_id) {
                    return res.status(400).json({ success: false, message: "Faltan IDs de usuario o evento." });
                }

                const result = await client.query(
                    `SELECT * FROM event_registrations 
                     WHERE user_id = $1 AND event_id = $2`,
                    [user_id, event_id]
                );

                return res.status(200).json({ success: true, isRegistered: result.rows.length > 0 });
            }
        }

        // ===============================================
        // MANEJADOR POST
        // ===============================================
        if (req.method === "POST") {
            // POST: Registrar inscripción (requiere JSON Body)
            if (action === 'register') {
                const jsonBody = await readJsonBody(req);
                const { user_id, event_id } = jsonBody;

                if (!user_id || !event_id) {
                    return res.status(400).json({ success: false, message: "Faltan IDs de usuario o evento." });
                }

                // Verificación e inserción
                const check = await client.query(
                    `SELECT id FROM event_registrations 
                     WHERE user_id = $1 AND event_id = $2`,
                    [user_id, event_id]
                );

                if (check.rows.length > 0) {
                    return res.status(409).json({ success: false, message: "Ya estás inscrito en este evento." });
                }

                const result = await client.query(
                    `INSERT INTO event_registrations (user_id, event_id, registered_at)
                     VALUES ($1, $2, NOW())
                     RETURNING id`,
                    [user_id, event_id]
                );

                return res.status(201).json({ success: true, message: "Inscripción al evento exitosa.", registrationId: result.rows[0].id });
            }
            // ----------------------------------------------------


            // POST: Crear evento (requiere Multipart/Form-Data)
            if (!action) {
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
                    const uploadResponse = await cloudinary.uploader.upload(file.filepath, {
                        folder: "motor_libre_competicion_events",
                        resource_type: "auto",
                    });
                    finalImageUrl = uploadResponse.secure_url;
                }

                const result = await client.query(
                    `INSERT INTO events (title, description, location, event_start, event_end, image_url)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    RETURNING *`,
                    [title, description, location, start, end, finalImageUrl]
                );
                return res.status(201).json({ success: true, data: result.rows[0] });
            }
        }

        // ===============================================
        // MANEJADOR PUT
        // ===============================================
        if (req.method === "PUT") {
            // PUT: Editar evento (requiere Multipart/Form-Data)
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
                const uploadResponse = await cloudinary.uploader.upload(file.filepath, {
                    folder: "motor_libre_competicion_events",
                    resource_type: "auto",
                });
                finalImageUrl = uploadResponse.secure_url;
            } else if (imageURL === '') {
                finalImageUrl = null;
            }

            if (!id) return res.status(400).json({ success: false, message: "Falta el ID del evento." });

            const result = await client.query(
                `UPDATE events
                SET title = $1, description = $2, location = $3, event_start = $4, event_end = $5, image_url = $6
                WHERE id = $7
                RETURNING *`,
                [title, description, location, start, end, finalImageUrl, id]
            );

            if (result.rows.length === 0) return res.status(404).json({ success: false, message: "Evento no encontrado." });
            return res.status(200).json({ success: true, data: result.rows[0] });
        }

        // ===============================================
        // MANEJADOR DELETE
        // ===============================================
        if (req.method === "DELETE") {
            if (!id) return res.status(400).json({ success: false, message: "Falta el ID del evento." });
            await client.query("DELETE FROM events WHERE id = $1", [id]);
            return res.status(200).json({ success: true, message: "Evento eliminado correctamente." });
        }

        // ===============================================
        // MÉTODO NO PERMITIDO
        // ===============================================
        res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
        return res.status(405).json({ success: false, message: `Método ${req.method} no permitido.` });

    } catch (error) {
        console.error("Error general en /api/events:", error);

        let errorMessage = 'Error interno del servidor.';

        if (error.message.includes('Error al parsear el cuerpo JSON')) {
            errorMessage = 'Error de formato de datos (JSON) en la solicitud.';
        } else if (error.message.includes('Cloudinary Upload Failed')) {
            errorMessage = `Error al subir la imagen: ${error.message}`;
        } else if (error.message.includes('Cloudinary')) {
            errorMessage = 'Error de autenticación de Cloudinary. Revisa tus credenciales.';
        } else if (error.message.includes('ECONNREFUSED') || error.message.includes('timeout')) {
            errorMessage = 'Error de conexión a la base de datos o timeout. Revisa la DATABASE_URL.';
        } else if (error.code === '22007' || error.code === '22P02') {
            errorMessage = 'Error de formato de fecha/hora o ID inválido al intentar guardar en la DB.';
        } else if (error.code === '23505') {
            errorMessage = 'Error: Ya existe un registro similar en la base de datos (posiblemente ya inscrito).';
        } else if (error.code === '42601') {
            errorMessage = 'Error de sintaxis SQL. Revise que la consulta de eventos no contenga espacios invisibles.';
        }

        return res.status(500).json({ success: false, message: errorMessage });
    } finally {
        if (client) {
            client.release();
        }
    }
}