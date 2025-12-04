// api/userList.js

import { Pool } from "pg";
import bcrypt from "bcryptjs";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

export default async function handler(req, res) {
    const { method } = req;

    try {
        // =====================================================================
        // GET: LISTAR TODOS LOS USUARIOS (AHORA INCLUYE club_id)
        // =====================================================================
        if (method === "GET") {
            const result = await pool.query(
                "SELECT id, name, email, role, created_at, club_id FROM users ORDER BY id DESC"
            );
            return res.status(200).json({ success: true, data: result.rows });
        }

        // =====================================================================
        // POST: CREAR NUEVO USUARIO (HASH PASSWORD)
        // =====================================================================
        if (method === "POST") {
            const { name, email, password, role } = req.body;

            if (!name || !email || !password || !role) {
                return res.status(400).json({ success: false, message: "Faltan campos requeridos." });
            }

            const existingUser = await pool.query(
                "SELECT id FROM users WHERE email = $1 OR name = $2",
                [email, name]
            );

            if (existingUser.rows.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: "El nombre o correo ya están registrados.",
                });
            }

            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            const result = await pool.query(
                "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, club_id",
                [name, email, hashedPassword, role]
            );

            return res.status(201).json({ success: true, user: result.rows[0] });
        }

        // =====================================================================
        // PUT: ACTUALIZAR USUARIO O UNIRLO A UN CLUB
        // =====================================================================
        if (method === "PUT") {
            const { id } = req.query;
            const { name, email, password, role, club_id } = req.body;

            if (!id) {
                return res.status(400).json({ success: false, message: "ID requerido" });
            }

            // Si intenta unirse a un club → comprobar que no está en otro
            if (club_id !== undefined && club_id !== null) {
                const userCheck = await pool.query(
                    "SELECT club_id FROM users WHERE id = $1",
                    [id]
                );

                if (userCheck.rows[0].club_id !== null) {
                    return res.status(400).json({
                        success: false,
                        message: "El usuario ya pertenece a un club.",
                    });
                }
            }

            let hashedPassword = undefined;

            if (password) {
                const salt = await bcrypt.genSalt(10);
                hashedPassword = await bcrypt.hash(password, salt);
            }

            const updateQuery = `
                UPDATE users
                SET name = COALESCE($1, name),
                    email = COALESCE($2, email),
                    role = COALESCE($3, role),
                    password = COALESCE($4, password),
                    club_id = $5
                WHERE id = $6
                RETURNING id, name, email, role, created_at, club_id
            `;

            const result = await pool.query(updateQuery, [
                name || null,
                email || null,
                role || null,
                hashedPassword || null,
                club_id ?? null,
                id
            ]);

            return res.status(200).json({ success: true, user: result.rows[0] });
        }

        // =====================================================================
        // DELETE
        // =====================================================================
        if (method === "DELETE") {
            const { id } = req.query;
            if (!id) return res.status(400).json({ success: false, message: "ID faltante." });

            await pool.query("DELETE FROM users WHERE id = $1", [id]);

            return res.status(200).json({ success: true, message: "Usuario eliminado" });
        }

        return res.status(405).json({ success: false, message: "Método no permitido." });

    } catch (error) {
        console.error("Error en userList.js:", error);

        if (error.code === "23505") {
            return res.status(409).json({ success: false, message: "Nombre o correo ya registrados." });
        }

        return res.status(500).json({ success: false, message: "Error interno." });
    }
}
