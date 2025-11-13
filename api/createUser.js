import { Pool } from "pg";
import bcrypt from "bcrypt"; // Importamos bcrypt

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const saltRounds = 10; //Factor de coste para el hash (cuanto más alto, más lento y seguro)

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Método no permitido" });
  }

  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "Faltan campos requeridos" });
    }
    
    // ⚠️ ATENCIÓN: Se recomienda que esta migración (CREATE TABLE) se haga
    // fuera del handler. Si la dejas, asegúrate de cambiar 'password' a 'password_hash'
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE,
        email VARCHAR(100) UNIQUE,
        password_hash TEXT NOT NULL,  // CAMBIADO: Usar TEXT para el hash y nombre 'password_hash'
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

    // 1. ✅ Hashear la contraseña antes de guardarla
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    const result = await pool.query(
      // 2. ✅ Usamos 'password_hash' en lugar de 'password'
      "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role",
      [name, email, hashedPassword, "user"] // 3. ✅ Guardamos el hash
    );

    return res.status(201).json({
      success: true,
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Error en createUser:", error);
    return res.status(500).json({
      success: false,
      message: "Error interno del servidor",
    });
  }
}