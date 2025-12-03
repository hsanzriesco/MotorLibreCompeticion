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
    const cancelBtn = document.getElementById("btn-cancel-event"); // 🟢 NUEVO
    const statusSpan = document.getElementById("registration-status");
    // ---------------------------------
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

    if (usuario) {
        userName.textContent = usuario.name;
        loginIcon.style.display = "none";
    }

    document.getElementById("logout-btn").addEventListener("click", (e) => {
        e.preventDefault();

        sessionStorage.removeItem("usuario");

        if (typeof mostrarAlerta === 'function') {
            mostrarAlerta("Has cerrado sesión correctamente.", 'error', 1500);
        }

        const offcanvasMenu = bootstrap.Offcanvas.getInstance(document.getElementById('offcanvasMenu'));
        if (offcanvasMenu) {
            offcanvasMenu.hide();
        }

        setTimeout(() => {
            window.location.href = "../auth/login/login.html";
        }, 1500);
    });

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

    // 🟢 NUEVA FUNCIÓN: Manejar la cancelación
    async function handleCancelRegistration(eventId, userId) {
        if (!userId) {
            mostrarAlerta("Error: Debes iniciar sesión para cancelar.", 'error');
            return;
        }

        cancelBtn.disabled = true;
        statusSpan.textContent = "Cancelando inscripción...";

        try {
            // Usamos DELETE para eliminar el registro en la DB
            const res = await fetch(`/api/events?action=cancel&user_id=${userId}&event_id=${eventId}`, {
                method: 'DELETE',
            });

            const data = await res.json();

            if (res.ok && data.success) {
                mostrarAlerta(data.message, 'exito');
                // Actualizar la UI: NO registrado
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
    // ----------------------------------------------------------------------


    // 🟢 MODIFICACIÓN: Ajustar updateRegistrationUI para el botón de cancelar
    function updateRegistrationUI(isRegistered) {
        if (isRegistered) {
            registerBtn.style.display = 'none';
            cancelBtn.style.display = 'inline-block'; // 🟢 Mostrar cancelar
            cancelBtn.disabled = false;
            statusSpan.innerHTML = '<i class="bi bi-check-circle-fill text-success me-1"></i> Estás **inscrito**';
        } else {
            registerBtn.style.display = 'inline-block';
            registerBtn.disabled = false;
            cancelBtn.style.display = 'none'; // 🟢 Ocultar cancelar
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
            handleRegistration(null, null);
        }
    });

    // 🟢 NUEVO EVENT LISTENER para el botón de Cancelar
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

            modalTitle.textContent = e.title;
            modalDesc.textContent = extendedProps.description || "Sin descripción.";
            modalLoc.textContent = extendedProps.location || "Ubicación no especificada.";
            modalStart.textContent = new Date(e.start).toLocaleDateString("es-ES", DATE_OPTIONS);
            modalEnd.textContent = new Date(e.end).toLocaleDateString("es-ES", DATE_OPTIONS);
            const imageUrl = extendedProps.image_url;

            if (imageUrl) {
                modalImage.src = imageUrl;
                modalImageContainer.style.display = "block";
            } else {
                modalImage.src = "";
                modalImageContainer.style.display = "none";
            }

            registerBtn.setAttribute('data-event-id', eventId);
            cancelBtn.setAttribute('data-event-id', eventId); // 🟢 Asignar eventId al botón de cancelar

            const userId = (usuario && usuario.id) ? usuario.id : null;

            if (userId) {
                const isRegistered = await checkRegistrationStatus(eventId, userId);
                updateRegistrationUI(isRegistered);
            } else {
                updateRegistrationUI(false);
                registerBtn.disabled = false;
            }

            const eventModal = new bootstrap.Modal(document.getElementById('eventViewModal'));
            eventModal.show();
        },
    });
    calendar.render();
});