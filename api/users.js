

import { Pool } from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";


const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});


const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_no_usar_en_produccion';


export const config = {
    api: { bodyParser: false },
};


const getBody = async (req) => {
    try {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const buffer = Buffer.concat(chunks);
        if (buffer.length === 0) return null;
        return JSON.parse(buffer.toString());
    } catch (e) {
        return null;
    }
};


const verifyToken = (req) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { authorized: false, message: 'No autorizado: Token de autenticación requerido.' };
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        return { authorized: true, user: decoded };
    } catch (e) {
        console.error("Fallo al verificar el token JWT:", e.message);
        return { authorized: false, message: 'No autorizado: Token inválido o expirado.' };
    }
};


const verifyAdmin = (req) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new Error('No autorizado: Token de autenticación requerido.');
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        if (decoded.role !== 'admin') {
            throw new Error('Acceso denegado: Se requiere rol de administrador.');
        }

        return decoded;
    } catch (e) {
        console.error("Fallo al verificar el token JWT:", e.message);
        throw new Error('No autorizado: Token inválido o expirado.');
    }
};


async function createUserHandler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ success: false, message: "Método no permitido" });
    }

    try {
        console.log("--- REGISTRO PÚBLICO INICIADO ---");
        const body = await getBody(req);
        if (!body) return res.status(400).json({ success: false, message: "Cuerpo de solicitud vacío o inválido." });

        const { name, email, password } = body;
      
        const roleToAssign = 'user';

        if (!name || !email || !password) {
            console.error("Error 400: Campos requeridos faltantes.");
            return res.status(400).json({ success: false, message: "Faltan campos requeridos" });
        }

        
        const existingUser = await pool.query(
            "SELECT * FROM users WHERE email = $1 OR name = $2",
            [email, name]
        );

        if (existingUser.rows.length > 0) {
            console.error("Error 409: Usuario o correo ya existe.");
            return res.status(409).json({
                success: false,
                message: "El nombre o correo ya están registrados.",
            });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

      
        const result = await pool.query(
            "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, is_banned",
            [name, email, hashedPassword, roleToAssign]
        );
        console.log(`Usuario ${name} insertado en DB.`);

        return res.status(201).json({ success: true, user: result.rows[0] });
    } catch (error) {
        console.error("### FALLO CRÍTICO EN CREATEUSER ###");
        console.error("Detalle del error:", error);
        if (error.code === "23505") { // Error de violación de unicidad
            return res.status(409).json({
                success: false,
                message: "El nombre o correo ya están registrados.",
            });
        }
        return res.status(500).json({ success: false, message: "Error interno del servidor" });
    }
}



async function loginUserHandler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ success: false, message: "Método no permitido" });
    }

    try {
        console.log("--- LOGIN INICIADO ---");
        const body = await getBody(req);
        if (!body) return res.status(400).json({ success: false, message: "Cuerpo de solicitud vacío o inválido." });

        const { username, password } = body;

        if (!username || !password) {
            return res.status(400).json({ success: false, message: "Faltan datos" });
        }

        
        const { rows } = await pool.query(
            "SELECT id, name, email, role, password, is_banned, club_id, is_presidente FROM users WHERE name = $1 OR email = $1",
            [username]
        );

        if (rows.length === 0) {
            console.log(`Login fallido: Usuario o Email no encontrado (${username}).`);
            return res.status(401).json({ success: false, message: "Nombre de usuario o contraseña incorrectos" });
        }

        const user = rows[0];
        const hashedPassword = user.password;

       
        if (user.is_banned) {
            console.log(`Login bloqueado: Usuario baneado (${username}).`);
            return res.status(403).json({
                success: false,
                message: `Tu cuenta ha sido suspendida.`
            });
        }

        const match = await bcrypt.compare(password, hashedPassword);

        if (!match) {
            console.log(`Login fallido: Contraseña incorrecta para ${username}.`);
            return res.status(401).json({ success: false, message: "Credenciales incorrectas" });
        }

        
        const token = jwt.sign(
            {
                id: user.id,
                role: user.role,
                club_id: user.club_id || null, 
                is_presidente: user.is_presidente === true 
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        console.log(`LOGIN EXITOSO para ${username}.`);

        
        return res.status(200).json({
            success: true,
            message: "Inicio de sesión correcto",
            token: token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                club_id: user.club_id || null, 
                is_presidente: user.is_presidente === true
            },
        });
    } catch (error) {
        console.error("### FALLO CRÍTICO EN LOGINUSER ###");
        console.error("Detalle del error:", error);
        return res.status(500).json({ success: false, message: "Error interno del servidor" });
    }
}



