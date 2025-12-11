import { Pool } from "pg";
import pg from 'pg'; // Importación necesaria para configurar el parser de tipos
import { v2 as cloudinary } from 'cloudinary';
import formidable from 'formidable';

export const config = {
    api: {
        bodyParser: false,
    },
};


pg.types.setTypeParser(1114, function (stringValue) {
    return stringValue;
});


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

           
            const singleFields = Object.fromEntries(
                Object.entries(fields).map(([key, value]) => [key, value[0]])
            );

            resolve({ fields: singleFields, files });
        });
    });
}


function toSqlDateTimeLocal(dateString) {
    const date = new Date(dateString);

    if (isNaN(date.getTime())) {
        console.error("Fecha inválida recibida:", dateString);
        return dateString;
    }

    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

   
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}




export default async function handler(req, res) {
    const { id, action } = req.query;
    let pool;
    let client;

   
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
       
        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET,
        });

    
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false },
        });
        client = await pool.connect();

       
        if (req.method === "GET") {

           
            if (action === 'getAllEventsList') {
                const result = await client.query(
                    `SELECT id, title FROM events ORDER BY event_start DESC`
                );
                return res.status(200).json({ success: true, data: result.rows });
            }

     
            if (action === 'getAllUsersList') {
                const result = await client.query(
                    `SELECT id, name FROM users ORDER BY name ASC`
                );
                return res.status(200).json({ success: true, data: result.rows });
            }

           
            if (!action) {
                const result = await client.query(
                   
                    `SELECT id, title, description, location, event_start AS start, event_end AS "end", image_url, capacidad_max AS capacity FROM events ORDER BY start ASC`
                );
                return res.status(200).json({ success: true, data: result.rows });
            }

         
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

           
            if (action === 'getRegistrationCount') {
                const { event_id } = req.query;

                if (!event_id) {
                    return res.status(400).json({ success: false, message: "Falta el ID del evento para obtener el conteo de inscritos." });
                }

                const parsedEventId = parseInt(event_id);
                if (isNaN(parsedEventId)) {
                    return res.status(400).json({ success: false, message: "El ID del evento debe ser un número válido." });
                }

               
                const result = await client.query(
                    `SELECT COUNT(id) AS count FROM event_registrations WHERE event_id = $1`,
                    [parsedEventId]
                );

                const count = parseInt(result.rows[0].count, 10);

                return res.status(200).json({
                    success: true,
                    count: count
                });
            }


           
            if (action === 'getRegistrations') {
                const { event_id } = req.query;

                if (!event_id) {
                    return res.status(400).json({ success: false, message: "Falta el ID del evento para obtener los inscritos." });
                }

                const parsedEventId = parseInt(event_id);
                if (isNaN(parsedEventId)) {
                    return res.status(400).json({ success: false, message: "El ID del evento debe ser un número válido." });
                }

          
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

       
        if (req.method === "POST") {

           
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

               
                const existenceAndStatusCheck = await client.query(
                    `SELECT 
                        id 
                     FROM 
                        events 
                     WHERE 
                        id = $1 
                        AND event_end > NOW()`, 
                    [parsedEventId]
                );

                if (existenceAndStatusCheck.rows.length === 0) {
                    

                    const simpleExistenceCheck = await client.query(
                        `SELECT id FROM events WHERE id = $1`,
                        [parsedEventId]
                    );

                    if (simpleExistenceCheck.rows.length === 0) {
                        return res.status(404).json({ success: false, message: "Evento no encontrado." });
                    } else {
                        return res.status(403).json({ success: false, message: "No es posible inscribirse. El evento ya ha finalizado y está cerrado." });
                    }
                }
                
                const check = await client.query(
                    `SELECT id FROM event_registrations WHERE user_id = $1 AND event_id = $2`,
                    [parsedUserId, parsedEventId]
                );

                if (check.rows.length > 0) {
                    return res.status(409).json({ success: false, message: "Ya estás inscrito en este evento." });
                }

               
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
                    const maxCapacity = parseInt(capacidad_max) || 0;
                    const currentRegistrations = parseInt(num_inscritos) || 0;

                    if (maxCapacity > 0 && currentRegistrations >= maxCapacity) {
                        return res.status(403).json({ success: false, message: "Aforo completo. No se puede realizar la inscripción." });
                    }
                }

               
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
                    return res.status(404).json({ success: false, message: 'Usuario o evento no encontrado para obtener los nombres.' });
                }

                const { user_name, event_title } = dataResult.rows[0];


               
                const result = await client.query(
                    `INSERT INTO event_registrations (user_id, event_id, usuario_inscrito, nombre_evento, registered_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING id`,
                    [parsedUserId, parsedEventId, user_name, event_title]
                );

                return res.status(201).json({ success: true, message: "Inscripción al evento exitosa.", registrationId: result.rows[0].id });
            }

          
            if (!action) {
                const { fields, files } = await parseMultipart(req);

                const { title, description, location, start, end, imageURL, capacity } = fields;
                const file = files.imageFile?.[0];

                if (!title || !start || !end) {
                    return res.status(400).json({
                        success: false,
                        message: "Faltan campos obligatorios (título, inicio, fin).",
                    });
                }

                
                const eventStartLocal = toSqlDateTimeLocal(start);
                const eventEndLocal = toSqlDateTimeLocal(end);

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
                    [title, description, location, eventStartLocal, eventEndLocal, finalImageUrl, parsedCapacidadMax]
                );
                return res.status(201).json({ success: true, data: result.rows[0] });
            }
        }

       
        if (req.method === "PUT") {

          
            const { fields, files } = await parseMultipart(req);

            const { title, description, location, start, end, imageURL, capacity } = fields;
            const file = files.imageFile?.[0];

            if (!title || !start || !end) {
                return res.status(400).json({
                    success: false,
                    message: "Faltan campos obligatorios (título, inicio, fin).",
                });
            }

           
            const eventStartLocal = toSqlDateTimeLocal(start);
            const eventEndLocal = toSqlDateTimeLocal(end);

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
                [title, description, location, eventStartLocal, eventEndLocal, finalImageUrl, parsedCapacidadMax, id]
            );

            if (result.rows.length === 0) return res.status(404).json({ success: false, message: "Evento no encontrado." });
            return res.status(200).json({ success: true, data: result.rows[0] });
        }

        
        if (req.method === "DELETE") {

         
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

         
            if (!id) return res.status(400).json({ success: false, message: "Falta el ID del evento." });

            
            await client.query("DELETE FROM event_registrations WHERE event_id = $1", [id]);

      
            const deleteResult = await client.query("DELETE FROM events WHERE id = $1 RETURNING id", [id]);

            if (deleteResult.rows.length === 0) return res.status(404).json({ success: false, message: "Evento no encontrado para eliminar." });

            return res.status(200).json({ success: true, message: "Evento y sus inscripciones relacionadas eliminados correctamente." });
        }


        res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
        return res.status(405).json({ success: false, message: `Método ${req.method} no permitido.` });

    } catch (error) {
        console.error("Error general en /api/events:", error);

        let errorMessage = 'Error interno del servidor.';

       
        if (error.code === '42703' && error.message.includes('user')) {
            errorMessage = 'Error de Base de Datos: Columna "user" no encontrada.';
        } else if (error.code === '22P02') {
            errorMessage = 'Error de Base de Datos: Valor de ID o dato numérico inválido.';
        } else if (error.message.includes('Error al parsear el cuerpo JSON')) {
            errorMessage = 'Error de formato de datos (JSON) en la solicitud.';
        } else if (error.code === '22007') {
            errorMessage = 'Error de formato de fecha/hora o ID inválido al intentar guardar en la DB.';
        } else if (error.code === '23505') {
            errorMessage = 'Error: Ya existe un registro similar en la base de datos (posiblemente ya inscrito).';
        } else if (error.code === '42601') {
            errorMessage = 'Error de sintaxis SQL.';
        } else if (error.code === '42P01') {
            errorMessage = `Error: La tabla requerida no existe.`;
        } else if (error.message.includes('ECONNREFUSED')) {
            errorMessage = 'Error de conexión a la base de datos.';
        }


        return res.status(500).json({ success: false, message: errorMessage });
    } finally {
        if (client) {
            client.release();
        }
    }
}
