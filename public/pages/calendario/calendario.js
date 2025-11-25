document.addEventListener("DOMContentLoaded", async () => {
    const modalImageContainer = document.getElementById("event-image-container");
    const modalImage = document.getElementById("modalImage");
    const modalTitle = document.getElementById("modalTitle");
    const modalDesc = document.getElementById("modalDesc");
    const modalLoc = document.getElementById("modalLoc");
    const modalStart = document.getElementById("modalStart");
    const modalEnd = document.getElementById("modalEnd");
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
        eventClick: (info) => {
            const e = info.event;
            const extendedProps = e.extendedProps;
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

            const eventModal = new bootstrap.Modal(document.getElementById('eventViewModal'));
            eventModal.show();
        },
    });
    calendar.render();

});
