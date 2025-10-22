// /api/loginUser.js
import { pool } from "../db.js";

export default async function handler(req, res) {
  try {
    const url = req.url || "";

    // === REGISTRO ===
    if (req.method === "POST" && url.includes("register")) {
      const { name, email, password } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({ success: false, message: "Todos los campos son obligatorios" });
      }

      const existing = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
      if (existing.rows.length > 0) {
        return res.status(400).json({ success: false, message: "El usuario ya existe" });
      }

      const role = "usuario";
      const { rows } = await pool.query(
        "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, role",
        [name, email, password, role]
      );

      return res.status(200).json({ success: true, message: "Registro exitoso", user: rows[0] });
    }

    // === LOGIN ===
    if (req.method === "POST" && url.includes("login")) {
      const { email, password } = req.body;

      const { rows } = await pool.query("SELECT * FROM users WHERE email = $1 AND password = $2", [email, password]);
      if (rows.length === 0) {
        return res.status(401).json({ success: false, message: "Credenciales incorrectas" });
      }

      return res.status(200).json({
        success: true,
        message: "Inicio de sesión correcto",
        user: rows[0],
      });
    }

    res.status(405).json({ success: false, message: "Método o ruta no válida" });
  } catch (error) {
    console.error("Error en /api/loginUser.js:", error);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
}
