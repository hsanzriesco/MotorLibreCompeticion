// public/js/adminClubes.js
document.addEventListener("DOMContentLoaded", () => {

    const tabla = document.getElementById("tabla-clubes");
    const form = document.getElementById("club-form");

    // Elementos del formulario de edición (creación manual por Admin)
    const inputId = document.getElementById("club-id");
    const inputNombre = document.getElementById("nombre_evento"); // Usar el nombre de campo correcto si es solo 'nombre'
    const inputDescripcion = document.getElementById("descripcion");
    const inputImagen = document.getElementById("imagen_club");
    const inputFecha = document.getElementById("fecha_creacion"); // Este campo ya no se usa para crear/editar, solo visual

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
    let clubToChangeStatus = { id: null, action: null }; // {id: 123, action: 'aprobar'/'rechazar'}


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
    // CARGAR LISTA DE CLUBES (AHORA INCLUYE PENDIENTES)
    // -----------------------------------------
    async function cargarClubes() {
        try {
            // Asumo que tu API ahora devuelve también el estado (activo/pendiente)
            const res = await fetch("/api/clubs");
            const data = await res.json();

            if (!data.success) {
                mostrarAlerta("Error cargando clubes", "error");
                tabla.innerHTML = `<tr><td colspan="8" class="text-danger text-center">Error cargando clubes</td></tr>`;
                return;
            }

            renderTabla(data.data);
        } catch (error) {
            console.error("Error cargarClubes:", error);
            mostrarAlerta("Error al conectar con el servidor", "error");
            tabla.innerHTML = `<tr><td colspan="8" class="text-danger text-center">Error de servidor</td></tr>`;
        }
    }

    // -----------------------------------------
    // RENDERIZAR TABLA
    // -----------------------------------------
    function renderTabla(clubes) {
        tabla.innerHTML = "";

        if (!Array.isArray(clubes) || clubes.length === 0) {
            tabla.innerHTML = `<tr><td colspan="8" class="text-danger text-center">No hay clubes registrados</td></tr>`;
            return;
        }

        clubes.forEach(club => {
            const fila = document.createElement("tr");

            const fecha = club.fecha_creacion ? club.fecha_creacion.toString().split('T')[0] : '';

            // ⭐ NUEVO: Manejo de Estado ⭐
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

            // ⭐ CLUB.ID_PRESIDENTE / CLUB.NOMBRE_PRESIDENTE (Asumimos que la API los devuelve) ⭐
            const presidenteInfo = club.id_presidente
                ? `${escapeHtml(club.nombre_presidente || 'N/A')} (ID: ${club.id_presidente})`
                : 'Admin'; // Club creado por el Admin

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
                    <hr class="my-1 border-secondary">
                    ${accionesEspeciales}
                </td>
            `;

            tabla.appendChild(fila);
        });

        // Asignar listeners a los botones de administración existentes
        document.querySelectorAll(".editar-btn").forEach(btn =>
            btn.addEventListener("click", cargarClubEnFormulario)
        );

        document.querySelectorAll(".eliminar-btn").forEach(btn =>
            btn.addEventListener("click", preguntarEliminarClub)
        );

        // ⭐ NUEVOS LISTENERS para APROBACIÓN ⭐
        document.querySelectorAll(".aprobar-btn").forEach(btn =>
            btn.addEventListener("click", (e) => preguntarCambioEstado(e, 'aprobar'))
        );
        document.querySelectorAll(".rechazar-btn").forEach(btn =>
            btn.addEventListener("click", (e) => preguntarCambioEstado(e, 'rechazar'))
        );
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

    // (Tu función cargarClubEnFormulario... sin cambios importantes)
    // -----------------------------------------
    // CARGAR CLUB EN FORMULARIO (EDITAR)
    // -----------------------------------------
    async function cargarClubEnFormulario(e) {
        // ... (Tu implementación original)
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

            // Opcional: Si el club está pendiente, puedes mostrar una alerta
            if (c.estado === 'pendiente') {
                mostrarAlerta("Club pendiente cargado. Al editar, se considerará aprobado.", "info");
            } else {
                mostrarAlerta("Club cargado para edición", "info");
            }

            inputNombre.focus();

        } catch (error) {
            console.error("Error cargarClubEnFormulario:", error);
            mostrarAlerta("Error cargando club", "error");
        }
    }


    // (Tu función GUARDAR CLUB... sin cambios importantes)
    // -----------------------------------------
    // GUARDAR CLUB (POST / PUT)
    // -----------------------------------------
    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const id = inputId.value;
        const metodo = id ? "PUT" : "POST";
        // Al editar un club, si no tenía presidente, el admin podría asignarlo aquí
        const url = "/api/clubs" + (id ? `?id=${id}` : "");

        const formData = new FormData();
        formData.append("nombre_evento", inputNombre.value.trim());
        formData.append("descripcion", inputDescripcion.value.trim());
        // Cuando el admin edita, se asume que lo aprueba o ya está activo
        if (id) formData.append("estado", "activo");

        if (inputImagen && inputImagen.files.length > 0) {
            formData.append("imagen_club", inputImagen.files[0]);
        }
        // ... (resto de tu implementación)

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


    // (Tu función ELIMINAR CLUB... sin cambios importantes)
    // -----------------------------------------
    // ELIMINAR CLUB
    // -----------------------------------------
    function preguntarEliminarClub(e) {
        // ... (Tu implementación original)
        const id = e.currentTarget.dataset.id;
        if (!id) return;

        clubToDeleteId = id;

        const row = e.currentTarget.closest("tr");
        const clubName = row ? row.children[1].textContent : "este club";
        const deleteMessageEl = document.getElementById("deleteConfirmMessage");

        if (deleteMessageEl)
            deleteMessageEl.textContent = `¿Estás seguro de que deseas eliminar "${clubName}"? Esta acción es irreversible.`;

        if (deleteConfirmModal) deleteConfirmModal.show();
    }

    if (btnConfirmDelete) {
        btnConfirmDelete.addEventListener("click", async () => {
            // ... (Tu implementación original)
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
    // ⭐ NUEVO: GESTIÓN DE ESTADO (APROBAR / RECHAZAR SOLICITUD) ⭐
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

            // Mapeamos la acción a la URL/método. Idealmente, esto sería un PUT al estado.
            let url = `/api/clubs/status/${id}`;
            let estadoNuevo = (action === 'aprobar') ? 'activo' : 'rechazado';

            try {
                const res = await fetch(url, {
                    method: 'PUT',
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
                cargarClubes(); // Recargar la tabla

                // Opcional: Lógica adicional para notificar al presidente del club.

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