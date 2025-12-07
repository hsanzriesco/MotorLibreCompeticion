// public/js/adminClubes.js
document.addEventListener("DOMContentLoaded", () => {

    // ⭐ Elementos de las dos tablas y el contador ⭐
    const tablaActivos = document.getElementById("tabla-clubes-activos");
    const tablaPendientes = document.getElementById("tabla-clubes-pendientes");
    const badgePendientes = document.getElementById("badge-pendientes");

    const form = document.getElementById("club-form");

    // Elementos del formulario de edición (creación manual por Admin)
    const inputId = document.getElementById("club-id");
    const inputNombre = document.getElementById("nombre_evento");
    const inputDescripcion = document.getElementById("descripcion");
    const inputImagen = document.getElementById("imagen_club");
    const inputFecha = document.getElementById("fecha_creacion");

    // Modal de confirmación (Eliminar)
    const deleteConfirmModalEl = document.getElementById("deleteConfirmModal");
    const deleteConfirmModal = deleteConfirmModalEl ? new bootstrap.Modal(deleteConfirmModalEl) : null;
    const btnConfirmDelete = document.getElementById("btnConfirmDelete");
    let clubToDeleteId = null;

    // Modal de confirmación (Aprobar/Rechazar Solicitud)
    const statusModalEl = document.getElementById("statusConfirmModal");
    // ⚠️ Se asume que el HTML tiene un modal con ID statusConfirmModal
    const statusConfirmModal = statusModalEl ? new bootstrap.Modal(statusModalEl) : null;
    const btnConfirmStatus = document.getElementById("btnConfirmStatus");
    const statusConfirmMessage = document.getElementById("statusConfirmMessage");
    let clubToChangeStatus = { id: null, action: null };


    // -----------------------------------------
    // UTIL: fecha hoy en formato YYYY-MM-DD
    // -----------------------------------------
    function hoyISODate() {
        const d = new Date();
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }

    // Inicializar fecha visual para administrador
    function setFechaDefault() {
        if (inputFecha) inputFecha.value = hoyISODate();
    }

    // -----------------------------------------
    // ESCAPAR HTML
    // -----------------------------------------
    function escapeHtml(str = "") {
        return String(str)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;");
    }

    // -----------------------------------------
    // ALERTA (Función ficticia, se asume que existe en el proyecto)
    // -----------------------------------------
    function mostrarAlerta(message, type) {
        // Implementación de una alerta simple si no existe
        console.log(`[${type.toUpperCase()}] ${message}`);
        const alertPlaceholder = document.getElementById('alert-placeholder');
        if (alertPlaceholder) {
            alertPlaceholder.innerHTML = `<div class="alert alert-${type === 'exito' ? 'success' : type === 'error' ? 'danger' : 'info'} alert-dismissible fade show" role="alert">
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>`;
        } else {
            // Fallback: mostrar un alert nativo para que el admin sepa
            // alert(`[${type}] ${message}`); 
        }
    }


    // -----------------------------------------
    // CARGAR LISTA DE CLUBES Y DISTRIBUIR
    // -----------------------------------------
    async function cargarClubes() {
        try {
            // ⭐ LLAMADA 1: Obtener clubes activos
            const resActivos = await fetch("/api/clubs?estado=activo");
            const dataActivos = await resActivos.json();

            // ⭐ LLAMADA 2: Obtener solicitudes pendientes
            const resPendientes = await fetch("/api/clubs?estado=pendiente");
            const dataPendientes = await resPendientes.json();

            // -------------------------------------------------------------------
            // ✅ CORRECCIÓN CLAVE: Usamos || [] para asegurar que la variable es un array.
            // dataActivos.clubs y dataPendientes.pending_clubs son las propiedades
            // que devuelve la API con los clubes.
            // -------------------------------------------------------------------
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

            if (!dataActivos.success || !dataPendientes.success) {
                mostrarAlerta("Advertencia: Fallo una de las llamadas a la API.", "info");
            }

        } catch (error) {
            console.error("Error cargarClubes:", error);
            mostrarAlerta("Error al conectar con el servidor", "error");
            renderTabla(tablaActivos, [], 'error');
            renderTabla(tablaPendientes, [], 'error');
        }
    }

    // -----------------------------------------
    // RENDERIZAR TABLA (Generalizada para activos y pendientes)
    // -----------------------------------------
    function renderTabla(contenedorTabla, clubes, status = 'ok') {
        // Guardrail para el error "Cannot set properties of null"
        if (!contenedorTabla) {
            console.error(`Contenedor de tabla con ID '${contenedorTabla ? contenedorTabla.id : 'NULO'}' no encontrado en el DOM.`);
            return;
        }

        contenedorTabla.innerHTML = "";

        // Si el estado es de error
        if (status === 'error') {
            contenedorTabla.innerHTML = `<tr><td colspan="8" class="text-danger text-center">Error de servidor al cargar datos</td></tr>`;
            return;
        }

        // Si no hay datos
        if (!Array.isArray(clubes) || clubes.length === 0) {
            const mensaje = contenedorTabla.id === 'tabla-clubes-pendientes' ?
                "No hay solicitudes de clubes pendientes." :
                "No hay clubes activos registrados.";
            contenedorTabla.innerHTML = `<tr><td colspan="8" class="text-secondary text-center">${mensaje}</td></tr>`;
            return;
        }

        clubes.forEach(club => {
            const fila = document.createElement("tr");

            // club.fecha_creacion es en realidad fecha_solicitud en la tabla de pendientes (con alias)
            const fecha = club.fecha_creacion ? club.fecha_creacion.toString().split('T')[0] : 'N/A';

            let badgeEstado = '';
            let accionesEspeciales = '';

            // El campo estado debe ser 'pendiente' o 'activo'. Si clubs_pendientes no tiene la columna,
            // el backend devuelve 'NULL as estado', por lo que tratamos 'pendiente' si el contenedor es el correcto.
            const esPendiente = club.estado === 'pendiente' || (contenedorTabla.id === 'tabla-clubes-pendientes' && club.estado === null);

            if (esPendiente) {
                badgeEstado = '<span class="badge bg-warning text-dark">PENDIENTE</span>';
                // Solo las acciones de Aprobación/Rechazo si está pendiente
                accionesEspeciales = `
                    <button class="btn btn-success btn-sm me-2 aprobar-btn" data-id="${club.id}" data-nombre="${escapeHtml(club.nombre_evento)}"><i class="bi bi-check-circle"></i> Aprobar</button>
                    <button class="btn btn-danger btn-sm rechazar-btn" data-id="${club.id}" data-nombre="${escapeHtml(club.nombre_evento)}"><i class="bi bi-x-circle"></i> Rechazar</button>
                `;
            } else if (club.estado === 'activo') {
                badgeEstado = '<span class="badge bg-danger">ACTIVO</span>';
            } else {
                badgeEstado = '<span class="badge bg-secondary">DESCONOCIDO</span>';
            }

            // Muestra quién lo creó o el ID del presidente si está asignado
            // Nota: nombre_presidente es NULL en clubs_pendientes, el valor se obtiene al aprobar.
            const presidenteInfo = club.id_presidente
                ? `${escapeHtml(club.nombre_presidente || 'N/A')} (ID: ${club.id_presidente})`
                : 'Admin';

            fila.innerHTML = `
                <td>${club.id}</td>
                <td>${escapeHtml(club.nombre_evento)}</td>
                <td>${escapeHtml(club.descripcion || "Sin descripción")}</td>
                <td>${fecha}</td>
                <td>${badgeEstado}</td>
                <td>${presidenteInfo}</td>
                <td>
                    ${club.imagen_club ? `<img src="${club.imagen_club}" class="club-thumb" alt="Imagen club">` : "-"}
                </td>
                <td>
                    <button class="btn btn-warning btn-sm me-2 editar-btn" data-id="${club.id}"><i class="bi bi-pencil"></i> Editar</button>
                    <button class="btn btn-danger btn-sm eliminar-btn" data-id="${club.id}"><i class="bi bi-trash"></i> Eliminar</button>
                    ${accionesEspeciales ? `<hr class="my-1 border-secondary">${accionesEspeciales}` : ''}
                </td>
            `;

            contenedorTabla.appendChild(fila);
        });

        // Asignar listeners a los botones de administración existentes
        contenedorTabla.querySelectorAll(".editar-btn").forEach(btn =>
            btn.addEventListener("click", cargarClubEnFormulario)
        );

        contenedorTabla.querySelectorAll(".eliminar-btn").forEach(btn =>
            btn.addEventListener("click", preguntarEliminarClub)
        );

        // ⭐ NUEVOS LISTENERS para APROBACIÓN/RECHAZO (Solo si estamos en la tabla de pendientes) ⭐
        if (contenedorTabla.id === 'tabla-clubes-pendientes') {
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
    async function cargarClubEnFormulario(e) {
        const id = e.currentTarget.dataset.id;
        if (!id) return;

        try {
            // Nota: Buscamos en la URL solo por ID. El backend lo busca en la tabla 'clubs' (activos).
            const res = await fetch(`/api/clubs?id=${id}`);
            const r = await res.json();

            // ✅ CORRECCIÓN: El backend devuelve r.club o r.pending_club, no r.data
            const c = r.club || r.pending_club;

            if (!r.success || !c) {
                mostrarAlerta("No se pudo cargar el club", "error");
                return;
            }

            inputId.value = c.id;
            inputNombre.value = c.nombre_evento || "";
            inputDescripcion.value = c.descripcion || "";
            // El campo fecha_creacion viene del alias o de la tabla principal.
            inputFecha.value = c.fecha_creacion ? c.fecha_creacion.toString().split('T')[0] : hoyISODate();
            if (inputImagen) inputImagen.value = ""; // Limpiar el input file

            if (c.estado === 'pendiente' || c.estado === null) {
                mostrarAlerta("Club pendiente cargado. Al guardar cambios manualmente, se establecerá como activo.", "info");
            } else {
                mostrarAlerta("Club cargado para edición", "info");
            }

            inputNombre.focus();

        } catch (error) {
            console.error("Error cargarClubEnFormulario:", error);
            mostrarAlerta("Error cargando club", "error");
        }
    }


    // -----------------------------------------
    // GUARDAR CLUB (POST / PUT)
    // -----------------------------------------
    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const id = inputId.value;
        const metodo = id ? "PUT" : "POST";
        const url = "/api/clubs" + (id ? `?id=${id}` : "");

        const formData = new FormData();
        formData.append("nombre_evento", inputNombre.value.trim());
        formData.append("descripcion", inputDescripcion.value.trim());
        // Cuando el admin guarda/edita, se asume que lo aprueba o ya está activo
        formData.append("estado", "activo"); // Es importante para la lógica del backend

        if (inputImagen && inputImagen.files.length > 0) {
            formData.append("imagen_club", inputImagen.files[0]);
        }

        try {
            const res = await fetch(url, { method: metodo, body: formData });
            const r = await res.json();

            if (!r.success) {
                mostrarAlerta(r.message || r.error || "Error guardando club", "error");
                return;
            }

            mostrarAlerta(id ? "Club actualizado" : "Club creado", "exito");

            // Limpiar formulario y recargar
            form.reset();
            inputId.value = "";
            setFechaDefault();

            cargarClubes();

        } catch (error) {
            console.error("Error submit club:", error);
            mostrarAlerta("Error en el servidor", "error");
        }
    });


    // -----------------------------------------
    // ELIMINAR CLUB
    // -----------------------------------------
    function preguntarEliminarClub(e) {
        const id = e.currentTarget.dataset.id;
        if (!id) return;

        clubToDeleteId = id;

        const row = e.currentTarget.closest("tr");
        // Aseguramos que el índice 1 es el nombre del club
        const clubName = row && row.children[1] ? row.children[1].textContent : "este club";
        const deleteMessageEl = document.getElementById("deleteConfirmMessage");

        if (deleteMessageEl)
            deleteMessageEl.textContent = `¿Estás seguro de que deseas eliminar "${clubName}"? Esta acción es irreversible.`;

        if (deleteConfirmModal) deleteConfirmModal.show();
    }

    if (btnConfirmDelete) {
        btnConfirmDelete.addEventListener("click", async () => {
            if (!clubToDeleteId) {
                mostrarAlerta("ID inválido", "error");
                deleteConfirmModal.hide();
                return;
            }

            try {
                const res = await fetch(`/api/clubs?id=${clubToDeleteId}`, {
                    method: "DELETE"
                });

                const r = await res.json();

                if (!r.success) {
                    mostrarAlerta(r.message || "Error eliminando", "error");
                    deleteConfirmModal.hide();
                    return;
                }

                mostrarAlerta("Club eliminado", "exito");
                clubToDeleteId = null;
                deleteConfirmModal.hide();
                cargarClubes();

            } catch (error) {
                console.error("Error eliminarClub:", error);
                mostrarAlerta("Error eliminando club", "error");
                deleteConfirmModal.hide();
            }
        });
    }


    // -------------------------------------------------------------------
    // GESTIÓN DE ESTADO (APROBAR / RECHAZAR SOLICITUD)
    // -------------------------------------------------------------------

    function preguntarCambioEstado(e, action) {
        const id = e.currentTarget.dataset.id;
        const nombre = e.currentTarget.dataset.nombre;

        if (!id) return;

        clubToChangeStatus = { id, action };

        let mensaje = "";
        if (action === 'aprobar') {
            mensaje = `¿Estás seguro de que deseas **APROBAR** el club "${nombre}"? El presidente obtendrá permisos de gestión.`;
            btnConfirmStatus.classList.remove('btn-secondary');
            btnConfirmStatus.classList.remove('btn-danger'); // Por si acaso
            btnConfirmStatus.classList.add('btn-success');
            btnConfirmStatus.textContent = 'Confirmar Aprobación';
        } else if (action === 'rechazar') {
            mensaje = `¿Estás seguro de que deseas **RECHAZAR** el club "${nombre}"? Se eliminará la solicitud.`;
            btnConfirmStatus.classList.remove('btn-success');
            btnConfirmStatus.classList.add('btn-secondary'); // Usamos secondary o danger, secondary es más estándar para "No"
            btnConfirmStatus.textContent = 'Confirmar Rechazo';
        }

        if (statusConfirmMessage) statusConfirmMessage.innerHTML = mensaje;
        if (statusConfirmModal) statusConfirmModal.show();
    }

    if (btnConfirmStatus) {
        btnConfirmStatus.addEventListener('click', async () => {
            const { id, action } = clubToChangeStatus;

            if (!id || !action) {
                mostrarAlerta("Solicitud de cambio de estado inválida", "error");
                statusConfirmModal.hide();
                return;
            }

            // Nota: Utilizamos la ruta general de clubs y enviamos el id y el query 'status' para que el backend 
            // use el statusChangeHandler
            const url = `/api/clubs?id=${id}&status=change`;

            try {
                let res;
                let r;
                let successMessage;

                if (action === 'aprobar') {
                    // Enviar PUT con 'activo' para que el backend lo mueva a la tabla principal
                    res = await fetch(url, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ estado: 'activo' })
                    });
                    r = await res.json();
                    successMessage = "Club aprobado y activado correctamente. El presidente ha sido notificado.";
                } else if (action === 'rechazar') {
                    // Enviar DELETE para que el backend elimine la solicitud pendiente
                    res = await fetch(url, {
                        method: 'DELETE'
                    });
                    r = await res.json();
                    successMessage = "Solicitud de club rechazada y eliminada correctamente.";
                } else {
                    statusConfirmModal.hide();
                    return; // No hacer nada si la acción es desconocida
                }

                if (!r.success) {
                    mostrarAlerta(r.message || `Error al ${action} el club.`, "error");
                    statusConfirmModal.hide();
                    return;
                }

                mostrarAlerta(successMessage, "exito");
                clubToChangeStatus = { id: null, action: null };
                statusConfirmModal.hide();
                // Recargar las tablas para ver los cambios
                cargarClubes();

            } catch (error) {
                console.error(`Error de red al ${action} club:`, error);
                mostrarAlerta(`Error de servidor al ${action} club.`, "error");
                statusConfirmModal.hide();
            }
        });
    }

    // -----------------------------------------
    // Inicializar
    // -----------------------------------------
    setFechaDefault();
    cargarClubes();
});