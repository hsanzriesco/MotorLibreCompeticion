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

		document.getElementById("eventId").value = eventData.id || "";
		document.getElementById("title").value = eventData.title || "";
		document.getElementById("description").value = eventData.description || "";
		document.getElementById("location").value = eventData.location || "";
		document.getElementById("start").value = eventData.start
			? eventData.start.slice(0, 16)
			: "";
		document.getElementById("end").value = eventData.end
			? eventData.end.slice(0, 16)
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

		// Convertir imagen a Base64
		let image_base64 = null;
		if (imageFile) {
			image_base64 = await toBase64(imageFile);
		}

		try {
			const res = await fetch(`/api/events${id ? `?id=${id}` : ""}`, {
				method: id ? "PUT" : "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ title, description, location, start, end, image_base64 }),
			});

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

	function toBase64(file) {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.readAsDataURL(file);
			reader.onload = () => resolve(reader.result);
			reader.onerror = reject;
		});
	}

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

// === SISTEMA DE NOTIFICACIONES ===
function mostrarMensaje(texto, tipo = "info") {
	const toastContainer = document.getElementById("toast-container");

	const colores = {
		success: "bg-success text-white",
		error: "bg-danger text-white",
		warning: "bg-warning text-dark",
		info: "bg-secondary text-white",
	};

	const iconos = {
		success: "bi bi-check-circle-fill",
		error: "bi bi-x-circle-fill",
		warning: "bi bi-exclamation-triangle-fill",
		info: "bi bi-info-circle-fill",
	};

	const toast = document.createElement("div");
	toast.className = `toast align-items-center border-0 fade show ${colores[tipo] || colores.info}`;
	toast.setAttribute("role", "alert");
	toast.setAttribute("aria-live", "assertive");
	toast.setAttribute("aria-atomic", "true");

	toast.innerHTML = `
		<div class="d-flex p-2">
			<i class="${iconos[tipo] || iconos.info} me-2 fs-5"></i>
			<div class="toast-body fw-semibold">${texto}</div>
			<button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
		</div>
	`;

	toastContainer.appendChild(toast);

	setTimeout(() => {
		toast.classList.remove("show");
		toast.classList.add("hide");
		setTimeout(() => toast.remove(), 400);
	}, 3500);
}
