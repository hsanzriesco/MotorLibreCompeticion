// server.js (Modificado para usar import)

import express from 'express';
// ... otros imports ...
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import noticiasRoutes from "./api/noticias.js";



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