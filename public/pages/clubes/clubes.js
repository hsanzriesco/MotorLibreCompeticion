// public/js/clubes.js - VERSIÓN CORREGIDA PARA SINCRONIZACIÓN DE CLUBES VÍA JWT

document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("clubes-container");

    // El token es la fuente de verdad
    const token = sessionStorage.getItem("token") || localStorage.getItem("token");

    // --- NUEVAS FUNCIONES DE UTILIDAD DEL TOKEN ---

    /**
     * Decodifica el payload de un token JWT (compatible con JS vanilla).
     * @param {string} token
     * @returns {object|null}
     */
    function decodeJWT(token) {
        if (!token) return null;
        try {
            // El payload es la segunda parte del token (entre los puntos)
            const payload = token.split('.')[1];
            // Reemplaza caracteres no-Base64 para compatibilidad
            const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');

            // Decodifica Base64 y luego el URI (para manejar caracteres especiales)
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));

            return JSON.parse(jsonPayload);
        } catch (e) {
            console.error("Error decodificando token:", e);
            // Si el token falla, lo limpiamos para evitar errores futuros
            sessionStorage.removeItem("token");
            localStorage.removeItem("token");
            return null;
        }
    }

    /**
     * Obtiene el ID del club y el rol del usuario logueado.
     * @returns {{club_id: number|null, role: string|null, id: number|null}}
     */
    function getAuthStatus() {
        const currentToken = sessionStorage.getItem("token") || localStorage.getItem("token");
        const decoded = decodeJWT(currentToken);
        return {
            id: decoded?.id || null,
            club_id: decoded?.club_id ? Number(decoded.club_id) : null,
            role: decoded?.role || null
        };
    }

    // --- RESTO DE FUNCIONES HELPER ---

    function escapeHtml(s = "") {
        // ... (Tu función escapeHtml se mantiene)
        return String(s)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;");
    }

    function getImageUrl(imageData) {
        // ... (Tu función getImageUrl se mantiene)
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
            // Implementa aquí tu lógica real de mostrar alertas (e.g., con Bootstrap)
        };
    }

    // --- LÓGICA PRINCIPAL DE CARGA Y RENDERIZADO ---

    async function cargarClubes() {
        try {
            const res = await fetch("/api/clubs");
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
        if (!Array.isArray(clubes) || clubes.length === 0) {
            container.innerHTML = `<div class="col-12 mt-5"><p class="text-danger fw-bold">Aún no hay clubes creados.</p></div>`;
            return;
        }

        const authStatus = getAuthStatus(); // 🚨 LECTURA DE ESTADO DESDE EL TOKEN
        const isUserLoggedIn = authStatus.id !== null;
        const userClubId = authStatus.club_id;
        const isPresidente = authStatus.role === 'presidente';

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
                    // 🟢 MOSTRAR SALIR DEL CLUB
                    buttonHtml = `
                        <button class="btn btn-outline-light w-100 leave-btn" 
                                data-id="${club.id}" 
                                data-bs-toggle="modal" 
                                data-bs-target="#modalSalirClub"
                                ${isPresidente ? 'disabled title="Como presidente, debes usar la gestión del club para disolver o transferir."' : ''}>
                                ${isPresidente ? 'Presidente (Gestionar)' : 'Salir del club'}
                        </button>`;
                } else {
                    // 🔴 MOSTRAR UNIRME AL CLUB (o deshabilitado si ya es miembro)
                    buttonHtml = `
                        <button class="btn btn-netflix w-100 join-btn" 
                                data-id="${club.id}"
                                ${isMemberOfAnyClub ? 'disabled title="Ya eres miembro de otro club."' : ''}>
                                ${isMemberOfAnyClub ? 'Ya eres miembro de otro club' : 'Unirme al club'}
                        </button>`;
                }
            } else {
                // 🟡 MOSTRAR INICIAR SESIÓN
                buttonHtml = `<a href="/pages/auth/login/login.html" class="btn btn-netflix w-100">Inicia sesión para unirte</a>`;
            }

            // --- HTML DE LA TARJETA ---
            col.innerHTML = `
                <div class="club-card h-100 p-3 d-flex flex-column" data-club-id="${club.id}"
                    style="background:#141414;border:1px solid ${isMemberOfThisClub ? 'rgba(0,180,0,0.5)' : 'rgba(229,9,20,0.2)'};border-radius:8px">

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

        // Agregamos listeners a los botones
        document.querySelectorAll(".join-btn:not([disabled])").forEach(btn => btn.addEventListener("click", joinClub));
        document.querySelectorAll(".leave-btn:not([disabled])").forEach(btn => btn.addEventListener("click", setupLeaveModal));
    }

    // --- MANEJADOR DE JOIN CLUB ---
    async function joinClub(e) {
        const club_id = e.currentTarget.dataset.id;
        const authStatus = getAuthStatus();

        if (!authStatus.id) {
            mostrarAlerta("Debes iniciar sesión para unirte a un club", "error");
            return;
        }

        // El club_id del usuario logueado se pasa en el token, no se requiere en el body de join
        const bodyToSend = { club_id: Number(club_id) };

        try {
            const token = sessionStorage.getItem('token') || localStorage.getItem('token');
            const res = await fetch("/api/clubs?action=join", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify(bodyToSend) // user_id ya no es necesario aquí
            });
            const data = await res.json();

            if (!res.ok) {
                mostrarAlerta(data.message || "Error al unirse", "error");
                return;
            }

            // 🚨 SOLUCIÓN CLAVE: Guardar el nuevo token que contiene el club_id actualizado
            if (data.token) {
                sessionStorage.setItem("token", data.token);
                // Si usa localStorage para el token, también guárdelo aquí (consistencia)
                localStorage.setItem("token", data.token);
            }

            // Opcional, si todavía lo usa en otras partes: Actualizar el objeto "usuario"
            // const updatedPayload = decodeJWT(data.token);
            // if(updatedPayload) {
            //     sessionStorage.setItem("usuario", JSON.stringify(updatedPayload));
            //     localStorage.setItem("usuario", JSON.stringify(updatedPayload));
            // }


            mostrarAlerta("Te has unido al club", "exito");
            cargarClubes(); // Recargar la lista para reflejar el cambio de botones
        } catch (err) {
            console.error("Error joinClub:", err);
            mostrarAlerta("Error en el servidor", "error");
        }
    }

    // --- LÓGICA DE MODAL Y LEAVE CLUB ---

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

        // Asignamos la acción de salida, pasando el ID del club para que el backend lo valide
        newConfirmarBtn.onclick = () => {
            leaveClubAction(club_id);
        };
    }

    async function leaveClubAction(club_id) {
        const modalElement = document.getElementById("modalSalirClub");
        // Aseguramos que el modal se esconda si existe
        if (window.bootstrap && modalElement) {
            const modal = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
            modal.hide();
        }

        try {
            const token = sessionStorage.getItem('token') || localStorage.getItem('token');
            const res = await fetch("/api/clubs?action=leave", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                // Enviamos el ID del club que se está abandonando
                body: JSON.stringify({ club_id: Number(club_id) })
            });
            const data = await res.json();

            if (!res.ok) {
                mostrarAlerta(data.message || "Error al salir del club", "error");
                return;
            }

            // 🚨 SOLUCIÓN CLAVE: Guardar el nuevo token (club_id: null)
            if (data.token) {
                sessionStorage.setItem("token", data.token);
                // Si usa localStorage para el token, también guárdelo aquí
                localStorage.setItem("token", data.token);
            }

            // Opcional: Eliminar o actualizar el objeto "usuario" si aún es necesario
            // sessionStorage.removeItem("usuario");
            // localStorage.removeItem("usuario");

            mostrarAlerta("Te has salido del club", "exito");
            cargarClubes(); // Recargar la lista para reflejar el cambio de botones
        } catch (err) {
            console.error("Error leaveClub:", err);
            mostrarAlerta("Error en el servidor", "error");
        }
    }


    cargarClubes();
});