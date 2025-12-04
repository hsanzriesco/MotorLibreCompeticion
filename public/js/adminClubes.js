document.addEventListener("DOMContentLoaded", () => {

    const listaClubes = document.getElementById("lista-clubes");
    const formClub = document.getElementById("form-club");

    const inputNombre = document.getElementById("nombre_evento");
    const inputDescripcion = document.getElementById("descripcion");
    const inputImagen = document.getElementById("imagen_club");

    // =====================================================================================
    // CARGAR CLUBES EXISTENTES
    // =====================================================================================
    async function cargarClubes() {
        try {
            const res = await fetch("/api/clubs");

            if (!res.ok) {
                mostrarAlerta("Error al cargar los clubes", "error");
                return;
            }

            const data = await res.json();

            if (!Array.isArray(data.data)) {
                console.error("Respuesta no válida:", data);
                mostrarAlerta("Error en la respuesta del servidor", "error");
                return;
            }

            renderClubes(data.data);

        } catch (err) {
            console.error("Error cargando clubes:", err);
            mostrarAlerta("Error al cargar los clubes", "error");
        }
    }

    // =====================================================================================
    // RENDERIZAR CLUBES EN TABLA
    // =====================================================================================
    function renderClubes(clubes) {
        listaClubes.innerHTML = "";

        if (clubes.length === 0) {
            listaClubes.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center text-danger">
                        No hay clubes registrados.
                    </td>
                </tr>
            `;
            return;
        }

        clubes.forEach(club => {
            const tr = document.createElement("tr");

            tr.innerHTML = `
                <td>${club.id}</td>
                <td>${club.nombre_evento}</td>
                <td>${club.descripcion || "Sin descripción"}</td>
                <td>
                    <img src="${club.imagen_club || "/img/placeholder.jpg"}"
                         style="width: 70px; height: 70px; object-fit: cover; border-radius: 8px;">
                </td>
                <td>
                    <button class="btn btn-warning btn-sm me-2 editar-btn" data-id="${club.id}">
                        Editar
                    </button>
                    <button class="btn btn-danger btn-sm eliminar-btn" data-id="${club.id}">
                        Eliminar
                    </button>
                </td>
            `;

            listaClubes.appendChild(tr);
        });

        document.querySelectorAll(".eliminar-btn").forEach(btn =>
            btn.addEventListener("click", eliminarClub)
        );

        document.querySelectorAll(".editar-btn").forEach(btn =>
            btn.addEventListener("click", cargarDatosEditar)
        );
    }

    // =====================================================================================
    // CREAR / EDITAR CLUB
    // =====================================================================================
    formClub.addEventListener("submit", async (e) => {
        e.preventDefault();

        const id = formClub.dataset.editingId;

        const payload = {
            nombre_evento: inputNombre.value.trim(),
            descripcion: inputDescripcion.value.trim(),
            imagen_club: inputImagen.value.trim()
        };

        if (!payload.nombre_evento) {
            mostrarAlerta("El nombre es obligatorio", "error");
            return;
        }

        try {
            const res = await fetch(`/api/clubs${id ? `?id=${id}` : ""}`, {
                method: id ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (!res.ok) {
                mostrarAlerta(data.message || "Error al guardar el club", "error");
                return;
            }

            mostrarAlerta(
                id ? "Club actualizado correctamente" : "Club creado exitosamente",
                "exito"
            );

            formClub.reset();
            delete formClub.dataset.editingId;

            cargarClubes();

        } catch (err) {
            console.error("Error guardando club:", err);
            mostrarAlerta("Error del servidor", "error");
        }
    });

    // =====================================================================================
    // CARGAR INFO AL FORMULARIO PARA EDITAR
    // =====================================================================================
    function cargarDatosEditar(e) {
        const id = e.target.dataset.id;

        fetch(`/api/clubs?id=${id}`)
            .then(res => res.json())
            .then(data => {

                const club = data.data[0];
                if (!club) return;

                inputNombre.value = club.nombre_evento;
                inputDescripcion.value = club.descripcion || "";
                inputImagen.value = club.imagen_club || "";

                formClub.dataset.editingId = id;

                mostrarAlerta("Editando club...", "info");
            });
    }

    // =====================================================================================
    // ELIMINAR CLUB
    // =====================================================================================
    async function eliminarClub(e) {
        const id = e.target.dataset.id;

        if (!confirm("¿Seguro que deseas eliminar este club?")) return;

        try {
            const res = await fetch(`/api/clubs?id=${id}`, { method: "DELETE" });

            const data = await res.json();

            if (!res.ok) {
                mostrarAlerta(data.message || "Error al eliminar", "error");
                return;
            }

            mostrarAlerta("Club eliminado", "exito");
            cargarClubes();

        } catch (err) {
            console.error("Error eliminando club:", err);
            mostrarAlerta("Error al eliminar club", "error");
        }
    }

    cargarClubes();
});
