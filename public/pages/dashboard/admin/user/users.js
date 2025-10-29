document.addEventListener("DOMContentLoaded", () => {
  const usuario = JSON.parse(sessionStorage.getItem("usuario"));
  if (!usuario || usuario.role !== "admin") {
    alert("❌ Acceso denegado.");
    window.location.href = "/pages/auth/login/login.html";
    return;
  }

  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      sessionStorage.removeItem("usuario");
      window.location.href = "/pages/auth/login/login.html";
    });
  }

  const userTableBody = document.getElementById("userTableBody");
  const modal = new bootstrap.Modal(document.getElementById("userModal"));
  const saveBtn = document.getElementById("saveUserBtn");
  const deleteBtn = document.getElementById("deleteUserBtn");
  const newBtn = document.getElementById("nuevoUsuarioBtn");

  let selectedUser = null;

  async function cargarUsuarios() {
    try {
      const res = await fetch("/api/usersList");
      const data = await res.json();
      userTableBody.innerHTML = "";
      data.forEach((u) => {
        userTableBody.innerHTML += `
          <tr>
            <td>${u.id}</td>
            <td>${u.name}</td>
            <td>${u.email}</td>
            <td>${u.role}</td>
            <td>
              <button class="btn btn-sm btn-outline-light edit-btn" data-id="${u.id}">Editar</button>
            </td>
          </tr>
        `;
      });

      document.querySelectorAll(".edit-btn").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          const id = e.target.dataset.id;
          const res = await fetch(`/api/usersList/${id}`);
          const user = await res.json();
          openModal(user);
        });
      });
    } catch (err) {
      console.error("Error al cargar usuarios:", err);
    }
  }

  function openModal(user) {
    selectedUser = user;
    document.getElementById("userId").value = user?.id || "";
    document.getElementById("name").value = user?.name || "";
    document.getElementById("email").value = user?.email || "";
    document.getElementById("password").value = "";
    document.getElementById("role").value = user?.role || "user";
    deleteBtn.style.display = user?.id ? "inline-block" : "none";
    modal.show();
  }

  newBtn.addEventListener("click", () => openModal({}));

  saveBtn.addEventListener("click", async () => {
    const id = document.getElementById("userId").value;
    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();
    const role = document.getElementById("role").value;

    if (!name || !email) {
      alert("⚠️ Completa todos los campos obligatorios.");
      return;
    }

    const body = { name, email, role };
    if (password) body.password = password;

    try {
      const res = await fetch(id ? `/api/usersList/${id}` : "/api/usersList", {
        method: id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.success) {
        alert("✅ Usuario guardado correctamente.");
        modal.hide();
        cargarUsuarios();
      } else {
        alert("❌ Error: " + data.message);
      }
    } catch (err) {
      console.error("Error al guardar usuario:", err);
      alert("❌ Error de conexión.");
    }
  });

  deleteBtn.addEventListener("click", async () => {
    const id = document.getElementById("userId").value;
    if (!id) return;
    if (!confirm("⚠️ ¿Eliminar este usuario?")) return;

    try {
      const res = await fetch(`/api/usersList/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        alert("🗑️ Usuario eliminado.");
        modal.hide();
        cargarUsuarios();
      } else {
        alert("❌ Error: " + data.message);
      }
    } catch (err) {
      console.error("Error al eliminar usuario:", err);
    }
  });

  cargarUsuarios();
});
