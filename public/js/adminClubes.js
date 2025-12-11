
document.addEventListener("DOMContentLoaded", () => {
    function getToken() {
        const token = sessionStorage.getItem('jwtToken');
        if (token) return token;
        return sessionStorage.getItem('token');
    }

    function getRole() {
        return sessionStorage.getItem('role');
    }

    function checkAdminAccess() {
        const token = getToken();
        const role = getRole();

        if (!token) {
            alert("Acceso no autorizado. Debes iniciar sesión.");
            window.location.href = '/pages/auth/login.html';
            return false;
        }

        if (role !== 'admin') {
            alert("Permisos insuficientes. Solo los administradores pueden acceder a esta página.");
            window.location.href = '/index.html';
            return false;
        }
        return true;
    }

    if (!checkAdminAccess()) {
        return; // Detiene la ejecución si la verificación falla
    }


    const TOTAL_COLUMNS = 8; // Asegurado que coincida con tu HTML

    const tablaActivos = document.getElementById("tabla-clubes-activos");
    const tablaPendientes = document.getElementById("tabla-clubes-pendientes");
    const badgePendientes = document.getElementById("badge-pendientes");
    const form = document.getElementById("club-form");
    const inputId = document.getElementById("club-id");
    const inputNombre = document.getElementById("nombre_club");
    const inputDescripcion = document.getElementById("descripcion");
    const inputCiudad = document.getElementById("ciudad");
    const inputEnfoque = document.getElementById("enfoque");
    const inputImagen = document.getElementById("imagen_club"); // Input de tipo file
    const inputFecha = document.getElementById("fecha_creacion");
    const inputIdPresidente = document.getElementById("id_presidente");
    const clubModalEl = document.getElementById("clubModal");
    const deleteConfirmModalEl = document.getElementById("deleteConfirmModal");
    const btnConfirmDelete = document.getElementById("btnConfirmDelete");
    const deleteMessageEl = document.getElementById("deleteConfirmMessage");
    let clubToDeleteId = null;
    const statusModalEl = document.getElementById("statusConfirmModal");
    const btnConfirmStatus = document.getElementById("btnConfirmStatus");
    const statusConfirmMessage = document.getElementById("statusConfirmMessage");
    let clubToChangeStatus = { id: null, action: null };

    let deleteConfirmModal = null;
    let statusConfirmModal = null;
    if (deleteConfirmModalEl && typeof bootstrap !== 'undefined') {
        deleteConfirmModal = new bootstrap.Modal(deleteConfirmModalEl, { keyboard: false });
    }
    if (statusModalEl && typeof bootstrap !== 'undefined') {
        statusConfirmModal = new bootstrap.Modal(statusModalEl, { keyboard: false });
    }

    function hoyISODate() {
        const d = new Date();
        return d.toISOString().split('T')[0];
    }

    function setFechaDefault() {
        if (inputFecha) inputFecha.value = hoyISODate();
    }

    function clearForm() {
        if (form) form.reset();
        if (inputId) inputId.value = "";
        if (inputIdPresidente) inputIdPresidente.value = "";
        if (inputEnfoque) inputEnfoque.value = "";
        if (!inputId || inputId.value === "") setFechaDefault();
        const presidenteSelectContainer = document.getElementById('presidente-select-container');
        if (presidenteSelectContainer) presidenteSelectContainer.style.display = 'none';
        const h3Title = document.querySelector('.admin-section h3.text-danger');
        if (h3Title) h3Title.textContent = 'Guardar Club';
    }

    function escapeHtml(str = "") {
        return String(str)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;");
    }
    function emitirAlerta(message, type) {
        console.log(`[${(type || 'log').toUpperCase()}] ${message.replace(/\*\*|/g, '')}`);

        if (typeof window.mostrarAlerta === 'function') {
            window.mostrarAlerta(message, type);
        } else {
            alert(`[${(type || 'INFO').toUpperCase()}] ${message.replace(/\*\*|/g, '')}`);
        }
    }

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

    function renderTabla(contenedorTabla, clubes, status = 'ok') {
        if (!contenedorTabla) return;

        contenedorTabla.innerHTML = "";

        const esPendiente = contenedorTabla.id === 'tabla-clubes-pendientes';

        if (status === 'error') {
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
            let accionesEspeciales = '';

            if (esPendiente) {
                accionesEspeciales = `
                    <button class="btn btn-success btn-sm me-2 aprobar-btn" data-id="${club.id}" data-nombre="${escapeHtml(club.nombre_club || club.nombre_evento || '')}"><i class="bi bi-check-circle"></i> Aprobar</button>
                    <button class="btn btn-danger btn-sm rechazar-btn" data-id="${club.id}" data-nombre="${escapeHtml(club.nombre_club || club.nombre_evento || '')}"><i class="bi bi-x-circle"></i> Rechazar</button>
                `;
            }

            const presidenteInfo = club.id_presidente
                ? `${escapeHtml(club.nombre_presidente || 'N/A')} (ID: ${club.id_presidente})`
                : 'Admin';

            const descripcionCorta = club.descripcion
                ? escapeHtml(club.descripcion.substring(0, 50) + (club.descripcion.length > 50 ? '...' : ''))
                : "Sin descripción";

            const clubNameForBtn = escapeHtml(club.nombre_club || club.nombre_evento || `Club ID: ${club.id}`);

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
                emitirAlerta(`Error ${res.status} al obtener club: ${errorText.substring(0, 100)}...`, "error");
                return;
            }

            const r = await res.json();
            const c = r.club || r.pending_club;

            if (!r.success || !c) {
                emitirAlerta(r.message || "No se pudo cargar el club", "error");
                return;
            }

            if (inputId) inputId.value = c.id;
            if (inputNombre) inputNombre.value = c.nombre_club || c.nombre_evento || "";
            if (inputDescripcion) inputDescripcion.value = c.descripcion || "";
            if (inputFecha) inputFecha.value = c.fecha_creacion ? c.fecha_creacion.toString().split('T')[0] : hoyISODate();
            if (inputCiudad) inputCiudad.value = c.ciudad || "";
            if (inputEnfoque) inputEnfoque.value = c.enfoque || "";
            if (inputImagen) inputImagen.value = ""; // No se rellena el input file
            if (inputIdPresidente) inputIdPresidente.value = c.id_presidente || "";
            const presidenteSelectContainer = document.getElementById('presidente-select-container');
            if (presidenteSelectContainer) presidenteSelectContainer.style.display = 'block';
            const h3Title = document.querySelector('.admin-section h3.text-danger');
            if (h3Title) h3Title.textContent = `Editar Club (ID: ${c.id})`;
            emitirAlerta(`Club ID ${c.id} cargado para edición.`, "info");
            if (inputNombre) inputNombre.focus();
            if (clubModalEl && typeof bootstrap !== 'undefined') {
                let inst = bootstrap.Modal.getInstance(clubModalEl);
                if (!inst) inst = new bootstrap.Modal(clubModalEl);
                inst.show();
            }

        } catch (error) {
            console.error("Error cargarClubEnFormulario:", error);
            if (error instanceof TypeError && (error.message.includes("Cannot set properties of null") || error.message.includes("Cannot read properties of null"))) {
                emitirAlerta("Error cargando club: **Verifica que todos los campos del formulario (IDs: 'fecha_creacion', 'nombre_club', etc.) en tu HTML existan y sean correctos.**", "error");
            } else {
                emitirAlerta("Error cargando club: " + error.message, "error");
            }
        }
    }

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
            const url = id ? `/api/clubs?id=${id}` : "/api/clubs";
            if (
                !inputNombre || !inputNombre.value.trim() ||
                !inputCiudad || !inputCiudad.value.trim() ||
                !inputEnfoque || !inputEnfoque.value.trim()
            ) {
                let missingFields = [];
                if (!inputNombre || inputNombre.value.trim() === "") missingFields.push("Nombre (ID: nombre_club)");
                if (!inputCiudad || inputCiudad.value.trim() === "") missingFields.push("Ciudad (ID: ciudad)");
                if (!inputEnfoque || inputEnfoque.value.trim() === "") missingFields.push("Enfoque (ID: enfoque)");

                if (missingFields.length > 0) {
                    emitirAlerta(`❌ Faltan campos obligatorios: **${missingFields.join(', ')}**.`, "error");
                } else {
                    emitirAlerta("❌ Error desconocido en la validación de formulario.", "error");
                }
                return;
            }

            const formData = new FormData(form);

            const imageFile = formData.get('imagen_club');
            if (metodo === 'PUT' && imageFile && imageFile.name === '' && imageFile.size === 0) {
                formData.delete('imagen_club');
            }

            formData.set("nombre_club", inputNombre.value);
            formData.set("nombre_evento", inputNombre.value);


            // Agregar/Limpiar el ID del presidente
            if (inputIdPresidente) {
                const presidenteId = inputIdPresidente.value.trim();
                if (presidenteId && !isNaN(parseInt(presidenteId))) {
                    formData.set("id_presidente", presidenteId);
                } else {
                    formData.delete("id_presidente");
                }
            }

            formData.append("estado", "activo");


            try {
                const res = await fetch(url, {
                    method: metodo, // PUT o POST
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    body: formData // Enviar el FormData directamente
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

                emitirAlerta(id ? "Club actualizado correctamente" : "Club creado correctamente", "exito");

                if (clubModalEl && typeof bootstrap !== 'undefined') {
                    const inst = bootstrap.Modal.getInstance(clubModalEl);
                    if (inst) inst.hide();
                }

                clearForm();
                cargarClubes();

            } catch (error) {
                console.error("Error submit club:", error);
                const errorMessage = error.message.includes("403") ? "Acceso denegado (403). No eres administrador." : `Error de servidor: ${error.message}`;
                emitirAlerta(errorMessage, "error");
            }
        });
    } else {
        console.warn("Formulario #club-form no encontrado en el DOM.");
    }

    function preguntarEliminarClub(e) {
        const id = e.currentTarget.dataset.id;
        const clubName = e.currentTarget.dataset.nombre || "este club";
        if (!id) return;

        // Mantener la variable global por si falla el data-attribute
        clubToDeleteId = id;

        if (deleteMessageEl)
            deleteMessageEl.textContent = `¿Estás seguro de que deseas eliminar "${clubName}" (ID: ${id})? Esta acción es irreversible.`;
        if (btnConfirmDelete) btnConfirmDelete.dataset.clubId = id;

        if (deleteConfirmModal) deleteConfirmModal.show();
    }

    if (btnConfirmDelete) {
        btnConfirmDelete.addEventListener("click", async (e) => {
            const token = getToken();

            const id = e.currentTarget.dataset.clubId || clubToDeleteId;

            if (!id || !token) {
                emitirAlerta("ID del club o token inválido.", "error");
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

                const r = res.status === 204 ? { success: true } : await res.json();

                if (!r.success) {
                    emitirAlerta(r.message || "Error eliminando", "error");
                    return;
                }

                emitirAlerta("Club eliminado correctamente", "exito");
                clubToDeleteId = null;
                e.currentTarget.dataset.clubId = "";
                cargarClubes();

            } catch (error) {
                console.error("Error eliminarClub:", error);
                const errorMessage = error.message.includes("403") ? "Acceso denegado (403). No eres administrador." : `Error eliminando club: ${error.message}`;
                emitirAlerta(errorMessage, "error");
            }
        });
    }

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
                    const urlAprobar = `/api/clubs?id=${id}&status=change`;
                    res = await fetch(urlAprobar, {
                        method: 'PUT',
                        headers: { ...headers, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ estado: 'activo' })
                    });
                    successMessage = "Club aprobado y activado correctamente.";
                } else if (action === 'rechazar') {
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

    clearForm(); // Usamos clearForm para inicializar todos los campos
    cargarClubes();
});