async function getMeHandler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({ success: false, message: "Método no permitido" });
    }

    try {
        console.log("--- PERFIL DE USUARIO (/me) INICIADO ---");

       
        const verification = verifyToken(req);

        if (!verification.authorized) {
            return res.status(401).json({ success: false, message: verification.message });
        }

        const decodedUser = verification.user;

       
        const query = `
            SELECT 
                u.id, 
                u.name, 
                u.email, 
                u.role, 
                u.club_id,      
                u.is_presidente    
            FROM 
                users u
            WHERE 
                u.id = $1
        `;

        const { rows } = await pool.query(query, [decodedUser.id]);

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: "Usuario no encontrado en la base de datos." });
        }

        const userProfile = rows[0];

       
        const clubId = userProfile.club_id || null;
        const isPresidente = userProfile.is_presidente === true;

        return res.status(200).json({
            success: true,
            user: {
                id: userProfile.id,
                name: userProfile.name,
                email: userProfile.email,
                role: userProfile.role,
                club_id: clubId,
                is_presidente: isPresidente
            }
        });

    } catch (error) {
        console.error("### FALLO CRÍTICO EN getMeHandler (BD/SQL) ###");
        console.error("Detalle del error:", error.message);

    
        if (error.code === '42703') {
            console.error("ACCIÓN REQUERIDA: ¡ERROR DE ESQUEMA DB! La tabla 'users' carece de una de las columnas requeridas (club_id o is_presidente).");
            return res.status(500).json({ success: false, message: "Error interno del servidor: Faltan columnas clave en la tabla de usuarios." });
        }

       
        if (error.message.includes('No autorizado') || error.message.includes('Token')) {
            return res.status(401).json({ success: false, message: "Sesión inválida o expirada. Vuelva a iniciar sesión." });
        }


        return res.status(500).json({ success: false, message: "Error interno del servidor al obtener perfil." });
    }
}



async function userActionHandler(req, res) {
    const { method, query } = req;
    const action = query.action;

    try {
        if (method === "PUT") {
            const body = await getBody(req);
            if (!body) return res.status(400).json({ success: false, message: "Cuerpo de solicitud vacío o inválido." });

         
            if (action === "updatePassword") {
                const { id, newPassword } = body;

               

                if (!id || !newPassword)
                    return res.status(400).json({ success: false, message: "Datos inválidos" });

                const salt = await bcrypt.genSalt(10);
                const hashedPassword = await bcrypt.hash(newPassword, salt);

                await pool.query("UPDATE users SET password = $1 WHERE id = $2", [hashedPassword, id]);
                return res.status(200).json({ success: true, message: "Contraseña actualizada correctamente." });
            }

           
            if (action === "updateName") {
                const { id, newName, newEmail } = body;

                if (!id || !newName || !newEmail)
                    return res.status(400).json({ success: false, message: "Datos inválidos (ID, nombre o email faltante)" });

               
                const existingUser = await pool.query(
                    "SELECT id FROM users WHERE (email = $1 OR name = $2) AND id != $3",
                    [newEmail, newName, id]
                );

                if (existingUser.rows.length > 0) {
                    return res.status(409).json({
                        success: false,
                        message: "El nuevo nombre o correo ya están registrados por otro usuario.",
                    });
                }

                await pool.query("UPDATE users SET name = $1, email = $2 WHERE id = $3", [newName, newEmail, id]);

                return res.status(200).json({ success: true, message: "Perfil actualizado correctamente." });
            }
        }

      
        return res.status(405).json({
            success: false,
            message: "Ruta o método no válido en userActions.js",
        });
    } catch (error) {
        console.error("Error en userActionHandler:", error);
        if (error.code === "23505") {
            return res.status(409).json({
                success: false,
                message: "El nombre o correo ya están registrados.",
            });
        }
        return res.status(500).json({ success: false, message: "Error interno del servidor." });
    }
}



