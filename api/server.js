// ⚙️ server.js (Archivo Principal del Servidor - Crear en la Raíz)

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors'); 

// 1. Importar los handlers de la API (usan require porque las APIs usan module.exports)
const usersListHandler = require('./api/usersList'); 
const loginUserHandler = require('./api/loginUser'); 

const app = express();
const PORT = process.env.PORT || 3000; 

// 2. Middlewares
app.use(cors()); 
app.use(bodyParser.json()); 
app.use(express.urlencoded({ extended: true }));

// 3. ⭐ CONFIGURACIÓN DEL ENRUTAMIENTO DE LA API (PRIORIDAD ALTA) ⭐
// Esto le dice al servidor qué función usar para la ruta /api/usersList
app.all('/api/usersList', usersListHandler); 
app.post('/api/loginUser', loginUserHandler); 

// 4. Configuración de Rutas Estáticas (VA DESPUÉS DE LA API)
// Esto permite que el navegador encuentre los archivos referenciados en HTML
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'pages'))); 
app.use(express.static(__dirname)); // Para index.html si está en la raíz

// 5. Iniciar el servidor
app.listen(PORT, () => {
    console.log(`✅ Servidor Express corriendo en: http://localhost:${PORT}`);
    console.log(`🔗 Link de usuarios: http://localhost:${PORT}/dashboard/admin/user/users.html`);
});