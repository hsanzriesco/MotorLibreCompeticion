document.addEventListener("DOMContentLoaded", () => {
    const usuario = JSON.parse(sessionStorage.getItem("usuario"));
    if (!usuario || usuario.role !== "admin") {
        alert("Acceso denegado. Solo administradores pueden acceder.");
        window.location.href = "/pages/auth/login/login.html";
        return;
    }

    const usersTableBody = document.getElementById("usersTableBody");
    const userModal = new bootstrap.Modal(document.getElementById("userModal"));
    const userForm = document.getElementById("userForm");
    const btnAddUser = document.getElementById("btnAddUser");

    const userId = document.getElementById("userId");
    const userName = document.getElementById("userName");
    const userEmail = document.getElementById("userEmail");
    const userPassword = document.getElementById("userPassword");
    const userRole = document.getElementById("userRole");

    // **Nuevas referencias para el modal de eliminación:**
    const deleteConfirmModalElement = document.getElementById("deleteConfirmModal");
    const deleteConfirmModal = new bootstrap.Modal(deleteConfirmModalElement);
    const btnConfirmDelete = document.getElementById("btnConfirmDelete");
    const userToDeleteName = document.getElementById("userToDeleteName");
    
    // Variable para guardar el ID a eliminar temporalmente
    let userIdToDelete = null;

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
                        <td>${new Date(user.created_at).toLocaleString()}</td>
                        <td>
                            <button class="btn btn-sm btn-outline-light me-2" data-id="${user.id}" data-action="edit"><i class="bi bi-pencil"></i></button>
                            <button class="btn btn-sm btn-outline-danger" data-id="${user.id}" data-action="delete"><i class="bi bi-trash"></i></button>
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

    // **Función que ejecuta la eliminación real**
    async function eliminarUsuario() {
        if (!userIdToDelete) return;

        const id = userIdToDelete; // Usamos el ID almacenado
        userIdToDelete = null; // Reseteamos la variable inmediatamente

        try {
            const res = await fetch(`/api/userList?id=${id}`, { method: "DELETE" });
            const data = await res.json();
            deleteConfirmModal.hide(); // Ocultamos el modal

            if (data.success) {
                alert("Usuario eliminado correctamente.");
                cargarUsuarios();
            } else {
                alert(`❌ ${data.message}`);
            }
        } catch (err) {
            deleteConfirmModal.hide();
            alert("❌ Error de conexión al eliminar usuario.");
        }
    }

    // **Listener para el botón de Confirmar Eliminación dentro del Modal**
    btnConfirmDelete.addEventListener("click", eliminarUsuario);


    btnAddUser.addEventListener("click", () => {
        userForm.reset();
        userId.value = "";
        document.querySelector("#userModal .modal-title").textContent = "Nuevo Usuario";
        userModal.show();
    });

    usersTableBody.addEventListener("click", async (e) => {
        const button = e.target.closest("button");
        if (!button) return;
        const id = button.dataset.id;
        const action = button.dataset.action;

        if (action === "edit") {
            const res = await fetch("/api/userList");
            const { data } = await res.json();
            const user = data.find((u) => u.id == id);
            if (!user) return;

            userId.value = user.id;
            userName.value = user.name;
            userEmail.value = user.email;
            userPassword.value = "";
            userRole.value = user.role;

            document.querySelector("#userModal .modal-title").textContent = "Editar Usuario";
            userModal.show();
        }

        if (action === "delete") {
            // 1. Obtener los datos del usuario para mostrar el nombre en el modal
            const res = await fetch("/api/userList");
            const { data } = await res.json();
            const user = data.find((u) => u.id == id);
            
            if (!user) {
                alert("Usuario no encontrado para eliminar.");
                return;
            }

            // 2. Almacenar el ID y el nombre para el modal de confirmación
            userIdToDelete = id;
            userToDeleteName.textContent = user.name;
            
            // 3. Mostrar el Modal de Bootstrap para la confirmación
            deleteConfirmModal.show();
        }
    });

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
                cargarUsuarios();
            } else {
                alert("Error: " + data.message);
            }
        } catch (err) {
            alert("Error de conexión al guardar usuario.");
        }
    });

    cargarUsuarios();
});