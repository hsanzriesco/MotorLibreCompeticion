import { Pool } from "pg";
import bcrypt from "bcryptjs"; // Importación de bcryptjs

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

    // Buscamos el usuario por nombre y recuperamos el hash
    const { rows } = await pool.query(
      "SELECT id, name, email, role, password_hash FROM users WHERE name = $1",
      [username]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: "Credenciales incorrectas" });
    }

    const user = rows[0];
    
    // Verificación para usuarios con hash nulo (usuarios antiguos)
    if (!user.password_hash) {
        console.error(`Usuario ${username} no tiene hash válido. Acceso denegado.`);
        return res.status(401).json({ success: false, message: "Credenciales incorrectas" });
    }
    
    // Comparamos la contraseña en texto plano con el hash guardado
    const match = await bcrypt.compare(password, user.password_hash);
    
    if (!match) {
        return res.status(401).json({ success: false, message: "Credenciales incorrectas" });
    }

    // Inicio de sesión exitoso
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