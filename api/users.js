// api/users.js
// Archivo unificado para todas las acciones de usuario (CRUD y Login)

import { Pool } from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// --- CONFIGURACIÓN DE BASE DE DATOS ---
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

// ⚠️ NECESITAS DEFINIR ESTO EN TU .env
// En producción, ¡usa una cadena larga y aleatoria en tu .env!
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_no_usar_en_produccion';

// Se requiere configurar `bodyParser: false` para usar `getBody`
export const config = {
    api: { bodyParser: false },
};

// 🛠️ HELPER: Función para leer el cuerpo JSON cuando bodyParser está en false
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

// 🔒 MIDDLEWARE DE SEGURIDAD: Verifica el JWT y extrae la carga útil (payload)
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

// 🔒 MIDDLEWARE DE SEGURIDAD: Verifica el JWT y el Rol de Administrador
const verifyAdmin = (req) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.error("Acceso denegado: Token no proporcionado.");
        throw new Error('No autorizado: Token de autenticación requerido.');
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        if (decoded.role !== 'admin') {
            console.error(`Acceso denegado: Rol '${decoded.role}' no es 'admin'.`);
            throw new Error('Acceso denegado: Se requiere rol de administrador.');
        }

        return decoded;
    } catch (e) {
        console.error("Fallo al verificar el token JWT:", e.message);
        throw new Error('No autorizado: Token inválido o expirado.');
    }
};

// ------------------------------------------------------------------------------------------------
// 1. REGISTRO PÚBLICO (Manejo de POST directo /api/users)
// ------------------------------------------------------------------------------------------------
async function createUserHandler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ success: false, message: "Método no permitido" });
    }

    try {
        console.log("--- REGISTRO PÚBLICO INICIADO ---");
        const body = await getBody(req);
        if (!body) return res.status(400).json({ success: false, message: "Cuerpo de solicitud vacío o inválido." });

        const { name, email, password } = body;
        const roleToAssign = body.role || 'user';

        if (!name || !email || !password) {
            console.error("Error 400: Campos requeridos faltantes.");
            return res.status(400).json({ success: false, message: "Faltan campos requeridos" });
        }

        // Revisión de usuario existente por email o nombre
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
        if (error.code === "23505") {
            return res.status(409).json({
                success: false,
                message: "El nombre o correo ya están registrados.",
            });
        }
        return res.status(500).json({ success: false, message: "Error interno del servidor" });
    }
}


// ------------------------------------------------------------------------------------------------
// 2. LOGIN DE USUARIO (Manejo de POST /api/users?action=login)
// ------------------------------------------------------------------------------------------------
async function loginUserHandler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ success: false, message: "Método no permitido" });
    }

    try {
        console.log("--- LOGIN INICIADO ---");
        const body = await getBody(req);
        if (!body) return res.status(400).json({ success: false, message: "Cuerpo de solicitud vacío o inválido." });

        // Acepta username (nombre de usuario o email) y password
        const { username, password } = body;

        if (!username || !password) {
            return res.status(400).json({ success: false, message: "Faltan datos" });
        }

        // Búsqueda por 'name' O 'email'
        const { rows } = await pool.query(
            "SELECT id, name, email, role, password, is_banned FROM users WHERE name = $1 OR email = $1",
            [username]
        );

        if (rows.length === 0) {
            console.log(`Login fallido: Usuario o Email no encontrado (${username}).`);
            return res.status(401).json({ success: false, message: "Nombre de usuario o contraseña incorrectos" });
        }

        const user = rows[0];
        const hashedPassword = user.password;

        // ⭐ MODIFICACIÓN: Verificar is_banned (Eliminada la consulta a 'usuarios_baneados')
        if (user.is_banned) {
            console.log(`Login bloqueado: Usuario baneado (${username}).`);
            return res.status(403).json({
                success: false,
                // Mensaje genérico, ya que no podemos obtener la razón sin la tabla
                message: `Tu cuenta ha sido suspendida.`
            });
        }

        const match = await bcrypt.compare(password, hashedPassword);

        if (!match) {
            console.log(`Login fallido: Contraseña incorrecta para ${username}.`);
            return res.status(401).json({ success: false, message: "Credenciales incorrectas" });
        }

        // Generar el JWT
        const token = jwt.sign(
            { id: user.id, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        console.log(`LOGIN EXITOSO para ${username}.`);

        // Devolver el token
        return res.status(200).json({
            success: true,
            message: "Inicio de sesión correcto",
            token: token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
        });
    } catch (error) {
        console.error("### FALLO CRÍTICO EN LOGINUSER ###");
        console.error("Detalle del error:", error);
        return res.status(500).json({ success: false, message: "Error interno del servidor" });
    }
}


// ------------------------------------------------------------------------------------------------
// 3. OBTENER PERFIL DEL USUARIO LOGUEADO (Manejo de GET /api/users?action=me)
// ------------------------------------------------------------------------------------------------
async function getMeHandler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({ success: false, message: "Método no permitido" });
    }

    try {
        console.log("--- PERFIL DE USUARIO (/me) INICIADO ---");

        // 1. Verificar el token y extraer la información del usuario logueado
        const verification = verifyToken(req);

        if (!verification.authorized) {
            return res.status(401).json({ success: false, message: verification.message });
        }

        const decodedUser = verification.user;

        // 2. Obtener datos frescos de la base de datos
        // ⭐ MODIFICACIÓN: Eliminada la referencia a 'club_id'
        const { rows } = await pool.query(
            "SELECT id, name, email, role FROM users WHERE id = $1",
            [decodedUser.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: "Usuario no encontrado en la base de datos." });
        }

        const userProfile = rows[0];

        // 3. Devolver los datos del perfil
        return res.status(200).json({
            success: true,
            user: userProfile
        });

    } catch (error) {
        console.error("Error en getMeHandler:", error);
        return res.status(500).json({ success: false, message: "Error interno del servidor al obtener perfil." });
    }
}


