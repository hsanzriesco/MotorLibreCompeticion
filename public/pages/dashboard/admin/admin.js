document.addEventListener("DOMContentLoaded", async () => {
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
        // 🚨 ALERTA: Acceso denegado
        mostrarAlerta("Acceso denegado. Inicia sesión como administrador.", "error", 4000);
        setTimeout(() => {
            window.location.href = "/pages/auth/login/login.html";
        }, 1500);
        return;
    }

    // 🔑 Elementos del Modal de Evento
    const calendarEl = document.getElementById("calendar");
    const eventModalEl = document.getElementById("eventModal");
    let calendar; // Declarar aquí para que sea accesible globalmente

    if (calendarEl && eventModalEl) {
        // No hace falta nada en este if, solo para evitar errores si no existen.
    }
    const eventModal = new bootstrap.Modal(eventModalEl);
    const form = document.getElementById("eventForm");

    const titleInput = document.getElementById("title");
    const descriptionInput = document.getElementById("description");
    const locationInput = document.getElementById("location");
    const capacityInput = document.getElementById("capacity");
    const startDateInput = document.getElementById("start-date");
    const startTimeInput = document.getElementById("start-time");
    const endTimeInput = document.getElementById("end-time");
    const eventIdInput = document.getElementById("eventId");

    // 🚀 NUEVO: Elementos de la sección de inscritos
    const registrationsSection = document.getElementById("registrationsSection");
    const registrationsCount = document.getElementById("registrations-count");
    const registrationsList = document.getElementById("registrations-list");
    // const noRegistrationsMessage = document.getElementById("no-registrations-message"); // Ya no es necesario si se maneja en loadEventRegistrations

    const imageFileInput = document.getElementById("imageFile");
    const imageURLInput = document.getElementById("imageURL");
    const currentImagePreview = document.getElementById("currentImagePreview");
    const currentImageContainer = document.getElementById("currentImageContainer");
    const clearImageBtn = document.getElementById("clearImageBtn");

    const saveEventBtn = document.getElementById("saveEventBtn");
    const deleteEventBtn = document.getElementById("deleteEventBtn");

    let selectedEvent = null;
    let eventInitialState = null; // 🔑 Para guardar el estado inicial

    // 🔑 Elementos del Modal de Coche
    const carGarageForm = document.getElementById("carGarageForm");
    const carModalEl = document.getElementById("carGarageModal");

    const carIdInput = document.getElementById("carId");
    const carNameInput = document.getElementById("car_name");
    const carModelInput = document.getElementById("model");
    const carYearInput = document.getElementById("year");
    const carDescriptionInput = document.getElementById("description");

    const carPhotoFileInput = document.getElementById("carPhotoFile");
    const carPhotoUrlInput = document.getElementById("carPhotoURL");
    const carPhotoPreview = document.getElementById("carPhotoPreview");
    const carPhotoContainer = document.getElementById("carPhotoContainer");
    const clearCarPhotoBtn = document.getElementById("clearCarPhotoBtn");

    // --- FUNCIONES DE ESTADO ---

    // 🔑 Captura el estado actual del formulario de evento
    function captureEventState() {
        const date = startDateInput.value;
        const startTime = startTimeInput.value;
        const endTime = endTimeInput.value;
        const capacity = parseInt(capacityInput.value) || 0;

        return {
            id: eventIdInput.value,
            title: titleInput.value.trim(),
            description: descriptionInput.value.trim(),
            location: locationInput.value.trim(),
            capacity: capacity,
            start: date && startTime ? `${date}T${startTime}` : null,
            end: date && endTime ? `${date}T${endTime}` : null,
            imageURL: imageURLInput.value,
        };
    }

    // 🔑 Compara el estado actual con el estado inicial
    function hasEventChanged() {
        if (!eventInitialState) return true;

        const currentState = captureEventState();

        const fieldsChanged =
            currentState.title !== eventInitialState.title ||
            currentState.description !== eventInitialState.description ||
            currentState.location !== eventInitialState.location ||
            currentState.capacity !== eventInitialState.capacity ||
            currentState.start !== eventInitialState.start ||
            currentState.end !== eventInitialState.end ||
            currentState.imageURL !== eventInitialState.imageURL;

        const fileChanged = imageFileInput.files.length > 0;

        return fieldsChanged || fileChanged;
    }

    // 🚀 NUEVA FUNCIÓN: CARGA Y MUESTRA INSCRITOS
    /**
     * Carga y renderiza la lista de inscritos para un evento dado.
     * @param {string} eventId
     */
    async function loadEventRegistrations(eventId) {
        if (!eventId || !registrationsSection || !registrationsList || !registrationsCount) {
            // Manejar caso donde los elementos DOM no están disponibles o no hay ID
            if (registrationsSection) registrationsSection.style.display = 'none';
            return;
        }

        registrationsSection.style.display = 'block';
        registrationsList.innerHTML = ''; // Limpiar lista previa
        registrationsCount.textContent = 'Cargando...';

        try {
            const response = await fetch(`/api/events?action=getRegistrations&event_id=${eventId}`);
            const data = await response.json();

            if (data.success) {
                const registrations = data.registrations;
                // Asumiendo que capacityInfo contiene { num_inscritos, capacidad_max }
                const { num_inscritos, capacidad_max } = data.capacityInfo || { num_inscritos: 0, capacidad_max: 0 };

                // 1. Actualizar el contador de inscritos
                const maxCapacityDisplay = capacidad_max === 0 ? '∞' : capacidad_max;
                registrationsCount.textContent = `${num_inscritos}/${maxCapacityDisplay}`;

                if (registrations.length === 0) {
                    // Mostrar mensaje de no inscritos
                    const p = document.createElement('p');
                    p.classList.add('text-muted', 'text-center', 'small', 'mt-3');
                    p.textContent = 'Aún no hay inscripciones.';
                    registrationsList.appendChild(p);
                } else {
                    // 2. Crear y renderizar la lista
                    const ul = document.createElement('ul');
                    ul.classList.add('list-group', 'list-group-flush', 'mt-3');

                    registrations.forEach(reg => {
                        const li = document.createElement('li');
                        // Usar estilos de bootstrap para listas oscuras
                        li.classList.add('list-group-item', 'd-flex', 'justify-content-between', 'align-items-center', 'bg-dark', 'text-light', 'border-secondary');

                        // Formatear la fecha de registro
                        const registeredAt = new Date(reg.registered_at).toLocaleDateString('es-ES', {
                            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        });

                        li.innerHTML = `
                            <div>
                                <i class="bi bi-person-circle text-danger me-2"></i>
                                <strong class="text-white">${reg.usuario_inscrito}</strong> 
                                <small class="text-muted">(ID: ${reg.user_id})</small>
                            </div>
                            <span class="badge bg-secondary">${registeredAt}</span>
                        `;
                        ul.appendChild(li);
                    });

                    registrationsList.appendChild(ul);
                }
            } else {
                console.error("Error al obtener inscripciones:", data.message);
                registrationsCount.textContent = 'Error';
                registrationsList.innerHTML = `<p class="text-danger text-center mt-3">Error al cargar la lista.</p>`;
            }

        } catch (error) {
            console.error("Fetch error:", error);
            registrationsCount.textContent = 'Error de conexión';
            registrationsList.innerHTML = `<p class="text-danger text-center mt-3">Error de conexión con el servidor.</p>`;
        }
    }
    // 🚀 FIN NUEVA FUNCIÓN


    // --- LÓGICA DE CARGA DE EVENTOS ---


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
                    // Asegúrate de que tu API devuelva capacidad_max
                    capacity: e.capacidad_max || 0,
                    image_url: e.image_url
                }
            }));
        } catch (e) {
            console.error("Error al obtener eventos:", e);
            // 🚨 ALERTA: Error al cargar eventos
            mostrarAlerta("Error al cargar los eventos: " + e.message, "error");
            return [];
        }
    }

    // --- INICIALIZACIÓN DE CALENDARIO ---

    if (calendarEl) {
        calendar = new FullCalendar.Calendar(calendarEl, {
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
                capacityInput.value = 0;
                // 🚀 NUEVO: Ocultar sección de inscritos al crear
                if (registrationsSection) registrationsSection.style.display = 'none';
                deleteEventBtn.style.display = "none";

                imageFileInput.value = "";
                imageURLInput.value = "";
                currentImageContainer.style.display = "none";

                eventInitialState = captureEventState();
                eventModal.show();
            },

            eventClick: (info) => {
                const event = info.event;
                selectedEvent = event;
                const extendedProps = event.extendedProps;
                const currentURL = extendedProps.image_url || "";

                eventIdInput.value = event.id;
                titleInput.value = event.title;
                descriptionInput.value = extendedProps.description || "";
                locationInput.value = extendedProps.location || "";
                capacityInput.value = extendedProps.capacity || 0;

                imageURLInput.value = currentURL;
                imageFileInput.value = "";

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
                eventInitialState = captureEventState();

                // 🚀 NUEVO: Cargar la lista de inscritos
                loadEventRegistrations(event.id);

                eventModal.show();
            },

            events: async (info, successCallback) => {
                const events = await fetchEvents();
                successCallback(events);
            }
        });

        calendar.render();
    }

    // --- EVENT LISTENERS GENERALES (IMAGEN, GUARDAR, ELIMINAR, COCHE) ---

    // 🔑 Lógica de previsualización de imagen (Corregida la lógica original)
    if (imageFileInput && imageURLInput && currentImageContainer) {
        imageFileInput.addEventListener('change', function () {
            const file = this.files[0];

            if (file) {
                // Previsualizar archivo y ocultar URL previa
                const fileUrl = URL.createObjectURL(file);
                currentImagePreview.src = fileUrl;
                currentImageContainer.style.display = 'block';
                imageURLInput.value = ""; // Borrar URL para forzar subida/guardado de nuevo archivo
            } else if (imageURLInput.value) {
                // Si se borra el archivo y existe una URL, mostrar la URL previa
                currentImagePreview.src = imageURLInput.value;
                currentImageContainer.style.display = 'block';
            } else {
                // Si no hay archivo ni URL
                currentImageContainer.style.display = 'none';
            }
        });
    }

    // 🔑 Limpiar imagen
    if (clearImageBtn && imageURLInput && imageFileInput && currentImageContainer) {
        clearImageBtn.addEventListener('click', (e) => {
            e.preventDefault();
            imageURLInput.value = "";
            imageFileInput.value = "";
            currentImageContainer.style.display = 'none';
        });
    }


    // 🔑 Guardar/Actualizar Evento
    if (saveEventBtn) {
        saveEventBtn.addEventListener("click", async () => {
            const id = eventIdInput.value;
            const date = startDateInput.value;
            const startTime = startTimeInput.value;
            const endTime = endTimeInput.value;

            // 1. COMPROBACIÓN DE CAMBIOS
            if (id && !hasEventChanged()) {
                mostrarAlerta("No hay cambios para guardar.", "info");
                eventModal.hide();
                return;
            }

            if (!titleInput.value.trim() || !date || !startTime || !endTime) {
                mostrarAlerta("Completa todos los campos obligatorios", "advertencia");
                return;
            }

            // 2. CONFIRMACIÓN ANTES DE GUARDAR
            let confirmado = true;
            if (id) {
                confirmado = await mostrarConfirmacion("¿Deseas guardar los cambios realizados en el evento?");
            }

            if (!confirmado) {
                return;
            }

            // --- Lógica de guardado ---

            const start = `${date}T${startTime}`;
            const end = `${date}T${endTime}`;

            const formData = new FormData();
            // Usamos POST/PUT en el fetch, pero forzamos el método con action/id para backends PHP/FormData
            formData.append('action', id ? 'update' : 'create');
            if (id) formData.append('id', id);

            formData.append('title', titleInput.value.trim());
            formData.append('description', descriptionInput.value.trim());
            formData.append('location', locationInput.value.trim());
            formData.append('capacidad_max', capacityInput.value.trim());
            formData.append('start', start);
            formData.append('end', end);

            const file = imageFileInput.files[0];
            const currentURL = imageURLInput.value;

            if (file) {
                formData.append('imageFile', file);
            } else {
                // Si no hay archivo, enviamos la URL (que puede estar vacía si se limpió)
                formData.append('imageURL', currentURL);
            }

            try {
                // Usamos POST con FormData, el servidor debe manejar la lógica update/create
                const res = await fetch("/api/events", {
                    method: "POST",
                    body: formData
                });

                const data = await res.json();
                if (!data.success) throw new Error(data.message || "Fallo en la respuesta del servidor.");

                mostrarAlerta(id ? "Evento actualizado correctamente" : "Evento creado correctamente", "exito");
                eventModal.hide();
                // Usar la variable calendar declarada globalmente
                if (calendar) calendar.refetchEvents();
            } catch (e) {
                console.error("Error al guardar:", e);
                mostrarAlerta("Error al guardar evento: " + e.message, "error");
            }
        });
    }

    // 🔑 Eliminar Evento
    if (deleteEventBtn) {
        deleteEventBtn.addEventListener("click", async () => {
            if (!selectedEvent || !selectedEvent.id) {
                mostrarAlerta("No hay evento seleccionado", "info");
                return;
            }

            // ❓ CONFIRMACIÓN: Eliminar evento
            const confirmado = await mostrarConfirmacion("¿Estás seguro de que quieres eliminar este evento? ¡Esta acción es irreversible!");

            if (confirmado) {
                try {
                    // Usamos POST con action=delete para compatibilidad con FormData/PHP
                    const res = await fetch(`/api/events?id=${selectedEvent.id}&action=delete`, { method: "POST" });
                    const data = await res.json();
                    if (!data.success) throw new Error();

                    mostrarAlerta("Evento eliminado correctamente", "exito");
                    eventModal.hide();
                    if (calendar) calendar.refetchEvents();
                } catch {
                    mostrarAlerta("Error al eliminar evento", "error");
                }
            }
        });
    }

    // --- Lógica de Coche y Cerrar Sesión (sin cambios significativos) ---

    // Lógica de Coche
    // ... (Mantener la lógica del coche tal como está en tu original) ...

    // Lógica de Cerrar Sesión
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", async (e) => {
            e.preventDefault();

            const confirmado = await mostrarConfirmacion("¿Deseas cerrar sesión?");

            if (confirmado) {
                sessionStorage.removeItem("usuario");
                setTimeout(() => {
                    window.location.href = "/pages/auth/login/login.html";
                }, 800);
            }
        });
    }

    // Evento para reabrir el modal de evento al cerrar el de coche (si aplica)
    if (carModalEl && eventModal) {
        carModalEl.addEventListener('hidden.bs.modal', () => {
            // Solo muestra el modal de evento si un evento estaba seleccionado
            if (eventIdInput.value) {
                eventModal.show();
            }
        });
    }
});