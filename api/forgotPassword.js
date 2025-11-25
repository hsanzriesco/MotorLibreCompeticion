// 1. Import required dependencies using ESM syntax (import)
import { Pool } from 'pg';
import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';
import { google } from 'googleapis'; // *** NEW: Import Google APIs for OAuth2

// ------------------------------------------------------------------
// Configuracion de OAuth2 (NECESARIA si App Passwords falla)
// ------------------------------------------------------------------

// Carga las variables de entorno de OAuth2
const CLIENT_ID = process.env.OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.OAUTH_CLIENT_SECRET;
const REDIRECT_URI = process.env.OAUTH_REDIRECT_URI;
const REFRESH_TOKEN = process.env.OAUTH_REFRESH_TOKEN;

// Configura el cliente OAuth2
const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

// Funcion para crear el Transporter usando un token de acceso temporal
async function createTransporter() {
    try {
        // Obtiene un nuevo Access Token usando el Refresh Token
        const accessToken = await oAuth2Client.getAccessToken();

        return nodemailer.createTransport({
            service: 'gmail',
            auth: {
                type: 'OAuth2',
                user: process.env.EMAIL_USER, // Tu cuenta de Gmail
                clientId: CLIENT_ID,
                clientSecret: CLIENT_SECRET,
                refreshToken: REFRESH_TOKEN,
                accessToken: accessToken.token, // Token temporal
            },
        });
    } catch (error) {
        console.error("Error al obtener el Access Token o crear Transporter:", error);
        throw new Error("Fallo al configurar el servicio de correo con OAuth2.");
    }
}
// ------------------------------------------------------------------


// Database configuration
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});


export default async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: 'Email is required.' });
    }

    // Comprueba que las variables OAuth2 esten definidas
    if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
        return res.status(500).json({ 
            message: 'ERROR: Faltan variables de entorno OAuth2. Por favor, configura OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, y OAUTH_REFRESH_TOKEN.' 
        });
    }

    let transporter;
    try {
        // 1. Crea el Transporter usando OAuth2 (obtiene un token de acceso)
        transporter = await createTransporter();

        // 2. Search for the user in the DB (Assumes ID column is 'id')
        const result = await pool.query('SELECT id, email FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user) {
            // Security note: Always return a generic response to prevent user enumeration
            return res.status(200).json({ message: 'If the user exists, a password reset email has been sent.' });
        }
        
        const userId = user.id;

        // 3. Generate the Reset Token (expires in 1h)
        const token = jwt.sign(
            { id: userId }, 
            process.env.JWT_SECRET, 
            { expiresIn: '1h' }
        );
        
        const expirationDate = new Date(Date.now() + 3600000); // 1 hour in milliseconds

        // 4. Save the token and its expiration in the DB
        await pool.query(
            'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
            [token, expirationDate, userId]
        );

        // 5. Reset URL: USING THE REAL VERCEl DOMAIN
        const resetURL = `https://motor-libre-competicion.vercel.app/pages/auth/reset/reset.html?token=${token}`;
        
        // 6. Configure and Send the Email
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

        // 7. Success Response
        return res.status(200).json({ message: 'Password reset email sent successfully.' });

    } catch (error) {
        console.error('FATAL ERROR:', error);
        
        // El error 500 ahora es más detallado
        return res.status(500).json({ message: 'Internal Server Error. OAuth2/DB Configuration Failed.' });
    }
};