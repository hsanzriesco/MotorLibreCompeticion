// ⚙️ usersList.js (Actualizado a sintaxis CommonJS)
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function handler(req, res) {
  try {
    // ✅ OBTENER TODOS LOS USUARIOS
    if (req.method === "GET") {
      const result = await pool.query(
        "SELECT id, name, email, role, created_at FROM users ORDER BY id ASC"
      );
      return res.status(200).json({ success: true, data: result.rows });
    }

    // ✅ CREAR NUEVO USUARIO
    if (req.method === "POST") {
      const { name, email, password, role } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({
          success: false,
          message: "Faltan campos obligatorios",
        });
      }

      // Encriptar la contraseña
      const hashedPassword = await bcrypt.hash(password, 10);

      const result = await pool.query(
        `INSERT INTO users (name, email, password, role)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name, email, role, created_at`,
        [name, email, hashedPassword, role || "user"]
      );

      return res.status(201).json({ success: true, data: result.rows[0] });
    }

    // ✅ ACTUALIZAR USUARIO EXISTENTE
    if (req.method === "PUT") {
      const { id, name, email, password, role } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: "Falta el ID del usuario",
        });
      }

      // Si se manda una contraseña nueva, se encripta
      const hashedPassword = password ? await bcrypt.hash(password, 10) : null;

      const query = `
        UPDATE users
        SET
          name = COALESCE($1, name),
          email = COALESCE($2, email),
          role = COALESCE($3, role),
          password = COALESCE($4, password)
        WHERE id = $5
        RETURNING id, name, email, role
      `;

      const result = await pool.query(query, [
        name || null,
        email || null,
        role || null,
        hashedPassword,
        id,
      ]);

      return res.status(200).json({ success: true, data: result.rows[0] });
    }

    // ✅ ELIMINAR USUARIO
    if (req.method === "DELETE") {
      const { id } = req.query;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: "Falta el ID del usuario",
        });
      }

      await pool.query("DELETE FROM users WHERE id = $1", [id]);
      return res.status(200).json({
        success: true,
        message: "Usuario eliminado correctamente",
      });
    }

    // ❌ MÉTODO NO PERMITIDO
    res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
    return res
      .status(405)
      .json({ success: false, message: `Método ${req.method} no permitido` });
  } catch (error) {
    console.error("❌ Error en /api/usersList:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      error: error.message,
    });
  }
}

// Exportación CommonJS
module.exports = handler;