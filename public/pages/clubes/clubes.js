// public/js/clubes.js - VERSIÓN MODIFICADA Y CORREGIDA

document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("clubes-container");

    // ==========================================================
    // ⭐ LÓGICA CLAVE DE RECARGA: Detectar si el usuario se desvinculó de un club
    // ==========================================================
    if (sessionStorage.getItem('clubesDebeRecargar') === 'true') {

        // 1. Limpiar el indicador inmediatamente para evitar bucles
        sessionStorage.removeItem('clubesDebeRecargar');

        // 2. Recargar la página (con 'true' para forzar una recarga completa)
        // Esto asegura que la función getAuthStatus() lea la sesión limpia.
        window.location.reload(true);

        // 🛑 CRÍTICO: Detener el resto de la ejecución hasta que la página se recargue.
        return;
    }
    // ==========================================================


    // --- FUNCIONES DE UTILIDAD DEL TOKEN Y SEGURIDAD ---

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
            // Rellena el padding si es necesario y reemplaza caracteres no-Base64
            const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
            const base64Padded = base64.length % 4 === 0 ? base64 : base64 + '==='.slice(0, 4 - (base64.length % 4));

            // Decodifica Base64 y luego el URI (para manejar caracteres especiales)
            const jsonPayload = decodeURIComponent(atob(base64Padded).split('').map(function (c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));

            return JSON.parse(jsonPayload);
        } catch (e) {
            console.error("Error decodificando JWT:", e);
            // Limpiamos los tokens si son inválidos
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
        // Priorizamos localStorage para la persistencia
        const currentToken = localStorage.getItem("token") || sessionStorage.getItem("token");
        const decoded = decodeJWT(currentToken);
        return {
            id: decoded?.id || null,
            // Aseguramos que el club_id sea un número (o null si es 0, null, o undefined)
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
        // CORRECCIÓN: el club puede tener 'imagen_club' o 'imagen_url' (si lo devuelve la API)
        const imageSource = imageData || '../../img/placeholder.jpg';
        if (imageSource.startsWith('http') || imageSource.startsWith('data:image/')) {
            return imageSource;
        }
        // Asume que si no es URL, es una cadena Base64
        return `data:image/jpeg;base64,${imageSource}`;
    }

    // Asegúrate de que existe una función global para mostrar alertas
    if (typeof mostrarAlerta !== 'function') {
        window.mostrarAlerta = (mensaje, tipo) => {
            console.log(`[ALERTA ${tipo.toUpperCase()}]: ${mensaje.replace(/\*\*|/g, '')}`);
            // Fallback simple si no existe una librería de alertas
            // alert(`[${tipo.toUpperCase()}] ${mensaje.replace(/\*\*|/g, '')}`);
        };
    }

    // --- LÓGICA PRINCIPAL DE CARGA Y RENDERIZADO ---

    async function cargarClubes() {
        if (!container) return; // Salir si el contenedor no existe

        try {
            // Obtener el token para enviarlo en la petición
            const token = localStorage.getItem("token") || sessionStorage.getItem("token");
            const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

            container.innerHTML = `<div class="col-12 mt-5 text-center text-secondary">Cargando clubes...</div>`;

            // Petición a la API, asumiendo que solo trae los clubes activos
            const res = await fetch("/api/clubs?estado=activo", { headers });

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
            container.innerHTML = `<div class="col-12 mt-5"><p class="text-danger fw-bold">Error de conexión con el servidor.</p></div>`;
        }
    }

    function renderClubes(clubes) {
        container.innerHTML = "";

        // La fuente de verdad siempre es el token persistente
        const authStatus = getAuthStatus();
        const isUserLoggedIn = authStatus.id !== null;
        const userClubId = authStatus.club_id;
        const isPresidente = authStatus.role === 'presidente';

        if (!Array.isArray(clubes) || clubes.length === 0) {
            container.innerHTML = `<div class="col-12 mt-5"><p class="text-secondary fw-bold text-center">Aún no hay clubes activos registrados.</p></div>`;
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

            // ⭐ CORRECCIÓN CLAVE: Usar 'nombre_club' en lugar de 'nombre_evento'
            const clubName = club.nombre_club || 'Club sin nombre';
            const clubDescription = club.descripcion || 'Sin descripción';
            // Usamos 'imagen_club' si viene de la API, si no usamos 'imagen_url' como fallback
            const clubImageSource = getImageUrl(club.imagen_club || club.imagen_url);

            let buttonHtml = '';

            if (isUserLoggedIn) {
                if (isMemberOfThisClub) {
                    // 🟢 Miembro del club actual (solo estado, no acción de salir)
                    buttonHtml = `
                        <button class="btn btn-success w-100" disabled
                                title="Para gestionar o salir de tu club, usa la sección de perfil/gestión.">
                                ${isPresidente ? 'Presidente (Gestionar fuera de aquí)' : 'Miembro Activo'}
                        </button>`;
                } else {
                    // 🔴 Botón UNIRME AL CLUB 
                    buttonHtml = `
                        <button class="btn btn-netflix w-100 join-btn" 
                                data-id="${club.id}"
                                ${isMemberOfAnyClub ? 'disabled title="Ya eres miembro de otro club. Debes abandonarlo primero."' : ''}>
                                ${isMemberOfAnyClub ? 'Ya eres miembro de otro club' : 'Unirme al club'}
                        </button>`;
                }
            } else {
                // 🟡 MOSTRAR INICIAR SESIÓN (si no hay token)
                buttonHtml = `<a href="/pages/auth/login.html" class="btn btn-netflix w-100">Inicia sesión para unirte</a>`;
            }

            // El borde de la tarjeta cambia si eres miembro
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
                        <small class="text-secondary">${escapeHtml(club.ciudad || 'Ciudad no especificada')}</small>
                        <div class="badge bg-dark">${escapeHtml(club.enfoque || 'General')}</div>
                    </div>
                    
                    <div class="mt-auto pt-2">
                        ${buttonHtml}
                    </div>
                </div>
            `;

            row.appendChild(col);
        });

        container.appendChild(row);

        // Agregamos listeners solo a los botones de UNIRSE habilitados
        document.querySelectorAll(".join-btn:not([disabled])").forEach(btn => btn.addEventListener("click", joinClub));

        // El listener de salir del club no se adjunta aquí (coherente con el requisito)
    }

    // --- MANEJADOR DE JOIN CLUB ---
    async function joinClub(e) {
        const club_id = e.currentTarget.dataset.id;
        const authStatus = getAuthStatus();

        if (!authStatus.id) {
            mostrarAlerta("Debes iniciar sesión para unirte a un club", "error");
            return;
        }

        e.currentTarget.disabled = true; // Deshabilitar el botón temporalmente
        e.currentTarget.textContent = 'Uniéndote...';

        const bodyToSend = { club_id: Number(club_id) };

        try {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            // Usamos un query param 'action=join' para diferenciar en el backend
            const res = await fetch("/api/clubs?action=join", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify(bodyToSend)
            });
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || `Error HTTP ${res.status}`);
            }

            // ⭐ CLAVE: Guardar el nuevo token que contiene el club_id actualizado
            if (data.token) {
                sessionStorage.setItem("token", data.token);
                localStorage.setItem("token", data.token);
            }

            mostrarAlerta("Te has unido al club", "exito");
            cargarClubes(); // Recargar la lista para reflejar el cambio de botones y bordes
        } catch (err) {
            console.error("Error joinClub:", err);
            mostrarAlerta(`Error al unirse al club: ${err.message}`, "error");
            e.currentTarget.disabled = false;
            e.currentTarget.textContent = 'Unirme al club';
        }
    }

    // --- LÓGICA DE MODAL Y LEAVE CLUB (MANTENIDA PERO SIN ENLACE EN ESTA PÁGINA) ---

    // La lógica de setupLeaveModal y leaveClubAction se mantiene en el script
    // pero no se usa en 'renderClubes' según la solicitud de no mostrar el botón de salir
    // en la lista principal, sino que se gestiona desde el perfil del usuario.

    // (*** Funciones setupLeaveModal y leaveClubAction originales OMITIDAS para un código más limpio, 
    // ya que no se usan en esta página. Si se usan en otra, se deben mantener. ***)

    cargarClubes();
});