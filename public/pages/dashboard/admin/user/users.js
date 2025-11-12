document.addEventListener("DOMContentLoaded", () => {
    const usuario = JSON.parse(sessionStorage.getItem("usuario"));
    if (!usuario || usuario.role !== "admin") {
        showAlert("Acceso denegado. Solo administradores pueden acceder.", "error");
        window.location.href = "/pages/auth/login/login.html";
        return;
    }

    // ✅ Referencias del DOM
    const usersTableBody = document.getElementById("usersTableBody");
    const userModal = new bootstrap.Modal(document.getElementById("userModal"));
    const userForm = document.getElementById("userForm");
    const btnAddUser = document.getElementById("btnAddUser");

    const userId = document.getElementById("userId");
    const userName = document.getElementById("userName");
    const userEmail = document.getElementById("userEmail");
    const userPassword = document.getElementById("userPassword");
    const userRole = document.getElementById("userRole");

    // ✅ Modal de confirmación de eliminación
    const deleteConfirmModalElement = document.getElementById("deleteConfirmModal");
    const deleteConfirmModal = new bootstrap.Modal(deleteConfirmModalElement);
    const btnConfirmDelete = document.getElementById("btnConfirmDelete");
    const userToDeleteName = document.getElementById("userToDeleteName");

    let userIdToDelete = null; // ID temporal del usuario a eliminar

    // ✅ Función de alertas visuales
    function showAlert(message, type = "error") {
        const alert = document.createElement("div");
        alert.className = `custom-alert ${type}`;
        alert.innerHTML = `<div class="alert-content">${message}</div>`;
        document.body.appendChild(alert);
        setTimeout(() => alert.classList.add("show"), 50);
        setTimeout(() => {
            alert.classList.remove("show");
            setTimeout(() => alert.remove(), 300);
        }, 2500);
    }

    // ✅ Cargar todos los usuarios
    async function cargarUsuarios() {
        try {
            const res = await fetch("/api/userList");
            if (!res.ok) throw new Error(`Error HTTP: ${res.status}`);
            const data = await res.json();

            usersTableBody.innerHTML = "";

            if (data.success && data.data.length > 0) {
                data.data.forEach((user) => {
                    const tr = document.createElement("tr");
                    tr.innerHTML = `
                        <td>${user.name}</td>
                        <td>${user.email}</td>
                        <td>${user.role}</td>
                        <td>${new Date(user.created_at).toLocaleString()}</td>
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
                usersTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-light">${data.message || "No hay usuarios registrados."}</td></tr>`;
            }
        } catch (err) {
            console.error("Error al cargar usuarios:", err);
            usersTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Error de conexión: ${err.message}</td></tr>`;
        }
    }

    // ✅ Eliminar usuario (confirmado)
    async function eliminarUsuario() {
        if (!userIdToDelete) return;

        const id = userIdToDelete;
        userIdToDelete = null;

        try {
            const res = await fetch(`/api/userList?id=${id}`, { method: "DELETE" });
            const data = await res.json();
            deleteConfirmModal.hide();

            if (data.success) {
                showAlert("Usuario eliminado correctamente.", "success");
                cargarUsuarios();
            } else {
                showAlert(data.message || "No se pudo eliminar el usuario.", "error");
            }
        } catch (err) {
            deleteConfirmModal.hide();
            showAlert("Error de conexión al eliminar usuario.", "error");
        }
    }

    btnConfirmDelete.addEventListener("click", eliminarUsuario);

    // ✅ Abrir modal para crear usuario nuevo
    btnAddUser.addEventListener("click", () => {
        userForm.reset();
        userId.value = "";
        document.querySelector("#userModal .modal-title").textContent = "Nuevo Usuario";
        userModal.show();
    });

    // ✅ Escuchar clicks en los botones de editar / eliminar
    usersTableBody.addEventListener("click", async (e) => {
        const button = e.target.closest("button");
        if (!button) return;

        const id = button.dataset.id;
        const action = button.dataset.action;

        if (action === "edit") {
            try {
                const res = await fetch("/api/userList");
                const { data } = await res.json();
                const user = data.find((u) => u.id == id);
                if (!user) return showAlert("Usuario no encontrado.", "error");

                userId.value = user.id;
                userName.value = user.name;
                userEmail.value = user.email;
                userPassword.value = "";
                userRole.value = user.role;

                document.querySelector("#userModal .modal-title").textContent = "Editar Usuario";
                userModal.show();
            } catch (err) {
                showAlert("Error al obtener los datos del usuario.", "error");
            }
        }

        if (action === "delete") {
            try {
                const res = await fetch("/api/userList");
                const { data } = await res.json();
                const user = data.find((u) => u.id == id);

                if (!user) {
                    showAlert("Usuario no encontrado para eliminar.", "error");
                    return;
                }

                userIdToDelete = id;
                userToDeleteName.textContent = user.name;
                deleteConfirmModal.show();
            } catch (err) {
                showAlert("Error al buscar el usuario.", "error");
            }
        }
    });

    // ✅ Guardar usuario (crear o editar)
    userForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const payload = {
            id: userId.value,
            name: userName.value,
            email: userEmail.value,
            password: userPassword.value || undefined,
            role: userRole.value,
        };

        const method = userId.value ? "PUT" : "POST";

        try {
            const res = await fetch("/api/userList", {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const data = await res.json();

            if (data.success) {
                userModal.hide();
                showAlert("Usuario guardado correctamente.", "success");
                cargarUsuarios();
            } else {
                showAlert("Error: " + data.message, "error");
            }
        } catch (err) {
            showAlert("Error de conexión al guardar usuario.", "error");
        }
    });

    // ✅ Cargar usuarios al iniciar
    cargarUsuarios();
});
