document.addEventListener("DOMContentLoaded", () => {
    // ----------------------------------------------------
    // INICIALIZACIÓN DE VARIABLES Y ELEMENTOS
    // ----------------------------------------------------
    const calendarEl = document.getElementById("calendar");
    const logoutConfirmModal = new bootstrap.Modal(document.getElementById('logoutConfirmModal'));
    const logoutBtn = document.getElementById('logout-btn');
    const btnConfirmLogout = document.getElementById('btnConfirmLogout');

    // Comprobación de usuario administrador (Necesario para seguridad)
    const stored = sessionStorage.getItem('usuario'); 
    let usuario = null;
    try {
        usuario = stored ? JSON.parse(stored) : null;
    } catch (e) {
        console.error("Error al parsear usuario:", e);
    }

    if (!usuario || usuario.role !== 'admin') {
        // Redirigir si no es administrador (medida de seguridad básica)
        window.location.href = '../../../index.html'; 
        if (typeof mostrarAlerta === 'function') {
            mostrarAlerta("Acceso denegado. Se requiere ser Administrador.", 'error');
        }
        return;
    }


    // ----------------------------------------------------
    // LÓGICA DE CIERRE DE SESIÓN (Usando el modal de Bootstrap)
    // ----------------------------------------------------

    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        logoutConfirmModal.show();
    });

    btnConfirmLogout.addEventListener('click', () => {
        sessionStorage.removeItem("usuario");
        logoutConfirmModal.hide();

        if (typeof mostrarAlerta === 'function') {
            mostrarAlerta("Cierre de sesión exitoso.", 'exito', 1200);
        }
        
        // Retraso para ver la alerta antes de redirigir
        setTimeout(() => {
            window.location.href = "../../../index.html";
        }, 1200);
    });

    // ----------------------------------------------------
    // INICIALIZACIÓN DEL CALENDARIO FULLCALENDAR
    // ----------------------------------------------------

    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: "dayGridMonth",
        locale: "es",
        editable: true, // Permitir arrastrar y redimensionar eventos
        selectable: true, // Permitir seleccionar fechas
        
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },

        // Función para cargar eventos (fetch)
        events: async (fetchInfo, successCallback, failureCallback) => {
            try {
                // ❗ AQUI DEBE IR LA RUTA A TU API O SERVIDOR QUE DEVUELVE LOS EVENTOS
                const res = await fetch("/api/events"); 
                const data = await res.json();

                if (data.success && Array.isArray(data.data)) {
                    successCallback(data.data);
                } else {
                    successCallback([]);
                }
            } catch (err) {
                failureCallback(err);
                if (typeof mostrarAlerta === 'function') {
                    mostrarAlerta("Error al cargar eventos para la administración.", 'error');
                }
            }
        },

        // Al hacer clic en una fecha vacía (Crear nuevo evento)
        dateClick: (info) => {
            // Rellenar la fecha en el modal y abrirlo
            document.getElementById('eventId').value = '';
            document.getElementById('start-date').value = info.dateStr;
            document.getElementById('deleteEventBtn').style.display = 'none';

            const eventModal = new bootstrap.Modal(document.getElementById('eventModal'));
            eventModal.show();
            // Lógica para limpiar el formulario...
        },

        // Al hacer clic en un evento existente (Editar evento)
        eventClick: (info) => {
            const eventId = info.event.id;
            // Lógica para cargar detalles del evento con eventId y rellenar el modal...
            document.getElementById('eventId').value = eventId;
            document.getElementById('deleteEventBtn').style.display = 'inline-block';
            
            const eventModal = new bootstrap.Modal(document.getElementById('eventModal'));
            eventModal.show();
        },

        // Al arrastrar un evento (Actualizar fecha/hora)
        eventDrop: (info) => {
            // Lógica para enviar la nueva fecha/hora al servidor...
            if (typeof mostrarAlerta === 'function') {
                mostrarAlerta(`Evento '${info.event.title}' movido a ${info.event.startStr}`, 'aviso', 2000);
            }
        }
    });

    calendar.render();


    // ----------------------------------------------------
    // LÓGICA DE GUARDAR Y ELIMINAR EVENTOS EN EL MODAL
    // ----------------------------------------------------
    
    // ... Aquí iría la lógica para los botones #saveEventBtn y #deleteEventBtn ...
    
});