import { Pool } from "pg";
import bcrypt from "bcryptjs"; // ✅ CAMBIADO a bcryptjs para entornos Vercel

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

    // 1. Buscamos el usuario por nombre y recuperamos el HASH
    const { rows } = await pool.query(
      "SELECT id, name, email, role, password_hash FROM users WHERE name = $1",
      [username]
    );

    // Si el usuario no existe
    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: "Credenciales incorrectas" });
    }

    const user = rows[0];
    
    // 2. Verificación de seguridad: Aseguramos que el usuario tiene un hash
    if (!user.password_hash) {
        // Esto indica un usuario creado antes de la implementación de bcrypt
        console.error(`Usuario ${username} no tiene hash. Acceso denegado.`);
        return res.status(401).json({ success: false, message: "Credenciales incorrectas" });
    }
    
    // 3. Comparamos la contraseña en texto plano con el hash guardado
    const match = await bcrypt.compare(password, user.password_hash);
    
    if (!match) {
        // Contraseña incorrecta
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
    console.error("❌ Error en loginUser:", error);
    // Un error 500 aquí puede ser un fallo de bcryptjs o un problema de DB/conexión
    return res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
}