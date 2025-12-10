// public/js/clubes.js - VERSIÓN CORREGIDA PARA NOMBRES Y ESTILO ORIGINAL
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

        // Asumimos un tipo común si es Base64 sin prefijo
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
            container.innerHTML = `<div class="col-12 mt-5"><p class="text-danger fw-bold">Aún no hay clubes creados.</p></div>`;
            return;
        }

        const userClubId = usuario?.club_id ? Number(usuario.club_id) : null;

        const row = document.createElement("div");
        row.className = "row gy-3";

        clubes.forEach(club => {
            const col = document.createElement("div");
            // Mantener el tamaño de la columna para tres por fila (col-md-4)
            col.className = "col-md-4";

            const isMember = userClubId && Number(club.id) === userClubId;

            // ⭐ CORRECCIÓN CLAVE: Usamos 'nombre_evento' para el nombre y 'descripcion' para la descripción.
            const clubName = club.nombre_evento || club.nombre || club.name || 'Club sin nombre (ERROR API)';
            // Si el texto de 'fsofsofsdf' está en descripcion, se mostrará. Si está en enfoque, cámbialo a club.enfoque.
            const clubDescription = club.descripcion || club.description || 'Sin descripción';
            const clubImageSource = getImageUrl(club.imagen_url);

            // Determinamos el contenido del botón
            const buttonHtml = usuario ? (isMember
                ? `<button class="btn btn-outline-light w-100 leave-btn" 
                           data-id="${club.id}" 
                           data-bs-toggle="modal" 
                           data-bs-target="#modalSalirClub">
                           Salir del club
                   </button>`
                : `<button class="btn btn-netflix w-100 join-btn" data-id="${club.id}">Unirme al club</button>`
            ) : `<a href="/pages/auth/login/login.html" class="btn btn-netflix w-100">Inicia sesión para unirte</a>`;


            // --- RESTAURACIÓN DEL HTML ORIGINAL ---
            col.innerHTML = `
                <div class="club-card h-100 p-3 d-flex flex-column" data-club-id="${club.id}"
                    style="background:#141414;border:1px solid rgba(229,9,20,0.2);border-radius:8px">

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
        document.querySelectorAll(".join-btn").forEach(btn => btn.addEventListener("click", joinClub));
        document.querySelectorAll(".leave-btn").forEach(btn => btn.addEventListener("click", setupLeaveModal));
    }

    // --- LÓGICA DE JOIN CLUB (Sin Cambios) ---
    async function joinClub(e) {
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

    // --- LÓGICA DE MODAL Y LEAVE CLUB (Para confirmar salida) ---

    function setupLeaveModal(e) {
        const club_id = e.currentTarget.dataset.id;

        if (!usuario) {
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
    }

    async function leaveClubAction(club_id) {
        const modalElement = document.getElementById("modalSalirClub");
        const modal = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
        modal.hide();

        try {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            const res = await fetch("/api/clubs?action=leave", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ user_id: usuario.id })
            });
            const data = await res.json();
            if (!res.ok) {
                mostrarAlerta(data.message || "Error al salir del club", "error");
                return;
            }

            usuario = { ...usuario, club_id: null };
            sessionStorage.setItem("usuario", JSON.stringify(usuario));
            localStorage.setItem("usuario", JSON.stringify(usuario));

            mostrarAlerta("Te has salido del club", "exito");
            cargarClubes();
        } catch (err) {
            console.error("Error leaveClub:", err);
            mostrarAlerta("Error en el servidor", "error");
        }
    }


    cargarClubes();
});