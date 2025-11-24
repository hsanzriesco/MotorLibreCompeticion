const { Pool } = require('pg');
const bcrypt = require('bcryptjs'); // Necesario para hashear la nueva contraseña
const jwt = require('jsonwebtoken'); // Necesario para verificar el token

// Configuración de la base de datos (reutiliza la configuración de forgotPassword.js)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    // 1. Recibir datos: token y nueva contraseña
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
        return res.status(400).json({ message: 'Token and new password are required.' });
    }

    try {
        // 2. Verificar el token y su expiración
        
        // Primero, decodificamos el token (sin verificar la firma para obtener el user_id)
        let decoded;
        try {
            // Verificamos el token con la clave secreta y la expiración
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            // Si el token es inválido o ha expirado (jwt.verify lo maneja)
            return res.status(401).json({ message: 'Invalid or expired token.' });
        }
        
        const userId = decoded.user_id;

        // 3. Buscar el usuario en la DB y verificar que el token coincide
        const result = await pool.query(
            'SELECT reset_token, reset_token_expires FROM users WHERE user_id = $1',
            [userId]
        );

        const user = result.rows[0];

        if (!user || user.reset_token !== token) {
            return res.status(401).json({ message: 'Invalid or missing token in database.' });
        }
        
        // Comprobación extra de expiración (aunque jwt.verify ya lo hizo, es buena práctica)
        const now = new Date();
        if (now > new Date(user.reset_token_expires)) {
             // Limpiar el token de la DB para que no se reintente usar
             await pool.query('UPDATE users SET reset_token = NULL, reset_token_expires = NULL WHERE user_id = $1', [userId]);
             return res.status(401).json({ message: 'Token has expired.' });
        }

        // 4. Hashear la nueva contraseña con bcryptjs
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // 5. Actualizar la contraseña en la DB y limpiar el token
        await pool.query(
            'UPDATE users SET password = $1, reset_token = NULL, reset_token_expires = NULL WHERE user_id = $2',
            [hashedPassword, userId]
        );

        // 6. Respuesta de éxito
        return res.status(200).json({ message: 'Password has been successfully reset.' });

    } catch (error) {
        console.error('Error resetting password:', error);
        return res.status(500).json({ message: 'An error occurred while resetting the password.' });
    }
};