import { Pool } from "pg";
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export default async function handler(req, res) {
  if (req.method === "DELETE") {
    try {
      const { id } = req.query;
      await pool.query("DELETE FROM users WHERE id=$1", [id]);
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: "Error al eliminar usuario" });
    }
  } else {
    return res.status(405).json({ success: false, message: "Método no permitido" });
  }
}
