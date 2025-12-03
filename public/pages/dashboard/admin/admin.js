document.addEventListener("DOMContentLoaded", async () => {
    // --- Comprobación de Usuario y Redirección (SE MANTIENE IGUAL) ---
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
        mostrarAlerta("Acceso denegado. Inicia sesión como administrador.", "error", 4000);
        setTimeout(() => {
            window.location.href = "/pages/auth/login/login.html";
        }, 1500);
        return;
    }

    // --- VARIABLES DOM Y MODALES ---
    const calendarEl = document.getElementById("calendar");
    const eventModalEl = document.getElementById("eventModal");
    if (!calendarEl || !eventModalEl) {
        // En caso de que no existan los elementos necesarios
        console.error("No se encontraron los elementos 'calendar' o 'eventModal'");
        return;
    }

    const eventModal = new bootstrap.Modal(eventModalEl);
    const form = document.getElementById("eventForm");

    const titleInput = document.getElementById("title");
    const descriptionInput = document.getElementById("description");
    const locationInput = document.getElementById("location");
    const capacityInput = document.getElementById("capacity"); // 🔑 NUEVO: Capacidad Máxima
    const startDateInput = document.getElementById("start-date");
    const startTimeInput = document.getElementById("start-time");
    const endTimeInput = document.getElementById("end-time");
    const eventIdInput = document.getElementById("eventId");

    const imageFileInput = document.getElementById("imageFile");
    const imageURLInput = document.getElementById("imageURL");
    const currentImagePreview = document.getElementById("currentImagePreview");
    const currentImageContainer = document.getElementById("currentImageContainer");
    const clearImageBtn = document.getElementById("clearImageBtn");

    const saveEventBtn = document.getElementById("saveEventBtn");
    const deleteEventBtn = document.getElementById("deleteEventBtn");

    let selectedEvent = null;
    let eventInitialState = null;

    // 🚀 NUEVAS VARIABLES PARA INSCRITOS Y EL BOTÓN
    const registrationsBtnContainer = document.getElementById('registrations-button-container');
    const currentRegisteredCount = document.getElementById('current-registered-count');

    // Nota: Las variables de los modales (registrationsModal, eventModal, etc.)
    // se manejan en el script INLINE de adminCalendario.html, ¡que es correcto!


    // --- FUNCIONES DE ESTADO (SE MANTIENEN IGUAL) ---
    function captureEventState() {
        const date = startDateInput.value;
        const startTime = startTimeInput.value;
        const endTime = endTimeInput.value;

        return {
            id: eventIdInput.value,
            title: titleInput.value.trim(),
            description: descriptionInput.value.trim(),
            location: locationInput.value.trim(),
            capacity: capacityInput.value.trim(), // 🔑 NUEVO: Capacidad
            start: date && startTime ? `${date}T${startTime}` : null,
            end: date && endTime ? `${date}T${endTime}` : null,
            imageURL: imageURLInput.value,
        };
    }

    function hasEventChanged() {
        if (!eventInitialState) return true;

        const currentState = captureEventState();

        const fieldsChanged =
            currentState.title !== eventInitialState.title ||
            currentState.description !== eventInitialState.description ||
            currentState.location !== eventInitialState.location ||
            currentState.capacity !== eventInitialState.capacity || // 🔑 NUEVO: Capacidad
            currentState.start !== eventInitialState.start ||
            currentState.end !== eventInitialState.end ||
            currentState.imageURL !== eventInitialState.imageURL;

        const fileChanged = imageFileInput.files.length > 0;

        return fieldsChanged || fileChanged;
    }

    // 🚀 NUEVA FUNCIÓN: Obtener inscritos y actualizar el contador
    async function loadEventRegistrationCount(eventId) {
        if (!eventId) {
            registrationsBtnContainer.style.display = 'none';
            return;
        }

        try {
            const response = await fetch(`/api/events?action=getRegistrationCount&event_id=${eventId}`);
            const result = await response.json();

            if (result.success) {
                const count = result.count || 0;
                currentRegisteredCount.textContent = count;

                // Solo mostrar el botón si hay un ID de evento (evento ya guardado)
                registrationsBtnContainer.style.display = eventId ? 'block' : 'none';

                return count;
            } else {
                console.error("Fallo al obtener el conteo de inscritos:", result.message);
                registrationsBtnContainer.style.display = 'none';
                return 0;
            }

        } catch (error) {
            console.error("Error de red al obtener el conteo de inscritos:", error);
            registrationsBtnContainer.style.display = 'none';
            return 0;
        }
    }


    // --- FUNCIONES DEL CALENDARIO (SE MODIFICAN PARA EL CONTEO) ---

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
                    capacity: e.capacity, // 🔑 NUEVO: Capacidad
                    image_url: e.image_url
                }
            }));
        } catch (e) {
            console.error("Error al obtener eventos:", e);
            mostrarAlerta("Error al cargar los eventos: " + e.message, "error");
            return [];
        }
    }

    if (calendarEl) {
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
                registrationsBtnContainer.style.display = 'none'; // 🚀 Ocultar el botón para nuevo evento

                imageFileInput.value = "";
                imageURLInput.value = "";
                currentImageContainer.style.display = "none";

                eventInitialState = captureEventState();
                eventModal.show();
            },

            eventClick: async (info) => { // 🚀 Hacemos async para el conteo
                const event = info.event;
                selectedEvent = event;
                const extendedProps = event.extendedProps;
                const currentURL = extendedProps.image_url || "";

                eventIdInput.value = event.id;
                titleInput.value = event.title;
                descriptionInput.value = extendedProps.description || "";
                locationInput.value = extendedProps.location || "";
                capacityInput.value = extendedProps.capacity || ""; // 🔑 NUEVO: Capacidad

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

                // 🚀 LLAMADA CLAVE: Obtener el conteo de inscritos y mostrar el botón
                await loadEventRegistrationCount(event.id);

                eventModal.show();
            },

            events: async (info, successCallback) => {
                const events = await fetchEvents();
                successCallback(events);
            }
        });

        calendar.render();

        // --- MANEJADORES DE EVENTOS (Se mantienen o modifican ligeramente) ---

        imageFileInput.addEventListener('change', function () {
            const file = this.files[0];

            if (file) {
                const fileUrl = URL.createObjectURL(file);
                currentImagePreview.src = fileUrl;
                currentImageContainer.style.display = 'block';
            } else {
                if (imageURLInput.value) {
                    currentImagePreview.src = imageURLInput.value;
                    currentImageContainer.style.display = 'block';
                } else {
                    currentImageContainer.style.display = 'none';
                }
            }
        });

        clearImageBtn.addEventListener('click', (e) => {
            e.preventDefault();
            imageURLInput.value = "";
            imageFileInput.value = "";
            currentImageContainer.style.display = 'none';
        });


        saveEventBtn.addEventListener("click", async () => {
            const id = eventIdInput.value;
            const date = startDateInput.value;
            const startTime = startTimeInput.value;
            const endTime = endTimeInput.value;
            const capacity = capacityInput.value.trim(); // 🔑 NUEVO: Capacidad

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

            // --- Lógica de guardado (se añade capacidad) ---

            const start = `${date}T${startTime}`;
            const end = `${date}T${endTime}`;

            const formData = new FormData();
            formData.append('title', titleInput.value.trim());
            formData.append('description', descriptionInput.value.trim());
            formData.append('location', locationInput.value.trim());
            formData.append('capacity', capacity); // 🔑 NUEVO: Capacidad
            formData.append('start', start);
            formData.append('end', end);

            const file = imageFileInput.files[0];
            const currentURL = imageURLInput.value;

            if (file) {
                formData.append('imageFile', file);
            } else {
                formData.append('imageURL', currentURL);
            }

            try {
                const res = await fetch(id ? `/api/events?id=${id}` : "/api/events", {
                    method: id ? "PUT" : "POST",
                    body: formData
                });

                const data = await res.json();
                if (!data.success) throw new Error(data.message || "Fallo en la respuesta del servidor.");

                mostrarAlerta(id ? "Evento actualizado correctamente" : "Evento creado correctamente", "exito");
                eventModal.hide();
                calendar.refetchEvents();
            } catch (e) {
                console.error("Error al guardar:", e);
                mostrarAlerta("Error al guardar evento: " + e.message, "error");
            }
        });

        deleteEventBtn.addEventListener("click", async () => {
            if (!selectedEvent || !selectedEvent.id) {
                mostrarAlerta("No hay evento seleccionado", "info");
                return;
            }

            const confirmado = await mostrarConfirmacion("¿Estás seguro de que quieres eliminar este evento?");

            if (confirmado) {
                try {
                    const res = await fetch(`/api/events?id=${selectedEvent.id}`, { method: "DELETE" });
                    const data = await res.json();
                    if (!data.success) throw new Error();

                    mostrarAlerta("Evento eliminado correctamente", "exito");
                    eventModal.hide();
                    calendar.refetchEvents();
                } catch {
                    mostrarAlerta("Error al eliminar evento", "error");
                }
            }
        });
    }

    // --- Lógica de Coche (El resto de tu código, incompleto pero se mantiene la estructura) ---

    // El resto de la lógica de Coche/Garaje que tenías aquí...
    // Dejo el final del archivo como lo tenías:
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

    if (carGarageForm && usuario) {

        if (carPhotoFileInput) {
            carPhotoFileInput.addEventListener('change', function () {
                const file = this.files[0];

                if (file) {
                    const fileUrl = URL.createObjectURL(file);
                    carPhotoPreview.src = fileUrl;
                    carPhotoContainer.style.display = 'block';
                } else {
                    if (carPhotoUrlInput.value) {
                        carPhotoPreview.src = carPhotoUrlInput.value;
                        carPhotoContainer.style.display = 'block';
                    }
                }
            });

            // Agrego la función del botón de coche para terminar el bloque
            clearCarPhotoBtn.addEventListener('click', (e) => {
                e.preventDefault();
                carPhotoUrlInput.value = "";
                carPhotoFileInput.value = "";
                carPhotoContainer.style.display = 'none';
            });
        }
    }
});