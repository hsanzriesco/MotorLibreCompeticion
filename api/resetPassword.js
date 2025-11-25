// **USANDO SINTAXIS ES MODULES (import)**
import { Pool } from 'pg';
import * as bcrypt from 'bcryptjs'; // (Ya corregido)
import * as jwt from 'jsonwebtoken'; // 🚨 CORRECCIÓN: Usar import * as para librerías CommonJS

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
            // La función 'verify' debe usarse correctamente del objeto jwt importado
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            // Este catch maneja el token inválido o expirado
            return res.status(401).json({ message: 'Invalid or expired token.' });
        }

        // ... (El resto de tu lógica de DB es correcta) ...

        const userId = decoded.user_id;

        const result = await pool.query(
            'SELECT reset_token, reset_token_expires FROM users WHERE user_id = $1',
            [userId]
        );

        const user = result.rows[0];

        if (!user || user.reset_token !== token) {
            return res.status(401).json({ message: 'Invalid or missing token in database.' });
        }

        const now = new Date();
        if (now > new Date(user.reset_token_expires)) {
            await pool.query('UPDATE users SET reset_token = NULL, reset_token_expires = NULL WHERE user_id = $1', [userId]);
            return res.status(401).json({ message: 'Token has expired.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await pool.query(
            'UPDATE users SET password = $1, reset_token = NULL, reset_token_expires = NULL WHERE user_id = $2',
            [hashedPassword, userId]
        );

        return res.status(200).json({ message: 'Password has been successfully reset.' });

    } catch (error) {
        console.error('Error resetting password:', error);
        // Este catch maneja errores de DB o cualquier otro error interno.
        return res.status(500).json({ message: 'An error occurred while resetting the password.' });
    }
};