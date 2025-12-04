import express from "express";
import pkg from "pg";
const { Pool } = pkg;

const router = express.Router();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Necesario para Vercel + Neon
});

// -------------------------------------------
// GET /api/clubs
// -------------------------------------------
router.get("/", async (req, res) => {
    try {
        const query = `
            SELECT 
                id,
                nombre_evento AS nombre,
                descripcion,
                imagen_club,
                fecha_creacion
            FROM clubs
            ORDER BY id DESC
        `;

        const result = await pool.query(query);

        res.json(result.rows);

    } catch (err) {
        console.error("Error en GET /api/clubs:", err);
        res.status(500).send("Error en el servidor");
    }
});

// Exportar la ruta
export default router;
