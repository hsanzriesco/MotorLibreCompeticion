document.addEventListener("DOMContentLoaded", async () => {
  const usuario = JSON.parse(localStorage.getItem("usuario"));

  // Verificar rol de administrador
  if (!usuario || usuario.role !== "admin") {
    alert("❌ Acceso denegado. No eres administrador.");
    window.location.href = "/index.html";
    return;
  }

  // Mostrar bienvenida y cerrar sesión
  function cerrarSesion() {
    localStorage.removeItem("usuario");
    window.location.href = "/pages/auth/login/login.html";
  }
  window.cerrarSesion = cerrarSesion;

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
        if (data.success) successCallback(data.data);
        else failureCallback(data.message);
      } catch (err) {
        console.error("❌ Error al cargar eventos:", err);
        failureCallback(err);
      }
    },

    select: (info) => {
      openEventModal(info.startStr, info.endStr);
    },

    eventClick: (info) => {
      const e = info.event;
      mostrarEvento(e);
    },

    eventChange: async (info) => {
      const e = info.event;
      try {
        await fetch("/api/events", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: e.id,
            title: e.title,
            description: e.extendedProps.description,
            location: e.extendedProps.location,
            start: e.startStr,
            end: e.endStr,
          }),
        });
      } catch (err) {
        console.error("Error al actualizar evento:", err);
      }
    },
  });

  calendar.render();

  // --- MODAL ---
  const modal = new bootstrap.Modal(document.getElementById("eventModal"));
  const form = document.getElementById("eventForm");
  const saveBtn = document.getElementById("saveEventBtn");

  let startTemp = null, endTemp = null;

  function openEventModal(start, end) {
    startTemp = start;
    endTemp = end;
    document.getElementById("viewEventInfo").style.display = "none";
    form.style.display = "block";
    saveBtn.style.display = "inline-block";
    form.reset();
    modal.show();
  }

  function mostrarEvento(e) {
    document.getElementById("viewEventInfo").style.display = "block";
    form.style.display = "none";
    saveBtn.style.display = "none";

    document.getElementById("vTitle").textContent = e.title;
    document.getElementById("vDescription").textContent = e.extendedProps.description || "Sin descripción";
    document.getElementById("vLocation").textContent = e.extendedProps.location || "Sin ubicación";
    document.getElementById("vStart").textContent = new Date(e.start).toLocaleString();
    document.getElementById("vEnd").textContent = e.end ? new Date(e.end).toLocaleString() : "N/A";

    modal.show();
  }

  // --- GUARDAR EVENTO ---
  saveBtn.addEventListener("click", async () => {
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
        body: JSON.stringify({
          title,
          description,
          location,
          start,
          end,
        }),
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
      console.error("Error al crear evento:", err);
    }
  });
});
