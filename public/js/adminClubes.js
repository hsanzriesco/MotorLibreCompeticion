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
    // UTIL: Token y Fecha
    // -----------------------------------------

    // Función para obtener el Token JWT (Asume que se guarda en localStorage)
    function getToken() {
        return localStorage.getItem('jwtToken');
    }

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
    // ALERTA
    // -----------------------------------------
    function mostrarAlerta(message, type) {
        console.log(`[${type.toUpperCase()}] ${message}`);
        const alertPlaceholder = document.getElementById('alert-placeholder');
        if (alertPlaceholder) {
            alertPlaceholder.innerHTML = `<div class="alert alert-${type === 'exito' ? 'success' : type === 'error' ? 'danger' : 'info'} alert-dismissible fade show" role="alert">
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>`;
        }
    }


    // -----------------------------------------
    // CARGAR LISTA DE CLUBES Y DISTRIBUIR (MODIFICADA)
    // -----------------------------------------
    async function cargarClubes() {
        const token = getToken();
        if (!token) {
            mostrarAlerta("❌ Error: No se encontró el token de administrador. Inicia sesión.", "error");
            // Renderizar tablas vacías o con error si no hay token
            renderTabla(tablaActivos, [], 'error');
            renderTabla(tablaPendientes, [], 'error');
            return;
        }

        const headers = {
            'Authorization': `Bearer ${token}`
        };

        try {
            // ⭐ LLAMADA 1: Obtener clubes activos
            const resActivos = await fetch("/api/clubs?estado=activo", { headers });

            // 🚨 CORRECCIÓN: Manejar fallos de HTTP (401, 403, 500, etc.) antes de leer JSON
            if (!resActivos.ok) {
                // Leer el cuerpo de la respuesta para obtener detalles del error si es posible
                const errorText = await resActivos.text();
                // Lanzar un error con el código de estado
                throw new Error(`Fallo al cargar activos: ${resActivos.status} ${resActivos.statusText}. Detalle: ${errorText.substring(0, 100)}...`);
            }
            const dataActivos = await resActivos.json();

            // ⭐ LLAMADA 2: Obtener solicitudes pendientes
            const resPendientes = await fetch("/api/clubs?estado=pendiente", { headers });

            // 🚨 CORRECCIÓN: Manejar fallos de HTTP (401, 403, 500, etc.) antes de leer JSON
            if (!resPendientes.ok) {
                const errorText = await resPendientes.text();
                throw new Error(`Fallo al cargar pendientes: ${resPendientes.status} ${resPendientes.statusText}. Detalle: ${errorText.substring(0, 100)}...`);
            }
            const dataPendientes = await resPendientes.json();

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

            if (!dataActivos.success || !dataPendientes.success) {
                mostrarAlerta("Advertencia: Fallo una de las llamadas a la API (pero los datos parciales se cargaron).", "info");
            }

        } catch (error) {
            console.error("Error cargarClubes:", error);

            // Manejo de errores más específico
            let customMessage = "Error al conectar con el servidor.";
            if (error.message.includes('401') || error.message.includes('403')) {
                customMessage = "Acceso denegado (401/403): El usuario no es Admin o el token expiró.";
            } else if (error.message.includes('Fallo al cargar activos') || error.message.includes('Fallo al cargar pendientes')) {
                customMessage = `Error al cargar datos: ${error.message}`;
            }

            mostrarAlerta(customMessage, "error");
            renderTabla(tablaActivos, [], 'error');
            renderTabla(tablaPendientes, [], 'error');
        }
    }

    // -----------------------------------------
    // RENDERIZAR TABLA (Generalizada para activos y pendientes)
    // -----------------------------------------
    function renderTabla(contenedorTabla, clubes, status = 'ok') {
        if (!contenedorTabla) {
            console.error(`Contenedor de tabla con ID '${contenedorTabla ? contenedorTabla.id : 'NULO'}' no encontrado en el DOM.`);
            return;
        }

        contenedorTabla.innerHTML = "";

        if (status === 'error') {
            contenedorTabla.innerHTML = `<tr><td colspan="8" class="text-danger text-center">Error de servidor o acceso denegado al cargar datos</td></tr>`;
            return;
        }

        if (!Array.isArray(clubes) || clubes.length === 0) {
            const mensaje = contenedorTabla.id === 'tabla-clubes-pendientes' ?
                "No hay solicitudes de clubes pendientes." :
                "No hay clubes activos registrados.";
            contenedorTabla.innerHTML = `<tr><td colspan="8" class="text-secondary text-center">${mensaje}</td></tr>`;
            return;
        }

        clubes.forEach(club => {
            const fila = document.createElement("tr");
            const fecha = club.fecha_creacion ? club.fecha_creacion.toString().split('T')[0] : 'N/A';
            let badgeEstado = '';
            let accionesEspeciales = '';

            // Asumimos pendiente si está en la tabla de pendientes o si el estado lo indica
            const esPendiente = club.estado === 'pendiente' || (contenedorTabla.id === 'tabla-clubes-pendientes' && club.estado === null);

            if (esPendiente) {
                badgeEstado = '<span class="badge bg-warning text-dark">PENDIENTE</span>';
                accionesEspeciales = `
                    <button class="btn btn-success btn-sm me-2 aprobar-btn" data-id="${club.id}" data-nombre="${escapeHtml(club.nombre_evento)}"><i class="bi bi-check-circle"></i> Aprobar</button>
                    <button class="btn btn-danger btn-sm rechazar-btn" data-id="${club.id}" data-nombre="${escapeHtml(club.nombre_evento)}"><i class="bi bi-x-circle"></i> Rechazar</button>
                `;
            } else if (club.estado === 'activo') {
                // Nota: Podrías cambiar a bg-success para activo, el original usaba bg-danger
                badgeEstado = '<span class="badge bg-danger">ACTIVO</span>';
            } else {
                badgeEstado = '<span class="badge bg-secondary">DESCONOCIDO</span>';
            }

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

        contenedorTabla.querySelectorAll(".editar-btn").forEach(btn =>
            btn.addEventListener("click", cargarClubEnFormulario)
        );

        contenedorTabla.querySelectorAll(".eliminar-btn").forEach(btn =>
            btn.addEventListener("click", preguntarEliminarClub)
        );

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
        const token = getToken();
        if (!id || !token) return;

        const headers = { 'Authorization': `Bearer ${token}` };

        try {
            const res = await fetch(`/api/clubs?id=${id}`, { headers });

            // Manejo de error de fetch
            if (!res.ok) {
                const errorText = await res.text();
                mostrarAlerta(`Error ${res.status} al obtener club para edición: ${errorText.substring(0, 100)}...`, "error");
                return;
            }

            const r = await res.json();

            // ✅ CORRECCIÓN: El backend devuelve r.club o r.pending_club
            const c = r.club || r.pending_club;

            if (!r.success || !c) {
                mostrarAlerta("No se pudo cargar el club", "error");
                return;
            }

            inputId.value = c.id;
            inputNombre.value = c.nombre_evento || "";
            inputDescripcion.value = c.descripcion || "";
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

        const token = getToken();
        if (!token) {
            mostrarAlerta("❌ Error: No se encontró el token de administrador.", "error");
            return;
        }

        const id = inputId.value;
        const metodo = id ? "PUT" : "POST";
        const url = "/api/clubs" + (id ? `?id=${id}` : "");

        const formData = new FormData();
        formData.append("nombre_evento", inputNombre.value.trim());
        formData.append("descripcion", inputDescripcion.value.trim());
        formData.append("estado", "activo"); // Estado por defecto para admin

        if (inputImagen && inputImagen.files.length > 0) {
            formData.append("imagen_club", inputImagen.files[0]);
        }

        try {
            // Añadir el Authorization header para solicitudes con FormData
            const headers = new Headers();
            headers.append('Authorization', `Bearer ${token}`);
            // No se añade 'Content-Type': 'multipart/form-data', el navegador lo hace automáticamente

            const res = await fetch(url, {
                method: metodo,
                headers: headers,
                body: formData
            });

            // Manejar errores HTTP antes de leer JSON
            if (!res.ok) {
                const errorText = await res.text();
                mostrarAlerta(`Error ${res.status} al guardar: ${errorText.substring(0, 100)}...`, "error");
                return;
            }

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
        const clubName = row && row.children[1] ? row.children[1].textContent : "este club";
        const deleteMessageEl = document.getElementById("deleteConfirmMessage");

        if (deleteMessageEl)
            deleteMessageEl.textContent = `¿Estás seguro de que deseas eliminar "${clubName}"? Esta acción es irreversible.`;

        if (deleteConfirmModal) deleteConfirmModal.show();
    }

    if (btnConfirmDelete) {
        btnConfirmDelete.addEventListener("click", async () => {
            const token = getToken();
            if (!clubToDeleteId || !token) {
                mostrarAlerta("ID o token inválido", "error");
                deleteConfirmModal.hide();
                return;
            }

            try {
                const res = await fetch(`/api/clubs?id=${clubToDeleteId}`, {
                    method: "DELETE",
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                // Manejar errores HTTP antes de leer JSON
                if (!res.ok) {
                    const errorText = await res.text();
                    mostrarAlerta(`Error ${res.status} al eliminar: ${errorText.substring(0, 100)}...`, "error");
                    deleteConfirmModal.hide();
                    return;
                }


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
            btnConfirmStatus.className = 'btn btn-success';
            btnConfirmStatus.textContent = 'Confirmar Aprobación';
        } else if (action === 'rechazar') {
            mensaje = `¿Estás seguro de que deseas **RECHAZAR** el club "${nombre}"? Se eliminará la solicitud.`;
            btnConfirmStatus.className = 'btn btn-secondary';
            btnConfirmStatus.textContent = 'Confirmar Rechazo';
        }

        if (statusConfirmMessage) statusConfirmMessage.innerHTML = mensaje;
        if (statusConfirmModal) statusConfirmModal.show();
    }

    if (btnConfirmStatus) {
        btnConfirmStatus.addEventListener('click', async () => {
            const { id, action } = clubToChangeStatus;
            const token = getToken();

            if (!id || !action || !token) {
                mostrarAlerta("Solicitud de cambio de estado o token inválido", "error");
                statusConfirmModal.hide();
                return;
            }

            const url = `/api/clubs?id=${id}&status=change`;
            const headers = {
                'Authorization': `Bearer ${token}`
            };

            try {
                let res;
                let r;
                let successMessage;

                if (action === 'aprobar') {
                    res = await fetch(url, {
                        method: 'PUT',
                        headers: { ...headers, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ estado: 'activo' })
                    });
                    successMessage = "Club aprobado y activado correctamente. El presidente ha sido notificado.";
                } else if (action === 'rechazar') {
                    res = await fetch(url, {
                        method: 'DELETE',
                        headers: headers
                    });
                    successMessage = "Solicitud de club rechazada y eliminada correctamente.";
                } else {
                    statusConfirmModal.hide();
                    return;
                }

                // 🚨 CORRECCIÓN: Manejar fallos de HTTP (401, 403, 500, etc.) antes de leer JSON
                if (!res.ok) {
                    const errorText = await res.text();
                    mostrarAlerta(`Error ${res.status} al ${action} el club: ${errorText.substring(0, 100)}...`, "error");
                    statusConfirmModal.hide();
                    return;
                }

                r = await res.json();

                if (!r.success) {
                    mostrarAlerta(r.message || `Error al ${action} el club.`, "error");
                    statusConfirmModal.hide();
                    return;
                }

                mostrarAlerta(successMessage, "exito");
                clubToChangeStatus = { id: null, action: null };
                statusConfirmModal.hide();
                cargarClubes();

            } catch (error) {
                const errorMessage = error.message.includes("403") ? "Acceso denegado (403). No eres administrador." : `Error de servidor al ${action} club.`;
                console.error(`Error de red al ${action} club:`, error);
                mostrarAlerta(errorMessage, "error");
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