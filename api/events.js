import { Pool } from "pg";
import formidable from "formidable";
import fs from "fs";

// Desactivar el parseo automático del body en Next.js
export const config = {
  api: {
    bodyParser: false,
  },
};

// Conexión a PostgreSQL
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
        `SELECT id, title, description, location, start, "end", image_base64
         FROM events
         ORDER BY start ASC`
      );

      return res.status(200).json({ success: true, data: result.rows });
    }

    // === 🟡 POST / PUT / DELETE ===
    if (["POST", "PUT"].includes(req.method)) {
      // Usamos formidable para leer los datos del FormData
      const form = formidable({ multiples: false });

      form.parse(req, async (err, fields, files) => {
        if (err) {
          console.error("❌ Error al procesar FormData:", err);
          return res.status(400).json({ success: false, message: "Error al procesar los datos del formulario." });
        }

        const title = fields.title?.[0] || fields.title;
        const description = fields.description?.[0] || fields.description;
        const location = fields.location?.[0] || fields.location;
        const start = fields.start?.[0] || fields.start;
        const end = fields.end?.[0] || fields.end;

        if (!title || !start || !end) {
          return res.status(400).json({ success: false, message: "Faltan campos obligatorios." });
        }

        let image_base64 = null;
        if (files.image && files.image[0]) {
          const file = files.image[0];
          const data = fs.readFileSync(file.filepath);
          image_base64 = `data:${file.mimetype};base64,${data.toString("base64")}`;
        }

        try {
          if (req.method === "POST") {
            const result = await pool.query(
              `INSERT INTO events (title, description, location, start, "end", image_base64)
               VALUES ($1, $2, $3, $4, $5, $6)
               RETURNING *`,
              [title, description, location, start, end, image_base64]
            );
            return res.status(201).json({ success: true, data: result.rows[0] });
          }

          if (req.method === "PUT") {
            if (!id) return res.status(400).json({ success: false, message: "Falta el ID del evento." });

            const result = await pool.query(
              `UPDATE events
               SET title = $1,
                   description = $2,
                   location = $3,
                   start = $4,
                   "end" = $5,
                   image_base64 = COALESCE($6, image_base64)
               WHERE id = $7
               RETURNING *`,
              [title, description, location, start, end, image_base64, id]
            );

            if (result.rows.length === 0) {
              return res.status(404).json({ success: false, message: "Evento no encontrado." });
            }

            return res.status(200).json({ success: true, data: result.rows[0] });
          }
        } catch (dbError) {
          console.error("❌ Error en base de datos:", dbError);
          return res.status(500).json({ success: false, message: "Error interno en la base de datos." });
        }
      });
      return;
    }

    // === 🔴 DELETE ===
    if (req.method === "DELETE") {
      if (!id) return res.status(400).json({ success: false, message: "Falta el ID del evento." });

      await pool.query("DELETE FROM events WHERE id = $1", [id]);
      return res.status(200).json({ success: true, message: "Evento eliminado correctamente." });
    }

    // === 🚫 MÉTODO NO PERMITIDO ===
    res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
    return res.status(405).json({ success: false, message: `Método ${req.method} no permitido.` });
  } catch (error) {
    console.error("❌ Error general en /api/events:", error);
    return res.status(500).json({ success: false, message: "Error interno del servidor." });
  }
}
