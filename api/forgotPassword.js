import { Pool } from 'pg';
import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
    
});

export default async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: 'Email is required.' });
    }

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || !process.env.JWT_SECRET || !process.env.DATABASE_URL) {
        return res.status(500).json({ 
            message: 'Internal Server Error: Missing critical environment variables (EMAIL_USER, EMAIL_PASS, JWT_SECRET, or DATABASE_URL).' 
        });
    }

    try {
        const result = await pool.query('SELECT id, email FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user) {
            return res.status(200).json({ message: 'If the user exists, a password reset email has been sent.' });
        }
        
        const userId = user.id;

        const token = jwt.sign(
            { id: userId }, 
            process.env.JWT_SECRET, 
            { expiresIn: '1h' }
        );
        
        const expirationDate = new Date(Date.now() + 3600000);

        await pool.query(
            'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
            [token, expirationDate, userId]
        );

        const resetURL = `https://motor-libre-competicion.vercel.app/pages/auth/reset/reset.html?token=${token}`;
        
        const mailOptions = {
            from: `Motor Libre Competición <${process.env.EMAIL_USER}>`,
            to: user.email,
            subject: 'Motor Libre Competición: Password Reset Request',
            html: `
                <p>Hello,</p>
                <p>You have requested a password reset. Click the link below to create a new password:</p>
                <a href="${resetURL}" style="display: inline-block; padding: 10px 20px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 5px; margin-top: 15px;">
                    Reset Password
                </a>
                <p style="margin-top: 20px;">This link will expire in 1 hour.</p>
                <p>If you did not request this change, please ignore this email.</p>
            `,
        };

        await transporter.sendMail(mailOptions);

        return res.status(200).json({ message: 'Password reset email sent successfully.' });

    } catch (error) {
        console.error('FATAL ERROR during password reset process:', error.message || error);
        
        return res.status(500).json({ message: 'Internal Server Error. Failed to process password reset request. Check Vercel logs for details.' });
    }
};
