document.addEventListener("DOMContentLoaded", () => {
	const usuario = JSON.parse(sessionStorage.getItem("usuario"));
	if (!usuario || usuario.role !== "admin") {
		alert("❌ Acceso denegado. Solo administradores pueden acceder.");
		window.location.href = "/pages/auth/login/login.html";
		return;
	}

	const logoutBtn = document.getElementById("logout-btn");
	if (logoutBtn) {
		logoutBtn.addEventListener("click", (e) => {
			e.preventDefault();
			sessionStorage.removeItem("usuario");
			window.location.href = "/pages/auth/login/login.html";
		});
	}

	const calendarEl = document.getElementById("calendar");
	let calendar;
	let selectedEvent = null;

	if (calendarEl) {
		calendar = new FullCalendar.Calendar(calendarEl, {
			initialView: "dayGridMonth",
			locale: "es",
			selectable: true,
			editable: false,
			height: "auto",

			events: async (fetchInfo, successCallback, failureCallback) => {
				try {
					const res = await fetch("/api/events");
					const data = await res.json();
					if (data.success) {
						successCallback(data.data);
					} else {
						console.warn("⚠️ No se encontraron eventos");
						successCallback([]);
					}
				} catch (err) {
					console.error("❌ Error al cargar eventos:", err);
					failureCallback(err);
				}
			},

			select: (info) => {
				// Fecha seleccionada
				const selectedDate = new Date(info.startStr);
				const formattedDate = selectedDate.toISOString().split("T")[0]; // YYYY-MM-DD

				openModal({
					id: "",
					title: "",
					description: "",
					location: "",
					start: `${formattedDate}T`, // Se muestra la fecha, tú eliges la hora
					end: `${formattedDate}T`,
					image_url: "",
				});
			},

			eventClick: (info) => {
				const e = info.event;
				openModal({
					id: e.id,
					title: e.title,
					description: e.extendedProps.description,
					location: e.extendedProps.location,
					start: e.startStr,
					end: e.endStr,
					image_url: e.extendedProps.image_url || "",
				});
			},
		});

		calendar.render();
	}

	const eventModal = new bootstrap.Modal(document.getElementById("eventModal"));
	const saveBtn = document.getElementById("saveEventBtn");
	const deleteBtn = document.getElementById("deleteEventBtn");

	function openModal(eventData) {
		selectedEvent = eventData;

		document.getElementById("eventId").value = eventData.id || "";
		document.getElementById("title").value = eventData.title || "";
		document.getElementById("description").value = eventData.description || "";
		document.getElementById("location").value = eventData.location || "";

		// Solo mostrar hora, no permitir cambiar la fecha
		const startDate = eventData.start ? eventData.start.slice(0, 10) : "";
		const startTime = eventData.start ? eventData.start.slice(11, 16) : "";
		const endTime = eventData.end ? eventData.end.slice(11, 16) : "";

		document.getElementById("start").value = `${startDate}T${startTime}`;
		document.getElementById("end").value = `${startDate}T${endTime}`;

		deleteBtn.style.display = eventData.id ? "inline-block" : "none";
		eventModal.show();
	}

	// ==== GUARDAR / ACTUALIZAR EVENTO ====
	saveBtn.addEventListener("click", async () => {
		const id = document.getElementById("eventId").value;
		const title = document.getElementById("title").value.trim();
		const description = document.getElementById("description").value.trim();
		const location = document.getElementById("location").value.trim();
		const start = document.getElementById("start").value;
		const end = document.getElementById("end").value;

		if (!title || !start || !end) {
			alert("⚠️ Completa todos los campos obligatorios.");
			return;
		}

		try {
			let res;
			if (id) {
				// Actualizar
				res = await fetch(`/api/events?id=${id}`, {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ title, description, location, start, end }),
				});
			} else {
				// Crear
				res = await fetch("/api/events", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ title, description, location, start, end }),
				});
			}

			const data = await res.json();
			if (data.success) {
				alert(id ? "✅ Evento actualizado." : "✅ Evento creado.");
				eventModal.hide();
				calendar.refetchEvents();
			} else {
				alert("❌ Error: " + data.message);
			}
		} catch (err) {
			console.error("❌ Error al guardar evento:", err);
			alert("❌ Error al guardar evento.");
		}
	});

	// ==== ELIMINAR EVENTO ====
	deleteBtn.addEventListener("click", async () => {
		const id = document.getElementById("eventId").value;
		if (!id) return;
		if (!confirm("⚠️ ¿Seguro que deseas eliminar este evento?")) return;

		try {
			const res = await fetch(`/api/events?id=${id}`, { method: "DELETE" });
			const data = await res.json();
			if (data.success) {
				alert("🗑️ Evento eliminado correctamente.");
				eventModal.hide();
				calendar.refetchEvents();
			} else {
				alert("❌ Error al eliminar evento: " + data.message);
			}
		} catch (err) {
			console.error("❌ Error al eliminar evento:", err);
			alert("❌ Error de conexión al eliminar evento.");
		}
	});
});
