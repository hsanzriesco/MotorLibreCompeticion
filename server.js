// server.js

import express from 'express';
// ... otros imports ...
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// --- IMPORTACIONES DE ROUTERS DE API (AÑADE ESTAS LÍNEAS) ---
import eventsRouter from './api/events.js';         // <-- DEBERÍAS TENER ESTO
import motorGarageRouter from './api/motorGarage.js'; // <-- DEBERÍAS TENER ESTO
import resultadosRouter from './api/resultados.js';   // 🚀 NUEVA IMPORTACIÓN
// -----------------------------------------------------------

// ...
// Importaciones de APIs: Debemos dejar de importar resetPasswordHandler si no lo usamos
// import resetPasswordHandler from './api/resetPassword.js'; // <-- COMENTAR O ELIMINAR ESTA LÍNEA

// ...
const app = express();
// ...

// app.use(express.urlencoded({ extended: true }));


app.all('/api/usersList', usersListHandler);
app.post('/api/loginUser', loginUserHandler);

app.all('/api/carGarage', carGarageHandler);

// **¡ELIMINAR ESTA LÍNEA!** Vercel debe manejar api/resetPassword.js directamente.
// app.post('/api/resetPassword', resetPasswordHandler); // <-- ELIMINAR ESTA LÍNEA

// --- CONFIGURACIÓN DE MIDDLEWARE DE RUTAS (AÑADE ESTAS LÍNEAS) ---

// Debes añadir aquí todos los routers que usan Express Router
app.use('/api/events', eventsRouter);         // <-- DEBERÍAS TENER ESTO
app.use('/api/motorGarage', motorGarageRouter); // <-- DEBERÍAS TENER ESTO
app.use('/api/resultados', resultadosRouter);   // 🚀 NUEVA CONFIGURACIÓN

// ...

// app.use(express.static(path.join(__dirname, 'public')));
// ...

app.listen(PORT, () => {
    // ...
});