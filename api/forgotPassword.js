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
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: 'Email is required.' });
    }

    // --- NUEVA VALIDACIÓN: Verificar si el correo tiene el símbolo @ ---
    if (!email.includes('@')) {
        return res.status(400).json({ message: 'Error: El formato del correo electrónico no es válido. Debe incluir el símbolo @.' });
    }
    // ------------------------------------------------------------------

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || !process.env.JWT_SECRET || !process.env.DATABASE_URL) {
        return res.status(500).json({
            message: 'Internal Server Error: Missing critical environment variables.'
        });
    }

    try {
        const result = await pool.query('SELECT id, email FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user) {
            console.log(`Intento de restablecimiento para email no encontrado: ${email}`);
            return res.status(404).json({
                message: 'Error: El correo electrónico no está registrado.'
            });
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

        const resetURL = `https://motor-libre-competicion.vercel.app/pages/auth/reset/reset.html?token=${token}`;

        const mailOptions = {
            from: `Motor Libre Competición <${process.env.EMAIL_USER}>`,
            to: user.email,
            subject: 'Motor Libre Competición: Solicitud de Restablecimiento de Contraseña',
            html: `
                <p>Hola,</p>
                <p>Has solicitado un restablecimiento de contraseña. Haz clic en el siguiente enlace para crear una nueva contraseña:</p>
                <a href="${resetURL}" style="display: inline-block; padding: 10px 20px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 5px; margin-top: 15px;">
                    Restablecer Contraseña
                </a>
                <p style="margin-top: 20px;">Este enlace caducará en 1 hora.</p>
                <p>Si no solicitaste este cambio, por favor, ignora este correo electrónico.</p>
            `,
        };

        await transporter.sendMail(mailOptions);

        return res.status(200).json({
            message: 'Éxito: Se ha enviado un enlace para restablecer la contraseña a tu correo.'
        });

    } catch (error) {
        console.error('FATAL ERROR during password reset process:', error.message || error);

        return res.status(500).json({ message: 'Internal Server Error. Falló al procesar la solicitud de restablecimiento.' });
    }
};