// ------------------------------------------------------------------------------------------------
// 4. ACCIONES DE USUARIO (UPDATE de Perfil/Contraseña - Manejo de PUT /api/users?action=...)
// ------------------------------------------------------------------------------------------------
async function userActionHandler(req, res) {
    const { method, query } = req;
    const action = query.action;

    try {
        if (method === "PUT") {
            const body = await getBody(req);
            if (!body) return res.status(400).json({ success: false, message: "Cuerpo de solicitud vacío o inválido." });

            // 4.1. ACTUALIZACIÓN DE CONTRASEÑA
            if (action === "updatePassword") {
                const { id, newPassword } = body;

                if (!id || !newPassword)
                    return res.status(400).json({ success: false, message: "Datos inválidos" });

                const salt = await bcrypt.genSalt(10);
                const hashedPassword = await bcrypt.hash(newPassword, salt);

                await pool.query("UPDATE users SET password = $1 WHERE id = $2", [hashedPassword, id]);
                return res.status(200).json({ success: true, message: "Contraseña actualizada correctamente." });
            }

            // 4.2. ACTUALIZACIÓN DE NOMBRE/EMAIL
            if (action === "updateName") {
                const { id, newName, newEmail } = body;

                if (!id || !newName || !newEmail)
                    return res.status(400).json({ success: false, message: "Datos inválidos (ID, nombre o email faltante)" });

                // Validación de unicidad antes de actualizar
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

        // Si no es un método PUT o una acción conocida
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


// ------------------------------------------------------------------------------------------------
// 5. CRUD GENERAL (Admin) (GET, PUT, DELETE, POST con role) - MODIFICADO
// ------------------------------------------------------------------------------------------------
async function userListCrudHandler(req, res) {
    const { method, query } = req;
    let body;

    try {
        // --- VISTA PÚBLICA (GET con ID) ---
        if (method === "GET" && query.id) {
            // ⭐ MODIFICACIÓN: Eliminada la referencia a 'club_id'
            const userResult = await pool.query(
                "SELECT id, name, role, created_at, is_banned FROM users WHERE id = $1",
                [query.id]
            );

            if (userResult.rows.length === 0) {
                return res.status(404).json({ success: false, message: "Usuario no encontrado" });
            }

            return res.status(200).json({ success: true, data: userResult.rows[0] });
        }
        // --- FIN VISTA PÚBLICA ---


        // 🚨 VERIFICACIÓN DE ADMIN: Bloquea todos los demás métodos (GET sin ID, POST, PUT, DELETE)
        verifyAdmin(req);
        console.log(`Acceso de administrador verificado para la operación ${method}.`);

        // Cargar el cuerpo manualmente si el método es POST o PUT
        if (method === "POST" || method === "PUT") {
            body = await getBody(req);
            if (!body) {
                if (method === "POST" || Object.keys(query).length === 0) {
                    return res.status(400).json({ success: false, message: "Cuerpo de solicitud vacío o inválido." });
                }
            }
        }

        // GET: LISTAR TODOS LOS USUARIOS (Protegido por Admin)
        if (method === "GET") {
            // ⭐ MODIFICACIÓN: Eliminada la referencia a 'club_id'
            const result = await pool.query(
                "SELECT id, name, email, role, created_at, is_banned FROM users ORDER BY id DESC"
            );
            return res.status(200).json({ success: true, data: result.rows });
        }


        // POST: CREAR NUEVO USUARIO (Admin)
        if (method === "POST") {
            const { name, email, password, role } = body;

            if (!name || !email || !password || !role) {
                return res.status(400).json({ success: false, message: "Faltan campos requeridos." });
            }

            // Validación de existencia
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

            // ⭐ MODIFICACIÓN: Eliminada la referencia a 'club_id' del RETURNING
            const result = await pool.query(
                "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, is_banned",
                [name, email, hashedPassword, role]
            );

            return res.status(201).json({ success: true, user: result.rows[0] });
        }


        // PUT: ACTUALIZAR USUARIO (Admin)
        if (method === "PUT") {
            const { id } = query;
            // ⭐ MODIFICACIÓN: Eliminada la desestructuración de 'club_id' y 'ban_reason'
            const { name, email, password, role, is_banned } = body;

            if (!id) {
                return res.status(400).json({ success: false, message: "ID requerido" });
            }

            // --- Lógica de Baneo/Desbaneo (Simplificada) ---
            // ⭐ MODIFICACIÓN: Uso solo de is_banned de la tabla users.
            if (is_banned !== undefined) {
                await pool.query('UPDATE users SET is_banned = $1 WHERE id = $2', [is_banned, id]);
                const status = is_banned ? 'baneado' : 'desbaneado';
                console.log(`Usuario ${id} ${status}.`);
                return res.status(200).json({ success: true, message: `Usuario ${status} con éxito.` });
            }
            // --- Fin Lógica de Baneo/Desbaneo ---


            // --- Lógica de Actualización de Perfil (Admin) ---

            // Validación de unicidad de nombre/email
            if (name || email) {
                const checkConflict = await pool.query(
                    "SELECT id FROM users WHERE (email = $1 OR name = $2) AND id != $3",
                    [email, name, id]
                );
                if (checkConflict.rows.length > 0) {
                    return res.status(409).json({ success: false, message: "El nuevo nombre o correo ya están registrados." });
                }
            }

            // ⭐ MODIFICACIÓN: Eliminada la lógica de validación de 'club_id'

            let hashedPassword = undefined;
            if (password) {
                const salt = await bcrypt.genSalt(10);
                hashedPassword = await bcrypt.hash(password, salt);
            }


            const updateQuery = `
                UPDATE users
                SET name = COALESCE($1, name),
                    email = COALESCE($2, email),
                    role = COALESCE($3, role),
                    password = COALESCE($4, password)
                WHERE id = $5
                RETURNING id, name, email, role, created_at, is_banned
            `;

            const result = await pool.query(updateQuery, [
                name ?? null,
                email ?? null,
                role ?? null,
                hashedPassword ?? null,
                id
            ]);

            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, message: "Usuario no encontrado" });
            }

            return res.status(200).json({ success: true, user: result.rows[0] });
        }

        // DELETE: ELIMINAR USUARIO (Admin)
        if (method === "DELETE") {
            const { id } = query;
            if (!id) return res.status(400).json({ success: false, message: "ID faltante." });

            // ⭐ MODIFICACIÓN: ELIMINADA la consulta a usuarios_baneados
            // await pool.query("DELETE FROM usuarios_baneados WHERE user_id = $1", [id]); 

            const result = await pool.query("DELETE FROM users WHERE id = $1 RETURNING id", [id]);

            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, message: "Usuario no encontrado para eliminar" });
            }

            return res.status(200).json({ success: true, message: "Usuario eliminado" });
        }

        return res.status(405).json({ success: false, message: "Método no permitido." });

    } catch (error) {
        console.error("Error en userListCrudHandler:", error);

        // Manejo de errores de autorización (Middleware)
        if (error.message.includes('No autorizado') || error.message.includes('Acceso denegado')) {
            return res.status(401).json({ success: false, message: error.message });
        }

        if (error.code === "23503") {
            return res.status(409).json({ success: false, message: "No se puede eliminar: está siendo referenciado por otra entidad (ej. un club)." });
        }

        if (error.code === "23505") {
            return res.status(409).json({ success: false, message: "Nombre o correo ya registrados." });
        }

        return res.status(500).json({ success: false, message: "Error interno." });
    }
}


