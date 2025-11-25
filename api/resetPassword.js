// **USANDO SINTAXIS ES MODULES (import)**
import { Pool } from 'pg';
import * as bcrypt from 'bcryptjs'; // Asegura la compatibilidad con ESM
import * as jwt from 'jsonwebtoken'; // Asegura la compatibilidad con ESM

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Usando 'export default' en lugar de 'module.exports'
export default async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
        return res.status(400).json({ message: 'Token and new password are required.' });
    }

    try {
        let decoded;
        try {
            // Verifica el token usando la clave secreta
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            // Falla si el token JWT es inválido o ha expirado (por tiempo de JWT)
            return res.status(401).json({ message: 'Invalid or expired token.' });
        }
        
        // El token decodificado contiene el ID del usuario
        const userId = decoded.user_id;

        // 🚨 CORRECCIÓN #1: Cambiar 'user_id' por 'id' para coincidir con la tabla 'users'
        const result = await pool.query(
            'SELECT reset_token, reset_token_expires FROM users WHERE id = $1', // <-- CAMBIO
            [userId]
        );

        const user = result.rows[0];

        if (!user || user.reset_token !== token) {
            return res.status(401).json({ message: 'Invalid or missing token in database.' });
        }
        
        const now = new Date();
        // Verifica si el token expiró según la columna de la DB
        if (now > new Date(user.reset_token_expires)) {
             // Limpia los campos si el token expiró
             await pool.query('UPDATE users SET reset_token = NULL, reset_token_expires = NULL WHERE id = $1', [userId]);
             return res.status(401).json({ message: 'Token has expired.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // 🚨 CORRECCIÓN #2: Cambiar 'user_id' por 'id' en la actualización de la contraseña
        await pool.query(
            'UPDATE users SET password = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2', // <-- CAMBIO
            [hashedPassword, userId]
        );

        return res.status(200).json({ message: 'Password has been successfully reset.' });

    } catch (error) {
        console.error('Error resetting password:', error);
        // Fallo del servidor (e.g., error de DB, conexión)
        return res.status(500).json({ message: 'An error occurred while resetting the password.' });
    }
};