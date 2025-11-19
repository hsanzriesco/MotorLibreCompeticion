const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors'); 

// ⭐ 1. Importar los Handlers de la API
// Si userList.js usa 'export default', require lo envuelve en la propiedad 'default'.
const userListModule = require('./api/userList'); 
const usersListHandler = userListModule.default || userListModule; // Accede al 'default' si existe

const loginUserModule = require('./api/loginUser'); 
const loginUserHandler = loginUserModule.default || loginUserModule;

// Asumo que el handler de coches también necesita esta corrección si usa 'export default'
const carGarageModule = require('./api/userAction'); 
const carGarageHandler = carGarageModule.default || carGarageModule; 

const app = express();
const PORT = process.env.PORT || 3000; 

// 2. Middlewares
app.use(cors()); 
app.use(bodyParser.json()); 
app.use(express.urlencoded({ extended: true }));

// 3. ⭐ ENRUTAMIENTO DE LA API

// ✅ Esta ruta debe dejar de dar 404 tras la corrección de importación
app.all('/api/usersList', usersListHandler); 
app.post('/api/loginUser', loginUserHandler); 

// Ruta de Coches/Garaje
app.all('/api/carGarage', carGarageHandler); 

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