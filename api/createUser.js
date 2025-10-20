import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Método no permitido" });
  }

  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: "Faltan campos requeridos" });
    }

    // Crear tabla si no existe
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL
      )
    `);

    // Insertar nuevo usuario
    const result = await pool.query(
      "INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username",
      [username, password]
    );

    return res.status(201).json({
      success: true,
      user: result.rows[0],
    });
  } catch (error) {
    console.error("❌ Error en createUser:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error interno del servidor",
    });
  }
}
