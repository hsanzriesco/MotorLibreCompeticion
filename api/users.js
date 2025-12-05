// users.js
document.addEventListener("DOMContentLoaded", () => {
    // 🛑 ARREGLO SOLICITADO: Se ha ELIMINADO (comentado) la verificación de token y rol
    // para evitar la redirección. 
    // ¡ADVERTENCIA! Debes volver a habilitarlo en producción.
    /*
    if (!sessionStorage.getItem("token") || sessionStorage.getItem("role") !== "admin") {
        window.location.href = "/";
        return;
    }
    */

    // Asegúrate de que tienes una función 'mostrarAlerta' globalmente accesible 
    // o definida en otro script. Si no la tienes, necesitarás definirla aquí 
    // o usar 'console.error/log'. Por ahora, asumo que está disponible.

    const usersTableBody = document.getElementById("usersTableBody");
    // Inicialización de Modales
    const userModal = new bootstrap.Modal(document.getElementById("userModal"));
    const banUserModal = new bootstrap.Modal(document.getElementById("banUserModal"));
    const deleteConfirmModal = new bootstrap.Modal(document.getElementById("deleteConfirmModal"));

    // Elementos del formulario y modales
    const userForm = document.getElementById("userForm");
    const userId = document.getElementById("userId");
    const userName = document.getElementById("userName");
    const userEmail = document.getElementById("userEmail");
    const userPassword = document.getElementById("userPassword");
    const userPassword2 = document.getElementById("userPassword2");
    const userRole = document.getElementById("userRole");
    const confirmPasswordContainer = document.getElementById("confirmPasswordContainer");

    let userIdToDelete = null;

    // ------------------------------------------
    // 🌟 ELEMENTOS DE BANEO 🌟
    // ------------------------------------------
    const userIdToBan = document.getElementById("userIdToBan");
    const userBanName = document.getElementById("userBanName");
    const banModalTitle = document.getElementById("banModalTitle");
    const banReasonContainer = document.getElementById("banReasonContainer");
    const banReason = document.getElementById("banReason");
    const banAlertMessage = document.getElementById("banAlertMessage");
    const btnConfirmBan = document.getElementById("btnConfirmBan");
    const btnConfirmUnban = document.getElementById("btnConfirmUnban");
    // ------------------------------------------


    // --- HELPERS ---

    // Toggle password visibility
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

    // Mostrar/Ocultar el campo de confirmación de contraseña en el modal de usuario
    userPassword.addEventListener('input', () => {
        if (userPassword.value.trim() !== "" || userId.value === "") {
            confirmPasswordContainer.style.display = 'block';
            userPassword2.required = true;
        } else {
            confirmPasswordContainer.style.display = 'none';
            userPassword2.required = false;
        }
    });

    // --- CARGAR DATOS ---

    async function fetchUsers() {
        try {
            const response = await fetch("/api/users", {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    // 🛑 CORRECCIÓN: Usar sessionStorage
                    Authorization: `Bearer ${sessionStorage.getItem("token")}`,
                },
            });

            const data = await response.json();

            if (!response.ok) {
                // Asumiendo que 'mostrarAlerta' está definida
                // mostrarAlerta("Error al cargar usuarios: " + data.message, "danger");
                console.error("Error al cargar usuarios:", data.message);
                return;
            }

            renderUsersTable(data.data);
        } catch (error) {
            console.error("Error fetching users:", error);
            // mostrarAlerta("Error de conexión al cargar usuarios.", "danger");
        }
    }

    function renderUsersTable(users) {
        usersTableBody.innerHTML = "";
        users.forEach((user) => {
            const row = usersTableBody.insertRow();
            const date = new Date(user.created_at).toLocaleDateString("es-ES", {
                year: 'numeric', month: 'numeric', day: 'numeric'
            });

            // Determinar si el usuario está baneado
            const isBanned = user.is_banned;

            // 🌟 Renderización del estado y del botón de acción 🌟
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

        // Agregar listeners para editar
        document.querySelectorAll(".btn-edit").forEach((button) => {
            button.addEventListener("click", (e) => loadUserForEdit(e.currentTarget.dataset.id));
        });

        // 🌟 Agregar listeners para baneo/desbaneo 🌟
        document.querySelectorAll(".btn-ban").forEach((button) => {
            button.addEventListener("click", (e) => {
                const id = e.currentTarget.dataset.id;
                const name = e.currentTarget.dataset.name;
                // Convertir la cadena 'true'/'false' a booleano
                const isBanned = e.currentTarget.dataset.isbanned === 'true';
                handleBanUserModal(id, name, isBanned);
            });
        });

        // Agregar listeners para eliminar
        document.querySelectorAll(".btn-delete").forEach((button) => {
            button.addEventListener("click", (e) => {
                userIdToDelete = e.currentTarget.dataset.id;
                document.getElementById("userToDeleteName").textContent = e.currentTarget.dataset.name;
                deleteConfirmModal.show();
            });
        });
    }


    // --- EDICIÓN Y CREACIÓN ---

    document.getElementById("btnAddUser").addEventListener("click", () => {
        userForm.reset();
        userId.value = "";
        document.querySelector(".modal-title").textContent = "Añadir Nuevo Usuario";
        // Asegurar que el campo de contraseña esté visible y requerido para la creación
        confirmPasswordContainer.style.display = 'block';
        userPassword.required = true;
        userPassword2.required = true;
        userPassword.placeholder = "";
        userModal.show();
    });

    async function loadUserForEdit(id) {
        try {
            const response = await fetch(`/api/users?id=${id}`, {
                method: "GET",
                headers: {
                    // 🛑 CORRECCIÓN: Usar sessionStorage
                    Authorization: `Bearer ${sessionStorage.getItem("token")}`,
                },
            });

            const data = await response.json();

            if (!response.ok) {
                // mostrarAlerta("Error al cargar usuario para edición.", "danger");
                console.error("Error al cargar usuario:", data.message);
                return;
            }

            const user = data.data[0];
            document.querySelector(".modal-title").textContent = `Editar Usuario: ${user.name}`;
            userId.value = user.id;
            userName.value = user.name;
            userEmail.value = user.email;
            userRole.value = user.role;
            userPassword.value = ""; // No se carga la contraseña
            userPassword2.value = "";
            userPassword.placeholder = "Dejar vacío para no cambiar";
            userPassword.required = false; // La contraseña no es requerida en edición
            userPassword2.required = false;
            confirmPasswordContainer.style.display = 'none'; // Ocultar por defecto en edición

            userModal.show();
        } catch (error) {
            console.error("Error loading user:", error);
            // mostrarAlerta("Error de conexión al cargar usuario.", "danger");
        }
    }


    userForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const id = userId.value;
        const newPassword = userPassword.value.trim();
        const confirmPassword = userPassword2.value.trim();

        // Validación de contraseñas
        if (newPassword !== confirmPassword) {
            // mostrarAlerta("Las contraseñas no coinciden.", "warning");
            alert("Las contraseñas no coinciden.");
            return;
        }

        const method = id ? "PUT" : "POST";
        const url = id ? `/api/users?id=${id}` : "/api/users";

        const bodyData = {
            name: userName.value.trim(),
            email: userEmail.value.trim(),
            role: userRole.value,
        };

        // Si se va a crear o si se va a cambiar la contraseña en la edición
        if (newPassword) {
            bodyData.password = newPassword;
        } else if (!id) {
            // Esto no debería suceder si newPassword.required=true en la creación, pero es una doble capa
            // mostrarAlerta("Debe especificar una contraseña para el nuevo usuario.", "warning");
            alert("Debe especificar una contraseña para el nuevo usuario.");
            return;
        }

        try {
            const response = await fetch(url, {
                method: method,
                headers: {
                    "Content-Type": "application/json",
                    // 🛑 CORRECCIÓN: Usar sessionStorage
                    Authorization: `Bearer ${sessionStorage.getItem("token")}`,
                },
                // Usamos JSON.stringify(bodyData) aquí porque getBody en el API maneja la lectura cruda
                body: JSON.stringify(bodyData),
            });

            const data = await response.json();

            if (!response.ok) {
                // mostrarAlerta(`Error al ${id ? 'actualizar' : 'crear'} usuario: ${data.message}`, "danger");
                alert(`Error al ${id ? 'actualizar' : 'crear'} usuario: ${data.message}`);
                return;
            }

            // mostrarAlerta(`Usuario ${id ? 'actualizado' : 'creado'} correctamente.`, "success");
            userModal.hide();
            fetchUsers();
        } catch (error) {
            console.error("Error submitting form:", error);
            // mostrarAlerta("Error de conexión al guardar usuario.", "danger");
        }
    });

    // --- ELIMINACIÓN ---

    document.getElementById("btnConfirmDelete").addEventListener("click", async () => {
        if (!userIdToDelete) return;

        try {
            const response = await fetch(`/api/users?id=${userIdToDelete}`, {
                method: "DELETE",
                headers: {
                    // 🛑 CORRECCIÓN: Usar sessionStorage
                    Authorization: `Bearer ${sessionStorage.getItem("token")}`,
                },
            });

            const data = await response.json();

            if (!response.ok) {
                // mostrarAlerta(`Error al eliminar usuario: ${data.message}`, "danger");
                alert(`Error al eliminar usuario: ${data.message}`);
                return;
            }

            // mostrarAlerta("Usuario eliminado correctamente.", "success");
            deleteConfirmModal.hide();
            fetchUsers();
            userIdToDelete = null;
        } catch (error) {
            console.error("Error deleting user:", error);
            // mostrarAlerta("Error de conexión al eliminar usuario.", "danger");
        }
    });

    // ------------------------------------------
    // 🌟 LÓGICA DE BANEO 🌟
    // ------------------------------------------

    function handleBanUserModal(id, name, isBanned) {
        userIdToBan.value = id;
        userBanName.textContent = name;
        banReason.value = ""; // Limpiar razón anterior

        if (isBanned) {
            // Configurar modal para DESBANEAR
            banModalTitle.textContent = "Desbanear Usuario";
            banReasonContainer.style.display = 'none';
            banAlertMessage.style.display = 'none';
            btnConfirmBan.style.display = 'none';
            btnConfirmUnban.style.display = 'block';
            banReason.required = false;

        } else {
            // Configurar modal para BANEAR
            banModalTitle.textContent = "Banear Usuario";
            banReasonContainer.style.display = 'block';
            banAlertMessage.style.display = 'block';
            btnConfirmBan.style.display = 'block';
            btnConfirmUnban.style.display = 'none';
            banReason.required = true;
        }

        banUserModal.show();
    }

    // Listener para CONFIRMAR BANEO
    btnConfirmBan.addEventListener('click', () => {
        confirmBanAction(true); // true = Banear
    });

    // Listener para CONFIRMAR DESBANEO
    btnConfirmUnban.addEventListener('click', () => {
        confirmBanAction(false); // false = Desbanear
    });


    async function confirmBanAction(shouldBan) {
        const id = userIdToBan.value;
        const reason = banReason.value.trim();

        if (shouldBan && reason.length < 5) {
            // mostrarAlerta("La razón del baneo debe tener al menos 5 caracteres.", "warning");
            alert("La razón del baneo debe tener al menos 5 caracteres.");
            return;
        }

        const bodyData = {
            is_banned: shouldBan,
            // Solo incluimos la razón si estamos baneando
            ...(shouldBan && { ban_reason: reason })
        };

        try {
            const response = await fetch(`/api/users?id=${id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    // 🛑 CORRECCIÓN: Usar sessionStorage
                    Authorization: `Bearer ${sessionStorage.getItem("token")}`,
                },
                body: JSON.stringify(bodyData),
            });

            const data = await response.json();

            if (!response.ok) {
                // mostrarAlerta(`Error al ${shouldBan ? 'banear' : 'desbanear'} usuario: ${data.message}`, "danger");
                alert(`Error al ${shouldBan ? 'banear' : 'desbanear'} usuario: ${data.message}`);
                return;
            }

            // mostrarAlerta(`Usuario ${shouldBan ? 'baneado' : 'desbaneado'} correctamente.`, "success");
            banUserModal.hide();
            fetchUsers(); // Recargar la tabla
        } catch (error) {
            console.error("Error confirming ban action:", error);
            // mostrarAlerta("Error de conexión al procesar la acción de baneo.", "danger");
        }
    }

    // --- INICIALIZACIÓN ---
    fetchUsers();
});