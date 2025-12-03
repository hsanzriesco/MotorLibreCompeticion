// api/top10-clasificacion.js
import { Pool } from "pg";

// Dominio permitido para acceder a esta API (TU FRONTEND)
const ALLOWED_ORIGIN = 'https://motor-libre-competicion.vercel.app';

// 1. VERIFICACIÓN DE ENTORNO
if (!process.env.DATABASE_URL) {
    console.error("FATAL ERROR: La variable de entorno DATABASE_URL no está definida.");
    // No podemos inicializar el pool si la URL no existe.
    // El handler fallará con un 500, pero sabremos por qué.
}

// Configuración de la conexión a la DB
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

export default async function handler(req, res) {
    let client;
    
    // ===============================================
    // 🛑 LÓGICA DE CORS MANUAL (Solución al error anterior) 🛑
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
        // Fallará aquí si DATABASE_URL no está configurada o si la DB no responde
        client = await pool.connect();
        
        // 🚀 CONSULTA PARA OBTENER EL TOP 10 (Basada en tu esquema: event_results)
        const result = await client.query(
            `WITH RankedResults AS (
                SELECT 
                    user_id,
                    "user" AS user_name,
                    position,
                    best_lap_time,
                    -- RANKEAR POR USUARIO PARA OBTENER SOLO EL MEJOR RESULTADO
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
                -- RANKEAR GLOBALMENTE PARA EL TOP 10 FINAL
                RANK() OVER (ORDER BY position ASC, best_lap_time ASC) AS rank
            FROM 
                RankedResults
            WHERE
                rn = 1 
            ORDER BY 
                position ASC, 
                best_lap_time ASC 
            LIMIT 10`
        );

        return res.status(200).json({ success: true, data: result.rows });

    } catch (error) {
        // 2. Manejo de Errores Específicos para DB (si falla la consulta o la conexión)
        console.error("Error al cargar el Top 10:", error);

        let errorMessage = 'Error interno del servidor.';
        
        if (error.code === '42P01') {
            errorMessage = `Error de DB: La tabla 'event_results' no existe.`;
        } else if (error.code === '42703' || error.code === '42601') {
             errorMessage = `Error de DB: Falla de sintaxis SQL o columna no encontrada. Revisa 'position', 'best_lap_time' y 'user'.`;
        } else if (error.message.includes('ECONNREFUSED')) {
            errorMessage = 'Error de conexión a la base de datos. Revisa la DATABASE_URL.';
        } else if (!process.env.DATABASE_URL) {
             errorMessage = 'Error de Configuración: Falta la variable DATABASE_URL.';
        }

        // Devolver un 500 con un mensaje más claro
        return res.status(500).json({ success: false, message: errorMessage });
    } finally {
        if (client) {
            client.release();
        }
    }
}