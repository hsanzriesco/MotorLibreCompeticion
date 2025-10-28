document.addEventListener("DOMContentLoaded", async () => {
  const usuario = JSON.parse(localStorage.getItem("usuario"));
  const adminName = document.getElementById("admin-name");

  // Verifica usuario admin
  if (!usuario || usuario.role !== "admin") {
    alert("❌ Acceso denegado. Solo administradores.");
    window.location.href = "/index.html";
    return;
  }
  adminName.textContent = `👋 ${usuario.name}`;

  // Botón de cerrar sesión
  document.getElementById("logout-btn").addEventListener("click", () => {
    localStorage.removeItem("usuario");
    window.location.href = "/pages/auth/login/login.html";
  });

  // Inicializar calendario
  const calendarEl = document.getElementById("calendar");
  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    locale: "es",
    selectable: true,
    editable: true,

    events: async (info, successCallback, failureCallback) => {
      try {
        const res = await fetch("/api/events");
        const data = await res.json();

        if (data.success && Array.isArray(data.data)) {
          successCallback(data.data);
        } else {
          console.warn("⚠️ No se encontraron eventos o formato incorrecto");
          successCallback([]);
        }
      } catch (err) {
        console.error("❌ Error al cargar eventos:", err);
        failureCallback(err);
      }
    },

    select: (info) => openEventModal(info.startStr, info.endStr),
    eventClick: (info) => showEventDetails(info.event),
  });

  calendar.render();

  // ===== MODAL =====
  const eventModal = new bootstrap.Modal(document.getElementById("eventModal"));
  const saveBtn = document.getElementById("saveEventBtn");
  let startTemp = null, endTemp = null;

  function openEventModal(start, end) {
    startTemp = start;
    endTemp = end;
    document.getElementById("eventForm").reset();

    if (document.activeElement) document.activeElement.blur();

    eventModal.show();
  }


  function showEventDetails(event) {
    const detalles = `
      📅 <b>${event.title}</b><br>
      📝 ${event.extendedProps.description || "Sin descripción"}<br>
      📍 ${event.extendedProps.location || "Sin ubicación"}<br>
      ⏰ ${event.start.toLocaleString()}
    `;
    alert(detalles);
  }

  saveBtn.addEventListener("click", async () => {
    const title = document.getElementById("title").value.trim();
    const description = document.getElementById("description").value.trim();
    const location = document.getElementById("location").value.trim();
    const startDate = document.getElementById("startDate").value;
    const endDate = document.getElementById("endDate").value;

    if (!title || !startDate || !endDate) {
      alert("⚠️ Todos los campos son obligatorios.");
      return;
    }

    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, description, location,
          start: startDate,
          end: endDate
        }),
      });

      const data = await res.json();

      if (data.success) {
        calendar.addEvent({
          id: data.data.id,
          title,
          description,
          location,
          start: startDate,
          end: endDate
        });
        eventModal.hide();
        alert("✅ Evento creado con éxito");
      } else {
        alert("❌ Error: " + data.message);
      }
    } catch (err) {
      console.error("Error al guardar evento:", err);
      alert("❌ No se pudo guardar el evento.");
    }
  });
});
