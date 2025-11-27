import pkg from "pg";
import bcrypt from "bcryptjs";

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

      const result = await pool.query(
        `INSERT INTO users (name, email, password, role)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name, email, role, created_at`,
        [name, email, password, role || "user"]
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
        password || null,
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
    return res.status(500).json({
      success: false,
      message:
        "Error interno del servidor o de conexión a la base de datos.",
      error: error.message,
    });
  }
}
