document.addEventListener("DOMContentLoaded", async () => {
    // ----------------------------------------------------
    // REFERENCIAS DE ELEMENTOS Y VARIABLES GLOBALES
    // ----------------------------------------------------
    const modalImageContainer = document.getElementById("event-image-container");
    const modalImage = document.getElementById("modalImage");
    const modalTitle = document.getElementById("modalTitle");
    const modalDesc = document.getElementById("modalDesc");
    const modalLoc = document.getElementById("modalLoc");
    const modalStart = document.getElementById("modalStart");
    const modalEnd = document.getElementById("modalEnd");
    // <-- ELEMENTOS DEL MODAL DE VISUALIZACIÓN

    const registerBtn = document.getElementById("btn-register-event");
    const cancelBtn = document.getElementById("btn-cancel-event");
    const statusSpan = document.getElementById("registration-status");

    // <-- ELEMENTOS DEL MODAL DE CREACIÓN/EDICIÓN
    const eventCreateEditModal = new bootstrap.Modal(document.getElementById('eventCreateEditModal'));
    const eventForm = document.getElementById('eventForm');
    const btnSaveEvent = document.getElementById('btnSaveEvent');
    const eventLocationSelect = document.getElementById('eventLocation'); // 🎯 NUEVO ELEMENTO

    const DATE_OPTIONS = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };


    // --- GESTIÓN DE USUARIO ---
    const stored = sessionStorage.getItem('usuario');
    let usuario = null;
    try {
        if (stored) {
            usuario = JSON.parse(stored);
        }
    } catch (e) {
        console.error("Error al parsear usuario:", e);
    }

    const userName = document.getElementById("user-name");
    const loginIcon = document.getElementById("login-icon");

    if (usuario) {
        userName.textContent = usuario.name;
        loginIcon.style.display = "none";
    }

    // Lógica de cierre de sesión (simplificada)
    document.getElementById("logout-btn").addEventListener("click", (e) => {
        // La lógica de logout completa está en el <script> inline de calendario.html
        // Esta parte puede eliminarse si se confía en el script inline
    });
    // ----------------------------------------------------

    // --- FUNCIONES DE REGISTRO Y CANCELACIÓN (Sin cambios) ---
    async function checkRegistrationStatus(eventId, userId) {
        if (!userId) return false;
        try {
            const res = await fetch(`/api/events?action=checkRegistration&event_id=${eventId}&user_id=${userId}`);
            const data = await res.json();
            return data.success && data.isRegistered;
        } catch (error) {
            console.error("Error al verificar inscripción:", error);
            return false;
        }
    }

    async function handleRegistration(eventId, userId) {
        // ... (Tu código de handleRegistration sigue aquí, sin cambios) ...
    }

    async function handleCancelRegistration(eventId, userId) {
        // ... (Tu código de handleCancelRegistration sigue aquí, sin cambios) ...
    }

    function updateRegistrationUI(isRegistered) {
        // ... (Tu código de updateRegistrationUI sigue aquí, sin cambios) ...
    }
    // ----------------------------------------------------


    // 🎯 NUEVA FUNCIÓN: CARGAR LUGARES 🎯
    /**
     * Obtiene la lista de lugares de /api/locations y llena el <select> del formulario.
     */
    async function loadLocations() {
        // Limpiar opciones previas, excepto la primera (Selecciona un Lugar...)
        eventLocationSelect.innerHTML = '<option value="">Selecciona un Lugar...</option>'; 

        try {
            // Llama al endpoint GET de /api/locations que devuelve todos los lugares
            const res = await fetch('/api/locations'); 
            const data = await res.json();

            if (data.success && Array.isArray(data.data)) {
                data.data.forEach(location => {
                    const option = document.createElement('option');
                    // El valor es el ID, que es lo que necesitamos guardar en la BD del evento
                    option.value = location.id; 
                    option.textContent = `${location.name} (${location.city})`;
                    eventLocationSelect.appendChild(option);
                });
            } else {
                console.error("Error al cargar lugares:", data.message || "Respuesta API inválida.");
                if (typeof mostrarAlerta === 'function') {
                    mostrarAlerta("No se pudieron cargar los lugares para el evento.", 'error');
                }
            }
        } catch (error) {
            console.error("Error de red al cargar lugares:", error);
            if (typeof mostrarAlerta === 'function') {
                mostrarAlerta("Error de red al obtener la lista de lugares.", 'error');
            }
        }
    }

    // Llamamos a la función al inicio para llenar el desplegable
    loadLocations();


    // 💾 NUEVA FUNCIÓN: MANEJAR EL GUARDADO DEL EVENTO 💾
    /**
     * Recoge los datos del formulario y los envía a la API para guardar o actualizar.
     */
    async function handleSaveEvent(e) {
        e.preventDefault();

        const title = document.getElementById('eventTitle').value;
        const description = document.getElementById('eventDescription').value;
        const imageUrl = document.getElementById('eventImageUrl').value;
        const start = document.getElementById('eventStart').value;
        const end = document.getElementById('eventEnd').value;
        const locationId = eventLocationSelect.value; // 🎯 Obtenemos el ID del lugar
        const eventId = document.getElementById('eventId').value; // Para edición (si aplica)

        if (!title || !start || !end || !locationId) {
            if (typeof mostrarAlerta === 'function') {
                mostrarAlerta("Por favor, completa todos los campos obligatorios (Título, Inicio, Fin, Lugar).", 'advertencia');
            }
            return;
        }
        
        btnSaveEvent.disabled = true;

        const eventData = {
            title,
            description,
            image_url: imageUrl,
            start_date: start,
            end_date: end,
            location_id: locationId, // Enviamos el ID del lugar
        };

        const isEditing = eventId !== "";
        let url = isEditing ? `/api/events?id=${eventId}` : '/api/events';
        let method = isEditing ? 'PUT' : 'POST';

        try {
            const res = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(eventData)
            });

            const data = await res.json();

            if (res.ok && data.success) {
                if (typeof mostrarAlerta === 'function') {
                    mostrarAlerta(data.message || `Evento ${isEditing ? 'actualizado' : 'creado'} correctamente.`, 'exito');
                }
                eventCreateEditModal.hide();
                calendar.refetchEvents(); // Recarga los eventos del calendario
            } else {
                if (typeof mostrarAlerta === 'function') {
                    mostrarAlerta(data.message || `Error al ${isEditing ? 'actualizar' : 'crear'} el evento.`, 'error');
                }
            }
        } catch (error) {
            console.error("Error de red al guardar evento:", error);
            if (typeof mostrarAlerta === 'function') {
                mostrarAlerta('Error de red. Inténtalo de nuevo.', 'error');
            }
        } finally {
            btnSaveEvent.disabled = false;
        }
    }

    // Listener para el formulario de guardado
    eventForm.addEventListener('submit', handleSaveEvent);


    // ----------------------------------------------------------------------
    // FULLCALENDAR INICIALIZACIÓN
    // ----------------------------------------------------------------------

    // LISTENERS (Existentes)
    registerBtn.addEventListener('click', (e) => {
        // ... (Tu código de registerBtn listener sigue aquí, sin cambios) ...
    });

    cancelBtn.addEventListener('click', (e) => {
        // ... (Tu código de cancelBtn listener sigue aquí, sin cambios) ...
    });
    
    const calendarEl = document.getElementById("calendar");
    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: "dayGridMonth",
        locale: "es",
        editable: true, // Habilitar la edición de eventos si el usuario es administrador
        
        // 🟢 NUEVO: dateClick para abrir la modal de creación 
        dateClick: (info) => {
            // Solo permitir crear eventos a usuarios autenticados (y con permisos, si aplica)
            if (!usuario) {
                if (typeof mostrarAlerta === 'function') {
                    mostrarAlerta("Debes iniciar sesión para crear eventos.", 'advertencia');
                }
                return;
            }

            // Si tienes un rol de administrador, puedes agregarlo aquí
            // if (usuario.role !== 'admin') { ... }

            // 1. Limpiar/Resetear formulario
            eventForm.reset(); 
            document.getElementById('eventId').value = ""; // Asegurar que es una creación, no edición
            
            // 2. Establecer fechas por defecto
            document.getElementById('eventStart').value = info.dateStr.slice(0, 16); 
            document.getElementById('eventEnd').value = info.dateStr.slice(0, 16); 
            
            // 3. Actualizar títulos de la modal
            document.getElementById('eventCreateEditModalLabel').textContent = 'Crear Nuevo Evento';
            document.getElementById('btnSaveEvent').textContent = 'Guardar Evento';
            
            // 4. Asegurar que los lugares estén cargados
            loadLocations(); 

            // 5. Mostrar la modal
            eventCreateEditModal.show();
        },

        events: async (fetchInfo, successCallback, failureCallback) => {
            // ... (Tu código de events sigue aquí, sin cambios) ...
        },
        eventClick: async (info) => {
            // ... (Tu código de eventClick sigue aquí, sin cambios) ...
        },
    });
    calendar.render();
});
