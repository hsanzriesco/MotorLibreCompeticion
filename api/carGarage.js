// ./api/carGarage.js (O userAction.js, si ese es el nombre real)

const { Router } = require('express');
const noble = require('@noble/server'); // Asumo que usas Noble para PostgreSQL
const { v2: cloudinary } = require('cloudinary');
const formidable = require('formidable'); // Para procesar FormData

const carGarageRouter = Router();

// ====================================================================
// FUNCIONES AUXILIARES
// ====================================================================

/**
 * Función para parsear el cuerpo multipart (archivos y campos)
 * @param {object} req - Objeto de solicitud de Express
 */
function parseMultipart(req) {
    return new Promise((resolve, reject) => {
        // Configuramos formidable
        const form = formidable({
            multiples: false,
            maxFileSize: 10 * 1024 * 1024, // Límite de 10MB
            // Puedes configurar la ruta temporal si es necesario, pero el valor por defecto es OK
        });

        // Parseamos la solicitud
        form.parse(req, (err, fields, files) => {
            if (err) {
                console.error("Error parsing form data:", err);
                return reject(err);
            }

            // Formidable devuelve campos y archivos como arrays, los convertimos a un solo valor
            const singleFields = Object.fromEntries(
                Object.entries(fields).map(([key, value]) => [key, value[0]])
            );

            // El archivo subido estará en files.imageFile
            const imageFile = files.imageFile ? files.imageFile[0] : null;

            resolve({ fields: singleFields, file: imageFile });
        });
    });
}

// ====================================================================
// ENDPOINTS DEL ROUTER
// ====================================================================

/**
 * [GET] Obtiene coches (por user_id o por id individual)
 * Ruta: /api/carGarage?user_id=X o /api/carGarage?id=X
 */
carGarageRouter.get('/', async (req, res) => {
    const { user_id, id } = req.query;

    try {
        if (id) {
            const result = await noble.query("SELECT id, user_id, car_name, model, year, description, photo_url FROM car_garage WHERE id = $1", [id]);
            return res.status(200).json({ ok: true, car: result.rows[0] });
        }

        if (!user_id) {
            return res.status(400).json({ ok: false, msg: "Falta user_id." });
        }

        const result = await noble.query(
            "SELECT id, user_id, car_name, model, year, description, photo_url FROM car_garage WHERE user_id = $1 ORDER BY id DESC",
            [user_id]
        );

        return res.status(200).json({ ok: true, cars: result.rows });

    } catch (error) {
        console.error("Error en GET /api/carGarage:", error);
        return res.status(500).json({ ok: false, msg: 'Error interno al listar coches.' });
    }
});


/**
 * [POST/PUT] Añade o Actualiza un coche (con manejo de archivo)
 * Rutas: POST /api/carGarage (Añadir), PUT /api/carGarage?id=X (Editar)
 */
carGarageRouter.post('/', handleCarPostOrPut);
carGarageRouter.put('/', handleCarPostOrPut);

async function handleCarPostOrPut(req, res) {
    const { method } = req;

    try {
        // 1. Parsear FormData
        const { fields, file } = await parseMultipart(req);

        // 2. Extraer campos
        const { user_id, car_name, model, year, description, photoURL, id } = fields;
        const carId = id || req.query.id; // Puede venir en el cuerpo (fields) o en la URL (query)

        // 3. Validación
        if (!car_name) return res.status(400).json({ ok: false, msg: "Falta el nombre del coche." });
        if (!user_id && method === "POST") return res.status(400).json({ ok: false, msg: "Falta user_id." });
        if (!carId && method === "PUT") return res.status(400).json({ ok: false, msg: "Falta id del coche para actualizar." });


        let finalPhotoUrl = photoURL || null; // URL existente por defecto

        // 4. Procesar la imagen
        if (file && file.size > 0) {
            // Hay un nuevo archivo subido
            try {
                const uploadResponse = await cloudinary.uploader.upload(file.filepath, {
                    folder: "motor_libre_competicion_car_garage",
                    resource_type: "auto",
                });
                finalPhotoUrl = uploadResponse.secure_url;
            } catch (cloudinaryError) {
                console.error("Cloudinary Upload Error:", cloudinaryError);
                return res.status(500).json({ ok: false, msg: `Error al subir la imagen. Revisa las credenciales de Cloudinary.` });
            }
        } else if (method === "PUT" && photoURL === '') {
            // Es una actualización y el cliente vació la URL (quitar imagen)
            finalPhotoUrl = null;
        }

        // 5. Ejecutar consulta a la BD
        let query, values;
        if (method === "POST") {
            // AGREGAR COCHE
            query = `
                INSERT INTO car_garage (user_id, car_name, model, year, description, photo_url, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, NOW())
                RETURNING *;
            `;
            values = [user_id, car_name, model, year, description, finalPhotoUrl];
        } else {
            // EDITAR COCHE (PUT)
            query = `
                UPDATE car_garage
                SET car_name = $1, model = $2, year = $3, description = $4, photo_url = $5
                WHERE id = $6
                RETURNING *;
            `;
            values = [car_name, model, year, description, finalPhotoUrl, carId];
        }

        const result = await noble.query(query, values);

        if (result.rowCount === 0 && method === 'PUT') {
            return res.status(404).json({ ok: false, msg: "Coche no encontrado para actualizar." });
        }

        return res.status(200).json({ ok: true, msg: `Coche ${method === 'POST' ? 'añadido' : 'actualizado'}`, car: result.rows[0] });

    } catch (err) {
        console.error("Error en POST/PUT /api/carGarage:", err);
        // Si el error es de Formidable, suele ser un error 413 (Payload Too Large)
        return res.status(500).json({ ok: false, msg: 'Error procesando la solicitud. Ver logs del servidor.' });
    }
}


/**
 * [DELETE] Elimina un coche
 * Ruta: /api/carGarage?id=X
 */
carGarageRouter.delete('/', async (req, res) => {
    const { id } = req.query;

    if (!id) {
        return res.status(400).json({ ok: false, msg: "Falta id del coche." });
    }

    try {
        const result = await noble.query("DELETE FROM car_garage WHERE id = $1 RETURNING id", [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ ok: false, msg: "Coche no encontrado." });
        }

        return res.status(200).json({ ok: true, msg: "Coche eliminado con éxito." });
    } catch (error) {
        console.error("Error en DELETE /api/carGarage:", error);
        return res.status(500).json({ ok: false, msg: 'Error interno al eliminar coche.' });
    }
});


// Exportar el router
module.exports = carGarageRouter;