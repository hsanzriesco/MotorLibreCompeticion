const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

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

    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
        return res.status(400).json({ message: 'Token and new password are required.' });
    }

    try {
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            return res.status(401).json({ message: 'Invalid or expired token.' });
        }

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
        // JSON return para manejar errores en el frontend
        return res.status(500).json({ message: 'An error occurred while resetting the password.' });
    }
};