import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Método no permitido" });
  }

  try {
    const result = await pool.query("SELECT id, name, email, role FROM users ORDER BY id ASC");
    return res.status(200).json({ success: true, users: result.rows });
  } catch (error) {
    console.error("❌ Error en /api/usersList:", error);
    return res.status(500).json({ success: false, message: "Error al obtener usuarios" });
  }
}
