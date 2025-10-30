import { Pool } from "pg";

// Asegúrate de usar el mismo pool de conexión
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export default async function handler(req, res) {
  // En Next.js, el ID se accede a través de req.query
  const { id } = req.query; 

  // Es crucial verificar que la petición tenga un ID
  if (!id) {
    return res.status(400).json({ success: false, message: "Falta el ID del evento" });
  }

  try {
    // === LÓGICA PUT (ACTUALIZAR) ===
    if (req.method === "PUT") {
      // NOTA IMPORTANTE: Si estás enviando 'FormData' (con la imagen), 
      // y no estás usando un middleware como 'multer', el 'req.body' 
      // podría estar vacío y necesitarías un parser especial. 
      // *Asumiendo que envías un JSON estándar por ahora:*
      const { title, description, location, start, end, image_base64 } = req.body;

      if (!title || !start || !end) {
        return res.status(400).json({ success: false, message: "Faltan campos obligatorios" });
      }

      const result = await pool.query(
        `UPDATE events
         SET title = $1,
             description = $2,
             location = $3,
             start = $4,
             "end" = $5,
             image_base64 = $6
         WHERE id = $7
         RETURNING *`,
        [title, description, location, start, end, image_base64 || null, id]
      );
      
      if (result.rows.length === 0) {
          return res.status(404).json({ success: false, message: "Evento no encontrado" });
      }

      return res.status(200).json({ success: true, data: result.rows[0] });
    }

    // === LÓGICA DELETE (ELIMINAR) ===
    if (req.method === "DELETE") {
      await pool.query("DELETE FROM events WHERE id = $1", [id]);
      return res.status(200).json({ success: true, message: "Evento eliminado" });
    }
    
    // Si no es PUT ni DELETE (ni GET, que ahora está en events.js)
    res.setHeader("Allow", ["PUT", "DELETE"]);
    return res.status(405).json({ success: false, message: `Método ${req.method} no permitido` });

  } catch (error) {
    console.error(`❌ Error en /api/events/${id}:`, error);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
}