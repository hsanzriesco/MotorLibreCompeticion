// ===============================================
// API CAR GARAGE (COMPATIBLE CON VERCEL + NEON)
// CRUD completo: GET, POST, PUT, DELETE
// ===============================================

import { Pool } from "pg";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
    const { method } = req;

    try {
        // --------------------------------------------
        // 1. LISTAR COCHES (GET)
        // --------------------------------------------
        if (method === "GET") {
            const { user_id } = req.query;

            if (!user_id) {
                return res.status(400).json({ ok: false, msg: "Falta user_id" });
            }

            const result = await pool.query(
                "SELECT * FROM car_garage WHERE user_id = $1 ORDER BY id DESC",
                [user_id]
            );

            return res.status(200).json({ ok: true, cars: result.rows });
        }

        // --------------------------------------------
        // 2. AGREGAR COCHE (POST)
        // --------------------------------------------
        if (method === "POST") {
            const { user_id, car_name, model, year, description, photo_url } = req.body;

            if (!user_id || !car_name) {
                return res.status(400).json({ ok: false, msg: "Datos incompletos" });
            }

            const query = `
                INSERT INTO car_garage (user_id, car_name, model, year, description, photo_url, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, NOW())
                RETURNING *;
            `;

            const result = await pool.query(query, [
                user_id, car_name, model, year, description, photo_url
            ]);

            return res.status(200).json({ ok: true, msg: "Coche añadido", car: result.rows[0] });
        }

        // --------------------------------------------
        // 3. EDITAR COCHE (PUT)
        // --------------------------------------------
        if (method === "PUT") {
            const { id, car_name, model, year, description, photo_url } = req.body;

            if (!id) {
                return res.status(400).json({ ok: false, msg: "Falta id del coche" });
            }

            const query = `
                UPDATE car_garage
                SET car_name = $1, model = $2, year = $3, description = $4, photo_url = $5
                WHERE id = $6
                RETURNING *;
            `;

            const result = await pool.query(query, [
                car_name, model, year, description, photo_url, id
            ]);

            return res.status(200).json({ ok: true, msg: "Coche actualizado", car: result.rows[0] });
        }

        // --------------------------------------------
        // 4. ELIMINAR COCHE (DELETE)
        // --------------------------------------------
        if (method === "DELETE") {
            const { id } = req.query;

            if (!id) {
                return res.status(400).json({ ok: false, msg: "Falta id" });
            }

            await pool.query("DELETE FROM car_garage WHERE id = $1", [id]);

            return res.status(200).json({ ok: true, msg: "Coche eliminado" });
        }

        // --------------------------------------------
        // MÉTODO NO PERMITIDO
        // --------------------------------------------
        return res.status(405).json({ ok: false, msg: "Método no permitido" });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ ok: false, msg: "Error interno", error: err.message });
    }
}
