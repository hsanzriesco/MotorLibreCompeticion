const express = require("express");
const router = express.Router();
const pool = require("../server"); // usa tu conexión ya creada

// Obtener todas las noticias
router.get("/", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM noticias ORDER BY fecha DESC");
        res.json(result.rows);
    } catch (error) {
        console.error("Error obteniendo noticias:", error);
        res.status(500).json({ error: "Error interno" });
    }
});

// Crear noticia
router.post("/", async (req, res) => {
    const { titulo, contenido } = req.body;

    if (!titulo || !contenido)
        return res.status(400).json({ error: "Faltan datos" });

    try {
        const result = await pool.query(
            "INSERT INTO noticias (titulo, contenido) VALUES ($1, $2) RETURNING *",
            [titulo, contenido]
        );
        res.json(result.rows[0]);
    } catch (error) {
        console.error("Error creando noticia:", error);
        res.status(500).json({ error: "Error interno" });
    }
});

// Actualizar noticia
router.put("/:id", async (req, res) => {
    const { id } = req.params;
    const { titulo, contenido } = req.body;

    try {
        const result = await pool.query(
            "UPDATE noticias SET titulo = $1, contenido = $2 WHERE id = $3 RETURNING *",
            [titulo, contenido, id]
        );
        res.json(result.rows[0]);
    } catch (error) {
        console.error("Error actualizando noticia:", error);
        res.status(500).json({ error: "Error interno" });
    }
});

// Eliminar noticia
router.delete("/:id", async (req, res) => {
    const { id } = req.params;

    try {
        await pool.query("DELETE FROM noticias WHERE id = $1", [id]);
        res.json({ success: true });
    } catch (error) {
        console.error("Error eliminando noticia:", error);
        res.status(500).json({ error: "Error interno" });
    }
});

module.exports = router;
