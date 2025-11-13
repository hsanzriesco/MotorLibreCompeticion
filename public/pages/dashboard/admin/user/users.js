document.addEventListener("DOMContentLoaded", () => {
    // CAMBIO: Usamos localStorage para consistencia, aunque ambos se revisan por precaución
    const usuario = JSON.parse(localStorage.getItem("usuario")) || JSON.parse(sessionStorage.getItem("usuario"));

    // === CONTROL DE ACCESO ===
    if (!usuario || usuario.role !== "admin") {
        // USO DE ALERTA GLOBAL (con duración de 2s)
        mostrarAlerta("❌ Acceso denegado. Solo administradores pueden acceder.", "error", 2000); 
        setTimeout(() => {
            window.location.href = "/pages/auth/login/login.html";
        }, 2000);
        return;
    }

    // === ELEMENTOS DEL DOM Y MODALES ===
    const usersTableBody = document.getElementById("usersTableBody");
    const userModal = new bootstrap.Modal(document.getElementById("userModal"));
    const deleteConfirmModal = new bootstrap.Modal(document.getElementById("deleteConfirmModal"));
    const userForm = document.getElementById("userForm");
    const btnAddUser = document.getElementById("btnAddUser");
    const btnConfirmDelete = document.getElementById("btnConfirmDelete");

    const userId = document.getElementById("userId");
    const userName = document.getElementById("userName");
    const userEmail = document.getElementById("userEmail");
    const userPassword = document.getElementById("userPassword");
    const userRole = document.getElementById("userRole");
    const userToDeleteName = document.getElementById("userToDeleteName");

    let currentUserIdToDelete = null;

    // === 🔁 CARGAR USUARIOS ===
    async function cargarUsuarios() {
        try {
            const res = await fetch("/api/userList");
            if (!res.ok) throw new Error(`Error HTTP: ${res.status}`);
            const data = await res.json();

            if (data.success) {
                usersTableBody.innerHTML = "";
                data.data.forEach((user) => {
                    const tr = document.createElement("tr");
                    tr.innerHTML = `
                        <td>${user.name}</td>
                        <td>${user.email}</td>
                        <td>${user.role}</td>
                        <td>${new Date(user.created_at).toLocaleDateString()}</td>
                        <td>
                          <button class="btn btn-sm btn-outline-light me-2" data-id="${user.id}" data-action="edit">
                            <i class="bi bi-pencil"></i>
                          </button>
                          <button class="btn btn-sm btn-outline-danger" data-id="${user.id}" data-action="delete">
                            <i class="bi bi-trash"></i>
                          </button>
                        </td>`;
                    usersTableBody.appendChild(tr);
                });
            } else {
                usersTableBody.innerHTML = `<tr><td colspan="6">${data.message}</td></tr>`;
            }
        } catch (err) {
            console.error("Error al cargar usuarios:", err);
            usersTableBody.innerHTML = `<tr><td colspan="6">Error de conexión: ${err.message}</td></tr>`;
        }
    }

    // === 🗑️ ELIMINAR USUARIO ===
    async function eliminarUsuario(id) {
        try {
            const res = await fetch(`/api/userList?id=${id}`, { method: "DELETE" });
            const data = await res.json();

            if (data.success) {
                // USO DE ALERTA GLOBAL
                mostrarAlerta("Usuario eliminado correctamente.", "exito"); 
                cargarUsuarios();
            } else {
                // USO DE ALERTA GLOBAL
                mostrarAlerta(data.message || "❌ Error al eliminar usuario.", "error"); 
            }
        } catch (err) {
            // USO DE ALERTA GLOBAL
            mostrarAlerta("❌ Error de conexión al eliminar usuario.", "error"); 
        }
    }

    // === ABRIR MODAL AÑADIR ===
    btnAddUser.addEventListener("click", () => {
        userForm.reset();
        userId.value = "";
        document.querySelector("#userModal .modal-title").textContent = "Nuevo Usuario";
        userModal.show();
    });

    // === EVENTOS DE LA TABLA (EDITAR/ELIMINAR) ===
    usersTableBody.addEventListener("click", async (e) => {
        const button = e.target.closest("button");
        if (!button) return;
        const id = button.dataset.id;
        const action = button.dataset.action;
        const row = button.closest("tr");

        if (action === "edit") {
            try {
                // Obtener todos los usuarios y buscar el seleccionado
                const res = await fetch("/api/userList");
                const { data } = await res.json();
                const user = data.find((u) => u.id == id);

                if (!user) {
                    // USO DE ALERTA GLOBAL
                    return mostrarAlerta("Usuario no encontrado.", "error"); 
                }

                userId.value = user.id;
                userName.value = user.name;
                userEmail.value = user.email;
                userPassword.value = "";
                userRole.value = user.role;

                document.querySelector("#userModal .modal-title").textContent = "Editar Usuario";
                userModal.show();
            } catch (err) {
                // USO DE ALERTA GLOBAL
                mostrarAlerta("Error al cargar datos del usuario.", "error"); 
            }
        }

        if (action === "delete") {
            // Configurar el modal de confirmación de eliminación
            const name = row.children[0].textContent;
            userToDeleteName.textContent = name;
            currentUserIdToDelete = id;
            deleteConfirmModal.show();
        }
    });
    
    // === CONFIRMAR ELIMINACIÓN ===
    btnConfirmDelete.addEventListener("click", () => {
        if (currentUserIdToDelete) {
            eliminarUsuario(currentUserIdToDelete);
            deleteConfirmModal.hide();
        }
    });


    // === 💾 ENVIAR FORMULARIO (CREAR/EDITAR) ===
    userForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const payload = {
            id: userId.value || undefined, // Si es nuevo, id es undefined/null
            name: userName.value,
            email: userEmail.value,
            // Solo enviar la contraseña si se ha modificado
            password: userPassword.value.trim() || undefined, 
            role: userRole.value,
        };
        
        // Validar que si es un nuevo usuario, la contraseña no esté vacía
        if (!userId.value && !payload.password) {
            return mostrarAlerta("Para crear un nuevo usuario, la contraseña es obligatoria.", "aviso");
        }

        const method = userId.value ? "PUT" : "POST";
        const successMessage = userId.value ? "Usuario actualizado correctamente." : "🎉 Usuario creado con éxito.";

        try {
            const res = await fetch("/api/userList", {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            
            if (data.success) {
                userModal.hide();
                cargarUsuarios();
                // USO DE ALERTA GLOBAL
                mostrarAlerta(successMessage, "exito"); 
            } else {
                // USO DE ALERTA GLOBAL
                mostrarAlerta(data.message || "Error al guardar usuario.", "error"); 
            }
        } catch (err) {
            // USO DE ALERTA GLOBAL
            mostrarAlerta("Error de conexión al guardar usuario.", "error"); 
        }
    });

    cargarUsuarios();
});