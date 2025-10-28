import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export default async function handler(req, res) {
  try {
    // Crear tabla si no existe (usa tus nombres reales)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        title VARCHAR(100) NOT NULL,
        description TEXT,
        location VARCHAR(100),
        start_date TIMESTAMP NOT NULL,
        end_date TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // --- GET: obtener todos los eventos ---
    if (req.method === "GET") {
      const result = await pool.query(`
        SELECT 
          id,
          title,
          description,
          location,
          start_date AS start,
          end_date AS "end"
        FROM events
        ORDER BY start_date ASC
      `);

      return res.status(200).json({
        success: true,
        data: result.rows,
      });
    }

    // --- POST: crear un nuevo evento ---
    if (req.method === "POST") {
      const { title, description, location, start, end } = req.body;

      if (!title || !start || !end) {
        return res.status(400).json({
          success: false,
          message: "Faltan campos obligatorios (título, fecha inicio o fin).",
        });
      }

      const insert = await pool.query(
        `INSERT INTO events (title, description, location, start_date, end_date)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, title, description, location, start_date AS start, end_date AS "end"`,
        [title, description || "", location || "", start, end]
      );

      return res.status(201).json({
        success: true,
        message: "Evento creado correctamente",
        data: insert.rows[0],
      });
    }

    // --- Método no permitido ---
    return res.status(405).json({
      success: false,
      message: "Método no permitido",
    });
  } catch (error) {
    console.error("❌ Error en /api/events:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error interno del servidor",
    });
  }
}
