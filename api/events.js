import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const result = await pool.query("SELECT * FROM events ORDER BY start ASC");
      return res.status(200).json({ success: true, data: result.rows });
    }

    if (req.method === "POST") {
      const { title, description, location, start, end, image_base64 } = req.body;

      if (!title || !start || !end) {
        return res.status(400).json({ success: false, message: "Faltan campos obligatorios" });
      }

      const result = await pool.query(
        `INSERT INTO events (title, description, location, start, "end", image_base64)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [title, description, location, start, end, image_base64 || null]
      );

      return res.status(201).json({ success: true, data: result.rows[0] });
    }

    if (req.method === "PUT") {
      const { id, title, description, location, start, end, image_base64 } = req.body;

      if (!id) {
        return res.status(400).json({ success: false, message: "Falta el ID del evento" });
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

      return res.status(200).json({ success: true, data: result.rows[0] });
    }

    if (req.method === "DELETE") {
      const { id } = req.query;
      if (!id) {
        return res.status(400).json({ success: false, message: "Falta el ID" });
      }

      await pool.query("DELETE FROM events WHERE id = $1", [id]);
      return res.status(200).json({ success: true, message: "Evento eliminado" });
    }

    res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
    return res.status(405).json({ success: false, message: `Método ${req.method} no permitido` });
  } catch (error) {
    console.error("❌ Error en /api/events:", error);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
}
