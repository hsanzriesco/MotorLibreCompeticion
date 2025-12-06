// api/cierre_eventos_automatico.js

import cron from 'node-cron';
import { Pool } from "pg"; 

// Ajusta esta importación/definición a cómo manejas tu conexión DB
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});


/**
 * Función que contiene la lógica para marcar eventos como finalizados.
 */
async function cerrarEventosVencidos() {
    console.log(`[CIERRE_AUTOMATICO] Buscando eventos finalizados para marcar...`);

    const query = `
        INSERT INTO evento_finalizado (
            event_id, 
            fecha_finalizacion, 
            estado, 
            evento
        ) 
        SELECT 
            e.id, 
            CURRENT_TIMESTAMP, 
            'Finalizado por scheduler', 
            jsonb_build_object('nombre', e.title)
        FROM 
            events e
        WHERE 
            e.event_end < CURRENT_TIMESTAMP     
            AND e.id NOT IN (SELECT event_id FROM evento_finalizado);
    `;

    try {
        const result = await pool.query(query);
        if (result.rowCount > 0) {
            console.log(`✅ [CIERRE_AUTOMATICO] ${result.rowCount} eventos marcados como finalizados.`);
        }
    } catch (error) {
        console.error('❌ [CIERRE_AUTOMATICO] Error al cerrar eventos:', error);
    }
}

/**
 * Inicia la tarea programada (cron job) para el cierre automático.
 */
export function iniciarCierreAutomatico() {
    console.log("Iniciando el proceso de Cierre Automático de Eventos (cada 5 min)...");
    
    // Ejecutar cada 5 minutos
    cron.schedule('*/5 * * * *', cerrarEventosVencidos, {
        scheduled: true,
    });
}