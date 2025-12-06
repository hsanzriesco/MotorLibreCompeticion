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

    // --- NUEVA FUNCIÓN: Marca el evento como finalizado en la base de datos ---
    async function finalizeEventStatus(eventId) {
        const apiUrl = `/api/events?action=finalize&event_id=${eventId}`;

        // ⭐ NOTA: Tu servidor debe implementar el código para manejar esta solicitud 
        // y actualizar la tabla 'eventos_estado'.
        try {
            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    event_id: eventId,
                    status: 'Finalizado'
                })
            });

            const data = await res.json();

            if (data.success) {
                console.log(`Evento ${eventId} marcado como finalizado en la base de datos.`);
            } else {
                console.error(`Error al marcar el evento ${eventId} como finalizado:`, data.message);
            }

        } catch (error) {
            console.error("Error de red al intentar finalizar el evento:", error);
        }
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
            mostrarAlerta("Debes iniciar sesión para inscribirte.", 'advertencia');
            setTimeout(() => window.location.href = '../auth/login/login.html', 1200);
            return;
        }

        // Comprobación de estado del evento antes de intentar inscribir
        const eventEndDate = new Date(document.getElementById('modalEnd').textContent); // Usamos el texto del modalEnd
        const now = new Date();
        const diffMs = eventEndDate - now;

        if (diffMs < 0) {
            mostrarAlerta("No es posible inscribirse, este evento ya ha finalizado.", 'error');
            return;
        }

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

            // --- CÁLCULO PARA VERIFICAR SI EL EVENTO HA FINALIZADO ---
            const eventEndDate = new Date(e.end);
            const now = new Date();
            const diffMs = eventEndDate - now; // Diferencia en milisegundos

            // Limpiar el mensaje de estado previo
            eventStatusMessage.style.display = 'none';
            eventStatusMessage.classList.remove('alert-warning', 'alert-danger');
            eventStatusMessage.textContent = '';

            // Reestablecer la posibilidad de habilitar/deshabilitar botones por estado de registro
            registerBtn.disabled = false;
            cancelBtn.disabled = false;
            // ---------------------------------------------------

            if (diffMs < 0) {
                // Evento ya terminado (la fecha de fin ha pasado)
                eventStatusMessage.textContent = 'El evento ha finalizado.';
                eventStatusMessage.classList.add('alert-danger');
                eventStatusMessage.style.display = 'block';

                // ⭐ DESHABILITAR BOTONES PARA EVENTOS FINALIZADOS (Requisito cumplido)
                registerBtn.disabled = true;
                cancelBtn.disabled = true;

                // ⭐ LLAMADA AL BACKEND PARA GUARDAR EN 'eventos_estado' (Requisito cumplido)
                finalizeEventStatus(eventId);

            }
            // ---------------------------------------------------

            modalTitle.textContent = e.title;
            modalDesc.textContent = extendedProps.description || "Sin descripción.";
            modalLoc.textContent = extendedProps.location || "Ubicación no especificada.";
            modalStart.textContent = new Date(e.start).toLocaleDateString("es-ES", DATE_OPTIONS);
            modalEnd.textContent = eventEndDate.toLocaleDateString("es-ES", DATE_OPTIONS);
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

                // Si el evento terminó, los botones deben estar deshabilitados
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