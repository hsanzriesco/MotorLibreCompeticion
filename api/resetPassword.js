import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs'; // Importamos bcryptjs para hashear la nueva contraseña

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Número de rondas de hashing (factor de coste). 10 es un buen valor por defecto.
const SALT_ROUNDS = 10;

export default async (req, res) => {
    // Aseguramos que solo se acepten peticiones POST
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { token, newPassword } = req.body;

    // 1. Validación de entradas
    if (!token || !newPassword) {
        return res.status(400).json({ message: 'Token y nueva contraseña son requeridos.' });
    }

    // Validación de variables de entorno
    if (!process.env.JWT_SECRET || !process.env.DATABASE_URL) {
        return res.status(500).json({
            message: 'Internal Server Error: Missing critical environment variables.'
        });
    }

    try {
        // 2. Verificar la validez del token JWT (expiración y firma)
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            console.error('Token verification error:', err.message);
            // Captura errores como 'jwt expired' o 'invalid signature'
            return res.status(401).json({ message: 'Token inválido o expirado. Por favor, solicita otro enlace.' });
        }

        const userId = decoded.id;

        // 3. Buscar el usuario y validar que el token coincida y no haya expirado en la BD
        const result = await pool.query(
            'SELECT reset_token, reset_token_expires FROM users WHERE id = $1',
            [userId]
        );

        const user = result.rows[0];

        if (!user || user.reset_token !== token || new Date(user.reset_token_expires) < new Date()) {
            return res.status(401).json({ message: 'El enlace de restablecimiento es inválido o ya ha sido utilizado/expirado.' });
        }

        // 4. Hashear la nueva contraseña
        const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

        // 5. Actualizar la contraseña y limpiar el token de restablecimiento
        await pool.query(
            'UPDATE users SET password = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2',
            [hashedPassword, userId]
        );

        // 6. Respuesta de éxito
        return res.status(200).json({ success: true, message: 'La contraseña ha sido restablecida con éxito.' });

    } catch (error) {
        console.error('FATAL ERROR during password reset update:', error.message || error);
        return res.status(500).json({ success: false, message: 'Error interno del servidor al actualizar la contraseña.' });
    }
};