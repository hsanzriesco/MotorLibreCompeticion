document.addEventListener("DOMContentLoaded", async () => {
  // === 🚫 VERIFICAR SESIÓN ===
  const usuario = JSON.parse(localStorage.getItem("usuario")) || JSON.parse(sessionStorage.getItem("usuario"));
  if (!usuario || usuario.role !== "admin") {
    alert("❌ Acceso denegado. Inicia sesión como administrador.");
    window.location.href = "/pages/auth/login/login.html";
    return;
  }

  // === ELEMENTOS DEL DOM ===
  const calendarEl = document.getElementById("calendar");
  const eventModalEl = document.getElementById("eventModal");
  if (!calendarEl || !eventModalEl) return;

  const eventModal = new bootstrap.Modal(eventModalEl);
  const form = document.getElementById("eventForm");

  const titleInput = document.getElementById("title");
  const descriptionInput = document.getElementById("description");
  const locationInput = document.getElementById("location");
  const startDateInput = document.getElementById("start-date");
  const startTimeInput = document.getElementById("start-time");
  const endTimeInput = document.getElementById("end-time");
  const imageInput = document.getElementById("image");
  const eventIdInput = document.getElementById("eventId");

  const saveEventBtn = document.getElementById("saveEventBtn");
  const deleteEventBtn = document.getElementById("deleteEventBtn");

  let selectedEvent = null;

  // === 🔁 FUNCIONES ===
  async function fetchEvents() {
    try {
      const res = await fetch("/api/events");
      if (!res.ok) throw new Error("Error al obtener eventos");
      const json = await res.json();
      if (!json.success || !Array.isArray(json.data)) throw new Error("Respuesta no válida");

      return json.data.map((e) => ({
        id: e.id,
        title: e.title,
        start: e.start,
        end: e.end,
        extendedProps: {
          description: e.description,
          location: e.location,
          image_base64: e.image_base64,
        },
      }));
    } catch {
      return [];
    }
  }

  // === 💬 ALERTA PERSONALIZADA ===
  function showMessage(text, type = "success") {
    const messageBox = document.createElement("div");
    messageBox.className = `alert alert-${type} text-center position-fixed top-0 start-50 translate-middle-x mt-3`;
    messageBox.style.zIndex = "2000";
    messageBox.style.backgroundColor = type === "danger" ? "#e50914" : "#1db954";
    messageBox.style.color = "white";
    messageBox.style.border = "none";
    messageBox.style.boxShadow = "0 0 10px rgba(0,0,0,0.5)";
    messageBox.style.borderRadius = "10px";
    messageBox.style.padding = "10px 20px";
    messageBox.textContent = text;
    document.body.appendChild(messageBox);
    setTimeout(() => messageBox.remove(), 2500);
  }

  // === 💬 MODAL DE CONFIRMACIÓN ===
  function showConfirm(message, onConfirm) {
    const confirmModal = document.createElement("div");
    confirmModal.className = "modal fade";
    confirmModal.innerHTML = `
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content border-danger" style="background-color:#111; color:white;">
          <div class="modal-header border-danger">
            <h5 class="modal-title text-danger">⚠️ Confirmación</h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body text-center">
            <p>${message}</p>
          </div>
          <div class="modal-footer border-danger justify-content-center">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
            <button type="button" class="btn btn-danger" id="confirmBtn">Eliminar</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(confirmModal);

    const modal = new bootstrap.Modal(confirmModal);
    modal.show();

    confirmModal.querySelector("#confirmBtn").addEventListener("click", () => {
      modal.hide();
      setTimeout(() => confirmModal.remove(), 300);
      onConfirm();
    });

    confirmModal.addEventListener("hidden.bs.modal", () => confirmModal.remove());
  }

  function toBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  }

  // === 🗓️ INICIALIZAR CALENDARIO ===
  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    selectable: true,
    editable: false,
    height: "auto",
    locale: "es",

    select: (info) => {
      selectedEvent = null;
      form.reset();
      const date = info.startStr.split("T")[0];
      startDateInput.value = date;
      startTimeInput.value = "00:00";
      endTimeInput.value = "00:00";
      eventIdInput.value = "";
      deleteEventBtn.style.display = "none";
      eventModal.show();
    },

    eventClick: (info) => {
      const event = info.event;
      selectedEvent = event;

      eventIdInput.value = event.id;
      titleInput.value = event.title;
      descriptionInput.value = event.extendedProps.description || "";
      locationInput.value = event.extendedProps.location || "";

      if (event.start) {
        const startDate = new Date(event.start);
        startDateInput.value = startDate.toISOString().split("T")[0];
        startTimeInput.value = startDate.toTimeString().slice(0, 5);
      }

      if (event.end) {
        const endDate = new Date(event.end);
        endTimeInput.value = endDate.toTimeString().slice(0, 5);
      }

      deleteEventBtn.style.display = "inline-block";
      eventModal.show();
    },

    events: async (info, successCallback) => {
      const events = await fetchEvents();
      successCallback(events);
    },
  });

  calendar.render();

  // === 💾 GUARDAR / ACTUALIZAR EVENTO ===
  saveEventBtn.addEventListener("click", async () => {
    const id = eventIdInput.value;
    const title = titleInput.value.trim();
    const description = descriptionInput.value.trim();
    const location = locationInput.value.trim();
    const date = startDateInput.value;
    const startTime = startTimeInput.value;
    const endTime = endTimeInput.value;

    if (!title || !date || !startTime || !endTime) {
      showMessage("Por favor completa todos los campos obligatorios", "danger");
      return;
    }

    const start = `${date}T${startTime}`;
    const end = `${date}T${endTime}`;

    let image_base64 = null;
    if (imageInput.files.length > 0) {
      const file = imageInput.files[0];
      image_base64 = await toBase64(file);
    }

    const payload = { title, description, location, start, end, image_base64 };

    try {
      const res = await fetch(id ? `/api/events?id=${id}` : "/api/events", {
        method: id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!data.success) throw new Error();

      showMessage(id ? "✅ Evento actualizado" : "✅ Evento creado");
      eventModal.hide();
      calendar.refetchEvents();
    } catch {
      showMessage("Error al guardar evento", "danger");
    }
  });

  // === 🗑️ ELIMINAR EVENTO (nuevo estilo) ===
  deleteEventBtn.addEventListener("click", () => {
    if (!selectedEvent || !selectedEvent.id) {
      showMessage("No hay evento seleccionado", "danger");
      return;
    }

    showConfirm("¿Seguro que deseas eliminar este evento?", async () => {
      try {
        const res = await fetch(`/api/events?id=${selectedEvent.id}`, { method: "DELETE" });
        const data = await res.json();
        if (!data.success) throw new Error();

        showMessage("🗑️ Evento eliminado correctamente");
        eventModal.hide();
        calendar.refetchEvents();
      } catch {
        showMessage("Error al eliminar evento", "danger");
      }
    });
  });

  // === 🔒 CERRAR SESIÓN ===
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      localStorage.clear();
      sessionStorage.clear();
      showMessage("🔒 Sesión cerrada correctamente");
      setTimeout(() => (window.location.href = "/pages/auth/login/login.html"), 1500);
    });
  }
});
