import { Pool } from "pg";
import formidable from "formidable";
import fs from "fs";
import bcrypt from "bcryptjs";

export const config = {
  api: { bodyParser: false },
};

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export default async function handler(req, res) {
  const { method } = req;

  // 🛑 CAMBIO CLAVE 1: Leer el parámetro 'action' de la URL
  const urlParts = new URL(req.url, `http://${req.headers.host}`);
  const action = urlParts.searchParams.get("action");


  try {
    // MODIFICACIÓN DEL BLOQUE: Usamos el parámetro 'action' en lugar de url.includes
    if (method === "PUT" && action === "updateName") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString());

      const { id, newName, newEmail } = body;

      if (!id || !newName || !newEmail)
        return res.status(400).json({ success: false, message: "Datos inválidos (ID, nombre o email faltante)" });

      await pool.query("UPDATE users SET name = $1, email = $2 WHERE id = $3", [newName, newEmail, id]);

      return res.status(200).json({ success: true, message: "Perfil actualizado correctamente." });
    }

    // MODIFICACIÓN DEL BLOQUE: Usamos el parámetro 'action' en lugar de url.includes
    if (method === "PUT" && action === "updatePassword") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString());
      const { id, newPassword } = body;

      if (!id || !newPassword)
        return res.status(400).json({ success: false, message: "Datos inválidos" });

      await pool.query("UPDATE users SET password = $1 WHERE id = $2", [newPassword, id]);
      return res
        .status(200)
        .json({ success: true, message: "Contraseña actualizada correctamente." });
    }

    // 🛑 CAMBIO CLAVE 2: Modificar los bloques POST/GET que usan url.includes para usar 'action'
    // NOTA: Para POST/GET de coches, generalmente usas un archivo API distinto (carGarage.js, motosGarage.js)
    // PERO si quieres mantenerlos aquí, debes cambiar la forma en que los compruebas.

    // Por simplicidad, si los archivos de coches están en API separadas, eliminamos los siguientes bloques.
    // Si tu estructura es la que se ve en la imagen:
    // api/carGarage.js
    // api/motosGarage.js
    // ¡Entonces estos bloques de coche en userAction.js NO tienen sentido y deben eliminarse!

    // Asumiendo que SÍ usan userAction.js:
    if (method === "POST" && urlParts.pathname.includes("/addCar")) {
      // ... (lógica addCar) ...
      // NOTA: Si usas query parameters, debería ser: if (method === "POST" && action === "addCar")
    }
    if (method === "GET" && urlParts.pathname.includes("/getCars")) {
      // ... (lógica getCars) ...
      // NOTA: Si usas query parameters, debería ser: if (method === "GET" && action === "getCars")
    }

    // Si la ruta base es golpeada sin la acción PUT/updateName, o no coincide
    return res.status(405).json({
      success: false,
      message: "Ruta o método no válido en userActions.js",
    });
  } catch (error) {
    console.error("Error en userActions.js:", error);
    res.status(500).json({ success: false, message: "Error interno del servidor." });
  }
}
