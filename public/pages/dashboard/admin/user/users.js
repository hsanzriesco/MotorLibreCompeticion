document.addEventListener("DOMContentLoaded", () => {

    // ============================
    // 🔐 Validación de acceso
    // ============================
    const usuario =
        JSON.parse(localStorage.getItem("usuario")) ||
        JSON.parse(sessionStorage.getItem("usuario"));

    if (!usuario || usuario.role !== "admin") {
        mostrarAlerta("❌ Acceso denegado. Solo administradores pueden acceder.", "error", 2000);
        setTimeout(() => {
            window.location.href = "/pages/auth/login/login.html";
        }, 2000);
        return;
    }

    // ============================
    // 🔀 Redirección del logo
    // ============================
    document.getElementById("logoRedirect").addEventListener("click", () => {
        if (usuario.role === "admin") {
            window.location.href = "/pages/dashboard/admin/admin.html";
        } else {
            window.location.href = "/index.html";
        }
    });

    // ============================

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
    const userPassword2 = document.getElementById("userPassword2");
    const userRole = document.getElementById("userRole");
    const confirmPasswordContainer = document.getElementById("confirmPasswordContainer");

    const userToDeleteName = document.getElementById("userToDeleteName");
    let currentUserIdToDelete = null;

    // ============================
    // 📥 Cargar usuarios
    // ============================
    async function cargarUsuarios() {
        try {
            const res = await fetch("/api/userList");
            if (!res.ok) throw new Error(`Error HTTP: ${res.status}`);
            const data = await res.json();

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
                    </td>
                `;

                usersTableBody.appendChild(tr);
            });

        } catch (err) {
            console.error(err);
            usersTableBody.innerHTML = `<tr><td colspan="6">❌ Error al cargar usuarios</td></tr>`;
        }
    }

    // ============================
    // ➕ Nuevo usuario
    // ============================
    btnAddUser.addEventListener("click", () => {
        userForm.reset();
        userId.value = "";
        userPassword.disabled = false;

        confirmPasswordContainer.style.display = "block"; // mostrar confirmación al crear usuario

        document.querySelector("#userModal .modal-title").textContent = "Nuevo Usuario";
        userModal.show();
    });

    // ============================
    // ✏️ Editar usuario
    // ============================
    usersTableBody.addEventListener("click", async (e) => {
        const btn = e.target.closest("button");
        if (!btn) return;

        const id = btn.dataset.id;
        const action = btn.dataset.action;

        if (action === "edit") {
            const res = await fetch("/api/userList");
            const { data } = await res.json();
            const user = data.find((u) => u.id == id);

            userId.value = user.id;
            userName.value = user.name;
            userEmail.value = user.email;
            userRole.value = user.role;

            confirmPasswordContainer.style.display = "none"; // NO confirmar contraseña al editar
            userPassword.value = "";
            userPassword.disabled = user.role === "user";

            document.querySelector("#userModal .modal-title").textContent = "Editar Usuario";
            userModal.show();
        }

        if (action === "delete") {
            userToDeleteName.textContent = btn.closest("tr").children[0].textContent;
            currentUserIdToDelete = id;
            deleteConfirmModal.show();
        }
    });

    // ============================
    // 🗑️ Confirmar eliminación
    // ============================
    btnConfirmDelete.addEventListener("click", () => {
        eliminarUsuario(currentUserIdToDelete);
        deleteConfirmModal.hide();
    });

    async function eliminarUsuario(id) {
        const res = await fetch(`/api/userList?id=${id}`, { method: "DELETE" });
        const data = await res.json();

        if (data.success) {
            mostrarAlerta("Usuario eliminado", "exito");
            cargarUsuarios();
        }
    }

    // ============================
    // 💾 Guardar usuario
    // ============================
    userForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const creating = userId.value === "";

        if (creating) {
            if (!userPassword.value.trim())
                return mostrarAlerta("La contraseña es obligatoria.", "error");

            if (userPassword.value !== userPassword2.value)
                return mostrarAlerta("Las contraseñas no coinciden.", "error");
        }

        const payload = {
            id: creating ? undefined : userId.value,
            name: userName.value,
            email: userEmail.value,
            role: userRole.value,
            password: userPassword.disabled ? undefined :
                userPassword.value.trim() || undefined
        };

        const method = creating ? "POST" : "PUT";

        const res = await fetch("/api/userList", {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (data.success) {
            mostrarAlerta(creating ? "Usuario creado" : "Usuario actualizado", "exito");
            userModal.hide();
            cargarUsuarios();
        }
    });

    // ============================
    // 👁 Mostrar/ocultar contraseña
    // ============================
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

    cargarUsuarios();
});