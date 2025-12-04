document.addEventListener("DOMContentLoaded", () => {

    const tabla = document.getElementById("tabla-clubes");
    const form = document.getElementById("club-form");

    const inputId = document.getElementById("club-id");
    const inputNombre = document.getElementById("nombre_evento");
    const inputDescripcion = document.getElementById("descripcion");
    const inputImagen = document.getElementById("imagen_club");

    async function cargarClubes() {
        try {
            const res = await fetch("/api/clubs");
            const data = await res.json();

            if (!data.success) {
                mostrarAlerta("Error cargando clubes", "error");
                return;
            }

            renderTabla(data.data);
        } catch (error) {
            mostrarAlerta("Error al conectar con el servidor", "error");
        }
    }

    function renderTabla(clubes) {
        tabla.innerHTML = "";

        if (clubes.length === 0) {
            tabla.innerHTML = `<tr><td colspan="6" class="text-danger text-center">No hay clubes registrados</td></tr>`;
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
                    <button class="btn btn-warning btn-sm editar-btn" data-id="${club.id}">Editar</button>
                    <button class="btn btn-danger btn-sm eliminar-btn" data-id="${club.id}">Eliminar</button>
                </td>
            `;

            tabla.appendChild(fila);
        });

        document.querySelectorAll(".editar-btn").forEach(btn =>
            btn.addEventListener("click", cargarClubEnFormulario)
        );

        document.querySelectorAll(".eliminar-btn").forEach(btn =>
            btn.addEventListener("click", eliminarClub)
        );
    }

    async function cargarClubEnFormulario(e) {
        const id = e.target.dataset.id;

        try {
            const res = await fetch(`/api/clubs?id=${id}`);
            const r = await res.json();

            if (!r.success) {
                mostrarAlerta("No se pudo cargar el club", "error");
                return;
            }

            const c = r.data;

            inputId.value = c.id;
            inputNombre.value = c.nombre_evento;
            inputDescripcion.value = c.descripcion;
            inputImagen.value = "";

            mostrarAlerta("Club cargado para edición", "info");

        } catch (error) {
            mostrarAlerta("Error cargando club", "error");
        }
    }

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const id = inputId.value;
        const metodo = id ? "PUT" : "POST";
        const url = "/api/clubs" + (id ? `?id=${id}` : "");

        const formData = new FormData();
        formData.append("nombre_evento", inputNombre.value);
        formData.append("descripcion", inputDescripcion.value);

        if (inputImagen.files.length > 0) {
            formData.append("imagen_club", inputImagen.files[0]);
        }

        try {
            const res = await fetch(url, {
                method: metodo,
                body: formData
            });

            const r = await res.json();

            if (!r.success) {
                mostrarAlerta("Error guardando club", "error");
                return;
            }

            mostrarAlerta(id ? "Club actualizado" : "Club creado", "exito");

            form.reset();
            inputId.value = "";

            cargarClubes();

        } catch (error) {
            mostrarAlerta("Error en el servidor", "error");
        }
    });

    async function eliminarClub(e) {
        const id = e.target.dataset.id;

        if (!confirm("¿Seguro que deseas eliminar este club?")) return;

        try {
            const res = await fetch(`/api/clubs?id=${id}`, {
                method: "DELETE"
            });

            const r = await res.json();

            if (!r.success) {
                mostrarAlerta("Error eliminando club", "error");
                return;
            }

            mostrarAlerta("Club eliminado", "exito");
            cargarClubes();

        } catch (error) {
            mostrarAlerta("Error eliminando club", "error");
        }
    }

    cargarClubes();
});
