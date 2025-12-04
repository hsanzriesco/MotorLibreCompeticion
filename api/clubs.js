const express = require("express");
const router = express.Router();
const pool = require("../db");

// Obtener todos los clubes
router.get("/", async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT 
                id,
                nombre_evento,
                descripcion,
                imagen_club,
                fecha_creacion
            FROM clubs 
            ORDER BY id DESC
        `);

        res.json(rows);

    } catch (error) {
        console.error("ERROR GET /clubs:", error);
        res.status(500).send("Error al obtener clubes");
    }
});

// Crear un club
router.post("/", async (req, res) => {
    const { nombre_evento, descripcion, imagen_club } = req.body;

    try {
        const { rows } = await pool.query(
            `
            INSERT INTO clubs (nombre_evento, descripcion, imagen_club)
            VALUES ($1, $2, $3)
            RETURNING *
            `,
            [nombre_evento, descripcion, imagen_club]
        );

        res.json(rows[0]);

    } catch (error) {
        console.error("ERROR POST /clubs:", error);
        res.status(500).send("Error al crear club");
    }
});

// Unirse a un club
router.post("/join", async (req, res) => {
    const { club_id, user_id } = req.body;
    try {
        const exists = await pool.query(
            `SELECT * FROM club_members WHERE club_id = $1 AND user_id = $2`,
            [club_id, user_id]
        );

        if (exists.rows.length > 0) {
            return res.status(400).send("El usuario ya está en el club.");
        }

        await pool.query(
            `INSERT INTO club_members (club_id, user_id) VALUES ($1, $2)`,
            [club_id, user_id]
        );

        res.send("Unido correctamente");
    } catch (error) {
        console.error("ERROR POST /clubs/join:", error);
        res.status(500).send("Error al unirse al club");
    }
});

// Obtener miembros de un club
router.get("/:id/miembros", async (req, res) => {
    try {
        const { rows } = await pool.query(
            `
            SELECT u.id, u.nombre, u.email 
            FROM users u 
            JOIN club_members cm ON u.id = cm.user_id 
            WHERE cm.club_id = $1
            `,
            [req.params.id]
        );
        res.json(rows);
    } catch (error) {
        console.error("ERROR GET /clubs/:id/miembros:", error);
        res.status(500).send("Error al obtener los miembros");
    }
});

module.exports = router;
