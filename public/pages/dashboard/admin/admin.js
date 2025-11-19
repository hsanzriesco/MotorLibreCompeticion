document.addEventListener("DOMContentLoaded", async () => {

    // ===== VERIFICAR SESIÓN (Sin cambios) =====
    const storedUser = sessionStorage.getItem("usuario");

    let usuario = null;
    if (storedUser) {
        try {
            usuario = JSON.parse(storedUser);
        } catch (e) {
            console.error("Error al parsear usuario:", e);
        }
    }

    if (!usuario || usuario.role?.toLowerCase() !== "admin") {
        sessionStorage.removeItem("usuario");
        alert("Acceso denegado. Inicia sesión como administrador.");
        setTimeout(() => {
            window.location.href = "/pages/auth/login/login.html";
        }, 1500);
        return;
    }

    // ===== ELEMENTOS DEL DOM (IDs del HTML) =====
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
    const eventIdInput = document.getElementById("eventId");

    // ⭐ ELEMENTOS DE IMAGEN CLAVE ⭐
    const imageFileInput = document.getElementById("imageFile"); // input type="file"
    const imageURLInput = document.getElementById("imageURL");   // input type="hidden"
    const currentImagePreview = document.getElementById("currentImagePreview");
    const currentImageContainer = document.getElementById("currentImageContainer");
    const clearImageBtn = document.getElementById("clearImageBtn");

    const saveEventBtn = document.getElementById("saveEventBtn");
    const deleteEventBtn = document.getElementById("deleteEventBtn");

    let selectedEvent = null;

    // ... (Función showConfirmAlert sin cambios) ...
    function showConfirmAlert(message, onConfirm) {
        let confirmBox = document.getElementById("customConfirmContainer")?.querySelector(".custom-confirm");

        if (!confirmBox) {
            confirmBox = document.createElement("div");
            confirmBox.className = "custom-confirm";
            const container = document.getElementById("customConfirmContainer");
            if (container) container.appendChild(confirmBox);
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


    // ===== CARGAR EVENTOS (Sin cambios) =====
    async function fetchEvents() {
        try {
            const res = await fetch("/api/events");
            const json = await res.json();
            if (!json.success || !Array.isArray(json.data)) throw new Error(json.message || "Error desconocido al obtener eventos.");
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
        } catch (e) {
            console.error("Error al obtener eventos:", e);
            alert("Error al cargar los eventos: " + e.message);
            return [];
        }
    }

    // ===== CALENDARIO (Sin cambios) =====
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

            // Lógica de imagen al crear: limpiar todo
            imageFileInput.value = "";
            imageURLInput.value = "";
            currentImageContainer.style.display = "none";

            eventModal.show();
        },

        eventClick: (info) => {
            const event = info.event;
            selectedEvent = event;
            const extendedProps = event.extendedProps;
            const currentURL = extendedProps.image_url || ""; // La URL de la base de datos

            eventIdInput.value = event.id;
            titleInput.value = event.title;
            descriptionInput.value = extendedProps.description || "";
            locationInput.value = extendedProps.location || "";

            // ASIGNAR URL EXISTENTE a hidden y VACIAR input file
            imageURLInput.value = currentURL; // Guarda la URL existente
            imageFileInput.value = ""; // Debe vaciarse al abrir el formulario

            // Lógica para previsualizar la imagen existente
            if (currentURL) {
                currentImagePreview.src = currentURL;
                currentImageContainer.style.display = 'block';
            } else {
                currentImagePreview.src = '';
                currentImageContainer.style.display = 'none';
            }

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

    // ===== LÓGICA DE PREVISUALIZACIÓN Y LIMPIEZA DE IMAGEN (Sin cambios) =====

    // Previsualizar nuevo archivo seleccionado (Usa URL.createObjectURL)
    imageFileInput.addEventListener('change', function () {
        const file = this.files[0];

        if (file) {
            const fileUrl = URL.createObjectURL(file);
            currentImagePreview.src = fileUrl;
            currentImageContainer.style.display = 'block';
            // Al seleccionar un nuevo archivo, el valor de imageURLInput sigue siendo la URL antigua,
            // pero el backend priorizará el archivo en imageFile.
        } else {
            // Si el usuario cancela la selección de archivo, mostramos la URL que estaba guardada (si la hay)
            if (imageURLInput.value) {
                currentImagePreview.src = imageURLInput.value;
                currentImageContainer.style.display = 'block';
            } else {
                currentImageContainer.style.display = 'none';
            }
        }
    });

    // Botón para eliminar la imagen
    clearImageBtn.addEventListener('click', (e) => {
        e.preventDefault();
        imageURLInput.value = ""; // INDICA al backend que la URL debe ser NULL
        imageFileInput.value = ""; // Limpia el archivo subido
        currentImageContainer.style.display = 'none';
    });


    // ===== GUARDAR EVENTO (CORRECCIÓN CLAVE EN LA LÓGICA DE FormData) =====
    saveEventBtn.addEventListener("click", async () => {
        const id = eventIdInput.value;
        const date = startDateInput.value;
        const startTime = startTimeInput.value;
        const endTime = endTimeInput.value;

        // Validación de campos obligatorios
        if (!titleInput.value.trim() || !date || !startTime || !endTime) {
            alert("Completa todos los campos obligatorios");
            return;
        }

        const start = `${date}T${startTime}`;
        const end = `${date}T${endTime}`;

        // 1. Crear FormData para enviar archivos al backend
        const formData = new FormData();
        formData.append('title', titleInput.value.trim());
        formData.append('description', descriptionInput.value.trim());
        formData.append('location', locationInput.value.trim());
        formData.append('start', start);
        formData.append('end', end);

        const file = imageFileInput.files[0];
        const currentURL = imageURLInput.value;

        // ⭐ LÓGICA CORREGIDA PARA ADJUNTAR IMAGEN ⭐
        if (file) {
            // Caso 1: Hay un nuevo archivo subido. Lo adjuntamos bajo 'imageFile'
            formData.append('imageFile', file);

            // Si hay un archivo, NO enviamos el campo imageURL para que el backend suba y use la nueva URL.
            // Si el backend recibe 'imageFile', ignora 'imageURL' (excepto para PUT, donde el archivo anula la URL).

        } else {
            // Caso 2: NO hay archivo nuevo. Enviamos la URL existente.
            // Si currentURL es "" (vacío), es porque se pulsó 'Quitar imagen', y el backend pondrá NULL.
            // Si currentURL tiene una URL, el backend la mantendrá.
            formData.append('imageURL', currentURL);
        }
        // ⭐ FIN LÓGICA CORREGIDA ⭐

        try {
            const res = await fetch(id ? `/api/events?id=${id}` : "/api/events", {
                method: id ? "PUT" : "POST",
                body: formData // Envía el FormData correctamente
            });

            const data = await res.json();
            if (!data.success) throw new Error(data.message || "Fallo en la respuesta del servidor.");

            alert(id ? "Evento actualizado correctamente" : "Evento creado correctamente");
            eventModal.hide();
            calendar.refetchEvents();
        } catch (e) {
            console.error("Error al guardar:", e);
            alert("Error al guardar evento: " + e.message);
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

    // ... (Lógica de Logout sin cambios) ...
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