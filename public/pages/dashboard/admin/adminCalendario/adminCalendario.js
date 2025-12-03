document.addEventListener('DOMContentLoaded', function () {
    // ======================================================
    // ⚙️ CONFIGURACIÓN DE RUTAS Y ELEMENTOS
    // ======================================================

    // Nota: Reemplaza esta URL por la URL real de tu API.
    const API_URL = 'http://localhost:3000/api/events';
    const LOGIN_URL = '../../auth/login/login.html'; // URL de redirección tras logout

    // Referencias a los Modales
    const eventModal = new bootstrap.Modal(document.getElementById('eventModal'));
    const logoutModal = new bootstrap.Modal(document.getElementById('logoutConfirmModal'));

    // Referencias a los Botones y Elementos del Modal de Evento
    const eventForm = document.getElementById('eventForm');
    const eventIdInput = document.getElementById('eventId');
    const titleInput = document.getElementById('title');
    const descriptionInput = document.getElementById('description');
    const locationInput = document.getElementById('location');
    const startDateInput = document.getElementById('start-date');
    const startTimeInput = document.getElementById('start-time');
    const endTimeInput = document.getElementById('end-time');
    const imageFileInput = document.getElementById('imageFile');
    const imageURLInput = document.getElementById('imageURL');
    const currentImageContainer = document.getElementById('currentImageContainer');
    const currentImagePreview = document.getElementById('currentImagePreview');
    const clearImageBtn = document.getElementById('clearImageBtn');
    const saveEventBtn = document.getElementById('saveEventBtn');
    const deleteEventBtn = document.getElementById('deleteEventBtn');

    // Referencias de Cierre de Sesión
    const logoutBtn = document.getElementById('logout-btn');
    const btnConfirmLogout = document.getElementById('btnConfirmLogout');

    // Inicialización del Calendario
    const calendarEl = document.getElementById('calendar');
    let calendar;


    // ======================================================
    // 🌐 FUNCIÓN FETCH GENÉRICA CON MANEJO DE TOKEN
    // ======================================================

    /**
     * Realiza una solicitud fetch a la API con manejo de tokens.
     * @param {string} url - URL de la API.
     * @param {string} method - Método HTTP (GET, POST, PUT, DELETE).
     * @param {Object} [body=null] - Cuerpo de la solicitud.
     * @param {boolean} [isFormData=false] - Indica si el cuerpo es FormData.
     * @returns {Promise<Object>} Respuesta JSON de la API.
     */
    async function apiFetch(url, method, body = null, isFormData = false) {
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('No se encontró el token de autenticación.');
            // Redirigir al login si no hay token
            window.location.href = LOGIN_URL;
            throw new Error('No autorizado');
        }

        const headers = {};
        if (!isFormData) {
            headers['Content-Type'] = 'application/json';
        }
        headers['Authorization'] = `Bearer ${token}`;

        const config = {
            method: method,
            headers: headers,
        };

        if (body) {
            config.body = isFormData ? body : JSON.stringify(body);
        }

        try {
            const response = await fetch(url, config);

            if (response.status === 401 || response.status === 403) {
                // Token expirado o no válido
                localStorage.removeItem('token');
                mostrarAlerta('Sesión expirada. Por favor, vuelve a iniciar sesión.', 'error');
                setTimeout(() => { window.location.href = LOGIN_URL; }, 1500);
                return;
            }

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Error en la solicitud: ${response.status}`);
            }

            // Manejar 204 No Content
            if (response.status === 204) {
                return {};
            }

            return await response.json();

        } catch (error) {
            console.error('Error en la comunicación con la API:', error);
            mostrarAlerta(error.message || 'Error de red.', 'error');
            throw error;
        }
    }


    // ======================================================
    // 📅 LÓGICA DEL CALENDARIO
    // ======================================================

    function initializeCalendar() {
        calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            locale: 'es',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay'
            },
            editable: true, // Permite arrastrar y redimensionar
            selectable: true, // Permite seleccionar fechas para crear
            dayMaxEvents: true,

            // Cargar eventos desde la API
            events: async function (fetchInfo, successCallback, failureCallback) {
                try {
                    const data = await apiFetch(API_URL, 'GET');
                    const events = data.events.map(event => ({
                        id: event._id,
                        title: event.title,
                        start: event.start_date, // FullCalendar manejará la conversión a fecha/hora si incluye hora
                        end: event.end_date,
                        extendedProps: {
                            description: event.description,
                            location: event.location,
                            image_url: event.image_url
                        }
                    }));
                    successCallback(events);
                } catch (error) {
                    failureCallback(error);
                }
            },

            // Click en un día para CREAR evento
            select: function (info) {
                resetForm('Crear Nuevo Evento');
                // Rellenar la fecha del inicio automáticamente (el día seleccionado)
                startDateInput.value = info.startStr.split('T')[0];
                // El campo end-date no lo usamos, solo las horas

                // Mostrar el modal
                eventModal.show();
                calendar.unselect(); // Deseleccionar el rango en el calendario
            },

            // Click en un evento para EDITAR/VER
            eventClick: function (info) {
                const event = info.event;
                resetForm('Editar Evento');

                // Rellenar Formulario
                eventIdInput.value = event.id;
                titleInput.value = event.title;
                descriptionInput.value = event.extendedProps.description || '';
                locationInput.value = event.extendedProps.location || '';
                imageURLInput.value = event.extendedProps.image_url || '';

                // Extraer fecha y hora
                const startDateTime = event.start;
                const endDateTime = event.end;

                if (startDateTime) {
                    const startLocal = new Date(startDateTime).toLocaleString('sv').replace(' ', 'T').slice(0, 16); // Formato YYYY-MM-DDTHH:mm
                    startDateInput.value = startLocal.split('T')[0];
                    startTimeInput.value = startLocal.split('T')[1];
                }

                if (endDateTime) {
                    const endLocal = new Date(endDateTime).toLocaleString('sv').replace(' ', 'T').slice(0, 16);
                    endTimeInput.value = endLocal.split('T')[1];
                } else {
                    // Si no hay hora de fin, podemos intentar calcular una hora por defecto o dejar vacío
                    endTimeInput.value = '';
                }

                // Mostrar/Ocultar botón de eliminar y datos de imagen
                deleteEventBtn.style.display = 'block';
                displayCurrentImage(imageURLInput.value);

                // Mostrar el modal
                eventModal.show();
            },

            // Drag and Drop (Mover Evento)
            eventDrop: function (info) {
                handleEventUpdateDate(info.event);
            },

            // Resize (Cambiar duración del Evento)
            eventResize: function (info) {
                handleEventUpdateDate(info.event);
            }
        });

        calendar.render();
    }


    // ======================================================
    // 💾 LÓGICA DE GESTIÓN DE EVENTOS (CRUD)
    // ======================================================

    // Maneja la actualización de fecha/hora por drag/drop o resize
    async function handleEventUpdateDate(event) {
        // FullCalendar ya maneja el cambio visual. Ahora actualizamos la BD.
        const start = event.start.toISOString();
        const end = event.end ? event.end.toISOString() : null;

        const eventData = {
            start_date: start,
            end_date: end
            // Aquí solo actualizamos fechas, el resto de datos se mantienen.
        };

        try {
            await apiFetch(`${API_URL}/${event.id}/date`, 'PUT', eventData);
            mostrarAlerta('Evento actualizado correctamente.', 'success');
        } catch (error) {
            mostrarAlerta('Error al actualizar el evento.', 'error');
            event.revert(); // Revertir el cambio visual si falla la API
        }
    }


    async function saveEvent(event) {
        event.preventDefault();

        if (!titleInput.value || !startDateInput.value || !startTimeInput.value || !endTimeInput.value) {
            mostrarAlerta('Por favor, rellena los campos obligatorios (*).', 'error');
            return;
        }

        const id = eventIdInput.value;
        const isNew = !id;
        const url = isNew ? API_URL : `${API_URL}/${id}`;
        const method = isNew ? 'POST' : 'PUT';

        // Combinar fecha y hora
        const startDateTime = `${startDateInput.value}T${startTimeInput.value}:00`;
        const endDateTime = `${startDateInput.value}T${endTimeInput.value}:00`;

        // Crear FormData para manejar la imagen
        const formData = new FormData();
        formData.append('title', titleInput.value);
        formData.append('description', descriptionInput.value);
        formData.append('location', locationInput.value);
        formData.append('start_date', startDateTime);
        formData.append('end_date', endDateTime);
        formData.append('image_url', imageURLInput.value); // URL de imagen existente (o vacía/null)

        if (imageFileInput.files.length > 0) {
            formData.append('imageFile', imageFileInput.files[0]); // Nuevo archivo de imagen
        }

        try {
            const data = await apiFetch(url, method, formData, true); // Es FormData

            mostrarAlerta(`Evento ${isNew ? 'creado' : 'actualizado'} correctamente.`, 'success');
            eventModal.hide();
            calendar.refetchEvents(); // Recargar el calendario

        } catch (error) {
            // La función apiFetch ya muestra la alerta
        }
    }


    async function deleteEvent() {
        const id = eventIdInput.value;
        if (!id) return;

        if (!confirm('¿Estás seguro de que quieres eliminar este evento? Esta acción es irreversible.')) {
            return;
        }

        try {
            // Nota: Asume que tu API maneja la eliminación de la imagen asociada.
            await apiFetch(`${API_URL}/${id}`, 'DELETE');

            mostrarAlerta('Evento eliminado correctamente.', 'success');
            eventModal.hide();
            calendar.refetchEvents();

        } catch (error) {
            // La función apiFetch ya muestra la alerta
        }
    }


    // ======================================================
    // 🖼️ LÓGICA DE IMAGEN Y FORMULARIO
    // ======================================================

    function resetForm(title) {
        eventForm.reset();
        document.querySelector('#eventModalLabel').textContent = title;
        eventIdInput.value = '';
        imageURLInput.value = '';
        currentImageContainer.style.display = 'none';
        deleteEventBtn.style.display = 'none';

        // Resetear el input de archivo por seguridad
        imageFileInput.value = '';
    }

    function displayCurrentImage(url) {
        if (url) {
            currentImagePreview.src = url;
            currentImageContainer.style.display = 'block';
        } else {
            currentImageContainer.style.display = 'none';
        }
    }

    clearImageBtn.addEventListener('click', () => {
        // Esto elimina la referencia a la URL existente y oculta la previsualización
        imageURLInput.value = '';
        currentImageContainer.style.display = 'none';
        // Esto resetea cualquier archivo que haya sido seleccionado por el usuario en esta sesión
        imageFileInput.value = '';
    });

    imageFileInput.addEventListener('change', () => {
        // Si se selecciona un nuevo archivo, anula la URL existente
        if (imageFileInput.files.length > 0) {
            imageURLInput.value = '';
            currentImageContainer.style.display = 'none';
        }
    });

    // ======================================================
    // 🚪 LÓGICA DE CIERRE DE SESIÓN
    // ======================================================

    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        logoutModal.show();
    });

    btnConfirmLogout.addEventListener('click', () => {
        // Simular la acción de logout (limpiar el token y redirigir)
        localStorage.removeItem('token');
        logoutModal.hide();
        mostrarAlerta('Cierre de sesión exitoso.', 'success');
        setTimeout(() => {
            window.location.href = LOGIN_URL;
        }, 500);
    });

    // ======================================================
    // 🚀 INICIALIZACIÓN
    // ======================================================

    // Asignar manejadores de eventos principales
    saveEventBtn.addEventListener('click', saveEvent);
    deleteEventBtn.addEventListener('click', deleteEvent);

    // Inicializar el calendario
    initializeCalendar();
});