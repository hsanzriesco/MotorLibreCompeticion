// public/js/clubes.js - VERSIÓN FINAL SÓLO CON SESSIONSTORAGE
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

            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));

            return JSON.parse(jsonPayload);
        } catch (e) {
            // Si el token falla, lo limpiamos SOLO de sessionStorage, alineado con login.js
            sessionStorage.removeItem("token");
            return null;
        }
    }

    /**
     * Obtiene el ID del club y el rol del usuario logueado.
     * La fuente de verdad es EXCLUSIVAMENTE sessionStorage.
     * @returns {{club_id: number|null, role: string|null, id: number|null}}
     */
    function getAuthStatus() {
        const currentToken = sessionStorage.getItem("token"); // 👈 SÓLO sessionStorage
        const decoded = decodeJWT(currentToken);
        return {
            id: decoded?.id || null,
            // Usamos el valor del token decodificado como fuente de verdad
            club_id: decoded?.club_id ? Number(decoded.club_id) : null,
            role: decoded?.role || null
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

            if (!res.ok) throw new Error("HTTP " + res.status);
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
        const isPresidente = authStatus.role === 'presidente';

        // ... (El resto de la función renderClubes permanece igual) ...

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
                        </button>`; // Eliminado 'disabled' para que el presidente pueda hacer clic si lo necesita
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
                method: "POST", // Mantenemos POST aquí aunque sea un PUT en el servidor, si funciona así.
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

            // 2. 🛑 ACTUALIZACIÓN CLAVE: Sincronizar el objeto 'usuario' (CORRECCIÓN)
            const storedUser = sessionStorage.getItem("usuario");
            if (storedUser) {
                try {
                    const usuario = JSON.parse(storedUser);
                    const newClubId = Number(club_id);

                    // Actualizamos las claves que uses para el club ID
                    usuario.club_id = newClubId;
                    usuario.clubId = newClubId;

                    // Guardar el objeto actualizado SOLO en sessionStorage
                    sessionStorage.setItem("usuario", JSON.stringify(usuario));
                    // También actualizar la clave 'clubId' separada si existe
                    sessionStorage.setItem("clubId", newClubId);
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
        // Mostrar el modal si aún no está visible (asume que la función de gestión fuera de aquí lo maneja)
        // Ejemplo de mostrar modal si se usa Bootstrap:
        // const modal = new bootstrap.Modal(document.getElementById("modalSalirClub"));
        // modal.show();
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
                method: "PUT", // Usamos PUT para reflejar la acción de actualización en el servidor (clubs.js)
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
                sessionStorage.setItem("token", data.token); // ✅ CORRECCIÓN CLAVE
            }

            // 2. 🛑 ACTUALIZACIÓN CLAVE: Sincronizar el objeto 'usuario' (CORRECCIÓN)
            const storedUser = sessionStorage.getItem("usuario");
            if (storedUser) {
                try {
                    const usuario = JSON.parse(storedUser);

                    // Asegurar que se eliminen ambas posibles claves para el club ID
                    usuario.club_id = null;
                    usuario.clubId = null;

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