// admin.js (coloca en la misma carpeta que admin.html)
document.addEventListener("DOMContentLoaded", () => {
  // Protección de ruta: sesión en sessionStorage
  const usuario = JSON.parse(sessionStorage.getItem("usuario"));
  if (!usuario || usuario.role !== "admin") {
    // si no hay sesión válida redirigimos
    window.location.href = "/pages/auth/login/login.html";
    return;
  }

  // Referencias DOM
  const calendarEl = document.getElementById("calendar");
  const modalEl = document.getElementById("eventModal");
  const eventModal = new bootstrap.Modal(modalEl, { backdrop: "static", keyboard: false });
  const eventForm = document.getElementById("eventForm");
  const saveBtn = document.getElementById("saveEventBtn");
  const deleteBtn = document.getElementById("deleteEventBtn");
  const logoutBtn = document.getElementById("logout-btn");

  // Mensajes con el estilo "bienvenido"
  function showMessage(text, type = "success") {
    const box = document.createElement("div");
    box.className = `custom-toast ${type} visible`;
    box.textContent = text;
    document.body.appendChild(box);
    setTimeout(() => box.classList.remove("visible"), 2500);
    setTimeout(() => box.remove(), 3000);
  }

  // Logout: borrar sessionStorage y redirigir
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      sessionStorage.removeItem("usuario");
      // también por seguridad limpiar user keys habituales
      localStorage.removeItem("usuario");
      showMessage("👋 Sesión cerrada correctamente", "success");
      setTimeout(() => (window.location.href = "/pages/auth/login/login.html"), 800);
    });
  }

  // Función para obtener eventos desde la API
  async function fetchEventsForCalendar(fetchInfo, successCallback, failureCallback) {
    try {
      const res = await fetch("/api/events");
      if (!res.ok) {
        // si la API devuelve 500/400 -> pasar array vacío para que se muestre calendario
        successCallback([]);
        return;
      }
      const payload = await res.json();
      // esperamos { success: true, data: [...] } o como tu API devuelva
      const rows = Array.isArray(payload?.data) ? payload.data : (Array.isArray(payload) ? payload : []);
      // Normalizar eventos para FullCalendar
      const events = rows.map(ev => ({
        id: ev.id?.toString?.() || ev.id,
        title: ev.title || "Sin título",
        start: ev.start,
        end: ev.end,
        extendedProps: {
          description: ev.description || "",
          location: ev.location || "",
          image: ev.image_base64 || ev.image || ev.image_url || ""
        }
      }));
      successCallback(events);
    } catch (err) {
      // fallback vacío
      successCallback([]);
    }
  }

  // Abre modal con datos (o vacío para crear)
  function openModalWithData(data) {
    // data.start expected as ISO 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:MM:SS'
    document.getElementById("eventId").value = data.id || "";
    document.getElementById("title").value = data.title || "";
    document.getElementById("description").value = data.description || "";
    document.getElementById("location").value = data.location || "";

    // Si nos pasan start con hora, dividimos; si solo fecha, lo usamos
    if (data.start) {
      const dt = data.start.split("T");
      document.getElementById("start-date").value = dt[0];
      document.getElementById("start-time").value = (dt[1] || "").slice(0,5);
    } else {
      document.getElementById("start-date").value = "";
      document.getElementById("start-time").value = "";
    }

    if (data.end) {
      const dt2 = data.end.split("T");
      document.getElementById("end-time").value = (dt2[1] || "").slice(0,5);
    } else {
      document.getElementById("end-time").value = "";
    }

    // ocultar o mostrar botón eliminar
    deleteBtn.style.display = data.id ? "inline-block" : "none";
    // reset file input
    const fileInput = document.getElementById("image");
    if (fileInput) fileInput.value = "";

    eventModal.show();
  }

  // Inicializa FullCalendar
  let calendar;
  if (calendarEl) {
    calendar = new FullCalendar.Calendar(calendarEl, {
      initialView: "dayGridMonth",
      locale: "es",
      selectable: true,
      height: "auto",
      events: fetchEventsForCalendar,
      select: (info) => {
        // Fecha seleccionada -> mostrar modal con fecha fijada (usuario escoge hora)
        const dateOnly = info.startStr.split("T")[0];
        openModalWithData({ start: dateOnly, end: dateOnly });
      },
      eventClick: (info) => {
        const e = info.event;
        openModalWithData({
          id: e.id,
          title: e.title,
          description: e.extendedProps.description,
          location: e.extendedProps.location,
          start: e.start?.toISOString?.(),
          end: e.end?.toISOString?.()
        });
      }
    });
    calendar.render();
  }

  // Guardar evento (crear o actualizar) — usa JSON con start = YYYY-MM-DDTHH:MM
  async function handleSaveEvent() {
    const id = document.getElementById("eventId").value;
    const title = document.getElementById("title").value.trim();
    const description = document.getElementById("description").value.trim();
    const location = document.getElementById("location").value.trim();
    const date = document.getElementById("start-date").value; // YYYY-MM-DD
    const startTime = document.getElementById("start-time").value; // HH:MM
    const endTime = document.getElementById("end-time").value; // HH:MM
    const imageFile = document.getElementById("image")?.files?.[0];

    if (!title || !date || !startTime || !endTime) {
      showMessage("⚠️ Completa los campos obligatorios", "error");
      return;
    }

    // Construir ISO-like strings: YYYY-MM-DDTHH:MM
    const start = `${date}T${startTime}`;
    const end = `${date}T${endTime}`;

    // Si API soporta imagenes por ahora no la mandamos (para evitar problemas).
    // Si quieres subida, lo cambiamos a FormData y el endpoint debe soportarlo.
    const payload = { title, description, location, start, end };

    try {
      const url = id ? `/api/events/${id}` : "/api/events";
      const method = id ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      // si la API devuelve HTML de error en lugar de JSON, manejamos
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { throw new Error("Respuesta no JSON del servidor"); }

      if (!res.ok || !data.success) {
        throw new Error(data?.message || `Error ${res.status}`);
      }

      eventModal.hide();
      showMessage(id ? "✅ Evento actualizado" : "🎉 Evento creado", "success");
      calendar.refetchEvents();
    } catch (err) {
      showMessage("❌ Error al guardar evento", "error");
      console.error("Error guardar evento:", err);
    }
  }

  // Eliminar evento
  async function handleDeleteEvent() {
    const id = document.getElementById("eventId").value;
    if (!id) return;

    // Mostrar confirmación con tu estilo
    const confirmBox = document.createElement("div");
    confirmBox.className = "custom-alert";
    confirmBox.style = "position:fixed;top:20px;right:20px;z-index:99999;";
    confirmBox.innerHTML = `
      <div style="font-weight:700;margin-bottom:8px;">¿Eliminar evento?</div>
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button id="confirmYes" class="btn btn-danger btn-sm">Sí</button>
        <button id="confirmNo" class="btn btn-secondary btn-sm">No</button>
      </div>
    `;
    document.body.appendChild(confirmBox);

    document.getElementById("confirmNo").addEventListener("click", () => confirmBox.remove());
    document.getElementById("confirmYes").addEventListener("click", async () => {
      confirmBox.remove();
      try {
        const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch { throw new Error("Respuesta no JSON"); }

        if (!res.ok || !data.success) throw new Error(data?.message || `Error ${res.status}`);

        eventModal.hide();
        showMessage("🗑️ Evento eliminado", "success");
        calendar.refetchEvents();
      } catch (err) {
        showMessage("❌ No se pudo eliminar el evento", "error");
        console.error("Error eliminar evento:", err);
      }
    });
  }

  // Conectar botones
  if (saveBtn) saveBtn.addEventListener("click", handleSaveEvent);
  if (deleteBtn) deleteBtn.addEventListener("click", handleDeleteEvent);
});
