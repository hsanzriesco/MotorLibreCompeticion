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
// 1. REGISTRO DE USUARIO (Manejo de POST directo /api/users o /api/users?action=create)
// ------------------------------------------------------------------------------------------------
async function createUserHandler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ success: false, message: "Método no permitido" });
    }

    try {
        console.log("--- REGISTRO INICIADO ---");
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
        if (error.code === "23505") { // Código de violación de restricción de unicidad
            return res.status(409).json({
                success: false,
                message: "El nombre o correo ya están registrados.",
            });
        }
        return res.status(500).json({ success: false, message: "Error interno del servidor" });
    }
}


// ------------------------------------------------------------------------------------------------
// 2. LOGIN DE USUARIO (Se recomienda un endpoint dedicado como /api/login)
// ------------------------------------------------------------------------------------------------
export async function loginUserHandler(req, res) {
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
// 3. ACCIONES DE USUARIO (UPDATE de Perfil/Contraseña - Tomado de userAction.js)
// ------------------------------------------------------------------------------------------------
// Se requiere configurar `bodyParser: false` en Next.js para usar `getBody`
export const config = {
    api: { bodyParser: false },
};

async function userActionHandler(req, res) {
    const { method } = req;
    const urlParts = new URL(req.url, `http://${req.headers.host}`);
    const action = urlParts.searchParams.get("action");

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

                await pool.query("UPDATE users SET name = $1, email = $2 WHERE id = $3", [newName, newEmail, id]);

                return res.status(200).json({ success: true, message: "Perfil actualizado correctamente." });
            }
        }

        // Si no es un método/acción conocido
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
// 4. LISTADO, CREACIÓN (Admin), ACTUALIZACIÓN (Admin) y ELIMINACIÓN (Admin) (Tomado de userList.js)
// ------------------------------------------------------------------------------------------------
async function userListCrudHandler(req, res) {
    const { method } = req;

    try {
        // GET: LISTAR TODOS LOS USUARIOS
        if (method === "GET") {
            const result = await pool.query(
                "SELECT id, name, email, role, created_at, club_id FROM users ORDER BY id DESC"
            );
            return res.status(200).json({ success: true, data: result.rows });
        }

        // POST: CREAR NUEVO USUARIO (similar a createUserHandler, pero asume que el rol se pasa explícitamente)
        if (method === "POST") {
            // Nota: Esta lógica es redundante con `createUserHandler`, pero se mantiene por si /api/users tiene lógica distinta a /api/createUser
            const { name, email, password, role } = req.body;

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

        // PUT: ACTUALIZAR USUARIO O UNIRLO A UN CLUB
        if (method === "PUT") {
            const { id } = req.query;
            const { name, email, password, role, club_id } = req.body;

            if (!id) {
                return res.status(400).json({ success: false, message: "ID requerido" });
            }

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

        // DELETE: ELIMINAR USUARIO
        if (method === "DELETE") {
            const { id } = req.query; // Asume que el ID se pasa como query param
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
// 5. EXPORTACIONES DEL HANDLER PRINCIPAL (Ruteador)
// ------------------------------------------------------------------------------------------------
// Este handler exportado actuará como el punto de entrada principal para /api/users
export default async function usersCombinedHandler(req, res) {
    const { url } = req;

    // Ruteo por nombre de archivo/lógica original. Asume:
    // /api/users/login -> loginUserHandler
    // /api/users/actions -> userActionHandler
    // /api/users (GET, POST, PUT, DELETE) -> userListCrudHandler

    if (url.includes("/login")) {
        return loginUserHandler(req, res);
    } else if (url.includes("/actions") || req.query.action) {
        // userActionHandler necesita el getBody por su configuración
        return userActionHandler(req, res);
    } else if (req.method === "POST" && !req.query.role) {
        // Si es un POST y no tiene role explícito, asume el registro de usuario normal
        return createUserHandler(req, res);
    } else {
        // Para GET, PUT (admin), DELETE (admin) y POST (admin con rol)
        return userListCrudHandler(req, res);
    }
}