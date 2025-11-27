// api/loginUser.js

import { Pool } from "pg";
import bcrypt from "bcryptjs"; // ⬅️ IMPORTADO para comparar el hash

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

    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: "Faltan datos" });
    }

    // 1. OBTENER los datos del usuario, incluyendo el hash de la contraseña
    const { rows } = await pool.query(
      "SELECT id, name, email, role, password FROM users WHERE name = $1",
      [username]
    );

    // Si el usuario no existe
    if (rows.length === 0) {
      console.log(`Login fallido: Usuario no encontrado (${username}).`);
      return res.status(401).json({ success: false, message: "Credenciales incorrectas" });
    }

    const user = rows[0];
    const hashedPassword = user.password; // El hash guardado en la DB

    // 2. COMPARAR la contraseña ingresada (texto plano) con el hash almacenado
    // 🔑 LÓGICA CLAVE: Usamos bcrypt.compare()
    const match = await bcrypt.compare(password, hashedPassword); 

    // Si la comparación falla
    if (!match) {
        console.log(`Login fallido: Contraseña incorrecta para ${username}.`);
        return res.status(401).json({ success: false, message: "Credenciales incorrectas" });
    }
    
    // 3. Respuesta Exitosa
    // NOTA: Se recomienda generar un JWT o una sesión aquí para mantener al usuario logueado.
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