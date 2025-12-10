// public/js/adminClubes.js - CORREGIDO
document.addEventListener("DOMContentLoaded", () => {

    // -----------------------------------------
    // UTIL: Token, Rol y Seguridad
    // -----------------------------------------

    /** Obtiene el Token JWT de la sessionStorage. 
     * Verifica 'jwtToken' (estándar) y 'token' (posible clave de login).
     */
    function getToken() {
        // Tu función existente para obtener el token
        const token = sessionStorage.getItem('jwtToken');
        if (token) return token;
        return sessionStorage.getItem('token');
    }

    /** Obtiene el rol del usuario de la sessionStorage. */
    function getRole() {
        return sessionStorage.getItem('role');
    }

    /** REDIRECCIÓN DE SEGURIDAD. Verifica token y rol de administrador. */
    function checkAdminAccess() {
        const token = getToken();
        const role = getRole();

        if (!token) {
            alert("Acceso no autorizado. Debes iniciar sesión.");
            // Redirige al login si no hay token
            window.location.href = '/pages/auth/login.html';
            return false;
        }

        if (role !== 'admin') {
            alert("Permisos insuficientes. Solo los administradores pueden acceder a esta página.");
            // Redirige a la página principal si el rol no es 'admin'
            window.location.href = '/index.html';
            return false;
        }
        return true;
    }

    // 🚨 ¡VERIFICACIÓN DE ACCESO CRÍTICA AL INICIO DEL SCRIPT! 🚨
    if (!checkAdminAccess()) {
        return; // Detiene la ejecución si la verificación falla
    }
    // FIN DE VERIFICACIÓN


    // --- ⭐ CONFIGURACIÓN Y REFERENCIAS DEL DOM ⭐ ---
    const TOTAL_COLUMNS = 8; // Constante para el número de columnas visibles en la tabla (ID a Acciones)

    // Elementos de las dos tablas y el contador
    const tablaActivos = document.getElementById("tabla-clubes-activos");
    const tablaPendientes = document.getElementById("tabla-clubes-pendientes");
    const badgePendientes = document.getElementById("badge-pendientes");

    // Formulario y botón de nueva creación
    const form = document.getElementById("club-form");
    const btnNewClub = document.getElementById("btn-new-club");

    // Asumiendo que existe un modal principal para la edición/creación
    const clubModalEl = document.getElementById('clubModal');

    // Elementos del formulario de edición/creación
    const inputId = document.getElementById("club-id");
    const inputNombre = document.getElementById("nombre_evento");
    const inputDescripcion = document.getElementById("descripcion");
    // 🛠️ AÑADIDO: Referencia para CIUDAD y ENFOQUE.
    const inputCiudad = document.getElementById("ciudad"); // Asumiendo ID 'ciudad'
    const inputEnfoque = document.getElementById("enfoque"); // Asumiendo ID 'enfoque'
    const inputImagen = document.getElementById("imagen_club"); // Input de tipo file
    const inputFecha = document.getElementById("fecha_creacion");
    // ID del presidente (oculto, para gestionar pendientes)
    const inputIdPresidente = document.getElementById("id_presidente");

    // Modals de Bootstrap
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
    // UTIL: Fecha, Limpieza y Escape HTML
    // -----------------------------------------

    // ... (El resto de funciones auxiliares como hoyISODate, setFechaDefault, clearForm, escapeHtml, mostrarAlerta se mantienen igual)
    // ... (Mantener las funciones auxiliares aquí)

    /** Obtiene la fecha de hoy en formato 'YYYY-MM-DD'. */
    function hoyISODate() {
        const d = new Date();
        return d.toISOString().split('T')[0];
    }

    /** Inicializa el valor del input de fecha a la fecha actual. */
    function setFechaDefault() {
        if (inputFecha) inputFecha.value = hoyISODate();
    }

    /** Limpia el formulario y lo prepara para la creación. */
    function clearForm() {
        if (form) form.reset();
        if (inputId) inputId.value = "";
        if (inputIdPresidente) inputIdPresidente.value = "";
        // 🛠️ AÑADIDO: Limpiar explícitamente los valores de los nuevos inputs
        if (inputCiudad) inputCiudad.value = "";
        if (inputEnfoque) inputEnfoque.value = "";
        setFechaDefault();
        mostrarAlerta("Formulario listo para crear un nuevo club.", "info");
    }

    if (btnNewClub) {
        btnNewClub.addEventListener('click', () => {
            clearForm();
            // Mostrar modal de creación (si existe)
            if (clubModalEl) new bootstrap.Modal(clubModalEl).show();
        });
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
        // Ya se verificó el token en checkAdminAccess, pero lo mantenemos para la alerta específica
        if (!token) {
            // El usuario ya fue redirigido por checkAdminAccess, pero mostramos una alerta de respaldo
            mostrarAlerta("❌ **ERROR CRÍTICO:** Token de administrador no disponible. Se requiere re-login.", "error");
            renderTabla(tablaActivos, [], 'error');
            renderTabla(tablaPendientes, [], 'error');
            if (badgePendientes) badgePendientes.style.display = 'none';
            return;
        }

        const headers = { 'Authorization': `Bearer ${token}` };

        try {
            // Solicitudes concurrentes (Activos y Pendientes)
            const [resActivos, resPendientes] = await Promise.all([
                fetch("/api/clubs?estado=activo", { headers }),
                fetch("/api/clubs?estado=pendiente", { headers })
            ]);

            // Función de manejo de errores de respuesta interna
            const checkResponse = async (res, type) => {
                if (!res.ok) {
                    const errorText = await res.text();
                    throw new Error(`Fallo al cargar ${type} (${res.status}): ${res.statusText}. Detalle: ${errorText.substring(0, 100)}...`);
                }
                return res.json();
            };

            const dataActivos = await checkResponse(resActivos, 'activos');
            const dataPendientes = await checkResponse(resPendientes, 'pendientes');

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
                customMessage = "❌ **Error de Permisos (401/403):** Token inválido o expirado. Vuelve a iniciar sesión.";
            } else if (error.message.includes('(500)')) {
                customMessage = `❌ **Error del Servidor (500):** Hubo un fallo interno.`;
            } else if (error.message.includes('Fallo al cargar')) {
                customMessage = `Error de red/API: ${error.message.split('Detalle:')[0]}`;
            }

            mostrarAlerta(customMessage, "error");
            renderTabla(tablaActivos, [], 'error');
            renderTabla(tablaPendientes, [], 'error');
        }
    }

    // ... (El resto del script: renderTabla, cargarClubEnFormulario, form submit, etc. se mantienen igual)

    /** Renderiza la tabla de clubes. */
    function renderTabla(contenedorTabla, clubes, status = 'ok') {
        if (!contenedorTabla) return;

        contenedorTabla.innerHTML = "";

        // ** FIX: Definir la variable aquí para usarla en el mensaje de tabla vacía **
        const esPendiente = contenedorTabla.id === 'tabla-clubes-pendientes'; // ** Solución de ReferenceError **

        if (status === 'error') {
            contenedorTabla.innerHTML = `<tr><td colspan="${TOTAL_COLUMNS}" class="text-danger text-center">**Error de servidor o acceso denegado al cargar datos**</td></tr>`;
            return;
        }

        if (!Array.isArray(clubes) || clubes.length === 0) {
            const mensaje = esPendiente ? // Usamos la variable definida arriba
                "No hay solicitudes de clubes pendientes." :
                "No hay clubes activos registrados.";
            contenedorTabla.innerHTML = `<tr><td colspan="${TOTAL_COLUMNS}" class="text-secondary text-center">${mensaje}</td></tr>`;
            return;
        }

        clubes.forEach(club => {
            const fila = document.createElement("tr");
            const fecha = club.fecha_creacion ? club.fecha_creacion.toString().split('T')[0] : 'N/A';
            let badgeEstado = '';
            let accionesEspeciales = '';

            // const esPendiente fue movida arriba y reutilizada aquí

            if (esPendiente) {
                badgeEstado = '<span class="badge bg-warning text-dark">PENDIENTE</span>';
                accionesEspeciales = `
                    <button class="btn btn-success btn-sm me-2 aprobar-btn" data-id="${club.id}" data-nombre="${escapeHtml(club.nombre_evento)}"><i class="bi bi-check-circle"></i> Aprobar</button>
                    <button class="btn btn-danger btn-sm rechazar-btn" data-id="${club.id}" data-nombre="${escapeHtml(club.nombre_evento)}"><i class="bi bi-x-circle"></i> Rechazar</button>
                `;
            } else if (club.estado === 'activo') {
                badgeEstado = '<span class="badge bg-primary">ACTIVO</span>';
            } else {
                badgeEstado = '<span class="badge bg-secondary">DESCONOCIDO/RECHAZADO</span>';
            }

            const presidenteInfo = club.id_presidente
                ? `${escapeHtml(club.nombre_presidente || 'N/A')} (ID: ${club.id_presidente})`
                : 'Admin';

            // Recorte de descripción para mejor visualización
            const descripcionCorta = club.descripcion
                ? escapeHtml(club.descripcion.substring(0, 50) + (club.descripcion.length > 50 ? '...' : ''))
                : "Sin descripción";

            fila.innerHTML = `
                <td>${club.id}</td>
                <td>${escapeHtml(club.nombre_evento)}</td>
                <td>${descripcionCorta}</td>
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

    async function cargarClubEnFormulario(e) {
        const id = e.currentTarget.dataset.id;
        const token = getToken();
        if (!id || !token) return;

        clearForm();

        const headers = { 'Authorization': `Bearer ${token}` };

        try {
            const res = await fetch(`/api/clubs?id=${id}`, { headers });

            if (!res.ok) {
                const errorText = await res.text();
                mostrarAlerta(`Error ${res.status} al obtener club: ${errorText.substring(0, 100)}...`, "error");
                return;
            }

            const r = await res.json();
            const c = r.club || r.pending_club;

            if (!r.success || !c) {
                mostrarAlerta(r.message || "No se pudo cargar el club", "error");
                return;
            }

            // Llenar el formulario con los datos del club
            inputId.value = c.id;
            inputNombre.value = c.nombre_evento || "";
            inputDescripcion.value = c.descripcion || "";
            inputFecha.value = c.fecha_creacion ? c.fecha_creacion.toString().split('T')[0] : hoyISODate();
            // 🛠️ AÑADIDO: Llenar CIUDAD y ENFOQUE
            if (inputCiudad) inputCiudad.value = c.ciudad || "";
            if (inputEnfoque) inputEnfoque.value = c.enfoque || "";

            if (inputImagen) inputImagen.value = "";

            // Cargar ID del presidente
            if (inputIdPresidente) inputIdPresidente.value = c.id_presidente || "";

            // Mostrar el modal de edición
            if (clubModalEl) new bootstrap.Modal(clubModalEl).show();

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

        // 🚨 VERIFICACIÓN RÁPIDA EN EL CLIENTE
        if (!inputNombre.value || !inputDescripcion.value || !inputCiudad.value || !inputEnfoque.value) {
            mostrarAlerta("❌ Faltan campos obligatorios: Nombre, Descripción, Ciudad o Enfoque.", "error");
            return;
        }

        const formData = new FormData(form);

        // Lógica de Estado: Si es creación (POST) o edición de pendiente (PUT), forzar estado 'activo'
        const isEditingPending = metodo === 'PUT' && inputIdPresidente && inputIdPresidente.value !== '';

        if (metodo === 'POST' || isEditingPending) {
            formData.append("estado", "activo");
        }

        try {
            // El Content-Type es manejado por el navegador (multipart/form-data)
            // Este es el punto de la solicitud POST 400
            const res = await fetch(url, {
                method: metodo,
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
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

            // Cerrar modal
            if (clubModalEl) bootstrap.Modal.getInstance(clubModalEl)?.hide();

            clearForm();
            cargarClubes();

        } catch (error) {
            console.error("Error submit club:", error);
            const errorMessage = error.message.includes("403") ? "Acceso denegado (403). No eres administrador." : `Error de servidor: ${error.message}`;
            mostrarAlerta(errorMessage, "error");
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
            deleteMessageEl.textContent = `¿Estás seguro de que deseas eliminar "${clubName}" (ID: ${id})? Esta acción es irreversible.`;

        if (deleteConfirmModal) deleteConfirmModal.show();
    }

    if (btnConfirmDelete) {
        btnConfirmDelete.addEventListener("click", async () => {
            const token = getToken();
            const id = clubToDeleteId;

            if (!id || !token) {
                mostrarAlerta("ID o token inválido", "error");
                if (deleteConfirmModal) deleteConfirmModal.hide();
                return;
            }

            if (deleteConfirmModal) deleteConfirmModal.hide();

            try {
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
            mensaje = `¿Estás seguro de que deseas **RECHAZAR** el club "${nombre}" (ID: ${id})? Se eliminará la solicitud.`;
            if (btnConfirmStatus) btnConfirmStatus.className = 'btn btn-danger';
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

            if (statusConfirmModal) statusConfirmModal.hide();

            const url = `/api/clubs?id=${id}&status=change`;
            const headers = { 'Authorization': `Bearer ${token}` };

            try {
                let res;
                let successMessage;

                if (action === 'aprobar') {
                    // PUT: Cambia estado a activo (asumiendo que el backend maneja la promoción)
                    res = await fetch(url, {
                        method: 'PUT',
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
    setFechaDefault();
    cargarClubes();
});
