// 1. Importar dependencias necesarias usando sintaxis ESM (import)
import { Pool } from 'pg';
import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken'; // Para generar el token

// NOTA: En Vercel, las variables de entorno se cargan automáticamente.

// Configuración de la base de datos (usando la variable de entorno de Neon)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Puede ser necesario para Neon en algunos entornos
    }
});

// Configuración de Nodemailer (usando variables de entorno)
// Asegúrate de que EMAIL_USER y EMAIL_PASS estén configuradas correctamente en Vercel
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com', // Ejemplo para Gmail. Ajusta según tu proveedor.
    port: 465, // O 587 si usas STARTTLS
    secure: true, // true para 465, false para otros puertos
    auth: {
        user: process.env.EMAIL_USER, // Tu correo
        pass: process.env.EMAIL_PASS, // Tu contraseña de aplicación/clave
    },
});

// Usamos export default para el handler de Vercel/Next.js/Express
export default async (req, res) => {
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
        // Asumiendo que el ID del usuario se llama 'id' en tu DB, no 'user_id'
        const result = await pool.query('SELECT id, email FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user) {
            // Nota de seguridad: Es mejor responder siempre 'Si el correo existe...' 
            // para evitar enumeración de usuarios.
            return res.status(200).json({ message: 'If the user exists, a password reset email has been sent.' });
        }

        // 3. Generar el Token de Restablecimiento
        // Creamos un token que expira en 1 hora (3600 segundos)
        const token = jwt.sign(
            { id: user.id },
            process.env.JWT_SECRET, // Usa la clave secreta de tus variables de entorno
            { expiresIn: '1h' }
        );

        // Calcular la fecha de expiración para guardar en la DB
        const expirationDate = new Date(Date.now() + 3600000); // 1 hora en milisegundos

        // 4. Guardar el token y su expiración en la DB
        // Asegúrate de que la columna se llame 'id' o ajusta el nombre
        await pool.query(
            'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
            [token, expirationDate, user.id]
        );

        // 5. Configurar el enlace de restablecimiento (¡IMPORTANTE: AJUSTA ESTA URL!)
        // Debe apuntar a tu dominio de Vercel y a la página reset.html
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
        console.error('Error sending reset password email:', error);
        // Respuesta de error 500 para el cliente
        return res.status(500).json({ message: 'An error occurred while processing your request. Please check server logs.' });
    }
};