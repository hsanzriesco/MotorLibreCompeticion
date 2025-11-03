document.addEventListener("DOMContentLoaded", async () => {
  const calendarEl = document.getElementById("calendar");
  const eventModal = new bootstrap.Modal(document.getElementById("eventModal"));
  const eventForm = document.getElementById("eventForm");
  const saveEventBtn = document.getElementById("saveEventBtn");
  const deleteEventBtn = document.getElementById("deleteEventBtn");

  let selectedEvent = null;

  // ✅ Cargar eventos desde la API
  async function fetchEvents() {
    try {
      const res = await fetch("/api/events");
      const result = await res.json();

      // 🧠 Si la API devuelve { success, data: [...] }
      const data = Array.isArray(result) ? result : result.data;

      if (!Array.isArray(data)) {
        console.warn("⚠️ No se encontraron eventos válidos en la API");
        return [];
      }

      return data.map(event => ({
        id: event.id,
        title: event.title,
        start: event.start,
        end: event.end,
        description: event.description,
        location: event.location,
        image: event.image
      }));
    } catch (err) {
      console.error("Error al cargar eventos:", err);
      return [];
    }
  }

  const events = await fetchEvents();

  // ✅ Inicializar FullCalendar
  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    selectable: true,
    editable: false,
    locale: "es",
    headerToolbar: {
      left: "prev,next today",
      center: "title",
      right: "dayGridMonth,timeGridWeek"
    },

    // 🟢 Crear nuevo evento
    select: (info) => {
      selectedEvent = null;
      eventForm.reset();

      // Obtener fecha seleccionada
      const selectedDate = info.startStr.split("T")[0];
      document.getElementById("start-date").value = selectedDate;
      document.getElementById("start-time").value = "";
      document.getElementById("end-time").value = "";

      document.getElementById("eventId").value = "";
      eventModal.show();
    },

    // 🟢 Editar evento existente
    eventClick: (info) => {
      selectedEvent = info.event;

      document.getElementById("eventId").value = selectedEvent.id || "";
      document.getElementById("title").value = selectedEvent.title || "";
      document.getElementById("description").value = selectedEvent.extendedProps.description || "";
      document.getElementById("location").value = selectedEvent.extendedProps.location || "";

      const start = new Date(selectedEvent.start);
      const end = selectedEvent.end ? new Date(selectedEvent.end) : null;

      document.getElementById("start-date").value = start.toISOString().split("T")[0];
      document.getElementById("start-time").value = start.toISOString().slice(11, 16);
      document.getElementById("end-time").value = end ? end.toISOString().slice(11, 16) : "";

      eventModal.show();
    },

    events: events,
  });

  calendar.render();

  // 🟢 Guardar evento
  saveEventBtn.addEventListener("click", async () => {
    const id = document.getElementById("eventId").value;
    const title = document.getElementById("title").value.trim();
    const description = document.getElementById("description").value.trim();
    const location = document.getElementById("location").value.trim();
    const date = document.getElementById("start-date").value;
    const startTime = document.getElementById("start-time").value;
    const endTime = document.getElementById("end-time").value;
    const image = document.getElementById("image").files[0];

    if (!title || !date || !startTime || !endTime) {
      alert("Por favor completa todos los campos obligatorios.");
      return;
    }

    const start = `${date}T${startTime}`;
    const end = `${date}T${endTime}`;

    const formData = new FormData();
    formData.append("title", title);
    formData.append("description", description);
    formData.append("location", location);
    formData.append("start", start);
    formData.append("end", end);
    if (image) formData.append("image", image);

    try {
      let res;
      if (id) {
        res = await fetch(`/api/events/${id}`, { method: "PUT", body: formData });
      } else {
        res = await fetch("/api/events", { method: "POST", body: formData });
      }

      if (!res.ok) throw new Error(`Error ${res.status}`);

      showMessage(id ? "✅ Evento actualizado correctamente" : "🎉 Evento creado con éxito");
      eventModal.hide();
      calendar.refetchEvents();
    } catch (err) {
      console.error("❌ Error al guardar evento:", err);
      showMessage("❌ Error al guardar evento", true);
    }
  });

  // 🟢 Eliminar evento
  deleteEventBtn.addEventListener("click", async () => {
    const id = document.getElementById("eventId").value;
    if (!id) return;
    if (!confirm("¿Seguro que quieres eliminar este evento?")) return;

    try {
      const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Error ${res.status}`);

      showMessage("🗑️ Evento eliminado correctamente");
      eventModal.hide();
      calendar.refetchEvents();
    } catch (err) {
      console.error("❌ Error al eliminar evento:", err);
      showMessage("❌ Error al eliminar evento", true);
    }
  });

  // 🟢 Mensajes flotantes estilo “Bienvenido”
  function showMessage(text, error = false) {
    const msg = document.createElement("div");
    msg.className = `alert ${error ? "alert-danger" : "alert-success"} text-center fw-bold position-fixed top-0 start-50 translate-middle-x mt-3`;
    msg.style.zIndex = "9999";
    msg.innerHTML = text;
    document.body.appendChild(msg);
    setTimeout(() => msg.remove(), 3000);
  }
});
