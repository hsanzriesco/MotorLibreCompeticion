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

        // 🔑 CAMBIO CLAVE: Búsqueda por 'name' O 'email'
        const { rows } = await pool.query(
            "SELECT id, name, email, role, password, is_banned FROM users WHERE name = $1 OR email = $1",
            [username]
        );

        if (rows.length === 0) {
            console.log(`Login fallido: Usuario o Email no encontrado (${username}).`);
            return res.status(401).json({ success: false, message: "Credenciales incorrectas" });
        }

        const user = rows[0];
        const hashedPassword = user.password;

        // Verificar is_banned
        if (user.is_banned) {
            const banInfo = await pool.query(
                'SELECT ban_reason FROM usuarios_baneados WHERE user_id = $1',
                [user.id]
            );
            const banReason = banInfo.rows.length > 0 ? banInfo.rows[0].ban_reason : 'Sin especificar.';

            console.log(`Login bloqueado: Usuario baneado (${username}).`);
            return res.status(403).json({
                success: false,
                message: `Tu cuenta ha sido suspendida. Razón: ${banReason}`
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
// 3. ACCIONES DE USUARIO (UPDATE de Perfil/Contraseña - Manejo de PUT /api/users?action=...)
// ------------------------------------------------------------------------------------------------
async function userActionHandler(req, res) {
    const { method, query } = req;
    const action = query.action;

    try {
        if (method === "PUT") {
            const body = await getBody(req);
            if (!body) return res.status(400).json({ success: false, message: "Cuerpo de solicitud vacío o inválido." });

            // 3.1. ACTUALIZACIÓN DE CONTRASEÑA
            if (action === "updatePassword") {
                const { id, newPassword } = body;

                if (!id || !newPassword)
                    return res.status(400).json({ success: false, message: "Datos inválidos" });

                const salt = await bcrypt.genSalt(10);
                const hashedPassword = await bcrypt.hash(newPassword, salt);

                await pool.query("UPDATE users SET password = $1 WHERE id = $2", [hashedPassword, id]);
                return res.status(200).json({ success: true, message: "Contraseña actualizada correctamente." });
            }

            // 3.2. ACTUALIZACIÓN DE NOMBRE/EMAIL
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
// 4. CRUD GENERAL (Admin) (GET, PUT, DELETE, POST con role) - MODIFICADO
// ------------------------------------------------------------------------------------------------
async function userListCrudHandler(req, res) {
    const { method, query } = req;
    let body;

    try {
        // --- INICIO DE MODIFICACIÓN ---
        // Exclusión: Permitir GET con ID para todos los usuarios (público)
        if (method === "GET" && query.id) {
            const userResult = await pool.query(
                // ⚠️ SOLO SELECCIONAR CAMPOS PÚBLICOS
                "SELECT id, name, role, created_at, club_id, is_banned FROM users WHERE id = $1",
                [query.id]
            );

            if (userResult.rows.length === 0) {
                return res.status(404).json({ success: false, message: "Usuario no encontrado" });
            }

            // No se obtienen datos sensibles (email, password, ban_reason) para público
            return res.status(200).json({ success: true, data: userResult.rows[0] });
        }
        // --- FIN DE MODIFICACIÓN ---


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
            // LISTAR TODOS (Admin)
            const result = await pool.query(
                "SELECT id, name, email, role, created_at, club_id, is_banned FROM users ORDER BY id DESC"
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

            const result = await pool.query(
                "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, club_id, is_banned",
                [name, email, hashedPassword, role]
            );

            return res.status(201).json({ success: true, user: result.rows[0] });
        }


        // PUT: ACTUALIZAR USUARIO (Admin)
        if (method === "PUT") {
            const { id } = query;
            const { name, email, password, role, club_id, is_banned, ban_reason } = body;

            if (!id) {
                return res.status(400).json({ success: false, message: "ID requerido" });
            }

            // 🚀 LÓGICA DE BANEO/DESBANEO CON RAZÓN 🚀 (Sin cambios)
            if (is_banned !== undefined) {
                if (is_banned === true) {
                    // VALIDACIÓN: La razón es obligatoria al banear
                    if (!ban_reason || ban_reason.trim() === "") {
                        return res.status(400).json({ success: false, message: 'La razón del baneo es obligatoria.' });
                    }
                    await pool.query(
                        `INSERT INTO usuarios_baneados (user_id, ban_reason) 
                         VALUES ($1, $2)
                         ON CONFLICT (user_id) DO UPDATE SET ban_reason = EXCLUDED.ban_reason`,
                        [id, ban_reason.trim()]
                    );
                    await pool.query('UPDATE users SET is_banned = TRUE WHERE id = $1', [id]);
                    console.log(`Usuario ${id} baneado. Razón: ${ban_reason.trim()}`);

                    return res.status(200).json({ success: true, message: 'Usuario baneado con éxito.' });

                } else if (is_banned === false) {
                    // DESBANEAR
                    await pool.query(
                        'DELETE FROM usuarios_baneados WHERE user_id = $1',
                        [id]
                    );
                    await pool.query('UPDATE users SET is_banned = FALSE WHERE id = $1', [id]);
                    console.log(`Usuario ${id} desbaneado.`);

                    return res.status(200).json({ success: true, message: 'Usuario desbaneado con éxito.' });
                }
            }
            // 🚀 FIN LÓGICA DE BANEO/DESBANEO 🚀


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

            // Lógica de validación de club_id
            if (club_id !== undefined && club_id !== null) {
                const userCheck = await pool.query(
                    "SELECT club_id FROM users WHERE id = $1",
                    [id]
                );

                if (userCheck.rows.length > 0 && userCheck.rows[0].club_id !== null) {
                    return res.status(400).json({
                        success: false,
                        message: "El usuario ya pertenece a un club.",
                    });
                }
            }

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
                    password = COALESCE($4, password),
                    club_id = $5
                WHERE id = $6
                RETURNING id, name, email, role, created_at, club_id, is_banned 
            `;

            const result = await pool.query(updateQuery, [
                name ?? null,
                email ?? null,
                role ?? null,
                hashedPassword ?? null,
                club_id ?? null,
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

            await pool.query("DELETE FROM usuarios_baneados WHERE user_id = $1", [id]);

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
// 5. EXPORTACIONES DEL HANDLER PRINCIPAL (Ruteador)
// ------------------------------------------------------------------------------------------------
export default async function usersCombinedHandler(req, res) {
    const { method, query } = req;
    const action = query.action;

    // 1. REGISTRO PÚBLICO (POST simple a /api/users sin action)
    if (method === "POST" && !action) {
        return createUserHandler(req, res);
    }

    // 2. LOGIN (POST con ?action=login)
    if (method === "POST" && action === "login") {
        return loginUserHandler(req, res);
    }

    // 3. ACCIONES DE PERFIL (PUT con ?action=updatePassword o ?action=updateName)
    if (method === "PUT" && (action === "updatePassword" || action === "updateName")) {
        return userActionHandler(req, res);
    }

    // 4. CRUD DE ADMINISTRACIÓN Y VISTA PÚBLICA POR ID
    if (method === "GET" || method === "DELETE" || method === "PUT" || method === "POST") {
        return userListCrudHandler(req, res);
    }

    // Método o ruta no reconocida
    return res.status(405).json({ success: false, message: "Método o ruta de usuario no reconocida." });
}