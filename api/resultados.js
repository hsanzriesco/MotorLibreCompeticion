// api/resultados.js

import express from 'express';
// 1. Importa 'pg' para la conexión a PostgreSQL
import pkg from 'pg';
// 2. Carga las variables de entorno (como DATABASE_URL)
import 'dotenv/config';

const { Pool } = pkg;
const router = express.Router();

// 3. Configuración y Creación del Pool de Conexiones
const pool = new Pool({
    // Usa la variable de entorno de tu archivo .env
    connectionString: process.env.DATABASE_URL,
    ssl: {
        // Necesario para la conexión segura con Neon
        rejectUnauthorized: false
    }
});

// Nota: Debes cambiar 'module.exports = router;' al final por 'export default router;'
export default router;

// Ruta: /api/resultados
router.get('/', async (req, res) => {
    const action = req.query.action;
    const limit = parseInt(req.query.limit) || 10; // Limite por defecto a 10

    if (action === 'getLatest') {
        try {
            // Asegúrate de que la conexión esté viva antes de la consulta
            if (!pool) {
                throw new Error("La configuración de la base de datos (Pool) no se inicializó correctamente.");
            }

            // Consulta SQL para obtener los últimos resultados registrados
            const query = `
                SELECT 
                    id, 
                    nombre_usuario, 
                    evento_id, 
                    valor_resultado, 
                    unidad_medida, 
                    fecha_registro, 
                    comentarios
                FROM 
                    resultados
                ORDER BY 
                    fecha_registro DESC
                LIMIT 
                    $1;
            `;

            // Ejecutar la consulta
            const result = await pool.query(query, [limit]);

            // Responder con los datos
            return res.status(200).json({
                success: true,
                data: result.rows
            });

        } catch (error) {
            console.error('Error al obtener los últimos resultados:', error);

            let msg = 'Error interno del servidor.';
            if (error.code === '42P01') {
                msg = 'Error: La tabla "resultados" no existe. Asegúrate de haberla creado en Neon.';
            } else if (error.message && error.message.includes('password authentication failed')) {
                msg = 'Error de conexión: Credenciales de DATABASE_URL incorrectas.';
            }

            return res.status(500).json({
                success: false,
                message: msg
            });
        }
    } else {
        // Respuesta para una acción no válida
        return res.status(400).json({
            success: false,
            message: 'Acción no válida o faltante para /api/resultados.'
        });
    }
});