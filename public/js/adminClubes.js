// public/js/adminClubes.js - VERSIÓN FINAL COMPLETAMENTE CORREGIDA

document.addEventListener("DOMContentLoaded", () => {

    // -----------------------------------------
    // UTIL: Token, Rol y Seguridad
    // -----------------------------------------

    /** Obtiene el Token JWT de la sessionStorage. 
     * Verifica 'jwtToken' (estándar) y 'token' (posible clave de login).
     */
    function getToken() {
        const token = sessionStorage.getItem('jwtToken');
        if (token) return token;
        // Fallback por si la aplicación usa 'token'
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
    // Total de columnas en la tabla para el colspan de mensajes.
    const TOTAL_COLUMNS = 8; // Ajustado a las 8 columnas de tu HTML

    // Elementos de las dos tablas y el contador
    const tablaActivos = document.getElementById("tabla-clubes-activos");
    const tablaPendientes = document.getElementById("tabla-clubes-pendientes");
    const badgePendientes = document.getElementById("badge-pendientes");

    // Formulario y botón de nueva creación
    const form = document.getElementById("club-form");
    const btnNewClub = document.getElementById("btn-new-club");

    const clubModalEl = document.getElementById('clubModal'); // El modal contenedor (si existe)

    // Elementos del formulario de edición/creación
    // Todos estos elementos deben existir en el HTML con el ID exacto.
    const inputId = document.getElementById("club-id");
    const inputNombre = document.getElementById("nombre_club"); // <--- Importante
    const inputDescripcion = document.getElementById("descripcion");
    const inputCiudad = document.getElementById("ciudad");
    const inputEnfoque = document.getElementById("enfoque"); // <--- Importante
    const inputImagen = document.getElementById("imagen_club"); // Input de tipo file
    const inputFecha = document.getElementById("fecha_creacion"); // <--- Importante
    const inputIdPresidente = document.getElementById("id_presidente");

    // Modals de Bootstrap: Declaración de elementos del DOM
    const deleteConfirmModalEl = document.getElementById("deleteConfirmModal");
    const btnConfirmDelete = document.getElementById("btnConfirmDelete");
    const deleteMessageEl = document.getElementById("deleteConfirmMessage");
    let clubToDeleteId = null;

    const statusModalEl = document.getElementById("statusConfirmModal");
    const btnConfirmStatus = document.getElementById("btnConfirmStatus");
    const statusConfirmMessage = document.getElementById("statusConfirmMessage");
    let clubToChangeStatus = { id: null, action: null };

    // Declarar las variables de instancia de Bootstrap Modal con 'let'
    let deleteConfirmModal = null;
    let statusConfirmModal = null;

    // Asignar las instancias de Bootstrap (usando el chequeo de existencia por si el HTML no está cargado)
    if (deleteConfirmModalEl && typeof bootstrap !== 'undefined') {
        // Inicializa el modal de confirmación de borrado
        deleteConfirmModal = new bootstrap.Modal(deleteConfirmModalEl, { keyboard: false });
    }
    if (statusModalEl && typeof bootstrap !== 'undefined') {
        // Inicializa el modal de confirmación de estado
        statusConfirmModal = new bootstrap.Modal(statusModalEl, { keyboard: false });
    }
    // FIN DE INSTANCIAS DE MODAL


    // -----------------------------------------
    // UTIL: Fecha, Limpieza y Escape HTML
    // -----------------------------------------

    /** Obtiene la fecha de hoy en formato 'YYYY-MM-DD'. */
    function hoyISODate() {
        const d = new Date();
        return d.toISOString().split('T')[0];
    }

    /** Inicializa el valor del input de fecha a la fecha actual. */
    function setFechaDefault() {
        // Corregido: comprueba si inputFecha existe
        if (inputFecha) inputFecha.value = hoyISODate();
    }

    /** Limpia el formulario y lo prepara para la creación. */
    function clearForm() {
        if (form) form.reset();
        // Corregido: comprueba si los elementos existen antes de limpiar
        if (inputId) inputId.value = "";
        if (inputIdPresidente) inputIdPresidente.value = "";
        if (inputCiudad) inputCiudad.value = "";
        if (inputEnfoque) inputEnfoque.value = "";
        if (inputNombre) inputNombre.value = "";
        setFechaDefault();
    }

    if (btnNewClub) {
        btnNewClub.addEventListener('click', () => {
            clearForm();
            // Abre el modal para nuevo club (o edita si ya tiene instancia)
            if (clubModalEl && typeof bootstrap !== 'undefined') new bootstrap.Modal(clubModalEl).show();
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

    /** * Muestra una alerta, usando la implementación global (alertas.js) si está disponible. */
    function emitirAlerta(message, type) {
        console.log(`[${(type || 'log').toUpperCase()}] ${message.replace(/\*\*|/g, '')}`);

        if (typeof window.mostrarAlerta === 'function') {
            // Asume que mostrarAlerta existe globalmente (e.g., in alertas.js)
            window.mostrarAlerta(message, type);
        } else {
            // Fallback simple
            alert(`[${(type || 'INFO').toUpperCase()}] ${message.replace(/\*\*|/g, '')}`);
        }
    }

    // -----------------------------------------
    // CARGAR LISTA DE CLUBES Y DISTRIBUIR
    // -----------------------------------------

    /** Carga los clubes activos y pendientes de la API y renderiza las tablas. */
    async function cargarClubes() {
        const token = getToken();
        if (!token) {
            emitirAlerta("❌ **ERROR CRÍTICO:** Token de administrador no disponible. Se requiere re-login.", "error");
            renderTabla(tablaActivos, [], 'error');
            renderTabla(tablaPendientes, [], 'error');
            if (badgePendientes) badgePendientes.style.display = 'none';
            return;
        }

        const headers = { 'Authorization': `Bearer ${token}` };

        // Mostrar estados de carga iniciales
        if (tablaActivos) tablaActivos.innerHTML = `<tr><td colspan="${TOTAL_COLUMNS}" class="text-warning text-center">Cargando clubes activos...</td></tr>`;
        if (tablaPendientes) tablaPendientes.innerHTML = `<tr><td colspan="${TOTAL_COLUMNS}" class="text-warning text-center">Cargando solicitudes pendientes...</td></tr>`;

        try {
            const [resActivos, resPendientes] = await Promise.all([
                fetch("/api/clubs?estado=activo", { headers }),
                fetch("/api/clubs?estado=pendiente", { headers })
            ]);

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

            renderTabla(tablaActivos, activos);
            renderTabla(tablaPendientes, pendientes);

            if (badgePendientes) {
                badgePendientes.textContent = pendientes.length;
                badgePendientes.style.display = pendientes.length > 0 ? 'inline-block' : 'none';
            }

        } catch (error) {
            console.error("Error cargarClubes:", error);

            let customMessage = "Error al conectar con el servidor.";
            if (error.message.includes('(401)') || error.message.includes('(403)')) {
                customMessage = "❌ **Error de Permisos (401/403):** Token inválido o expirado. Vuelve a iniciar sesión.";
            } else if (error.message.includes('Fallo al cargar')) {
                customMessage = `Error de red/API: ${error.message.split('Detalle:')[0]}`;
            }

            emitirAlerta(customMessage, "error");
            renderTabla(tablaActivos, [], 'error');
            renderTabla(tablaPendientes, [], 'error');
        }
    }

    /** Renderiza la tabla de clubes. */
    function renderTabla(contenedorTabla, clubes, status = 'ok') {
        if (!contenedorTabla) return;

        contenedorTabla.innerHTML = "";

        const esPendiente = contenedorTabla.id === 'tabla-clubes-pendientes';

        if (status === 'error') {
            // Usa TOTAL_COLUMNS para asegurar que el mensaje ocupe todo el ancho.
            contenedorTabla.innerHTML = `<tr><td colspan="${TOTAL_COLUMNS}" class="text-danger text-center">**Error de servidor o acceso denegado al cargar datos**</td></tr>`;
            return;
        }

        if (!Array.isArray(clubes) || clubes.length === 0) {
            const mensaje = esPendiente ?
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

            if (esPendiente) {
                badgeEstado = '<span class="badge bg-warning text-dark">PENDIENTE</span>';
                accionesEspeciales = `
                    <button class="btn btn-success btn-sm me-2 aprobar-btn" data-id="${club.id}" data-nombre="${escapeHtml(club.nombre_club || '')}"><i class="bi bi-check-circle"></i> Aprobar</button>
                    <button class="btn btn-danger btn-sm rechazar-btn" data-id="${club.id}" data-nombre="${escapeHtml(club.nombre_club || '')}"><i class="bi bi-x-circle"></i> Rechazar</button>
                `;
            } else if (club.estado === 'activo') {
                badgeEstado = '<span class="badge bg-primary">ACTIVO</span>';
            } else {
                badgeEstado = '<span class="badge bg-secondary">DESCONOCIDO/RECHAZADO</span>';
            }

            const presidenteInfo = club.id_presidente
                ? `${escapeHtml(club.nombre_presidente || 'N/A')} (ID: ${club.id_presidente})`
                : 'Admin';

            const descripcionCorta = club.descripcion
                ? escapeHtml(club.descripcion.substring(0, 50) + (club.descripcion.length > 50 ? '...' : ''))
                : "Sin descripción";

            // Nombre para botones y confirmaciones
            const clubNameForBtn = escapeHtml(club.nombre_club || `Club ID: ${club.id}`);

            // ESTRUCTURA COINCIDENTE CON TU HTML (8 COLUMNAS):
            // ID | Nombre | Desc./Enfoque | Fecha Creación | Ciudad | Presidente | Imagen | Acciones
            fila.innerHTML = `
                <td>${escapeHtml(String(club.id || ''))}</td>
                <td>${escapeHtml(club.nombre_club || 'Sin nombre')}</td>
                <td>
                    ${descripcionCorta}
                    <div class="small text-muted">${escapeHtml(club.enfoque || '')}</div>
                </td>
                <td>${fecha}</td>
                <td>${escapeHtml(club.ciudad || 'N/A')}</td>
                <td>${presidenteInfo}</td>
                <td>
                    ${club.imagen_club ? `<img src="${club.imagen_club}" class="club-thumb img-thumbnail" alt="Imagen club" style="width: 50px; height: 50px; object-fit: cover;">` : "-"}
                </td>
                <td>
                    <button class="btn btn-warning btn-sm me-2 editar-btn" data-id="${club.id}"><i class="bi bi-pencil"></i> Editar</button>
                    <button class="btn btn-danger btn-sm eliminar-btn" data-id="${club.id}" data-nombre="${clubNameForBtn}"><i class="bi bi-trash"></i> Eliminar</button>
                    ${accionesEspeciales ? `<hr class="my-1 border-secondary">${accionesEspeciales}` : ''}
                </td>
            `;

            contenedorTabla.appendChild(fila);
        });

        // Adjuntar listeners de eventos (mejor práctica que el inline onclick)
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
        // Obtenemos el ID del atributo 'data-id' del botón
        const id = e.currentTarget.dataset.id;
        const token = getToken();
        if (!id || !token) return;

        clearForm();

        const headers = { 'Authorization': `Bearer ${token}` };

        try {
            // Endpoint con query string ?id= para Next.js
            const res = await fetch(`/api/clubs?id=${id}`, { headers });

            if (!res.ok) {
                const errorText = await res.text();
                emitirAlerta(`Error ${res.status} al obtener club: ${errorText.substring(0, 100)}...`, "error");
                return;
            }

            const r = await res.json();
            const c = r.club || r.pending_club;

            if (!r.success || !c) {
                emitirAlerta(r.message || "No se pudo cargar el club", "error");
                return;
            }

            // Si el modal está definido en el HTML, lo abrimos
            if (clubModalEl && typeof bootstrap !== 'undefined') new bootstrap.Modal(clubModalEl).show();

            // Llenar el formulario con los datos del club
            // Se añaden los 'if' para prevenir errores si el elemento no existe en el HTML
            if (inputId) inputId.value = c.id;
            if (inputNombre) inputNombre.value = c.nombre_club || "";
            if (inputDescripcion) inputDescripcion.value = c.descripcion || "";
            // ARREGLO DE FECHA
            if (inputFecha) inputFecha.value = c.fecha_creacion ? c.fecha_creacion.toString().split('T')[0] : hoyISODate();

            if (inputCiudad) inputCiudad.value = c.ciudad || "";
            if (inputEnfoque) inputEnfoque.value = c.enfoque || "";

            if (inputImagen) inputImagen.value = ""; // No se rellena el input file

            // Cargar ID del presidente
            if (inputIdPresidente) inputIdPresidente.value = c.id_presidente || "";

            if (c.estado === 'pendiente' || c.estado === null) {
                emitirAlerta(`Club pendiente ID ${c.id} cargado. Al guardar, se establecerá como activo.`, "info");
            } else {
                emitirAlerta(`Club ID ${c.id} cargado para edición.`, "info");
            }

            // Foco en el nombre si existe
            if (inputNombre) inputNombre.focus();

        } catch (error) {
            console.error("Error cargarClubEnFormulario:", error);
            // Mostrar un mensaje específico si el error sigue siendo de tipo null
            if (error instanceof TypeError && (error.message.includes("Cannot set properties of null") || error.message.includes("Cannot read properties of null"))) {
                emitirAlerta("Error cargando club: **Verifica que todos los campos del formulario (IDs: 'fecha_creacion', 'nombre_club', etc.) en tu HTML existan y sean correctos.**", "error");
            } else {
                emitirAlerta("Error cargando club: " + error.message, "error");
            }
        }
    }


    // -----------------------------------------
    // GUARDAR CLUB (POST / PUT)
    // -----------------------------------------

    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();

            const token = getToken();
            if (!token) {
                emitirAlerta("❌ Error: No se encontró el token de administrador.", "error");
                return;
            }

            const id = inputId ? inputId.value : '';
            const metodo = id ? "PUT" : "POST";

            // ⭐ CORRECCIÓN CLAVE: Usar Query Parameter para PUT y DELETE.
            const url = id ? `/api/clubs?id=${id}` : "/api/clubs";

            // 🚨 VERIFICACIÓN RÁPIDA EN EL CLIENTE (AHORA CON DIAGNÓSTICO DETALLADO)
            // La condición es: si el elemento no existe (es null) O si existe y su valor está vacío.
            if (
                !inputNombre || !inputNombre.value ||
                !inputCiudad || !inputCiudad.value ||
                !inputEnfoque || !inputEnfoque.value
            ) {
                // ⭐ MENSAJE CLAVE: Diagnostica exactamente cuál podría faltar
                let missingFields = [];
                // Si el elemento es null, o si existe pero su valor es cadena vacía.
                if (!inputNombre || inputNombre.value.trim() === "") missingFields.push("Nombre (ID: nombre_club)");
                if (!inputDescripcion || inputDescripcion.value.trim() === "") missingFields.push("Descripción (ID: descripcion)");
                if (!inputCiudad || inputCiudad.value.trim() === "") missingFields.push("Ciudad (ID: ciudad)");
                if (!inputEnfoque || inputEnfoque.value.trim() === "") missingFields.push("Enfoque (ID: enfoque)");

                // Si el error es por valor vacío o elemento HTML faltante:
                if (missingFields.length > 0) {
                    emitirAlerta(`❌ Faltan campos obligatorios o el elemento HTML no fue encontrado: **${missingFields.join(', ')}**. Por favor, revisa que los IDs HTML sean correctos.`, "error");
                } else {
                    emitirAlerta("❌ Error desconocido en la validación de formulario.", "error");
                }
                return;
            }

            const formData = new FormData(form);

            // Limpiar FormData de campos vacíos (especialmente el archivo si no se subió uno nuevo)
            const imageFile = formData.get('imagen_club');
            if (imageFile && imageFile.name === '' && imageFile.size === 0) {
                formData.delete('imagen_club');
            } else {
                // Si hay un archivo, se mantiene.
            }

            // Agregar el ID del presidente si está presente
            if (inputIdPresidente && inputIdPresidente.value) {
                formData.set("id_presidente", inputIdPresidente.value);
            }

            // Si es una creación (POST) o una edición de un club pendiente, aseguramos que el estado sea activo.
            if (metodo === 'POST' || (metodo === 'PUT' && inputIdPresidente && inputIdPresidente.value)) {
                formData.append("estado", "activo");
            }


            try {
                const res = await fetch(url, {
                    method: metodo,
                    headers: {
                        'Authorization': `Bearer ${token}`
                        // NO AGREGAR 'Content-Type': 'multipart/form-data', el navegador lo hace automáticamente
                    },
                    body: formData
                });

                if (!res.ok) {
                    const errorText = await res.text();
                    throw new Error(`Error ${res.status} al guardar: ${errorText.substring(0, 200)}...`);
                }

                const r = await res.json();

                if (!r.success) {
                    emitirAlerta(r.message || "Error guardando club", "error");
                    return;
                }

                emitirAlerta(id ? "Club actualizado" : "Club creado", "exito");

                // Ocultar el modal si está abierto
                // Usamos el operador de encadenamiento opcional para mayor seguridad
                if (clubModalEl && typeof bootstrap !== 'undefined') {
                    const inst = bootstrap.Modal.getInstance(clubModalEl);
                    if (inst) inst.hide();
                }

                clearForm();
                cargarClubes();

            } catch (error) {
                console.error("Error submit club:", error);
                // Mostrar el mensaje capturado de errorText
                const errorMessage = error.message.includes("403") ? "Acceso denegado (403). No eres administrador." : `Error de servidor: ${error.message}`;
                emitirAlerta(errorMessage, "error");
            }
        });
    } else {
        console.warn("Formulario #club-form no encontrado en el DOM.");
    }


    // -----------------------------------------
    // ELIMINAR CLUB
    // -----------------------------------------

    function preguntarEliminarClub(e) {
        const id = e.currentTarget.dataset.id;
        const clubName = e.currentTarget.dataset.nombre || "este club"; // Añadido: obtener el nombre del data-attribute
        if (!id) return;

        clubToDeleteId = id;

        // Utilizamos el nombre del data-attribute o, como fallback, el nombre de la fila
        if (deleteMessageEl)
            deleteMessageEl.textContent = `¿Estás seguro de que deseas eliminar "${clubName}" (ID: ${id})? Esta acción es irreversible.`;

        // Utilizar la confirmación de Bootstrap
        if (deleteConfirmModal) deleteConfirmModal.show();
    }

    if (btnConfirmDelete) {
        btnConfirmDelete.addEventListener("click", async () => {
            const token = getToken();
            const id = clubToDeleteId;

            if (!id || !token) {
                emitirAlerta("ID o token inválido", "error");
                if (deleteConfirmModal) deleteConfirmModal.hide();
                return;
            }

            if (deleteConfirmModal) deleteConfirmModal.hide();

            try {
                // ⭐ CORRECCIÓN CLAVE: Usar Query Parameter para DELETE.
                const res = await fetch(`/api/clubs?id=${id}`, {
                    method: "DELETE",
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!res.ok) {
                    const errorText = await res.text();
                    throw new Error(`Error ${res.status} al eliminar: ${errorText.substring(0, 100)}...`);
                }

                // Si la respuesta es 204 No Content (DELETE exitoso), r es { success: true }
                const r = res.status === 204 ? { success: true } : await res.json();

                if (!r.success) {
                    emitirAlerta(r.message || "Error eliminando", "error");
                    return;
                }

                emitirAlerta("Club eliminado correctamente", "exito");
                clubToDeleteId = null;
                cargarClubes();

            } catch (error) {
                console.error("Error eliminarClub:", error);
                const errorMessage = error.message.includes("403") ? "Acceso denegado (403). No eres administrador." : `Error eliminando club: ${error.message}`;
                emitirAlerta(errorMessage, "error");
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
                emitirAlerta("Solicitud de cambio de estado o token inválido", "error");
                if (statusConfirmModal) statusConfirmModal.hide();
                return;
            }

            if (statusConfirmModal) statusConfirmModal.hide();

            const headers = { 'Authorization': `Bearer ${token}` };

            try {
                let res;
                let successMessage;

                if (action === 'aprobar') {
                    // Endpoint específico para cambio de estado
                    const urlAprobar = `/api/clubs?id=${id}&status=change`;
                    res = await fetch(urlAprobar, {
                        method: 'PUT',
                        headers: { ...headers, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ estado: 'activo' })
                    });
                    successMessage = "Club aprobado y activado correctamente.";
                } else if (action === 'rechazar') {
                    // ⭐ RECHAZAR = ELIMINAR (usando DELETE)
                    res = await fetch(`/api/clubs?id=${id}`, {
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

                // Intenta leer el JSON. Si es DELETE y no hay contenido (204), asume éxito.
                const r = res.status === 204 ? { success: true } : await res.json();

                if (!r.success) {
                    emitirAlerta(r.message || `Error al ${action} el club.`, "error");
                    return;
                }

                emitirAlerta(successMessage, "exito");
                clubToChangeStatus = { id: null, action: null };
                cargarClubes();

            } catch (error) {
                const errorMessage = error.message.includes("403") ? "Acceso denegado (403). No eres administrador." : `Error de servidor al ${action} club: ${error.message}`;
                console.error(`Error de red al ${action} club:`, error);
                emitirAlerta(errorMessage, "error");
            }
        });
    }

    // -----------------------------------------
    // Inicializar
    // -----------------------------------------
    setFechaDefault();
    cargarClubes();
});
