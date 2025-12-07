// public/js/adminClubes.js

document.addEventListener("DOMContentLoaded", () => {

    // Constante para el número de columnas visibles en la tabla (ID a Acciones)
    const TOTAL_COLUMNS = 8;

    // ⭐ Elementos de las dos tablas y el contador ⭐
    const tablaActivos = document.getElementById("tabla-clubes-activos");
    const tablaPendientes = document.getElementById("tabla-clubes-pendientes");
    const badgePendientes = document.getElementById("badge-pendientes");

    const form = document.getElementById("club-form");
    const btnNewClub = document.getElementById("btn-new-club"); // Botón "Nuevo Club" agregado

    // Elementos del formulario de edición (creación manual por Admin)
    const inputId = document.getElementById("club-id");
    const inputNombre = document.getElementById("nombre_evento");
    const inputDescripcion = document.getElementById("descripcion");
    const inputImagen = document.getElementById("imagen_club");
    const inputFecha = document.getElementById("fecha_creacion");

    // Modals de Bootstrap (se mantienen igual)
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
    // UTIL: Token, Fecha y Limpieza
    // -----------------------------------------

    // Función para obtener el Token JWT.
    // ⭐ NOTA: Si usas sessionStorage, cambia 'localStorage' por 'sessionStorage'.
    function getToken() {
        return sessionStorage.getItem('jwtToken');
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

    // Función: Limpiar el formulario y prepararlo para creación
    function clearForm() {
        if (form) form.reset();
        if (inputId) inputId.value = ""; // Asegura que el ID oculto se borra para POST
        setFechaDefault();
        mostrarAlerta("Formulario listo para crear un nuevo club.", "info");
    }

    if (btnNewClub) {
        btnNewClub.addEventListener('click', clearForm); // Añadir el listener
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
    // CARGAR LISTA DE CLUBES Y DISTRIBUIR
    // -----------------------------------------
    async function cargarClubes() {
        const token = getToken();
        if (!token) {
            // ⭐ CRÍTICO: El token es nulo o no se encuentra.
            mostrarAlerta("❌ **ERROR CRÍTICO:** No se encontró el token de administrador. Por favor, inicia sesión.", "error");
            // Muestra mensaje de error en las tablas
            renderTabla(tablaActivos, [], 'error');
            renderTabla(tablaPendientes, [], 'error');
            // Ocultar contador
            if (badgePendientes) badgePendientes.style.display = 'none';
            return;
        }

        const headers = {
            'Authorization': `Bearer ${token}`
        };

        try {
            // ⭐ LLAMADA 1: Obtener clubes activos
            const resActivos = await fetch("/api/clubs?estado=activo", { headers });

            if (!resActivos.ok) {
                const errorText = await resActivos.text();
                throw new Error(`Fallo al cargar activos (${resActivos.status}): ${resActivos.statusText}. Detalle: ${errorText.substring(0, 100)}...`);
            }
            const dataActivos = await resActivos.json();

            // ⭐ LLAMADA 2: Obtener solicitudes pendientes
            const resPendientes = await fetch("/api/clubs?estado=pendiente", { headers });

            if (!resPendientes.ok) {
                const errorText = await resPendientes.text();
                throw new Error(`Fallo al cargar pendientes (${resPendientes.status}): ${resPendientes.statusText}. Detalle: ${errorText.substring(0, 100)}...`);
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
                mostrarAlerta("Advertencia: Falló la estructura de respuesta de una de las APIs (pero los datos se procesaron).", "info");
            }

        } catch (error) {
            console.error("Error cargarClubes:", error);

            let customMessage = "Error al conectar con el servidor.";
            if (error.message.includes('(401)') || error.message.includes('(403)')) {
                customMessage = "❌ **Error de Permisos (401/403):** El token es inválido, expiró o no tienes rol de administrador. Por favor, vuelve a iniciar sesión.";
            } else if (error.message.includes('(500)')) {
                customMessage = `❌ **Error del Servidor (500):** Hubo un fallo interno al procesar la solicitud. Revisa los logs de tu backend.`;
            } else if (error.message.includes('Fallo al cargar')) {
                customMessage = `Error de red al cargar datos: ${error.message.split('Detalle:')[0]}`;
            }

            mostrarAlerta(customMessage, "error");
            // Renderiza la tabla con el mensaje de error general
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

        // Limpiamos el contenido anterior
        contenedorTabla.innerHTML = "";

        if (status === 'error') {
            // ⭐ CRÍTICO: Usamos el TOTAL_COLUMNS (8) para el colspan en el mensaje de error
            contenedorTabla.innerHTML = `<tr><td colspan="${TOTAL_COLUMNS}" class="text-danger text-center">**Error de servidor o acceso denegado al cargar datos**</td></tr>`;
            return;
        }

        if (!Array.isArray(clubes) || clubes.length === 0) {
            const mensaje = contenedorTabla.id === 'tabla-clubes-pendientes' ?
                "No hay solicitudes de clubes pendientes." :
                "No hay clubes activos registrados.";
            // ⭐ CRÍTICO: Usamos el TOTAL_COLUMNS (8) para el colspan en el mensaje de tabla vacía
            contenedorTabla.innerHTML = `<tr><td colspan="${TOTAL_COLUMNS}" class="text-secondary text-center">${mensaje}</td></tr>`;
            return;
        }

        clubes.forEach(club => {
            const fila = document.createElement("tr");
            const fecha = club.fecha_creacion ? club.fecha_creacion.toString().split('T')[0] : 'N/A';
            let badgeEstado = '';
            let accionesEspeciales = '';

            // Se asume que en el endpoint de "pendiente" todos los clubes vienen con estado 'pendiente' o null/undefined
            const esPendiente = contenedorTabla.id === 'tabla-clubes-pendientes';

            if (esPendiente) {
                badgeEstado = '<span class="badge bg-warning text-dark">PENDIENTE</span>';
                accionesEspeciales = `
                    <button class="btn btn-success btn-sm me-2 aprobar-btn" data-id="${club.id}" data-nombre="${escapeHtml(club.nombre_evento)}"><i class="bi bi-check-circle"></i> Aprobar</button>
                    <button class="btn btn-danger btn-sm rechazar-btn" data-id="${club.id}" data-nombre="${escapeHtml(club.nombre_evento)}"><i class="bi bi-x-circle"></i> Rechazar</button>
                `;
            } else if (club.estado === 'activo') {
                badgeEstado = '<span class="badge bg-danger">ACTIVO</span>';
            } else {
                badgeEstado = '<span class="badge bg-secondary">DESCONOCIDO/RECHAZADO</span>';
            }

            const presidenteInfo = club.id_presidente
                ? `${escapeHtml(club.nombre_presidente || 'N/A')} (ID: ${club.id_presidente})`
                : 'Admin';

            // ⭐ CRÍTICO: Se renderizan las 8 columnas que coinciden con el HTML
            fila.innerHTML = `
                <td>${club.id}</td>
                <td>${escapeHtml(club.nombre_evento)}</td>
                <td>${escapeHtml(club.descripcion || "Sin descripción")}</td>
                <td>${fecha}</td>
                <td>${badgeEstado}</td>
                <td>${presidenteInfo}</td>
                <td>
                    ${club.imagen_club ? `<img src="${club.imagen_club}" class="club-thumb" alt="Imagen club" style="width: 50px; height: 50px;">` : "-"}
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

        clearForm(); // Limpia el formulario antes de cargar

        const headers = { 'Authorization': `Bearer ${token}` };

        try {
            // Se usa /api/clubs?id= para obtener un club específico (puede ser activo o pendiente)
            const res = await fetch(`/api/clubs?id=${id}`, { headers });

            if (!res.ok) {
                const errorText = await res.text();
                mostrarAlerta(`Error ${res.status} al obtener club para edición: ${errorText.substring(0, 100)}...`, "error");
                return;
            }

            const r = await res.json();

            // Asumimos que el backend devuelve un objeto 'club' o 'pending_club'
            const c = r.club || r.pending_club;

            if (!r.success || !c) {
                mostrarAlerta("No se pudo cargar el club", "error");
                return;
            }

            // Llenar el formulario
            inputId.value = c.id;
            inputNombre.value = c.nombre_evento || "";
            inputDescripcion.value = c.descripcion || "";
            // El backend usa fecha_creacion para ambos (activos y pendientes)
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

        // El estado 'activo' lo debe establecer el admin solo al CREAR un club (POST)
        // En PUT (edición), el club ya es activo, a menos que el backend maneje el cambio de estado.
        // Aquí solo establecemos el estado al crear (POST) o si es una actualización manual de un pendiente.
        if (metodo === 'POST' || (metodo === 'PUT' && id_presidente.value === '')) {
            formData.append("estado", "activo");
        }

        if (inputImagen && inputImagen.files.length > 0) {
            // ⭐ CORRECCIÓN CRÍTICA: Acceso directo al files[0] del input file
            formData.append("imagen_club", inputImagen.files[0]);
        }

        try {
            // No creamos 'new Headers()' si enviamos FormData, solo pasamos el Authorization
            const res = await fetch(url, {
                method: metodo,
                headers: {
                    'Authorization': `Bearer ${token}` // ⭐ CRÍTICO: Token en el header
                },
                body: formData // Body es el objeto FormData
            });

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

            clearForm(); // Limpiar el formulario
            cargarClubes(); // Recargar las tablas

        } catch (error) {
            console.error("Error submit club:", error);
            mostrarAlerta("Error en el servidor al guardar el club", "error");
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

        if (deleteMessageEl)
            deleteMessageEl.textContent = `¿Estás seguro de que deseas eliminar "${clubName}"? Esta acción es irreversible.`;

        if (deleteConfirmModal) deleteConfirmModal.show();
    }

    if (btnConfirmDelete) {
        btnConfirmDelete.addEventListener("click", async () => {
            const token = getToken();
            if (!clubToDeleteId || !token) {
                mostrarAlerta("ID o token inválido", "error");
                if (deleteConfirmModal) deleteConfirmModal.hide();
                return;
            }

            try {
                // DELETE en /api/clubs?id= elimina un club ACTIVO
                const res = await fetch(`/api/clubs?id=${clubToDeleteId}`, {
                    method: "DELETE",
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!res.ok) {
                    const errorText = await res.text();
                    mostrarAlerta(`Error ${res.status} al eliminar: ${errorText.substring(0, 100)}...`, "error");
                    if (deleteConfirmModal) deleteConfirmModal.hide();
                    return;
                }

                const r = await res.json();

                if (!r.success) {
                    mostrarAlerta(r.message || "Error eliminando", "error");
                    if (deleteConfirmModal) deleteConfirmModal.hide();
                    return;
                }

                mostrarAlerta("Club eliminado", "exito");
                clubToDeleteId = null;
                if (deleteConfirmModal) deleteConfirmModal.hide();
                cargarClubes();

            } catch (error) {
                console.error("Error eliminarClub:", error);
                mostrarAlerta("Error eliminando club", "error");
                if (deleteConfirmModal) deleteConfirmModal.hide();
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
            mensaje = `¿Estás seguro de que deseas **APROBAR** el club "${nombre}"? El presidente obtendrá permisos de gestión y el club será movido a la lista de activos.`;
            if (btnConfirmStatus) btnConfirmStatus.className = 'btn btn-success';
            if (btnConfirmStatus) btnConfirmStatus.textContent = 'Confirmar Aprobación';
        } else if (action === 'rechazar') {
            mensaje = `¿Estás seguro de que deseas **RECHAZAR** el club "${nombre}"? Se eliminará la solicitud (de la tabla ${'`clubs_pendientes`'}).`;
            if (btnConfirmStatus) btnConfirmStatus.className = 'btn btn-secondary';
            if (btnConfirmStatus) btnConfirmStatus.textContent = 'Confirmar Rechazo';
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
                if (statusConfirmModal) statusConfirmModal.hide();
                return;
            }

            const url = `/api/clubs?id=${id}&status=change`; // URL para cambio de estado
            const headers = {
                'Authorization': `Bearer ${token}`
            };

            try {
                let res;
                let r;
                let successMessage;

                if (action === 'aprobar') {
                    // PUT para cambiar estado de pendiente a activo (y mover de tabla por backend)
                    res = await fetch(url, {
                        method: 'PUT',
                        headers: { ...headers, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ estado: 'activo' })
                    });
                    successMessage = "Club aprobado y activado correctamente. El presidente ha sido notificado.";
                } else if (action === 'rechazar') {
                    // DELETE para eliminar la solicitud (de la tabla 'clubs_pendientes')
                    res = await fetch(url, {
                        method: 'DELETE',
                        headers: headers // No necesita Content-Type
                    });
                    successMessage = "Solicitud de club rechazada y eliminada correctamente.";
                } else {
                    if (statusConfirmModal) statusConfirmModal.hide();
                    return;
                }

                if (!res.ok) {
                    const errorText = await res.text();
                    mostrarAlerta(`Error ${res.status} al ${action} el club: ${errorText.substring(0, 100)}...`, "error");
                    if (statusConfirmModal) statusConfirmModal.hide();
                    return;
                }

                r = await res.json();

                if (!r.success) {
                    mostrarAlerta(r.message || `Error al ${action} el club.`, "error");
                    if (statusConfirmModal) statusConfirmModal.hide();
                    return;
                }

                mostrarAlerta(successMessage, "exito");
                clubToChangeStatus = { id: null, action: null };
                if (statusConfirmModal) statusConfirmModal.hide();
                cargarClubes();

            } catch (error) {
                const errorMessage = error.message.includes("403") ? "Acceso denegado (403). No eres administrador." : `Error de servidor al ${action} club.`;
                console.error(`Error de red al ${action} club:`, error);
                mostrarAlerta(errorMessage, "error");
                if (statusConfirmModal) statusConfirmModal.hide();
            }
        });
    }

    // -----------------------------------------
    // Inicializar
    // -----------------------------------------
    setFechaDefault(); // Establece la fecha por defecto
    cargarClubes(); // Carga las tablas
});