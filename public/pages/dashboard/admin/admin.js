document.addEventListener("DOMContentLoaded", async () => {
  const calendarEl = document.getElementById("calendar");
  const eventModal = new bootstrap.Modal(document.getElementById("eventModal"));
  const eventForm = document.getElementById("eventForm");
  const saveEventBtn = document.getElementById("saveEventBtn");
  const deleteEventBtn = document.getElementById("deleteEventBtn");
  const logoutBtn = document.getElementById("logout-btn");

  // ✅ Alerta personalizada
  function showAlert(message, type = "success") {
    const alert = document.createElement("div");
    alert.className = `custom-alert ${type}`;
    alert.innerHTML = `<i class="bi bi-check-circle me-2"></i>${message}`;
    document.body.appendChild(alert);
    setTimeout(() => alert.remove(), 4000);
  }

  // ✅ Logout funcional y completo
  logoutBtn.addEventListener("click", (e) => {
    e.preventDefault();
    localStorage.removeItem("user");
    sessionStorage.removeItem("user");
    showAlert("Sesión cerrada correctamente 👋", "success");
    setTimeout(() => (window.location.href = "../../../index.html"), 1500);
  });

  // ✅ Obtener eventos desde el servidor
  async function fetchEvents() {
    try {
      const response = await fetch("/api/events");
      if (!response.ok) throw new Error("Error al cargar eventos");
      const data = await response.json();
      if (!Array.isArray(data)) return [];
      return data.map(ev => ({
        id: ev.id,
        title: ev.title,
        start: ev.start,
        end: ev.end,
        extendedProps: {
          description: ev.description,
          location: ev.location,
          image: ev.image,
        }
      }));
    } catch {
      return [];
    }
  }

  // ✅ Guardar o actualizar evento
  async function saveEvent() {
    const id = document.getElementById("eventId").value;
    const title = document.getElementById("title").value.trim();
    const description = document.getElementById("description").value.trim();
    const location = document.getElementById("location").value.trim();
    const date = document.getElementById("start-date").value;
    const startTime = document.getElementById("start-time").value;
    const endTime = document.getElementById("end-time").value;

    if (!title || !date || !startTime || !endTime) {
      showAlert("Por favor, completa los campos obligatorios.", "error");
      return;
    }

    const start = `${date}T${startTime}`;
    const end = `${date}T${endTime}`;
    const eventData = { title, description, location, start, end };

    try {
      const method = id ? "PUT" : "POST";
      const url = id ? `/api/events/${id}` : `/api/events`;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(eventData),
      });

      if (!res.ok) throw new Error("Error al guardar evento");

      eventModal.hide();
      showAlert(id ? "✅ Evento actualizado correctamente" : "🎉 Evento creado con éxito");
      calendar.refetchEvents();
    } catch {
      showAlert("❌ Error al guardar el evento.", "error");
    }
  }

  // ✅ Eliminar evento con alerta personalizada
  async function deleteEvent() {
    const id = document.getElementById("eventId").value;
    if (!id) return;

    const confirmBox = document.createElement("div");
    confirmBox.className = "custom-alert question";
    confirmBox.innerHTML = `
      <p>¿Seguro que deseas eliminar este evento?</p>
      <div class="mt-3 text-end">
        <button id="confirmDelete" class="btn btn-danger btn-sm me-2">Sí</button>
        <button id="cancelDelete" class="btn btn-secondary btn-sm">No</button>
      </div>
    `;
    document.body.appendChild(confirmBox);

    document.getElementById("cancelDelete").addEventListener("click", () => confirmBox.remove());
    document.getElementById("confirmDelete").addEventListener("click", async () => {
      confirmBox.remove();
      try {
        const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Error al eliminar evento");
        eventModal.hide();
        showAlert("🗑️ Evento eliminado correctamente");
        calendar.refetchEvents();
      } catch {
        showAlert("❌ No se pudo eliminar el evento.", "error");
      }
    });
  }

  // ✅ Inicializar FullCalendar
  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    selectable: true,
    editable: true,
    locale: "es",
    events: fetchEvents,
    select: (info) => {
      document.getElementById("eventId").value = "";
      eventForm.reset();
      document.getElementById("start-date").value = info.startStr;
      eventModal.show();
    },
    eventClick: (info) => {
      const ev = info.event;
      document.getElementById("eventId").value = ev.id;
      document.getElementById("title").value = ev.title;
      document.getElementById("description").value = ev.extendedProps.description || "";
      document.getElementById("location").value = ev.extendedProps.location || "";
      document.getElementById("start-date").value = ev.startStr.split("T")[0];
      document.getElementById("start-time").value = ev.startStr.split("T")[1]?.substring(0, 5) || "";
      document.getElementById("end-time").value = ev.endStr?.split("T")[1]?.substring(0, 5) || "";
      eventModal.show();
    },
  });

  calendar.render();

  // ✅ Listeners
  saveEventBtn.addEventListener("click", saveEvent);
  deleteEventBtn.addEventListener("click", deleteEvent);
});
