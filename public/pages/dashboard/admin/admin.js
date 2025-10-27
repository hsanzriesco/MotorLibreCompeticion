let calendar;
let selectedInfo = null;

document.addEventListener("DOMContentLoaded", async () => {
  const usuario = JSON.parse(localStorage.getItem("usuario"));
  if (!usuario) {
    alert("❌ Debes iniciar sesión.");
    window.location.href = "/pages/auth/login/login.html";
    return;
  }

  initCalendar(usuario.role);
  if (usuario.role === "admin") loadUsers();
});

function initCalendar(role) {
  const calendarEl = document.getElementById("calendar");
  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    selectable: role === "admin",
    events: "/api/events",
    eventClick: (info) => showEventModal(info.event, role),
    select: role === "admin" ? (info) => openCreateModal(info) : null,
  });
  calendar.render();
}

function openCreateModal(info) {
  selectedInfo = info;
  document.getElementById("eventForm").reset();
  document.getElementById("eventForm").style.display = "block";
  document.getElementById("viewEventInfo").style.display = "none";
  document.getElementById("saveEventBtn").style.display = "inline-block";
  const modal = new bootstrap.Modal(document.getElementById("eventModal"));
  modal.show();
}

async function showEventModal(event, role) {
  const modal = new bootstrap.Modal(document.getElementById("eventModal"));
  document.getElementById("eventForm").style.display = "none";
  document.getElementById("viewEventInfo").style.display = "block";
  document.getElementById("saveEventBtn").style.display = "none";

  document.getElementById("vTitle").textContent = event.title;
  document.getElementById("vDescription").textContent = event.extendedProps.description || "Sin descripción";
  document.getElementById("vLocation").textContent = event.extendedProps.location || "No especificado";
  document.getElementById("vStart").textContent = event.startStr;
  document.getElementById("vEnd").textContent = event.endStr;

  modal.show();
}

document.getElementById("saveEventBtn").addEventListener("click", async () => {
  const data = {
    title: document.getElementById("title").value.trim(),
    description: document.getElementById("description").value.trim(),
    location: document.getElementById("location").value.trim(),
    start: document.getElementById("startDate").value,
    end: document.getElementById("endDate").value,
  };

  if (!data.title || !data.start || !data.end) return alert("Completa todos los campos.");

  const res = await fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const result = await res.json();

  if (result.success) {
    alert("✅ Evento creado correctamente");
    calendar.refetchEvents();
    bootstrap.Modal.getInstance(document.getElementById("eventModal")).hide();
  } else {
    alert("❌ Error al guardar evento");
  }
});

async function loadUsers() {
  const res = await fetch("/api/usersList");
  const data = await res.json();
  const container = document.getElementById("usersList");
  if (data.success) {
    container.innerHTML = data.users
      .map((u) => `<div><strong>${u.name}</strong> - ${u.email} (${u.role})</div>`)
      .join("");
  }
}

function cerrarSesion() {
  localStorage.removeItem("usuario");
  window.location.href = "/pages/auth/login/login.html";
}
