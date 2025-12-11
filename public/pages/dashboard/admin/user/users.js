document.addEventListener("DOMContentLoaded", () => {

    function mostrarAlerta(mensaje, tipo, duracion = 4000, limpiarPrevias = true) {
        let container = document.getElementById('alertas-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'alertas-container';
            container.classList.add('alerta-container');
            document.body.appendChild(container);
        }

        let tipoAlerta;
        switch (tipo.toLowerCase()) {
            case 'success':
            case 'exito':
                tipoAlerta = 'exito';
                break;
            case 'danger':
            case 'error':
                tipoAlerta = 'error';
                break;
            case 'warning':
            case 'advertencia':
                tipoAlerta = 'advertencia';
                break;
            case 'info':
            default:
                tipoAlerta = 'info';
                break;
        }

        if (limpiarPrevias) {
            const alertasExistentes = container.querySelectorAll('.alerta');
            alertasExistentes.forEach(alerta => {
                alerta.remove();
            });
        }

        const alerta = document.createElement('div');
        alerta.classList.add('alerta', tipoAlerta);

        let iconoClase = '';
        switch (tipoAlerta) {
            case 'exito':
                iconoClase = 'bi-check-circle-fill';
                break;
            case 'error':
                iconoClase = 'bi-x-octagon-fill';
                break;
            case 'advertencia':
                iconoClase = 'bi-exclamation-triangle-fill';
                break;
            case 'info':
            default:
                iconoClase = 'bi-info-circle-fill';
                break;
        }

        alerta.innerHTML = `<i class="bi ${iconoClase}"></i><div class="alerta-texto">${mensaje}</div>`;

        container.appendChild(alerta);

        alerta.offsetWidth;
        alerta.classList.add('mostrar');

        const remover = () => {
            alerta.classList.remove('mostrar');
            alerta.addEventListener('transitionend', () => {
                if (alerta.parentNode) {
                    alerta.remove();
                }
            }, { once: true });
        };

        if (duracion > 0) {
            setTimeout(remover, duracion);
        }
    }

    const ROOT_REDIRECT = "/";

    const token = sessionStorage.getItem("token");
    const role = sessionStorage.getItem("role");

    const usersTableBody = document.getElementById("usersTableBody");
    const userModal = new bootstrap.Modal(document.getElementById("userModal"));
    const banUserModal = new bootstrap.Modal(document.getElementById("banUserModal"));
    const deleteConfirmModal = new bootstrap.Modal(document.getElementById("deleteConfirmModal"));

    const userForm = document.getElementById("userForm");
    const userId = document.getElementById("userId");
    const userName = document.getElementById("userName");
    const userEmail = document.getElementById("userEmail");
    const userPassword = document.getElementById("userPassword");
    const userPassword2 = document.getElementById("userPassword2");
    const userRole = document.getElementById("userRole");
    const confirmPasswordContainer = document.getElementById("confirmPasswordContainer");

    let userIdToDelete = null;
    let cachedUsers = {};


    const userIdToBan = document.getElementById("userIdToBan");
    const userBanName = document.getElementById("userBanName");
    const banModalTitle = document.getElementById("banModalTitle");
    const banReasonContainer = document.getElementById("banReasonContainer");
    const banReason = document.getElementById("banReason");
    const banAlertMessage = document.getElementById("banAlertMessage");
    const btnConfirmBan = document.getElementById("btnConfirmBan");
    const btnConfirmUnban = document.getElementById("btnConfirmUnban");


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

    document.querySelectorAll('.togglePassword').forEach(toggle => {
        toggle.addEventListener('click', function () {
            const targetId = this.getAttribute('data-target');
            const targetInput = document.getElementById(targetId);
            const type = targetInput.getAttribute('type') === 'password' ? 'text' : 'password';
            targetInput.setAttribute('type', type);
            this.classList.toggle('bi-eye-fill');
            this.classList.toggle('bi-eye-slash-fill');
        });
    });

    userPassword.addEventListener('input', () => {
        if (userPassword.value.trim() !== "" || userId.value === "") {
            confirmPasswordContainer.style.display = 'block';
            userPassword2.required = true;
        } else {
            confirmPasswordContainer.style.display = 'none';
            userPassword2.required = false;
        }
    });

    async function fetchUsers() {
        if (!token) {
            usersTableBody.innerHTML = '<tr><td colspan="6" class="text-center">Error: Debe iniciar sesión para ver esta tabla.</td></tr>';
            return;
        }

        try {
            const response = await fetch("/api/users", {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
            });

            if (response.status === 401 || response.status === 403) {
                console.error("Token no válido. Redirigiendo a login.");
                mostrarAlerta("Sesión expirada o no autorizada. Por favor, inicia sesión de nuevo.", "danger");
                sessionStorage.clear();
                window.location.href = ROOT_REDIRECT;
                return;
            }

            const data = await response.json();

            if (!response.ok) {
                mostrarAlerta("Error al cargar usuarios: " + data.message, "danger");
                return;
            }

            cachedUsers = data.data.reduce((acc, user) => {
                acc[user.id] = user;
                return acc;
            }, {});

            renderUsersTable(data.data);
        } catch (error) {
            console.error("Error fetching users:", error);
            mostrarAlerta("Error de conexión al cargar usuarios.", "danger");
        }
    }

    function renderUsersTable(users) {
        usersTableBody.innerHTML = "";
        users.forEach((user) => {
            const row = usersTableBody.insertRow();
            const date = new Date(user.created_at).toLocaleDateString("es-ES", {
                year: 'numeric', month: 'numeric', day: 'numeric'
            });

            const isBanned = user.is_banned;

            const banButtonClass = isBanned ? 'btn-success' : 'btn-danger';
            const banButtonIcon = isBanned ? 'bi-lock-open-fill' : 'bi-lock-fill';
            const banButtonText = isBanned ? 'Desbanear' : 'Banear';
            const statusBadge = isBanned
                ? '<span class="badge text-bg-danger">BANEADO</span>'
                : '<span class="badge text-bg-success">ACTIVO</span>';

            row.innerHTML = `
                <td>${user.name}</td>
                <td>${user.email}</td>
                <td><span class="badge text-bg-secondary">${user.role.toUpperCase()}</span></td>
                <td>${statusBadge}</td>
                <td>${date}</td>
                <td>
                    <button class="btn btn-sm btn-primary btn-edit me-2" data-id="${user.id}">
                        <i class="bi bi-pencil-square"></i>
                    </button>
                    <button class="btn btn-sm ${banButtonClass} btn-ban me-2" 
                            data-id="${user.id}" 
                            data-name="${user.name}" 
                            data-isbanned="${isBanned}">
                        <i class="bi ${banButtonIcon}"></i> ${banButtonText}
                    </button>
                    <button class="btn btn-sm btn-warning btn-delete" data-id="${user.id}" data-name="${user.name}">
                        <i class="bi bi-trash-fill"></i>
                    </button>
                </td>
            `;
        });

        document.querySelectorAll(".btn-edit").forEach((button) => {
            button.addEventListener("click", (e) => loadUserForEdit(e.currentTarget.dataset.id));
        });

        document.querySelectorAll(".btn-ban").forEach((button) => {
            button.addEventListener("click", (e) => {
                const id = e.currentTarget.dataset.id;
                const name = e.currentTarget.dataset.name;
                const isBanned = e.currentTarget.dataset.isbanned === 'true';

                const user = cachedUsers[id];

                handleBanUserModal(user);
            });
        });

        document.querySelectorAll(".btn-delete").forEach((button) => {
            button.addEventListener("click", (e) => {
                userIdToDelete = e.currentTarget.dataset.id;
                document.getElementById("userToDeleteName").textContent = e.currentTarget.dataset.name;
                deleteConfirmModal.show();
            });
        });
    }


    document.getElementById("btnAddUser").addEventListener("click", () => {
        userForm.reset();
        userId.value = "";
        document.querySelector(".modal-title").textContent = "Añadir Nuevo Usuario";
        confirmPasswordContainer.style.display = 'block';
        userPassword.required = true;
        userPassword2.required = true;
        userPassword.placeholder = "";
        userModal.show();
    });

    async function loadUserForEdit(id) {
        try {

            let user = cachedUsers[id];

            if (!user) {
                const response = await fetch(`/api/users?id=${id}`, {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });
                const data = await response.json();
                if (!response.ok || !data.data || data.data.length === 0) {
                    mostrarAlerta("Error al cargar usuario para edición.", "danger");
                    return;
                }
                user = data.data[0];
            }

            document.querySelector(".modal-title").textContent = `Editar Usuario: ${user.name}`;
            userId.value = user.id;
            userName.value = user.name;
            userEmail.value = user.email;
            userRole.value = user.role;
            userPassword.value = "";
            userPassword2.value = "";
            userPassword.placeholder = "Dejar vacío para no cambiar";
            userPassword.required = false;
            userPassword2.required = false;
            confirmPasswordContainer.style.display = 'none';

            userModal.show();
        } catch (error) {
            console.error("Error loading user:", error);
            mostrarAlerta("Error de conexión al cargar usuario.", "danger");
        }
    }


    userForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const id = userId.value;
        const newPassword = userPassword.value.trim();
        const confirmPassword = userPassword2.value.trim();
        const isCreation = !id;

        if (newPassword) {
            if (newPassword !== confirmPassword) {
                mostrarAlerta("Las contraseñas no coinciden.", "error");
                return;
            }
        } else if (isCreation) {
            mostrarAlerta("Debe especificar una contraseña para el nuevo usuario.", "error");
            return;
        }

        if (newPassword) {
            const passwordError = validatePassword(newPassword);
            if (passwordError) {
                mostrarAlerta(passwordError, "error");
                return;
            }
        }

        const method = isCreation ? "POST" : "PUT";
        const url = isCreation ? "/api/users" : `/api/users?id=${id}`;

        const bodyData = {
            name: userName.value.trim(),
            email: userEmail.value.trim(),
            role: userRole.value,
        };

        if (newPassword) {
            bodyData.password = newPassword;
        }

        try {
            const response = await fetch(url, {
                method: method,
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(bodyData),
            });

            const data = await response.json();

            if (!response.ok) {
                mostrarAlerta(`Error al ${id ? 'actualizar' : 'crear'} usuario: ${data.message}`, "danger");
                return;
            }

            mostrarAlerta(`Usuario ${id ? 'actualizado' : 'creado'} correctamente.`, "success");
            userModal.hide();
            fetchUsers();
        } catch (error) {
            console.error("Error submitting form:", error);
            mostrarAlerta("Error de conexión al guardar usuario.", "danger");
        }
    });

    document.getElementById("btnConfirmDelete").addEventListener("click", async () => {
        if (!userIdToDelete) return;

        try {
            const response = await fetch(`/api/users?id=${userIdToDelete}`, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
            });

            const data = await response.json();

            if (!response.ok) {
                mostrarAlerta(`Error al eliminar usuario: ${data.message}`, "danger");
                return;
            }

            mostrarAlerta("Usuario eliminado correctamente.", "success");
            deleteConfirmModal.hide();
            fetchUsers();
            userIdToDelete = null;
        } catch (error) {
            console.error("Error deleting user:", error);
            mostrarAlerta("Error de conexión al eliminar usuario.", "danger");
        }
    });

    function handleBanUserModal(user) {
        userIdToBan.value = user.id;
        userBanName.textContent = user.name;
        banReason.value = user.ban_reason || "";

        if (user.is_banned) {
            
            banModalTitle.textContent = "Desbanear Usuario";
            banReasonContainer.style.display = 'block';
            banReason.disabled = true;
            banAlertMessage.style.display = 'none';
            btnConfirmBan.style.display = 'none';
            btnConfirmUnban.style.display = 'block';
            banReason.required = false;

        } else {
            
            banModalTitle.textContent = "Banear Usuario";
            banReasonContainer.style.display = 'block';
            banReason.disabled = false;
            banAlertMessage.style.display = 'block';
            btnConfirmBan.style.display = 'block';
            btnConfirmUnban.style.display = 'none';
            banReason.required = true;
        }

        banUserModal.show();
    }

    btnConfirmBan.addEventListener('click', () => {
        confirmBanAction(true);
    });

    btnConfirmUnban.addEventListener('click', () => {
        confirmBanAction(false);
    });


    async function confirmBanAction(shouldBan) {
        const id = userIdToBan.value;
        const reason = banReason.value.trim();

        if (shouldBan && reason.length < 5) {
            mostrarAlerta("La razón del baneo debe tener al menos 5 caracteres.", "error");
            return;
        }

        const bodyData = {
            is_banned: shouldBan,
            
            ...(shouldBan && { ban_reason: reason })
        };

        try {
            const response = await fetch(`/api/users?id=${id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(bodyData),
            });

            const data = await response.json();

            if (!response.ok) {
                mostrarAlerta(`Error al ${shouldBan ? 'banear' : 'desbanear'} usuario: ${data.message}`, "danger");
                return;
            }

            mostrarAlerta(`Usuario ${shouldBan ? 'baneado' : 'desbaneado'} correctamente.`, "success");
            banUserModal.hide();
            fetchUsers();
        } catch (error) {
            console.error("Error confirming ban action:", error);
            mostrarAlerta("Error de conexión al procesar la acción de baneo.", "danger");
        }
    }

    fetchUsers();
});
