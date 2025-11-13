import { Pool } from "pg";
import bcrypt from "bcryptjs"; // ✅ USAMOS bcryptjs

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

    // ✅ Solo buscamos por nombre y traemos el hash
    const { rows } = await pool.query(
      "SELECT id, name, email, role, password_hash FROM users WHERE name = $1",
      [username]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: "Credenciales incorrectas" });
    }

    const user = rows[0];

    // ✅ ⚠️ Verificación para evitar error 500 por valor nulo
    if (!user.password_hash) {
      // Bloquear acceso a usuarios con hash nulo/inválido
      console.error(`Usuario ${username} no tiene hash válido. Posible usuario antiguo.`);
      return res.status(401).json({ success: false, message: "Credenciales incorrectas" });
    }

    // ✅ Comparamos el texto plano con el hash
    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) {
      return res.status(401).json({ success: false, message: "Credenciales incorrectas" });
    }

    // Éxito
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
    // Si el error 500 sigue ocurriendo aquí, es un problema de bcryptjs, Vercel o la DB.
    console.error("❌ Error en loginUser:", error);
    return res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
}