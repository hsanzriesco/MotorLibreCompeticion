// api/resultados.js

const express = require('express');
const router = express.Router();
// Asume que tu conexión a la base de datos (Neon) está en un módulo llamado db
const pool = require('./db'); // Cambia esto si tu archivo de conexión se llama diferente

// Ruta: /api/resultados
router.get('/', async (req, res) => {
    const action = req.query.action;
    const limit = parseInt(req.query.limit) || 10; // Limite por defecto a 10

    if (action === 'getLatest') {
        try {
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
            // Si el error es una tabla inexistente, proporciona un mensaje útil
            let msg = 'Error interno del servidor.';
            if (error.code === '42P01') { // PostgreSQL error code for undefined table
                msg = 'Error: La tabla "resultados" no existe. Asegúrate de haber ejecutado el comando CREATE TABLE en Neon.';
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

module.exports = router;