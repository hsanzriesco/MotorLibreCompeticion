// public/js/adminClubes.js
document.addEventListener("DOMContentLoaded", () => {

    // ⭐ CORRECCIÓN DEL ERROR: Ahora buscamos las dos tablas y el contador ⭐
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
    // CARGAR LISTA DE CLUBES Y DISTRIBUIR
    // -----------------------------------------
    async function cargarClubes() {
        try {
            const res = await fetch("/api/clubs");
            const data = await res.json();

            if (!data.success) {
                mostrarAlerta("Error cargando clubes", "error");
                renderTabla(tablaActivos, [], 'error');
                renderTabla(tablaPendientes, [], 'error');
                return;
            }

            const activos = data.data.filter(c => c.estado === 'activo');
            const pendientes = data.data.filter(c => c.estado === 'pendiente');

            // ⭐ SOLUCIÓN AL ERROR: Llamamos a renderTabla con los contenedores específicos ⭐
            renderTabla(tablaActivos, activos);
            renderTabla(tablaPendientes, pendientes);

            // Actualizar el contador de pendientes
            if (badgePendientes) {
                badgePendientes.textContent = pendientes.length;
                badgePendientes.style.display = pendientes.length > 0 ? 'inline-block' : 'none';
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
        // ⭐ Guardrail para el error "Cannot set properties of null" ⭐
        if (!contenedorTabla) {
            console.error(`Contenedor de tabla con ID '${contenedorTabla ? contenedorTabla.id : 'NULO'}' no encontrado en el DOM.`);
            return;
        }

        contenedorTabla.innerHTML = "";

        if (status === 'error') {
            contenedorTabla.innerHTML = `<tr><td colspan="8" class="text-danger text-center">Error de servidor al cargar datos</td></tr>`;
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

            if (club.estado === 'pendiente') {
                badgeEstado = '<span class="badge bg-warning text-dark">PENDIENTE</span>';
                accionesEspeciales = `
                    <button class="btn btn-success btn-sm me-2 aprobar-btn" data-id="${club.id}" data-nombre="${escapeHtml(club.nombre_evento)}"><i class="bi bi-check-circle"></i> Aprobar</button>
                    <button class="btn btn-secondary btn-sm rechazar-btn" data-id="${club.id}" data-nombre="${escapeHtml(club.nombre_evento)}"><i class="bi bi-x-circle"></i> Rechazar</button>
                `;
            } else if (club.estado === 'activo') {
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
                    <button class="btn btn-warning btn-sm me-2 editar-btn" data-id="${club.id}"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-danger btn-sm eliminar-btn" data-id="${club.id}"><i class="bi bi-trash"></i></button>
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

        // ⭐ NUEVOS LISTENERS para APROBACIÓN (Solo si estamos en la tabla de pendientes) ⭐
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
            const res = await fetch(`/api/clubs?id=${id}`);
            const r = await res.json();

            if (!r.success) {
                mostrarAlerta("No se pudo cargar el club", "error");
                return;
            }

            const c = r.data;

            inputId.value = c.id;
            inputNombre.value = c.nombre_evento || "";
            inputDescripcion.value = c.descripcion || "";
            inputFecha.value = c.fecha_creacion ? c.fecha_creacion.toString().split('T')[0] : hoyISODate();
            if (inputImagen) inputImagen.value = "";

            if (c.estado === 'pendiente') {
                mostrarAlerta("Club pendiente cargado. Al guardar cambios, se establecerá como aprobado/activo.", "info");
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
        formData.append("estado", "activo");

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
            btnConfirmStatus.classList.add('btn-success');
            btnConfirmStatus.textContent = 'Confirmar Aprobación';
        } else if (action === 'rechazar') {
            mensaje = `¿Estás seguro de que deseas **RECHAZAR** el club "${nombre}"? Se eliminará la solicitud.`;
            btnConfirmStatus.classList.remove('btn-success');
            btnConfirmStatus.classList.add('btn-secondary');
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

            let url = `/api/clubs/status/${id}`;
            let estadoNuevo = (action === 'aprobar') ? 'activo' : 'rechazado';

            // Si rechazas, es mejor hacer un DELETE en el backend para eliminar la solicitud.
            // Si apruebas, es un PUT. Mantenemos el PUT aquí para ambos casos y el backend debe manejar la lógica de 'rechazado' (eliminar o archivar).

            try {
                const res = await fetch(url, {
                    method: 'PUT', // Usamos PUT para cambiar el estado a 'activo' o 'rechazado'
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ estado: estadoNuevo })
                });

                const r = await res.json();

                if (!r.success) {
                    mostrarAlerta(r.message || `Error al ${action} el club.`, "error");
                    statusConfirmModal.hide();
                    return;
                }

                mostrarAlerta(`Club ${estadoNuevo} correctamente.`, "exito");
                clubToChangeStatus = { id: null, action: null };
                statusConfirmModal.hide();
                cargarClubes();

            } catch (error) {
                console.error(`Error al ${action} club:`, error);
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