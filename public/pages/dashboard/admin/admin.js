document.addEventListener("DOMContentLoaded", async () => {
  // === 🚫 VERIFICAR SESIÓN ===
  const usuario =
    JSON.parse(localStorage.getItem("usuario")) ||
    JSON.parse(sessionStorage.getItem("usuario"));
  if (!usuario || usuario.role !== "admin") {
    showCustomAlert("❌ Acceso denegado. Inicia sesión como administrador.", "error");
    setTimeout(() => {
      window.location.href = "/pages/auth/login/login.html";
    }, 1500);
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

  // === 🌈 FUNCIÓN GLOBAL DE ALERTAS PERSONALIZADAS ===
  function showCustomAlert(message, type = "success") {
    const alertBox = document.createElement("div");
    alertBox.className = `custom-alert ${type}`;
    alertBox.innerHTML = `
      <div class="alert-content">
        ${
          type === "success"
            ? '<i class="bi bi-check-circle-fill"></i>'
            : type === "error"
            ? '<i class="bi bi-x-circle-fill"></i>'
            : '<i class="bi bi-exclamation-triangle-fill"></i>'
        }
        <span>${message}</span>
      </div>
    `;
    document.body.appendChild(alertBox);

    setTimeout(() => {
      alertBox.classList.add("show");
    }, 50);

    setTimeout(() => {
      alertBox.classList.remove("show");
      setTimeout(() => alertBox.remove(), 300);
    }, 3500);
  }

  // === ⚠️ ALERTA DE CONFIRMACIÓN PERSONALIZADA ===
  function showConfirmAlert(message, onConfirm) {
    const confirmBox = document.createElement("div");
    confirmBox.className = "custom-confirm";
    confirmBox.innerHTML = `
      <div class="confirm-content">
        <p>${message}</p>
        <div class="buttons">
          <button id="confirmYes" class="btn btn-danger">Sí</button>
          <button id="confirmNo" class="btn btn-secondary">No</button>
        </div>
      </div>
    `;
    document.body.appendChild(confirmBox);

    document.getElementById("confirmNo").addEventListener("click", () => {
      confirmBox.remove();
    });

    document.getElementById("confirmYes").addEventListener("click", () => {
      confirmBox.remove();
      onConfirm();
    });
  }

  // === 🔁 CARGAR EVENTOS ===
  async function fetchEvents() {
    try {
      const res = await fetch("/api/events");
      if (!res.ok) throw new Error("Error al obtener eventos");
      const json = await res.json();
      if (!json.success || !Array.isArray(json.data)) throw new Error("Datos inválidos");
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
      showCustomAlert("Error al cargar los eventos", "error");
      return [];
    }
  }

  function toBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  }

  // === 🗓️ CALENDARIO ===
  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    selectable: true,
    editable: false,
    height: "auto",
    locale: "es",

    select: (info) => {
      selectedEvent = null;
      form.reset();
      startDateInput.value = info.startStr.split("T")[0];
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
      showCustomAlert("Por favor completa todos los campos obligatorios", "error");
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

      showCustomAlert(id ? "✅ Evento actualizado correctamente" : "🎉 Evento creado con éxito", "success");
      eventModal.hide();
      calendar.refetchEvents();
    } catch {
      showCustomAlert("❌ Error al guardar evento", "error");
    }
  });

  // === 🗑️ ELIMINAR EVENTO ===
  deleteEventBtn.addEventListener("click", async () => {
    if (!selectedEvent || !selectedEvent.id) {
      showCustomAlert("No hay evento seleccionado", "error");
      return;
    }

    showConfirmAlert("¿Seguro que deseas eliminar este evento?", async () => {
      try {
        const res = await fetch(`/api/events?id=${selectedEvent.id}`, { method: "DELETE" });
        const data = await res.json();
        if (!data.success) throw new Error();

        showCustomAlert("🗑️ Evento eliminado correctamente", "success");
        eventModal.hide();
        calendar.refetchEvents();
      } catch {
        showCustomAlert("Error al eliminar evento", "error");
      }
    });
  });

  // === 🔒 CERRAR SESIÓN ===
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      showConfirmAlert("¿Deseas cerrar sesión?", () => {
        localStorage.clear();
        sessionStorage.clear();
        showCustomAlert("👋 Sesión cerrada correctamente", "success");
        setTimeout(() => (window.location.href = "/pages/auth/login/login.html"), 1200);
      });
    });
  }
});
