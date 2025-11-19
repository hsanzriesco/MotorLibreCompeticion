import { Pool } from "pg";
import { v2 as cloudinary } from 'cloudinary';
import formidable from 'formidable';

// Desactiva el parser de body para que formidable pueda manejar el archivo
export const config = {
    api: {
        bodyParser: false,
    },
};

// Función auxiliar para parsear el cuerpo multipart (archivos y campos)
function parseMultipart(req) {
    return new Promise((resolve, reject) => {
        const form = formidable({
            multitudes: false,
            maxFileSize: 10 * 1024 * 1024 // Límite de 10MB
        });

        form.parse(req, (err, fields, files) => {
            if (err) {
                console.error("Error parsing form data:", err);
                return reject(err);
            }

            // Formidable devuelve campos y archivos como arrays, los convertimos a un solo valor
            const singleFields = Object.fromEntries(
                Object.entries(fields).map(([key, value]) => [key, value[0]])
            );

            resolve({ fields: singleFields, files });
        });
    });
}

// Inicialización global del pool de DB
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
    const { method } = req;
    let client; // Usamos un cliente para el patrón pool.connect() y liberación

    // ==========================================================
    // ⭐ CONFIGURACIÓN CLOUDINARY ⭐
    // ==========================================================
    try {
        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET,
        });
    } catch (configError) {
        return res.status(500).json({ ok: false, msg: "Error de configuración de Cloudinary." });
    }
    // ==========================================================


    try {
        client = await pool.connect(); // Obtener un cliente de conexión

        // --------------------------------------------
        // 1. LISTAR MOTOS (GET)
        // --------------------------------------------
        if (method === "GET") {
            const { user_id, id } = req.query;

            if (id) {
                // Selecciona una moto por ID
                const result = await client.query("SELECT * FROM motos_garage WHERE id = $1", [id]);
                return res.status(200).json({ ok: true, motorcycle: result.rows[0] });
            }

            if (!user_id) {
                return res.status(400).json({ ok: false, msg: "Falta user_id" });
            }

            // Selecciona todas las motos del usuario
            const result = await client.query(
                "SELECT * FROM motos_garage WHERE user_id = $1 ORDER BY id DESC",
                [user_id]
            );

            // Importante: El frontend espera 'motorcycles' para la carga combinada
            return res.status(200).json({ ok: true, motorcycles: result.rows });
        }

        // --------------------------------------------
        // 2 & 3. AGREGAR (POST) / EDITAR (PUT) MOTO con IMAGEN
        // --------------------------------------------
        if (method === "POST" || method === "PUT") {

            // 1. Parsear FormData
            const { fields, files } = await parseMultipart(req);

            // ATENCIÓN: Se usa 'motorcycle_name' en lugar de 'car_name'
            const { user_id, motorcycle_name, model, year, description, photoURL, id } = fields;
            const file = files.imageFile?.[0]; // imageFile es el archivo subido

            // Validación de campos obligatorios
            if (!user_id && method === "POST") {
                return res.status(400).json({ ok: false, msg: "Falta user_id" });
            }
            if (!motorcycle_name) {
                return res.status(400).json({ ok: false, msg: "Falta motorcycle_name" });
            }
            if (!id && method === "PUT") {
                return res.status(400).json({ ok: false, msg: "Falta id de la moto" });
            }


            let finalPhotoUrl = photoURL || null; // URL existente por defecto

            // 2. Procesar imagen si se ha subido un nuevo archivo
            if (file && file.size > 0) {
                try {
                    const uploadResponse = await cloudinary.uploader.upload(file.filepath, {
                        // CAMBIO DE CARPETA: Usar una carpeta específica para motos
                        folder: "motor_libre_competicion_motos_garage",
                        resource_type: "auto",
                    });
                    finalPhotoUrl = uploadResponse.secure_url; // Obtener la URL pública
                } catch (cloudinaryError) {
                    console.error("Cloudinary Upload Error:", cloudinaryError);
                    return res.status(500).json({ ok: false, msg: `Error al subir la imagen (Cloudinary Code: ${cloudinaryError.http_code || 'N/A'}). Revisa las credenciales.` });
                }

            } else if (method === "PUT" && photoURL === '') {
                // Si es una actualización y se ha vaciado el campo oculto (quitar imagen)
                finalPhotoUrl = null;
            }


            let query;
            let values;

            if (method === "POST") {
                // AGREGAR MOTO
                query = `
                    INSERT INTO motos_garage (user_id, motorcycle_name, model, year, description, photo_url, created_at)
                    VALUES ($1, $2, $3, $4, $5, $6, NOW())
                    RETURNING *;
                `;
                // ATENCIÓN: Usamos motorcycle_name aquí
                values = [user_id, motorcycle_name, model, year, description, finalPhotoUrl];

            } else if (method === "PUT") {
                // EDITAR MOTO
                query = `
                    UPDATE motos_garage
                    SET motorcycle_name = $1, model = $2, year = $3, description = $4, photo_url = $5
                    WHERE id = $6
                    RETURNING *;
                `;
                // ATENCIÓN: Usamos motorcycle_name aquí
                values = [motorcycle_name, model, year, description, finalPhotoUrl, id];
            }

            const result = await client.query(query, values);

            // Importante: Devolvemos 'motorcycle' como clave de objeto único
            return res.status(200).json({ ok: true, msg: `Moto ${method === 'POST' ? 'añadida' : 'actualizada'}`, motorcycle: result.rows[0] });
        }


        // --------------------------------------------
        // 4. ELIMINAR MOTO (DELETE)
        // --------------------------------------------
        if (method === "DELETE") {
            const { id } = req.query;

            if (!id) {
                return res.status(400).json({ ok: false, msg: "Falta id de la moto" });
            }

            // ATENCIÓN: Usamos la tabla 'motos_garage'
            await client.query("DELETE FROM motos_garage WHERE id = $1", [id]);

            return res.status(200).json({ ok: true, msg: "Moto eliminada" });
        }

        // --------------------------------------------
        // MÉTODO NO PERMITIDO
        // --------------------------------------------
        return res.status(405).json({ ok: false, msg: "Método no permitido" });

    } catch (err) {
        console.error("Error en motosGarage.js:", err);
        let errorMessage = "Error interno del servidor.";

        if (err.message.includes('ECONNREFUSED')) {
            errorMessage = 'Error de conexión a la base de datos.';
        }

        return res.status(500).json({ ok: false, msg: errorMessage, error: err.message });
    } finally {
        // Liberar la conexión
        if (client) {
            client.release();
        }
    }
}