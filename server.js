// **USANDO SINTAXIS ES MODULES (import)**
import express from 'express';
// body-parser puede ser reemplazado por el middleware nativo de express (si usas Express 4.16+)
// Pero si lo necesitas por separado:
import bodyParser from 'body-parser'; 
import path from 'path';
import cors from 'cors'; 
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Configuración para __dirname en ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Importación correcta de manejadores de API (asumiendo que las APIs ahora usan export default)
import usersListHandler from './api/userList.js';
import loginUserHandler from './api/loginUser.js';
import carGarageHandler from './api/userAction.js'; 
// Asegúrate de importar las APIs faltantes, como la que falla:
import resetPasswordHandler from './api/resetPassword.js'; // <-- AGREGAR ESTO

const app = express();
const PORT = process.env.PORT || 3000; 

app.use(cors()); 
// Express ahora tiene middleware nativo para JSON:
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));

// Definición de rutas
app.all('/api/usersList', usersListHandler); 
app.post('/api/loginUser', loginUserHandler); 
app.all('/api/carGarage', carGarageHandler); 

// AGREGAR LA RUTA FALTANTE PARA EL RESTABLECIMIENTO DE CONTRASEÑA
app.post('/api/resetPassword', resetPasswordHandler); // <-- AGREGAR ESTO

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'pages'))); 
app.use(express.static(__dirname)); 

app.listen(PORT, () => {
    console.log(`Servidor Express corriendo en: http://localhost:${PORT}`);
    console.log(`Link de usuarios: http://localhost:${PORT}/pages/dashboard/admin/user/users.html`);
});