// ------------------------------------------------------------------------------------------------
// 6. EXPORTACIONES DEL HANDLER PRINCIPAL (Ruteador)
// ------------------------------------------------------------------------------------------------
export default async function usersCombinedHandler(req, res) {
    const { method, query } = req;
    const action = query.action;

    // 1. REGISTRO PÚBLICO (POST simple a /api/users sin action)
    if (method === "POST" && !action) {
        return createUserHandler(req, res);
    }

    // 3. OBTENER PERFIL LOGUEADO (GET con ?action=me)
    if (method === "GET" && action === "me") {
        return getMeHandler(req, res);
    }

    // 2. LOGIN (POST con ?action=login)
    if (method === "POST" && action === "login") {
        return loginUserHandler(req, res);
    }

    // 4. ACCIONES DE PERFIL (PUT con ?action=updatePassword o ?action=updateName)
    if (method === "PUT" && (action === "updatePassword" || action === "updateName")) {
        return userActionHandler(req, res);
    }

    // 5. CRUD DE ADMINISTRACIÓN Y VISTA PÚBLICA POR ID
    if (method === "GET" || method === "DELETE" || method === "PUT" || method === "POST") {
        return userListCrudHandler(req, res);
    }

    // Método o ruta no reconocida
    return res.status(405).json({ success: false, message: "Método o ruta de usuario no reconocida." });
}