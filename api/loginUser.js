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

    const { rows } = await pool.query(
      "SELECT id, name, email, role, password FROM users WHERE email=$1 AND password=$2",
      [email, password]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: "Credenciales incorrectas" });
    }

    const user = rows[0];

    res.status(200).json({
      success: true,
      message: "Inicio de sesión correcto",
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    console.error("Error en loginUser:", error);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
}
