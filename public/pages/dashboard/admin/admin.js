document.addEventListener("DOMContentLoaded", async () => {
  // === 🚫 VERIFICAR SESIÓN ===
  const usuario =
    JSON.parse(localStorage.getItem("usuario")) ||
    JSON.parse(sessionStorage.getItem("usuario"));
  if (!usuario || usuario.role !== "admin") {
    showAlert("❌ Acceso denegado. Inicia sesión como administrador.", "danger");
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

  // === ✨ ALERTA SIMPLE Y BONITA ===
  function showAlert(message, type = "success") {
    const alert = document.createElement("div");
    alert.className = `simple-alert ${type}`;
    alert.textContent = message;
    document.body.appendChild(alert);

    setTimeout(() => alert.classList.add("show"), 50);
    setTimeout(() => {
      alert.classList.remove("show");
      setTimeout(() => alert.remove(), 300);
    }, 3000);
  }

  // === ⚠️ CONFIRMACIÓN SIMPLE ===
  function showConfirm(message, onConfirm) {
    const confirmBox = document.createElement("div");
    confirmBox.className = "confirm-overlay";
    confirmBox.innerHTML = `
      <div class="confirm-box">
        <p>${message}</p>
        <div class="d-flex justify-content-center gap-2 mt-3">
          <button class="btn btn-danger btn-sm" id="yesBtn">Sí</button>
          <button class="btn btn-secondary btn-sm" id="noBtn">No</button>
        </div>
      </div>
    `;
    document.body.appendChild(confirmBox);

    confirmBox.querySelector("#noBtn").addEventListener("click", () => confirmBox.remove());
    confirmBox.querySelector("#yesBtn").addEventListener("click", () => {
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
      showAlert("Error al cargar los eventos", "danger");
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
      showAlert("Por favor completa todos los campos obligatorios", "danger");
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

      showAlert(id ? "Evento actualizado correctamente" : "Evento creado con éxito");
      eventModal.hide();
      calendar.refetchEvents();
    } catch {
      showAlert("Error al guardar evento", "danger");
    }
  });

  // === 🗑️ ELIMINAR EVENTO ===
  deleteEventBtn.addEventListener("click", async () => {
    if (!selectedEvent || !selectedEvent.id) {
      showAlert("No hay evento seleccionado", "danger");
      return;
    }

    showConfirm("¿Seguro que deseas eliminar este evento?", async () => {
      try {
        const res = await fetch(`/api/events?id=${selectedEvent.id}`, { method: "DELETE" });
        const data = await res.json();
        if (!data.success) throw new Error();

        showAlert("Evento eliminado correctamente");
        eventModal.hide();
        calendar.refetchEvents();
      } catch {
        showAlert("Error al eliminar evento", "danger");
      }
    });
  });

  // === 🔒 CERRAR SESIÓN ===
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      showConfirm("¿Deseas cerrar sesión?", () => {
        localStorage.clear();
        sessionStorage.clear();
        showAlert("Sesión cerrada correctamente");
        setTimeout(() => (window.location.href = "/pages/auth/login/login.html"), 1200);
      });
    });
  }
});
