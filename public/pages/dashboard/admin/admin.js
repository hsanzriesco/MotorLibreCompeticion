// Función auxiliar para formatear un objeto Date a YYYY-MM-DDTHH:MM
const formatDateTimeLocal = (date) => {
  if (!date) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
};


document.addEventListener("DOMContentLoaded", async () => {
  // Cerrar sesión
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("usuario");
      window.location.href = "/pages/auth/login/login.html";
    });
  }

  // Inicializar calendario
  const calendarEl = document.getElementById("calendar");
  const modalEl = new bootstrap.Modal(document.getElementById("eventModal"));
  const saveBtn = document.getElementById("saveEventBtn");

  if (!calendarEl) return;

  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    locale: "es",
    selectable: true,
    editable: true,

    events: async (info, successCallback, failureCallback) => {
      try {
        const res = await fetch("/api/events");
        const data = await res.json();
        if (data.success) {
          // FullCalendar espera 'start' y 'end' como propiedades
          const formattedEvents = data.data.map(event => ({
            id: event.id,
            title: event.title,
            start: event.start,
            end: event.end,
            description: event.description,
            location: event.location
          }));
          successCallback(formattedEvents);
        }
        else failureCallback(data.message);
      } catch (err) {
        console.error("❌ Error al cargar eventos:", err);
        failureCallback(err);
      }
    },

    dateClick: (info) => {
      document.getElementById("eventForm").reset();
      document.getElementById("eventId").value = "";
      document.getElementById("startDate").value = info.dateStr + "T12:00";
      document.getElementById("endDate").value = info.dateStr + "T14:00";
      modalEl.show();
    },

    eventClick: (info) => {
      const e = info.event;
      document.getElementById("eventId").value = e.id;
      document.getElementById("title").value = e.title;
      document.getElementById("description").value = e.extendedProps.description || "";
      document.getElementById("location").value = e.extendedProps.location || "";
      // CAMBIO CLAVE: Usamos el objeto Date para garantizar el formato correcto.
      document.getElementById("startDate").value = formatDateTimeLocal(e.start);
      document.getElementById("endDate").value = formatDateTimeLocal(e.end);
      modalEl.show();
    },
  });

  calendar.render();

  // Asociar el botón de crear evento para abrir el modal
  document.getElementById("crearEventoBtn").addEventListener("click", () => {
    document.getElementById("eventForm").reset();
    document.getElementById("eventId").value = "";
    document.getElementById("eventModalLabel").textContent = "Nuevo Evento";
    // Opcional: Establecer hora predeterminada para el nuevo evento
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getMinutes() % 5); // Redondea a 5 min
    document.getElementById("startDate").value = formatDateTimeLocal(now);
    modalEl.show();
  });


  // Guardar evento (crear o actualizar)
  saveBtn.addEventListener("click", async () => {
    const id = document.getElementById("eventId").value;
    const title = document.getElementById("title").value.trim();
    const description = document.getElementById("description").value.trim();
    const location = document.getElementById("location").value.trim();
    const start = document.getElementById("startDate").value;
    const end = document.getElementById("endDate").value;

    if (!title || !start || !end) {
      alert("⚠️ Título, Inicio y Fin son obligatorios.");
      return;
    }

    const method = id ? "PUT" : "POST";
    const url = id ? `/api/events?id=${id}` : "/api/events"; // Ajuste para el PUT
    const body = JSON.stringify({ id, title, description, location, start, end });

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body,
      });

      const data = await res.json();

      if (data.success) {
        modalEl.hide();
        calendar.refetchEvents();
      } else {
        alert("❌ Error: " + data.message);
      }
    } catch (err) {
      console.error("Error guardando evento:", err);
    }
  });
});