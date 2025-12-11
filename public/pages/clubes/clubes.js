// public/js/clubes.js - VERSIÓN FINAL SÓLO CON SESSIONSTORAGE Y OPTIMIZACIÓN DE SINCRONIZACIÓN

document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("clubes-container");

    // --- NUEVAS FUNCIONES DE UTILIDAD DEL TOKEN ---

    /**
     * Decodifica el payload de un token JWT (compatible con JS vanilla).
     * @param {string} token
     * @returns {object|null}
     */
    function decodeJWT(token) {
        if (!token) return null;
        try {
            const payload = token.split('.')[1];
            const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');

            // Corregido para manejar correctamente caracteres especiales
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));

            return JSON.parse(jsonPayload);
        } catch (e) {
            // Si el token falla, lo limpiamos, alineado con login.js
            sessionStorage.removeItem("token");
            return null;
        }
    }

    /**
     * Obtiene el ID del club y el rol del usuario logueado.
     * La fuente de verdad es EXCLUSIVAMENTE sessionStorage.
     * @returns {{club_id: number|null, role: string|null, id: number|null, isPresidente: boolean}}
     */
    function getAuthStatus() {
        const currentToken = sessionStorage.getItem("token"); // 👈 SÓLO sessionStorage
        const decoded = decodeJWT(currentToken);

        const clubId = decoded?.club_id ? Number(decoded.club_id) : null;
        const role = decoded?.role || null;

        return {
            id: decoded?.id || null,
            // Usamos el valor del token decodificado como fuente de verdad
            club_id: clubId,
            role: role,
            // El rol 'presidente' es la fuente de verdad para isPresidente
            isPresidente: role === 'presidente'
        };
    }

    // --- RESTO DE FUNCIONES HELPER ---

    function escapeHtml(s = "") {
        return String(s)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;");
    }

    function getImageUrl(imageData) {
        if (!imageData) return '../../img/placeholder.jpg';
        if (imageData.startsWith('http') || imageData.startsWith('data:image/')) {
            return imageData;
        }
        return `data:image/jpeg;base64,${imageData}`;
    }

    // Asegúrate de que existe una función global para mostrar alertas
    if (typeof mostrarAlerta !== 'function') {
        window.mostrarAlerta = (mensaje, tipo) => {
            console.log(`[ALERTA ${tipo.toUpperCase()}]: ${mensaje}`);
        };
    }

    // --- LÓGICA PRINCIPAL DE CARGA Y RENDERIZADO ---

    async function cargarClubes() {
        try {
            // Añadir el token a la cabecera del GET para posibles validaciones
            const token = sessionStorage.getItem("token"); // 👈 SÓLO sessionStorage
            const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

            const res = await fetch("/api/clubs", { headers });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(`HTTP ${res.status}. Detalle: ${errorData.message || 'Error desconocido'}`);
            }
            const data = await res.json();

            if (!data.success) {
                mostrarAlerta(data.message || "Error cargando clubes", "error");
                return;
            }
            renderClubes(data.clubs);
        } catch (err) {
            console.error("Error cargando clubes:", err);
            mostrarAlerta("No se pudo conectar con el servidor", "error");
        }
    }

    function renderClubes(clubes) {
        container.innerHTML = "";

        // La fuente de verdad siempre es el token persistente (en sessionStorage)
        const authStatus = getAuthStatus();
        const isUserLoggedIn = authStatus.id !== null;
        const userClubId = authStatus.club_id; // <-- Este es el valor clave
        const isPresidente = authStatus.isPresidente;

        if (!Array.isArray(clubes) || clubes.length === 0) {
            container.innerHTML = `<div class="col-12 mt-5"><p class="text-danger fw-bold">Aún no hay clubes creados.</p></div>`;
            return;
        }

        const row = document.createElement("div");
        row.className = "row gy-3";

        clubes.forEach(club => {
            const col = document.createElement("div");
            col.className = "col-md-4";

            const clubIdNum = Number(club.id);
            const isMemberOfThisClub = userClubId === clubIdNum;
            const isMemberOfAnyClub = userClubId !== null;

            const clubName = club.nombre_evento || 'Club sin nombre (ERROR API)';
            const clubDescription = club.descripcion || 'Sin descripción';
            const clubImageSource = getImageUrl(club.imagen_url);

            let buttonHtml = '';

            if (isUserLoggedIn) {
                if (isMemberOfThisClub) {
                    // 🟢 Muestra estado de membresía
                    buttonHtml = `
                        <button class="btn btn-success w-100" 
                                title="Para gestionar o salir de tu club, usa la sección de perfil/gestión.">
                                ${isPresidente ? 'Presidente' : 'Miembro Activo'}
                        </button>`;
                } else {
                    // 🔴 Botón UNIRME AL CLUB (o deshabilitado si ya es miembro de OTRO)
                    buttonHtml = `
                        <button class="btn btn-netflix w-100 join-btn" 
                                data-id="${club.id}"
                                ${isMemberOfAnyClub ? 'disabled title="Ya eres miembro de otro club. Debes abandonarlo primero."' : ''}>
                                ${isMemberOfAnyClub ? 'Ya eres miembro de otro club' : 'Unirme al club'}
                        </button>`;
                }
            } else {
                // 🟡 MOSTRAR INICIAR SESIÓN (si no hay token)
                buttonHtml = `<a href="/pages/auth/login/login.html" class="btn btn-netflix w-100">Inicia sesión para unirte</a>`;
            }

            const cardBorderColor = isMemberOfThisClub ? 'rgba(0,180,0,0.5)' : 'rgba(229,9,20,0.2)';

            // --- HTML DE LA TARJETA ---
            col.innerHTML = `
                <div class="club-card h-100 p-3 d-flex flex-column" data-club-id="${club.id}"
                    style="background:#141414;border:1px solid ${cardBorderColor};border-radius:8px">

                    <img src="${escapeHtml(clubImageSource)}" 
                        alt="${escapeHtml(clubName)} Logo" 
                        class="img-fluid rounded mb-2" 
                        style="max-height:160px;object-fit:cover;width:100%;">
                    
                    <div class="flex-grow-1">
                        <h4 class="text-danger">${escapeHtml(clubName)}</h4>
                        <p>${escapeHtml(clubDescription)}</p>
                    </div>
                    
                    <div class="mt-auto">
                        ${buttonHtml}
                    </div>
                </div>
            `;

            row.appendChild(col);
        });

        container.appendChild(row);

        // Agregamos listeners solo a los botones de UNIRSE habilitados
        document.querySelectorAll(".join-btn:not([disabled])").forEach(btn => btn.addEventListener("click", joinClub));

    }

    // --- MANEJADOR DE JOIN CLUB ---
    async function joinClub(e) {
        const club_id = e.currentTarget.dataset.id;
        const authStatus = getAuthStatus();

        if (!authStatus.id) {
            mostrarAlerta("Debes iniciar sesión para unirte a un club", "error");
            return;
        }

        const bodyToSend = { club_id: Number(club_id) };

        try {
            const token = sessionStorage.getItem('token'); // 👈 SÓLO sessionStorage
            const res = await fetch("/api/clubs?action=join", {
                method: "POST", // Mantenemos POST
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify(bodyToSend)
            });
            const data = await res.json();

            if (!res.ok) {
                mostrarAlerta(data.message || "Error al unirse", "error");
                return;
            }

            // 1. Guardar el nuevo token (SÓLO en sessionStorage)
            if (data.token) {
                sessionStorage.setItem("token", data.token);
            }

            // 2. 🛑 ELIMINACIÓN DE SINCRONIZACIÓN MANUAL: 
            // Ya no sincronizamos manualmente el objeto 'usuario'. 
            // El nuevo token contiene el club_id actualizado y getAuthStatus() usará ese token.
            // Para mantener la consistencia con tu código, solo actualizamos el token.

            // 3. 🛑 MANTENER COHERENCIA CON CÓDIGO VIEJO (SOLO SI SEGUISTE USANDO EL OBJETO 'usuario' EN OTROS LADOS)
            // Si el objeto 'usuario' se sigue usando fuera de getAuthStatus, la única sincronización segura es esta:
            const storedUser = sessionStorage.getItem("usuario");
            if (storedUser) {
                try {
                    const usuario = JSON.parse(storedUser);
                    const newClubId = Number(club_id);

                    // Solo actualizamos el club_id. El rol debe venir del token.
                    usuario.club_id = newClubId;
                    usuario.clubId = newClubId;

                    sessionStorage.setItem("usuario", JSON.stringify(usuario));
                    sessionStorage.setItem("clubId", newClubId); // Clave separada
                } catch (parseError) {
                    console.error("Error al parsear o actualizar el objeto usuario:", parseError);
                }
            }
            // 🛑 FIN DE LA ACTUALIZACIÓN

            mostrarAlerta("Te has unido al club", "exito");
            cargarClubes(); // Recargar la lista para reflejar el cambio de botones
        } catch (err) {
            console.error("Error joinClub:", err);
            mostrarAlerta("Error en el servidor", "error");
        }
    }

    // --- LÓGICA DE MODAL Y LEAVE CLUB (ajustada a sessionStorage) ---

    // La función setupLeaveModal permanece igual...
    function setupLeaveModal(e) {
        const club_id = e.currentTarget.dataset.id;

        const authStatus = getAuthStatus();
        if (!authStatus.id) {
            mostrarAlerta("Debes iniciar sesión", "error");
            return;
        }

        const confirmarBtn = document.getElementById("confirmarSalirClub");

        // Clonamos el botón para limpiar listeners antiguos
        const newConfirmarBtn = confirmarBtn.cloneNode(true);
        confirmarBtn.replaceWith(newConfirmarBtn);

        // Asignamos la acción de salida
        newConfirmarBtn.onclick = () => {
            leaveClubAction(club_id);
        };
        // Lógica de mostrar modal...
    }

    async function leaveClubAction(club_id) {
        const modalElement = document.getElementById("modalSalirClub");
        if (window.bootstrap && modalElement) {
            // Ocultar el modal si está visible
            const modal = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
            modal.hide();
        }

        try {
            const token = sessionStorage.getItem('token'); // 👈 SÓLO sessionStorage
            const res = await fetch("/api/clubs?action=leave", {
                method: "PUT", // Usamos PUT (coherente con la lógica del servidor)
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ club_id: Number(club_id) })
            });
            const data = await res.json();

            if (!res.ok) {
                mostrarAlerta(data.message || "Error al salir del club", "error");
                return;
            }

            // 1. Guardar el nuevo token (club_id: null) (SÓLO en sessionStorage)
            if (data.token) {
                sessionStorage.setItem("token", data.token);
            }

            // 2. 🛑 ACTUALIZACIÓN CLAVE: Sincronizar el objeto 'usuario' (Mantenemos la lógica de sincronización por si el objeto 'usuario' se usa fuera de getAuthStatus)
            const storedUser = sessionStorage.getItem("usuario");
            if (storedUser) {
                try {
                    const usuario = JSON.parse(storedUser);

                    // Asegurar que se eliminen ambas posibles claves para el club ID y el rol
                    usuario.club_id = null;
                    usuario.clubId = null;
                    // IMPORTANTE: El rol debe venir del token. Si el token lo cambió a 'user', lo reflejamos.
                    // Si el token no tiene rol, asumimos 'user'.
                    const payloadDebug = decodeJWT(data.token);
                    usuario.role = payloadDebug?.role || 'user';

                    // Guardar el objeto actualizado SOLO en sessionStorage
                    sessionStorage.setItem("usuario", JSON.stringify(usuario));
                    sessionStorage.removeItem("clubId"); // Eliminar clave 'clubId' separada
                } catch (parseError) {
                    console.error("Error al parsear o actualizar el objeto usuario al salir:", parseError);
                }
            }
            // 🛑 FIN DE LA ACTUALIZACIÓN

            mostrarAlerta("Te has salido del club", "exito");
            cargarClubes(); // Recargar la lista para reflejar el cambio de botones
        } catch (err) {
            console.error("Error leaveClub:", err);
            mostrarAlerta("Error en el servidor", "error");
        }
    }


    cargarClubes();
});