document.addEventListener("DOMContentLoaded", async () => {
  const calendarEl = document.getElementById("calendar");
  const eventModal = new bootstrap.Modal(document.getElementById("eventModal"));
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

  // === 🟢 1. Cargar eventos desde el servidor ===
  async function fetchEvents() {
    try {
      const res = await fetch("/api/events");
      if (!res.ok) throw new Error("Error al obtener eventos");
      const json = await res.json();

      // Asegurar que sea un array de eventos
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
      console.error("Error al cargar eventos:", error);
      return [];
    }
  }

  // === 🗓️ 2. Inicializar FullCalendar ===
  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    selectable: true,
    height: "auto",
    locale: "es",

    select: (info) => {
      selectedEvent = null;
      form.reset();

      // Establecer fecha seleccionada sin permitir modificarla (solo hora)
      const date = info.startStr.split("T")[0];
      startInput.value = `${date}T00:00`;
      endInput.value = `${date}T00:00`;
      startInput.readOnly = true;
      endInput.readOnly = false;

      eventModal.show();
    },

    eventClick: (info) => {
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
      eventModal.show();
    },

    events: async (info, successCallback) => {
      const events = await fetchEvents();
      successCallback(events);
    },
  });

  calendar.render();

  // === 🧠 3. Función para mostrar mensaje tipo "bienvenido" ===
  function showMessage(text, type = "success") {
    const messageBox = document.createElement("div");
    messageBox.className = `alert alert-${type} text-center fixed-top mt-3 mx-auto`;
    messageBox.style.width = "fit-content";
    messageBox.style.zIndex = "9999";
    messageBox.textContent = text;
    document.body.appendChild(messageBox);
    setTimeout(() => messageBox.remove(), 3000);
  }

  // === 🔴 4. Eliminar evento ===
  deleteEventBtn.addEventListener("click", async () => {
    if (!selectedEvent) {
      showMessage("No hay evento seleccionado", "danger");
      return;
    }

    if (!confirm("¿Seguro que deseas eliminar este evento?")) return;

    try {
      const res = await fetch(`/api/events?id=${selectedEvent.id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Error al eliminar el evento");

      showMessage("✅ Evento eliminado correctamente");
      calendar.refetchEvents();
      eventModal.hide();
    } catch (error) {
      console.error("❌ Error al eliminar evento:", error);
      showMessage("Error al eliminar evento", "danger");
    }
  });

  // === 💾 5. Guardar (crear/editar) evento ===
  saveEventBtn.addEventListener("click", async () => {
    const title = titleInput.value.trim();
    const description = descriptionInput.value.trim();
    const location = locationInput.value.trim();
    const start = startInput.value;
    const end = endInput.value;
    const id = eventIdInput.value;

    if (!title || !start || !end) {
      showMessage("Por favor completa todos los campos obligatorios", "danger");
      return;
    }

    let image_base64 = null;
    if (imageInput.files.length > 0) {
      const file = imageInput.files[0];
      image_base64 = await toBase64(file);
    }

    const payload = {
      title,
      description,
      location,
      start,
      end,
      image_base64,
    };

    try {
      const res = await fetch(id ? `/api/events?id=${id}` : "/api/events", {
        method: id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`Error ${res.status}`);
      const result = await res.json();

      if (!result.success) throw new Error(result.message);

      showMessage(id ? "✅ Evento actualizado" : "✅ Evento creado");
      calendar.refetchEvents();
      eventModal.hide();
    } catch (error) {
      console.error("❌ Error al guardar evento:", error);
      showMessage("Error al guardar evento", "danger");
    }
  });

  // === 🧩 Convertir imagen a Base64 ===
  function toBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  }
});
