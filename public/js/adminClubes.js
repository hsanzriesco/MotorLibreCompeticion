// public/js/adminClubes.js

document.addEventListener("DOMContentLoaded", () => {

    // --- ⭐ CONFIGURACIÓN Y REFERENCIAS DEL DOM ⭐ ---
    const TOTAL_COLUMNS = 8; // Constante para el número de columnas visibles en la tabla (ID a Acciones)

    // Elementos de las dos tablas y el contador
    const tablaActivos = document.getElementById("tabla-clubes-activos");
    const tablaPendientes = document.getElementById("tabla-clubes-pendientes");
    const badgePendientes = document.getElementById("badge-pendientes");

    // Formulario y botón de nueva creación
    const form = document.getElementById("club-form");
    const btnNewClub = document.getElementById("btn-new-club");

    // Elementos del formulario de edición/creación
    const inputId = document.getElementById("club-id");
    const inputNombre = document.getElementById("nombre_evento");
    const inputDescripcion = document.getElementById("descripcion");
    const inputImagen = document.getElementById("imagen_club"); // Input de tipo file
    const inputFecha = document.getElementById("fecha_creacion");
    // ⭐ MEJORA: Se añade el input oculto para el ID del presidente.
    const inputIdPresidente = document.getElementById("id_presidente");

    // Modals de Bootstrap (Se recomienda usar data-bs-toggle/target directamente en HTML,
    // pero se mantiene la inicialización de JS para consistencia)
    const deleteConfirmModalEl = document.getElementById("deleteConfirmModal");
    const deleteConfirmModal = deleteConfirmModalEl ? new bootstrap.Modal(deleteConfirmModalEl) : null;
    const btnConfirmDelete = document.getElementById("btnConfirmDelete");
    const deleteMessageEl = document.getElementById("deleteConfirmMessage");
    let clubToDeleteId = null;

    const statusModalEl = document.getElementById("statusConfirmModal");
    const statusConfirmModal = statusModalEl ? new bootstrap.Modal(statusModalEl) : null;
    const btnConfirmStatus = document.getElementById("btnConfirmStatus");
    const statusConfirmMessage = document.getElementById("statusConfirmMessage");
    let clubToChangeStatus = { id: null, action: null };


    // -----------------------------------------
    // UTIL: Token, Fecha, Limpieza y Escape HTML
    // -----------------------------------------

    /** Obtiene el Token JWT de la sessionStorage. */
    function getToken() {
        return sessionStorage.getItem('jwtToken');
    }

    /** Obtiene la fecha de hoy en formato 'YYYY-MM-DD'. */
    function hoyISODate() {
        const d = new Date();
        // MEJORA: Usar toISOString para un manejo más limpio de la fecha
        return d.toISOString().split('T')[0];
    }

    /** Inicializa el valor del input de fecha a la fecha actual. */
    function setFechaDefault() {
        if (inputFecha) inputFecha.value = hoyISODate();
    }

    /** Limpia el formulario y lo prepara para la creación. */
    function clearForm() {
        if (form) form.reset();
        // Asegura que los IDs ocultos se borran para la creación (POST)
        if (inputId) inputId.value = "";
        if (inputIdPresidente) inputIdPresidente.value = "";
        setFechaDefault();
        mostrarAlerta("Formulario listo para crear un nuevo club.", "info");
    }

    if (btnNewClub) {
        btnNewClub.addEventListener('click', clearForm); // Añadir el listener
    }

    /** Escapa caracteres HTML para prevenir XSS. */
    function escapeHtml(str = "") {
        return String(str)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;");
    }

    // -----------------------------------------
    // ALERTA
    // -----------------------------------------

    /** Muestra una alerta en el placeholder. */
    function mostrarAlerta(message, type) {
        console.log(`[${type.toUpperCase()}] ${message.replace(/\*\*|/g, '')}`);
        const alertPlaceholder = document.getElementById('alert-placeholder');
        if (alertPlaceholder) {
            // MEJORA: Definir las clases de Bootstrap en base al tipo
            const bsType = type === 'exito' ? 'success' : type === 'error' ? 'danger' : 'info';
            alertPlaceholder.innerHTML = `
                <div class="alert alert-${bsType} alert-dismissible fade show" role="alert">
                    ${message}
                    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                </div>
            `;
        }
    }


    // -----------------------------------------
    // CARGAR LISTA DE CLUBES Y DISTRIBUIR
    // -----------------------------------------

    /** Carga los clubes activos y pendientes de la API y renderiza las tablas. */
    async function cargarClubes() {
        const token = getToken();
        if (!token) {
            mostrarAlerta("❌ **ERROR CRÍTICO:** No se encontró el token de administrador. Por favor, inicia sesión.", "error");
            renderTabla(tablaActivos, [], 'error');
            renderTabla(tablaPendientes, [], 'error');
            if (badgePendientes) badgePendientes.style.display = 'none';
            return;
        }

        const headers = { 'Authorization': `Bearer ${token}` };

        try {
            // Solicitudes concurrentes para cargar datos de forma más rápida
            const [resActivos, resPendientes] = await Promise.all([
                fetch("/api/clubs?estado=activo", { headers }),
                fetch("/api/clubs?estado=pendiente", { headers })
            ]);

            // Función de manejo de errores de respuesta
            const checkResponse = async (res, type) => {
                if (!res.ok) {
                    const errorText = await res.text();
                    // Lanza un error con detalles para capturarlo en el catch principal
                    throw new Error(`Fallo al cargar ${type} (${res.status}): ${res.statusText}. Detalle: ${errorText.substring(0, 100)}...`);
                }
                return res.json();
            };

            const dataActivos = await checkResponse(resActivos, 'activos');
            const dataPendientes = await checkResponse(resPendientes, 'pendientes');

            // ✅ Garantizar que la variable es un array o vacío
            const activos = dataActivos.success ? (dataActivos.clubs || []) : [];
            const pendientes = dataPendientes.success ? (dataPendientes.pending_clubs || []) : [];

            // Renderizar tablas
            renderTabla(tablaActivos, activos);
            renderTabla(tablaPendientes, pendientes);

            // Actualizar el contador de pendientes
            if (badgePendientes) {
                badgePendientes.textContent = pendientes.length;
                badgePendientes.style.display = pendientes.length > 0 ? 'inline-block' : 'none';
            }

        } catch (error) {
            console.error("Error cargarClubes:", error);

            let customMessage = "Error al conectar con el servidor.";
            if (error.message.includes('(401)') || error.message.includes('(403)')) {
                customMessage = "❌ **Error de Permisos (401/403):** El token es inválido, expiró o no tienes rol de administrador. Por favor, vuelve a iniciar sesión.";
            } else if (error.message.includes('(500)')) {
                customMessage = `❌ **Error del Servidor (500):** Hubo un fallo interno. Revisa los logs.`;
            } else if (error.message.includes('Fallo al cargar')) {
                // Muestra un mensaje más amigable para errores de red/API detallados
                customMessage = `Error de red/API: ${error.message.split('Detalle:')[0]}`;
            }

            mostrarAlerta(customMessage, "error");
            // Renderiza la tabla con el mensaje de error general
            renderTabla(tablaActivos, [], 'error');
            renderTabla(tablaPendientes, [], 'error');
        }
    }

    // -----------------------------------------
    // RENDERIZAR TABLA
    // -----------------------------------------

    /** Renderiza la tabla de clubes (Generalizada para activos y pendientes). */
    function renderTabla(contenedorTabla, clubes, status = 'ok') {
        if (!contenedorTabla) {
            console.error(`Contenedor de tabla con ID '${contenedorTabla ? contenedorTabla.id : 'NULO'}' no encontrado en el DOM.`);
            return;
        }

        contenedorTabla.innerHTML = ""; // Limpiamos el contenido anterior

        if (status === 'error') {
            contenedorTabla.innerHTML = `<tr><td colspan="${TOTAL_COLUMNS}" class="text-danger text-center">**Error de servidor o acceso denegado al cargar datos**</td></tr>`;
            return;
        }

        if (!Array.isArray(clubes) || clubes.length === 0) {
            const mensaje = contenedorTabla.id === 'tabla-clubes-pendientes' ?
                "No hay solicitudes de clubes pendientes." :
                "No hay clubes activos registrados.";
            contenedorTabla.innerHTML = `<tr><td colspan="${TOTAL_COLUMNS}" class="text-secondary text-center">${mensaje}</td></tr>`;
            return;
        }

        clubes.forEach(club => {
            const fila = document.createElement("tr");
            // Limpieza de fecha
            const fecha = club.fecha_creacion ? club.fecha_creacion.toString().split('T')[0] : 'N/A';
            let badgeEstado = '';
            let accionesEspeciales = '';

            const esPendiente = contenedorTabla.id === 'tabla-clubes-pendientes';

            if (esPendiente) {
                badgeEstado = '<span class="badge bg-warning text-dark">PENDIENTE</span>';
                // Acciones de gestión de estado para pendientes
                accionesEspeciales = `
                    <button class="btn btn-success btn-sm me-2 aprobar-btn" data-id="${club.id}" data-nombre="${escapeHtml(club.nombre_evento)}"><i class="bi bi-check-circle"></i> Aprobar</button>
                    <button class="btn btn-danger btn-sm rechazar-btn" data-id="${club.id}" data-nombre="${escapeHtml(club.nombre_evento)}"><i class="bi bi-x-circle"></i> Rechazar</button>
                `;
            } else if (club.estado === 'activo') {
                badgeEstado = '<span class="badge bg-primary">ACTIVO</span>'; // MEJORA: Se cambia a bg-primary (más visible que danger para "activo")
            } else {
                badgeEstado = '<span class="badge bg-secondary">DESCONOCIDO/RECHAZADO</span>';
            }

            // Uso de id_presidente del club
            const presidenteInfo = club.id_presidente
                ? `${escapeHtml(club.nombre_presidente || 'N/A')} (ID: ${club.id_presidente})`
                : 'Admin'; // Si no tiene id_presidente, se asume creado por Admin

            // Renderizado de la fila
            fila.innerHTML = `
                <td>${club.id}</td>
                <td>${escapeHtml(club.nombre_evento)}</td>
                <td>${escapeHtml(club.descripcion ? club.descripcion.substring(0, 50) + (club.descripcion.length > 50 ? '...' : '') : "Sin descripción")}</td>
                <td>${fecha}</td>
                <td>${badgeEstado}</td>
                <td>${presidenteInfo}</td>
                <td>
                    ${club.imagen_club ? `<img src="${club.imagen_club}" class="club-thumb img-thumbnail" alt="Imagen club" style="width: 50px; height: 50px; object-fit: cover;">` : "-"}
                </td>
                <td>
                    <button class="btn btn-warning btn-sm me-2 editar-btn" data-id="${club.id}"><i class="bi bi-pencil"></i> Editar</button>
                    <button class="btn btn-danger btn-sm eliminar-btn" data-id="${club.id}"><i class="bi bi-trash"></i> Eliminar</button>
                    ${accionesEspeciales ? `<hr class="my-1 border-secondary">${accionesEspeciales}` : ''}
                </td>
            `;

            contenedorTabla.appendChild(fila);
        });

        // Adjuntar listeners de eventos
        contenedorTabla.querySelectorAll(".editar-btn").forEach(btn =>
            btn.addEventListener("click", cargarClubEnFormulario)
        );

        contenedorTabla.querySelectorAll(".eliminar-btn").forEach(btn =>
            btn.addEventListener("click", preguntarEliminarClub)
        );

        if (esPendiente) {
            contenedorTabla.querySelectorAll(".aprobar-btn").forEach(btn =>
                btn.addEventListener("click", (e) => preguntarCambioEstado(e, 'aprobar'))
            );
            contenedorTabla.querySelectorAll(".rechazar-btn").forEach(btn =>
                btn.addEventListener("click", (e) => preguntarCambioEstado(e, 'rechazar'))
            );
        }
    }

    // -----------------------------------------
    // CARGAR CLUB EN FORMULARIO (EDITAR)
    // -----------------------------------------

    /** Carga los datos de un club específico en el formulario de edición. */
    async function cargarClubEnFormulario(e) {
        const id = e.currentTarget.dataset.id;
        const token = getToken();
        if (!id || !token) return;

        clearForm(); // Limpia el formulario antes de cargar (importante)

        const headers = { 'Authorization': `Bearer ${token}` };

        try {
            const res = await fetch(`/api/clubs?id=${id}`, { headers });

            if (!res.ok) {
                const errorText = await res.text();
                mostrarAlerta(`Error ${res.status} al obtener club para edición: ${errorText.substring(0, 100)}...`, "error");
                return;
            }

            const r = await res.json();
            const c = r.club || r.pending_club; // Puede ser un club activo o pendiente

            if (!r.success || !c) {
                mostrarAlerta(r.message || "No se pudo cargar el club", "error");
                return;
            }

            // Llenar el formulario con los datos del club
            inputId.value = c.id;
            inputNombre.value = c.nombre_evento || "";
            inputDescripcion.value = c.descripcion || "";
            inputFecha.value = c.fecha_creacion ? c.fecha_creacion.toString().split('T')[0] : hoyISODate();
            if (inputImagen) inputImagen.value = ""; // Limpiar el input file por seguridad

            // ⭐ CRÍTICO: Cargar el ID del presidente. Si es un pendiente, debe ser incluido
            // en el PUT para promoverlo a activo con el presidente correcto.
            if (inputIdPresidente) inputIdPresidente.value = c.id_presidente || "";

            // Mostrar el modal de edición
            const clubModal = new bootstrap.Modal(document.getElementById('clubModal'));
            clubModal.show();

            if (c.estado === 'pendiente' || c.estado === null) {
                mostrarAlerta("Club pendiente cargado. Al guardar, se establecerá como activo.", "info");
            } else {
                mostrarAlerta("Club cargado para edición", "info");
            }

            inputNombre.focus();

        } catch (error) {
            console.error("Error cargarClubEnFormulario:", error);
            mostrarAlerta("Error cargando club: " + error.message, "error");
        }
    }


    // -----------------------------------------
    // GUARDAR CLUB (POST / PUT)
    // -----------------------------------------

    /** Maneja el envío del formulario para crear (POST) o actualizar (PUT) un club. */
    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const token = getToken();
        if (!token) {
            mostrarAlerta("❌ Error: No se encontró el token de administrador.", "error");
            return;
        }

        const id = inputId.value;
        const metodo = id ? "PUT" : "POST";
        const url = "/api/clubs" + (id ? `?id=${id}` : "");

        const formData = new FormData(form);

        // ⭐ Lógica de Estado (CRÍTICO)
        // Si el admin está creando (POST) o editando un club pendiente (PUT), 
        // se establece explícitamente el estado a 'activo' en el FormData.
        const isEditingPending = metodo === 'PUT' && inputIdPresidente && inputIdPresidente.value !== '';

        if (metodo === 'POST' || isEditingPending) {
            formData.append("estado", "activo");

            // Si es un POST (creación manual del Admin), y no se ha especificado,
            // se puede establecer 'id_presidente' a null o un valor predeterminado si es requerido por la API.
            // Si se está editando un pendiente, el 'id_presidente' ya está en el FormData
            // a través del input hidden, por lo que no es necesario añadirlo aquí, a menos que quieras
            // sobreescribirlo o asegurarte de que existe un valor para el backend.
            if (metodo === 'POST' && !formData.get('id_presidente')) {
                // Si la API requiere un id_presidente en POST, aquí se pondría un valor por defecto o null
                // Asumiendo que la API lo gestiona si es 'null' o 'Admin'
                // formData.append("id_presidente", null); 
            }
        }

        // En un PUT de un club activo, no necesitamos añadir 'estado' a menos que queramos cambiarlo.
        // Asumimos que la API lo mantiene si no se envía el campo 'estado'.

        try {
            // No establecemos Content-Type, el navegador lo hará automáticamente como multipart/form-data
            // ya que se usa FormData y podría contener un archivo.
            const res = await fetch(url, {
                method: metodo,
                headers: {
                    'Authorization': `Bearer ${token}` // ⭐ Token en el header
                },
                body: formData // Body es el objeto FormData
            });

            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(`Error ${res.status} al guardar: ${errorText.substring(0, 100)}...`);
            }

            const r = await res.json();

            if (!r.success) {
                mostrarAlerta(r.message || "Error guardando club", "error");
                return;
            }

            mostrarAlerta(id ? "Club actualizado" : "Club creado", "exito");

            // Cerrar modal si existe
            const clubModalEl = document.getElementById('clubModal');
            if (clubModalEl) bootstrap.Modal.getInstance(clubModalEl)?.hide();

            clearForm(); // Limpiar el formulario para la próxima creación
            cargarClubes(); // Recargar las tablas

        } catch (error) {
            console.error("Error submit club:", error);
            const errorMessage = error.message.includes("403") ? "Acceso denegado (403). No eres administrador." : `Error de servidor: ${error.message}`;
            mostrarAlerta(errorMessage, "error");
        }
    });


    // -----------------------------------------
    // ELIMINAR CLUB
    // -----------------------------------------

    /** Muestra el modal de confirmación para eliminar. */
    function preguntarEliminarClub(e) {
        const id = e.currentTarget.dataset.id;
        if (!id) return;

        clubToDeleteId = id;

        const row = e.currentTarget.closest("tr");
        const clubName = row && row.children[1] ? row.children[1].textContent : "este club";

        if (deleteMessageEl)
            deleteMessageEl.textContent = `¿Estás seguro de que deseas eliminar "${clubName}" (ID: ${id})? Esta acción es irreversible.`;

        if (deleteConfirmModal) deleteConfirmModal.show();
    }

    /** Maneja la confirmación de la eliminación. */
    if (btnConfirmDelete) {
        btnConfirmDelete.addEventListener("click", async () => {
            const token = getToken();
            const id = clubToDeleteId;

            if (!id || !token) {
                mostrarAlerta("ID o token inválido", "error");
                if (deleteConfirmModal) deleteConfirmModal.hide();
                return;
            }

            if (deleteConfirmModal) deleteConfirmModal.hide(); // Ocultar antes de la petición para feedback rápido

            try {
                // DELETE en /api/clubs?id= elimina un club (activo o pendiente)
                const res = await fetch(`/api/clubs?id=${id}`, {
                    method: "DELETE",
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!res.ok) {
                    const errorText = await res.text();
                    throw new Error(`Error ${res.status} al eliminar: ${errorText.substring(0, 100)}...`);
                }

                const r = await res.json();

                if (!r.success) {
                    mostrarAlerta(r.message || "Error eliminando", "error");
                    return;
                }

                mostrarAlerta("Club eliminado correctamente", "exito");
                clubToDeleteId = null;
                cargarClubes();

            } catch (error) {
                console.error("Error eliminarClub:", error);
                const errorMessage = error.message.includes("403") ? "Acceso denegado (403). No eres administrador." : `Error eliminando club: ${error.message}`;
                mostrarAlerta(errorMessage, "error");
            }
        });
    }


    // -------------------------------------------------------------------
    // GESTIÓN DE ESTADO (APROBAR / RECHAZAR SOLICITUD)
    // -------------------------------------------------------------------

    /** Muestra el modal de confirmación para el cambio de estado. */
    function preguntarCambioEstado(e, action) {
        const id = e.currentTarget.dataset.id;
        const nombre = e.currentTarget.dataset.nombre;

        if (!id) return;

        clubToChangeStatus = { id, action };

        let mensaje = "";
        if (action === 'aprobar') {
            mensaje = `¿Estás seguro de que deseas **APROBAR** el club "${nombre}" (ID: ${id})? El presidente obtendrá permisos de gestión y el club será movido a la lista de activos.`;
            if (btnConfirmStatus) btnConfirmStatus.className = 'btn btn-success';
            if (btnConfirmStatus) btnConfirmStatus.textContent = 'Confirmar Aprobación';
        } else if (action === 'rechazar') {
            mensaje = `¿Estás seguro de que deseas **RECHAZAR** el club "${nombre}" (ID: ${id})? Se eliminará la solicitud (de la tabla ${'`clubs_pendientes`'}).`;
            if (btnConfirmStatus) btnConfirmStatus.className = 'btn btn-danger'; // MEJORA: Botón rojo para 'rechazar'
            if (btnConfirmStatus) btnConfirmStatus.textContent = 'Confirmar Rechazo';
        }

        if (statusConfirmMessage) statusConfirmMessage.innerHTML = mensaje;
        if (statusConfirmModal) statusConfirmModal.show();
    }

    /** Maneja la confirmación para cambiar el estado (Aprobar/Rechazar). */
    if (btnConfirmStatus) {
        btnConfirmStatus.addEventListener('click', async () => {
            const { id, action } = clubToChangeStatus;
            const token = getToken();

            if (!id || !action || !token) {
                mostrarAlerta("Solicitud de cambio de estado o token inválido", "error");
                if (statusConfirmModal) statusConfirmModal.hide();
                return;
            }

            if (statusConfirmModal) statusConfirmModal.hide(); // Ocultar antes de la petición

            const url = `/api/clubs?id=${id}&status=change`; // Endpoint específico para cambio de estado
            const headers = { 'Authorization': `Bearer ${token}` };

            try {
                let res;
                let successMessage;

                if (action === 'aprobar') {
                    // PUT: Cambia estado a activo
                    res = await fetch(url, {
                        method: 'PUT',
                        // El PUT de estado debe ir con JSON para enviar el cambio de estado
                        headers: { ...headers, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ estado: 'activo' })
                    });
                    successMessage = "Club aprobado y activado correctamente.";
                } else if (action === 'rechazar') {
                    // DELETE: Elimina la solicitud de pendiente
                    res = await fetch(url, {
                        method: 'DELETE',
                        headers: headers
                    });
                    successMessage = "Solicitud de club rechazada y eliminada correctamente.";
                } else {
                    return;
                }

                if (!res.ok) {
                    const errorText = await res.text();
                    throw new Error(`Error ${res.status} al ${action} el club: ${errorText.substring(0, 100)}...`);
                }

                const r = await res.json();

                if (!r.success) {
                    mostrarAlerta(r.message || `Error al ${action} el club.`, "error");
                    return;
                }

                mostrarAlerta(successMessage, "exito");
                clubToChangeStatus = { id: null, action: null };
                cargarClubes();

            } catch (error) {
                const errorMessage = error.message.includes("403") ? "Acceso denegado (403). No eres administrador." : `Error de servidor al ${action} club.`;
                console.error(`Error de red al ${action} club:`, error);
                mostrarAlerta(errorMessage, "error");
            }
        });
    }

    // -----------------------------------------
    // Inicializar
    // -----------------------------------------
    setFechaDefault(); // Establece la fecha por defecto en el formulario
    cargarClubes(); // Carga las tablas al iniciar la página
});