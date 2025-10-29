// ⚙️ index.js (o server.js) - Archivo Principal del Servidor

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors'); 

// ⭐ Importar los handlers de la API (usan la ruta relativa a este archivo)
const usersListHandler = require('./api/usersList'); 
const loginUserHandler = require('./api/loginUser'); 
// Asumo que userDelete.js no es necesario, ya que userList.js maneja DELETE.

const app = express();
// Puerto de desarrollo estándar, asegúrate de iniciar tu servidor con este puerto.
const PORT = process.env.PORT || 3000; 

// 3. Middlewares
app.use(cors()); 
app.use(bodyParser.json()); 
app.use(express.urlencoded({ extended: true }));

// 4. Configuración de Rutas Estáticas
// Mapea las carpetas para que el navegador pueda acceder a sus archivos.
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'pages'))); 
app.use(express.static(__dirname));

// 5. ⭐ CONFIGURACIÓN DEL ENRUTAMIENTO DE LA API ⭐
// Esto conecta la URL del navegador con el código handler correspondiente.

// usersList.js maneja GET, POST, PUT, DELETE para la gestión de usuarios
app.all('/api/usersList', usersListHandler); 

// Rutas individuales para otras APIs (asumiendo que loginUser.js sólo usa POST)
app.post('/api/loginUser', loginUserHandler); 

// 6. Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en: http://localhost:${PORT}`);
    console.log(`Para ver los usuarios, ve a: http://localhost:${PORT}/dashboard/admin/user/users.html`);
});