// API/top10-clasificacion.js

import { Pool } from "pg";

// Nota: No necesitamos formidable ni cloudinary aquí, ya que solo manejaremos JSON/GET

// ===============================================
// FUNCIÓN AUXILIAR PARA PARSEAR JSON
// ===============================================
// (Necesaria para manejar POST/PUT/DELETE si no usamos bodyParser)
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

// Para la ruta GET (Top 10), el bodyParser NO está desactivado, 
// pero seguiremos el patrón de tu archivo de ejemplo para asegurar compatibilidad.

export default async function handler(req, res) {
    const { action } = req.query; // action se usará para la gestión (e.g., 'delete', 'update')
    let pool;
    let client;

    // 1. VERIFICACIÓN DE ENTORNO
    if (!process.env.DATABASE_URL) {
        console.error("FATAL ERROR: Falta la variable de entorno DATABASE_URL.");
        return res.status(500).json({
            success: false,
            message: "Error de configuración: Falta la variable de entorno DATABASE_URL.",
        });
    }

    try {
        // Inicialización de Pool y conexión a DB
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false },
        });
        client = await pool.connect();

        // ===============================================
        // MANEJADOR GET: Obtener el Top 10 (Usado por index.html)
        // ===============================================
        if (req.method === "GET" && !action) {
            
            // ⚠️ IMPORTANTE: Esta consulta asume que las tablas 'event_results' y 'users' existen.
            const query = `
                SELECT
                    u.name AS nombre,          -- Nombre del Piloto/Usuario
                    u.categoria,               -- Categoría (si está en la tabla users)
                    SUM(er.points) AS puntos,
                    ROW_NUMBER() OVER (ORDER BY SUM(er.points) DESC) as puesto
                FROM
                    event_results er
                JOIN
                    users u ON er.user_id = u.id 
                GROUP BY
                    u.id, u.name, u.categoria
                ORDER BY
                    puntos DESC
                LIMIT 10;
            `;

            const result = await client.query(query);
            
            // Retorna un array plano de resultados
            return res.status(200).json(result.rows); 
        }

        // ===============================================
        // MANEJADOR GET: Obtener todos los resultados (Usado por admin.html)
        // ===============================================
        if (req.method === "GET" && action === 'listAll') {
             // Esta consulta lista todos los resultados de eventos para el panel de administración
            const query = `
                SELECT
                    er.result_id AS id,
                    e.title AS evento_nombre,
                    u.name AS piloto_nombre,
                    er.position,
                    er.points,
                    er.best_lap_time
                FROM
                    event_results er
                JOIN users u ON er.user_id = u.id
                JOIN events e ON er.event_id = e.id
                ORDER BY e.fecha DESC, er.position ASC;
            `;

            const result = await client.query(query);
            return res.status(200).json({ success: true, data: result.rows });
        }
        
        // ===============================================
        // MANEJADOR POST: Crear Nuevo Resultado (Usado por admin.html)
        // ===============================================
        if (req.method === "POST" && action === 'create') {
            const jsonBody = await readJsonBody(req);
            const { event_id, user_id, position, points, time } = jsonBody;

            if (!event_id || !user_id || !position || points === undefined) {
                return res.status(400).json({ success: false, message: "Faltan campos obligatorios (evento, piloto, posición o puntos)." });
            }
            
            // Verificar si el resultado ya existe (UNIQUE constraint)
            const check = await client.query(
                `SELECT result_id FROM event_results WHERE event_id = $1 AND user_id = $2`,
                [event_id, user_id]
            );

            if (check.rows.length > 0) {
                return res.status(409).json({ success: false, message: "Ya existe un resultado registrado para este piloto en este evento." });
            }

            const result = await client.query(
                `INSERT INTO event_results (event_id, user_id, position, points, best_lap_time) VALUES ($1, $2, $3, $4, $5) RETURNING result_id`,
                [event_id, user_id, parseInt(position), parseInt(points), time]
            );

            return res.status(201).json({ success: true, message: "Resultado creado exitosamente.", id: result.rows[0].result_id });
        }


        // ===============================================
        // MANEJADOR PUT: Actualizar Resultado
        // ===============================================
        if (req.method === "PUT" && action === 'update') {
             const { result_id } = req.query; // Asume que el ID viene en la URL
             if (!result_id) return res.status(400).json({ success: false, message: "Falta el ID del resultado a actualizar." });

             const jsonBody = await readJsonBody(req);
             const { event_id, user_id, position, points, time } = jsonBody;

             const result = await client.query(
                 `UPDATE event_results SET event_id = $1, user_id = $2, position = $3, points = $4, best_lap_time = $5 WHERE result_id = $6 RETURNING result_id`,
                 [event_id, user_id, parseInt(position), parseInt(points), time, result_id]
             );

             if (result.rows.length === 0) return res.status(404).json({ success: false, message: "Resultado no encontrado." });
             return res.status(200).json({ success: true, message: "Resultado actualizado exitosamente." });
        }

        // ===============================================
        // MANEJADOR DELETE: Eliminar Resultado
        // ===============================================
        if (req.method === "DELETE" && action === 'delete') {
            const { result_id } = req.query; // Asume que el ID viene en la URL
            if (!result_id) return res.status(400).json({ success: false, message: "Falta el ID del resultado a eliminar." });

            const result = await client.query(
                `DELETE FROM event_results WHERE result_id = $1 RETURNING result_id`,
                [result_id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, message: "Resultado no encontrado para eliminar." });
            }
            return res.status(200).json({ success: true, message: "Resultado eliminado correctamente." });
        }


        // ===============================================
        // MÉTODO/ACCIÓN NO PERMITIDO
        // ===============================================
        res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
        return res.status(405).json({ success: false, message: `Método ${req.method} o acción no permitida.` });


    } catch (error) {
        console.error("Error general en /api/top10-clasificacion:", error);
        
        let errorMessage = 'Error interno del servidor.';
        
        // Manejo de errores específicos (similar a tu archivo de ejemplo)
        if (error.code === '23505') {
            errorMessage = 'Error: Ya existe un resultado para este piloto en este evento.';
        } else if (error.code === '23503') {
             errorMessage = 'Error: El ID del piloto o evento no existe en la base de datos.';
        } else if (error.code === '42P01') {
            errorMessage = 'Error: Faltan tablas clave (users, events, event_results).';
        }

        return res.status(500).json({ success: false, message: errorMessage });
    } finally {
        if (client) {
            client.release();
        }
    }
}