// public/js/clubes.js - VERSIÓN CORREGIDA PARA IMÁGENES
document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("clubes-container");
    // Se usa 'let' para poder actualizar 'usuario' si es necesario
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

        // Si ya parece una URL o Base64 completo (con el prefijo), lo devuelve tal cual
        if (imageData.startsWith('http') || imageData.startsWith('data:image/')) {
            return imageData;
        }

        // Si es una cadena Base64 sin el prefijo (caso común si la subida es directa desde la DB)
        // Asumimos un tipo común. Si tu backend sabe el tipo, es mejor usarlo.
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
            container.innerHTML = `<h4 class="text-danger mt-4">Aún no hay clubes creados.</h4>`;
            return;
        }

        const userClubId = usuario?.club_id ? Number(usuario.club_id) : null;

        const row = document.createElement("div");
        row.className = "row gy-3";
        clubes.forEach(club => {
            const col = document.createElement("div");
            col.className = "col-md-4";

            const isMember = userClubId && Number(club.id) === userClubId;

            // ⭐ USAMOS LAS PROPIEDADES CORRECTAS Y LA FUNCIÓN HELPER
            const clubName = club.nombre || club.name || 'Club sin nombre';
            const clubDescription = club.descripcion || club.description || 'Sin descripción';
            // Usamos club.imagen_url, que es el alias que tu backend devuelve
            const clubImageSource = getImageUrl(club.imagen_url);

            col.innerHTML = `
                <div class="club-card h-100 p-3" style="background:#141414;border:1px solid rgba(229,9,20,0.2);border-radius:8px">
                    <img src="${escapeHtml(clubImageSource)}" 
                         alt="${escapeHtml(clubName)} Logo" 
                         class="img-fluid rounded mb-2" 
                         style="max-height:160px;object-fit:cover;width:100%;">
                    <h4 class="text-danger">${escapeHtml(clubName)}</h4>
                    <p>${escapeHtml(clubDescription)}</p>
                    <div>
                        ${usuario ? (isMember
                    ? `<button class="btn btn-outline-light w-100 leave-btn" data-id="${club.id}">Salir del club</button>`
                    : `<button class="btn btn-netflix w-100 join-btn" data-id="${club.id}">Unirme al club</button>`
                ) : `<a href="/pages/auth/login/login.html" class="btn btn-netflix w-100">Inicia sesión para unirte</a>`
                }
                    </div>
                </div>
            `;
            row.appendChild(col);
        });

        container.appendChild(row);

        document.querySelectorAll(".join-btn").forEach(btn => btn.addEventListener("click", joinClub));
        document.querySelectorAll(".leave-btn").forEach(btn => btn.addEventListener("click", leaveClub));
    }

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
        const club_id = e.currentTarget.dataset.id;
        if (!usuario) {
            mostrarAlerta("Debes iniciar sesión", "error");
            return;
        }

        // ABRIR MODAL
        const modal = new bootstrap.Modal(document.getElementById("modalSalirClub"));
        modal.show();

        const confirmarBtn = document.getElementById("confirmarSalirClub");

        confirmarBtn.onclick = async () => {
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