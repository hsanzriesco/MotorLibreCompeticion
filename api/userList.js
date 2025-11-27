// api/userList.js
// Maneja GET (listar), POST (crear con hashing), y DELETE

import { Pool } from "pg";
import bcrypt from "bcryptjs";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

export default async function handler(req, res) {
    const { method } = req;

    try {
        // =================================================================================
        // GET: LISTAR TODOS LOS USUARIOS
        // =================================================================================
        if (method === "GET") {
            const result = await pool.query(
                "SELECT id, name, email, role, created_at FROM users ORDER BY id DESC"
            );
            return res.status(200).json({ success: true, data: result.rows });
        }

        // =================================================================================
        // POST: CREAR NUEVO USUARIO (Con HASHING de contraseña)
        // =================================================================================
        if (method === "POST") {
            const { name, email, password, role } = req.body;

            if (!name || !email || !password || !role) {
                return res.status(400).json({ success: false, message: "Faltan campos requeridos." });
            }

            // 1. Verificar si el usuario ya existe
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

            // 2. 🔑 HASHEO DE CONTRASEÑA
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            // 3. Insertar el nuevo usuario con la contraseña hasheada
            const result = await pool.query(
                "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role",
                [name, email, hashedPassword, role]
            );

            return res.status(201).json({ success: true, user: result.rows[0] });
        }

        // =================================================================================
        // DELETE: ELIMINAR USUARIO
        // =================================================================================
        if (method === "DELETE") {
            const { id } = req.query;
            if (!id) return res.status(400).json({ success: false, message: "ID de usuario faltante." });

            await pool.query("DELETE FROM users WHERE id = $1", [id]);

            return res.status(200).json({ success: true, message: "Usuario eliminado correctamente." });
        }

        // =================================================================================
        // PUT: ACTUALIZAR (Placeholder)
        // =================================================================================
        if (method === "PUT") {
            // Este método se deja aquí para mostrar que no está implementado en este archivo.
            return res.status(405).json({ success: false, message: "Método PUT no implementado en userList.js." });
        }

        // Método no permitido
        return res.status(405).json({ success: false, message: "Método no permitido." });

    } catch (error) {
        console.error("Error en userList.js:", error);
        // Manejo de error de restricción única
        if (error.code === "23505") {
            return res.status(409).json({ success: false, message: "El nombre o correo ya están registrados." });
        }
        return res.status(500).json({ success: false, message: "Error interno del servidor." });
    }
}