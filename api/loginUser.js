import { Pool } from "pg";
import bcrypt from "bcrypt"; // ✅ Importamos bcrypt

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
      return res.status(400).json({ success: false, message: "Faltan datos" });
    }

    // 1. ✅ Buscamos SÓLO por nombre de usuario, y solicitamos el hash
    const { rows } = await pool.query(
      "SELECT id, name, email, role, password_hash FROM users WHERE name = $1",
      [username]
    );

    if (rows.length === 0) {
      // Devolvemos mensaje genérico para no dar pistas
      return res.status(401).json({ success: false, message: "Credenciales incorrectas" });
    }

    const user = rows[0];
    
    // 2. ✅ Comparamos la contraseña en texto plano con el hash guardado
    const match = await bcrypt.compare(password, user.password_hash);
    
    if (!match) {
        // Contraseña incorrecta
        return res.status(401).json({ success: false, message: "Credenciales incorrectas" });
    }

    // Si llegamos aquí, las credenciales son correctas
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
    console.error("Error en loginUser:", error);
    return res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
}