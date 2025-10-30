document.addEventListener("DOMContentLoaded", () => {
  // ==== VERIFICAR ADMIN ====
  const usuario = JSON.parse(sessionStorage.getItem("usuario"));
  if (!usuario || usuario.role !== "admin") {
    alert("❌ Acceso denegado. Solo administradores pueden acceder.");
    window.location.href = "/pages/auth/login/login.html";
    return;
  }

  // ==== ELEMENTOS ====
  const logoutBtn = document.getElementById("logoutBtn");
  const menuEventos = document.getElementById("menuEventos");
  const menuUsuarios = document.getElementById("menuUsuarios");
  const seccionEventos = document.getElementById("seccionEventos");
  const seccionUsuarios = document.getElementById("seccionUsuarios");

  // ==== CERRAR SESIÓN ====
  logoutBtn.addEventListener("click", (e) => {
    e.preventDefault();
    sessionStorage.clear();
    window.location.href = "/pages/auth/login/login.html";
  });

  // ==== NAVEGACIÓN ENTRE SECCIONES ====
  menuEventos.addEventListener("click", (e) => {
    e.preventDefault();
    seccionEventos.style.display = "block";
    seccionUsuarios.style.display = "none";
    menuEventos.classList.add("active");
    menuUsuarios.classList.remove("active");
  });

  menuUsuarios.addEventListener("click", async (e) => {
    e.preventDefault();
    seccionEventos.style.display = "none";
    seccionUsuarios.style.display = "block";
    menuUsuarios.classList.add("active");
    menuEventos.classList.remove("active");
    await cargarUsuarios();
  });

  // ==== FULLCALENDAR ====
  const calendarEl = document.getElementById("calendar");
  const eventModal = new bootstrap.Modal(document.getElementById("eventModal"));
  const saveBtn = document.getElementById("saveEventBtn");
  const deleteBtn = document.getElementById("deleteEventBtn");
  let calendar;
  let selectedEvent = null;

  if (calendarEl) {
    calendar = new FullCalendar.Calendar(calendarEl, {
      initialView: "dayGridMonth",
      locale: "es",
      selectable: true,
      editable: false,
      height: "auto",

      events: async (fetchInfo, successCallback, failureCallback) => {
        try {
          const res = await fetch("/api/events");
          const data = await res.json();
          successCallback(data.success ? data.data : []);
        } catch (err) {
          console.error("❌ Error al cargar eventos:", err);
          failureCallback(err);
        }
      },

      select: (info) => {
        openModal({
          id: "",
          title: "",
          description: "",
          location: "",
          start: info.startStr,
          end: info.endStr,
          image_url: "",
        });
      },

      eventClick: (info) => {
        const e = info.event;
        openModal({
          id: e.id,
          title: e.title,
          description: e.extendedProps.description,
          location: e.extendedProps.location,
          start: e.startStr,
          end: e.endStr,
          image_url: e.extendedProps.image_url || "",
        });
      },
    });
    calendar.render();
  }

  // ==== MODAL ====
  function openModal(eventData) {
    selectedEvent = eventData;

    document.getElementById("eventId").value = eventData.id || "";
    document.getElementById("title").value = eventData.title || "";
    document.getElementById("description").value = eventData.description || "";
    document.getElementById("location").value = eventData.location || "";
    document.getElementById("start").value = eventData.start ? eventData.start.slice(0, 16) : "";
    document.getElementById("end").value = eventData.end ? eventData.end.slice(0, 16) : "";

    deleteBtn.style.display = eventData.id ? "inline-block" : "none";
    eventModal.show();
  }

  // ==== GUARDAR EVENTO ====
  saveBtn.addEventListener("click", async () => {
    const id = document.getElementById("eventId").value;
    const title = document.getElementById("title").value.trim();
    const description = document.getElementById("description").value.trim();
    const location = document.getElementById("location").value.trim();
    const start = document.getElementById("start").value;
    const end = document.getElementById("end").value;
    const imageFile = document.getElementById("image").files[0];

    if (!title || !start || !end) {
      alert("⚠️ Completa todos los campos obligatorios.");
      return;
    }

    const formData = new FormData();
    formData.append("title", title);
    formData.append("description", description);
    formData.append("location", location);
    formData.append("start", start);
    formData.append("end", end);
    if (imageFile) formData.append("image", imageFile);

    try {
      const res = await fetch(id ? `/api/events/${id}` : "/api/events", {
        method: id ? "PUT" : "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        alert(id ? "✅ Evento actualizado." : "✅ Evento creado.");
        eventModal.hide();
        calendar.refetchEvents();
      } else {
        alert("❌ " + data.message);
      }
    } catch (err) {
      console.error("❌ Error al guardar evento:", err);
      alert("❌ Error al guardar evento.");
    }
  });

  // ==== ELIMINAR EVENTO ====
  deleteBtn.addEventListener("click", async () => {
    const id = document.getElementById("eventId").value;
    if (!id || !confirm("⚠️ ¿Seguro que deseas eliminar este evento?")) return;

    try {
      const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        alert("🗑️ Evento eliminado correctamente.");
        eventModal.hide();
        calendar.refetchEvents();
      } else {
        alert("❌ " + data.message);
      }
    } catch (err) {
      console.error("❌ Error al eliminar evento:", err);
      alert("❌ Error de conexión al eliminar evento.");
    }
  });

  // ==== CARGAR USUARIOS ====
  async function cargarUsuarios() {
    const usersList = document.getElementById("usersList");
    usersList.textContent = "Cargando usuarios...";

    try {
      const res = await fetch("/api/userList");
      const data = await res.json();

      if (!data.success) {
        usersList.innerHTML = `<p>Error al cargar usuarios.</p>`;
        return;
      }

      const usuarios = data.data;
      if (usuarios.length === 0) {
        usersList.innerHTML = "<p>No hay usuarios registrados.</p>";
        return;
      }

      let html = `
        <table class="table table-dark table-hover">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
      `;

      usuarios.forEach((u) => {
        html += `
          <tr>
            <td>${u.name}</td>
            <td>${u.email}</td>
            <td>${u.role}</td>
            <td>
              <button class="btn btn-sm btn-outline-light" onclick="editarUsuario('${u._id}')"><i class="bi bi-pencil"></i></button>
              <button class="btn btn-sm btn-danger" onclick="eliminarUsuario('${u._id}')"><i class="bi bi-trash"></i></button>
            </td>
          </tr>
        `;
      });

      html += `</tbody></table>`;
      usersList.innerHTML = html;
    } catch (err) {
      console.error("❌ Error al cargar usuarios:", err);
      usersList.innerHTML = "<p>Error al conectar con el servidor.</p>";
    }
  }
});
