// Archivo: /api/createUser.js

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Método no permitido" });
  }

  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ success: false, error: "Faltan campos obligatorios" });
  }

  try {
    // Aquí podrías guardar en una base de datos real
    console.log("Nuevo usuario creado:", { username, email });

    return res.status(200).json({ success: true, message: "Usuario registrado correctamente" });
  } catch (error) {
    console.error("Error al crear usuario:", error);
    return res.status(500).json({ success: false, error: "Error interno del servidor" });
  }
}
