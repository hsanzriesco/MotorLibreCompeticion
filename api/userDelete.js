import express from "express";
import User from "../models/User.js";
const router = express.Router();

router.delete("/deleteUser", async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.json({ success: false, message: "ID de usuario no proporcionado." });
    }

    const deletedUser = await User.findByIdAndDelete(userId);

    if (!deletedUser) {
      return res.json({ success: false, message: "Usuario no encontrado para eliminar." });
    }

    res.json({ success: true, message: "Usuario eliminado correctamente." });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: "Error al eliminar el usuario." });
  }
});

export default router;
