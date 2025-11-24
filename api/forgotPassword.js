// 1. Importar dependencias necesarias
const { Pool } = require('pg');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken'); // Para generar el token

// Asegúrate de que .env esté cargado, si es necesario, hazlo en server.js o aquí.
// const dotenv = require('dotenv');
// dotenv.config(); 

// Configuración de la base de datos (usando la variable de entorno de Neon)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Puede ser necesario para Neon en algunos entornos
    }
});

// Configuración de Nodemailer (usando variables de entorno)
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com', // Ejemplo para Gmail. Ajusta según tu proveedor.
    port: 465, // O 587 si usas STARTTLS
    secure: true, // true para 465, false para otros puertos
    auth: {
        user: process.env.EMAIL_USER, // Tu correo
        pass: process.env.EMAIL_PASS, // Tu contraseña de aplicación/clave
    },
});

module.exports = async (req, res) => {
    // Vercel y Next.js/Express-like API handling
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: 'Email is required.' });
    }

    try {
        // 2. Buscar el usuario en la DB
        const result = await pool.query('SELECT user_id, email FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user) {
            // Nota de seguridad: Es mejor responder siempre 'Si el correo existe...' 
            // para evitar enumeración de usuarios.
            return res.status(200).json({ message: 'If the user exists, a password reset email has been sent.' });
        }

        // 3. Generar el Token de Restablecimiento
        // Creamos un token que expira en 1 hora (3600 segundos)
        const token = jwt.sign(
            { user_id: user.user_id }, 
            process.env.JWT_SECRET, // Usa la misma clave secreta que para tus otros JWTs
            { expiresIn: '1h' }
        );
        
        // Calcular la fecha de expiración para guardar en la DB
        const expirationDate = new Date(Date.now() + 3600000); // 1 hora en milisegundos

        // 4. Guardar el token y su expiración en la DB
        await pool.query(
            'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE user_id = $3',
            [token, expirationDate, user.user_id]
        );

        // 5. Configurar el enlace de restablecimiento (Asegúrate de cambiar 'tu-dominio.vercel.app')
        // El enlace debe apuntar a tu página de reset con el token.
        const resetURL = `https://tu-dominio.vercel.app/auth/reset?token=${token}`;
        
        // 6. Configurar y Enviar el Correo Electrónico
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: 'Restablecer Contraseña',
            html: `
                <p>Has solicitado restablecer tu contraseña.</p>
                <p>Haz clic en el siguiente enlace para completar el proceso:</p>
                <a href="${resetURL}">${resetURL}</a>
                <p>Este enlace expirará en 1 hora.</p>
            `,
        };

        await transporter.sendMail(mailOptions);

        // 7. Respuesta de éxito
        return res.status(200).json({ message: 'Password reset email sent successfully.' });

    } catch (error) {
        console.error('Error sending reset password email:', error);
        // Respuesta genérica de error
        return res.status(500).json({ message: 'An error occurred while processing your request.' });
    }
};