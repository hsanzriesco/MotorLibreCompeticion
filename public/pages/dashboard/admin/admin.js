document.addEventListener("DOMContentLoaded", () => {
	// ==== VERIFICAR ADMIN ====
	const usuario = JSON.parse(sessionStorage.getItem("usuario"));
	if (!usuario || usuario.role !== "admin") {
		alert("❌ Acceso denegado. Solo administradores pueden acceder.");
		window.location.href = "/pages/auth/login/login.html";
		return;
	}

	// ==== BOTÓN CERRAR SESIÓN ====
	const logoutBtn = document.getElementById("logout-btn");
	if (logoutBtn) {
		logoutBtn.addEventListener("click", (e) => {
			e.preventDefault();
			sessionStorage.removeItem("usuario");
			window.location.href = "/pages/auth/login/login.html";
		});
	}

	// ==== CALENDARIO ====
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

			// === Cargar eventos desde la API ===
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

			// === Seleccionar día para nuevo evento ===
			select: (info) => {
				const selectedDate = info.startStr.split("T")[0]; // Solo la fecha
				openModal({
					id: "",
					title: "",
					description: "",
					location: "",
					start: `${selectedDate}T`, // Fecha seleccionada sin hora
					end: `${selectedDate}T`,
					image_url: "",
				});
			},

			// === Clic en evento existente ===
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

	// ==== MODAL ====
	const eventModal = new bootstrap.Modal(document.getElementById("eventModal"));
	const saveBtn = document.getElementById("saveEventBtn");
	const deleteBtn = document.getElementById("deleteEventBtn");

	function openModal(eventData) {
		selectedEvent = eventData;

		document.getElementById("eventId").value = eventData.id || "";
		document.getElementById("title").value = eventData.title || "";
		document.getElementById("description").value = eventData.description || "";
		document.getElementById("location").value = eventData.location || "";

		document.getElementById("start").value =
			eventData.start && eventData.start.includes("T")
				? eventData.start.slice(0, 16)
				: eventData.start
				? `${eventData.start}T`
				: "";

		document.getElementById("end").value =
			eventData.end && eventData.end.includes("T")
				? eventData.end.slice(0, 16)
				: eventData.end
				? `${eventData.end}T`
				: "";

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
		const imageFile = document.getElementById("image").files[0];

		if (!title || !start || !end) {
			alert("⚠️ Completa todos los campos obligatorios.");
			return;
		}

		const formData = new FormData();
		formData.append("title", title);
		formData.append("description", description);
		formData.append("location", location);
		formData.append("start", start);
		formData.append("end", end);
		if (imageFile) formData.append("image", imageFile);

		try {
			let res;
			if (id) {
				// 🔁 ACTUALIZAR EVENTO
				res = await fetch(`/api/events/${id}`, {
					method: "PUT",
					body: formData,
				});
			} else {
				// ➕ CREAR EVENTO
				res = await fetch("/api/events", {
					method: "POST",
					body: formData,
				});
			}

			const data = await res.json();
			if (data.success) {
				alert(id ? "✅ Evento actualizado correctamente." : "✅ Evento creado correctamente.");
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
			const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
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
