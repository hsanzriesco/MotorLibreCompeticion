document.addEventListener("DOMContentLoaded", async () => {
  const usuario = JSON.parse(localStorage.getItem("usuario"));

  if (!usuario || usuario.role !== "admin") {
    alert("❌ Acceso denegado. Solo administradores pueden entrar aquí.");
    window.location.href = "/index.html";
    return;
  }

  const bienvenida = document.getElementById("bienvenida");
  if (bienvenida) bienvenida.textContent = `👋 ${usuario.name} (Administrador)`;

  // Inicializar calendario de eventos
  initCalendar();

  // Cargar lista de usuarios
  loadUsers();
});

// =====================
// 🔹 CALENDARIO
// =====================
async function initCalendar() {
  let eventos = await fetch("/api/events").then((res) => res.json()).catch(() => []);
  eventos = eventos.success ? eventos.data : [];

  const calendarEl = document.getElementById("calendar");
  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    selectable: true,
    editable: true,
    events: eventos,

    select: async (info) => {
      const titulo = prompt("Nombre del evento:");
      if (titulo) {
        const nuevoEvento = { title: titulo, start: info.startStr, end: info.endStr };
        const res = await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(nuevoEvento),
        });
        const result = await res.json();
        if (result.success) {
          calendar.addEvent(nuevoEvento);
          alert("✅ Evento creado correctamente.");
        } else {
          alert("❌ Error al crear evento.");
        }
      }
    },

    eventChange: async (info) => {
      const evento = info.event;
      const res = await fetch(`/api/events/${evento.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: evento.title,
          start: evento.startStr,
          end: evento.endStr,
        }),
      });
      const result = await res.json();
      if (!result.success) alert("❌ Error al actualizar evento.");
    },

    eventClick: async (info) => {
      if (confirm(`¿Eliminar evento "${info.event.title}"?`)) {
        const res = await fetch(`/api/events/${info.event.id}`, { method: "DELETE" });
        const result = await res.json();
        if (result.success) {
          info.event.remove();
          alert("🗑️ Evento eliminado.");
        } else {
          alert("❌ Error al eliminar evento.");
        }
      }
    },
  });

  calendar.render();
}

// =====================
// 🔹 USUARIOS
// =====================
async function loadUsers() {
  const container = document.getElementById("usersList");

  try {
    const res = await fetch("/api/usersList");
    const data = await res.json();

    if (!data.success) throw new Error("Error al cargar usuarios");

    container.innerHTML = data.users
      .map(
        (u) => `
        <div>
          <span><strong>${u.name}</strong> - ${u.email} (${u.role})</span>
          ${
            u.role !== "admin"
              ? `<button onclick="deleteUser(${u.id})">Eliminar</button>`
              : ""
          }
        </div>`
      )
      .join("");
  } catch (err) {
    console.error("Error al cargar usuarios:", err);
    container.textContent = "❌ Error al obtener la lista de usuarios.";
  }
}

async function deleteUser(id) {
  if (confirm("¿Seguro que deseas eliminar este usuario?")) {
    try {
      const res = await fetch(`/api/usersDelete?id=${id}`, { method: "DELETE" });
      const result = await res.json();
      if (result.success) {
        alert("🗑️ Usuario eliminado.");
        loadUsers();
      } else {
        alert("❌ No se pudo eliminar el usuario.");
      }
    } catch {
      alert("❌ Error de conexión al eliminar usuario.");
    }
  }
}

// =====================
// 🔹 CERRAR SESIÓN
// =====================
function cerrarSesion() {
  localStorage.removeItem("usuario");
  window.location.href = "/pages/auth/login/login.html";
}
