
import { Pool } from "pg";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

export default async function handler(req, res) {
    const method = req.method;

    try {
       
        if (method === "GET") {
            const result = await pool.query(
                "SELECT * FROM noticias ORDER BY fecha DESC"
            );
            return res.status(200).json(result.rows);
        }

       
        if (method === "POST") {
            const { titulo, contenido } = req.body;

            if (!titulo || !contenido) {
                return res
                    .status(400)
                    .json({ success: false, message: "Faltan campos requeridos" });
            }

            const result = await pool.query(
                `INSERT INTO noticias (titulo, contenido)
         VALUES ($1, $2)
         RETURNING *`,
                [titulo, contenido]
            );

            return res.status(201).json({
                success: true,
                noticia: result.rows[0],
            });
        }

        
        if (method === "PUT") {
            const { id, titulo, contenido } = req.body;

            if (!id || !titulo || !contenido) {
                return res
                    .status(400)
                    .json({ success: false, message: "Datos insuficientes" });
            }

            const result = await pool.query(
                `UPDATE noticias
         SET titulo = $1, contenido = $2
         WHERE id = $3
         RETURNING *`,
                [titulo, contenido, id]
            );

            return res.status(200).json({
                success: true,
                noticia: result.rows[0],
            });
        }

      
        if (method === "DELETE") {
            const { id } = req.body;

            if (!id) {
                return res
                    .status(400)
                    .json({ success: false, message: "ID requerido" });
            }

            await pool.query("DELETE FROM noticias WHERE id = $1", [id]);

            return res.status(200).json({
                success: true,
                message: "Noticia eliminada",
            });
        }

      
        return res.status(405).json({
            success: false,
            message: "Método no permitido",
        });
    } catch (error) {
        console.error("### ERROR EN /api/noticias ###");
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Error interno del servidor",
        });
    }
}
