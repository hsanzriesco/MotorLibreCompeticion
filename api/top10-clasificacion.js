// api/top10-clasificacion.js
import { Pool } from "pg";

// Dominio permitido para acceder a esta API (TU FRONTEND)
const ALLOWED_ORIGIN = 'https://motor-libre-competicion.vercel.app';

// Configuración de la conexión a la DB
// El pool se inicializa automáticamente al cargar el módulo
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

export default async function handler(req, res) {
    let client;

    // ===============================================
    // LÓGICA DE CORS (Permite acceso desde tu frontend)
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

        // 🚀 CONSULTA CORREGIDA: Obtiene los 10 mejores resultados de vuelta rápida/posición
        // 1. Usa JOIN para vincular event_results (er) con users (u) y obtener u.name.
        // 2. Renombra u.name a 'user' para que el frontend lo reconozca.
        const result = await client.query(
            `WITH UserBestResults AS (
                SELECT 
                    er.user_id,
                    u.name AS user, -- 🔑 Clave: Obtenemos el nombre y lo llamamos 'user'
                    er.position,
                    er.best_lap_time,
                    -- RANKING DE RESULTADOS INDIVIDUALES: 
                    -- Seleccionamos solo el mejor resultado (posición más baja, tiempo de vuelta más rápido)
                    ROW_NUMBER() OVER (
                        PARTITION BY er.user_id 
                        ORDER BY er.position ASC, er.best_lap_time ASC
                    ) as rn
                FROM 
                    event_results er
                JOIN
                    users u ON er.user_id = u.id -- 🔑 Clave: JOIN con la tabla de usuarios
            )
            SELECT 
                user, -- El nombre del usuario
                position, 
                best_lap_time,
                -- RANKING FINAL GLOBAL
                RANK() OVER (ORDER BY position ASC, best_lap_time ASC) AS rank
            FROM 
                UserBestResults
            WHERE
                rn = 1 -- Solo el mejor resultado de cada usuario
            ORDER BY 
                position ASC, 
                best_lap_time ASC 
            LIMIT 10`
        );

        // Devolvemos DIRECTAMENTE el array de resultados
        return res.status(200).json(result.rows);

    } catch (error) {
        console.error("Error al cargar el Top 10:", error);

        let errorMessage = 'Error interno del servidor.';
        
        // 🚨 Manejo de error específico (si la tabla users o event_results falta)
        if (error.code === '42P01') {
            errorMessage = `Error de Base de Datos: Una tabla requerida (users o event_results) no existe o no tiene datos válidos. Revise su esquema.`;
        } else if (error.code === '42703') {
            // Este es el error "column 'user' does not exist"
            errorMessage = `Error de Columna: La columna que intenta leer no existe. Asegúrese de que el JOIN con la tabla 'users' es correcto. (El error original se debe a que 'user' no está en 'event_results', pero ya lo corregimos con el JOIN).`;
        }

        return res.status(500).json({ success: false, message: errorMessage });
    } finally {
        if (client) {
            client.release();
        }
    }
}