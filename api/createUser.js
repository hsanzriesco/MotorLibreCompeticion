// /api/createUser.js
import pool from "../../db.js";
import bcrypt from "bcryptjs";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Método no permitido" });
  }

  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ success: false, error: "Faltan campos obligatorios" });
  }

  try {
    // Comprobar si ya existe el usuario
    const existingUser = await pool.query(
      "SELECT * FROM users WHERE username = $1 OR email = $2",
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ success: false, error: "El usuario o correo ya existe" });
    }

    // Encriptar contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insertar usuario
    await pool.query(
      "INSERT INTO users (username, email, password) VALUES ($1, $2, $3)",
      [username, email, hashedPassword]
    );

    return res.status(201).json({ success: true, message: "Usuario registrado correctamente" });
  } catch (error) {
    console.error("❌ Error al registrar usuario:", error);
    return res.status(500).json({ success: false, error: "Error en el servidor" });
  }
}
