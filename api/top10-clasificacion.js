// api/top10-clasificacion.js
import { Pool } from "pg";

// 1. Configuración de la conexión a la DB
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

// Dominio permitido para acceder a esta API (TU FRONTEND)
const ALLOWED_ORIGIN = 'https://motor-libre-competicion.vercel.app';

export default async function handler(req, res) {
    let client;

    // ===============================================
    // 🛑 LÓGICA DE CORS MANUAL (Solución al error) 🛑
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


    // Aseguramos que solo se procesen solicitudes GET
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET', 'OPTIONS']);
        return res.status(405).json({ success: false, message: `Método ${req.method} no permitido.` });
    }

    try {
        client = await pool.connect();

        // 🚀 CONSULTA PARA OBTENER EL TOP 10
        // **IMPORTANTE:** Debes reemplazar 'nombre_de_tu_tabla_resultados', 'score_column', y 'tiempo_column' 
        // por los nombres reales de tu base de datos.
        const result = await client.query(
            `SELECT 
                user_name, 
                score_column AS score, 
                tiempo_column AS tiempo,
                RANK() OVER (ORDER BY score_column DESC, tiempo_column ASC) AS rank
            FROM 
                nombre_de_tu_tabla_resultados 
            ORDER BY 
                score_column DESC, 
                tiempo_column ASC 
            LIMIT 10`
        );

        // Envía el Top 10 al frontend
        return res.status(200).json({ success: true, data: result.rows });

    } catch (error) {
        console.error("Error al cargar el Top 10:", error);
        return res.status(500).json({ success: false, message: "Error interno del servidor al obtener el Top 10." });
    } finally {
        if (client) {
            client.release();
        }
    }
}