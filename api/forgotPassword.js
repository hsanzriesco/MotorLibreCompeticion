// 1. Importar dependencias necesarias usando sintaxis ESM (import)
import { Pool } from 'pg';
import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken'; // Para generar el token

// Configuración de la base de datos (usando la variable de entorno de Neon)
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

// Usamos export default para el handler de Vercel/Next.js/Express
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
        // Seleccionamos el ID del usuario. Asume que se llama 'id' o 'user_id'
        const result = await pool.query('SELECT id AS user_identifier, email FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user) {
            // Nota de seguridad: Siempre respondemos éxito para evitar enumeración de usuarios.
            return res.status(200).json({ message: 'If the user exists, a password reset email has been sent.' });
        }

        // Usamos el identificador encontrado (ya sea id o user_id)
        const userId = user.user_identifier;

        // 3. Generar el Token de Restablecimiento
        const token = jwt.sign(
            { id: userId },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        const expirationDate = new Date(Date.now() + 3600000); // 1 hora en milisegundos

        // 4. Guardar el token y su expiración en la DB
        // NOTA: Asegúrate de que tu tabla 'users' tenga las columnas 'reset_token' y 'reset_token_expires'
        // y que la columna de ID primario se llame 'id'
        await pool.query(
            'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
            [token, expirationDate, userId]
        );

        // 5. Configurar el enlace de restablecimiento (¡AJUSTA ESTA URL!)
        const resetURL = `https://tu-dominio-motorlibre.vercel.app/pages/auth/reset/reset.html?token=${token}`;

        // 6. Configurar y Enviar el Correo Electrónico
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

        // 7. Respuesta de éxito
        return res.status(200).json({ message: 'Password reset email sent successfully.' });

    } catch (error) {
        console.error('FATAL ERROR:', error); // Log más detallado

        // A. Si el error es de conexión/autenticación de Nodemailer o DB
        if (error.code === 'EENVELOPE' || error.code === 'EAUTH') {
            // 500 por error de autenticación/conexión (variables de entorno incorrectas)
            return res.status(500).json({ message: 'Error interno de configuración del servidor (email/DB). Consulta los logs.' });
        }

        // B. Si el error es una excepción no manejada (ej. columna de DB faltante)
        return res.status(500).json({ message: 'An unexpected internal server error occurred.' });
    }
};