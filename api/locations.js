import { Pool } from "pg";

export default async function handler(req, res) {
    const { id } = req.query;
    let pool;
    let client;

   
    if (!process.env.DATABASE_URL) {
        return res.status(500).json({ success: false, message: "Error de configuración: Falta la variable DATABASE_URL." });
    }

    try {
       
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false },
        });
        client = await pool.connect();

       
        if (req.method === "GET") {
            if (id) {
                
                const result = await client.query(
                    `SELECT id, name, address, city, country, capacity FROM event_locations WHERE id = $1`,
                    [id]
                );
                if (result.rows.length === 0) {
                    return res.status(404).json({ success: false, message: "Lugar no encontrado." });
                }
                return res.status(200).json({ success: true, data: result.rows[0] });
            } else {
             
                const result = await client.query(
                    `SELECT id, name, address, city, country, capacity FROM event_locations ORDER BY name ASC`
                );
                return res.status(200).json({ success: true, data: result.rows });
            }
        }

       
        if (req.method === "POST") {
            const { name, address, city, country, capacity } = req.body;

            if (!name) {
                return res.status(400).json({ success: false, message: "El nombre del lugar es obligatorio." });
            }

            const result = await client.query(
                `INSERT INTO event_locations (name, address, city, country, capacity) 
                 VALUES ($1, $2, $3, $4, $5) 
                 RETURNING *`,
                [name, address, city, country || 'España', capacity ? parseInt(capacity) : null]
            );

            return res.status(201).json({ success: true, message: "Lugar creado correctamente.", data: result.rows[0] });
        }

        
        if (req.method === "PUT") {
            if (!id) return res.status(400).json({ success: false, message: "Falta el ID del lugar." });

            const { name, address, city, country, capacity } = req.body;

            if (!name) {
                return res.status(400).json({ success: false, message: "El nombre del lugar es obligatorio." });
            }

            const result = await client.query(
                `UPDATE event_locations 
                 SET name = $1, address = $2, city = $3, country = $4, capacity = $5
                 WHERE id = $6
                 RETURNING *`,
                [name, address, city, country || 'España', capacity ? parseInt(capacity) : null, id]
            );

            if (result.rows.length === 0) return res.status(404).json({ success: false, message: "Lugar no encontrado." });
            return res.status(200).json({ success: true, message: "Lugar actualizado correctamente.", data: result.rows[0] });
        }

       
        if (req.method === "DELETE") {
            if (!id) return res.status(400).json({ success: false, message: "Falta el ID del lugar." });

            const result = await client.query("DELETE FROM event_locations WHERE id = $1 RETURNING id", [id]);

            if (result.rows.length === 0) return res.status(404).json({ success: false, message: "Lugar no encontrado." });
            return res.status(200).json({ success: true, message: "Lugar eliminado correctamente." });
        }

        
        res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
        return res.status(405).json({ success: false, message: `Método ${req.method} no permitido.` });

    } catch (error) {
        console.error("Error en /api/locations:", error);
       
        let errorMessage = 'Error interno del servidor.';
        if (error.code === '42P01') {
            errorMessage = 'Error: La tabla "event_locations" no existe. Asegúrate de crearla en tu base de datos.';
        }
        return res.status(500).json({ success: false, message: errorMessage });
    } finally {
        if (client) {
            client.release();
        }
    }
}
