import pool from "../db.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {
    const { name, email, password } = req.body;
    console.log("📩 Datos recibidos:", req.body);

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Faltan datos" });
    }

    // Insertar en la base de datos
    const result = await pool.query(
      "INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING *",
      [name, email, password]
    );

    console.log("✅ Usuario registrado:", result.rows[0]);
    return res.status(200).json({ success: true, user: result.rows[0] });

  } catch (error) {
    console.error("❌ Error al registrar usuario:", error);
    return res.status(500).json({ error: "Error en el servidor o base de datos" });
  }
}
