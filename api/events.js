import { Pool } from "pg";

// Conexión al pool PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export default async function handler(req, res) {
  const { id } = req.query;

  // Si estás en un proyecto Next.js, Vercel requiere esta línea para manejar el body
  // if (req.body) req.body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

  try {
    // === 🟢 GET: Obtener todos los eventos ===
    if (req.method === "GET") {
      const result = await pool.query(
        // Utilizamos AS para renombrar las columnas en SQL.
        `SELECT id, title, description, location, event_start AS start, event_end AS "end", image_url
         FROM events
         ORDER BY start ASC`
      );

      return res.status(200).json({ success: true, data: result.rows });
    }

    // === 🟡 POST: Crear nuevo evento ===
    if (req.method === "POST") {
      // Usamos req.body directamente si Vercel/Next.js lo parseó.
      // Si no, necesitamos la función parseBody (ver al final del archivo).
      const body = req.body || await parseBody(req);
      const { title, description, location, start, end, image_url } = body;

      if (!title || !start || !end) {
        return res.status(400).json({
          success: false,
          message: "Faltan campos obligatorios.",
        });
      }

      const result = await pool.query(
        `INSERT INTO events (title, description, location, event_start, event_end, image_url)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [title, description, location, start, end, image_url || null]
      );

      const newEvent = {
        ...result.rows[0],
        start: result.rows[0].event_start,
        end: result.rows[0].event_end,
      };

      return res.status(201).json({ success: true, data: newEvent });
    }

    // === 🟠 PUT: Actualizar evento ===
    if (req.method === "PUT") {
      if (!id)
        return res
          .status(400)
          .json({ success: false, message: "Falta el ID del evento." });

      const body = req.body || await parseBody(req);
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
             event_start = $4,
             event_end = $5,
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

      const updatedEvent = {
        ...result.rows[0],
        start: result.rows[0].event_start,
        end: result.rows[0].event_end,
      };

      return res.status(200).json({ success: true, data: updatedEvent });
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

// 🔧 Función auxiliar para parsear body (compatible con JSON y texto) - MANTENLA
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