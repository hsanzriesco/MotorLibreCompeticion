import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export default async function handler(req, res) {
  try {
    // Crear tabla si no existe
    await pool.query(`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        title VARCHAR(100) NOT NULL,
        description TEXT,
        location VARCHAR(150),
        start_date TIMESTAMP,
        end_date TIMESTAMP
      )
    `);

    if (req.method === "GET") {
      const result = await pool.query(`
        SELECT id, title, description, location,
               start_date AS start, end_date AS end
        FROM events
      `);
      return res.status(200).json({ success: true, data: result.rows });
    }

    if (req.method === "POST") {
      const { title, description, location, start, end } = req.body;
      const result = await pool.query(
        `INSERT INTO events (title, description, location, start_date, end_date)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [title, description, location, start, end]
      );
      return res.status(201).json({ success: true, event: result.rows[0] });
    }

    if (req.method === "PUT") {
      const { id, title, description, location, start, end } = req.body;
      await pool.query(
        `UPDATE events
         SET title=$1, description=$2, location=$3, start_date=$4, end_date=$5
         WHERE id=$6`,
        [title, description, location, start, end, id]
      );
      return res.status(200).json({ success: true });
    }

    if (req.method === "DELETE") {
      const { id } = req.query;
      await pool.query("DELETE FROM events WHERE id=$1", [id]);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ success: false, message: "Método no permitido" });
  } catch (error) {
    console.error("❌ Error en /api/events:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}
