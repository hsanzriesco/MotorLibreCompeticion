// public/js/clubes.js
document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("clubes-container");
    // 🛑 CAMBIO CLAVE 1: Solo lee de sessionStorage
    const storedUser = sessionStorage.getItem("usuario");
    const usuario = storedUser ? JSON.parse(storedUser) : null;

    function escapeHtml(s = "") {
        return String(s)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;");
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
            renderClubes(data.data);
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

            col.innerHTML = `
        <div class="club-card h-100 p-3" style="background:#141414;border:1px solid rgba(229,9,20,0.2);border-radius:8px">
          ${club.imagen_club ? `<img src="${escapeHtml(club.imagen_club)}" alt="${escapeHtml(club.nombre_evento)}" class="img-fluid rounded mb-2" style="max-height:160px;object-fit:cover;width:100%;">` : `<img src="/img/placeholder.jpg" class="img-fluid rounded mb-2" style="max-height:160px;object-fit:cover;width:100%;">`}
          <h4 class="text-danger">${escapeHtml(club.nombre_evento)}</h4>
          <p>${escapeHtml(club.descripcion || "")}</p>
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
            const res = await fetch("/api/clubs?action=join", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_id: usuario.id, club_id: Number(club_id) })
            });
            const data = await res.json();
            if (!res.ok) {
                mostrarAlerta(data.message || "Error al unirse", "error");
                return;
            }

            usuario.club_id = Number(club_id);
            // 🛑 CAMBIO CLAVE 2: Solo actualiza sessionStorage
            sessionStorage.setItem("usuario", JSON.stringify(usuario));

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

        // Limpia eventos previos
        confirmarBtn.onclick = async () => {
            modal.hide();

            try {
                const res = await fetch("/api/clubs?action=leave", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ user_id: usuario.id })
                });
                const data = await res.json();
                if (!res.ok) {
                    mostrarAlerta(data.message || "Error al salir del club", "error");
                    return;
                }

                usuario.club_id = null;
                // 🛑 CAMBIO CLAVE 3: Solo actualiza sessionStorage
                sessionStorage.setItem("usuario", JSON.stringify(usuario));

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