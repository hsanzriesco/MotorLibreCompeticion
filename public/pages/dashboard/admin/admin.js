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
	let selectedDate = null;

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
				selectedDate = info.startStr.split("T")[0];
				openModal({
					id: "",
					title: "",
					description: "",
					location: "",
					start: `${selectedDate}T00:00`,
					end: `${selectedDate}T01:00`,
					image_url: "",
				});
			},

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

		if (selectedDate) {
			startInput.type = "time";
			endInput.type = "time";
			startInput.value = "";
			endInput.value = "";
		} else {
			startInput.type = "datetime-local";
			endInput.type = "datetime-local";
			startInput.value = eventData.start ? eventData.start.slice(0, 16) : "";
			endInput.value = eventData.end ? eventData.end.slice(0, 16) : "";
		}

		deleteBtn.style.display = eventData.id ? "inline-block" : "none";
		eventModal.show();
	}

	saveBtn.addEventListener("click", async () => {
		const id = document.getElementById("eventId").value;
		const title = document.getElementById("title").value.trim();
		const description = document.getElementById("description").value.trim();
		const location = document.getElementById("location").value.trim();
		let startTime = document.getElementById("start").value;
		let endTime = document.getElementById("end").value;

		if (!title || !startTime || !endTime) {
			alert("⚠️ Completa todos los campos obligatorios.");
			return;
		}

		let start = startTime.includes("T")
			? startTime
			: `${selectedDate}T${startTime}`;
		let end = endTime.includes("T") ? endTime : `${selectedDate}T${endTime}`;

		// 🔄 Enviar JSON en lugar de FormData
		const body = JSON.stringify({
			title,
			description,
			location,
			start,
			end,
			image_base64: null,
		});

		try {
			let res;
			if (id) {
				res = await fetch(`/api/events/${id}`, {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body,
				});
			} else {
				res = await fetch("/api/events", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body,
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
