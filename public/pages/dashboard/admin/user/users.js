// pages/dashboard/admin/users.js

document.addEventListener("DOMContentLoaded", () => {
    // --- 1. CONFIGURACIÓN Y VARIABLES ---

    // Autenticación (Se mantiene la lógica para ambos almacenamientos, aunque sessionStorage es preferible para admin)
    const storedUser = sessionStorage.getItem("usuario") || localStorage.getItem("usuario");
    let usuario = null;
    if (storedUser) {
        try {
            usuario = JSON.parse(storedUser);
        } catch (e) {
            console.error("Error al parsear usuario:", e);
        }
    }

    if (!usuario || usuario.role !== "admin") {
        if (typeof mostrarAlerta === 'function') {
            mostrarAlerta("Acceso denegado. Solo administradores pueden acceder.", "error", 2000);
        }
        setTimeout(() => {
            window.location.href = "/pages/auth/login/login.html";
        }, 2000);
        return;
    }

    // Redirección del logo (Se mantiene)
    document.getElementById("logoRedirect").addEventListener("click", (e) => {
        e.preventDefault();
        window.location.href = "/pages/dashboard/admin/admin.html";
    });


    // Variables DOM
    const usersTableBody = document.getElementById("usersTableBody");
    const userModalEl = document.getElementById("userModal");
    const userModal = new bootstrap.Modal(userModalEl);
    const deleteConfirmModal = new bootstrap.Modal(document.getElementById("deleteConfirmModal"));
    const userForm = document.getElementById("userForm");

    const btnAddUser = document.getElementById("btnAddUser");
    const btnConfirmDelete = document.getElementById("btnConfirmDelete");

    const userId = document.getElementById("userId");
    const userName = document.getElementById("userName");
    const userEmail = document.getElementById("userEmail");
    const userPassword = document.getElementById("userPassword");
    const userPassword2 = document.getElementById("userPassword2");
    const userRole = document.getElementById("userRole");
    const confirmPasswordContainer = document.getElementById("confirmPasswordContainer");

    const passwordHelp = document.getElementById("passwordHelp"); // Asegúrate de que este ID exista en tu HTML si lo usas
    const userToDeleteName = document.getElementById("userToDeleteName");
    let currentUserIdToDelete = null;

    // --- 2. FUNCIONES DE UTILIDAD Y VALIDACIÓN ---

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

    // --- 3. CRUD: CARGA Y EVENTOS ---

    async function cargarUsuarios() {
        if (!usersTableBody) return;
        usersTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-secondary">Cargando usuarios...</td></tr>';

        try {
            const res = await fetch("/api/users");
            if (!res.ok) throw new Error(`Error HTTP: ${res.status}`);
            const data = await res.json();

            if (!data.success || !Array.isArray(data.data)) throw new Error(data.message || "Fallo al obtener la lista de usuarios.");

            usersTableBody.innerHTML = "";

            // ⚠️ Importante: Modificar el thead en users.html para añadir la columna "Estado" ⚠️
            // <tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Estado</th><th>Creado en</th><th>Acciones</th></tr>

            data.data.forEach((user) => {
                const tr = document.createElement("tr");

                // Lógica de Baneo para el Frontend
                const isBanned = user.is_banned;
                const banButtonText = isBanned ? 'Desbanear' : 'Banear';
                const banButtonClass = isBanned ? 'btn-success' : 'btn-danger';
                const statusBadge = isBanned
                    ? '<span class="badge bg-danger">Baneado</span>'
                    : '<span class="badge bg-success">Activo</span>';

                // Generación de la Fila con la nueva columna 'Estado' y el botón de baneo
                tr.innerHTML = `
                    <td>${user.name}</td>
                    <td>${user.email}</td>
                    <td>${user.role}</td>
                    <td>${statusBadge}</td>
                    <td>${new Date(user.created_at).toLocaleDateString()}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-warning me-2 edit-user-btn" data-id="${user.id}">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm me-2 btn-ban ${banButtonClass}" 
                            data-id="${user.id}" 
                            data-is-banned="${isBanned}">
                            ${banButtonText}
                        </button>
                        <button class="btn btn-sm btn-outline-danger delete-user-btn" data-id="${user.id}">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                `;

                usersTableBody.appendChild(tr);
            });

        } catch (err) {
            console.error("Error al cargar usuarios:", err);
            usersTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Error al cargar usuarios: ${err.message}</td></tr>`;
        }
    }

    // Nueva función para manejar el baneo/desbaneo
    async function manejarBaneo(userId, estadoActualBaneo) {
        const nuevoEstado = !estadoActualBaneo;

        try {
            const response = await fetch(`/api/users?id=${userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                // El payload solo necesita el ID (en la URL) y el nuevo estado
                body: JSON.stringify({ is_banned: nuevoEstado }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || `Error HTTP: ${response.status}`);
            }

            if (typeof mostrarAlerta === 'function') {
                mostrarAlerta(`Usuario ${nuevoEstado ? 'baneado' : 'desbaneado'} con éxito.`, "exito");
            }
            // Recargar la tabla para actualizar la interfaz
            cargarUsuarios();

        } catch (error) {
            console.error("Fallo al banear/desbanear:", error);
            if (typeof mostrarAlerta === 'function') {
                mostrarAlerta(`Error al procesar la acción de baneo: ${error.message}`, "error");
            }
        }
    }


    // Manejador para abrir el modal de edición/creación
    async function openUserEditModal(id) {
        userForm.reset();
        userPassword.disabled = false;
        userId.value = id || "";

        const isNew = !id;

        document.querySelector("#userModal .modal-title").textContent = isNew ? "Nuevo Usuario" : "Editar Usuario";

        // Configuración de campos de contraseña
        confirmPasswordContainer.style.display = isNew ? "block" : "none";
        if (passwordHelp) passwordHelp.style.display = isNew ? "block" : "none";
        userPassword.placeholder = isNew ? "Contraseña requerida" : "Dejar vacío para no cambiar";


        if (!isNew) {
            try {
                // 💥 CORRECCIÓN CRÍTICA: Se hace GET a un solo usuario por ID 💥
                const res = await fetch(`/api/users?id=${id}`);
                const data = await res.json();

                if (!res.ok || !data.success || !data.data || !data.data.length) throw new Error(data.message || "Usuario no encontrado.");

                const user = data.data[0];

                userName.value = user.name;
                userEmail.value = user.email;
                userRole.value = user.role;

            } catch (error) {
                console.error("Error al obtener datos del usuario:", error);
                if (typeof mostrarAlerta === 'function') {
                    mostrarAlerta(`Error al cargar datos del usuario: ${error.message}`, "error");
                }
                return;
            }
        }
        userModal.show();
    }

    // --- 4. LISTENERS ---

    // 4.1. Listener de la Tabla (Edición, Eliminación y BANEO)
    usersTableBody.addEventListener("click", async (e) => {
        const btn = e.target.closest("button");
        if (!btn) return;

        const id = btn.dataset.id;

        if (btn.classList.contains("edit-user-btn")) {
            await openUserEditModal(id);
        }

        // 🚀 NUEVO: Listener para el botón de Baneo/Desbaneo
        if (btn.classList.contains("btn-ban")) {
            // El atributo data-is-banned es un string, lo convertimos a booleano
            const isBanned = btn.dataset.isBanned === 'true';
            await manejarBaneo(id, isBanned);
            return; // Detenemos la ejecución después de manejar el baneo
        }

        if (btn.classList.contains("delete-user-btn")) {
            userToDeleteName.textContent = btn.closest("tr").children[0].textContent;
            currentUserIdToDelete = id;
            deleteConfirmModal.show();
        }
    });

    // 4.2. Listener de Añadir Usuario
    btnAddUser.addEventListener("click", () => {
        openUserEditModal(null); // Abre el modal en modo creación
    });

    // 4.3. Listener de Eliminación Confirmada
    btnConfirmDelete.addEventListener("click", async () => {
        if (!currentUserIdToDelete) return;

        try {
            // 💥 CORRECCIÓN CRÍTICA: ID en la URL para DELETE 💥
            const res = await fetch(`/api/users?id=${currentUserIdToDelete}`, { method: "DELETE" });
            const data = await res.json();

            if (!res.ok) throw new Error(data.message || `Fallo al eliminar (${res.status})`);

            if (typeof mostrarAlerta === 'function') {
                mostrarAlerta("Usuario eliminado", "exito");
            }
            deleteConfirmModal.hide();
            cargarUsuarios();
        } catch (err) {
            console.error("Error al eliminar usuario:", err);
            if (typeof mostrarAlerta === 'function') {
                mostrarAlerta(`Error al eliminar usuario: ${err.message}`, "error");
            }
        }
    });


    // 4.4. Listener de la Contraseña (Mostrar/Ocultar Confirmación)
    userPassword.addEventListener('input', () => {
        const passwordValue = userPassword.value.trim();
        const isEditing = userId.value !== "";

        if (passwordValue.length > 0 && isEditing) {
            confirmPasswordContainer.style.display = "block";
            if (passwordHelp) passwordHelp.style.display = "block";
        } else if (isEditing && passwordValue.length === 0) {
            confirmPasswordContainer.style.display = "none";
            userPassword2.value = ""; // Limpiar el campo de confirmación
            if (passwordHelp) passwordHelp.style.display = "none";
        }
    });


    // 4.5. Listener de Envío del Formulario (Creación/Edición)
    userForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const creating = userId.value === "";
        const newPassword = userPassword.value.trim();
        const changingPassword = newPassword.length > 0;

        // Validaciones de Contraseña
        if (creating || changingPassword) {
            if (newPassword === "" && creating) {
                if (typeof mostrarAlerta === 'function') {
                    return mostrarAlerta("La contraseña es obligatoria para un nuevo usuario.", "error");
                }
            }

            if (newPassword !== userPassword2.value.trim()) {
                if (typeof mostrarAlerta === 'function') {
                    return mostrarAlerta("Las contraseñas no coinciden.", "error");
                }
            }

            const passwordError = validatePassword(newPassword);
            if (passwordError) {
                if (typeof mostrarAlerta === 'function') {
                    return mostrarAlerta(passwordError, "error");
                }
            }
        }

        // Validación de campos principales
        if (!userName.value.trim() || !userEmail.value.trim()) {
            if (typeof mostrarAlerta === 'function') {
                return mostrarAlerta("El nombre y el email son obligatorios.", "error");
            }
        }

        // Construcción del Payload
        const payload = {
            name: userName.value.trim(),
            email: userEmail.value.trim(),
            role: userRole.value,
        };

        if (changingPassword || creating) {
            payload.password = newPassword;
        }

        const method = creating ? "POST" : "PUT";
        // 💥 CORRECCIÓN CRÍTICA: Añadir ID a la URL para PUT 💥
        const url = creating ? "/api/users" : `/api/users?id=${userId.value}`;

        try {
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (!res.ok) {
                // Manejo del 409 Conflict (nombre/correo duplicado)
                if (res.status === 409) {
                    if (typeof mostrarAlerta === 'function') {
                        return mostrarAlerta("El nombre o correo ya están en uso.", "error");
                    }
                }
                // Cualquier otro error
                throw new Error(data.message || `Error al guardar (${res.status})`);
            }


            if (data.success) {
                if (typeof mostrarAlerta === 'function') {
                    mostrarAlerta(creating ? "Usuario creado" : "Usuario actualizado", "exito");
                }
                userModal.hide();
                cargarUsuarios();
            } else {
                if (typeof mostrarAlerta === 'function') {
                    mostrarAlerta(data.message || "Error al guardar el usuario.", "error");
                }
            }
        } catch (err) {
            console.error("Fallo en la petición:", err);
            if (typeof mostrarAlerta === 'function') {
                mostrarAlerta(`Error al guardar: ${err.message}`, "error");
            }
        }
    });

    // 4.6. Lógica de Mostrar/Ocultar Contraseña (Toggle)
    document.addEventListener("click", (e) => {
        if (!e.target.classList.contains("togglePassword")) return;

        const input = document.getElementById(e.target.dataset.target);

        if (input.type === "password") {
            input.type = "text";
            e.target.classList.replace("bi-eye-slash-fill", "bi-eye-fill");
        } else {
            input.type = "password";
            e.target.classList.replace("bi-eye-fill", "bi-eye-slash-fill");
        }
    });

    // --- 5. INICIALIZACIÓN ---
    cargarUsuarios();
});