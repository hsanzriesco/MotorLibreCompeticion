import { Pool } from "pg";

// Configura la conexión al pool de PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export default async function handler(req, res) {
  const { id } = req.query;

  try {
    // === 🟢 GET: Obtener todos los eventos ===
    if (req.method === "GET") {
      const result = await pool.query(
        `SELECT id, title, description, location, start, "end", image_base64 
         FROM events 
         ORDER BY start ASC`
      );

      return res.status(200).json({ success: true, data: result.rows });
    }

    // === 🟡 POST: Crear nuevo evento ===
    if (req.method === "POST") {
      const { title, description, location, start, end, image_base64 } = req.body;

      if (!title || !start || !end) {
        return res
          .status(400)
          .json({ success: false, message: "Faltan campos obligatorios" });
      }

      const result = await pool.query(
        `INSERT INTO events (title, description, location, start, "end", image_base64)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [title, description, location, start, end, image_base64 || null]
      );

      return res.status(201).json({ success: true, data: result.rows[0] });
    }

    // === 🟠 PUT: Actualizar evento existente ===
    if (req.method === "PUT") {
      if (!id) {
        return res
          .status(400)
          .json({ success: false, message: "Falta el ID del evento" });
      }

      const { title, description, location, start, end, image_base64 } = req.body;

      if (!title || !start || !end) {
        return res
          .status(400)
          .json({ success: false, message: "Faltan campos obligatorios" });
      }

      const result = await pool.query(
        `UPDATE events
         SET title = $1,
             description = $2,
             location = $3,
             start = $4,
             "end" = $5,
             image_base64 = $6
         WHERE id = $7
         RETURNING *`,
        [title, description, location, start, end, image_base64 || null, id]
      );

      if (result.rows.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Evento no encontrado" });
      }

      return res.status(200).json({ success: true, data: result.rows[0] });
    }

    // === 🔴 DELETE: Eliminar evento ===
    if (req.method === "DELETE") {
      if (!id) {
        return res
          .status(400)
          .json({ success: false, message: "Falta el ID del evento" });
      }

      await pool.query("DELETE FROM events WHERE id = $1", [id]);

      return res
        .status(200)
        .json({ success: true, message: "Evento eliminado correctamente" });
    }

    // === 🚫 Método no permitido ===
    res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
    return res
      .status(405)
      .json({ success: false, message: `Método ${req.method} no permitido` });

  } catch (error) {
    console.error("❌ Error en /api/events:", error);
    return res
      .status(500)
      .json({ success: false, message: "Error interno del servidor" });
  }
}
