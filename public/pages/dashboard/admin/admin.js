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
	let selectedDate = null; // Guardamos la fecha seleccionada

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
				selectedDate = info.startStr.split("T")[0]; // Solo la fecha
				openModal({
					id: "",
					title: "",
					description: "",
					location: "",
					start: `${selectedDate}T00:00`, // Fecha seleccionada sin hora
					end: `${selectedDate}T01:00`,
					image_url: "",
				});
			},

			// === Clic en evento existente ===
			eventClick: (info) => {
				const e = info.event;
				selectedDate = e.startStr.split("T")[0];
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

		const eventIdInput = document.getElementById("eventId");
		const titleInput = document.getElementById("title");
		const descriptionInput = document.getElementById("description");
		const locationInput = document.getElementById("location");
		const startInput = document.getElementById("start");
		const endInput = document.getElementById("end");

		eventIdInput.value = eventData.id || "";
		titleInput.value = eventData.title || "";
		descriptionInput.value = eventData.description || "";
		locationInput.value = eventData.location || "";

		// Mostrar solo las horas, no la fecha (fecha fijada)
		if (selectedDate) {
			startInput.type = "time";
			endInput.type = "time";

			// Limpiamos la hora por defecto
			startInput.value = "";
			endInput.value = "";
		} else {
			// Si se abre para editar evento existente
			startInput.type = "datetime-local";
			endInput.type = "datetime-local";
			startInput.value = eventData.start ? eventData.start.slice(0, 16) : "";
			endInput.value = eventData.end ? eventData.end.slice(0, 16) : "";
		}

		deleteBtn.style.display = eventData.id ? "inline-block" : "none";
		eventModal.show();
	}

	// ==== GUARDAR / ACTUALIZAR EVENTO ====
	saveBtn.addEventListener("click", async () => {
		const id = document.getElementById("eventId").value;
		const title = document.getElementById("title").value.trim();
		const description = document.getElementById("description").value.trim();
		const location = document.getElementById("location").value.trim();
		let startTime = document.getElementById("start").value;
		let endTime = document.getElementById("end").value;
		const imageFile = document.getElementById("image").files[0];

		if (!title || !startTime || !endTime) {
			alert("⚠️ Completa todos los campos obligatorios.");
			return;
		}

		// Si se seleccionó un día, concatenamos la fecha fija
		let start = startTime.includes("T")
			? startTime
			: `${selectedDate}T${startTime}`;
		let end = endTime.includes("T") ? endTime : `${selectedDate}T${endTime}`;

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
				res = await fetch(`/api/events/${id}`, {
					method: "PUT",
					body: formData,
				});
			} else {
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
