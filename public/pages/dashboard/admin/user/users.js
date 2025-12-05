document.addEventListener("DOMContentLoaded", () => {
    const usuario =
        JSON.parse(localStorage.getItem("usuario")) ||
        JSON.parse(sessionStorage.getItem("usuario"));

    if (!usuario || usuario.role !== "admin") {
        mostrarAlerta("Acceso denegado. Solo administradores pueden acceder.", "error", 2000);
        setTimeout(() => {
            window.location.href = "/pages/auth/login/login.html";
        }, 2000);
        return;
    }

    document.getElementById("logoRedirect").addEventListener("click", () => {
        if (usuario.role === "admin") {
            window.location.href = "/pages/dashboard/admin/admin.html";
        } else {
            window.location.href = "/index.html";
        }
    });

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

    const passwordHelp = document.getElementById("passwordHelp");

    const userToDeleteName = document.getElementById("userToDeleteName");
    let currentUserIdToDelete = null;

    async function cargarUsuarios() {
        try {
            const res = await fetch("/api/users");
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
            usersTableBody.innerHTML = `<tr><td colspan="6">Error al cargar usuarios</td></tr>`;
        }
    }

    btnAddUser.addEventListener("click", () => {
        userForm.reset();
        userId.value = "";
        userPassword.disabled = false;

        confirmPasswordContainer.style.display = "block";
        if (passwordHelp) passwordHelp.style.display = "block";

        document.querySelector("#userModal .modal-title").textContent = "Nuevo Usuario";
        userModal.show();
    });

    usersTableBody.addEventListener("click", async (e) => {
        const btn = e.target.closest("button");
        if (!btn) return;

        const id = btn.dataset.id;
        const action = btn.dataset.action;

        if (action === "edit") {
            const res = await fetch("/api/users");
            const { data } = await res.json();
            const user = data.find((u) => u.id == id);

            userId.value = user.id;
            userName.value = user.name;
            userEmail.value = user.email;
            userRole.value = user.role;

            confirmPasswordContainer.style.display = "none";
            if (passwordHelp) passwordHelp.style.display = "none";

            userPassword.value = "";
            userPassword2.value = "";
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

    userPassword.addEventListener('input', () => {
        const passwordValue = userPassword.value.trim();
        if (passwordValue.length > 0) {
            confirmPasswordContainer.style.display = "block";
            if (passwordHelp) passwordHelp.style.display = "block";
        } else if (userId.value !== "") {
            confirmPasswordContainer.style.display = "none";
            if (passwordHelp) passwordHelp.style.display = "none";
        }
    });


    btnConfirmDelete.addEventListener("click", () => {
        eliminarUsuario(currentUserIdToDelete);
        deleteConfirmModal.hide();
    });

    async function eliminarUsuario(id) {
        const res = await fetch(`/api/users?id=${id}`, { method: "DELETE" });
        const data = await res.json();

        if (data.success) {
            mostrarAlerta("Usuario eliminado", "exito");
            cargarUsuarios();
        }
    }

    userForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const creating = userId.value === "";
        const newPassword = userPassword.value.trim();
        const changingPassword = newPassword.length > 0;

        if (creating || changingPassword) {
            if (newPassword === "" && creating) {
                return mostrarAlerta("La contraseña es obligatoria para un nuevo usuario.", "error");
            }

            if (newPassword !== userPassword2.value.trim()) {
                return mostrarAlerta("Las contraseñas no coinciden.", "error");
            }

            const passwordError = validatePassword(newPassword);
            if (passwordError) {
                return mostrarAlerta(passwordError, "error");
            }
        }

        if (!userName.value.trim() || !userEmail.value.trim()) {
            return mostrarAlerta("El nombre y el email son obligatorios.", "error");
        }

        const payload = {
            id: creating ? undefined : userId.value,
            name: userName.value,
            email: userEmail.value,
            role: userRole.value,
            password: changingPassword ? newPassword : undefined
        };

        const method = creating ? "POST" : "PUT";

        const res = await fetch("/api/users", {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (res.status === 409) {
            return mostrarAlerta("El nombre o correo ya están en uso.", "error");
        }


        if (data.success) {
            mostrarAlerta(creating ? "Usuario creado" : "Usuario actualizado", "exito");
            userModal.hide();
            cargarUsuarios();
        } else {
            mostrarAlerta(data.message || "Error al guardar el usuario.", "error");
        }
    });

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