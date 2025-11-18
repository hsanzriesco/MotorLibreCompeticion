const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors'); 

// ⭐ 1. Importar los Handlers de la API (Asegúrate que el archivo exista en ./api/)
const usersListHandler = require('./api/userList'); 
const loginUserHandler = require('./api/loginUser'); 
// 💡 NUEVO: Importa el handler de coches. Asumimos que se llama carGarage.js
const carGarageHandler = require('./api/userAction'); // O './api/carGarage' si lo renombraste

const app = express();
const PORT = process.env.PORT || 3000; 

// 2. Middlewares
app.use(cors()); 
app.use(bodyParser.json()); 
app.use(express.urlencoded({ extended: true }));

// 3. ⭐ ENRUTAMIENTO DE LA API (Debe ir antes de archivos estáticos)

// Rutas de Usuario (GET, POST, PUT, DELETE)
app.all('/api/usersList', usersListHandler); 
app.post('/api/loginUser', loginUserHandler); 

// 💡 NUEVO: Ruta de Coches/Garaje
// Esto permite que el frontend llame a /api/carGarage
app.all('/api/carGarage', carGarageHandler); // Usamos 'app.all' para cubrir GET, POST, PUT, DELETE

// 4. Configuración de Rutas Estáticas
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'pages'))); 
app.use(express.static(__dirname)); 

// 5. Iniciar el servidor
app.listen(PORT, () => {
    console.log(`✅ Servidor Express corriendo en: http://localhost:${PORT}`);
    console.log(`🔗 Link de usuarios: http://localhost:${PORT}/pages/dashboard/admin/user/users.html`);
});

// module.exports = app;