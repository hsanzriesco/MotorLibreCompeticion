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

    // 🔑 Elementos del Botón de Inscritos (Según tu HTML)
    const registrationsBtnContainer = document.getElementById("registrations-button-container");
    const btnViewRegistrations = document.getElementById("btnViewRegistrations");
    const currentRegisteredCount = document.getElementById("current-registered-count");

    // NOTA: Las variables registrationsSection, registrationsCount y registrationsList
    // ya no se usan en el modal principal, pero las dejamos por si tu HTML las usaba
    // para algo más. En este script, ahora referencian elementos inactivos si usas el modal secundario.
    // const registrationsSection = document.getElementById("registrationsSection");
    // const registrationsCount = document.getElementById("registrations-count");
    // const registrationsList = document.getElementById("registrations-list");

    // 🔑 Elementos del Modal de Inscritos (Asumiendo que existen en tu HTML)
    const registrationsModalEl = document.getElementById('registrationsModal');
    const registrationsModal = registrationsModalEl ? new bootstrap.Modal(registrationsModalEl) : null;
    // Debes tener estos IDs en tu HTML dentro de #registrationsModal
    const registrationsTableBody = document.getElementById('registrationsTableBody');
    const registrationsModalTitle = document.getElementById('registrationsModalLabel');


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

    // 🚀 FUNCIÓN DE UTILIDAD para formatear fecha de registro
    function formatRegistrationDate(isoString) {
        if (!isoString) return 'N/A';
        try {
            const date = new Date(isoString);
            return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
                ' ' +
                date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            return isoString;
        }
    }


    // 🚀 FUNCIÓN MODIFICADA: Ahora solo CARGA Y DEVUELVE los datos, además de actualizar el CONTEO del botón.
    /**
     * Carga los inscritos, actualiza el conteo en el botón principal y devuelve los datos.
     * @param {string} eventId
     * @returns {Promise<{success: boolean, registrations: Array, capacityInfo: Object}>}
     */
    async function loadEventRegistrationsData(eventId) {
        if (!eventId || !currentRegisteredCount || !btnViewRegistrations) {
            return { success: false, registrations: [], capacityInfo: {} };
        }

        // Mantenemos el spinner de carga en el contador del botón
        currentRegisteredCount.textContent = '...';

        try {
            const response = await fetch(`/api/events?action=getRegistrations&event_id=${eventId}`);
            const data = await response.json();

            if (data.success) {
                const registrations = data.registrations || [];
                const capacityInfo = data.capacityInfo || { num_inscritos: 0, capacidad_max: 0 };
                const { num_inscritos, capacidad_max } = capacityInfo;

                // 1. Actualizar el contador del botón (texto)
                const maxCapacityDisplay = capacidad_max === 0 ? '∞' : capacidad_max;
                currentRegisteredCount.textContent = num_inscritos;
                btnViewRegistrations.innerHTML = `<i class="bi bi-people-fill me-2"></i> Ver Usuarios Inscritos (${num_inscritos}/${maxCapacityDisplay})`;

                return { success: true, registrations, capacityInfo };
            } else {
                console.error("Error al obtener inscripciones:", data.message);
                currentRegisteredCount.textContent = '0';
                btnViewRegistrations.innerHTML = `<i class="bi bi-people-fill me-2"></i> Error al cargar inscritos (0/∞)`;
                return { success: false, registrations: [], capacityInfo: {} };
            }

        } catch (error) {
            console.error("Fetch error:", error);
            currentRegisteredCount.textContent = 'Error';
            btnViewRegistrations.innerHTML = `<i class="bi bi-people-fill me-2"></i> Error al cargar inscritos`;
            return { success: false, registrations: [], capacityInfo: {} };
        }
    }

    // 🚀 NUEVA FUNCIÓN: RENDERIZA LA TABLA EN EL MODAL SECUNDARIO
    /**
     * Renderiza los datos de inscritos en la tabla del modal secundario.
     * @param {Array} registrations - Lista de objetos de inscripción
     */
    function renderRegistrationsTable(registrations) {
        if (!registrationsTableBody) return;

        // Asumiendo que tu tabla tiene thead con 5 columnas (Nº, Usuario, Email, Coche, Fecha)
        if (registrations.length === 0) {
            registrationsTableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center text-muted">Aún no hay inscripciones para este evento.</td>
                </tr>
            `;
            return;
        }

        let htmlContent = '';
        registrations.forEach((reg, index) => {
            // Adaptar las propiedades según tu API (usamos nombres probables)
            const username = reg.usuario_inscrito || reg.username || 'Desconocido';
            const email = reg.email || 'N/A';
            const carDetails = reg.car_name ? `${reg.car_name} (${reg.car_model})` : 'Sin coche';

            htmlContent += `
                <tr>
                    <td scope="row">${index + 1}</td>
                    <td><strong class="text-white">${username}</strong> <small class="text-muted">(ID: ${reg.user_id})</small></td>
                    <td>${email}</td>
                    <td>${carDetails}</td>
                    <td>${formatRegistrationDate(reg.registered_at)}</td>
                </tr>
            `;
        });
        registrationsTableBody.innerHTML = htmlContent;
    }


    // --- LÓGICA DE CARGA DE EVENTOS (sin cambios) ---
    async function fetchEvents() { /* ... */ }

    // --- INICIALIZACIÓN DE CALENDARIO ---

    if (calendarEl) {
        calendar = new FullCalendar.Calendar(calendarEl, {
            // ... (otras configuraciones) ...

            select: (info) => {
                selectedEvent = null;
                form.reset();
                startDateInput.value = info.startStr.split("T")[0];
                eventIdInput.value = "";
                capacityInput.value = 0;

                // 🔑 MODIFICADO: Ocultar el contenedor del botón de inscritos al crear
                if (registrationsBtnContainer) registrationsBtnContainer.style.display = 'none';

                deleteEventBtn.style.display = "none";
                imageFileInput.value = "";
                imageURLInput.value = "";
                currentImageContainer.style.display = "none";

                eventInitialState = captureEventState();
                eventModal.show();
            },

            eventClick: async (info) => {
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
                // ... (manejo de fechas) ...

                deleteEventBtn.style.display = "inline-block";
                eventInitialState = captureEventState();

                // 🔑 MODIFICADO: Mostrar el botón y actualizar solo el conteo
                if (registrationsBtnContainer) {
                    registrationsBtnContainer.style.display = 'block';
                    // Llamamos para cargar el conteo y actualizar el texto del botón
                    await loadEventRegistrationsData(event.id);
                }

                eventModal.show();
            },

            // ... (función events) ...
        });

        calendar.render();
    }

    // --- EVENT LISTENERS GENERALES (IMAGEN, GUARDAR, ELIMINAR, etc.) ---
    // ... (Mantener la lógica de imagen, guardar y eliminar) ...


    // 🚀 LÓGICA DEL BOTÓN 'VER USUARIOS INSCRITOS' (NUEVO)
    if (btnViewRegistrations && registrationsModal) {
        btnViewRegistrations.addEventListener('click', async (e) => {
            // e.preventDefault() ya no es necesario si el botón usa data-bs-toggle="modal", 
            // pero lo dejamos por si quieres forzar la lógica completa aquí.
            const eventId = eventIdInput.value;
            const eventTitle = titleInput.value.trim();

            if (!eventId) {
                mostrarAlerta('Error', 'No hay evento seleccionado para ver los inscritos.', 'error');
                return;
            }

            // 1. Ocultar el modal principal (es una buena práctica si se abre otro modal)
            eventModal.hide();

            // 2. Cargar los datos de inscritos
            const result = await loadEventRegistrationsData(eventId);

            // 3. Renderizar la tabla y actualizar el título del modal secundario
            if (registrationsModalTitle) {
                registrationsModalTitle.textContent = `Inscritos para: ${eventTitle}`;
            }

            if (result.success) {
                renderRegistrationsTable(result.registrations);
            } else {
                // Si falla, al menos intentamos renderizar la tabla vacía con el mensaje de error
                renderRegistrationsTable([]);
                if (registrationsTableBody) {
                    registrationsTableBody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error al cargar la lista: ${result.message || 'Error de conexión.'}</td></tr>`;
                }
            }

            // 4. Mostrar el modal de inscripciones (Bootstrap lo maneja automáticamente con data-bs-target, pero lo forzamos por si acaso)
            registrationsModal.show();
        });
    }

    // 🔑 NUEVO: Manejar el cierre del Modal de Inscritos para volver al Modal de Evento
    if (registrationsModalEl && eventModalEl) {
        registrationsModalEl.addEventListener('hidden.bs.modal', () => {
            const eventId = eventIdInput.value;
            // Solo si el modal de evento tiene un ID cargado, lo reabrimos.
            if (eventId) {
                eventModal.show();
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