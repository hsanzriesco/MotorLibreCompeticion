const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors'); 

const userListModule = require('./api/userList'); 
const usersListHandler = userListModule.default || userListModule;

const loginUserModule = require('./api/loginUser'); 
const loginUserHandler = loginUserModule.default || loginUserModule;

const carGarageModule = require('./api/userAction'); 
const carGarageHandler = carGarageModule.default || carGarageModule; 

const app = express();
const PORT = process.env.PORT || 3000; 

app.use(cors()); 
app.use(bodyParser.json()); 
app.use(express.urlencoded({ extended: true }));


app.all('/api/usersList', usersListHandler); 
app.post('/api/loginUser', loginUserHandler); 

app.all('/api/carGarage', carGarageHandler); 

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'pages'))); 
app.use(express.static(__dirname)); 

app.listen(PORT, () => {
    console.log(`Servidor Express corriendo en: http://localhost:${PORT}`);
    console.log(`Link de usuarios: http://localhost:${PORT}/pages/dashboard/admin/user/users.html`);
});
