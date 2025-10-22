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
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "Faltan campos requeridos" });
    }

    // Crear tabla si no existe
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

    // Verificar duplicado
    const existing = await pool.query("SELECT * FROM users WHERE email = $1 OR name = $2", [email, name]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, message: "El correo o nombre de usuario ya está en uso" });
    }

    // Insertar usuario
    const result = await pool.query(
      "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, 'user') RETURNING id, name, email, role",
      [name, email, password]
    );

    res.status(201).json({ success: true, user: result.rows[0] });
  } catch (error) {
    console.error("❌ Error en createUser:", error);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
}
