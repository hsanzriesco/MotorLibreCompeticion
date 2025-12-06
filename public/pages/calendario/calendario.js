document.addEventListener("DOMContentLoaded", async () => {
    const modalImageContainer = document.getElementById("event-image-container");
    const modalImage = document.getElementById("modalImage");
    const modalTitle = document.getElementById("modalTitle");
    const modalDesc = document.getElementById("modalDesc");
    const modalLoc = document.getElementById("modalLoc");
    const modalStart = document.getElementById("modalStart");
    const modalEnd = document.getElementById("modalEnd");
    // <-- ELEMENTOS DEL MODAL
    const registerBtn = document.getElementById("btn-register-event");
    const cancelBtn = document.getElementById("btn-cancel-event");
    const statusSpan = document.getElementById("registration-status");

    // Elemento para mostrar el estado del evento (solo se usará para "Finalizado")
    const eventStatusMessage = document.getElementById("event-status-message");

    // ---------------------------------
    const DATE_OPTIONS = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };

    // --- GESTIÓN DE USUARIO ---
    const stored = sessionStorage.getItem('usuario') || localStorage.getItem('usuario');
    let usuario = null;

    try {
        if (stored) {
            usuario = JSON.parse(stored);
        }
    } catch (e) {
        console.error("Error al parsear usuario:", e);
        sessionStorage.removeItem('usuario');
        localStorage.removeItem('usuario');
        usuario = null;
    }

    const userName = document.getElementById("user-name");
    const loginIcon = document.getElementById("login-icon");

    if (usuario) {
        userName.textContent = usuario.name;
        userName.style.display = "inline";
        loginIcon.style.display = "none";
    } else {
        userName.style.display = "none";
        loginIcon.style.display = "inline";
    }

    // --- FUNCIONES DE REGISTRO Y CANCELACIÓN ---

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
        if (!userId) {
            // Asumiendo que 'mostrarAlerta' es una función que existe globalmente
            mostrarAlerta("Debes iniciar sesión para inscribirte.", 'advertencia');
            setTimeout(() => window.location.href = '../auth/login/login.html', 1200);
            return;
        }

        // ⭐ CORRECCIÓN CRÍTICA: Chequeo de hora de fin usando getTime()
        const eventEndTimeString = registerBtn.getAttribute('data-event-end-time');
        if (eventEndTimeString) {
            const eventEndDate = new Date(eventEndTimeString);
            const now = new Date();

            // Comparamos los valores numéricos de tiempo (milisegundos) para evitar errores de zona horaria
            const eventEndTimeMs = eventEndDate.getTime();
            const nowTimeMs = now.getTime();

            // Usamos <= para incluir el instante exacto de finalización.
            if (eventEndTimeMs <= nowTimeMs) {
                mostrarAlerta("No es posible inscribirse. Este evento ya ha finalizado.", 'error');
                // Forzamos la ocultación de botones para reflejar el estado correcto
                registerBtn.style.display = 'none';
                cancelBtn.style.display = 'none';
                statusSpan.textContent = "";
                return;
            }
        }
        // ⭐ FIN CORRECCIÓN CRÍTICA

        registerBtn.disabled = true;
        statusSpan.textContent = "Inscribiendo...";

        try {
            // El BACKEND debe ser la fuente definitiva de verificación de la hora de fin.
            const res = await fetch('/api/events?action=register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id: userId,
                    event_id: eventId
                })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                mostrarAlerta(data.message, 'exito');
                updateRegistrationUI(true);
            } else {
                mostrarAlerta(data.message || 'Error desconocido al inscribir.', 'error');
                registerBtn.disabled = false;
                statusSpan.textContent = "";
            }
        } catch (error) {
            console.error("Error de red al inscribir:", error);
            mostrarAlerta('Error de red. Inténtalo de nuevo.', 'error');
            registerBtn.disabled = false;
            statusSpan.textContent = "";
        }
    }

    async function handleCancelRegistration(eventId, userId) {
        if (!userId) {
            mostrarAlerta("Error: Debes iniciar sesión para cancelar.", 'error');
            return;
        }

        cancelBtn.disabled = true;
        statusSpan.textContent = "Cancelando inscripción...";

        try {
            const res = await fetch(`/api/events?action=cancel&user_id=${userId}&event_id=${eventId}`, {
                method: 'DELETE',
            });

            const data = await res.json();

            if (res.ok && data.success) {
                mostrarAlerta(data.message, 'exito');
                updateRegistrationUI(false);
                // Si la cancelación es exitosa, se puede recargar el calendario para actualizar el color del evento
                calendar.refetchEvents();
            } else {
                mostrarAlerta(data.message || 'Error desconocido al cancelar.', 'error');
                cancelBtn.disabled = false;
                statusSpan.textContent = "";
            }
        } catch (error) {
            console.error("Error de red al cancelar:", error);
            mostrarAlerta('Error de red. Inténtalo de nuevo.', 'error');
            cancelBtn.disabled = false;
            statusSpan.textContent = "";
        }
    }

    function updateRegistrationUI(isRegistered) {
        // Esta función maneja la alternancia visible entre "Inscribirse" y "Cancelar"
        if (isRegistered) {
            registerBtn.style.display = 'none';
            cancelBtn.style.display = 'inline-block';
            cancelBtn.disabled = false;
            statusSpan.innerHTML = '<i class="bi bi-check-circle-fill text-success me-1"></i> Estás inscrito';
        } else {
            registerBtn.style.display = 'inline-block';
            registerBtn.disabled = false;
            cancelBtn.style.display = 'none';
            statusSpan.textContent = "";
        }
    }

    // ----------------------------------------------------------------------
    // LISTENERS
    // ----------------------------------------------------------------------

    registerBtn.addEventListener('click', (e) => {
        const eventId = e.currentTarget.getAttribute('data-event-id');
        const userId = (usuario && usuario.id) ? usuario.id : null;

        if (eventId) {
            handleRegistration(parseInt(eventId), userId);
        } else {
            // Llama a handleRegistration para manejar el caso de usuario no logeado (si userId es null)
            handleRegistration(null, userId);
        }
    });

    cancelBtn.addEventListener('click', (e) => {
        const eventId = e.currentTarget.getAttribute('data-event-id');
        const userId = (usuario && usuario.id) ? usuario.id : null;

        if (eventId && userId) {
            handleCancelRegistration(parseInt(eventId), userId);
        } else {
            mostrarAlerta('Error: Información de usuario o evento faltante.', 'error');
        }
    });
    // ----------------------------------------------------------------------


    const calendarEl = document.getElementById("calendar");
    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: "dayGridMonth",
        locale: "es",
        events: async (fetchInfo, successCallback, failureCallback) => {
            try {
                // Asumimos que esta API trae los datos de la tabla 'events'
                const res = await fetch("/api/events");
                const data = await res.json();
                if (data.success && Array.isArray(data.data)) successCallback(data.data);
                else successCallback([]);
            } catch (err) {
                failureCallback(err);
                if (typeof mostrarAlerta === 'function') {
                    mostrarAlerta("Error al cargar los eventos del calendario.", 'error');
                }
            }
        },
        eventClick: async (info) => {
            const e = info.event;
            const extendedProps = e.extendedProps;
            const eventId = e.id;

            // --- LECTURA DE LA HORA DE FIN (events.end) Y COMPARACIÓN ---
            const eventEndDate = new Date(e.end);
            const now = new Date();

            // ⭐ CAMBIO CRÍTICO: Comparamos los valores numéricos de tiempo (milisegundos)
            const eventEndTimeMs = eventEndDate.getTime();
            const nowTimeMs = now.getTime();

            // Usamos <= para incluir el instante exacto de finalización como "terminado"
            const isFinished = eventEndTimeMs <= nowTimeMs;

            // Limpiar el mensaje de estado previo
            eventStatusMessage.style.display = 'none';
            eventStatusMessage.classList.remove('alert-warning', 'alert-danger');
            eventStatusMessage.textContent = '';

            // 1. Restablecer la visibilidad de los botones al abrir el modal (estado predeterminado: Inscribirse)
            registerBtn.style.display = 'inline-block';
            cancelBtn.style.display = 'none';
            registerBtn.disabled = false;
            cancelBtn.disabled = false;
            statusSpan.textContent = "";
            // ---------------------------------------------------

            if (isFinished) {
                // 2. Lógica para evento FINALIZADO: Ocultar todo y mostrar alerta.
                eventStatusMessage.textContent = 'El evento ha finalizado.';
                eventStatusMessage.classList.add('alert-danger');
                eventStatusMessage.style.display = 'block';

                // Ocultar botones de inscripción/cancelación
                registerBtn.style.display = 'none';
                cancelBtn.style.display = 'none';
                statusSpan.textContent = ''; // Asegurar que el estado esté vacío
            }
            // ---------------------------------------------------

            modalTitle.textContent = e.title;
            modalDesc.textContent = extendedProps.description || "Sin descripción.";
            modalLoc.textContent = extendedProps.location || "Ubicación no especificada.";

            // Asegurar que las fechas se muestren correctamente
            const formattedStart = new Date(e.start).toLocaleDateString("es-ES", DATE_OPTIONS);
            const formattedEnd = eventEndDate.toLocaleDateString("es-ES", DATE_OPTIONS);

            modalStart.textContent = formattedStart;
            modalEnd.textContent = formattedEnd;

            const imageUrl = extendedProps.image_url;

            if (imageUrl) {
                modalImage.src = imageUrl;
                modalImageContainer.style.display = "block";
            } else {
                modalImage.src = "";
                modalImageContainer.style.display = "none";
            }

            registerBtn.setAttribute('data-event-id', eventId);
            cancelBtn.setAttribute('data-event-id', eventId);

            // Guardar la hora de fin en un atributo para el chequeo de seguridad en handleRegistration
            registerBtn.setAttribute('data-event-end-time', e.end);

            const userId = (usuario && usuario.id) ? usuario.id : null;

            if (!isFinished) {
                // 3. Lógica para evento ACTIVO: Gestionar si el usuario está inscrito o no.
                if (userId) {
                    const isRegistered = await checkRegistrationStatus(eventId, userId);
                    updateRegistrationUI(isRegistered);
                } else {
                    // Si no hay usuario, mostrar botón de inscripción (estado no inscrito)
                    updateRegistrationUI(false);
                }
            }
            // Si isFinished es true, los botones ya están ocultos por el punto 2.


            const eventModal = new bootstrap.Modal(document.getElementById('eventViewModal'));
            eventModal.show();
        },
    });
    calendar.render();
});