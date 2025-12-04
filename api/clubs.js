import { Pool } from "pg";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

export default async function handler(req, res) {
    const { method, query } = req;

    try {
        // ============================================================
        // 1️⃣ GET /api/clubs → LISTAR TODOS LOS CLUBES
        // ============================================================
        if (method === "GET" && !query.id && !query.action) {
            const result = await pool.query(`
                SELECT id, nombre_evento, descripcion, imagen_club, fecha_creacion
                FROM clubs
                ORDER BY id DESC
            `);

            return res.status(200).json({
                success: true,
                data: result.rows,
            });
        }

        // ============================================================
        // 2️⃣ GET /api/clubs?id=ID&action=miembros → LISTAR MIEMBROS
        // ============================================================
        if (method === "GET" && query.id && query.action === "miembros") {
            const result = await pool.query(
                `
                SELECT u.id, u.name AS nombre, u.email
                FROM users u 
                JOIN club_members cm ON u.id = cm.user_id
                WHERE cm.club_id = $1
                `,
                [query.id]
            );

            return res.status(200).json({
                success: true,
                data: result.rows,
            });
        }

        // ============================================================
        // 3️⃣ POST /api/clubs → CREAR CLUB
        // ============================================================
        if (method === "POST" && !query.action) {
            const { nombre_evento, descripcion, imagen_club } = req.body;

            if (!nombre_evento) {
                return res
                    .status(400)
                    .json({ success: false, message: "Falta nombre_evento" });
            }

            const result = await pool.query(
                `
                INSERT INTO clubs (nombre_evento, descripcion, imagen_club)
                VALUES ($1, $2, $3)
                RETURNING *
                `,
                [nombre_evento, descripcion, imagen_club]
            );

            return res.status(201).json({
                success: true,
                data: result.rows[0],
            });
        }

        // ============================================================
        // 4️⃣ POST /api/clubs?action=join → UNIRSE A UN CLUB
        // ============================================================
        if (method === "POST" && query.action === "join") {
            const { club_id, user_id } = req.body;

            if (!club_id || !user_id) {
                return res.status(400).json({
                    success: false,
                    message: "club_id y user_id requeridos",
                });
            }

            const exists = await pool.query(
                `
                SELECT * FROM club_members 
                WHERE club_id = $1 AND user_id = $2
                `,
                [club_id, user_id]
            );

            if (exists.rows.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: "El usuario ya está en el club",
                });
            }

            await pool.query(
                `
                INSERT INTO club_members (club_id, user_id)
                VALUES ($1, $2)
                `,
                [club_id, user_id]
            );

            return res.status(200).json({
                success: true,
                message: "Unido correctamente",
            });
        }

        // ============================================================
        // MÉTODO NO PERMITIDO
        // ============================================================
        return res.status(405).json({
            success: false,
            message: "Método no permitido",
        });

    } catch (error) {
        console.error("ERROR EN /api/clubs:", error);

        return res.status(500).json({
            success: false,
            message: "Error en el servidor",
        });
    }
}
