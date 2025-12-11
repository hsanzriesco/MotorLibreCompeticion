
import { Pool } from 'pg';
import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';


const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        
        rejectUnauthorized: false
    }
});


const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});


export default async (req, res) => {
    // 1. Verificación de método HTTP
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: 'Email is required.' });
    }

    
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || !process.env.JWT_SECRET || !process.env.DATABASE_URL) {
        console.error("FATAL: Missing critical environment variables.");
        return res.status(500).json({
            message: 'Internal Server Error: Missing critical environment variables.'
        });
    }

    try {
       
        const result = await pool.query('SELECT id, email FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user) {
           
            return res.status(404).json({ message: 'El correo electrónico ingresado no se encuentra registrado.' });
        }

        const userId = user.id;

      
        const token = jwt.sign(
            { id: userId },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        const expirationDate = new Date(Date.now() + 3600000); 

        
        await pool.query(
           
            'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
            [token, expirationDate, userId]
        );

       
        const resetURL = `${req.headers.origin || 'http://localhost:3000'}/pages/auth/reset/reset.html?token=${token}`;

       
        const mailOptions = {
            from: `Motor Libre Competicion <${process.env.EMAIL_USER}>`,
            to: user.email,
            subject: 'Solicitud de Restablecimiento de Contraseña',
            html: `
                <p>Hola,</p>
                <p>Haz clic en el enlace para crear una nueva contraseña:</p>
                <a href="${resetURL}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin-top: 15px;">
                    Restablecer Contraseña
                </a>
            `,
        };

        await transporter.sendMail(mailOptions);

        
        return res.status(200).json({ message: 'Correo enviado. Revisa tu bandeja de entrada.' });

    } catch (error) {
        console.error('FATAL ERROR en forgotPassword:', error);
       
        return res.status(500).json({ message: 'Error interno del servidor. Inténtalo de nuevo.' });
    }
};
