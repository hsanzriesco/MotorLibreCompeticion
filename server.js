import express from "express";
import path from "path";
import cors from "cors";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { iniciarCierreAutomatico } from "./api/cierre_eventos_automatico.js";
import usersRouter from "./api/users.js";
import noticiasRoutes from "./api/noticias.js";
import carGarageHandler from "./api/carGarage.js";
const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
app.use("/api/users", usersRouter);
app.use("/api/noticias", noticiasRoutes);
app.use("/api/carGarage", carGarageHandler);
app.use(express.static(path.join(__dirname, "public")));
app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});
iniciarCierreAutomatico();
app.listen(PORT, () => {
    console.log(`Servidor iniciado en puerto ${PORT}`);
});