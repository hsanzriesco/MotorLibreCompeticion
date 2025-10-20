import { Pool } from "pg";

// 🔒 Conexión a Neon (usa tus credenciales reales del dashboard de Neon)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // En Vercel, define esta variable en Settings → Environment Variables
  ssl: { rejectUnauthorized: false },
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Método no permitido" });
  }

  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: "Faltan campos requeridos" });
  }

  try {
    const result = await pool.query(
      "INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username",
      [username, password]
    );

    res.status(201).json({
      success: true,
      user: result.rows[0],
    });
  } catch (err) {
    console.error("Error al crear usuario:", err);
    res.status(500).json({ success: false, message: "Error en el servidor" });
  }
}
