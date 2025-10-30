document.addEventListener("DOMContentLoaded", () => {
  // ======== PROTECCIÓN DE RUTA ========
  const usuario = JSON.parse(sessionStorage.getItem("usuario"));
  if (!usuario || usuario.role !== "admin") {
    alert("❌ Acceso denegado. Solo administradores pueden acceder.");
    window.location.href = "/pages/auth/login/login.html";
    return;
  }

  // ======== ELEMENTOS DEL DOM ========
  const seccionEventos = document.getElementById("seccionEventos");
  const seccionUsuarios = document.getElementById("seccionUsuarios");
  const menuEventos = document.getElementById("menuEventos");
  const menuUsuarios = document.getElementById("menuUsuarios");
  const logoutBtn = document.getElementById("logoutBtn");

  // ======== NAVEGACIÓN ENTRE SECCIONES ========
  menuEventos.addEventListener("click", () => {
    menuEventos.classList.add("active");
    menuUsuarios.classList.remove("active");
    seccionEventos.style.display = "block";
    seccionUsuarios.style.display = "none";
  });

  menuUsuarios.addEventListener("click", () => {
    menuUsuarios.classList.add("active");
    menuEventos.classList.remove("active");
    seccionUsuarios.style.display = "block";
    seccionEventos.style.display = "none";
  });

  // ======== CERRAR SESIÓN ========
  logoutBtn.addEventListener("click", () => {
    sessionStorage.clear();
    window.location.href = "/pages/auth/login/login.html";
  });

  // ======== CALENDARIO ========
  const calendarEl = document.getElementById("calendar");
  if (calendarEl) {
    const calendar = new FullCalendar.Calendar(calendarEl, {
      initialView: "dayGridMonth",
      locale: "es",
      height: "auto",
      selectable: true,
      events: "/api/events",
      eventClick(info) {
        alert(`Evento: ${info.event.title}`);
      },
      dateClick(info) {
        alert(`Fecha seleccionada: ${info.dateStr}`);
      },
    });
    calendar.render();
  }

  // ======== GESTIÓN DE USUARIOS ========
  const usersTableBody = document.getElementById("usersTableBody");
  const btnAddUser = document.getElementById("btnAddUser");

  async function cargarUsuarios() {
    try {
      const res = await fetch("/api/userList");
      if (!res.ok) throw new Error(`Error de la API: ${res.status}`);
      const data = await res.json();

      usersTableBody.innerHTML = "";
      if (data.success && data.data.length > 0) {
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
        usersTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No hay usuarios registrados.</td></tr>`;
      }
    } catch (err) {
      console.error("Error al cargar usuarios:", err);
      usersTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">⚠️ Error al cargar usuarios.</td></tr>`;
    }
  }

  btnAddUser.addEventListener("click", () => {
    alert("🔧 Aquí se abrirá el modal para crear nuevo usuario (pendiente de integrar con users.js).");
  });

  cargarUsuarios();
});
