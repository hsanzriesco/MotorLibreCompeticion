import { pool } from "../../db.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const { rows } = await pool.query("SELECT * FROM events ORDER BY start ASC");
      return res.status(200).json({ success: true, data: rows });
    }

    if (req.method === "POST") {
      const { title, start, end } = req.body;
      const { rows } = await pool.query(
        "INSERT INTO events (title, start, end) VALUES ($1, $2, $3) RETURNING *",
        [title, start, end]
      );
      return res.status(200).json({ success: true, data: rows[0] });
    }

    if (req.method === "PUT") {
      const id = req.url.split("/").pop();
      const { title, start, end } = req.body;
      const { rows } = await pool.query(
        "UPDATE events SET title=$1, start=$2, end=$3 WHERE id=$4 RETURNING *",
        [title, start, end, id]
      );
      return res.status(200).json({ success: true, data: rows[0] });
    }

    if (req.method === "DELETE") {
      const id = req.url.split("/").pop();
      await pool.query("DELETE FROM events WHERE id=$1", [id]);
      return res.status(200).json({ success: true });
    }

    res.status(405).json({ success: false, message: "Método no permitido" });
  } catch (error) {
    console.error("Error en /api/events:", error);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
}
