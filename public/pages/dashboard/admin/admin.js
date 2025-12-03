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

    const calendarEl = document.getElementById("calendar");
    const eventModalEl = document.getElementById("eventModal");
    if (calendarEl && eventModalEl) {
    }
    const eventModal = new bootstrap.Modal(eventModalEl);
    const form = document.getElementById("eventForm");

    const titleInput = document.getElementById("title");
    const descriptionInput = document.getElementById("description");
    const locationInput = document.getElementById("location");
    // 💡 Modificado: Variable para el input de capacidad
    const capacityInput = document.getElementById("capacity");
    const startDateInput = document.getElementById("start-date");
    const startTimeInput = document.getElementById("start-time");
    const endTimeInput = document.getElementById("end-time");
    const eventIdInput = document.getElementById("eventId");

    // 🚀 CORREGIDO: Variables para la sección de inscritos (Solo el botón en el modal principal)
    const registrationsBtnContainer = document.getElementById("registrations-button-container");
    const currentRegisteredCount = document.getElementById("current-registered-count");


    const imageFileInput = document.getElementById("imageFile");
    const imageURLInput = document.getElementById("imageURL");
    const currentImagePreview = document.getElementById("currentImagePreview");
    const currentImageContainer = document.getElementById("currentImageContainer");
    const clearImageBtn = document.getElementById("clearImageBtn");

    const saveEventBtn = document.getElementById("saveEventBtn");
    const deleteEventBtn = document.getElementById("deleteEventBtn");

    let selectedEvent = null;
    let eventInitialState = null; // 🔑 NUEVO: Para guardar el estado inicial

    const carGarageForm = document.getElementById("carGarageForm");
    const carModalEl = document.getElementById("carGarageModal"); // Mantengo esto si existe en el DOM

    // Variables de coche omitidas para simplicidad si no se usan, pero se mantienen si son necesarias.
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

    // 🔑 Modificado: Captura el estado actual del formulario de evento
    function captureEventState() {
        const date = startDateInput.value;
        const startTime = startTimeInput.value;
        const endTime = endTimeInput.value;
        // Convertir la capacidad a un número entero o 0 para la comparación
        const capacity = parseInt(capacityInput.value) || 0;

        return {
            id: eventIdInput.value,
            title: titleInput.value.trim(),
            description: descriptionInput.value.trim(),
            location: locationInput.value.trim(),
            // 💡 Nuevo: Incluir capacidad para la comparación
            capacity: capacity,
            start: date && startTime ? `${date}T${startTime}` : null,
            end: date && endTime ? `${date}T${endTime}` : null,
            imageURL: imageURLInput.value,
            // Nota: fileInput no se compara aquí, se maneja por separado si hay un archivo.
        };
    }

    // 🔑 Modificado: Compara el estado actual con el estado inicial
    function hasEventChanged() {
        if (!eventInitialState) return true; // Si es un nuevo evento, siempre hay cambios.

        const currentState = captureEventState();

        // 1. Comprobar campos de texto/fechas/URL (Excluyendo el archivo)
        const fieldsChanged =
            currentState.title !== eventInitialState.title ||
            currentState.description !== eventInitialState.description ||
            currentState.location !== eventInitialState.location ||
            // 💡 Nuevo: Comparar la capacidad
            currentState.capacity !== eventInitialState.capacity ||
            currentState.start !== eventInitialState.start ||
            currentState.end !== eventInitialState.end ||
            currentState.imageURL !== eventInitialState.imageURL;

        // 2. Comprobar si se ha seleccionado un nuevo archivo (imageFile)
        const fileChanged = imageFileInput.files.length > 0;

        return fieldsChanged || fileChanged;
    }

    // 🗑️ ELIMINADA: La función loadEventRegistrations ya no está aquí. Está en adminCalendario.html.


    // --- FIN FUNCIONES DE ESTADO ---

    let calendar; // 💡 Declara la variable calendar aquí para que sea accesible globalmente en el script

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
                    // 💡 ASUMIDO: Tu API devuelve capacidad_max y num_inscritos (debes asegurarte de que tu API los incluya)
                    capacity: e.capacidad_max || 0,
                    totalInscritos: e.num_inscritos || 0, // 💡 NUEVO: Añadir conteo para el botón
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

    if (calendarEl) {
        // 💡 Asigna la instancia a la variable calendar
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
                // 💡 Nuevo: Resetear capacidad a 0 al crear un evento
                capacityInput.value = 0;

                // 🚀 CORRECCIÓN: Ocultar botón de inscritos al crear
                if (registrationsBtnContainer) registrationsBtnContainer.style.display = 'none';
                if (currentRegisteredCount) currentRegisteredCount.textContent = '0'; // Asegurar el conteo en 0

                deleteEventBtn.style.display = "none";

                imageFileInput.value = "";
                imageURLInput.value = "";
                currentImageContainer.style.display = "none";

                eventInitialState = captureEventState(); // 🔑 NUEVO: Capturar estado inicial (vacío)
                eventModal.show();
            },

            eventClick: (info) => {
                const event = info.event;
                selectedEvent = event;
                const extendedProps = event.extendedProps;
                const currentURL = extendedProps.image_url || "";
                const totalInscritos = extendedProps.totalInscritos || 0; // 💡 NUEVO: Leer conteo

                eventIdInput.value = event.id;
                titleInput.value = event.title;
                descriptionInput.value = extendedProps.description || "";
                locationInput.value = extendedProps.location || "";
                // 💡 Nuevo: Cargar la capacidad al hacer clic en el evento
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

                // 🚀 CORRECCIÓN: Mostrar botón y actualizar conteo
                if (registrationsBtnContainer) registrationsBtnContainer.style.display = 'block';
                if (currentRegisteredCount) currentRegisteredCount.textContent = totalInscritos;

                deleteEventBtn.style.display = "inline-block";
                eventInitialState = captureEventState(); // 🔑 NUEVO: Capturar estado inicial (cargado)

                eventModal.show();
            },

            events: async (info, successCallback) => {
                const events = await fetchEvents();
                successCallback(events);
            }
        });

        calendar.render();

    } // 🚨 FIN DEL BLOQUE IF (calendarEl)

    // ---------------------------------------------------------------------
    // 🚀 SOLUCIÓN: MOVER LOS LISTENERS FUERA DEL BLOQUE IF (calendarEl)
    // ---------------------------------------------------------------------

    // 🔑 Función de gestión de eventos (Crear/Actualizar)
    if (saveEventBtn) {
        saveEventBtn.addEventListener("click", async () => {
            const eventId = eventIdInput.value;
            const title = titleInput.value.trim();
            const description = descriptionInput.value.trim();
            const location = locationInput.value.trim();
            const capacity = parseInt(capacityInput.value) || 0; // Usar 0 si está vacío o no es número
            const startDate = startDateInput.value;
            const startTime = startTimeInput.value;
            const endTime = endTimeInput.value;

            if (!title || !startDate || !startTime || !endTime) {
                mostrarAlerta("Error", "El título, la fecha y las horas de inicio/fin son obligatorios.", "warning");
                return;
            }

            if (eventId && !hasEventChanged() && imageFileInput.files.length === 0) {
                mostrarAlerta("Información", "No se detectaron cambios para guardar.", "info");
                eventModal.hide();
                return;
            }

            const startDateTime = `${startDate}T${startTime}:00`;
            const endDateTime = `${startDate}T${endTime}:00`;

            const formData = new FormData(form);
            formData.set("title", title);
            formData.set("description", description);
            formData.set("location", location);
            formData.set("capacidad_max", capacity); // Usar el nombre de campo de la base de datos
            formData.set("start", startDateTime);
            formData.set("end", endDateTime);

            // Determinar si es crear o actualizar y la URL
            const isUpdate = !!eventId;
            // const method = isUpdate ? "PUT" : "POST"; // No es necesario si siempre se usa POST con action
            const url = isUpdate ? `/api/events?id=${eventId}` : "/api/events";
            formData.set("action", isUpdate ? "update" : "create");
            if (isUpdate) formData.set("id", eventId);

            // Incluir imageURL si no se sube un nuevo archivo y existe una URL previa
            if (imageFileInput.files.length === 0 && imageURLInput.value) {
                formData.set("image_url", imageURLInput.value);
            } else if (imageFileInput.files.length === 0 && !imageURLInput.value) {
                // Si no hay archivo y tampoco hay URL previa (se borró o nunca hubo)
                formData.set("image_url", "");
            }

            try {
                const res = await fetch(url, {
                    method: "POST", // El uso de FormData requiere que se mantenga en POST para PHP/servidor
                    body: formData,
                });
                const json = await res.json();

                if (json.success) {
                    mostrarAlerta("Éxito", `Evento ${isUpdate ? "actualizado" : "creado"} correctamente.`, "success");
                    eventModal.hide();
                    // 💡 Comprobar si calendar existe antes de refetchEvents
                    if (calendar) calendar.refetchEvents();
                } else {
                    mostrarAlerta("Error", json.message || `Fallo al ${isUpdate ? "actualizar" : "crear"} el evento.`, "error");
                }
            } catch (error) {
                console.error("Error en la solicitud:", error);
                mostrarAlerta("Error de Red", "No se pudo conectar con el servidor.", "error");
            }
        });
    }

    // 🔑 Función para eliminar evento
    if (deleteEventBtn) {
        deleteEventBtn.addEventListener("click", () => {
            const eventId = eventIdInput.value;
            if (!eventId) return;

            // Obtener el conteo actual para mostrarlo en el mensaje de confirmación
            const inscritosCount = currentRegisteredCount ? currentRegisteredCount.textContent : '0';

            customConfirm(
                "Confirmar Eliminación",
                `¿Estás seguro de que deseas eliminar el evento: "${titleInput.value}"? Esta acción es irreversible y eliminará ${inscritosCount} inscripciones.`,
                async () => {
                    try {
                        const res = await fetch(`/api/events?id=${eventId}&action=delete`, {
                            method: "POST",
                        });
                        const json = await res.json();

                        if (json.success) {
                            mostrarAlerta("Eliminado", "Evento eliminado correctamente.", "success");
                            eventModal.hide();
                            // 💡 Comprobar si calendar existe antes de refetchEvents
                            if (calendar) calendar.refetchEvents();
                        } else {
                            mostrarAlerta("Error", json.message || "Fallo al eliminar el evento.", "error");
                        }
                    } catch (error) {
                        console.error("Error en la solicitud:", error);
                        mostrarAlerta("Error de Red", "No se pudo conectar con el servidor.", "error");
                    }
                }
            );
        });
    }

    // 🔑 Limpiar imagen
    if (clearImageBtn) {
        clearImageBtn.addEventListener('click', () => {
            imageURLInput.value = ''; // Borra la URL del campo oculto
            imageFileInput.value = ''; // Borra el archivo seleccionado
            currentImagePreview.src = '';
            currentImageContainer.style.display = 'none';
        });
    }

    // 🔑 Actualizar previsualización si se selecciona un archivo
    if (imageFileInput) {
        imageFileInput.addEventListener('change', function () {
            if (this.files && this.files[0]) {
                // Si hay un archivo, ocultamos el contenedor de la imagen previa por URL
                currentImageContainer.style.display = 'none';
                imageURLInput.value = ''; // Y borramos la URL previa para forzar la carga del nuevo archivo
            } else if (imageURLInput.value) {
                // Si borramos la selección de archivo y había una URL, mostramos la URL previa
                currentImageContainer.style.display = 'block';
            }
        });
    }

    // Evento para reabrir el modal de evento al cerrar el de coche (si aplica)
    if (carModalEl) {
        carModalEl.addEventListener('hidden.bs.modal', () => {
            if (eventIdInput.value) {
                eventModal.show();
            }
        });
    }

    // --- Logout Logic ---
    const btnConfirmLogout = document.getElementById("btnConfirmLogout");
    if (btnConfirmLogout) {
        btnConfirmLogout.addEventListener("click", () => {
            sessionStorage.removeItem("usuario");
            window.location.href = "/pages/auth/login/login.html";
        });
    }
});