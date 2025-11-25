import { Pool } from "pg";
import formidable from "formidable";
import fs from "fs";

export const config = {
  api: { bodyParser: false },
};

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export default async function handler(req, res) {
  const { method, url } = req;

  try {
    if (method === "PUT" && url.includes("/updateName")) {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString());
      const { id, newName } = body;

      if (!id || !newName)
        return res.status(400).json({ success: false, message: "Datos inválidos" });

      await pool.query("UPDATE users SET name = $1 WHERE id = $2", [newName, id]);
      return res.status(200).json({ success: true, message: "Nombre actualizado correctamente." });
    }
    if (method === "PUT" && url.includes("/updatePassword")) {
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
    if (method === "POST" && url.includes("/addCar")) {
      const form = formidable({ multiples: false });

      form.parse(req, async (err, fields, files) => {
        if (err) {
          console.error("Error al procesar el archivo:", err);
          return res.status(500).json({ success: false, message: "Error al procesar archivo" });
        }
        const userId = Array.isArray(fields.userId) ? fields.userId[0] : fields.userId;
        const carName = Array.isArray(fields.carName) ? fields.carName[0] : fields.carName;

        if (!userId || !carName)
          return res.status(400).json({ success: false, message: "Datos incompletos" });

        let imageUrl = null;

        if (files.carImage && files.carImage[0]) {
          const file = files.carImage[0];
          const uploadsDir = "./public/uploads";

          if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

          const newPath = `${uploadsDir}/${Date.now()}_${file.originalFilename}`;
          fs.renameSync(file.filepath, newPath);
          imageUrl = `/uploads/${Date.now()}_${file.originalFilename}`;
        }

        await pool.query(
          "INSERT INTO cars (user_id, name, image_url) VALUES ($1, $2, $3)",
          [userId, carName, imageUrl]
        );

        res.status(200).json({ success: true, message: "Coche añadido correctamente." });
      });
      return;
    }
    if (method === "GET" && url.includes("/getCars")) {
      const userId = new URL(req.url, `http://${req.headers.host}`).searchParams.get("userId");

      if (!userId)
        return res.status(400).json({ success: false, message: "Falta el ID del usuario." });

      const { rows } = await pool.query("SELECT * FROM cars WHERE user_id = $1", [userId]);
      return res.status(200).json({ success: true, cars: rows });
    }
    return res.status(405).json({
      success: false,
      message: "Ruta o método no válido en userActions.js",
    });
  } catch (error) {
    console.error("Error en userActions.js:", error);
    res.status(500).json({ success: false, message: "Error interno del servidor." });
  }
}
