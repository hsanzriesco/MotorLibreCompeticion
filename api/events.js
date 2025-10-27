import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export default async function handler(req, res) {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        title VARCHAR(100),
        description TEXT,
        location VARCHAR(150),
        start_date DATE,
        end_date DATE
      )
    `);

    if (req.method === "GET") {
      const result = await pool.query(`
        SELECT id, title, description, location, start_date AS start, end_date AS end
        FROM events
      `);
      return res.status(200).json(result.rows);
    }

    if (req.method === "POST") {
      const { title, description, location, start, end } = req.body;
      const result = await pool.query(
        "INSERT INTO events (title, description, location, start_date, end_date) VALUES ($1, $2, $3, $4, $5) RETURNING *",
        [title, description, location, start, end]
      );
      return res.status(201).json({ success: true, event: result.rows[0] });
    }

    return res.status(405).json({ success: false, message: "Método no permitido" });
  } catch (error) {
    console.error("❌ Error en /api/events:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}
