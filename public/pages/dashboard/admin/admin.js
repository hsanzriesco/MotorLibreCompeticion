document.addEventListener("DOMContentLoaded", async () => {
  console.log("✅ Admin.js cargado correctamente");

  const calendarEl = document.getElementById("calendar");
  if (!calendarEl) {
    console.error("❌ No se encontró el elemento #calendar");
    return;
  }

  const eventModalEl = document.getElementById("eventModal");
  if (!eventModalEl) {
    console.error("❌ No se encontró el modal con id #eventModal");
    return;
  }

  const eventModal = new bootstrap.Modal(eventModalEl);
  const form = document.getElementById("eventForm");

  const titleInput = document.getElementById("title");
  const descriptionInput = document.getElementById("description");
  const locationInput = document.getElementById("location");
  const startInput = document.getElementById("start");
  const endInput = document.getElementById("end");
  const imageInput = document.getElementById("image");
  const eventIdInput = document.getElementById("eventId");

  const saveEventBtn = document.getElementById("saveEventBtn");
  const deleteEventBtn = document.getElementById("deleteEventBtn");

  let selectedEvent = null;

  // === 🟢 1. Obtener eventos del servidor ===
  async function fetchEvents() {
    try {
      const res = await fetch("/api/events");
      if (!res.ok) throw new Error("Error al obtener eventos");
      const json = await res.json();

      if (!json.success || !Array.isArray(json.data)) {
        throw new Error("La respuesta del servidor no es válida");
      }

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
    } catch (error) {
      console.error("❌ Error al cargar eventos:", error);
      return [];
    }
  }

  // === 2️⃣ Inicializar calendario ===
  console.log("🗓️ Inicializando FullCalendar...");
  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    selectable: true,
    editable: false,
    height: "auto",
    locale: "es",

    // 🔹 Cuando seleccionas un día vacío
    select: (info) => {
      console.log("📅 Día seleccionado:", info.startStr);
      selectedEvent = null;
      form.reset();

      const date = info.startStr.split("T")[0];
      startInput.value = `${date}T00:00`;
      endInput.value = `${date}T00:00`;
      startInput.readOnly = true;
      endInput.readOnly = false;

      eventIdInput.value = "";
      deleteEventBtn.style.display = "none";

      eventModal.show();
      console.log("✅ Modal abierto para nuevo evento");
    },

    // 🔹 Cuando haces clic en un evento existente
    eventClick: (info) => {
      console.log("📝 Evento seleccionado:", info.event.id);
      const event = info.event;
      selectedEvent = event;

      eventIdInput.value = event.id;
      titleInput.value = event.title;
      descriptionInput.value = event.extendedProps.description || "";
      locationInput.value = event.extendedProps.location || "";
      startInput.value = event.start
        ? new Date(event.start).toISOString().slice(0, 16)
        : "";
      endInput.value = event.end
        ? new Date(event.end).toISOString().slice(0, 16)
        : "";

      startInput.readOnly = true;
      endInput.readOnly = false;

      deleteEventBtn.style.display = "inline-block";
      eventModal.show();
    },

    events: async (info, successCallback) => {
      const events = await fetchEvents();
      successCallback(events);
    },
  });

  calendar.render();
  console.log("✅ Calendario renderizado correctamente");

  // === 💬 Mensajes de éxito/error ===
  function showMessage(text, type = "success") {
    const messageBox = document.createElement("div");
    messageBox.className = `alert alert-${type} text-center position-fixed top-0 start-50 translate-middle-x mt-3`;
    messageBox.style.zIndex = "2000";
    messageBox.style.width = "fit-content";
    messageBox.textContent = text;
    document.body.appendChild(messageBox);
    setTimeout(() => messageBox.remove(), 3000);
  }

  // === 🗑️ Eliminar evento ===
  deleteEventBtn.addEventListener("click", async () => {
    if (!selectedEvent || !selectedEvent.id) {
      showMessage("No hay evento seleccionado", "danger");
      return;
    }

    if (!confirm("¿Seguro que deseas eliminar este evento?")) return;

    try {
      const res = await fetch(`/api/events?id=${selectedEvent.id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Error al eliminar el evento");
      const data = await res.json();

      if (!data.success) throw new Error(data.message);

      showMessage("🗑️ Evento eliminado correctamente");
      eventModal.hide();
      calendar.refetchEvents();
    } catch (error) {
      console.error("❌ Error al eliminar evento:", error);
      showMessage("Error al eliminar evento", "danger");
    }
  });

  // === 💾 Guardar evento ===
  saveEventBtn.addEventListener("click", async () => {
    const id = eventIdInput.value;
    const title = titleInput.value.trim();
    const description = descriptionInput.value.trim();
    const location = locationInput.value.trim();
    const start = startInput.value;
    const end = endInput.value;

    if (!title || !start || !end) {
      showMessage("Por favor completa todos los campos", "danger");
      return;
    }

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

      if (!res.ok) throw new Error("Error al guardar evento");
      const data = await res.json();

      if (!data.success) throw new Error(data.message);

      showMessage(id ? "✅ Evento actualizado" : "✅ Evento creado");
      eventModal.hide();
      calendar.refetchEvents();
    } catch (error) {
      console.error("❌ Error al guardar evento:", error);
      showMessage("Error al guardar evento", "danger");
    }
  });

  // === 📷 Convertir imagen a Base64 ===
  function toBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  }
});
