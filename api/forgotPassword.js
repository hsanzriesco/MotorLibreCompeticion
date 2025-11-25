// 1. Import required dependencies using ESM syntax (import)
import { Pool } from 'pg';
import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';
// NO necesitamos 'googleapis' aquí, ya que usamos App Password.

// Database configuration
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// ------------------------------------------------------------------
// Configuracion del Transporter usando Contraseña de Aplicación (EMAIL_PASS)
// ------------------------------------------------------------------
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        // La cuenta de Gmail (EMAIL_USER)
        user: process.env.EMAIL_USER,
        // La Contraseña de Aplicación de 16 caracteres (EMAIL_PASS)
        pass: process.env.EMAIL_PASS,
    },
});
// ------------------------------------------------------------------


export default async (req, res) => {
    if (req.method !== 'POST') {
        // Asegura que si alguien intenta GET la API, obtenga un error Method Not Allowed
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: 'Email is required.' });
    }

    // Comprobación de variables críticas
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || !process.env.JWT_SECRET) {
         // Esta respuesta debe ser JSON para evitar el error de sintaxis en el cliente
        return res.status(500).json({ 
            message: 'Internal Server Error: Missing EMAIL_USER, EMAIL_PASS, or JWT_SECRET environment variables.' 
        });
    }

    try {
        // 1. Search for the user in the DB (Assumes ID column is 'id')
        const result = await pool.query('SELECT id, email FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user) {
            // Security note: Always return a generic response to prevent user enumeration
            return res.status(200).json({ message: 'If the user exists, a password reset email has been sent.' });
        }
        
        const userId = user.id;

        // 2. Generate the Reset Token (expires in 1h)
        const token = jwt.sign(
            { id: userId }, 
            process.env.JWT_SECRET, 
            { expiresIn: '1h' }
        );
        
        const expirationDate = new Date(Date.now() + 3600000); // 1 hour in milliseconds

        // 3. Save the token and its expiration in the DB
        await pool.query(
            'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
            [token, expirationDate, userId]
        );

        // 4. Reset URL: USING THE REAL VERCEl DOMAIN
        // NOTE: Asegúrate de que el dominio 'motor-libre-competicion.vercel.app' sea correcto.
        const resetURL = `https://motor-libre-competicion.vercel.app/pages/auth/reset/reset.html?token=${token}`;
        
        // 5. Configure and Send the Email
        const mailOptions = {
            from: `Motor Libre Competición <${process.env.EMAIL_USER}>`,
            to: user.email,
            subject: 'Motor Libre Competición: Password Reset Request',
            html: `
                <p>Hello,</p>
                <p>You have requested a password reset. Click the link below to create a new password:</p>
                <a href="${resetURL}" style="display: inline-block; padding: 10px 20px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 5px; margin-top: 15px;">
                    Reset Password
                </a>
                <p style="margin-top: 20px;">This link will expire in 1 hour.</p>
                <p>If you did not request this change, please ignore this email.</p>
            `,
        };

        await transporter.sendMail(mailOptions);

        // 6. Success Response (JSON)
        return res.status(200).json({ message: 'Password reset email sent successfully.' });

    } catch (error) {
        console.error('FATAL ERROR:', error);
        
        // Respuesta JSON de error general
        return res.status(500).json({ message: 'Internal Server Error. Failed to process password reset request.' });
    }
};