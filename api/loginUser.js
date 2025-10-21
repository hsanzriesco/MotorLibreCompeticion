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
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Faltan campos requeridos" });
    }

    // Buscar usuario en la base de datos
    const result = await pool.query(
      "SELECT id, name, email, role, password FROM users WHERE email = $1 AND password = $2",
      [email, password]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: "Credenciales incorrectas" });
    }

    const user = result.rows[0];

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("❌ Error en loginUser:", error);
    return res.status(500).json({
      success: false,
      message: "Error interno del servidor",
    });
  }
}
