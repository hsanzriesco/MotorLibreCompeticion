document.addEventListener("DOMContentLoaded", () => {

    const tabla = document.getElementById("tabla-clubes");
    const form = document.getElementById("club-form");

    const inputId = document.getElementById("club-id");
    const inputNombre = document.getElementById("nombre_evento");
    const inputDescripcion = document.getElementById("descripcion");
    const inputImagen = document.getElementById("imagen_club");
    const inputFecha = document.getElementById("fecha_creacion");

    // ========================================================
    //               CARGAR LISTA DE CLUBES
    // ========================================================
    async function cargarClubes() {
        try {
            const res = await fetch("/api/clubs");

            if (!res.ok) {
                mostrarAlerta("Error al cargar los clubes", "error");
                return;
            }

            const respuesta = await res.json();

            // Esperamos { success: true, data: [...] }
            const clubes = respuesta.data;

            if (!Array.isArray(clubes)) {
                console.error("Respuesta inesperada:", respuesta);
                mostrarAlerta("Error al interpretar los clubes", "error");
                return;
            }

            renderTabla(clubes);

        } catch (error) {
            console.error("Error cargando clubes:", error);
            mostrarAlerta("Error al conectar con el servidor", "error");
        }
    }

    // ========================================================
    //                   RENDERIZAR TABLA
    // ========================================================
    function renderTabla(clubes) {
        tabla.innerHTML = "";

        if (clubes.length === 0) {
            tabla.innerHTML = `
                <tr>
                    <td colspan="6" class="text-danger">No hay clubes registrados</td>
                </tr>
            `;
            return;
        }

        clubes.forEach(club => {
            const fila = document.createElement("tr");

            fila.innerHTML = `
                <td>${club.id}</td>
                <td>${club.nombre_evento}</td>
                <td>${club.descripcion || "Sin descripción"}</td>
                <td>${club.fecha_creacion}</td>
                <td><img src="${club.imagen_club || ""}" width="60" class="rounded"></td>
                <td>
                    <button class="btn btn-warning btn-sm me-2 editar-btn" data-id="${club.id}">Editar</button>
                    <button class="btn btn-danger btn-sm eliminar-btn" data-id="${club.id}">Eliminar</button>
                </td>
            `;

            tabla.appendChild(fila);
        });

        // Eventos dinámicos
        document.querySelectorAll(".editar-btn").forEach(btn => {
            btn.addEventListener("click", cargarClubEnFormulario);
        });

        document.querySelectorAll(".eliminar-btn").forEach(btn => {
            btn.addEventListener("click", eliminarClub);
        });
    }

    // ========================================================
    //       CARGAR UN CLUB EN EL FORMULARIO PARA EDITAR
    // ========================================================
    async function cargarClubEnFormulario(e) {
        const id = e.target.dataset.id;

        try {
            const res = await fetch(`/api/clubs?id=${id}`);
            const respuesta = await res.json();

            if (!respuesta.success) {
                mostrarAlerta("Error al obtener datos del club", "error");
                return;
            }

            const club = respuesta.data;

            inputId.value = club.id;
            inputNombre.value = club.nombre_evento;
            inputDescripcion.value = club.descripcion;
            inputImagen.value = club.imagen_club;
            inputFecha.value = club.fecha_creacion;

            mostrarAlerta("Club cargado para edición", "info");

        } catch (error) {
            console.error(error);
            mostrarAlerta("Error cargando club", "error");
        }
    }

    // ========================================================
    //                 GUARDAR (CREAR / EDITAR)
    // ========================================================
    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const datosClub = {
            nombre_evento: inputNombre.value,
            descripcion: inputDescripcion.value,
            imagen_club: inputImagen.value,
            fecha_creacion: inputFecha.value
        };

        const id = inputId.value;
        const metodo = id ? "PUT" : "POST";

        try {
            const res = await fetch("/api/clubs" + (id ? `?id=${id}` : ""), {
                method: metodo,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(datosClub)
            });

            const respuesta = await res.json();

            if (!respuesta.success) {
                mostrarAlerta("Error guardando club", "error");
                return;
            }

            mostrarAlerta(id ? "Club actualizado" : "Club creado", "exito");

            form.reset();
            inputId.value = "";

            cargarClubes();

        } catch (error) {
            console.error(error);
            mostrarAlerta("Error en el servidor", "error");
        }
    });

    // ========================================================
    //                    ELIMINAR CLUB
    // ========================================================
    async function eliminarClub(e) {
        const id = e.target.dataset.id;

        if (!confirm("¿Seguro que deseas eliminar este club?")) return;

        try {
            const res = await fetch(`/api/clubs?id=${id}`, {
                method: "DELETE"
            });

            const respuesta = await res.json();

            if (!respuesta.success) {
                mostrarAlerta("Error eliminando club", "error");
                return;
            }

            mostrarAlerta("Club eliminado", "exito");

            cargarClubes();

        } catch (error) {
            console.error(error);
            mostrarAlerta("Error eliminando club", "error");
        }
    }

    // ========================================================
    //               CARGAR INICIAL
    // ========================================================
    cargarClubes();
});
