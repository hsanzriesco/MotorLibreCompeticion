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
            // Devolvemos 200 para evitar enumeración de usuarios (seguridad), 
            // pero para fines de debugging y siguiendo tu petición previa, devolvemos 404.
            return res.status(404).json({
                message: 'El correo electrónico no está registrado, porfavor registrate'
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

        // Asegúrate de que esta URL sea la correcta para tu formulario de restablecimiento
        const resetURL = `https://motor-libre-competicion.vercel.app/pages/auth/reset/reset.html?token=${token}`;

        // =========================================================================
        // === MODIFICACIÓN CLAVE: Diseño de Email (Negro y Rojo) para Motor Libre ===
        // =========================================================================
        const mailOptions = {
            from: `Motor Libre Competición <${process.env.EMAIL_USER}>`,
            to: user.email,
            subject: 'Motor Libre Competición: Solicitud de Restablecimiento de Contraseña',
            html: `
                <div style="font-family: Arial, sans-serif; background-color: #1a1a1a; padding: 20px; color: #f0f0f0; border-radius: 8px;">
                    <h1 style="color: #e50914; text-align: center; border-bottom: 2px solid #e50914; padding-bottom: 10px; margin-bottom: 20px;">
                        Motor Libre Competición
                    </h1>

                    <p style="font-size: 16px;">Hola,</p>
                    
                    <p style="font-size: 16px;">Hemos recibido una solicitud para restablecer la contraseña asociada a tu cuenta.</p>
                    
                    <p style="font-size: 16px; font-weight: bold; margin-top: 25px;">
                        Haz clic en el botón de abajo para continuar con el proceso:
                    </p>

                    <!-- Botón Rojo Estilizado -->
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetURL}" 
                           target="_blank"
                           style="background-color: #e50914; 
                                  color: white; 
                                  padding: 15px 30px; 
                                  text-decoration: none; 
                                  border-radius: 6px; 
                                  font-weight: bold; 
                                  font-size: 18px; 
                                  border: 1px solid #ff4d4d; 
                                  display: inline-block;">
                            RESTABLECER CONTRASEÑA
                        </a>
                    </div>
                    
                    <p style="font-size: 14px; color: #ffcccc; border-top: 1px solid #333; padding-top: 15px;">
                        <strong>IMPORTANTE:</strong> Por motivos de seguridad, este enlace expirará en 1 hora (60 minutos).
                    </p>
                    
                    <p style="font-size: 14px; color: #aaaaaa;">
                        Si no solicitaste este cambio de contraseña, puedes ignorar este correo electrónico de forma segura. Tu contraseña no será modificada.
                    </p>

                    <p style="margin-top: 30px; font-size: 14px; text-align: center; color: #666666;">
                        El equipo de Motor Libre Competición.
                    </p>
                </div>
            `,
        };
        // =========================================================================

        await transporter.sendMail(mailOptions);

        return res.status(200).json({
            message: 'Éxito: Se ha enviado un enlace para restablecer la contraseña a tu correo.'
        });

    } catch (error) {
        console.error('FATAL ERROR during password reset process:', error.message || error);

        return res.status(500).json({ message: 'Internal Server Error. Falló al procesar la solicitud de restablecimiento.' });
    }
};