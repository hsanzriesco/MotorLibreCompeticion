import { Pool } from "pg";
import bcrypt from "bcryptjs"; // Usando bcryptjs

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Método no permitido" });
  }

  try {
    console.log("--- LOGIN INICIADO ---");
    // Log para confirmar que bcrypt está disponible
    console.log("bcrypt.compare tipo:", typeof bcrypt.compare); 

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
      console.log(`Login fallido: Usuario ${username} no encontrado.`);
      return res.status(401).json({ success: false, message: "Credenciales incorrectas" });
    }

    const user = rows[0];
    
    
    // Log del hash de la DB para depuración
    console.log(`Usuario encontrado. Hash en DB (primeros 10 chars): ${user.password_hash ? user.password_hash.substring(0, 10) : 'NULL/Undefined'}`);

    // Verificación para usuarios con hash nulo (usuarios antiguos)
    if (!user.password_hash) {
        console.error(`Error de Datos: Hash de usuario ${username} es nulo o inválido.`);
        return res.status(401).json({ success: false, message: "Credenciales incorrectas" });
    }
    
    // Comparamos la contraseña en texto plano con el hash guardado
    const match = await bcrypt.compare(password, user.password_hash);
    
    if (!match) {
        console.log(`Login fallido: Contraseña incorrecta para ${username}.`);
        return res.status(401).json({ success: false, message: "Credenciales incorrectas" });
    }

    // Éxito
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
    console.error("Detalle del error:", error); // Esto mostrará el error exacto (ej. fallo de bcrypt.compare)
    return res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
}