// 1. Importar dependencias necesarias usando sintaxis ESM (import)
import { Pool } from 'pg';
import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';

// Configuración de la base de datos
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Configuración de Nodemailer
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, 
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

export default async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: 'Email is required.' });
    }

    try {
        // 2. Buscar el usuario en la DB
        // IMPORTANTE: Asegúrate de que 'id' es el nombre correcto de la columna ID
        const result = await pool.query('SELECT id, email FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user) {
            return res.status(200).json({ message: 'If the user exists, a password reset email has been sent.' });
        }
        
        const userId = user.id; // Asume que el ID se llama 'id'

        // 3. Generar el Token
        const token = jwt.sign(
            { id: userId }, 
            process.env.JWT_SECRET, 
            { expiresIn: '1h' }
        );
        
        const expirationDate = new Date(Date.now() + 3600000);

        // 4. Guardar el token y su expiración en la DB
        // Si tu columna ID se llama 'user_id', cambia $3 a 'user_id = $3'
        await pool.query(
            'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
            [token, expirationDate, userId]
        );

        // ... (resto de la lógica de envío de email)
        const resetURL = `https://tu-dominio-motorlibre.vercel.app/pages/auth/reset/reset.html?token=${token}`;
        
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: 'Motor Libre Competición: Restablecer Contraseña',
            html: `
                <p>Hola,</p>
                <p>Has solicitado restablecer tu contraseña. Haz clic en el siguiente enlace para crear una nueva:</p>
                <a href="${resetURL}" style="display: inline-block; padding: 10px 20px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 5px; margin-top: 15px;">
                    Restablecer Contraseña
                </a>
                <p style="margin-top: 20px;">Este enlace expirará en 1 hora.</p>
                <p>Si no solicitaste este cambio, puedes ignorar este correo.</p>
            `,
        };

        await transporter.sendMail(mailOptions);

        return res.status(200).json({ message: 'Password reset email sent successfully.' });

    } catch (error) {
        console.error('FATAL ERROR:', error);
        
        // DEVUELVE UN JSON SIEMPRE, incluso en 500, para que login.js no rompa.
        return res.status(500).json({ message: 'Internal Server Error. Please check Vercel Logs for DB/Email Config Issues.' });
    }
};