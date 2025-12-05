// server.js (Modificado para usar import)

import express from 'express';
// ... otros imports ...
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';
import noticiasRoutes from "./api/noticias.js";

// --- INICIO: Configuración de Rutas para ES Modules ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// --- FIN: Configuración de Rutas para ES Modules ---

const app = express();
const PORT = 3000; // Asume el puerto 3000, cámbialo si es necesario

// Middleware
app.use(cors());
app.use(express.json()); // Para manejar cuerpos JSON en peticiones POST

// --- INICIO: Middleware de Archivos Estáticos (SOLUCIÓN) ---
// Configura Express para servir archivos estáticos (HTML, CSS, JS)
// desde la raíz del proyecto. Esto habilita el acceso directo
// a rutas como /dashboard/admin/adminCalendario/adminCalendario.html
app.use(express.static(__dirname));
// --- FIN: Middleware de Archivos Estáticos (SOLUCIÓN) ---


// Rutas API (Tus rutas existentes)
app.all('/api/users', usersListHandler);
app.post('/api/users', loginUserHandler);
app.all('/api/carGarage', carGarageHandler);
app.use("/api/noticias", noticiasRoutes);


// Nota: Asegúrate de que todas tus funciones (usersListHandler, loginUserHandler,
// carGarageHandler, etc.) estén definidas o importadas en este archivo
// o Express no iniciará.

app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
});