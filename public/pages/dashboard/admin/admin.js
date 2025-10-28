document.addEventListener("DOMContentLoaded", async () => {
  const usuario = JSON.parse(localStorage.getItem("usuario"));

  // Verificar acceso
  if (!usuario || usuario.role !== "admin") {
    alert("❌ Acceso denegado. No eres administrador.");
    window.location.href = "/index.html";
    return;
  }

  // Cerrar sesión
  window.cerrarSesion = function () {
    localStorage.removeItem("usuario");
    window.location.href = "/pages/auth/login/login.html";
  };

  // Referencias
  const calendarEl = document.getElementById("calendar");
  const modalEl = document.getElementById("eventModal");
  const modal = new bootstrap.Modal(modalEl);
  const form = document.getElementById("eventForm");
  const saveBtn = document.getElementById("saveEventBtn");
  const viewInfo = document.getElementById("viewEventInfo");

  let selectedEvent = null;

  // Inicializar calendario
  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    locale: "es",
    selectable: true,
    editable: true,
    eventColor: "#e50914",

    events: async (info, successCallback, failureCallback) => {
      try {
        const res = await fetch("/api/events");
        const data = await res.json();
        if (data.success) {
          successCallback(data.data);
        } else {
          console.warn("⚠️ No se pudieron cargar eventos:", data.message);
          failureCallback(data.message);
        }
      } catch (err) {
        console.error("❌ Error al cargar eventos:", err);
        failureCallback(err);
      }
    },

    select: (info) => {
      selectedEvent = null;
      form.reset();
      form.style.display = "block";
      viewInfo.style.display = "none";
      saveBtn.textContent = "Guardar";
      saveBtn.dataset.mode = "create";

      document.getElementById("startDate").value = info.startStr;
      document.getElementById("endDate").value = info.endStr;

      modal.show();
    },

    eventClick: (info) => {
      selectedEvent = info.event;

      // Mostrar datos
      document.getElementById("vTitle").textContent = selectedEvent.title;
      document.getElementById("vDescription").textContent = selectedEvent.extendedProps.description || "Sin descripción";
      document.getElementById("vLocation").textContent = selectedEvent.extendedProps.location || "Sin ubicación";
      document.getElementById("vStart").textContent = new Date(selectedEvent.start).toLocaleString();
      document.getElementById("vEnd").textContent = selectedEvent.end ? new Date(selectedEvent.end).toLocaleString() : "N/A";

      // Mostrar modal en modo "ver"
      form.style.display = "none";
      viewInfo.style.display = "block";
      saveBtn.textContent = "Eliminar evento";
      saveBtn.dataset.mode = "delete";

      modal.show();
    },
  });

  calendar.render();

  // Guardar o eliminar evento
  saveBtn.addEventListener("click", async () => {
    const mode = saveBtn.dataset.mode;

    if (mode === "create") {
      const title = document.getElementById("title").value.trim();
      const description = document.getElementById("description").value.trim();
      const location = document.getElementById("location").value.trim();
      const start = document.getElementById("startDate").value;
      const end = document.getElementById("endDate").value;

      if (!title || !start || !end) {
        alert("⚠️ Título, inicio y fin son obligatorios");
        return;
      }

      try {
        const res = await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, description, location, start, end }),
        });
        const data = await res.json();

        if (data.success) {
          alert("✅ Evento creado correctamente");
          modal.hide();
          calendar.refetchEvents();
        } else {
          alert("❌ Error al crear evento: " + data.message);
        }
      } catch (err) {
        console.error("❌ Error al crear evento:", err);
      }
    }

    // 🗑️ Eliminar evento
    else if (mode === "delete" && selectedEvent) {
      if (!confirm("¿Seguro que quieres eliminar este evento?")) return;

      try {
        const res = await fetch(`/api/events?id=${selectedEvent.id}`, {
          method: "DELETE",
        });
        const data = await res.json();

        if (data.success) {
          alert("🗑️ Evento eliminado");
          modal.hide();
          calendar.refetchEvents();
        } else {
          alert("❌ Error al eliminar evento: " + data.message);
        }
      } catch (err) {
        console.error("❌ Error al eliminar evento:", err);
      }
    }
  });
});