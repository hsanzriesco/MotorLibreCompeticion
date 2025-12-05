import express from "express";
import path from "path";
import cors from "cors";
import { fileURLToPath } from "url";
import { dirname } from "path";

// Rutas API
import usersCombinedHandler from "./api/users.js";
import noticiasRoutes from "./api/noticias.js";
import carGarageHandler from "./api/carGarage.js";
// Añade aquí tus otros handlers…


// ----------------------------------------
// CONFIGURACIÓN BASE
// ----------------------------------------

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json()); // NECESARIO para tu login y CRUD
app.use(express.urlencoded({ extended: true }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


// ----------------------------------------
// RUTAS API
// ----------------------------------------

// 🔥 Ruta correcta: TODAS las acciones de usuario pasan por usersCombinedHandler
app.use("/api/users", usersCombinedHandler);

// Otras rutas:
app.use("/api/noticias", noticiasRoutes);
app.use("/api/carGarage", carGarageHandler);



// ----------------------------------------
// SERVIR FRONTEND
// ----------------------------------------

app.use(express.static(path.join(__dirname, "public")));

app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});



// ----------------------------------------
// INICIO DEL SERVIDOR
// ----------------------------------------

app.listen(PORT, () => {
    console.log(`Servidor iniciado en puerto ${PORT}`);
});
