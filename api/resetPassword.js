

import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';


const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});


function validatePassword(password) {
    const lengthOK = password.length >= 8 && password.length <= 12;
    const upperCaseOK = /[A-Z]/.test(password);
    const numberOK = /[0-9]/.test(password);
    const symbolOK = /[^A-Za-z0-9]/.test(password);

    if (!lengthOK) return "La contraseña debe tener entre 8 y 12 caracteres.";
    if (!upperCaseOK) return "Debe contener al menos una letra mayúscula.";
    if (!numberOK) return "Debe incluir al menos un número.";
    if (!symbolOK) return "Debe incluir al menos un símbolo.";
    return null;
}

export default async (req, res) => {
  
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
        return res.status(400).json({ message: 'Token y nueva contraseña son requeridos.' });
    }

   
    const validationError = validatePassword(newPassword);
    if (validationError) {
        console.error("Error 400: Validación de contraseña fallida en el servidor.");
        return res.status(400).json({ message: validationError });
    }
  

    try {
       
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id;

        
        const result = await pool.query(
            'SELECT reset_token, reset_token_expires FROM users WHERE id = $1',
            [userId]
        );
        const user = result.rows[0];

        if (!user || user.reset_token !== token || new Date() > user.reset_token_expires) {
           
            return res.status(401).json({ message: 'El token de restablecimiento es inválido o ha expirado.' });
        }

       
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

       
        await pool.query(
            
            'UPDATE users SET password = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2',
            [hashedPassword, userId]
        );

       
        return res.status(200).json({ message: 'Contraseña actualizada con éxito.' });

    } catch (error) {
        
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            console.error('JWT Error:', error.message);
            return res.status(401).json({ message: 'El token de restablecimiento es inválido o ha expirado.' });
        }

        console.error('FATAL ERROR en resetPassword:', error);
        return res.status(500).json({ message: 'Error interno del servidor. Inténtalo de nuevo.' });
    }
};
