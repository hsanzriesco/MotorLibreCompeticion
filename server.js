// server.js

// 1. IMPORTAR LIBRERÍAS (CommonJS)
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');
const { v2: cloudinary } = require('cloudinary'); // ⭐ CLOUDINARY
require('dotenv').config(); // ⭐ DOTENV para variables de entorno

// 2. CONFIGURACIÓN DE CLOUDINARY
const cloudinaryConfig = cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
}, true); // El 'true' asegura que se use esta configuración globalmente.

// ⭐ 3. Importar los Handlers de la API (Ahora carGarage es un Router)
const userListModule = require('./api/userList');
const usersListHandler = userListModule.default || userListModule;

const loginUserModule = require('./api/loginUser');
const loginUserHandler = loginUserModule.default || loginUserModule;

// Importamos el router del garaje (ya corregido a CommonJS)
const carGarageRouter = require('./api/carGarage');

const app = express();
const PORT = process.env.PORT || 3000;

// 4. Middlewares
app.use(cors());

// ⭐ NO USAR bodyParser.json() aquí para las rutas que usan Formidable (POST/PUT de carGarage)
// bodyParser.json() y express.json() interferirían con la subida de archivos.
// app.use(bodyParser.json()); 
// app.use(express.urlencoded({ extended: true }));

// Solo aplicamos el middleware JSON a rutas específicas si es necesario, 
// pero en este caso, la mayoría de tus handlers lo usarán implícitamente si son routers separados.
// Si necesitas un handler JSON para otras rutas (como login/userList):
app.use((req, res, next) => {
    // Solo si la ruta NO es carGarage o si el método NO es POST/PUT, aplicamos JSON parser.
    if (!req.url.startsWith('/api/carGarage') || (req.method !== 'POST' && req.method !== 'PUT')) {
        bodyParser.json()(req, res, next);
    } else {
        next();
    }
});


// 5. ⭐ ENRUTAMIENTO DE LA API

app.all('/api/usersList', usersListHandler);
app.post('/api/loginUser', loginUserHandler);

// Ruta de Coches/Garaje: Usamos el Router, que manejará POST/PUT con Formidable.
app.use('/api/carGarage', carGarageRouter);

// 6. Configuración de Rutas Estáticas
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'pages')));
app.use(express.static(__dirname));

// 7. Iniciar el servidor
app.listen(PORT, () => {
    console.log(`✅ Servidor Express corriendo en: http://localhost:${PORT}`);
    console.log(`🔗 Link de usuarios: http://localhost:${PORT}/pages/dashboard/admin/user/users.html`);
});

module.exports = app;