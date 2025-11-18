const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors'); 

// ⭐ 1. Importar los Handlers de la API (Usa rutas relativas correctas)
// userAction.js NO está importado, por eso el frontend usa userList.js, que es correcto.
const usersListHandler = require('./api/userList'); 
const loginUserHandler = require('./api/loginUser'); 

const app = express();
const PORT = process.env.PORT || 3000; 

// 2. Middlewares
app.use(cors()); 
app.use(bodyParser.json()); // Necesario para leer req.body en POST/PUT
app.use(express.urlencoded({ extended: true }));

// 3. ⭐ ENRUTAMIENTO DE LA API
// La actualización del usuario llega aquí y es manejada correctamente por userList.js
app.all('/api/usersList', usersListHandler); 
app.post('/api/loginUser', loginUserHandler); 
// Si tienes un userDelete.js:
// app.delete('/api/userDelete', userDeleteHandler); 

// 4. Configuración de Rutas Estáticas
// Esto permite que el navegador encuentre /public/js/users.js y /pages/.../users.html
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'pages'))); 
app.use(express.static(__dirname)); 

// 5. Iniciar el servidor
app.listen(PORT, () => {
    console.log(`✅ Servidor Express corriendo en: http://localhost:${PORT}`);
    console.log(`🔗 Link de usuarios: http://localhost:${PORT}/pages/dashboard/admin/user/users.html`);
});