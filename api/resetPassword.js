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
    
    let userId;

    try {
        let decoded;
        try {
            // Verifica el token usando la clave secreta. Si falla, el catch exterior se activa.
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            // Manejo específico de errores de JWT (ej. TokenExpiredError, JsonWebTokenError)
            console.error('JWT Verification Failed:', err.message);
            return res.status(401).json({ message: 'Invalid or expired token.' });
        }
        
        userId = decoded.id; // El token debe tener el 'id' del usuario.

        // 1. Verificar si el usuario aún tiene un token de restablecimiento activo en DB
        // OJO: La verificación user.reset_token !== token se remueve porque ya verificamos
        // la firma y expiración del JWT, y confiaremos en la expiración manual de la DB
        // para prevenir el reuso del token.
        const result = await pool.query(
            'SELECT reset_token, reset_token_expires FROM users WHERE id = $1',
            [userId]
        );

        const user = result.rows[0];

        if (!user || !user.reset_token) {
            // Si no hay token en la DB, significa que ya fue usado o limpiado.
            return res.status(401).json({ message: 'Token already used or unauthorized.' });
        }
        
        // 2. Verificar expiración por tiempo de DB (doble seguridad)
        const now = new Date();
        if (now > new Date(user.reset_token_expires)) {
            // Limpia los campos si el token expiró (aunque el JWT ya lo habría hecho)
            await pool.query('UPDATE users SET reset_token = NULL, reset_token_expires = NULL WHERE id = $1', [userId]);
            return res.status(401).json({ message: 'Token has expired.' });
        }

        // 3. Generar nuevo hash de contraseña
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // 4. Actualizar contraseña y limpiar campos de token
        await pool.query(
            'UPDATE users SET password = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2', 
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