async function userListCrudHandler(req, res) {
    const { method, query } = req;
    let body;

    try {
       
        if (method === "GET" && query.id) {
            const userResult = await pool.query(
                "SELECT id, name, role, created_at, is_banned FROM users WHERE id = $1",
                [query.id]
            );

            if (userResult.rows.length === 0) {
                return res.status(404).json({ success: false, message: "Usuario no encontrado" });
            }

            return res.status(200).json({ success: true, data: userResult.rows[0] });
        }
        
        verifyAdmin(req);
        console.log(`Acceso de administrador verificado para la operación ${method}.`);

        
        if (method === "POST" || method === "PUT") {
            body = await getBody(req);
            if (!body) {
                
                if (method === "POST" || (method === "PUT" && !query.id)) {
                    return res.status(400).json({ success: false, message: "Cuerpo de solicitud vacío o inválido." });
                }
            }
        }

       
        if (method === "GET") {
            const result = await pool.query(
                "SELECT id, name, email, role, created_at, is_banned, club_id, is_presidente FROM users ORDER BY id DESC"
            );
            return res.status(200).json({ success: true, data: result.rows });
        }


        
        if (method === "POST") {
            const { name, email, password, role } = body;

            if (!name || !email || !password || !role) {
                return res.status(400).json({ success: false, message: "Faltan campos requeridos." });
            }

           
            const existingUser = await pool.query(
                "SELECT id FROM users WHERE email = $1 OR name = $2",
                [email, name]
            );

            if (existingUser.rows.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: "El nombre o correo ya están registrados.",
                });
            }

            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            const result = await pool.query(
                "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, is_banned",
                [name, email, hashedPassword, role]
            );

            return res.status(201).json({ success: true, user: result.rows[0] });
        }


        
        if (method === "PUT") {
            const id = query.id || (body ? body.id : null);
            const { name, email, password, role, is_banned, club_id, is_presidente } = body;

            if (!id) {
                return res.status(400).json({ success: false, message: "ID de usuario requerido para la actualización." });
            }

           
            if (is_banned !== undefined && Object.keys(body).length === 2 && body.id) {
                await pool.query('UPDATE users SET is_banned = $1 WHERE id = $2', [is_banned, id]);
                const status = is_banned ? 'baneado' : 'desbaneado';
                console.log(`Usuario ${id} ${status}.`);
                return res.status(200).json({ success: true, message: `Usuario ${status} con éxito.` });
            }
           


            
            if (name || email) {
                const checkConflict = await pool.query(
                    "SELECT id FROM users WHERE (email = $1 OR name = $2) AND id != $3",
                    [email, name, id]
                );
                if (checkConflict.rows.length > 0) {
                    return res.status(409).json({ success: false, message: "El nuevo nombre o correo ya están registrados." });
                }
            }

            
            let hashForUpdate = undefined;
            if (password) {
                const salt = await bcrypt.genSalt(10);
                hashForUpdate = await bcrypt.hash(password, salt);
            }

            const updateQuery = `
                UPDATE users
                SET name = COALESCE($1, name),
                    email = COALESCE($2, email),
                    role = COALESCE($3, role),
                    password = COALESCE($4, password),
                    club_id = COALESCE($5, club_id),
                    is_presidente = COALESCE($6, is_presidente)
                WHERE id = $7
                RETURNING id, name, email, role, created_at, is_banned, club_id, is_presidente
            `;

            const result = await pool.query(updateQuery, [
                name ?? null,
                email ?? null,
                role ?? null,
                hashForUpdate ?? null, 
                club_id, 
                is_presidente, 
                id
            ]);

            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, message: "Usuario no encontrado" });
            }

            return res.status(200).json({ success: true, user: result.rows[0], message: "Usuario actualizado por administrador." });
        }

       
        if (method === "DELETE") {
            const { id } = query;
            if (!id) return res.status(400).json({ success: false, message: "ID faltante." });

           

            const result = await pool.query("DELETE FROM users WHERE id = $1 RETURNING id", [id]);

            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, message: "Usuario no encontrado para eliminar" });
            }

            return res.status(200).json({ success: true, message: "Usuario eliminado" });
        }

        return res.status(405).json({ success: false, message: "Método no permitido." });

    } catch (error) {
        console.error("Error en userListCrudHandler:", error);

        
        if (error.message.includes('No autorizado') || error.message.includes('Acceso denegado')) {
            return res.status(401).json({ success: false, message: error.message });
        }

        if (error.code === "23503") {
            return res.status(409).json({ success: false, message: "No se puede eliminar: está siendo referenciado por otra entidad (ej. un club)." });
        }

        if (error.code === "23505") {
            return res.status(409).json({ success: false, message: "Nombre o correo ya registrados." });
        }
        
        if (error.code === '42703') {
            console.error("ACCIÓN REQUERIDA: ¡ERROR DE ESQUEMA DB! La tabla 'users' carece de una de las columnas requeridas.");
            return res.status(500).json({ success: false, message: "Error interno del servidor: Faltan columnas clave en la tabla de usuarios." });
        }

        return res.status(500).json({ success: false, message: "Error interno." });
    }
}



export default async function usersCombinedHandler(req, res) {
    const { method, query } = req;
    const action = query.action;

   
    if (method === "POST" && !action) {
        return createUserHandler(req, res);
    }

    
    if (method === "GET" && action === "me") {
        return getMeHandler(req, res);
    }

   
    if (method === "POST" && action === "login") {
        return loginUserHandler(req, res);
    }

   
    if (method === "PUT" && (action === "updatePassword" || action === "updateName")) {
        return userActionHandler(req, res);
    }

   
    if (method === "GET" || method === "DELETE" || method === "PUT" || method === "POST") {
        return userListCrudHandler(req, res);
    }

   
    return res.status(405).json({ success: false, message: "Método o ruta de usuario no reconocida." });
}
