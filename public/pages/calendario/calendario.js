document.addEventListener("DOMContentLoaded", async () => {
    // Inicialización de Modales de Bootstrap
    const eventViewModal = new bootstrap.Modal(document.getElementById('eventViewModal'));

    // --- ELEMENTOS DEL MODAL DE VISTA (eventViewModal) ---
    const modalImageContainer = document.getElementById("event-image-container");
    const modalImage = document.getElementById("modalImage");
    const modalTitle = document.getElementById("modalTitle");
    const modalDesc = document.getElementById("modalDesc");
    const modalLoc = document.getElementById("modalLoc");
    const modalStart = document.getElementById("modalStart");
    const modalEnd = document.getElementById("modalEnd");

    // --- ELEMENTOS DE INSCRIPCIÓN/CANCELACIÓN ---
    const registerBtn = document.getElementById("btn-register-event");
    const cancelBtn = document.getElementById("btn-cancel-event");
    const statusSpan = document.getElementById("registration-status");

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
    // ----------------------------------------------------

    const userName = document.getElementById("user-name");
    const loginIcon = document.getElementById("login-icon");
    const logoutBtn = document.getElementById("logout-btn");
    const calendarEl = document.getElementById("calendar");

    if (usuario) {
        userName.textContent = usuario.name;
        loginIcon.style.display = "none";
    }

    // 🔴 LÓGICA DE CIERRE DE SESIÓN PARA USUARIO
    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        sessionStorage.removeItem("usuario");
        if (typeof mostrarAlerta === 'function') {
            mostrarAlerta("Cierre de sesión exitoso.", 'exito', 1200);
        }
        setTimeout(() => {
            window.location.href = "../../index.html";
        }, 1200);
    });

    // ----------------------------------------------------
    // INICIALIZACIÓN DEL CALENDARIO FULLCALENDAR
    // ----------------------------------------------------

    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: "dayGridMonth",
        locale: "es",
        // En la vista de usuario, 'editable' debe ser false
        editable: false,
        selectable: false,

        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },

        // Función para cargar eventos (fetch)
        events: async (fetchInfo, successCallback, failureCallback) => {
            try {
                // RUTA: Apunta a /api/events
                const res = await fetch("/api/events");
                const data = await res.json();

                if (data.success && Array.isArray(data.data)) {
                    // Mapear eventos
                    const formattedEvents = data.data.map(e => ({
                        id: e.id,
                        title: e.title,
                        start: e.event_start,
                        end: e.event_end,
                        color: '#e50914', // Color de evento (rojo)
                        extendedProps: {
                            description: e.description,
                            location: e.location,
                            image_url: e.image_url
                        },
                    }));
                    successCallback(formattedEvents);
                } else {
                    successCallback([]);
                }
            } catch (err) {
                failureCallback(err);
                if (typeof mostrarAlerta === 'function') {
                    mostrarAlerta("Error al cargar eventos.", 'error');
                }
            }
        },

        // Al hacer clic en un evento existente (Ver evento)
        eventClick: (info) => {
            const e = info.event;
            const extendedProps = e.extendedProps;

            // Lógica para mostrar la información en el modal
            modalTitle.textContent = e.title;
            modalDesc.textContent = extendedProps.description || 'Sin descripción.';
            modalLoc.textContent = extendedProps.location || 'Ubicación no especificada.';

            // Formatear fechas
            const start = e.start.toLocaleString('es-ES', DATE_OPTIONS);
            const end = e.end ? e.end.toLocaleString('es-ES', DATE_OPTIONS) : 'No especificado';

            modalStart.textContent = start;
            modalEnd.textContent = end;

            // Mostrar imagen si existe
            if (extendedProps.image_url) {
                modalImage.src = extendedProps.image_url;
                modalImageContainer.style.display = 'block';
            } else {
                modalImageContainer.style.display = 'none';
            }

            // Configurar botones de inscripción/cancelación (Requiere la lógica de la API /api/userAction)
            registerBtn.setAttribute('data-event-id', e.id);
            cancelBtn.setAttribute('data-event-id', e.id);

            // Lógica de estado de inscripción (Simulación/Placeholder)
            // Aquí deberías hacer un fetch al backend para ver si el usuario está inscrito
            if (usuario) {
                statusSpan.textContent = 'Verificando estado...';
                // Lógica de fetch real para verificar inscripción...
                registerBtn.style.display = 'inline-block';
                cancelBtn.style.display = 'none';
                statusSpan.textContent = ''; // Limpiar después de la verificación
            } else {
                statusSpan.textContent = 'Inicia sesión para inscribirte.';
                registerBtn.style.display = 'none';
                cancelBtn.style.display = 'none';
            }

            eventViewModal.show();
        }
    });

    calendar.render();

    // ----------------------------------------------------
    // LÓGICA DE INSCRIPCIÓN Y CANCELACIÓN (PLACEHOLDER)
    // ----------------------------------------------------

    async function handleEventAction(action, eventId) {
        if (!usuario) {
            return mostrarAlerta('Debes iniciar sesión para realizar esta acción.', 'aviso');
        }

        const url = `/api/userAction`; // Asumiendo que esta API maneja las acciones

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    eventId: eventId,
                    userId: usuario.id,
                    action: action // 'register' o 'cancel'
                })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                mostrarAlerta(data.message, 'exito');
                eventViewModal.hide();
                calendar.refetchEvents(); // Opcional: recargar para actualizar colores/estado
            } else {
                mostrarAlerta(data.message || `Error al ${action === 'register' ? 'inscribirse' : 'cancelar'}.`, 'error');
            }
        } catch (error) {
            console.error('Error de red:', error);
            mostrarAlerta('Error de red al intentar la acción.', 'error');
        }
    }

    registerBtn.addEventListener('click', () => {
        const eventId = registerBtn.getAttribute('data-event-id');
        handleEventAction('register', eventId);
    });

    cancelBtn.addEventListener('click', () => {
        const eventId = cancelBtn.getAttribute('data-event-id');
        handleEventAction('cancel', eventId);
    });
});