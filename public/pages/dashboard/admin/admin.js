document.addEventListener("DOMContentLoaded", function () {
  // ✅ Verificar sesión
  const user = sessionStorage.getItem("user");
  if (!user) {
    window.location.href = "../../../pages/login/login.html";
    return;
  }

  const calendarEl = document.getElementById("calendar");
  const eventModalEl = document.getElementById("eventModal");
  const eventModal = bootstrap.Modal.getOrCreateInstance(eventModalEl);

  const eventForm = document.getElementById("eventForm");
  const saveEventBtn = document.getElementById("saveEventBtn");
  const deleteEventBtn = document.getElementById("deleteEventBtn");

  let selectedDate = null;
  let calendar;

  // ✅ Inicializa el calendario
  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    locale: "es",
    headerToolbar: {
      left: "prev,next today",
      center: "title",
      right: "",
    },

    // ✅ Cuando se hace clic en un día
    dateClick: function (info) {
      selectedDate = info.dateStr;

      // Limpia el formulario
      eventForm.reset();
      document.getElementById("eventId").value = "";
      document.getElementById("start").value = selectedDate + "T00:00";
      document.getElementById("end").value = selectedDate + "T00:00";

      // ✅ Mostrar modal
      eventModal.show();
    },

    // ✅ Cuando se hace clic en un evento existente
    eventClick: function (info) {
      const event = info.event;
      document.getElementById("eventId").value = event.id;
      document.getElementById("title").value = event.title;
      document.getElementById("description").value = event.extendedProps.description || "";
      document.getElementById("location").value = event.extendedProps.location || "";
      document.getElementById("start").value = event.startStr.slice(0, 16);
      document.getElementById("end").value = event.endStr ? event.endStr.slice(0, 16) : "";

      eventModal.show();
    },

    events: [],
  });

  calendar.render();

  // ✅ Guardar evento
  saveEventBtn.addEventListener("click", function () {
    const id = document.getElementById("eventId").value;
    const title = document.getElementById("title").value.trim();
    const description = document.getElementById("description").value.trim();
    const location = document.getElementById("location").value.trim();
    const start = document.getElementById("start").value;
    const end = document.getElementById("end").value;

    if (!title || !start) {
      alert("Por favor, completa los campos obligatorios.");
      return;
    }

    if (!id) {
      const newEvent = {
        id: Date.now().toString(),
        title,
        start,
        end,
        description,
        location,
      };
      calendar.addEvent(newEvent);
    } else {
      const event = calendar.getEventById(id);
      if (event) {
        event.setProp("title", title);
        event.setStart(start);
        event.setEnd(end);
        event.setExtendedProp("description", description);
        event.setExtendedProp("location", location);
      }
    }

    eventModal.hide();
  });

  // ✅ Eliminar evento
  deleteEventBtn.addEventListener("click", function () {
    const id = document.getElementById("eventId").value;
    if (id) {
      const event = calendar.getEventById(id);
      if (event && confirm("¿Seguro que deseas eliminar este evento?")) {
        event.remove();
      }
    }
    eventModal.hide();
  });

  // ✅ Cerrar sesión
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", function () {
      sessionStorage.clear();
      window.location.href = "../../../pages/login/login.html";
    });
  }
});
