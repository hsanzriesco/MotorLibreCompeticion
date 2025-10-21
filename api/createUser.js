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
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "Faltan campos requeridos" });
    }

    // Crear tabla si no existe (seguridad extra)
    await pool.query(`
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    email VARCHAR(100) UNIQUE,
    password VARCHAR(100),
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

    const result = await pool.query(
      "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role",
      [name, email, password, "user"]
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
