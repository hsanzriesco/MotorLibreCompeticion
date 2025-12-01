document.addEventListener("DOMContentLoaded", async () => {
    const modalImageContainer = document.getElementById("event-image-container");
    const modalImage = document.getElementById("modalImage");
    const modalTitle = document.getElementById("modalTitle");
    const modalDesc = document.getElementById("modalDesc");
    const modalLoc = document.getElementById("modalLoc");
    const modalStart = document.getElementById("modalStart");
    const modalEnd = document.getElementById("modalEnd");
    // <-- NUEVOS ELEMENTOS DEL MODAL
    const registerBtn = document.getElementById("btn-register-event");
    const statusSpan = document.getElementById("registration-status");
    // ---------------------------------
    const DATE_OPTIONS = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };


    const stored = localStorage.getItem('usuario');
    let usuario = null;
    try {
        if (stored) usuario = JSON.parse(stored);
    } catch (e) {
        console.error("Error al parsear usuario:", e);
    }

    const userName = document.getElementById("user-name");
    const loginIcon = document.getElementById("login-icon");

    if (usuario) {
        userName.textContent = usuario.name;
        loginIcon.style.display = "none";
    }

    document.getElementById("logout-btn").addEventListener("click", (e) => {
        e.preventDefault();

        localStorage.removeItem("usuario");

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

    // --- NUEVAS FUNCIONES DE INSCRIPCIÓN ---

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
            // Redirigir si no está logueado
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
                // El backend espera user_id y event_id en el cuerpo
                body: JSON.stringify({
                    user_id: userId,
                    event_id: eventId
                })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                mostrarAlerta(data.message, 'exito');
                // Actualiza el estado visual después de una inscripción exitosa
                updateRegistrationUI(true);
            } else {
                mostrarAlerta(data.message || 'Error desconocido al inscribir.', 'error');
                registerBtn.disabled = false; // Habilita el botón si falla
                statusSpan.textContent = "";
            }
        } catch (error) {
            console.error("Error de red al inscribir:", error);
            mostrarAlerta('Error de red. Inténtalo de nuevo.', 'error');
            registerBtn.disabled = false;
            statusSpan.textContent = "";
        }
    }

    function updateRegistrationUI(isRegistered) {
        if (isRegistered) {
            registerBtn.style.display = 'none';
            statusSpan.innerHTML = '<i class="bi bi-check-circle-fill text-success me-1"></i> Estás **inscrito**';
        } else {
            registerBtn.style.display = 'inline-block';
            registerBtn.disabled = false;
            statusSpan.textContent = "";
        }
    }

    registerBtn.addEventListener('click', (e) => {
        const eventId = e.currentTarget.getAttribute('data-event-id');
        if (eventId && usuario && usuario.id) {
            handleRegistration(parseInt(eventId), usuario.id);
        } else if (!usuario) {
            handleRegistration(null, null); // Esto disparará la alerta de login
        }
    });

    // ----------------------------------------


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
        eventClick: async (info) => { // <-- CAMBIO: Hacemos eventClick async para la verificación
            const e = info.event;
            const extendedProps = e.extendedProps;
            const eventId = e.id; // FullCalendar usa 'id' para el ID del evento

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

            // --- Lógica de Inscripción al abrir el modal ---
            registerBtn.setAttribute('data-event-id', eventId);

            if (usuario && usuario.id) {
                const isRegistered = await checkRegistrationStatus(eventId, usuario.id);
                updateRegistrationUI(isRegistered);
            } else {
                // Si no hay usuario logueado, muestra el botón 'Inscribirse' pero al hacer click pedirá login.
                updateRegistrationUI(false);
                registerBtn.disabled = false;
            }
            // ---------------------------------------------


            const eventModal = new bootstrap.Modal(document.getElementById('eventViewModal'));
            eventModal.show();
        },
    });
    calendar.render();
});