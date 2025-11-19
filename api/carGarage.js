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
            multiples: false,
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
        // 1. LISTAR COCHES (GET)
        // --------------------------------------------
        if (method === "GET") {
            const { user_id, id } = req.query;

            if (id) {
                const result = await client.query("SELECT * FROM car_garage WHERE id = $1", [id]);
                return res.status(200).json({ ok: true, car: result.rows[0] });
            }

            if (!user_id) {
                return res.status(400).json({ ok: false, msg: "Falta user_id" });
            }

            const result = await client.query(
                "SELECT * FROM car_garage WHERE user_id = $1 ORDER BY id DESC",
                [user_id]
            );

            return res.status(200).json({ ok: true, cars: result.rows });
        }

        // --------------------------------------------
        // 2 & 3. AGREGAR (POST) / EDITAR (PUT) COCHE con IMAGEN
        // --------------------------------------------
        if (method === "POST" || method === "PUT") {

            // 1. Parsear FormData
            const { fields, files } = await parseMultipart(req);

            // Extraer campos y archivo. photoURL es el campo hidden con la URL existente.
            const { user_id, car_name, model, year, description, photoURL, id } = fields;
            const file = files.imageFile?.[0]; // imageFile es el archivo subido (Nombre CLAVE)

            // Validación de campos obligatorios
            if (!user_id && method === "POST") {
                return res.status(400).json({ ok: false, msg: "Falta user_id" });
            }
            if (!car_name) {
                return res.status(400).json({ ok: false, msg: "Falta car_name" });
            }
            if (!id && method === "PUT") {
                return res.status(400).json({ ok: false, msg: "Falta id del coche" });
            }


            let finalPhotoUrl = photoURL || null; // URL existente por defecto

            // 2. Procesar imagen si se ha subido un nuevo archivo
            if (file && file.size > 0) {
                try {
                    const uploadResponse = await cloudinary.uploader.upload(file.filepath, {
                        folder: "motor_libre_competicion_car_garage", // Carpeta específica para el garaje
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
                // AGREGAR COCHE
                query = `
                    INSERT INTO car_garage (user_id, car_name, model, year, description, photo_url, created_at)
                    VALUES ($1, $2, $3, $4, $5, $6, NOW())
                    RETURNING *;
                `;
                values = [user_id, car_name, model, year, description, finalPhotoUrl];

            } else if (method === "PUT") {
                // EDITAR COCHE
                query = `
                    UPDATE car_garage
                    SET car_name = $1, model = $2, year = $3, description = $4, photo_url = $5
                    WHERE id = $6
                    RETURNING *;
                `;
                values = [car_name, model, year, description, finalPhotoUrl, id];
            }

            const result = await client.query(query, values);

            return res.status(200).json({ ok: true, msg: `Coche ${method === 'POST' ? 'añadido' : 'actualizado'}`, car: result.rows[0] });
        }


        // --------------------------------------------
        // 4. ELIMINAR COCHE (DELETE)
        // --------------------------------------------
        if (method === "DELETE") {
            const { id } = req.query;

            if (!id) {
                return res.status(400).json({ ok: false, msg: "Falta id" });
            }

            await client.query("DELETE FROM car_garage WHERE id = $1", [id]);

            return res.status(200).json({ ok: true, msg: "Coche eliminado" });
        }

        // --------------------------------------------
        // MÉTODO NO PERMITIDO
        // --------------------------------------------
        return res.status(405).json({ ok: false, msg: "Método no permitido" });

    } catch (err) {
        console.error("Error en carGarage.js:", err);
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