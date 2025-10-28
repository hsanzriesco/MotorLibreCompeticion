document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ Admin panel cargado");

  // --- Seguridad: redirigir si no es admin ---
  const usuario = JSON.parse(localStorage.getItem("usuario"));
  if (!usuario || usuario.role !== "admin") {
    alert("❌ Acceso denegado. Solo administradores.");
    window.location.href = "/index.html";
    return;
  }

  // --- Elementos del DOM ---
  const modalEl = document.getElementById("eventModal");
  const modal = new bootstrap.Modal(modalEl);
  const saveBtn = document.getElementById("saveEventBtn");
  const deleteBtn = document.getElementById("deleteEventBtn");
  const nuevoEventoBtn = document.getElementById("nuevoEventoBtn");

  const form = {
    id: document.getElementById("eventId"),
    title: document.getElementById("title"),
    description: document.getElementById("description"),
    location: document.getElementById("location"),
    start: document.getElementById("startDate"),
    end: document.getElementById("endDate"),
  };

  // --- Inicializar calendario ---
  const calendarEl = document.getElementById("calendar");
  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    locale: "es",
    selectable: true,
    editable: true,
    eventColor: "#e50914",
    headerToolbar: { left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,listMonth" },

    // Cargar eventos
    events: async (info, success, fail) => {
      try {
        const res = await fetch("/api/events");
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) success(data.data);
        else success([]);
      } catch (err) {
        console.error("Error al cargar eventos:", err);
        fail(err);
      }
    },

    // Crear seleccionando rango
    select: (info) => openModalForCreate(info.startStr, info.endStr),

    // Clic en evento existente
    eventClick: (info) => openModalForEdit(info.event),

    // Cambiar arrastrando/resize
    eventChange: async (info) => {
      const e = info.event;
      try {
        await fetch("/api/events", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: e.id,
            title: e.title,
            description: e.extendedProps.description || "",
            location: e.extendedProps.location || "",
            start: e.startStr,
            end: e.endStr || e.startStr,
          }),
        });
      } catch (err) {
        console.error("Error actualizando evento:", err);
      }
    },
  });

  calendar.render();

  // --- Funciones de utilidad ---
  function openModalForCreate(start, end) {
    resetForm();
    form.start.value = toInputDate(start);
    form.end.value = toInputDate(end);
    deleteBtn.style.display = "none";
    modal.show();
  }

  function openModalForEdit(event) {
    form.id.value = event.id;
    form.title.value = event.title;
    form.description.value = event.extendedProps.description || "";
    form.location.value = event.extendedProps.location || "";
    form.start.value = toInputDate(event.start);
    form.end.value = toInputDate(event.end);
    deleteBtn.style.display = "inline-block";
    modal.show();
  }

  function resetForm() {
    form.id.value = "";
    form.title.value = "";
    form.description.value = "";
    form.location.value = "";
    form.start.value = "";
    form.end.value = "";
  }

  function toInputDate(date) {
    const d = new Date(date);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  // --- Guardar (crear o actualizar) ---
  saveBtn.addEventListener("click", async () => {
    const payload = {
      title: form.title.value.trim(),
      description: form.description.value.trim(),
      location: form.location.value.trim(),
      start: form.start.value,
      end: form.end.value,
    };

    if (!payload.title || !payload.start || !payload.end) {
      alert("⚠️ Completa todos los campos obligatorios.");
      return;
    }

    try {
      const res = await fetch("/api/events", {
        method: form.id.value ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, id: form.id.value }),
      });

      const data = await res.json();
      if (data.success) {
        modal.hide();
        calendar.refetchEvents();
      } else {
        alert("❌ Error al guardar evento: " + data.message);
      }
    } catch (err) {
      console.error("Error al guardar evento:", err);
    }
  });

  // --- Eliminar evento ---
  deleteBtn.addEventListener("click", async () => {
    if (!confirm("¿Eliminar este evento?")) return;
    try {
      const res = await fetch(`/api/events?id=${form.id.value}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        modal.hide();
        calendar.refetchEvents();
      } else {
        alert("❌ Error al eliminar: " + data.message);
      }
    } catch (err) {
      console.error("Error al eliminar:", err);
    }
  });

  // --- Crear evento desde botón superior ---
  nuevoEventoBtn.addEventListener("click", () => {
    const now = new Date();
    const start = now.toISOString().slice(0, 16);
    const end = new Date(now.getTime() + 60 * 60 * 1000).toISOString().slice(0, 16);
    openModalForCreate(start, end);
  });

  // --- Cerrar sesión ---
  document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("usuario");
    window.location.href = "/pages/auth/login/login.html";
  });
});
