import express from "express";
import path from "path";
import cors from "cors";
import { fileURLToPath } from "url";
import { dirname } from "path";

// ----------------------------------------------------------------------
// Importación corregida: Usando el nuevo nombre de archivo y función
// ----------------------------------------------------------------------
import { iniciarCierreAutomatico } from "./api/cierre_eventos_automatico.js";

// Rutas API
import usersRouter from "./api/users.js";
import noticiasRoutes from "./api/noticias.js";
import carGarageHandler from "./api/carGarage.js";

// 🛠️ FIX 1: Importar el router de clubes
import clubsRouter from "./api/clubs.js";

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

// 🛠️ FIX 2: Registrar la ruta base de clubes. ¡Esto es lo que faltaba!
app.use("/api/clubs", clubsRouter);

app.use(express.static(path.join(__dirname, "public")));

app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ----------------------------------------------------
// Llamada corregida: Iniciando el proceso de cierre automático
// ----------------------------------------------------
iniciarCierreAutomatico();

app.listen(PORT, () => {
    console.log(`Servidor iniciado en puerto ${PORT}`);
});