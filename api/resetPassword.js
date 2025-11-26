// ⚠️ ATENCIÓN: Asegúrate de tener 'pg', 'bcryptjs', y 'jsonwebtoken' instalados.
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

export default async (req, res) => { // Cambiado a export default para ESM
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
        return res.status(400).json({ message: 'Token y nueva contraseña son requeridos.' });
    }
    
    if (!process.env.JWT_SECRET) {
        return res.status(500).json({ message: 'Internal Server Error: Missing JWT_SECRET.' });
    }


    try {
        let decoded;
        try {
            // 1. Verificar y decodificar el Token JWT
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            return res.status(401).json({ message: 'Token inválido o expirado.' });
        }
        
        // Asumiendo que el ID del usuario está en el campo 'id' del token
        const userId = decoded.id; 

        // 2. Buscar el usuario y verificar la validez del token en la BD (Neon)
        const result = await pool.query(
            'SELECT reset_token, reset_token_expires FROM users WHERE id = $1',
            [userId]
        );

        const user = result.rows[0];

        if (!user || user.reset_token !== token) {
            return res.status(401).json({ message: 'Token inválido o no coincide con el registro.' });
        }
        
        // 3. Verificar expiración
        const now = new Date();
        if (now > new Date(user.reset_token_expires)) {
            // Limpia el token expirado antes de devolver el error
            await pool.query('UPDATE users SET reset_token = NULL, reset_token_expires = NULL WHERE id = $1', [userId]);
            return res.status(401).json({ message: 'El token ha expirado. Solicita un nuevo restablecimiento.' });
        }

        // 4. Hashear la nueva contraseña
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // 5. ACTUALIZACIÓN DE LA CONTRASEÑA y limpieza del token
        await pool.query(
            // Actualizamos 'password', limpiamos 'reset_token' y 'reset_token_expires'
            'UPDATE users SET password = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2',
            [hashedPassword, userId]
        );

        return res.status(200).json({ message: 'La contraseña ha sido restablecida con éxito.' });

    } catch (error) {
        console.error('Error al restablecer la contraseña:', error);
        return res.status(500).json({ message: 'Ocurrió un error al procesar el restablecimiento de contraseña.' });
    }
    try {
        const response = await fetch('/api/forgotPassword', { // <--- DEBE SER /api/forgotPassword
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: emailValue })
        });
        // ... manejar la respuesta
    } catch (error) {
        // ...
    }
};
