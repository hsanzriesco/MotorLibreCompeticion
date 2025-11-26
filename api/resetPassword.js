// resetPassword.js
// **USANDO SINTAXIS ES MODULES (import)**
import { Pool } from 'pg';
import * as bcrypt from 'bcryptjs'; // Compatibilidad con ESM
import * as jwt from 'jsonwebtoken'; // Compatibilidad con ESM

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
            // Error 401: Falla si el token JWT es inválido o ha expirado (por tiempo de JWT)
            return res.status(401).json({ message: 'Invalid or expired token.' });
        }
        
        // 🚨 SOLUCIÓN FINAL: Leer la propiedad 'id' del token, no 'user_id'.
        const userId = decoded.id; 

        // 1. Verificar existencia y validez del token en DB
        const result = await pool.query(
            'SELECT reset_token, reset_token_expires FROM users WHERE id = $1', // Usa 'id' (columna correcta)
            [userId]
        );

        const user = result.rows[0];

        if (!user || user.reset_token !== token) {
            return res.status(401).json({ message: 'Invalid or missing token in database.' });
        }
        
        // 2. Verificar expiración por tiempo de DB
        const now = new Date();
        if (now > new Date(user.reset_token_expires)) {
             // Limpia los campos si el token expiró
             await pool.query('UPDATE users SET reset_token = NULL, reset_token_expires = NULL WHERE id = $1', [userId]);
             return res.status(401).json({ message: 'Token has expired.' });
        }

        // 3. Generar nuevo hash de contraseña
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // 4. Actualizar contraseña y limpiar campos de token
        await pool.query(
            'UPDATE users SET password = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2', // Usa 'id' (columna correcta)
            [hashedPassword, userId]
        );

        // Éxito
        return res.status(200).json({ message: 'Password has been successfully reset.' });

    } catch (error) {
        console.error('Error resetting password:', error);
        // Error 500: Fallo del servidor (e.g., error de DB, conexión)
        return res.status(500).json({ message: 'An error occurred while resetting the password.' });
    }
};