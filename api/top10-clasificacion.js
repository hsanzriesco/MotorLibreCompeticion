// api/top10-clasificacion.js
import { Pool } from "pg";

// Dominio permitido para acceder a esta API (TU FRONTEND)
const ALLOWED_ORIGIN = 'https://motor-libre-competicion.vercel.app';

// Configuración de la conexión a la DB
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

export default async function handler(req, res) {
    let client;

    // ===============================================
    // 🛑 SOLUCIÓN CORS MANUAL (Sin Paquetes) 🛑
    // ===============================================

    // 1. Establece el encabezado clave que exige tu navegador
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);

    // 2. Define los métodos HTTP permitidos
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // 3. Si la solicitud es un OPTIONS (preflight), terminamos la respuesta
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    // ===============================================


    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET', 'OPTIONS']);
        return res.status(405).json({ success: false, message: `Método ${req.method} no permitido.` });
    }

    try {
        client = await pool.connect();

        // 🚀 CONSULTA PARA OBTENER EL TOP 10 DE LA TABLA event_results
        // La clasificación se basa en la POSICIÓN (menor es mejor)
        // y se desempata por el TIEMPO DE VUELTA (menor es mejor).
        const result = await client.query(
            // Utilizamos DISTINCT ON (user) para obtener la mejor posición/tiempo de cada usuario, 
            // aunque si la tabla solo guarda 1 resultado por evento, no sería necesario.
            // Asumo que quieres la mejor posición global.
            `WITH RankedResults AS (
                SELECT 
                    user_id,
                    "user" AS user_name,
                    position,
                    best_lap_time,
                    ROW_NUMBER() OVER (
                        PARTITION BY user_id 
                        ORDER BY position ASC, best_lap_time ASC
                    ) as rn
                FROM 
                    event_results 
            )
            SELECT 
                user_name, 
                position, 
                best_lap_time,
                RANK() OVER (ORDER BY position ASC, best_lap_time ASC) AS rank
            FROM 
                RankedResults
            WHERE
                rn = 1 -- Obtiene el mejor resultado de cada usuario
            ORDER BY 
                position ASC, 
                best_lap_time ASC 
            LIMIT 10`
        );

        // Envía el Top 10 al frontend
        return res.status(200).json({ success: true, data: result.rows });

    } catch (error) {
        console.error("Error al cargar el Top 10:", error);
        // Si hay un error, el frontend recibirá una respuesta 500
        return res.status(500).json({ success: false, message: "Error interno del servidor al obtener el Top 10." });
    } finally {
        if (client) {
            client.release();
        }
    }
}