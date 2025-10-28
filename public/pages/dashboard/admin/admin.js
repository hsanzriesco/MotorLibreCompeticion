document.addEventListener("DOMContentLoaded", () => {
  const usuario = JSON.parse(localStorage.getItem("usuario"));
  if (!usuario || usuario.role !== "admin") {
    alert("❌ Acceso denegado");
    window.location.href = "/index.html";
  }

  const logoutBtn = document.getElementById("logoutBtn");
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("usuario");
    window.location.href = "/pages/auth/login/login.html";
  });

  const calendarEl = document.getElementById("calendar");
  const modal = new bootstrap.Modal(document.getElementById("eventModal"));
  const form = document.getElementById("eventForm");
  const preview = document.getElementById("preview");

  let selectedEvent = null;

  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    selectable: true,
    editable: true,
    locale: "es",

    events: async (info, success, fail) => {
      try {
        const res = await fetch("/api/events");
        const data = await res.json();
        if (data.success) success(data.data);
        else fail();
      } catch (e) {
        console.error(e);
        fail(e);
      }
    },

    select: (info) => {
      selectedEvent = null;
      form.reset();
      preview.classList.add("d-none");
      document.getElementById("eventId").value = "";
      document.getElementById("start").value = info.startStr.slice(0, 16);
      document.getElementById("end").value = info.endStr.slice(0, 16);
      modal.show();
    },

    eventClick: (info) => {
      selectedEvent = info.event;
      const props = selectedEvent.extendedProps;

      document.getElementById("eventId").value = selectedEvent.id;
      document.getElementById("title").value = selectedEvent.title;
      document.getElementById("description").value = props.description || "";
      document.getElementById("location").value = props.location || "";
      document.getElementById("start").value = selectedEvent.startStr.slice(0, 16);
      document.getElementById("end").value = selectedEvent.endStr.slice(0, 16);

      if (props.image_base64) {
        preview.src = props.image_base64;
        preview.classList.remove("d-none");
      } else {
        preview.classList.add("d-none");
      }

      modal.show();
    },
  });

  calendar.render();

  // Guardar evento
  document.getElementById("saveBtn").addEventListener("click", async () => {
    const id = document.getElementById("eventId").value;
    const title = document.getElementById("title").value.trim();
    const description = document.getElementById("description").value.trim();
    const location = document.getElementById("location").value.trim();
    const start = document.getElementById("start").value;
    const end = document.getElementById("end").value;
    const imageFile = document.getElementById("image").files[0];

    let image_base64 = selectedEvent?.extendedProps?.image_base64 || null;
    if (imageFile) {
      image_base64 = await toBase64(imageFile);
    }

    const payload = { id, title, description, location, start, end, image_base64 };

    const method = id ? "PUT" : "POST";
    const res = await fetch("/api/events", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (data.success) {
      calendar.refetchEvents();
      modal.hide();
    } else {
      alert("❌ Error: " + data.message);
    }
  });

  // Eliminar evento
  document.getElementById("deleteBtn").addEventListener("click", async () => {
    const id = document.getElementById("eventId").value;
    if (!id) return alert("⚠️ No hay evento seleccionado");

    if (confirm("¿Seguro que deseas eliminar este evento?")) {
      await fetch(`/api/events?id=${id}`, { method: "DELETE" });
      calendar.refetchEvents();
      modal.hide();
    }
  });

  // Imagen → vista previa
  document.getElementById("image").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      preview.src = reader.result;
      preview.classList.remove("d-none");
    };
    reader.readAsDataURL(file);
  });

  function toBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
    });
  }
});
