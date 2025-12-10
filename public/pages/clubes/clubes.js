// public/js/clubes.js - VERSIÓN CORREGIDA Y ROBUSTA
document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("clubes-container");
    let storedUser = sessionStorage.getItem("usuario") || localStorage.getItem("usuario");
    let usuario = storedUser ? JSON.parse(storedUser) : null;

    function escapeHtml(s = "") {
        return String(s)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;");
    }

    // 🛠️ FUNCIÓN HELPER: Asegura que la imagen tenga el formato correcto (Base64 o URL)
    function getImageUrl(imageData) {
        // Fallback a una imagen por defecto
        if (!imageData) return '../../img/placeholder.jpg';

        if (imageData.startsWith('http') || imageData.startsWith('data:image/')) {
            return imageData;
        }

        return `data:image/jpeg;base64,${imageData}`;
    }

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
            // El contenedor padre está en clubes.html, no lo borramos
            // Solo actualizamos el contenido dentro del contenedor principal
            container.innerHTML = `<div class="col-12 mt-5"><p class="text-danger fw-bold">Aún no hay clubes creados.</p></div>`;
            return;
        }

        const userClubId = usuario?.club_id ? Number(usuario.club_id) : null;

        clubes.forEach(club => {
            const col = document.createElement("div");
            // Usamos col-lg-4 para 3 columnas en escritorio y col-sm-6 para 2 en tablet
            col.className = "col-12 col-sm-6 col-lg-4";

            const isMember = userClubId && Number(club.id) === userClubId;

            // 🚨 PUNTO CLAVE CORREGIDO: Usamos un fallback más robusto, incluyendo 'club_name'
            // Si el nombre no viene en 'nombre' ni 'name', asegúrate de que esté en este fallback.
            const clubName = club.nombre || club.name || club.club_name || 'Club sin nombre';

            const clubDescription = club.descripcion || club.description || 'Sin descripción';
            // Usamos club.imagen_url (o el campo que tenga el banner/imagen destacada)
            const clubImageSource = getImageUrl(club.imagen_url || club.banner_url || null);

            // Usamos club.logo_url para el icono pequeño. Si no tienes este campo, usa clubImageSource como fallback.
            const clubLogoSource = getImageUrl(club.logo_url || clubImageSource);

            // Determinar si mostrar el banner (club-card con imagen destacada) o solo el texto/logo
            // Esto replica la diferencia de estilo que se ve en tu captura de pantalla
            const hasBanner = clubImageSource !== '../../img/placeholder.jpg' && clubImageSource !== clubLogoSource;


            let cardContent = '';

            // --- Plantilla para Club con Banner o Imagen Destacada (como las dos primeras de tu captura) ---
            if (hasBanner) {
                cardContent = `
                    <div class="card-image-wrapper mb-3" style="height: 180px; overflow: hidden; border-radius: 8px;">
                        <img src="${escapeHtml(clubImageSource)}" 
                            alt="${escapeHtml(clubName)} Banner" 
                            class="card-img-top w-100 h-100" 
                            style="object-fit: cover;">
                    </div>
                    <div class="card-body-content text-start">
                        <h4 class="text-danger">${escapeHtml(clubName)}</h4>
                        <p style="min-height: 40px; font-size: 0.9rem;">¡Enfoque: ${escapeHtml(clubDescription)}</p>
                    </div>
                `;
            } else {
                // --- Plantilla para Club sin Banner (solo logo y texto) ---
                cardContent = `
                    <div class="d-flex align-items-center mb-3">
                        <img src="${escapeHtml(clubLogoSource)}" 
                            alt="${escapeHtml(clubName)} Logo" 
                            class="me-3" 
                            style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 1px solid #e50914;">
                        <h4 class="text-danger m-0">${escapeHtml(clubName)}</h4>
                    </div>
                    <p class="text-start" style="min-height: 40px; font-size: 0.9rem;">${escapeHtml(clubDescription)}</p>
                `;
            }

            // Estructura Final de la Tarjeta
            col.innerHTML = `
                <div class="club-card h-100 p-3 d-flex flex-column" data-club-id="${club.id}" 
                    style="background:#1a1a1a; border:1px solid #e50914; border-radius:10px; text-align: center;">
                    
                    <div class="flex-grow-1">
                        ${cardContent}
                    </div>
                    
                    <div class="mt-auto pt-3">
                        ${usuario ? (isMember
                    ? `<button class="btn btn-outline-light w-100 leave-btn" data-id="${club.id}" data-bs-toggle="modal" data-bs-target="#modalSalirClub">Salir del club</button>`
                    : `<button class="btn btn-netflix w-100 join-btn" data-id="${club.id}">Unirme al club</button>`
                ) : `<a href="/pages/auth/login/login.html" class="btn btn-netflix w-100">Inicia sesión para unirte</a>`
                }
                    </div>
                </div>
            `;

            container.appendChild(col);
        });

        // Aseguramos que los event listeners se añadan después de que el HTML esté en el DOM
        document.querySelectorAll(".join-btn").forEach(btn => btn.addEventListener("click", joinClub));
        document.querySelectorAll(".leave-btn").forEach(btn => btn.addEventListener("click", leaveClub));
    }

    async function joinClub(e) {
        // Lógica de unirse al club (sin cambios)
        const club_id = e.currentTarget.dataset.id;
        if (!usuario) {
            mostrarAlerta("Debes iniciar sesión para unirte a un club", "error");
            return;
        }
        try {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            const res = await fetch("/api/clubs?action=join", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ user_id: usuario.id, club_id: Number(club_id) })
            });
            const data = await res.json();
            if (!res.ok) {
                mostrarAlerta(data.message || "Error al unirse", "error");
                return;
            }

            // Actualizar la variable 'usuario' y el almacenamiento
            usuario = { ...usuario, club_id: Number(club_id) };
            sessionStorage.setItem("usuario", JSON.stringify(usuario));
            localStorage.setItem("usuario", JSON.stringify(usuario));

            mostrarAlerta("Te has unido al club", "exito");
            cargarClubes();
        } catch (err) {
            console.error("Error joinClub:", err);
            mostrarAlerta("Error en el servidor", "error");
        }
    }

    async function leaveClub(e) {
        // Lógica de salir del club (sin cambios)
        const club_id = e.currentTarget.dataset.id;
        if (!usuario) {
            mostrarAlerta("Debes iniciar sesión", "error");
            return;
        }

        // El modal ya se abre con data-bs-target en el HTML, solo necesitamos configurar el botón de confirmación.
        const confirmarBtn = document.getElementById("confirmarSalirClub");
        // Quitamos cualquier listener anterior para evitar que se ejecute varias veces
        confirmarBtn.replaceWith(confirmarBtn.cloneNode(true));
        const newConfirmarBtn = document.getElementById("confirmarSalirClub");

        newConfirmarBtn.onclick = async () => {
            const modalElement = document.getElementById("modalSalirClub");
            const modal = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
            modal.hide();

            try {
                const token = localStorage.getItem('token') || sessionStorage.getItem('token');
                const res = await fetch("/api/clubs?action=leave", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                    body: JSON.stringify({ user_id: usuario.id }) // El club_id se infiere del user.club_id
                });
                const data = await res.json();
                if (!res.ok) {
                    mostrarAlerta(data.message || "Error al salir del club", "error");
                    return;
                }

                // Actualizar la variable 'usuario' y el almacenamiento
                usuario = { ...usuario, club_id: null };
                sessionStorage.setItem("usuario", JSON.stringify(usuario));
                localStorage.setItem("usuario", JSON.stringify(usuario));

                mostrarAlerta("Te has salido del club", "exito");
                cargarClubes();
            } catch (err) {
                console.error("Error leaveClub:", err);
                mostrarAlerta("Error en el servidor", "error");
            }
        };
    }

    cargarClubes();
});