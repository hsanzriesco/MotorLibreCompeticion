document.addEventListener("DOMContentLoaded", async () => {
    // 1. Obtener referencias de la imagen y otros elementos
    const modalImageContainer = document.getElementById("event-image-container");
    const modalImage = document.getElementById("modalImage");

    // Lógica para obtener el usuario de localStorage (ajustar si usas sessionStorage)
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

    // 2. Lógica de Cerrar Sesión
    document.getElementById("logout-btn").addEventListener("click", (e) => {
        e.preventDefault();

        localStorage.removeItem("usuario");

        if (typeof mostrarAlerta === 'function') {
            mostrarAlerta("Has cerrado sesión correctamente.", 'error', 1500);
        }

        // Asegúrate de que bootstrap sea globalmente accesible aquí
        const offcanvasMenu = bootstrap.Offcanvas.getInstance(document.getElementById('offcanvasMenu'));
        if (offcanvasMenu) {
            offcanvasMenu.hide();
        }

        setTimeout(() => {
            window.location.href = "../auth/login/login.html";
        }, 1500);
    });


    // 3. Inicialización de FullCalendar y manejo de eventos
    const calendarEl = document.getElementById("calendar");
    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: "dayGridMonth",
        locale: "es",
        // Fuente de eventos desde la API
        events: async (fetchInfo, successCallback, failureCallback) => {
            try {
                // Asegúrate de que la API /api/events devuelva la columna 'image_url'
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
        // Manejo del click en un evento
        eventClick: (info) => {
            const e = info.event;
            const extendedProps = e.extendedProps;

            // Rellenar datos del modal
            document.getElementById("modalTitle").textContent = e.title;
            document.getElementById("modalDesc").textContent = extendedProps.description || "Sin descripción.";
            document.getElementById("modalLoc").textContent = extendedProps.location || "Ubicación no especificada.";
            document.getElementById("modalDate").textContent = new Date(e.start).toLocaleDateString("es-ES");

            // ⭐ LÓGICA DE LA IMAGEN ⭐
            // La URL DEBE estar en extendedProps.image_url
            const imageUrl = extendedProps.image_url;

            if (imageUrl) {
                modalImage.src = imageUrl;
                modalImageContainer.style.display = "block"; // Mostrar el contenedor
            } else {
                modalImage.src = "";
                modalImageContainer.style.display = "none"; // Ocultar el contenedor
            }

            // ⭐ USAR LA API DE BOOTSTRAP PARA EL MODAL RESPONSIVO ⭐
            const eventModal = new bootstrap.Modal(document.getElementById('eventViewModal'));
            eventModal.show();
        },
    });
    calendar.render();

    // 4. Se elimina el listener de 'closeModalBtn' ya que data-bs-dismiss="modal" lo maneja.
});