document.addEventListener("DOMContentLoaded", () => {

    // Obtener usuario logeado desde el almacenamiento (asumo que 'usuario' se guarda en JSON)
    const storedUser = sessionStorage.getItem("usuario") || localStorage.getItem("usuario");
    const usuario = storedUser ? JSON.parse(storedUser) : null;
    // Obtener el ID del usuario para verificar si es presidente
    const userId = usuario ? usuario.id : null;

    const clubesContainer = document.getElementById('clubes-container');
    const modalSalirClubEl = document.getElementById('modalSalirClub');
    const confirmarSalirClubBtn = document.getElementById('confirmarSalirClub');

    // ----------------------------------------------------
    // UTIL: LLAMADA A LA API O DATOS SIMULADOS
    // ----------------------------------------------------
    async function fetchClubesActivos() {
        try {
            // ⭐ REEMPLAZA ESTA URL CON TU ENDPOINT REAL PARA OBTENER CLUBES ACTIVOS ⭐
            const res = await fetch("/api/clubs?estado=activo");
            const data = await res.json();

            if (!data.success) {
                mostrarAlerta("Error al cargar la lista de clubes.", "error");
                return [];
            }

            // Suponemos que la API devuelve ya el campo 'esMiembro' si el usuario está logeado,
            // o que la lógica para saber si 'esMiembro' se hace en otro endpoint.
            // Para la simulación, lo calcularemos en el renderizado si la API no lo hace.
            return data.data;

        } catch (error) {
            console.error("Error fetching clubes:", error);
            mostrarAlerta("Error de conexión con el servidor.", "error");
            return [];
        }
    }


    // ----------------------------------------------------
    // RENDERIZADO DE CLUBES CON LÓGICA DE ROLES
    // ----------------------------------------------------

    async function renderClubes() {
        if (!clubesContainer) return;

        // Cargar los clubes activos (solo los aprobados)
        const clubesActivos = await fetchClubesActivos();

        clubesContainer.innerHTML = '';

        if (clubesActivos.length === 0) {
            clubesContainer.innerHTML = '<p class="text-warning mt-5">No hay clubes activos en este momento.</p>';
            return;
        }

        clubesActivos.forEach(club => {
            // ⭐ Lógica de Rol: ¿El usuario logeado es el presidente de este club? ⭐
            // Asegúrate de que club.id_presidente y userId son del mismo tipo (ej: ambos Strings o ambos Numbers)
            const esPresidente = userId && club.id_presidente === userId;

            // ⭐ Lógica de Membresía: ¿El usuario es socio? (Ajusta esto a tu estructura de datos) ⭐
            // Suponemos que club.esMiembro viene de la API o se calcula en el cliente. 
            // Si tu API no devuelve 'esMiembro', tendrías que hacer una llamada adicional aquí.
            const esMiembro = club.esMiembro || false;

            const clubCol = document.createElement('div');
            clubCol.className = 'col-lg-4 col-md-6';

            let botonesHTML = '';

            if (esPresidente) {
                // ⭐ BOTONES PARA EL PRESIDENTE DEL CLUB ⭐
                botonesHTML = `
                    <p class="text-danger fw-bold mt-2 mb-2"><i class="bi bi-crown"></i> ERES PRESIDENTE</p>
                    <a href="./panelPresidente.html?clubId=${club.id}" class="btn btn-sm btn-danger mb-2 w-100">
                        <i class="bi bi-gear-fill me-1"></i> Panel de Gestión
                    </a>
                `;
            } else if (esMiembro) {
                // BOTÓN PARA UN SOCIO NORMAL
                botonesHTML = `
                    <p class="text-success fw-bold mt-2 mb-2"><i class="bi bi-check-circle-fill"></i> Eres Miembro</p>
                    <button class="btn btn-sm btn-secondary w-100 salir-club-btn" data-club-id="${club.id}" data-bs-toggle="modal" data-bs-target="#modalSalirClub">
                        Salir del Club
                    </button>
                `;
            } else if (usuario) {
                // USUARIO LOGEADO PERO NO MIEMBRO NI PRESIDENTE: puede unirse
                botonesHTML = `
                    <button class="btn btn-sm btn-netflix w-100 unirse-club-btn" data-club-id="${club.id}">
                        Unirse al Club
                    </button>
                `;
            } else {
                // USUARIO NO LOGEADO: debe iniciar sesión
                botonesHTML = `
                    <a href="../auth/login/login.html" class="btn btn-sm btn-outline-danger w-100">
                        Inicia sesión para unirte
                    </a>
                `;
            }

            clubCol.innerHTML = `
                <div class="club-card">
                    <h5 class="text-danger fw-bold">${club.nombre_evento || 'Club sin nombre'}</h5>
                    <p class="small text-secondary mb-1">Miembros: ${club.miembros || 'N/A'}</p>
                    <p class="small text-light">${club.descripcion || 'Sin descripción.'}</p>
                    <hr class="border-secondary">
                    ${botonesHTML}
                </div>
            `;
            clubesContainer.appendChild(clubCol);
        });

        // Asignar listeners después de renderizar
        document.querySelectorAll(".unirse-club-btn").forEach(btn =>
            btn.addEventListener("click", manejarUnirseClub)
        );
    }

    // ----------------------------------------------------
    // FUNCIÓN DE UNIRSE AL CLUB
    // ----------------------------------------------------
    async function manejarUnirseClub(e) {
        const clubId = e.currentTarget.dataset.clubId;
        if (!userId) {
            mostrarAlerta("Debes iniciar sesión para unirte a un club.", 'error');
            return;
        }

        try {
            // ⭐ Reemplaza esta URL con tu endpoint para unirse al club (POST/PUT a membresía) ⭐
            const res = await fetch(`/api/clubs/${clubId}/join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: userId })
            });

            const r = await res.json();

            if (!r.success) {
                mostrarAlerta(r.message || "Error al unirse al club.", "error");
                return;
            }

            mostrarAlerta("Te has unido al club correctamente.", "exito");
            renderClubes(); // Recargar la lista

        } catch (error) {
            console.error("Error al unirse:", error);
            mostrarAlerta("Error de conexión al unirse al club.", "error");
        }
    }


    // ----------------------------------------------------
    // LÓGICA DE SALIR DEL CLUB
    // ----------------------------------------------------
    if (modalSalirClubEl && confirmarSalirClubBtn) {
        modalSalirClubEl.addEventListener('show.bs.modal', function (event) {
            const button = event.relatedTarget;
            const clubId = button.getAttribute('data-club-id');
            confirmarSalirClubBtn.setAttribute('data-target-club-id', clubId);
        });

        confirmarSalirClubBtn.onclick = async () => {
            const clubId = confirmarSalirClubBtn.getAttribute('data-target-club-id');
            const modalInstance = bootstrap.Modal.getInstance(modalSalirClubEl);

            try {
                // ⭐ Reemplaza esta URL con tu endpoint para salir del club (DELETE/PUT a membresía) ⭐
                const res = await fetch(`/api/clubs/${clubId}/leave`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: userId })
                });

                const r = await res.json();

                if (!r.success) {
                    mostrarAlerta(r.message || "Error al salir del club.", "error");
                    if (modalInstance) modalInstance.hide();
                    return;
                }

                mostrarAlerta("Has salido del club correctamente.", 'exito');
                if (modalInstance) modalInstance.hide();
                renderClubes();

            } catch (error) {
                console.error("Error al salir del club:", error);
                mostrarAlerta("Error de conexión al salir del club.", "error");
                if (modalInstance) modalInstance.hide();
            }
        };
    }

    // ----------------------------------------------------
    // Inicializar
    // ----------------------------------------------------
    renderClubes();
});