document.addEventListener("DOMContentLoaded", () => {

    const container = document.getElementById("clubes-container");

    // Ejemplo de clubes (puedes reemplazar por API o DB)
    const clubes = [
        { id: 1, nombre: "Street Racers", descripcion: "Club de conducción urbana y tandas nocturnas." },
        { id: 2, nombre: "Track Masters", descripcion: "Expertos en circuito: tandas, técnica y telemetría." },
        { id: 3, nombre: "Drift Nation", descripcion: "Club dedicado al drift: entrenamiento, eventos y shows." }
    ];

    // Recuperar clubes donde el usuario ya está
    const misClubes = JSON.parse(localStorage.getItem("misClubes")) || [];

    function renderClubes() {
        container.innerHTML = "";

        clubes.forEach(club => {
            const unido = misClubes.includes(club.id);

            const card = document.createElement("div");
            card.className = "col-md-4";

            card.innerHTML = `
                <div class="club-card h-100">
                    <h3 class="text-danger">${club.nombre}</h3>
                    <p>${club.descripcion}</p>
                    <button class="btn btn-netflix w-100 mt-3 join-btn" data-id="${club.id}">
                        ${unido ? "Ya eres miembro" : "Unirme"}
                    </button>
                </div>
            `;

            container.appendChild(card);
        });

        // Listeners para botones
        document.querySelectorAll(".join-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const id = parseInt(e.target.dataset.id);

                if (misClubes.includes(id)) {
                    mostrarAlerta("Ya eres miembro de este club", "error");
                    return;
                }

                misClubes.push(id);
                localStorage.setItem("misClubes", JSON.stringify(misClubes));

                mostrarAlerta("Te has unido al club correctamente", "exito");
                renderClubes();
            });
        });
    }

    renderClubes();

});
