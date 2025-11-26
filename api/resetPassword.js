// resetPassword.js
// **USANDO SINTAXIS ES MODULES (import)**
import { Pool } from 'pg';
import * as bcrypt from 'bcryptjs'; // Compatibilidad con ESM
import * as jwt from 'jsonwebtoken'; // Compatibilidad con ESM

// ------------------------------------------------------------------
// Inicialización de la Base de Datos
// ------------------------------------------------------------------
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});
// ------------------------------------------------------------------

export default async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    // El token viene del cuerpo (body), enviado por reset.js
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
        return res.status(400).json({ message: 'Token and new password are required.' });
    }

    try {
        // --- 1. VERIFICACIÓN JWT ---
        let decoded;
        try {
            // Verifica el token usando la clave secreta y su tiempo de expiración interno (exp)
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            // Este catch atrapa TokenExpiredError, JsonWebTokenError (si el JWT_SECRET es incorrecto)
            console.error('JWT Verification Failed:', err.message);
            // El mensaje del usuario debe ser genérico por seguridad
            return res.status(401).json({ message: 'Invalid or expired token.' });
        }
        
        const userId = decoded.id; 

        // --- 2. VERIFICACIÓN EN BASE DE DATOS (Token y Expiración) ---
        // Buscamos al usuario por su ID y nos aseguramos que el reset_token de la DB coincida con el token enviado
        const result = await pool.query(
            'SELECT reset_token, reset_token_expires FROM users WHERE id = $1',
            [userId]
        );

        const user = result.rows[0];

        // 2a. Verificar si el token existe y coincide
        if (!user || user.reset_token !== token) {
            // Esto sucede si el token fue sobrescrito (el usuario solicitó un nuevo correo) o es inválido.
            return res.status(401).json({ message: 'Invalid or missing token in database.' });
        }
        
        // 2b. Verificar expiración por tiempo de DB
        const now = new Date();
        if (now > new Date(user.reset_token_expires)) {
            // Limpia los campos si el token expiró (lo hacemos después de la verificación para no borrarlo prematuramente)
            await pool.query('UPDATE users SET reset_token = NULL, reset_token_expires = NULL WHERE id = $1', [userId]);
            return res.status(401).json({ message: 'Token has expired.' });
        }

        // --- 3. ACTUALIZACIÓN DE CONTRASEÑA ---
        // Generar nuevo hash de contraseña
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // Actualizar contraseña y limpiar campos de token
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