document.addEventListener('DOMContentLoaded', () => {
    // =======================================
    // CONFIGURACIÓN DE ENDPOINTS
    // ** ADAPTAR A TU RUTA REAL DE API **
    // =======================================
    const API_BASE_URL = 'http://localhost:3000/api'; // Ejemplo
    const CLUBES_ENDPOINT = `${API_BASE_URL}/clubes`;
    const USERS_ENDPOINT = `${API_BASE_URL}/users`;

    // =======================================
    // ELEMENTOS DEL DOM
    // =======================================
    const clubForm = document.getElementById('club-form');
    const tablaActivos = document.getElementById('tabla-clubes-activos');
    const tablaPendientes = document.getElementById('tabla-clubes-pendientes');
    const badgePendientes = document.getElementById('badge-pendientes');
    const presidenteSelect = document.getElementById('presidente-select');
    const presidenteSelectContainer = document.getElementById('presidente-select-container');

    // Modales de Confirmación
    const deleteConfirmModal = new bootstrap.Modal(document.getElementById('deleteConfirmModal'));
    const statusConfirmModal = new bootstrap.Modal(document.getElementById('statusConfirmModal'));
    const btnConfirmDelete = document.getElementById('btnConfirmDelete');
    const btnConfirmStatus = document.getElementById('btnConfirmStatus');

    let clubIdToDelete = null;
    let clubToChangeStatus = null;

    // Obtener Token
    const adminToken = localStorage.getItem('adminToken');
    if (!adminToken) {
        mostrarAlerta('No autorizado. Por favor, inicie sesión.', 'danger');
        window.location.href = '../../../login.html'; // Ajusta tu ruta de login
        return;
    }

    // =======================================
    // FUNCIONES DE UTILIDAD
    // =======================================

    /**
     * Resetea el formulario de creación/edición de club.
     */
    function resetFormularioClub() {
        clubForm.reset();
        document.getElementById('club-id').value = '';
        document.getElementById('id_presidente').value = '';
        presidenteSelectContainer.style.display = 'none';
        document.getElementById('fecha_creacion').value = '';
        // Cambiar el título a "Guardar Club" si es necesario
        document.querySelector('.admin-section h3.text-danger').textContent = 'Guardar Club';
    }

    /**
     * Rellena el select de presidentes con usuarios no administradores.
     * Esto se usa principalmente en la edición o al aceptar una solicitud.
     */
    async function cargarUsuariosParaPresidente(currentPresidenteId = null) {
        try {
            const response = await fetch(`${USERS_ENDPOINT}?role=user`, { // Asumiendo que puedes filtrar por rol
                headers: { 'Authorization': `Bearer ${adminToken}` }
            });

            if (!response.ok) throw new Error('Error al cargar la lista de usuarios');

            const users = await response.json();

            // Limpiar select
            presidenteSelect.innerHTML = '<option value="" selected>Selecciona un usuario (opcional)</option>';

            users.forEach(user => {
                const option = document.createElement('option');
                option.value = user.id;
                option.textContent = `${user.nombre} (${user.email})`;

                // Si estamos editando, seleccionar el presidente actual
                if (currentPresidenteId && user.id == currentPresidenteId) {
                    option.selected = true;
                }

                presidenteSelect.appendChild(option);
            });

        } catch (error) {
            console.error('Error cargando usuarios:', error);
        }
    }


    // =======================================
    // LÓGICA DE CREACIÓN Y EDICIÓN
    // =======================================

    /**
     * Función principal para manejar la creación (POST) o actualización (PUT/PATCH simulado)
     */
    async function guardarOActualizarClub() {
        const id = document.getElementById('club-id').value;
        const form = document.getElementById('club-form');
        const formData = new FormData(form);

        // El campo 'id_presidente' oculto se actualiza en la función editarClub o al aceptar
        // Para creación, podemos tomar el valor del select si está visible, o dejarlo vacío.

        let url = CLUBES_ENDPOINT;
        let method = 'POST';

        // Si existe un ID, estamos editando
        if (id) {
            url = `${CLUBES_ENDPOINT}/${id}`;
            // Mantenemos POST porque FormData con archivos a menudo requiere POST para la compatibilidad con servidores.
            // El backend deberá reconocer el ID en la URL para realizar la operación de actualización (PUT/PATCH).
            method = 'POST';
        }

        // Agregar el ID del presidente seleccionado del select (si se está usando)
        const selectedPresidenteId = presidenteSelect.value;
        if (selectedPresidenteId) {
            // Sobrescribir el campo oculto con el ID real seleccionado si el select fue utilizado.
            formData.set('id_presidente', selectedPresidenteId);
        } else {
            // Si el select está vacío, y el campo oculto id_presidente existía (ej. en edición), se mantiene
            // el valor o se pasa null/vacío.
        }

        // Quitar la imagen del FormData si no se ha seleccionado un nuevo archivo para evitar errores 
        // si el backend espera el archivo solo en la creación.
        const imagenInput = document.getElementById('imagen_club');
        if (!imagenInput.files.length && id) {
            // Si es una actualización y no se sube un nuevo archivo, quitamos el campo del FormData 
            // para que el backend no intente procesar un archivo vacío y elimine la imagen existente.
            // Esto depende fuertemente de cómo tu API maneje las actualizaciones.
            formData.delete('imagen_club');
        }

        try {
            const response = await fetch(url, {
                method: method,
                // NO establecer Content-Type: 'application/json' cuando se usa FormData!
                body: formData,
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                    // El navegador se encarga del Content-Type: multipart/form-data
                },
            });

            if (!response.ok) {
                // Intenta parsear el error del backend
                let errorData = await response.json().catch(() => ({ message: 'Error desconocido del servidor.' }));
                throw new Error(errorData.message || `Error al guardar el club: ${response.statusText}`);
            }

            mostrarAlerta(`Club ${id ? 'actualizado' : 'creado'} correctamente.`, 'success');

            // Limpiar y recargar
            resetFormularioClub();
            await cargarClubes();

        } catch (error) {
            console.error('Error:', error);
            mostrarAlerta(error.message || 'Error de red al intentar guardar/actualizar el club.', 'danger');
        } finally {
            // Habilitar el botón de nuevo (si lo habías deshabilitado)
        }
    }


    /**
     * Prepara el formulario para editar un club existente.
     * @param {object} club - Objeto del club a editar.
     */
    window.editarClub = async (club) => {
        // 1. Rellenar los campos
        document.getElementById('club-id').value = club.id;
        document.getElementById('nombre_club').value = club.nombre_club;
        document.getElementById('descripcion').value = club.descripcion || '';
        document.getElementById('ciudad').value = club.ciudad;
        document.getElementById('enfoque').value = club.enfoque;

        // Formato de fecha para el input
        if (club.fecha_creacion) {
            document.getElementById('fecha_creacion').value = club.fecha_creacion.split('T')[0];
        } else {
            document.getElementById('fecha_creacion').value = '';
        }

        // Si tiene presidente, rellenar el campo oculto y mostrar el select
        if (club.id_presidente) {
            document.getElementById('id_presidente').value = club.id_presidente;
            presidenteSelectContainer.style.display = 'block';
            await cargarUsuariosParaPresidente(club.id_presidente);
        } else {
            document.getElementById('id_presidente').value = '';
            presidenteSelectContainer.style.display = 'block'; // Mostrar de todas formas para asignar uno nuevo
            await cargarUsuariosParaPresidente(null);
        }

        // 2. Ajustar el título del formulario
        document.querySelector('.admin-section h3.text-danger').textContent = 'Editar Club (ID: ' + club.id + ')';

        // 3. Desplazarse al formulario
        clubForm.scrollIntoView({ behavior: 'smooth' });
    };

    /**
     * Maneja el evento de eliminar un club.
     * @param {number} id - ID del club a eliminar.
     */
    window.eliminarClub = (id) => {
        clubIdToDelete = id;
        document.getElementById('deleteConfirmMessage').textContent = `¿Estás seguro de que deseas eliminar el club con ID: ${id}?`;
        deleteConfirmModal.show();
    };

    /**
     * Maneja el evento de cambiar el estado de un club (Aprobar/Rechazar).
     * @param {number} id - ID del club.
     * @param {string} accion - 'aprobar' o 'rechazar'.
     * @param {number} solicitanteId - ID del usuario que solicita la presidencia.
     */
    window.cambiarEstadoClub = (id, accion, solicitanteId) => {
        clubToChangeStatus = { id, accion, solicitanteId };
        const message = accion === 'aprobar'
            ? `¿Estás seguro de que deseas APROBAR el club con ID: ${id}?`
            : `¿Estás seguro de que deseas RECHAZAR el club con ID: ${id}?`;

        document.getElementById('statusConfirmMessage').textContent = message;

        const btn = document.getElementById('btnConfirmStatus');
        btn.classList.remove('btn-success', 'btn-danger');
        btn.classList.add(accion === 'aprobar' ? 'btn-success' : 'btn-danger');
        btn.textContent = accion === 'aprobar' ? 'Aprobar Club' : 'Rechazar Club';

        statusConfirmModal.show();
    };


    // =======================================
    // LÓGICA DE CÓDIGO
    // =======================================

    /**
     * Realiza el fetch y renderiza las tablas de clubes.
     */
    async function cargarClubes() {
        try {
            const response = await fetch(CLUBES_ENDPOINT, {
                headers: { 'Authorization': `Bearer ${adminToken}` }
            });
            if (!response.ok) throw new Error('Error al cargar la lista de clubes');

            const clubes = await response.json();

            // Filtrar clubes por estado
            const activos = clubes.filter(c => c.estado === 'activo');
            const pendientes = clubes.filter(c => c.estado === 'pendiente');

            renderizarTabla(activos, tablaActivos, 'activo');
            renderizarTabla(pendientes, tablaPendientes, 'pendiente');

            // Actualizar Badge de pendientes
            badgePendientes.textContent = pendientes.length;
            badgePendientes.style.display = pendientes.length > 0 ? 'inline' : 'none';

        } catch (error) {
            console.error('Error al cargar clubes:', error);
            mostrarAlerta(error.message || 'Fallo al conectar con el servidor.', 'danger');
            tablaActivos.innerHTML = `<tr><td colspan="8" class="text-warning">${error.message || 'Error de conexión.'}</td></tr>`;
            tablaPendientes.innerHTML = `<tr><td colspan="8" class="text-warning">${error.message || 'Error de conexión.'}</td></tr>`;
        }
    }

    /**
     * Construye y rellena la tabla HTML.
     */
    function renderizarTabla(clubes, tbodyElement, tipo) {
        if (clubes.length === 0) {
            tbodyElement.innerHTML = `<tr><td colspan="8" class="text-secondary">No hay clubes ${tipo === 'activo' ? 'activos' : 'pendientes'} para mostrar.</td></tr>`;
            return;
        }

        tbodyElement.innerHTML = clubes.map(club => {
            const fechaDisplay = club.fecha_creacion ? new Date(club.fecha_creacion).toLocaleDateString('es-ES') : 'N/A';
            const descripcionCorta = club.descripcion ? club.descripcion.substring(0, 50) + '...' : 'Sin descripción';
            const presidenteDisplay = club.presidente ? `${club.presidente.nombre} (ID: ${club.presidente.id})` : 'Sin asignar';
            const imagenPath = club.imagen_url || '../../../img/default-club.png'; // Ruta por defecto

            let acciones;
            if (tipo === 'activo') {
                acciones = `
                    <button class="btn btn-sm btn-info me-2" onclick="editarClub(${JSON.stringify(club).replace(/"/g, '&quot;')})">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="eliminarClub(${club.id})">
                        <i class="bi bi-trash"></i>
                    </button>
                `;
            } else { // Pendiente
                acciones = `
                    <button class="btn btn-sm btn-success me-2" onclick="cambiarEstadoClub(${club.id}, 'aprobar', ${club.id_presidente})">
                        <i class="bi bi-check-lg"></i> Aprobar
                    </button>
                    <button class="btn btn-sm btn-warning" onclick="cambiarEstadoClub(${club.id}, 'rechazar', null)">
                        <i class="bi bi-x-lg"></i> Rechazar
                    </button>
                `;
            }

            return `
                <tr>
                    <td>${club.id}</td>
                    <td>${club.nombre_club}</td>
                    <td><small>${descripcionCorta}</small><br><strong>${club.enfoque}</strong></td>
                    <td>${fechaDisplay}</td>
                    <td>${club.ciudad}</td>
                    <td>${presidenteDisplay}</td>
                    <td><img src="${imagenPath}" alt="Logo" class="club-thumb"></td>
                    <td>${acciones}</td>
                </tr>
            `;
        }).join('');
    }

    // =======================================
    // EVENT LISTENERS PRINCIPALES
    // =======================================

    // 1. Manejar el envío del formulario para Crear/Editar
    if (clubForm) {
        clubForm.addEventListener('submit', function (event) {
            event.preventDefault(); // <-- **ESTO ES LO QUE IMPIDE LA RECARGA**
            guardarOActualizarClub();
        });
    }

    // 2. Manejar la confirmación de Eliminación
    btnConfirmDelete.addEventListener('click', async () => {
        if (!clubIdToDelete) return;

        try {
            const response = await fetch(`${CLUBES_ENDPOINT}/${clubIdToDelete}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${adminToken}` }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Error al eliminar el club.' }));
                throw new Error(errorData.message || `Error al eliminar: ${response.statusText}`);
            }

            mostrarAlerta(`Club ID ${clubIdToDelete} eliminado correctamente.`, 'success');
            deleteConfirmModal.hide();
            clubIdToDelete = null;
            await cargarClubes();

        } catch (error) {
            console.error('Error al eliminar:', error);
            mostrarAlerta(error.message || 'Fallo en la eliminación.', 'danger');
            deleteConfirmModal.hide();
        }
    });

    // 3. Manejar la confirmación de Cambio de Estado
    btnConfirmStatus.addEventListener('click', async () => {
        if (!clubToChangeStatus) return;

        const { id, accion, solicitanteId } = clubToChangeStatus;

        try {
            const response = await fetch(`${CLUBES_ENDPOINT}/${id}/estado`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${adminToken}`
                },
                body: JSON.stringify({
                    estado: accion === 'aprobar' ? 'activo' : 'rechazado',
                    id_presidente_solicitante: solicitanteId // Necesario para que el backend asigne el rol
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Error al cambiar estado.' }));
                throw new Error(errorData.message || `Error al cambiar estado: ${response.statusText}`);
            }

            mostrarAlerta(`Club ID ${id} ${accion === 'aprobar' ? 'aprobado' : 'rechazado'} y estado actualizado.`, 'success');
            statusConfirmModal.hide();
            clubToChangeStatus = null;
            await cargarClubes(); // Recargar tablas

        } catch (error) {
            console.error('Error al cambiar estado:', error);
            mostrarAlerta(error.message || 'Fallo al cambiar el estado del club.', 'danger');
            statusConfirmModal.hide();
        }
    });

    // 4. Resetear formulario al cambiar de pestaña a "Activos" (simula una nueva creación)
    document.getElementById('activos-tab').addEventListener('click', resetFormularioClub);


    // Inicialización
    cargarClubes();
    cargarUsuariosParaPresidente(); // Cargar la lista de usuarios para la asignación inicial o edición
    resetFormularioClub();
});