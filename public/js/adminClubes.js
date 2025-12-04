// adminClubes.js

document.addEventListener("DOMContentLoaded", () => {

    const tabla = document.getElementById("tabla-clubes");
    const form = document.getElementById("club-form");

    const idInput = document.getElementById("club-id");
    const nombreInput = document.getElementById("nombre_evento");
    const descripcionInput = document.getElementById("descripcion");
    const imagenInput = document.getElementById("imagen_club");
    const fechaInput = document.getElementById("fecha_creacion");

    // ==========================================================
    // CARGAR CLUBES
    // ==========================================================
    async function cargarClubes() {
        try {
            const res = await fetch("/api/clubs");

            if (!res.ok) {
                mostrarAlerta("Error al cargar clubes", "error");
                return;
            }

            const clubes = await res.json();

            renderTabla(clubes);

        } catch (err) {
            console.error("Error:", err);
            mostrarAlerta("No se pudo conectar con el servidor", "error");
        }
    }

    // ==========================================================
    // RENDERIZAR TABLA
    // ==========================================================
    function renderTabla(clubes) {
        tabla.innerHTML = "";

        if (clubes.length === 0) {
            tabla.innerHTML = `
                <tr>
                    <td colspan="6" class="text-danger">No hay clubes registrados.</td>
                </tr>
            `;
            return;
        }

        clubes.forEach(club => {
            const tr = document.createElement("tr");

            tr.innerHTML = `
                <td>${club.id}</td>
                <td>${club.nombre_evento}</td>
                <td>${club.descripcion || "—"}</td>
                <td>${club.fecha_creacion}</td>
                <td>
                    <img src="${club.imagen_club || '../../../img/placeholder.jpg'}" 
                         alt="imagen" 
                         style="width:60px; height:60px; object-fit:cover; border-radius:5px;">
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

            tabla.appendChild(tr);
        });

        document.querySelectorAll(".editar-btn").forEach(btn =>
            btn.addEventListener("click", cargarDatosParaEditar)
        );

        document.querySelectorAll(".eliminar-btn").forEach(btn =>
            btn.addEventListener("click", eliminarClub)
        );
    }

    // ==========================================================
    // CARGAR DATOS EN EL FORMULARIO PARA EDITAR
    // ==========================================================
    function cargarDatosParaEditar(e) {
        const id = e.target.dataset.id;

        fetch(`/api/clubs?id=${id}`)
            .then(res => res.json())
            .then(club => {
                idInput.value = club.id;
                nombreInput.value = club.nombre_evento;
                descripcionInput.value = club.descripcion;
                imagenInput.value = club.imagen_club;

                // Asegurar formato fecha YYYY-MM-DD
                fechaInput.value = club.fecha_creacion.split("T")[0];

                mostrarAlerta("Editando club...", "info");
            })
            .catch(() => mostrarAlerta("Error al cargar datos", "error"));
    }

    // ==========================================================
    // GUARDAR CLUB (CREAR O EDITAR)
    // ==========================================================
    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const id = idInput.value;
        const data = {
            nombre_evento: nombreInput.value,
            descripcion: descripcionInput.value,
            imagen_club: imagenInput.value,
            fecha_creacion: fechaInput.value
        };

        try {
            let res;

            if (id) {
                // EDITAR
                res = await fetch(`/api/clubs?id=${id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data)
                });
            } else {
                // CREAR
                res = await fetch("/api/clubs", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data)
                });
            }

            if (!res.ok) {
                mostrarAlerta("Error al guardar", "error");
                return;
            }

            mostrarAlerta(id ? "Club actualizado" : "Club creado", "exito");

            form.reset();
            idInput.value = "";

            cargarClubes();

        } catch (err) {
            mostrarAlerta("Error del servidor", "error");
        }
    });

    // ==========================================================
    // ELIMINAR CLUB
    // ==========================================================
    async function eliminarClub(e) {
        const id = e.target.dataset.id;

        if (!confirm("¿Seguro que quieres eliminar este club?")) return;

        try {
            const res = await fetch(`/api/clubs?id=${id}`, {
                method: "DELETE"
            });

            if (!res.ok) {
                mostrarAlerta("Error al eliminar", "error");
                return;
            }

            mostrarAlerta("Club eliminado correctamente", "exito");

            cargarClubes();

        } catch (err) {
            mostrarAlerta("No se pudo eliminar", "error");
        }
    }

    // ==========================================================
    // CARGA INICIAL
    // ==========================================================
    cargarClubes();

});
