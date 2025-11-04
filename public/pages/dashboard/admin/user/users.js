document.addEventListener("DOMContentLoaded", () => {
  const usuario = JSON.parse(sessionStorage.getItem("usuario"));
  if (!usuario || usuario.role !== "admin") {
    showAlert("❌ Acceso denegado. Solo administradores pueden acceder.", "error");
    setTimeout(() => (window.location.href = "/pages/auth/login/login.html"), 2000);
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

  // ✅ Sistema unificado de alertas (igual que en admin.js)
  function showAlert(message, type = "success") {
    const alert = document.createElement("div");
    alert.className = `custom-alert ${type}`;
    alert.innerHTML = `<i class="bi bi-check-circle me-2"></i>${message}`;
    document.body.appendChild(alert);
    setTimeout(() => alert.remove(), 4000);
  }

  // ✅ Cargar usuarios
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
            <td>${user.id}</td>
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
        usersTableBody.innerHTML = `<tr><td colspan="6">⚠️ ${data.message}</td></tr>`;
      }
    } catch (err) {
      usersTableBody.innerHTML = `<tr><td colspan="6">⚠️ Error de conexión: ${err.message}</td></tr>`;
    }
  }

  // ✅ Abrir modal para agregar usuario
  btnAddUser.addEventListener("click", () => {
    userForm.reset();
    userId.value = "";
    document.querySelector("#userModal .modal-title").textContent = "Nuevo Usuario";
    userModal.show();
  });

  // ✅ Editar o eliminar usuario
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
      // ✅ Confirmación personalizada al eliminar
      const confirmBox = document.createElement("div");
      confirmBox.className = "custom-alert";
      confirmBox.innerHTML = `
        <p>¿Seguro que deseas eliminar este usuario?</p>
        <div class="mt-2 text-end">
          <button id="confirmDeleteUser" class="btn btn-danger btn-sm me-2">Sí</button>
          <button id="cancelDeleteUser" class="btn btn-secondary btn-sm">No</button>
        </div>
      `;
      document.body.appendChild(confirmBox);

      document.getElementById("cancelDeleteUser").addEventListener("click", () => confirmBox.remove());
      document.getElementById("confirmDeleteUser").addEventListener("click", async () => {
        confirmBox.remove();
        try {
          const res = await fetch(`/api/userList?id=${id}`, { method: "DELETE" });
          const data = await res.json();
          if (data.success) {
            showAlert("🗑️ Usuario eliminado correctamente");
            cargarUsuarios();
          } else {
            showAlert(`❌ ${data.message}`, "error");
          }
        } catch {
          showAlert("❌ Error de conexión al eliminar usuario.", "error");
        }
      });
    }
  });

  // ✅ Guardar (crear o actualizar usuario)
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
        showAlert(userId.value ? "✅ Usuario actualizado correctamente" : "🎉 Usuario creado con éxito");
        cargarUsuarios();
      } else {
        showAlert("❌ Error: " + data.message, "error");
      }
    } catch (err) {
      showAlert("❌ Error de conexión al guardar usuario.", "error");
    }
  });

  cargarUsuarios();
});
