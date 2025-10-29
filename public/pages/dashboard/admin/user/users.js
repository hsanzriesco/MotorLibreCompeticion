document.addEventListener("DOMContentLoaded", () => {
    // === VERIFICACIÓN DE SESIÓN (PROTECCIÓN DE RUTA) ===
    const usersTableBody = document.getElementById("usersTableBody");
    const usuario = JSON.parse(sessionStorage.getItem("usuario"));

    if (!usuario || usuario.role !== "admin") {
        alert("❌ Acceso denegado. Solo administradores pueden acceder.");
        window.location.href = "/pages/auth/login/login.html";
        return;
    }
    // =========================================================

    const userModal = new bootstrap.Modal(document.getElementById("userModal"));
    const userForm = document.getElementById("userForm");
    const btnAddUser = document.getElementById("btnAddUser");

    const userId = document.getElementById("userId");
    const userName = document.getElementById("userName");
    const userEmail = document.getElementById("userEmail");
    const userPassword = document.getElementById("userPassword");
    const userRole = document.getElementById("userRole");

    async function cargarUsuarios() {
        try {
            const res = await fetch("/api/usersList");

            if (!res.ok) {
                // Si hay un error 404/500, lanzamos un error claro
                throw new Error(
                    `Error de la API: ${res.status}. **Revisa que 'api/usersList.js' esté dentro de la carpeta 'pages/api'**.`
                );
            }

            const data = await res.json(); // Ahora es seguro que es JSON

            if (data.success) {
                usersTableBody.innerHTML = "";
                data.data.forEach((user) => {
                    const tr = document.createElement("tr");
                    tr.innerHTML = `
            <td>${user.id}</td>
            <td>${user.name}</td>
            <td>${user.email}</td>
            <td>${user.role}</td>
            <td>${new Date(user.created_at).toLocaleString()}</td>
            <td>
              <button class="btn btn-sm btn-outline-light me-2" data-id="${user.id}" data-action="edit"><i class="bi bi-pencil"></i></button>
              <button class="btn btn-sm btn-outline-danger" data-id="${user.id}" data-action="delete"><i class="bi bi-trash"></i></button>
            </td>
          `;
                    usersTableBody.appendChild(tr);
                });
            } else {
                usersTableBody.innerHTML = `<tr><td colspan="6">Error al cargar usuarios: ${data.message}</td></tr>`;
            }
        } catch (err) {
            // Muestra el error de la API o de la conexión en la tabla
            console.error("❌ Error al cargar usuarios:", err.message);
            usersTableBody.innerHTML = `<tr><td colspan="6">⚠️ Error: ${err.message}</td></tr>`;
        }
    }

    btnAddUser.addEventListener("click", () => {
        userForm.reset();
        userId.value = "";
        document.querySelector("#userModal .modal-title").textContent = "Nuevo Usuario";
        userModal.show();
    });

    usersTableBody.addEventListener("click", async (e) => {
        const id = e.target.closest("button")?.dataset.id;
        const action = e.target.closest("button")?.dataset.action;
        if (!id) return;

        if (action === "edit") {
            const res = await fetch("/api/usersList");
            if (!res.ok) {
                alert(`Error al obtener lista para editar: ${res.status}.`);
                return;
            }
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
            if (!confirm("¿Seguro que deseas eliminar este usuario?")) return;

            try {
                const res = await fetch(`/api/usersList?id=${id}`, { method: "DELETE" });
                if (!res.ok) {
                    throw new Error(`Error al eliminar: ${res.status}`);
                }
                const data = await res.json();
                if (data.success) {
                    alert("✅ Usuario eliminado correctamente.");
                    await cargarUsuarios();
                } else {
                    alert(`❌ Error: ${data.message}`);
                }
            } catch (error) {
                alert(`❌ Fallo en la conexión o API: ${error.message}`);
            }
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
            const res = await fetch("/api/usersList", {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const data = await res.json();

            if (data.success) {
                userModal.hide();
                await cargarUsuarios();
            } else {
                alert("Error al guardar usuario: " + data.message);
            }
        } catch (error) {
            alert("❌ Error de conexión al guardar usuario.");
        }
    });

    cargarUsuarios();
});