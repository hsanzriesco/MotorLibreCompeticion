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

    // ⭐ NUEVO ELEMENTO: Mensaje de estado del evento (a punto de terminar)
    const eventStatusMessage = document.getElementById("event-status-message");

    // ---------------------------------
    const DATE_OPTIONS = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };


    // --- GESTIÓN DE USUARIO (SOLO PARA DISPONIBILIDAD) ---
    const stored = sessionStorage.getItem('usuario') || localStorage.getItem('usuario');
    let usuario = null;

    // Bloque Try-Catch para parsear el usuario
    try {
        if (stored) {
            usuario = JSON.parse(stored);
        }
    } catch (e) {
        console.error("Error al parsear usuario:", e);
        // Sesión corrupta, limpiar ambas (la navegación será manejada por navbar.js)
        sessionStorage.removeItem('usuario');
        localStorage.removeItem('usuario');
        // Aseguramos que usuario sea null
        usuario = null;
    }
    // ----------------------------------------------------

    // ----------------------------------------------------

    const userName = document.getElementById("user-name");
    const loginIcon = document.getElementById("login-icon");

    // Si hay usuario, actualizamos la interfaz de navegación
    if (usuario) {
        userName.textContent = usuario.name;
        userName.style.display = "inline";
        loginIcon.style.display = "none";
    } else {
        // Si no hay usuario, aseguramos que se muestre el icono de login
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
            // Si el usuario intenta inscribirse sin sesión, mostramos la alerta y redirigimos
            mostrarAlerta("Debes iniciar sesión para inscribirte.", 'advertencia');
            // Usamos la ruta relativa correcta desde calendario.html
            setTimeout(() => window.location.href = '../auth/login/login.html', 1200);
            return;
        }
        // ... (resto de la función handleRegistration, sin cambios)
        registerBtn.disabled = true;
        statusSpan.textContent = "Inscribiendo...";

        try {
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
        // ... (resto de la función handleCancelRegistration, sin cambios)
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

        if (eventId && userId) {
            handleRegistration(parseInt(eventId), userId);
        } else {
            // Llamamos a handleRegistration para que maneje la redirección si no hay userId
            handleRegistration(null, userId);
        }
    });

    cancelBtn.addEventListener('click', (e) => {
        const eventId = e.currentTarget.getAttribute('data-event-id');
        const userId = (usuario && usuario.id) ? usuario.id : null;

        if (eventId && userId) {
            handleCancelRegistration(parseInt(eventId), userId);
        } else {
            // Este caso solo debería ocurrir si el usuario manipula la UI
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

            // --- CÁLCULO DE AVISO DE TIEMPO RESTANTE (10 MIN) ⭐ MODIFICADO ---
            const eventEndDate = new Date(e.end);
            const now = new Date();
            const diffMs = eventEndDate - now; // Diferencia en milisegundos

            // ⭐ VALOR CAMBIADO DE 15 MIN A 10 MIN
            const terminationWarningMs = 10 * 60 * 1000; // 10 minutos

            // Limpiar el mensaje de estado previo
            eventStatusMessage.style.display = 'none';
            eventStatusMessage.classList.remove('alert-warning', 'alert-danger');
            eventStatusMessage.textContent = '';

            // Reestablecer la posibilidad de habilitar/deshabilitar botones por estado de registro
            registerBtn.disabled = false;
            cancelBtn.disabled = false;
            // ---------------------------------------------------

            if (diffMs > 0 && diffMs <= terminationWarningMs) {
                // Evento a punto de terminar (10 min o menos, pero no ha terminado)
                eventStatusMessage.textContent = 'El evento está a punto de terminar.';
                eventStatusMessage.classList.add('alert-warning');
                eventStatusMessage.style.display = 'block';

            } else if (diffMs < 0) {
                // Evento ya terminado (la fecha de fin ha pasado)
                eventStatusMessage.textContent = 'El evento ha finalizado.';
                eventStatusMessage.classList.add('alert-danger');
                eventStatusMessage.style.display = 'block';

                // Deshabilitar botones de registro/cancelación si el evento terminó
                registerBtn.disabled = true;
                cancelBtn.disabled = true;

            }
            // ---------------------------------------------------

            modalTitle.textContent = e.title;
            modalDesc.textContent = extendedProps.description || "Sin descripción.";
            modalLoc.textContent = extendedProps.location || "Ubicación no especificada.";
            modalStart.textContent = new Date(e.start).toLocaleDateString("es-ES", DATE_OPTIONS);
            modalEnd.textContent = eventEndDate.toLocaleDateString("es-ES", DATE_OPTIONS); // Usamos eventEndDate para el formato
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


            const userId = (usuario && usuario.id) ? usuario.id : null;

            if (userId) {
                const isRegistered = await checkRegistrationStatus(eventId, userId);
                updateRegistrationUI(isRegistered);

                // Si el evento terminó, los botones de inscripción/cancelación deben estar deshabilitados, 
                // incluso después de la actualización de UI
                if (diffMs < 0) {
                    registerBtn.disabled = true;
                    cancelBtn.disabled = true;
                }
            } else {
                // Si no hay usuario, mostramos el botón de registro pero sin estado de inscripción
                updateRegistrationUI(false);
                // Si el evento terminó, deshabilitamos el botón para invitados
                if (diffMs < 0) {
                    registerBtn.disabled = true;
                } else {
                    registerBtn.disabled = false;
                }
            }

            const eventModal = new bootstrap.Modal(document.getElementById('eventViewModal'));
            eventModal.show();
        },
    });
    calendar.render();
});