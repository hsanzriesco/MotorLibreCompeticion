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
                // Captura el error específico 'Unexpected end of JSON input' o cualquier otro error de parseo
                reject(new Error("Error al parsear el cuerpo JSON de la solicitud."));
            }
        });
    });
}

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

            // formidable devuelve arrays, los convertimos a valores únicos
            const singleFields = Object.fromEntries(
                Object.entries(fields).map(([key, value]) => [key, value[0]])
            );

            // Nota: files.imageFile es un array o undefined. Lo usaremos como files.imageFile?.[0]
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

            // Obtener lista simple de todos los EVENTOS (ID y Título)
            if (action === 'getAllEventsList') {
                const result = await client.query(
                    `SELECT id, title FROM events ORDER BY event_start DESC`
                );
                return res.status(200).json({ success: true, data: result.rows });
            }

            // Obtener lista simple de todos los USUARIOS (ID y Nombre)
            if (action === 'getAllUsersList') {
                const result = await client.query(
                    `SELECT id, name FROM users ORDER BY name ASC`
                );
                return res.status(200).json({ success: true, data: result.rows });
            }

            // GET: Cargar todos los eventos
            if (!action) {
                const result = await client.query(
                    // Se incluye la capacidad_max en la consulta principal
                    `SELECT id, title, description, location, event_start AS start, event_end AS "end", image_url, capacidad_max AS capacity FROM events ORDER BY start ASC`
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
                    `SELECT id FROM event_registrations WHERE user_id = $1 AND event_id = $2`,
                    [user_id, event_id]
                );

                return res.status(200).json({ success: true, isRegistered: result.rows.length > 0 });
            }

            // GET: Obtener solo el CONTEO de inscritos para un evento
            if (action === 'getRegistrationCount') {
                const { event_id } = req.query;

                if (!event_id) {
                    return res.status(400).json({ success: false, message: "Falta el ID del evento para obtener el conteo de inscritos." });
                }

                const parsedEventId = parseInt(event_id);
                if (isNaN(parsedEventId)) {
                    return res.status(400).json({ success: false, message: "El ID del evento debe ser un número válido." });
                }

                // Consulta eficiente para obtener SOLO el conteo
                const result = await client.query(
                    `SELECT COUNT(id) AS count FROM event_registrations WHERE event_id = $1`,
                    [parsedEventId]
                );

                const count = parseInt(result.rows[0].count, 10);

                return res.status(200).json({
                    success: true,
                    count: count // Renombramos a 'count' para que coincida con el frontend
                });
            }


            // GET: Obtener lista de inscritos para un evento
            if (action === 'getRegistrations') {
                const { event_id } = req.query;

                if (!event_id) {
                    return res.status(400).json({ success: false, message: "Falta el ID del evento para obtener los inscritos." });
                }

                const parsedEventId = parseInt(event_id);
                if (isNaN(parsedEventId)) {
                    return res.status(400).json({ success: false, message: "El ID del evento debe ser un número válido." });
                }

                // Se selecciona la información relevante para el administrador
                const result = await client.query(
                    `SELECT id, user_id, usuario_inscrito, registered_at FROM event_registrations WHERE event_id = $1 ORDER BY registered_at ASC`,
                    [parsedEventId]
                );

                return res.status(200).json({
                    success: true,
                    data: result.rows,
                    totalRegistrations: result.rows.length
                });
            }
        }

        // ===============================================
        // MANEJADOR POST
        // ===============================================
        if (req.method === "POST") {

            // POST: Registrar inscripción 
            if (action === 'register') {
                const jsonBody = await readJsonBody(req);
                const { user_id, event_id } = jsonBody;

                if (!user_id || !event_id) {
                    return res.status(400).json({ success: false, message: "Faltan IDs de usuario o evento." });
                }

                const parsedUserId = parseInt(user_id);
                const parsedEventId = parseInt(event_id);

                if (isNaN(parsedUserId) || isNaN(parsedEventId)) {
                    return res.status(400).json({ success: false, message: "Los IDs de usuario o evento deben ser números válidos." });
                }

                // --------------------------------------------------------------------------------------------------------
                // ⭐ VERIFICACIÓN DE FINALIZACIÓN: Usando la tabla de auditoría 'evento_finalizado'
                // --------------------------------------------------------------------------------------------------------
                const finalizadoCheck = await client.query(
                    `SELECT event_id FROM evento_finalizado WHERE event_id = $1`,
                    [parsedEventId]
                );

                if (finalizadoCheck.rows.length > 0) {
                    // El evento ha sido marcado como finalizado por el Cron Job
                    return res.status(403).json({ success: false, message: "No es posible inscribirse. El evento ya ha finalizado y está cerrado." });
                }
                // --------------------------------------------------------------------------------------------------------

                // Verificación de existencia del evento (necesario si no está en finalizados ni en inscripciones)
                const existenceCheck = await client.query(
                    `SELECT id FROM events WHERE id = $1`,
                    [parsedEventId]
                );

                if (existenceCheck.rows.length === 0) {
                    // 404 si el evento no existe
                    return res.status(404).json({ success: false, message: "Evento no encontrado." });
                }
                // FIN DE VERIFICACIÓN DE EXISTENCIA

                // 2. Verificar si ya está inscrito
                const check = await client.query(
                    `SELECT id FROM event_registrations WHERE user_id = $1 AND event_id = $2`,
                    [parsedUserId, parsedEventId]
                );

                if (check.rows.length > 0) {
                    return res.status(409).json({ success: false, message: "Ya estás inscrito en este evento." });
                }

                // 3. Verificar si quedan cupos (capacidad_max > num_inscritos)
                const capacityCheck = await client.query(`
                    SELECT 
                        e.capacidad_max, 
                        COUNT(r.id) AS num_inscritos 
                    FROM events e 
                    LEFT JOIN event_registrations r ON e.id = r.event_id 
                    WHERE e.id = $1 
                    GROUP BY e.id
                `, [parsedEventId]);

                if (capacityCheck.rows.length > 0) {
                    const { capacidad_max, num_inscritos } = capacityCheck.rows[0];
                    // Convertir a entero. Si es NULL o 0, el aforo es ilimitado
                    const maxCapacity = parseInt(capacidad_max) || 0;
                    const currentRegistrations = parseInt(num_inscritos) || 0;

                    if (maxCapacity > 0 && currentRegistrations >= maxCapacity) {
                        return res.status(403).json({ success: false, message: "Aforo completo. No se puede realizar la inscripción." });
                    }
                }

                // 4. Obtener solo el nombre del usuario y el título del evento
                const dataQuery = `
                    SELECT
                        u.name AS user_name,
                        e.title AS event_title
                    FROM
                        users u,
                        events e
                    WHERE
                        u.id = $1 AND e.id = $2;
                `;

                const dataResult = await client.query(dataQuery, [parsedUserId, parsedEventId]);

                if (dataResult.rows.length === 0) {
                    // Este caso no debería ocurrir si existenceCheck pasó, pero lo mantenemos por seguridad
                    return res.status(404).json({ success: false, message: 'Usuario o evento no encontrado para obtener los nombres.' });
                }

                const { user_name, event_title } = dataResult.rows[0];


                // 5. Insertar inscripción SOLO con el nombre
                const result = await client.query(
                    `INSERT INTO event_registrations (user_id, event_id, usuario_inscrito, nombre_evento, registered_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING id`,
                    [parsedUserId, parsedEventId, user_name, event_title]
                );

                return res.status(201).json({ success: true, message: "Inscripción al evento exitosa.", registrationId: result.rows[0].id });
            }

            // POST: Crear evento 
            if (!action) {
                const { fields, files } = await parseMultipart(req);

                // Se incluye capacidad_max
                const { title, description, location, start, end, imageURL, capacity } = fields;
                const file = files.imageFile?.[0];

                if (!title || !start || !end) {
                    return res.status(400).json({
                        success: false,
                        message: "Faltan campos obligatorios (título, inicio, fin).",
                    });
                }

                // Usamos 'capacity' del frontend y lo mapeamos a 'capacidad_max' en la DB
                const parsedCapacidadMax = parseInt(capacity) || 0;


                let finalImageUrl = imageURL || null;

                if (file && file.size > 0) {
                    const uploadResponse = await cloudinary.uploader.upload(file.filepath, {
                        folder: "motor_libre_competicion_events",
                        resource_type: "auto",
                    });
                    finalImageUrl = uploadResponse.secure_url;
                }

                const result = await client.query(
                    `INSERT INTO events (title, description, location, event_start, event_end, image_url, capacidad_max) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
                    [title, description, location, start, end, finalImageUrl, parsedCapacidadMax]
                );
                return res.status(201).json({ success: true, data: result.rows[0] });
            }
        }

        // ===============================================
        // MANEJADOR PUT 
        // ===============================================
        if (req.method === "PUT") {

            // PUT: Editar evento 
            const { fields, files } = await parseMultipart(req);

            // Se incluye capacity
            const { title, description, location, start, end, imageURL, capacity } = fields;
            const file = files.imageFile?.[0];

            if (!title || !start || !end) {
                return res.status(400).json({
                    success: false,
                    message: "Faltan campos obligatorios (título, inicio, fin).",
                });
            }

            // Usamos 'capacity' del frontend y lo mapeamos a 'capacidad_max' en la DB
            const parsedCapacidadMax = parseInt(capacity) || 0;

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
                `UPDATE events SET title = $1, description = $2, location = $3, event_start = $4, event_end = $5, image_url = $6, capacidad_max = $7 WHERE id = $8 RETURNING *`,
                [title, description, location, start, end, finalImageUrl, parsedCapacidadMax, id]
            );

            if (result.rows.length === 0) return res.status(404).json({ success: false, message: "Evento no encontrado." });
            return res.status(200).json({ success: true, data: result.rows[0] });
        }

        // ===============================================
        // MANEJADOR DELETE 
        // ===============================================
        if (req.method === "DELETE") {

            // Cancelar inscripción
            if (action === 'cancel') {
                const { user_id, event_id } = req.query;

                if (!user_id || !event_id) {
                    return res.status(400).json({ success: false, message: "Faltan IDs de usuario o evento para la cancelación." });
                }

                const result = await client.query(
                    `DELETE FROM event_registrations WHERE user_id = $1 AND event_id = $2 RETURNING id`,
                    [parseInt(user_id), parseInt(event_id)]
                );

                if (result.rows.length === 0) {
                    return res.status(404).json({ success: false, message: "No se encontró la inscripción para cancelar." });
                }

                return res.status(200).json({ success: true, message: "Inscripción cancelada correctamente." });
            }

            // Eliminar evento
            if (!id) return res.status(400).json({ success: false, message: "Falta el ID del evento." });

            // Eliminar inscripciones relacionadas antes de eliminar el evento
            await client.query("DELETE FROM event_registrations WHERE event_id = $1", [id]);

            // Eliminar el evento
            const deleteResult = await client.query("DELETE FROM events WHERE id = $1 RETURNING id", [id]);

            if (deleteResult.rows.length === 0) return res.status(404).json({ success: false, message: "Evento no encontrado para eliminar." });

            return res.status(200).json({ success: true, message: "Evento y sus inscripciones relacionadas eliminados correctamente." });
        }

        // ===============================================
        // MÉTODO NO PERMITIDO
        // ===============================================
        res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
        return res.status(405).json({ success: false, message: `Método ${req.method} no permitido.` });

    } catch (error) {
        console.error("Error general en /api/events:", error);

        let errorMessage = 'Error interno del servidor.';

        // Manejo de errores de PostgreSQL más específicos
        if (error.code === '42703' && error.message.includes('user')) {
            errorMessage = 'Error de Base de Datos: Columna "user" no encontrada. Por favor, asegúrese de que la base de datos esté sincronizada y si no es necesaria, revise la consulta.';
        } else if (error.code === '22P02') {
            errorMessage = 'Error de Base de Datos: Valor de ID o dato numérico inválido. Asegúrese de que todos los números sean válidos y que los campos obligatorios no estén vacíos.';
        } else if (error.message.includes('Error al parsear el cuerpo JSON')) {
            errorMessage = 'Error de formato de datos (JSON) en la solicitud.';
        } else if (error.message.includes('Cloudinary Upload Failed')) {
            errorMessage = `Error al subir la imagen: ${error.message}`;
        } else if (error.message.includes('Cloudinary')) {
            errorMessage = 'Error de autenticación de Cloudinary. Revisa tus credenciales.';
        } else if (error.message.includes('ECONNREFUSED') || error.message.includes('timeout')) {
            errorMessage = 'Error de conexión a la base de datos o timeout. Revisa la DATABASE_URL.';
        } else if (error.code === '22007') {
            errorMessage = 'Error de formato de fecha/hora o ID inválido al intentar guardar en la DB.';
        } else if (error.code === '23505') {
            errorMessage = 'Error: Ya existe un registro similar en la base de datos (posiblemente ya inscrito).';
        } else if (error.code === '42601') {
            // Este es el error de sintaxis SQL que estamos debuggeando
            errorMessage = 'Error de sintaxis SQL. Revise que las tablas y sus columnas existan y estén escritas correctamente.';
        } else if (error.code === '42P01') {
            // Este es el error de tabla inexistente
            errorMessage = `Error: La tabla requerida (${error.message.match(/"(.*?)"/) ? error.message.match(/"(.*?)"/)[1] : 'desconocida'}) no existe en la base de datos.`;
        }


        return res.status(500).json({ success: false, message: errorMessage });
    } finally {
        if (client) {
            client.release();
        }
    }
}