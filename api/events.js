import { Pool } from "pg";

// Conexión al pool PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export default async function handler(req, res) {
  const { id } = req.query;

  try {
    // === 🟢 GET: Obtener todos los eventos ===
    if (req.method === "GET") {
      const result = await pool.query(
        // ⭐ MODIFICADO: Cambiado image_base64 a image_url ⭐
        `SELECT id, title, description, location, start, "end", image_url
         FROM events
         ORDER BY start ASC`
      );

      return res.status(200).json({ success: true, data: result.rows });
    }

    // === 🟡 POST: Crear nuevo evento ===
    if (req.method === "POST") {
      const body = await parseBody(req);
      // ⭐ MODIFICADO: Cambiado image_base64 a image_url ⭐
      const { title, description, location, start, end, image_url } = body;

      if (!title || !start || !end) {
        return res.status(400).json({
          success: false,
          message: "Faltan campos obligatorios.",
        });
      }

      const result = await pool.query(
        // ⭐ MODIFICADO: Cambiado image_base64 a image_url ⭐
        `INSERT INTO events (title, description, location, start, "end", image_url)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [title, description, location, start, end, image_url || null]
      );

      return res.status(201).json({ success: true, data: result.rows[0] });
    }

    // === 🟠 PUT: Actualizar evento ===
    if (req.method === "PUT") {
      if (!id)
        return res
          .status(400)
          .json({ success: false, message: "Falta el ID del evento." });

      const body = await parseBody(req);
      // ⭐ MODIFICADO: Cambiado image_base64 a image_url ⭐
      const { title, description, location, start, end, image_url } = body;

      if (!title || !start || !end) {
        return res.status(400).json({
          success: false,
          message: "Faltan campos obligatorios.",
        });
      }

      const result = await pool.query(
        `UPDATE events
         SET title = $1,
             description = $2,
             location = $3,
             start = $4,
             "end" = $5,
            // ⭐ MODIFICADO: Cambiado image_base64 a image_url ⭐
             image_url = COALESCE($6, image_url)
         WHERE id = $7
         RETURNING *`,
        [title, description, location, start, end, image_url || null, id]
      );

      if (result.rows.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Evento no encontrado." });
      }

      return res.status(200).json({ success: true, data: result.rows[0] });
    }

    // === 🔴 DELETE: Eliminar evento ===
    if (req.method === "DELETE") {
      if (!id)
        return res
          .status(400)
          .json({ success: false, message: "Falta el ID del evento." });

      await pool.query("DELETE FROM events WHERE id = $1", [id]);
      return res
        .status(200)
        .json({ success: true, message: "Evento eliminado correctamente." });
    }

    // === 🚫 Método no permitido ===
    res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
    return res
      .status(405)
      .json({ success: false, message: `Método ${req.method} no permitido.` });
  } catch (error) {
    console.error("Error general en /api/events:", error);
    return res
      .status(500)
      .json({ success: false, message: "Error interno del servidor." });
  }
}

// 🔧 Función auxiliar para parsear body (compatible con JSON y texto)
async function parseBody(req) {
  try {
    const raw = await new Promise((resolve, reject) => {
      let data = "";
      req.on("data", (chunk) => (data += chunk));
      req.on("end", () => resolve(data));
      req.on("error", reject);
    });

    if (!raw) return {};

    // Si el body viene como JSON
    if (req.headers["content-type"]?.includes("application/json")) {
      return JSON.parse(raw);
    }

    // Si viene como texto (por seguridad)
    return JSON.parse(raw.toString());
  } catch (err) {
    console.error(" Error parseando el body:", err);
    return {};
  }
}