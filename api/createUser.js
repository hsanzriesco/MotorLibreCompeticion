import { Pool } from "pg";
import bcrypt from "bcryptjs"; // Importación de bcryptjs

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const saltRounds = 10; 

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Método no permitido" });
  }

  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "Faltan campos requeridos" });
    }
    
    // Creación de tabla con el campo password_hash TEXT
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE,
        email VARCHAR(100) UNIQUE,
        password_hash TEXT NOT NULL,  
        role VARCHAR(50) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Verificar duplicados
    const existingUser = await pool.query(
      "SELECT * FROM users WHERE email = $1 OR name = $2",
      [email, name]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "El nombre o correo ya están registrados.",
      });
    }

    // Generar Hash
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    const result = await pool.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role",
      [name, email, hashedPassword, "user"] 
    );

    return res.status(201).json({
      success: true,
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Error en createUser:", error);
    if (error.code === '23505') { 
        return res.status(409).json({
            success: false,
            message: "El nombre o correo ya están registrados."
        });
    }
    return res.status(500).json({
      success: false,
      message: "Error interno del servidor",
    });
  }
}