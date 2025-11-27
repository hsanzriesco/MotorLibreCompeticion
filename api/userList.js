import pkg from "pg";
import bcrypt from "bcryptjs"; // ⬅️ Ya estaba aquí, ¡perfecto!

const { Pool } = pkg;
let pool;

if (!global._pgPool) {
  global._pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
}
pool = global._pgPool;

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const result = await pool.query(
        "SELECT id, name, email, role, created_at FROM users ORDER BY id ASC"
      );
      return res.status(200).json({ success: true, data: result.rows });
    }

    if (req.method === "POST") {
      const { name, email, password, role } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({
          success: false,
          message: "Faltan campos obligatorios",
        });
      }

      // 🔑 HASHEO DE CONTRASEÑA para la CREACIÓN
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt); // ⬅️ Nuevo valor seguro
      
      const result = await pool.query(
        `INSERT INTO users (name, email, password, role)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name, email, role, created_at`,
        [name, email, hashedPassword, role || "user"] // ⬅️ Usamos el HASH
      );

      return res.status(201).json({ success: true, data: result.rows[0] });
    }

    if (req.method === "PUT") {
      const { id, name, email, password, role } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: "Falta el ID del usuario",
        });
      }
      
      let hashedPassword = password;

      // 🔑 HASHEO DE CONTRASEÑA para la ACTUALIZACIÓN, solo si se proporciona 'password'
      if (password) {
          const salt = await bcrypt.genSalt(10);
          hashedPassword = await bcrypt.hash(password, salt);
      }

      const query = `
        UPDATE users
        SET name = COALESCE($1, name),
            email = COALESCE($2, email),
            role = COALESCE($3, role),
            password = COALESCE($4, password)
        WHERE id = $5
        RETURNING id, name, email, role, created_at
      `;

      const result = await pool.query(query, [
        name || null,
        email || null,
        role || null,
        hashedPassword || null, // ⬅️ Usamos el HASH (o null si no se actualiza)
        id,
      ]);

      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: "Usuario no encontrado para actualizar",
        });
      }

      return res.status(200).json({ success: true, data: result.rows[0] });
    }

    if (req.method === "DELETE") {
      const { id } = req.query;
      
      // ... (La lógica DELETE es correcta) ...
      if (!id) {
        return res.status(400).json({
          success: false,
          message: "Falta el ID del usuario",
        });
      }

      const result = await pool.query("DELETE FROM users WHERE id = $1", [id]);

      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: "Usuario no encontrado para eliminar",
        });
      }

      return res
        .status(200)
        .json({ success: true, message: "Usuario eliminado correctamente" });
    }

    res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
    return res.status(405).json({
      success: false,
      message: `Método ${req.method} no permitido`,
    });
  } catch (error) {
    console.error("ERROR USERS.JS BACKEND:", error);
    // Aseguramos que si hay un error de clave única (ej. email duplicado), se maneje bien
    if (error.code === '23505') {
        return res.status(409).json({
            success: false,
            message: "El nombre o correo ya están registrados (Error de duplicado)."
        });
    }
    return res.status(500).json({
      success: false,
      message:
        "Error interno del servidor o de conexión a la base de datos.",
      error: error.message,
    });
  }
}
