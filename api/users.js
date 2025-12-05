// api/users.js
// Archivo unificado para todas las acciones de usuario (CRUD y Login)
// Combina: createUser, loginUser, userAction, userList

import { Pool } from "pg";
import bcrypt from "bcryptjs";

// --- CONFIGURACIÓN DE BASE DE DATOS ---
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

// Se requiere configurar `bodyParser: false` en Next.js para usar `getBody` en userActionHandler
export const config = {
    api: { bodyParser: false },
};

// 🛠️ HELPER: Función para leer el cuerpo JSON cuando bodyParser está en false (Tomado de userAction.js)
const getBody = async (req) => {
    try {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        return JSON.parse(Buffer.concat(chunks).toString());
    } catch (e) {
        // En caso de error de parseo o cuerpo vacío, retorna null
        return null;
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
        console.log("--- REGISTRO INICIADO ---");
        // Nota: Si el bodyParser está activo (que lo está para esta ruta), req.body ya contiene los datos.
        const { name, email, password } = req.body;
        const roleToAssign = req.body.role || 'user'; // Por defecto 'user' si no se especifica

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
            "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role",
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
export async function loginUserHandler(req, res) {
    // El ruteador principal ya chequeó que el método sea POST, pero lo dejamos por seguridad.
    if (req.method !== "POST") {
        return res.status(405).json({ success: false, message: "Método no permitido" });
    }

    try {
        console.log("--- LOGIN INICIADO ---");
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ success: false, message: "Faltan datos" });
        }

        const { rows } = await pool.query(
            "SELECT id, name, email, role, password FROM users WHERE name = $1",
            [username]
        );

        if (rows.length === 0) {
            console.log(`Login fallido: Usuario no encontrado (${username}).`);
            return res.status(401).json({ success: false, message: "Credenciales incorrectas" });
        }

        const user = rows[0];
        const hashedPassword = user.password;

        const match = await bcrypt.compare(password, hashedPassword);

        if (!match) {
            console.log(`Login fallido: Contraseña incorrecta para ${username}.`);
            return res.status(401).json({ success: false, message: "Credenciales incorrectas" });
        }

        console.log(`LOGIN EXITOSO para ${username}.`);
        return res.status(200).json({
            success: true,
            message: "Inicio de sesión correcto",
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
            const body = await getBody(req); // Usamos getBody porque bodyParser está desactivado para esta ruta
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
                message: "El nombre o correo ya están registrados."
            });
        }
        return res.status(500).json({ success: false, message: "Error interno del servidor." });
    }
}


// ------------------------------------------------------------------------------------------------
// 4. CRUD GENERAL (Admin) (GET, PUT, DELETE, POST con role)
// ------------------------------------------------------------------------------------------------
async function userListCrudHandler(req, res) {
    const { method, query, body } = req;

    try {
        // GET: LISTAR TODOS LOS USUARIOS
        if (method === "GET") {
            const result = await pool.query(
                "SELECT id, name, email, role, created_at, club_id FROM users ORDER BY id DESC"
            );
            return res.status(200).json({ success: true, data: result.rows });
        }

        // POST: CREAR NUEVO USUARIO (Admin, requiere 'role' en el body)
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
                "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, club_id",
                [name, email, hashedPassword, role]
            );

            return res.status(201).json({ success: true, user: result.rows[0] });
        }

        // PUT: ACTUALIZAR USUARIO O UNIRLO A UN CLUB (Admin, requiere ID en query)
        if (method === "PUT") {
            const { id } = query;
            const { name, email, password, role, club_id } = body;

            if (!id) {
                return res.status(400).json({ success: false, message: "ID requerido" });
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
                RETURNING id, name, email, role, created_at, club_id
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

        // DELETE: ELIMINAR USUARIO (Admin, requiere ID en query)
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

        if (error.code === "23505") {
            return res.status(409).json({ success: false, message: "Nombre o correo ya registrados." });
        }

        return res.status(500).json({ success: false, message: "Error interno." });
    }
}


// ------------------------------------------------------------------------------------------------
// 5. EXPORTACIONES DEL HANDLER PRINCIPAL (Ruteador CORREGIDO)
// ------------------------------------------------------------------------------------------------
export default async function usersCombinedHandler(req, res) {
    const { method, query } = req;
    const action = query.action; // Parámetro principal para diferenciar acciones

    // 1. LOGIN (POST con ?action=login)
    if (method === "POST" && action === "login") {
        return loginUserHandler(req, res);
    }

    // 2. ACCIONES DE PERFIL (PUT con ?action=updatePassword o ?action=updateName)
    if (method === "PUT" && (action === "updatePassword" || action === "updateName")) {
        return userActionHandler(req, res);
    }

    // 3. REGISTRO PÚBLICO (POST simple a /api/users sin parámetros de acción ni rol)
    if (method === "POST" && !action && !req.body?.role) {
        return createUserHandler(req, res);
    }

    // 4. CRUD DE ADMINISTRACIÓN (GET, DELETE, PUT sin acción, y POST con role)
    // Cubre: Listar, Admin Update (con ID), Eliminar (con ID), y Admin Create (con role)
    if (method === "GET" || method === "DELETE" || method === "PUT" || (method === "POST" && req.body?.role)) {
        return userListCrudHandler(req, res);
    }

    // Método o ruta no reconocida
    return res.status(405).json({ success: false, message: "Método o ruta de usuario no reconocida." });
}