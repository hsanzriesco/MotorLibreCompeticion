document.addEventListener("DOMContentLoaded", async () => {
    // ====================================================================
    // 🛡️ LÓGICA DE SEGURIDAD Y ACCESO (MODIFICADO)
    // ====================================================================

    // --- Comprobación de Usuario y Redirección ---
    // Busca la sesión en sessionStorage O localStorage. 
    // Esta es la lógica que debe ser idéntica en todas las páginas de admin.
    const storedUser = sessionStorage.getItem("usuario") || localStorage.getItem("usuario");

    let usuario = null;
    if (storedUser) {
        try {
            usuario = JSON.parse(storedUser);
        } catch (e) {
            console.error("Error al parsear usuario:", e);
        }
    }

    // Comprobación de rol de administrador (se verifica que el rol exista y sea 'admin')
    if (!usuario || usuario.role?.toLowerCase() !== "admin") {
        // Limpiar ambas sesiones para evitar bucles si la información es corrupta/inválida
        sessionStorage.removeItem("usuario");
        localStorage.removeItem("usuario");

        // Asegúrate de que 'mostrarAlerta' esté disponible globalmente o importada
        if (typeof mostrarAlerta === 'function') {
            mostrarAlerta("Acceso denegado. Inicia sesión como administrador.", "error", 4000);
        }

        // Redirigir al login
        setTimeout(() => {
            // 🟢 CORRECCIÓN DE RUTA: Se utiliza la ruta absoluta asumida: /auth/login.html
            // Si el login está en /public/auth/login.html, su ruta web es /auth/login.html
            window.location.href = "/auth/login.html"; // <--- RUTA CORREGIDA
        }, 1500);
        return;
    }

    // ====================================================================
    // 📅 LÓGICA DE CALENDARIO (MODIFICADO: Location ID y Validaciones)
    // ====================================================================

    // --- VARIABLES DOM Y MODALES (CALENDARIO) ---
    const calendarEl = document.getElementById("calendar");
    const eventModalEl = document.getElementById("eventModal");
    const registrationsModalEl = document.getElementById("registrationsModal");

    let calendar;
    let eventModal;
    let registrationsModal;

    // Solo inicializamos modales y variables de calendario si estamos en la página del calendario
    if (calendarEl && eventModalEl) {
        eventModal = new bootstrap.Modal(eventModalEl);
        if (registrationsModalEl) {
            registrationsModal = new bootstrap.Modal(registrationsModalEl);
        }

        const form = document.getElementById("eventForm");
        const titleInput = document.getElementById("title");
        const descriptionInput = document.getElementById("description");

        // 🟢 CORRECCIÓN 1: Variable para el campo SELECT de Ubicación
        const locationIdSelect = document.getElementById("locationId");

        const capacityInput = document.getElementById("capacity");
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
        const registrationsBtnContainer = document.getElementById('registrations-button-container');
        const currentRegisteredCount = document.getElementById('current-registered-count');

        let selectedEvent = null;
        let eventInitialState = null;

        // --- FUNCIONES DE ESTADO (CALENDARIO) ---
        function captureEventState() {
            const date = startDateInput.value;
            const startTime = startTimeInput.value;
            const endTime = endTimeInput.value;

            // 🟢 CORRECCIÓN 2: Captura del valor del SELECT
            return {
                id: eventIdInput.value,
                title: titleInput.value.trim(),
                description: descriptionInput.value.trim(),
                location_id: locationIdSelect.value.trim(), // <--- CORREGIDO
                capacity: capacityInput.value.trim(),
                start: date && startTime ? `${date}T${startTime}` : null,
                end: date && endTime ? `${date}T${endTime}` : null,
                imageURL: imageURLInput.value,
            };
        }

        function hasEventChanged() {
            if (!eventInitialState) return true;

            const currentState = captureEventState();

            // 🟢 CORRECCIÓN 3: Comparación usando location_id
            const fieldsChanged =
                currentState.title !== eventInitialState.title ||
                currentState.description !== eventInitialState.description ||
                currentState.location_id !== eventInitialState.location_id || // <--- CORREGIDO
                currentState.capacity !== eventInitialState.capacity ||
                currentState.start !== eventInitialState.start ||
                currentState.end !== eventInitialState.end ||
                currentState.imageURL !== eventInitialState.imageURL;

            const fileChanged = imageFileInput.files.length > 0;

            return fieldsChanged || fileChanged;
        }

        async function loadEventRegistrationCount(eventId) {
            if (!eventId) {
                registrationsBtnContainer.style.display = 'none';
                currentRegisteredCount.textContent = '0';
                return 0;
            }

            try {
                const response = await fetch(`/api/events?action=getRegistrationCount&event_id=${eventId}`);
                const result = await response.json();

                if (result.success) {
                    const count = result.count || 0;
                    currentRegisteredCount.textContent = count;
                    registrationsBtnContainer.style.display = 'block';
                    return count;
                } else {
                    console.error("Fallo al obtener el conteo de inscritos:", result.message);
                    currentRegisteredCount.textContent = '0';
                    registrationsBtnContainer.style.display = 'none';
                    return 0;
                }

            } catch (error) {
                console.error("Error de red al obtener el conteo de inscritos:", error);
                currentRegisteredCount.textContent = '0';
                registrationsBtnContainer.style.display = 'none';
                return 0;
            }
        }

        // --- FUNCIONES DEL CALENDARIO ---
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
                        location_id: e.location_id || e.location,
                        capacity: e.capacity,
                        image_url: e.image_url
                    }
                }));
            } catch (e) {
                console.error("Error al obtener eventos:", e);
                if (typeof mostrarAlerta === 'function') {
                    mostrarAlerta("Error al cargar los eventos: " + e.message, "error");
                }
                return [];
            }
        }

        // --- Inicialización FullCalendar ---
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
                deleteEventBtn.style.display = "none";
                registrationsBtnContainer.style.display = 'none';
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
                const locationIdValue = extendedProps.location_id || extendedProps.location || "";

                eventIdInput.value = event.id;
                titleInput.value = event.title;
                descriptionInput.value = extendedProps.description || "";

                // 🟢 CORRECCIÓN 4: Asignar el ID de ubicación al campo SELECT
                locationIdSelect.value = locationIdValue; // <--- CORREGIDO

                capacityInput.value = extendedProps.capacity || "";
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

                await loadEventRegistrationCount(event.id);

                eventModal.show();
            },

            events: async (info, successCallback) => {
                const events = await fetchEvents();
                successCallback(events);
            }
        });

        calendar.render();

        // --- MANEJADORES DE EVENTOS (CALENDARIO) ---

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
            const capacity = capacityInput.value.trim();
            const locationId = locationIdSelect.value.trim();

            // 1. COMPROBACIÓN DE CAMBIOS
            if (id && !hasEventChanged()) {
                if (typeof mostrarAlerta === 'function') {
                    mostrarAlerta("No hay cambios para guardar.", "info");
                }
                eventModal.hide();
                return;
            }

            // 🔑 NUEVA VALIDACIÓN DE CAPACIDAD 🔑
            const parsedCapacity = parseInt(capacity);

            if (capacity.length > 0 && (isNaN(parsedCapacity) || parsedCapacity < 0)) {
                if (typeof mostrarAlerta === 'function') {
                    mostrarAlerta("No se puede colocar ese número en la capacidad máxima. Debe ser un número entero positivo o déjalo vacío/cero para aforo ilimitado.", "error");
                }
                return;
            }

            // 🔑 VALIDACIÓN: Debe seleccionar un lugar 🔑
            if (!locationId) {
                if (typeof mostrarAlerta === 'function') {
                    mostrarAlerta("Debes seleccionar una Ubicación para el evento.", "advertencia");
                }
                return;
            }

            if (!titleInput.value.trim() || !date || !startTime || !endTime) {
                if (typeof mostrarAlerta === 'function') {
                    mostrarAlerta("Completa todos los campos obligatorios (Título, Fecha, Hora inicio, Hora fin).", "advertencia");
                }
                return;
            }

            // 2. CONFIRMACIÓN ANTES DE GUARDAR
            let confirmado = true;
            if (id) {
                if (typeof mostrarConfirmacion === 'function') {
                    confirmado = await mostrarConfirmacion("¿Deseas guardar los cambios realizados en el evento?");
                } else {
                    confirmado = confirm("¿Deseas guardar los cambios realizados en el evento?");
                }
            }

            if (!confirmado) {
                return;
            }

            // --- Lógica de guardado ---

            const start = `${date}T${startTime}`;
            const end = `${date}T${endTime}`;

            const formData = new FormData();
            formData.append('title', titleInput.value.trim());
            formData.append('description', descriptionInput.value.trim());

            // 🟢 CORRECCIÓN 5: Envío del location_id al API
            formData.append('location_id', locationId); // <--- CORREGIDO

            formData.append('capacity', capacity);
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

                if (typeof mostrarAlerta === 'function') {
                    mostrarAlerta(id ? "Evento actualizado correctamente" : "Evento creado correctamente", "exito");
                }
                eventModal.hide();
                calendar.refetchEvents();
            } catch (e) {
                console.error("Error al guardar:", e);
                if (typeof mostrarAlerta === 'function') {
                    mostrarAlerta("Error al guardar evento: " + e.message, "error");
                }
            }
        });

        deleteEventBtn.addEventListener("click", async () => {
            if (!selectedEvent || !selectedEvent.id) {
                if (typeof mostrarAlerta === 'function') {
                    mostrarAlerta("No hay evento seleccionado", "info");
                }
                return;
            }

            let confirmado;
            if (typeof mostrarConfirmacion === 'function') {
                confirmado = await mostrarConfirmacion("¿Estás seguro de que quieres eliminar este evento?");
            } else {
                confirmado = confirm("¿Estás seguro de que quieres eliminar este evento?");
            }

            if (confirmado) {
                try {
                    const res = await fetch(`/api/events?id=${selectedEvent.id}`, { method: "DELETE" });
                    const data = await res.json();
                    if (!data.success) throw new Error(data.message || "Fallo al eliminar.");

                    if (typeof mostrarAlerta === 'function') {
                        mostrarAlerta("Evento eliminado correctamente", "exito");
                    }
                    eventModal.hide();
                    calendar.refetchEvents();
                } catch (e) {
                    console.error("Error al eliminar:", e);
                    if (typeof mostrarAlerta === 'function') {
                        mostrarAlerta("Error al eliminar evento", "error");
                    }
                }
            }
        });
    }

    // ====================================================================
    // 🚗 LÓGICA DE COCHE (SIN CAMBIOS)
    // ====================================================================

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
                    } else {
                        carPhotoContainer.style.display = 'none';
                    }
                }
            });

            clearCarPhotoBtn.addEventListener('click', (e) => {
                e.preventDefault();
                carPhotoUrlInput.value = "";
                carPhotoFileInput.value = "";
                carPhotoContainer.style.display = 'none';
            });
        }
    }

    // ====================================================================
    // 👥 NUEVA LÓGICA: GESTIÓN DE USUARIOS (CRUD ADMIN) - CORREGIDO
    // ====================================================================

    const userTableBody = document.getElementById("userTableBody");
    const userEditModalEl = document.getElementById("userEditModal");

    let userEditModal;
    if (userEditModalEl) {
        userEditModal = new bootstrap.Modal(userEditModalEl);

        const editUserId = document.getElementById("editUserId");
        const editUserName = document.getElementById("editUserName");
        const editUserEmail = document.getElementById("editUserEmail");
        const editUserRole = document.getElementById("editUserRole");
        const editUserPassword = document.getElementById("editUserPassword");
        const saveUserBtn = document.getElementById("saveUserBtn");
        const deleteUserBtn = document.getElementById("deleteUserBtn");

        // ----------------------------------------------------
        // 🚀 FUNCIÓN 1: CARGAR Y MOSTRAR USUARIOS
        // ----------------------------------------------------
        async function loadUsers() {
            if (!userTableBody) return;

            userTableBody.innerHTML = '<tr><td colspan="6">Cargando usuarios...</td></tr>';

            try {
                const res = await fetch("/api/users");
                const data = await res.json();

                if (!data.success || !Array.isArray(data.data)) throw new Error(data.message || "Fallo al obtener la lista de usuarios.");

                userTableBody.innerHTML = ''; // Limpiar el mensaje de carga

                data.data.forEach(user => {
                    const row = userTableBody.insertRow();
                    row.innerHTML = `
                        <td>${user.id}</td>
                        <td>${user.name}</td>
                        <td>${user.email}</td>
                        <td>${user.role}</td>
                        <td>${user.club_id || '-'}</td>
                        <td>
                            <button class="btn btn-sm btn-primary edit-user-btn" data-user='${JSON.stringify(user)}'>
                                Editar
                            </button>
                        </td>
                    `;
                });

                // Añadir listeners a los botones de edición
                document.querySelectorAll(".edit-user-btn").forEach(btn => {
                    btn.addEventListener("click", (e) => {
                        const userData = JSON.parse(e.currentTarget.getAttribute("data-user"));
                        openUserEditModal(userData);
                    });
                });

            } catch (e) {
                console.error("Error al cargar usuarios:", e);
                userTableBody.innerHTML = `<tr><td colspan="6">Error al cargar usuarios: ${e.message}</td></tr>`;
            }
        }

        // ----------------------------------------------------
        // 🚀 FUNCIÓN 2: ABRIR MODAL DE EDICIÓN
        // ----------------------------------------------------
        function openUserEditModal(user) {
            editUserId.value = user.id;
            editUserName.value = user.name;
            editUserEmail.value = user.email;
            editUserRole.value = user.role;
            editUserPassword.value = '';

            userEditModal.show();
        }

        // ----------------------------------------------------
        // 🚀 FUNCIÓN 3: GUARDAR EDICIÓN (CORREGIDO: Manejo de errores 400/500)
        // ----------------------------------------------------
        saveUserBtn.addEventListener("click", async () => {
            const id = editUserId.value;
            const name = editUserName.value.trim();
            const email = editUserEmail.value.trim();
            const role = editUserRole.value;
            const password = editUserPassword.value.trim();

            if (!id || !name || !email || !role) {
                if (typeof mostrarAlerta === 'function') {
                    mostrarAlerta("Faltan campos obligatorios para actualizar el usuario.", "error");
                }
                return;
            }

            const payload = {
                name: name,
                email: email,
                role: role,
            };

            if (password) {
                payload.password = password;
            }

            try {
                // 💥 CORRECCIÓN CRÍTICA: Asegurar la correcta captura de errores y el envío del ID
                const res = await fetch(`/api/users?id=${id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });

                const data = await res.json();

                if (!res.ok) {
                    // Si el servidor devuelve 400 o 500, capturamos el mensaje del body
                    throw new Error(data.message || `Fallo al guardar (${res.status})`);
                }

                if (typeof mostrarAlerta === 'function') {
                    mostrarAlerta("Usuario actualizado correctamente", "exito");
                }
                userEditModal.hide();
                loadUsers(); // Recargar la tabla
            } catch (e) {
                console.error("Error al actualizar usuario:", e);
                if (typeof mostrarAlerta === 'function') {
                    mostrarAlerta(`Error al actualizar usuario: ${e.message}`, "error");
                }
            }
        });

        // ----------------------------------------------------
        // 🚀 FUNCIÓN 4: ELIMINAR USUARIO (CORREGIDO: Manejo de errores 400/500)
        // ----------------------------------------------------
        deleteUserBtn.addEventListener("click", async () => {
            const id = editUserId.value;

            if (!id) return;

            let confirmado;
            if (typeof mostrarConfirmacion === 'function') {
                confirmado = await mostrarConfirmacion(`¿Estás seguro de que quieres eliminar al usuario con ID ${id}?`);
            } else {
                confirmado = confirm(`¿Estás seguro de que quieres eliminar al usuario con ID ${id}?`);
            }

            if (confirmado) {
                try {
                    // 💥 CORRECCIÓN CRÍTICA: Envío del ID en el query parameter para DELETE
                    const res = await fetch(`/api/users?id=${id}`, { method: "DELETE" });
                    const data = await res.json();

                    if (!res.ok) {
                        throw new Error(data.message || `Fallo al eliminar (${res.status})`);
                    }

                    if (typeof mostrarAlerta === 'function') {
                        mostrarAlerta("Usuario eliminado correctamente", "exito");
                    }
                    userEditModal.hide();
                    loadUsers(); // Recargar la tabla
                } catch (e) {
                    console.error("Error al eliminar usuario:", e);
                    if (typeof mostrarAlerta === 'function') {
                        mostrarAlerta(`Error al eliminar usuario: ${e.message}`, "error");
                    }
                }
            }
        });

        // Cargar usuarios al cargar la página si el elemento de tabla existe.
        if (userTableBody) {
            loadUsers();
        }
    }
});