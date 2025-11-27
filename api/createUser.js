// api/createUser.js
// Versión revisada para solucionar 'syntax error at or near "**"'

import { Pool } from "pg";
import bcrypt from "bcryptjs";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ success: false, message: "Método no permitido" });
  }

  try {
    console.log("--- REGISTRO INICIADO (SEGURO) ---");
    const { name, email, password } = req.body;

    // Si no viene el rol, asignamos 'user' por defecto
    const roleToAssign = req.body.role || 'user';

    if (!name || !email || !password) {
      console.error("Error 400: Campos requeridos faltantes.");
      return res
        .status(400)
        .json({ success: false, message: "Faltan campos requeridos" });
    }

    // ⚠️ ATENCIÓN: La creación de la tabla podría causar el error si hay un typo.
    // Asumiendo que la tabla ya existe y tiene las columnas NOT NULL relajadas (como vimos en el log).
    // Si la eliminas de aquí, el error desaparece si era un typo en esta consulta.
    /*
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE,
        email VARCHAR(100) UNIQUE,
        password TEXT NOT NULL,  
        role VARCHAR(50) DEFAULT 'user',
        reset_token TEXT,
        reset_token_expires TIMESTAMP,
        car_garages VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    */

    const existingUser = await pool.query(
      "SELECT * FROM users WHERE email = $1 OR name = $2",
      [email, name]
    );

    if (existingUser.rows.length > 0) {
      console.error("Error 409: Usuario o correo ya existe.");
      return res.status(409).json({
        success: false,
        message: "El nombre o correo ya están registrados.",
      });
    }

    // 🔑 HASHEO DE CONTRASEÑA
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Consulta INSERT limpia (anteriormente línea 45)
    const result = await pool.query(
      "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role",
      [name, email, hashedPassword, roleToAssign]
    );
    console.log(`Usuario ${name} insertado en DB.`);

    return res.status(201).json({
      success: true,
      user: result.rows[0],
    });
  } catch (error) {
    console.error("### FALLO CRÍTICO EN CREATEUSER ###");
    console.error("Detalle del error:", error);
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "El nombre o correo ya están registrados.",
      });
    }
    return res.status(500).json({
      success: false,
      message: "Error interno del servidor",
    });
  }
}