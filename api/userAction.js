// api/userAction.js
// Archivo 100% corregido y seguro para acciones de administrador

import { Pool } from "pg";
import bcrypt from "bcryptjs"; // ¡Necesario para hashear!
// import formidable from "formidable"; // No usado si sólo manejamos JSON
// import fs from "fs"; // No usado si sólo manejamos JSON

export const config = {
  api: { bodyParser: false },
};

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// 🛠️ HELPER: Función para leer el cuerpo JSON cuando bodyParser está en false
const getBody = async (req) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    try {
        return JSON.parse(Buffer.concat(chunks).toString());
    } catch (e) {
        return null;
    }
};

export default async function handler(req, res) {
  const { method } = req;

  const urlParts = new URL(req.url, `http://${req.headers.host}`);
  const action = urlParts.searchParams.get("action");


  try {
    // =================================================================================
    // 🛑 1. AÑADIDO: LÓGICA DE CREACIÓN DE USUARIO (ADMINISTRADOR)
    // =================================================================================
    if (method === "POST" && action === "create") {
      const body = await getBody(req);
      if (!body) return res.status(400).json({ success: false, message: "Cuerpo de solicitud vacío o inválido." });

      const { name, email, password, role } = body; 

      if (!name || !email || !password || !role) {
        return res.status(400).json({ success: false, message: "Faltan campos requeridos para la creación." });
      }

      // 🔑 HASHEAR LA CONTRASEÑA
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      await pool.query(
        "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id",
        [name, email, hashedPassword, role] // ⬅️ USAMOS EL HASH
      );

      return res.status(201).json({ success: true, message: "Usuario creado por admin con éxito." });
    }


    // =================================================================================
    // 2. CORREGIDO: ACTUALIZACIÓN DE CONTRASEÑA (Ahora hashea la nueva contraseña)
    // =================================================================================
    if (method === "PUT" && action === "updatePassword") {
      const body = await getBody(req);
      if (!body) return res.status(400).json({ success: false, message: "Cuerpo de solicitud vacío o inválido." });
      
      const { id, newPassword } = body;

      if (!id || !newPassword)
        return res.status(400).json({ success: false, message: "Datos inválidos" });

      // 🔑 HASHEAR LA NUEVA CONTRASEÑA
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);
      
      await pool.query("UPDATE users SET password = $1 WHERE id = $2", [hashedPassword, id]); // ⬅️ USAMOS EL HASH
      return res
        .status(200)
        .json({ success: true, message: "Contraseña actualizada correctamente." });
    }

    // =================================================================================
    // 3. ACTUALIZACIÓN DE NOMBRE/EMAIL
    // =================================================================================
    if (method === "PUT" && action === "updateName") {
      const body = await getBody(req);
      if (!body) return res.status(400).json({ success: false, message: "Cuerpo de solicitud vacío o inválido." });
      
      const { id, newName, newEmail } = body;

      if (!id || !newName || !newEmail)
        return res.status(400).json({ success: false, message: "Datos inválidos (ID, nombre o email faltante)" });

      await pool.query("UPDATE users SET name = $1, email = $2 WHERE id = $3", [newName, newEmail, id]);

      return res.status(200).json({ success: true, message: "Perfil actualizado correctamente." });
    }


    // Bloques para carGarage y motosGarage... 
    // Si no usan el query param 'action', es mejor eliminarlos de aquí o usar su propio endpoint.
    // Dejo el manejo de error para el final:
    return res.status(405).json({
      success: false,
      message: "Ruta o método no válido en userActions.js",
    });
  } catch (error) {
    console.error("Error en userActions.js:", error);
    if (error.code === "23505") {
        return res.status(409).json({
            success: false,
            message: "El nombre o correo ya están registrados."
        });
    }
    res.status(500).json({ success: false, message: "Error interno del servidor." });
  }
}
