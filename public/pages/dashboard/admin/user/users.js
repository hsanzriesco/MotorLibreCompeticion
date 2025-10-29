document.addEventListener("DOMContentLoaded", () => {
  // === AÑADIR VERIFICACIÓN DE SESIÓN (PROTECCIÓN DE RUTA) ===
  // ⭐ CAMBIO CLAVE: Usar sessionStorage para verificar el rol 'admin'
  const usuario = JSON.parse(sessionStorage.getItem("usuario"));
  if (!usuario || usuario.role !== "admin") {
    alert("❌ Acceso denegado. Solo administradores pueden acceder.");
    window.location.href = "/pages/auth/login/login.html";
    return;
  }
  // =========================================================

  const usersTableBody = document.getElementById("usersTableBody");
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
      const data = await res.json();

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
        usersTableBody.innerHTML = `<tr><td colspan="6">Error al cargar usuarios</td></tr>`;
      }
    } catch (err) {
      console.error("Error al cargar usuarios:", err);
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
      if (confirm("¿Seguro que deseas eliminar este usuario?")) {
        await fetch(`/api/usersList?id=${id}`, { method: "DELETE" });
        await cargarUsuarios();
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
  });

  cargarUsuarios();
});