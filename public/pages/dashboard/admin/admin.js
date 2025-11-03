document.addEventListener("DOMContentLoaded", () => {
	// ==== FUNCIÓN DE ALERTAS PERSONALIZADAS ====
	function showCustomAlert(message, type = "success") {
		const alertContainer = document.createElement("div");
		alertContainer.className = `custom-alert ${type}`;
		alertContainer.innerHTML = `
			<div class="alert-content">
				${type === "success" ? "✅" : type === "error" ? "❌" : "⚠️"}
				<span>${message}</span>
			</div>
		`;
		document.body.appendChild(alertContainer);

		setTimeout(() => {
			alertContainer.classList.add("visible");
		}, 50);

		setTimeout(() => {
			alertContainer.classList.remove("visible");
			setTimeout(() => alertContainer.remove(), 400);
		}, 3500);
	}

	// ==== VERIFICAR ADMIN ====
	const usuario = JSON.parse(sessionStorage.getItem("usuario"));
	if (!usuario || usuario.role !== "admin") {
		showCustomAlert("Acceso denegado. Solo administradores pueden acceder.", "error");
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
				openModal({
					id: "",
					title: "",
					description: "",
					location: "",
					start: info.startStr,
					end: info.endStr,
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

	// ==== MODAL ====
	const eventModal = new bootstrap.Modal(document.getElementById("eventModal"));
	const saveBtn = document.getElementById("saveEventBtn");
	const deleteBtn = document.getElementById("deleteEventBtn");

	function openModal(eventData) {
		selectedEvent = eventData;

		const selectedDate = new Date(eventData.start);
		const formattedDate = selectedDate.toISOString().split("T")[0]; // YYYY-MM-DD

		document.getElementById("eventId").value = eventData.id || "";
		document.getElementById("title").value = eventData.title || "";
		document.getElementById("description").value = eventData.description || "";
		document.getElementById("location").value = eventData.location || "";
		document.getElementById("start-date").value = formattedDate;
		document.getElementById("end-date").value = formattedDate;
		document.getElementById("start-time").value = "";
		document.getElementById("end-time").value = "";

		deleteBtn.style.display = eventData.id ? "inline-block" : "none";
		eventModal.show();
	}

	// ==== GUARDAR / ACTUALIZAR EVENTO ====
	saveBtn.addEventListener("click", async () => {
		const id = document.getElementById("eventId").value;
		const title = document.getElementById("title").value.trim();
		const description = document.getElementById("description").value.trim();
		const location = document.getElementById("location").value.trim();
		const startDate = document.getElementById("start-date").value;
		const endDate = document.getElementById("end-date").value;
		const startTime = document.getElementById("start-time").value;
		const endTime = document.getElementById("end-time").value;
		const imageFile = document.getElementById("image").files[0];

		if (!title || !startDate || !startTime || !endTime) {
			showCustomAlert("Completa todos los campos obligatorios.", "warning");
			return;
		}

		const start = `${startDate}T${startTime}`;
		const end = `${endDate}T${endTime}`;
		const payload = { title, description, location, start, end };

		try {
			const res = await fetch(`/api/events${id ? `?id=${id}` : ""}`, {
				method: id ? "PUT" : "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});

			const data = await res.json();

			if (data.success) {
				showCustomAlert(id ? "✅ Evento actualizado correctamente." : "✅ Evento creado correctamente.", "success");
				eventModal.hide();
				calendar.refetchEvents();
			} else {
				showCustomAlert("❌ Error: " + data.message, "error");
			}
		} catch (err) {
			console.error("❌ Error al guardar evento:", err);
			showCustomAlert("❌ Error al guardar evento.", "error");
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
				showCustomAlert("🗑️ Evento eliminado correctamente.", "success");
				eventModal.hide();
				calendar.refetchEvents();
			} else {
				showCustomAlert("❌ Error al eliminar evento: " + data.message, "error");
			}
		} catch (err) {
			console.error("❌ Error al eliminar evento:", err);
			showCustomAlert("❌ Error de conexión al eliminar evento.", "error");
		}
	});
});
