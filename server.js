// server.js (Modificado para usar import)

import express from 'express';
// ... otros imports ...
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import noticiasRoutes from "./api/noticias.js";

// --- CÓDIGO AÑADIDO PARA MANEJAR ARCHIVOS ESTÁTICOS ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express(); // Inicialización de Express
const PORT = process.env.PORT || 3000; // Define un puerto, usa el de entorno si existe

// Middlewares necesarios
app.use(express.json());
app.use(cors());

// MODIFICACIÓN CLAVE: Configura Express para servir todos los archivos estáticos desde la raíz.
app.use(express.static(__dirname));
// ----------------------------------------------------

app.all('/api/users', usersListHandler);
app.post('/api/users', loginUserHandler);

app.all('/api/carGarage', carGarageHandler);
app.use("/api/noticias", noticiasRoutes);


// **¡ELIMINAR ESTA LÍNEA!** Vercel debe manejar api/resetPassword.js directamente.
// app.post('/api/resetPassword', resetPasswordHandler); // <-- ELIMINAR ESTA LÍNEA

// ...
// app.use(express.static(path.join(__dirname, 'public')));
// ...

app.listen(PORT, () => {
    // ...
});