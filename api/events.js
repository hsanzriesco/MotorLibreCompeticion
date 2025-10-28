import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export default async function handler(req, res) {
  try {
    // 🧱 Crea tabla si no existe (usa start y end, que son más comunes)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        title VARCHAR(100) NOT NULL,
        description TEXT,
        location VARCHAR(100),
        start TIMESTAMP NOT NULL,
        "end" TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 🟢 GET — listar eventos
    if (req.method === "GET") {
      const result = await pool.query(`
        SELECT id, title, description, location, start, "end"
        FROM events
        ORDER BY start ASC
      `);

      return res.status(200).json({
        success: true,
        data: result.rows,
      });
    }

    // 🟡 POST — crear evento
    if (req.method === "POST") {
      const { title, description, location, start, end } = req.body;

      if (!title || !start || !end) {
        return res.status(400).json({
          success: false,
          message: "Faltan campos obligatorios: título, inicio o fin.",
        });
      }

      const insert = await pool.query(
        `INSERT INTO events (title, description, location, start, "end")
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, title, description, location, start, "end"`,
        [title, description || "", location || "", start, end]
      );

      return res.status(201).json({
        success: true,
        message: "Evento creado correctamente",
        data: insert.rows[0],
      });
    }

    // ❌ Otros métodos no permitidos
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
