// ⚠️ ATENCIÓN: Asegúrate de tener 'pg', 'nodemailer', y 'jsonwebtoken' instalados.
import { Pool } from 'pg';
import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';

// ------------------------------------------------------------------
// CONFIGURACIÓN DE CONEXIÓN A NEON
// ------------------------------------------------------------------
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        // Configuraciones de SSL necesarias para Neon/PostgreSQL en la nube
        rejectUnauthorized: false
    }
});

// ------------------------------------------------------------------
// CONFIGURACIÓN DE NODEMAILER (Gmail)
// ------------------------------------------------------------------
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        // Usa las variables de entorno para tus credenciales de Gmail
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// FUNCIÓN HANDLER PRINCIPAL DE VERCELL
export default async (req, res) => {
    // 1. Verificación de método HTTP
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: 'Email is required.' });
    }

    // 2. Comprobación de variables de entorno críticas
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || !process.env.JWT_SECRET || !process.env.DATABASE_URL) {
        console.error("FATAL: Missing critical environment variables.");
        return res.status(500).json({ 
            message: 'Internal Server Error: Missing critical environment variables.' 
        });
    }

    try {
        // 3. VERIFICACIÓN DE CORREO EN NEON
        const result = await pool.query('SELECT id, email FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user) {
            // Respuesta segura (evita la enumeración de usuarios)
            return res.status(200).json({ message: 'Si el correo existe en nuestro sistema, se te enviará un enlace de restablecimiento.' });
        }
        
        const userId = user.id;

        // 4. Generar Token JWT (expira en 1 hora)
        const token = jwt.sign(
            { id: userId }, 
            process.env.JWT_SECRET, 
            { expiresIn: '1h' }
        );
        
        const expirationDate = new Date(Date.now() + 3600000); // 1 hora

        // 5. Guardar el token y la expiración en la BD de Neon
        await pool.query(
            // Asumiendo que las columnas son 'reset_token' y 'reset_token_expires'
            'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
            [token, expirationDate, userId]
        );

        // 6. Configurar la URL de Restablecimiento
        // ⚠️ IMPORTANTE: Reemplaza con el dominio real de tu aplicación (ej: https://tudominio.com)
        const resetURL = `${req.headers.origin || 'http://localhost:3000'}/pages/auth/reset/reset.html?token=${token}`;
        
        // 7. Configurar y Enviar el Correo
        const mailOptions = {
            from: `Tu Aplicación <${process.env.EMAIL_USER}>`,
            to: user.email,
            subject: 'Solicitud de Restablecimiento de Contraseña',
            html: `
                <p>Hola,</p>
                <p>Haz clic en el enlace para crear una nueva contraseña:</p>
                <a href="${resetURL}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin-top: 15px;">
                    Restablecer Contraseña
                </a>
                <p style="margin-top: 20px;">Este enlace caduca en 1 hora.</p>
            `,
        };

        await transporter.sendMail(mailOptions);

        return res.status(200).json({ message: 'Correo enviado. Revisa tu bandeja de entrada.' });

    } catch (error) {
        console.error('FATAL ERROR en forgotPassword:', error);
        // Si hay un fallo de DB o Nodemailer, devolvemos 500 JSON.
        return res.status(500).json({ message: 'Error interno del servidor. Inténtalo de nuevo.' });
    }
};