document.addEventListener("DOMContentLoaded", async () => {

    // ===== VERIFICAR SESIÓN =====
    const storedUser = sessionStorage.getItem("usuario");

    let usuario = null;
    if (storedUser) {
        try {
            usuario = JSON.parse(storedUser);
        } catch (e) {
            console.error("Error al parsear usuario:", e);
        }
    }

    // DEBUG: ver qué role llega realmente
    console.log("DEBUG usuario cargado:", usuario);

    // ===== PERMITIR SOLO ADMIN =====
    if (!usuario || usuario.role?.toLowerCase() !== "admin") {
        sessionStorage.removeItem("usuario");
        alert("Acceso denegado. Inicia sesión como administrador.");
        setTimeout(() => {
            window.location.href = "/pages/auth/login/login.html";
        }, 1500);
        return;
    }

    // ===== ELEMENTOS =====
    const calendarEl = document.getElementById("calendar");
    const eventModalEl = document.getElementById("eventModal");
    if (!calendarEl || !eventModalEl) return;

    const eventModal = new bootstrap.Modal(eventModalEl);
    const form = document.getElementById("eventForm");

    const titleInput = document.getElementById("title");
    const descriptionInput = document.getElementById("description");
    const locationInput = document.getElementById("location");
    const startDateInput = document.getElementById("start-date");
    const startTimeInput = document.getElementById("start-time");
    const endTimeInput = document.getElementById("end-time");
    // ⭐ MODIFICADO: Asumo que ahora usarás un input de texto para la URL, NO un input de tipo file ⭐
    // Si tu HTML usa el ID 'image', deberías cambiarlo a tipo texto
    const imageURLInput = document.getElementById("image");
    const eventIdInput = document.getElementById("eventId");

    const saveEventBtn = document.getElementById("saveEventBtn");
    const deleteEventBtn = document.getElementById("deleteEventBtn");

    let selectedEvent = null;

    // ===== CONFIRMACIÓN (Sin cambios) =====
    function showConfirmAlert(message, onConfirm) {
        let confirmBox = document.getElementById("customConfirmContainer").querySelector(".custom-confirm");

        if (!confirmBox) {
            confirmBox = document.createElement("div");
            confirmBox.className = "custom-confirm";
            document.getElementById("customConfirmContainer").appendChild(confirmBox);
        }

        confirmBox.innerHTML = `
            <div class="confirm-content">
                <p>${message}</p>
                <div class="buttons">
                    <button id="confirmYes" class="btn btn-danger">Sí</button>
                    <button id="confirmNo" class="btn btn-secondary">No</button>
                </div>
            </div>
        `;
        confirmBox.classList.add("show");

        document.getElementById("confirmNo").onclick = () => {
            confirmBox.classList.remove("show");
            setTimeout(() => confirmBox.innerHTML = "", 300);
        };

        document.getElementById("confirmYes").onclick = () => {
            confirmBox.classList.remove("show");
            setTimeout(() => confirmBox.innerHTML = "", 300);
            onConfirm();
        };
    }

    // ===== CARGAR EVENTOS =====
    async function fetchEvents() {
        try {
            const res = await fetch("/api/events");
            const json = await res.json();
            if (!json.success || !Array.isArray(json.data)) throw new Error();
            return json.data.map((e) => ({
                id: e.id,
                title: e.title,
                start: e.start,
                end: e.end,
                extendedProps: {
                    description: e.description,
                    location: e.location,
                    image_url: e.image_url
                }
            }));
        } catch {
            alert("Error al cargar los eventos");
            return [];
        }
    }

    // ⭐ ELIMINADO: La función toBase64 ya no es necesaria ⭐
    // function toBase64(file) { ... }


    // ===== CALENDARIO =====
    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: "dayGridMonth",
        selectable: true,
        editable: false,
        height: "auto",
        locale: "es",

        select: (info) => {
            selectedEvent = null;
            form.reset();
            startDateInput.value = info.startStr.split("T")[0];
            eventIdInput.value = "";
            deleteEventBtn.style.display = "none";
            eventModal.show();
        },

        eventClick: (info) => {
            const event = info.event;
            selectedEvent = event;

            eventIdInput.value = event.id;
            titleInput.value = event.title;
            descriptionInput.value = event.extendedProps.description || "";
            locationInput.value = event.extendedProps.location || "";
            // ⭐ MODIFICADO: Carga el valor image_url en el input ⭐
            imageURLInput.value = event.extendedProps.image_url || "";

            if (event.start) {
                const startDate = new Date(event.start);
                startDateInput.value = startDate.toISOString().split("T")[0];
                startTimeInput.value = startDate.toTimeString().slice(0, 5);
            }

            if (event.end) {
                const endDate = new Date(event.end);
                endTimeInput.value = endDate.toTimeString().slice(0, 5);
            }

            deleteEventBtn.style.display = "inline-block";
            eventModal.show();
        },

        events: async (info, successCallback) => {
            const events = await fetchEvents();
            successCallback(events);
        }
    });

    calendar.render();

    // ===== GUARDAR EVENTO =====
    saveEventBtn.addEventListener("click", async () => {
        const id = eventIdInput.value;
        const title = titleInput.value.trim();
        const description = descriptionInput.value.trim();
        const location = locationInput.value.trim();
        const date = startDateInput.value;
        const startTime = startTimeInput.value;
        const endTime = endTimeInput.value;
        // ⭐ MODIFICADO: Captura el valor del nuevo input de URL ⭐
        const image_url = imageURLInput.value.trim() || null;


        if (!title || !date || !startTime || !endTime) {
            alert("Completa todos los campos obligatorios");
            return;
        }

        const start = `${date}T${startTime}`;
        const end = `${date}T${endTime}`;

        // ⭐ ELIMINADA toda la lógica de conversión a Base64 ⭐

        const payload = { title, description, location, start, end, image_url };

        try {
            const res = await fetch(id ? `/api/events?id=${id}` : "/api/events", {
                method: id ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (!data.success) throw new Error();

            alert(id ? "Evento actualizado correctamente" : "Evento creado correctamente");
            eventModal.hide();
            calendar.refetchEvents();
        } catch {
            alert("Error al guardar evento");
        }
    });

    // ===== ELIMINAR EVENTO (Sin cambios) =====
    deleteEventBtn.addEventListener("click", async () => {
        if (!selectedEvent || !selectedEvent.id) {
            alert("No hay evento seleccionado");
            return;
        }

        showConfirmAlert("¿Eliminar este evento?", async () => {
            try {
                const res = await fetch(`/api/events?id=${selectedEvent.id}`, { method: "DELETE" });
                const data = await res.json();
                if (!data.success) throw new Error();

                alert("Evento eliminado correctamente");
                eventModal.hide();
                calendar.refetchEvents();
            } catch {
                alert("Error al eliminar evento");
            }
        });
    });

    // ===== LOGOUT (Sin cambios) =====
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", (e) => {
            e.preventDefault();
            showConfirmAlert("¿Deseas cerrar sesión?", () => {
                sessionStorage.removeItem("usuario");
                setTimeout(() => {
                    window.location.href = "/pages/auth/login/login.html";
                }, 800);
            });
        });
    }
});