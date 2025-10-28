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
        if (data.success) successCallback(data.data);
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
      document.getElementById("startDate").value = e.startStr.slice(0, 16);
      document.getElementById("endDate").value = e.endStr ? e.endStr.slice(0, 16) : "";
      modalEl.show();
    },
  });

  calendar.render();

  // Guardar evento (crear o actualizar)
  saveBtn.addEventListener("click", async () => {
    const id = document.getElementById("eventId").value;
    const title = document.getElementById("title").value.trim();
    const description = document.getElementById("description").value.trim();
    const location = document.getElementById("location").value.trim();
    const start = document.getElementById("startDate").value;
    const end = document.getElementById("endDate").value;

    if (!title || !start || !end) {
      alert("⚠️ Todos los campos son obligatorios.");
      return;
    }

    const method = id ? "PUT" : "POST";
    const body = JSON.stringify({ id, title, description, location, start, end });

    try {
      const res = await fetch("/api/events", {
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
