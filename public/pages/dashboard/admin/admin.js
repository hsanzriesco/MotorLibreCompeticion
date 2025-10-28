document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ Admin panel cargado");

  const usuario = JSON.parse(localStorage.getItem("usuario"));
  if (!usuario || usuario.role !== "admin") {
    alert("❌ Acceso denegado. Solo administradores.");
    window.location.href = "/index.html";
    return;
  }

  const modalEl = document.getElementById("eventModal");
  const modal = new bootstrap.Modal(modalEl);
  const saveBtn = document.getElementById("saveEventBtn");
  const deleteBtn = document.getElementById("deleteEventBtn");
  const nuevoEventoBtn = document.getElementById("nuevoEventoBtn");
  const previewImg = document.getElementById("previewImg");

  const form = {
    id: document.getElementById("eventId"),
    title: document.getElementById("title"),
    description: document.getElementById("description"),
    location: document.getElementById("location"),
    start: document.getElementById("startDate"),
    end: document.getElementById("endDate"),
    image: document.getElementById("image"),
  };

  // Vista previa de imagen
  form.image.addEventListener("change", () => {
    const file = form.image.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        previewImg.src = e.target.result;
        previewImg.style.display = "block";
      };
      reader.readAsDataURL(file);
    }
  });

  // --- FullCalendar ---
  const calendarEl = document.getElementById("calendar");
  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    locale: "es",
    selectable: true,
    editable: true,
    eventColor: "#e50914",

    events: async (info, success, fail) => {
      try {
        const res = await fetch("/api/events");
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          success(
            data.data.map((e) => ({
              id: e.id,
              title: e.title,
              start: e.start,
              end: e.end,
              extendedProps: {
                description: e.description,
                location: e.location,
                image: e.image_base64 || null,
              },
            }))
          );
        } else success([]);
      } catch (err) {
        console.error("Error al cargar eventos:", err);
        fail(err);
      }
    },

    select: (info) => openModalForCreate(info.startStr, info.endStr),
    eventClick: (info) => openModalForEdit(info.event),
  });

  calendar.render();

  // --- Funciones ---
  function openModalForCreate(start, end) {
    resetForm();
    form.start.value = toInputDate(start);
    form.end.value = toInputDate(end);
    deleteBtn.style.display = "none";
    modal.show();
  }

  function openModalForEdit(event) {
    resetForm();
    form.id.value = event.id;
    form.title.value = event.title;
    form.description.value = event.extendedProps.description || "";
    form.location.value = event.extendedProps.location || "";
    form.start.value = toInputDate(event.start);
    form.end.value = toInputDate(event.end);
    if (event.extendedProps.image) {
      previewImg.src = event.extendedProps.image;
      previewImg.style.display = "block";
    }
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
    form.image.value = "";
    previewImg.style.display = "none";
  }

  function toInputDate(date) {
    const d = new Date(date);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  async function getBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // --- Guardar evento ---
  saveBtn.addEventListener("click", async () => {
    const payload = {
      id: form.id.value,
      title: form.title.value.trim(),
      description: form.description.value.trim(),
      location: form.location.value.trim(),
      start: form.start.value,
      end: form.end.value,
    };

    if (form.image.files[0]) {
      payload.image_base64 = await getBase64(form.image.files[0]);
    }

    const method = payload.id ? "PUT" : "POST";

    try {
      const res = await fetch("/api/events", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        modal.hide();
        calendar.refetchEvents();
      } else {
        alert("❌ Error: " + data.message);
      }
    } catch (err) {
      console.error("Error al guardar:", err);
    }
  });

  // --- Eliminar evento ---
  deleteBtn.addEventListener("click", async () => {
    if (!confirm("¿Eliminar este evento permanentemente?")) return;

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

  // --- Nuevo evento desde botón superior ---
  nuevoEventoBtn.addEventListener("click", () => {
    const now = new Date();
    openModalForCreate(now, new Date(now.getTime() + 3600000));
  });

  // --- Logout ---
  document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("usuario");
    window.location.href = "/pages/auth/login/login.html";
  });
});
