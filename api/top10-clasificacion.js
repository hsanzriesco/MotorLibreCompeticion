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
    // 🛑 LÓGICA DE CORS MANUAL (Solucionado) 🛑
    // ===============================================
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

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

        // 🚀 CONSULTA FINAL CORREGIDA (Resuelve el error de la columna "user")
        const result = await client.query(
            `WITH UserBestResults AS (
                SELECT 
                    er.user_id,
                    u.name AS user_name,
                    er.position,
                    er.best_lap_time,
                    -- Seleccionamos el mejor resultado si un usuario tiene varios
                    ROW_NUMBER() OVER (
                        PARTITION BY er.user_id 
                        ORDER BY er.position ASC, er.best_lap_time ASC
                    ) as rn
                FROM 
                    event_results er
                JOIN
                    users u ON er.user_id = u.id 
            )
            SELECT 
                user_name, 
                position, 
                best_lap_time,
                RANK() OVER (ORDER BY position ASC, best_lap_time ASC) AS rank
            FROM 
                UserBestResults
            WHERE
                rn = 1 
            ORDER BY 
                position ASC, 
                best_lap_time ASC 
            LIMIT 10`
        );

        // ========================================================
        // 🔑 MODIFICACIÓN CLAVE (Resuelve el error .forEach no es una función)
        // Devolvemos DIRECTAMENTE el array de resultados (result.rows)
        // ========================================================
        return res.status(200).json(result.rows);

    } catch (error) {
        // Devolvemos el error original de PostgreSQL si es posible.
        console.error("Error al cargar el Top 10:", error);

        // Si el código de error es '42P01' (tabla no existe), lo mostramos.
        let errorMessage = error.code === '42P01' ?
            `Error de DB: La tabla 'users' no existe o la tabla 'event_results' no tiene datos. Error: ${error.message}` :
            `Error interno del servidor (Revisar logs de Vercel).`;

        return res.status(500).json({ success: false, message: errorMessage });
    } finally {
        if (client) {
            client.release();
        }
    }
}