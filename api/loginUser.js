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
    console.log("--- LOGIN INICIADO (INSEGURO) ---");

    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: "Faltan datos" });
    }

    // Consulta que compara la contraseña en texto plano
    const { rows } = await pool.query(
      "SELECT id, name, email, role FROM users WHERE name = $1 AND password = $2",
      [username, password]
    );

    if (rows.length === 0) {
      console.log(`Login fallido: Credenciales incorrectas para ${username}.`);
      return res.status(401).json({ success: false, message: "Credenciales incorrectas" });
    }

    const user = rows[0];
    
    console.log(`LOGIN EXITOSO para ${username}.`);
    return res.status(200).json({
      success: true,
      message: "Inicio de sesión correcto",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("### FALLO CRÍTICO EN LOGINUSER ###");
    console.error("Detalle del error:", error);
    return res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
}