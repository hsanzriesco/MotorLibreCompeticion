document.addEventListener("DOMContentLoaded", async () => {
  const usuario = JSON.parse(localStorage.getItem("usuario"));

  if (!usuario || usuario.role !== "admin") {
    alert("❌ Acceso denegado. No eres administrador.");
    window.location.href = "/index.html";
    return;
  }

  document.getElementById("bienvenida").textContent = `👋 Bienvenido, ${usuario.name} (Administrador)`;
  document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("usuario");
    window.location.href = "/pages/auth/login/login.html";
  });

  const calendarEl = document.getElementById("calendar");
  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
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
      alert(`📅 ${e.title}\n${e.extendedProps.description || "Sin descripción"}\n📍 ${e.extendedProps.location || "Sin ubicación"}`);
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

  // MODAL LÓGICA
  const modal = document.getElementById("eventModal");
  const cancelModal = document.getElementById("cancelModal");
  const form = document.getElementById("eventForm");
  let startTemp = null, endTemp = null;

  function openEventModal(start, end) {
    startTemp = start;
    endTemp = end;
    modal.classList.remove("hidden");
  }

  cancelModal.addEventListener("click", () => modal.classList.add("hidden"));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = document.getElementById("eventTitle").value.trim();
    const description = document.getElementById("eventDesc").value.trim();
    const location = document.getElementById("eventLoc").value.trim();

    if (!title) {
      alert("⚠️ El título es obligatorio");
      return;
    }

    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, description, location, start: startTemp, end: endTemp,
        }),
      });
      const data = await res.json();
      if (data.success) {
        calendar.addEvent({
          id: data.data.id,
          title,
          description,
          location,
          start: startTemp,
          end: endTemp,
        });
        modal.classList.add("hidden");
        form.reset();
      } else {
        alert("❌ Error al crear evento: " + data.message);
      }
    } catch (err) {
      console.error("Error al crear evento:", err);
    }
  });
});
