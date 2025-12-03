document.addEventListener("DOMContentLoaded", () => {
    // ----------------------------------------------------
    // INICIALIZACIÓN DE VARIABLES Y ELEMENTOS
    // ----------------------------------------------------
    const calendarEl = document.getElementById("calendar");
    // Asumimos que Bootstrap y las funciones mostrarAlerta están disponibles globalmente.
    const eventModal = new bootstrap.Modal(document.getElementById('eventModal'));
    const logoutConfirmModal = new bootstrap.Modal(document.getElementById('logoutConfirmModal'));
    const logoutBtn = document.getElementById('logout-btn');
    const btnConfirmLogout = document.getElementById('btnConfirmLogout');

    // Elementos del formulario/modal de evento
    const eventIdInput = document.getElementById('eventId');
    const titleInput = document.getElementById('title');
    const descriptionInput = document.getElementById('description');
    const locationInput = document.getElementById('location');
    const startDateInput = document.getElementById('start-date');
    const startTimeInput = document.getElementById('start-time');
    const endTimeInput = document.getElementById('end-time');
    const deleteEventBtn = document.getElementById('deleteEventBtn');
    const saveEventBtn = document.getElementById('saveEventBtn');
    const imageFile = document.getElementById('imageFile');
    const imageURL = document.getElementById('imageURL');
    const currentImageContainer = document.getElementById('currentImageContainer');
    const currentImagePreview = document.getElementById('currentImagePreview');
    const clearImageBtn = document.getElementById('clearImageBtn');

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

    // Función para limpiar el formulario del modal
    function resetForm() {
        document.getElementById('eventForm').reset();
        eventIdInput.value = '';
        currentImageContainer.style.display = 'none';
        deleteEventBtn.style.display = 'none';
        // Asegurar que el título del modal sea 'Crear' por defecto
        document.querySelector('#eventModal .modal-title').textContent = 'Crear Nuevo Evento';
    }

    // Al cerrar el modal, limpiamos el formulario
    document.getElementById('eventModal').addEventListener('hidden.bs.modal', resetForm);

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

        // 🟢 CONFIGURACIÓN VISUAL COMO EL CALENDARIO PÚBLICO
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },

        // Función para cargar eventos (fetch)
        events: async (fetchInfo, successCallback, failureCallback) => {
            try {
                // RUTA CORREGIDA: Apunta a /api/events, que es la ruta manejada por events.js
                const res = await fetch("/api/events");
                const data = await res.json();

                if (data.success && Array.isArray(data.data)) {
                    // Mapear eventos si es necesario (ejemplo: añadir color)
                    const formattedEvents = data.data.map(e => ({
                        id: e.id,
                        title: e.title,
                        start: e.event_start, // Usar el campo correcto de tu DB
                        end: e.event_end,     // Usar el campo correcto de tu DB
                        // Propiedades extendidas para el modal de edición
                        extendedProps: {
                            description: e.description,
                            location: e.location,
                            image_url: e.image_url
                        },
                        // Color para admin, puedes usar uno diferente para distinguirlos visualmente
                        color: '#e50914'
                    }));
                    successCallback(formattedEvents);
                } else {
                    successCallback([]);
                }
            } catch (err) {
                failureCallback(err);
                if (typeof mostrarAlerta === 'function') {
                    mostrarAlerta("Error al cargar eventos: Verifique la API /api/events.", 'error');
                }
            }
        },

        // Al hacer clic en una fecha vacía (Crear nuevo evento)
        dateClick: (info) => {
            resetForm();
            // Llenar la fecha, e iniciar horas con un valor por defecto (ej. 12:00 a 14:00)
            startDateInput.value = info.dateStr;
            startTimeInput.value = '12:00';
            endTimeInput.value = '14:00';

            document.querySelector('#eventModal .modal-title').textContent = 'Crear Nuevo Evento';
            eventModal.show();
        },

        // Al hacer clic en un evento existente (Editar evento)
        eventClick: (info) => {
            const e = info.event;
            const extendedProps = e.extendedProps;

            resetForm(); // Limpiar antes de rellenar

            // 1. Rellenar ID y mostrar botón eliminar
            eventIdInput.value = e.id;
            deleteEventBtn.style.display = 'inline-block';
            document.querySelector('#eventModal .modal-title').textContent = 'Editar Evento';

            // 2. Rellenar campos de texto y descripción
            titleInput.value = e.title;
            descriptionInput.value = extendedProps.description || '';
            locationInput.value = extendedProps.location || '';

            // 3. Rellenar fechas y horas
            // FullCalendar ya maneja las fechas como objetos Date
            const start = e.start;
            const end = e.end;

            // Formatear la fecha a YYYY-MM-DD
            const formatDate = (date) => date.toISOString().split('T')[0];
            // Formatear la hora a HH:mm
            const formatTime = (date) => date.toTimeString().substring(0, 5);

            startDateInput.value = formatDate(start);
            startTimeInput.value = formatTime(start);
            // El campo end puede ser null en eventos de todo el día o no estar bien definido, 
            // usamos la fecha de inicio si end es null o no es un objeto Date válido.
            endTimeInput.value = end ? formatTime(end) : '14:00';

            // 4. Rellenar/mostrar imagen
            const imageUrl = extendedProps.image_url;
            imageURL.value = imageUrl || '';
            if (imageUrl) {
                currentImagePreview.src = imageUrl;
                currentImageContainer.style.display = 'block';
            } else {
                currentImageContainer.style.display = 'none';
            }

            eventModal.show();
        },

        // Al arrastrar/soltar un evento (Actualizar fecha/hora)
        eventDrop: async (info) => {
            const e = info.event;
            const id = e.id;

            // Revertir visualmente antes de la llamada API en caso de error
            info.revert();

            // Recalcular las nuevas fechas/horas UTC
            const newStart = e.start.toISOString().substring(0, 16);
            const newEnd = e.end ? e.end.toISOString().substring(0, 16) : null;

            // Datos mínimos para la actualización
            const updateData = {
                start: newStart,
                end: newEnd,
                // Opcional: puedes enviar el resto de datos si quieres
            };

            try {
                const res = await fetch(`/api/events?id=${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updateData)
                });

                if (res.ok) {
                    mostrarAlerta(`Evento '${e.title}' movido con éxito.`, 'exito', 2000);
                    calendar.refetchEvents(); // Recargar para asegurar la consistencia
                } else {
                    const data = await res.json();
                    mostrarAlerta(data.message || 'Error al guardar el movimiento.', 'error');
                }
            } catch (error) {
                console.error('Error de red al mover el evento:', error);
                mostrarAlerta('Error de red al mover el evento.', 'error');
            }
        }
    });

    calendar.render();


    // ----------------------------------------------------
    // LÓGICA DEL MODAL: QUITAR IMAGEN
    // ----------------------------------------------------
    clearImageBtn.addEventListener('click', () => {
        imageFile.value = ''; // Limpiar el input de archivo
        imageURL.value = ''; // Limpiar el campo oculto de URL (Esto indica al backend que debe borrar la imagen si existía)
        currentImageContainer.style.display = 'none'; // Ocultar la previsualización
        if (typeof mostrarAlerta === 'function') {
            mostrarAlerta('La imagen se eliminará al guardar.', 'aviso', 1500);
        }
    });

    // ----------------------------------------------------
    // LÓGICA DEL MODAL: GUARDAR (CREAR/EDITAR) - POST/PUT
    // ----------------------------------------------------
    saveEventBtn.addEventListener('click', async () => {
        const id = eventIdInput.value;
        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/events?id=${id}` : '/api/events';

        if (!titleInput.value || !startDateInput.value || !startTimeInput.value || !endTimeInput.value) {
            return mostrarAlerta("Por favor, rellena el título y las fechas/horas obligatorias.", 'error');
        }

        // Recolectar datos del formulario
        const formData = new FormData();
        formData.append('title', titleInput.value);
        formData.append('description', descriptionInput.value);
        formData.append('location', locationInput.value);

        // Combinar fecha y hora
        const startDateTime = `${startDateInput.value}T${startTimeInput.value}:00`;
        const endDateTime = `${startDateInput.value}T${endTimeInput.value}:00`;

        formData.append('start', startDateTime);
        formData.append('end', endDateTime);

        // Imagen (Subida o URL existente/vacia)
        if (imageFile.files.length > 0) {
            // Se subió un archivo nuevo
            formData.append('imageFile', imageFile.files[0]);
            // Importante: no enviar 'imageURL' en el FormData si hay un archivo, o enviar vacío si tu backend lo requiere
            formData.append('imageURL', '');
        } else {
            // Si no hay archivo nuevo, enviar la URL existente/vacía (para mantener o borrar)
            formData.append('imageURL', imageURL.value);
        }

        try {
            saveEventBtn.disabled = true;
            const res = await fetch(url, {
                method: method,
                body: formData // FormData se envía automáticamente como multipart/form-data
            });

            const data = await res.json();

            if (res.ok && data.success) { // Usamos res.ok para verificar el estado HTTP 2xx
                mostrarAlerta(`Evento ${id ? 'actualizado' : 'creado'} con éxito.`, 'exito');
                eventModal.hide();
                calendar.refetchEvents(); // Recargar el calendario
            } else {
                mostrarAlerta(data.message || `Error al ${id ? 'actualizar' : 'crear'} el evento.`, 'error');
            }

        } catch (error) {
            console.error('Error al guardar evento:', error);
            mostrarAlerta('Error de red al conectar con el servidor.', 'error');
        } finally {
            saveEventBtn.disabled = false;
        }
    });

    // ----------------------------------------------------
    // LÓGICA DEL MODAL: ELIMINAR - DELETE
    // ----------------------------------------------------

    deleteEventBtn.addEventListener('click', async () => {
        const id = eventIdInput.value;
        if (!id) return;

        if (!confirm('¿Estás seguro de que quieres eliminar este evento?')) {
            return;
        }

        try {
            const res = await fetch(`/api/events?id=${id}`, { method: 'DELETE' });
            const data = await res.json();

            if (res.ok && data.success) {
                mostrarAlerta('Evento eliminado correctamente.', 'exito');
                eventModal.hide();
                calendar.refetchEvents();
            } else {
                mostrarAlerta(data.message || 'Error al eliminar el evento.', 'error');
            }
        } catch (error) {
            console.error('Error de red al eliminar:', error);
            mostrarAlerta('Error de red al eliminar.', 'error');
        }
    });
});