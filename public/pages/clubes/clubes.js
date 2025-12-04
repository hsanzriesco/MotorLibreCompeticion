document.addEventListener("DOMContentLoaded", () => {

    const container = document.getElementById("clubes-container");

    const usuario = JSON.parse(
        sessionStorage.getItem("usuario") || localStorage.getItem("usuario")
    );

    // -----------------------------------------------------------------------------------
    // CARGAR CLUBES DESDE LA BASE DE DATOS
    // -----------------------------------------------------------------------------------
    async function cargarClubes() {
        try {
            const res = await fetch("/api/clubs");
            const clubes = await res.json();

            if (!Array.isArray(clubes)) {
                mostrarAlerta("Error al cargar los clubes", "error");
                return;
            }

            renderClubes(clubes);

        } catch (err) {
            console.error("Error cargando clubes:", err);
            mostrarAlerta("No se pudo conectar con el servidor", "error");
        }
    }

    // -----------------------------------------------------------------------------------
    // RENDERIZAR CLUBES
    // -----------------------------------------------------------------------------------
    function renderClubes(clubes) {
        container.innerHTML = "";

        if (clubes.length === 0) {
            container.innerHTML = `
                <h4 class="text-danger mt-4">Aún no hay clubes creados.</h4>
            `;
            return;
        }

        clubes.forEach(club => {
            const card = document.createElement("div");
            card.className = "col-md-4";

            card.innerHTML = `
                <div class="club-card h-100">
                    <h3 class="text-danger">${club.nombre}</h3>
                    <p>${club.descripcion}</p>

                    <button class="btn btn-netflix w-100 mt-3 join-btn" data-id="${club.id}">
                        Unirme al club
                    </button>
                </div>
            `;

            container.appendChild(card);
        });

        // Cuando los clubs están cargados, asignamos los listeners
        document.querySelectorAll(".join-btn").forEach(btn => {
            btn.addEventListener("click", unirseClub);
        });
    }

    // -----------------------------------------------------------------------------------
    // UNIRSE A UN CLUB (POST a /api/clubs/join)
    // -----------------------------------------------------------------------------------
    async function unirseClub(e) {
        const club_id = e.target.dataset.id;

        if (!usuario) {
            mostrarAlerta("Debes iniciar sesión para unirte a un club", "error");
            return;
        }

        try {
            const res = await fetch("/api/clubs/join", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    club_id,
                    user_id: usuario.id
                })
            });

            if (!res.ok) {
                const msg = await res.text();
                mostrarAlerta(msg, "error");
                return;
            }

            mostrarAlerta("Te has unido correctamente al club", "exito");

        } catch (err) {
            console.error("Error uniendo al club:", err);
            mostrarAlerta("Error al unirse al club", "error");
        }
    }

    cargarClubes();
});
