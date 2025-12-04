import express from "express";
import { sql } from "@vercel/postgres";

const router = express.Router();

// -------------------------------------------------------------
//                 OBTENER TODOS LOS CLUBS
// -------------------------------------------------------------
router.get("/", async (req, res) => {
    try {
        const result = await sql`SELECT * FROM clubs ORDER BY id ASC`; // <-- corregido
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error("Error GET /api/clubs:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// -------------------------------------------------------------
//                 CREAR UN NUEVO CLUB
// -------------------------------------------------------------
router.post("/", async (req, res) => {
    try {
        const { nombre_evento, descripcion, fecha_creacion, imagen_club } = req.body;

        if (!nombre_evento || !fecha_creacion) {
            return res.status(400).json({ success: false, error: "Campos obligatorios faltantes" });
        }

        await sql`
            INSERT INTO clubs (nombre_evento, descripcion, fecha_creacion, imagen_club)
            VALUES (${nombre_evento}, ${descripcion}, ${fecha_creacion}, ${imagen_club})
        `;

        res.json({ success: true, message: "Club creado correctamente" });
    } catch (error) {
        console.error("Error POST /api/clubs:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// -------------------------------------------------------------
//                 ACTUALIZAR UN CLUB
// -------------------------------------------------------------
router.put("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre_evento, descripcion, fecha_creacion, imagen_club } = req.body;

        await sql`
            UPDATE clubs
            SET nombre_evento = ${nombre_evento},
                descripcion = ${descripcion},
                fecha_creacion = ${fecha_creacion},
                imagen_club = ${imagen_club}
            WHERE id = ${id}
        `;

        res.json({ success: true, message: "Club actualizado correctamente" });
    } catch (error) {
        console.error("Error PUT /api/clubs:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// -------------------------------------------------------------
//                 ELIMINAR UN CLUB
// -------------------------------------------------------------
router.delete("/:id", async (req, res) => {
    try {
        const { id } = req.params;

        await sql`DELETE FROM clubs WHERE id = ${id}`;

        res.json({ success: true, message: "Club eliminado correctamente" });
    } catch (error) {
        console.error("Error DELETE /api/clubs:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
