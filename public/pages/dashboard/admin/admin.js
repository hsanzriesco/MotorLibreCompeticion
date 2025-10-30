document.addEventListener("DOMContentLoaded", function () {
  // === Protección de sesión ===
  const user = sessionStorage.getItem("user");
  if (!user) {
    window.location.href = "../../../pages/login/login.html";
    return;
  }

  // === Elementos principales ===
  const calendarEl = document.getElementById("calendar");
  const modalEl = document.getElementById("eventModal");
  const eventForm = document.getElementById("eventForm");
  const saveEventBtn = document.getElementById("saveEventBtn");
  const deleteEventBtn = document.getElementById("deleteEventBtn");
  const logoutBtn = document.getElementById("logout-btn");

  if (!calendarEl || !modalEl || !eventForm) {
    console.error("❌ Error: No se encontraron los elementos necesarios del DOM (calendar o modal).");
    return;
  }

  const eventModal = new bootstrap.Modal(modalEl);

  let selectedDate = null;
  let calendar;

  // === Inicializar FullCalendar ===
  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    locale: "es",
    selectable: true,
    headerToolbar: {
      left: "prev,next today",
      center: "title",
      right: "",
    },

    // ✅ Click en día vacío -> crear evento
    dateClick: function (info) {
      selectedDate = info.dateStr;

      openModal({
        id: "",
        title: "",
        description: "",
        location: "",
        start: selectedDate + "T00:00",
        end: selectedDate + "T00:00",
      });
    },

    // ✅ Click en evento existente
    eventClick: function (info) {
      const e = info.event;
      openModal({
        id: e.id,
        title: e.title,
        description: e.extendedProps.description || "",
        location: e.extendedProps.location || "",
        start: e.startStr.slice(0, 16),
        end: e.endStr ? e.endStr.slice(0, 16) : "",
      });
    },

    events: [],
  });

  calendar.render();

  // === Función para abrir modal ===
  function openModal(eventData) {
    document.getElementById("eventId").value = eventData.id;
    document.getElementById("title").value = eventData.title;
    document.getElementById("description").value = eventData.description;
    document.getElementById("location").value = eventData.location;
    document.getElementById("start").value = eventData.start;
    document.getElementById("end").value = eventData.end;

    eventModal.show();
  }

  // === Guardar evento ===
  saveEventBtn.addEventListener("click", function () {
    const id = document.getElementById("eventId").value;
    const title = document.getElementById("title").value.trim();
    const description = document.getElementById("description").value.trim();
    const location = document.getElementById("location").value.trim();
    const start = document.getElementById("start").value;
    const end = document.getElementById("end").value;

    if (!title || !start) {
      alert("⚠️ Completa al menos el título y la fecha de inicio.");
      return;
    }

    if (id) {
      const existingEvent = calendar.getEventById(id);
      if (existingEvent) {
        existingEvent.setProp("title", title);
        existingEvent.setStart(start);
        existingEvent.setEnd(end);
        existingEvent.setExtendedProp("description", description);
        existingEvent.setExtendedProp("location", location);
      }
    } else {
      calendar.addEvent({
        id: Date.now().toString(),
        title,
        start,
        end,
        description,
        location,
      });
    }

    eventModal.hide();
  });

  // === Eliminar evento ===
  deleteEventBtn.addEventListener("click", function () {
    const id = document.getElementById("eventId").value;
    if (id && confirm("¿Seguro que deseas eliminar este evento?")) {
      const event = calendar.getEventById(id);
      if (event) event.remove();
      eventModal.hide();
    }
  });

  // === Cerrar sesión ===
  if (logoutBtn) {
    logoutBtn.addEventListener("click", function () {
      sessionStorage.clear();
      window.location.href = "../../../pages/login/login.html";
    });
  }
});
