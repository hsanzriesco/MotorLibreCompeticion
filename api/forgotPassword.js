// app/forgotPassword.js

import express from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

const router = express.Router();

// 🚨 1. CONFIGURACIÓN DE NODEMAILER (¡IMPRESCINDIBLE!)
// Reemplaza con tus credenciales SMTP reales.
const transporter = nodemailer.createTransport({
    // Si usas Gmail, recuerda que necesitas una 'Contraseña de Aplicación' si tienes 2FA activado.
    service: 'gmail', 
    auth: {
        user: 'tu_correo_de_envio@gmail.com', // ⬅️ Reemplaza
        pass: 'tu_contraseña_o_app_password' // ⬅️ Reemplaza
    }
});

// 🚨 2. SIMULACIÓN DE LA BASE DE DATOS (¡DEBES REEMPLAZAR!)
// Estas funciones DEBEN interactuar con tu base de datos (Mongoose, Sequelize, etc.)
const DB = {
    // ⚠️ DEBES MODIFICAR: Buscar usuario por email. Debe retornar el objeto usuario.
    findByEmail: async (email) => { 
        // Ejemplo: const user = await UserModel.findOne({ email });
        // En tu caso, usa tu lógica real de DB.
        console.log(`Buscando usuario con email: ${email}`);
        return { _id: 'simulacion_id', email: email }; // Simulación de usuario encontrado
    },
    // ⚠️ DEBES MODIFICAR: Guardar el token y la expiración en la DB.
    updateUserToken: async (email, token, expiry) => { 
        // Ejemplo: await UserModel.updateOne({ email }, { resetPasswordToken: token, resetPasswordExpires: expiry });
        console.log(`DB: Token ${token} guardado para ${email}`);
    },
    // ⚠️ DEBES MODIFICAR: Buscar usuario por token.
    findUserByToken: async (token) => { 
        // Ejemplo: const user = await UserModel.findOne({ resetPasswordToken: token, resetPasswordExpires: { $gt: Date.now() } });
        // Simulación:
        if (token === 'fake-token-123') { // Usamos un token fijo para la simulación
             return { email: 'simulacion@test.com', resetPasswordToken: 'fake-token-123', resetPasswordExpires: Date.now() + 3600000 };
        }
        return null;
    },
    // ⚠️ DEBES MODIFICAR: Actualizar la contraseña y limpiar el token.
    updateUserPassword: async (email, newHash) => { 
        // Ejemplo: await UserModel.updateOne({ email }, { password: newHash, resetPasswordToken: null, resetPasswordExpires: null });
        console.log(`DB: Contraseña actualizada y token limpiado para ${email}`);
    }
};
// -----------------------------------------------------------------

// ==========================================================
// ENDPOINT 1: /forgot (Solicitar envío de correo)
// ==========================================================
router.post('/forgot', async (req, res) => {
    const { email } = req.body;

    try {
        const user = await DB.findByEmail(email);

        if (!user || !user.email) {
            // Respuesta segura (evita revelar emails registrados)
            return res.status(200).json({ message: 'Si el correo existe en nuestro sistema, te enviaremos un enlace de restablecimiento.' });
        }

        const token = crypto.randomBytes(20).toString('hex');
        const tokenExpiry = Date.now() + 3600000; // 1 hora
        
        await DB.updateUserToken(user.email, token, tokenExpiry);

        // ⚠️ Ajusta la URL de `reset.html` según tu estructura.
        const resetUrl = `http://localhost:3000/pages/auth/reset.html?token=${token}`; 

        const mailOptions = {
            to: user.email,
            from: 'tu_correo_de_envio@gmail.com',
            subject: 'Restablecer Contraseña',
            html: `<p>Haz clic en el enlace para restablecer tu contraseña. Caduca en 1 hora:</p>
                   <a href="${resetUrl}">Restablecer Contraseña</a>`
        };

        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: 'Correo enviado. Revisa tu bandeja de entrada.' });
        
    } catch (err) {
        // Esto captura errores de DB o FALLOS DE NODEMAILER.
        console.error('Error en /forgot:', err); 
        // 500 es apropiado para un fallo interno, como el envío de correo.
        res.status(500).json({ message: 'Error interno del servidor al procesar la solicitud. ' + err.message });
    }
});

// ==========================================================
// ENDPOINT 2: /reset (Restablecer la contraseña con el token)
// ==========================================================
router.post('/reset', async (req, res) => {
    const { token, newPassword } = req.body;

    try {
        const user = await DB.findUserByToken(token);

        if (!user || user.resetPasswordExpires < Date.now()) {
            return res.status(400).json({ message: 'El token no es válido o ha expirado.' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        await DB.updateUserPassword(user.email, hashedPassword); 
        
        res.status(200).json({ message: 'Contraseña restablecida con éxito.' });
    } catch (err) {
        console.error('Error en /reset:', err);
        res.status(500).json({ message: 'Error al restablecer la contraseña.' });
    }
});

export default router;