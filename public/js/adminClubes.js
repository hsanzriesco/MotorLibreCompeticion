// public/js/adminClubes.js
document.addEventListener("DOMContentLoaded", () => {

    const tabla = document.getElementById("tabla-clubes");
    const form = document.getElementById("club-form");

    const inputId = document.getElementById("club-id");
    const inputNombre = document.getElementById("nombre_evento");
    const inputDescripcion = document.getElementById("descripcion");
    const inputImagen = document.getElementById("imagen_club");
    const inputFecha = document.getElementById("fecha_creacion");

    // Modal de confirmación
    const deleteConfirmModalEl = document.getElementById("deleteConfirmModal");
    const deleteConfirmModal = deleteConfirmModalEl ? new bootstrap.Modal(deleteConfirmModalEl) : null;
    const btnConfirmDelete = document.getElementById("btnConfirmDelete");
    let clubToDeleteId = null;

    // -----------------------------------------
    // UTIL: fecha hoy en formato YYYY-MM-DD
    // -----------------------------------------
    function hoyISODate() {
        const d = new Date();
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }

    // Inicializar fecha visual para administrador
    function setFechaDefault() {
        if (inputFecha) inputFecha.value = hoyISODate();
    }

    // -----------------------------------------
    // CARGAR LISTA DE CLUBES
    // -----------------------------------------
    async function cargarClubes() {
        try {
            const res = await fetch("/api/clubs");
            const data = await res.json();

            if (!data.success) {
                mostrarAlerta("Error cargando clubes", "error");
                tabla.innerHTML = `<tr><td colspan="6" class="text-danger text-center">Error cargando clubes</td></tr>`;
                return;
            }

            renderTabla(data.data);
        } catch (error) {
            console.error("Error cargarClubes:", error);
            mostrarAlerta("Error al conectar con el servidor", "error");
            tabla.innerHTML = `<tr><td colspan="6" class="text-danger text-center">Error de servidor</td></tr>`;
        }
    }

    // -----------------------------------------
    // RENDERIZAR TABLA
    // -----------------------------------------
    function renderTabla(clubes) {
        tabla.innerHTML = "";

        if (!Array.isArray(clubes) || clubes.length === 0) {
            tabla.innerHTML = `<tr><td colspan="6" class="text-danger text-center">No hay clubes registrados</td></tr>`;
            return;
        }

        clubes.forEach(club => {
            const fila = document.createElement("tr");

            const fecha = club.fecha_creacion ? club.fecha_creacion.toString().split('T')[0] : '';

            fila.innerHTML = `
                <td>${club.id}</td>
                <td>${escapeHtml(club.nombre_evento)}</td>
                <td>${escapeHtml(club.descripcion || "Sin descripción")}</td>
                <td>${fecha}</td>
                <td>
                    ${club.imagen_club ? `<img src="${club.imagen_club}" class="club-thumb" alt="Imagen club">` : "-"}
                </td>
                <td>
                    <button class="btn btn-warning btn-sm me-2 editar-btn" data-id="${club.id}"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-danger btn-sm eliminar-btn" data-id="${club.id}"><i class="bi bi-trash"></i></button>
                </td>
            `;

            tabla.appendChild(fila);
        });

        document.querySelectorAll(".editar-btn").forEach(btn =>
            btn.addEventListener("click", cargarClubEnFormulario)
        );

        document.querySelectorAll(".eliminar-btn").forEach(btn =>
            btn.addEventListener("click", preguntarEliminarClub)
        );
    }

    // -----------------------------------------
    // ESCAPAR HTML
    // -----------------------------------------
    function escapeHtml(str = "") {
        return String(str)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;");
    }

    // -----------------------------------------
    // CARGAR CLUB EN FORMULARIO (EDITAR)
    // -----------------------------------------
    async function cargarClubEnFormulario(e) {
        const id = e.currentTarget.dataset.id;
        if (!id) return;

        try {
            const res = await fetch(`/api/clubs?id=${id}`);
            const r = await res.json();

            if (!r.success) {
                mostrarAlerta("No se pudo cargar el club", "error");
                return;
            }

            const c = r.data;

            inputId.value = c.id;
            inputNombre.value = c.nombre_evento || "";
            inputDescripcion.value = c.descripcion || "";
            inputFecha.value = c.fecha_creacion ? c.fecha_creacion.toString().split('T')[0] : hoyISODate();
            if (inputImagen) inputImagen.value = "";

            mostrarAlerta("Club cargado para edición", "info");
            inputNombre.focus();

        } catch (error) {
            console.error("Error cargarClubEnFormulario:", error);
            mostrarAlerta("Error cargando club", "error");
        }
    }

    // -----------------------------------------
    // GUARDAR CLUB (POST / PUT)
    // -----------------------------------------
    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const id = inputId.value;
        const metodo = id ? "PUT" : "POST";
        const url = "/api/clubs" + (id ? `?id=${id}` : "");

        const formData = new FormData();
        formData.append("nombre_evento", inputNombre.value.trim());
        formData.append("descripcion", inputDescripcion.value.trim());

        // ❌ YA NO ENVIAMOS FECHA AL BACKEND
        // el servidor genera fecha_creacion automáticamente

        if (inputImagen && inputImagen.files.length > 0) {
            formData.append("imagen_club", inputImagen.files[0]);
        }

        try {
            const res = await fetch(url, { method: metodo, body: formData });
            const r = await res.json();

            if (!r.success) {
                mostrarAlerta(r.message || r.error || "Error guardando club", "error");
                return;
            }

            mostrarAlerta(id ? "Club actualizado" : "Club creado", "exito");

            form.reset();
            inputId.value = "";
            setFechaDefault();

            cargarClubes();

        } catch (error) {
            console.error("Error submit club:", error);
            mostrarAlerta("Error en el servidor", "error");
        }
    });

    // -----------------------------------------
    // ELIMINAR CLUB
    // -----------------------------------------
    function preguntarEliminarClub(e) {
        const id = e.currentTarget.dataset.id;
        if (!id) return;

        clubToDeleteId = id;

        const row = e.currentTarget.closest("tr");
        const clubName = row ? row.children[1].textContent : "este club";
        const deleteMessageEl = document.getElementById("deleteConfirmMessage");

        if (deleteMessageEl)
            deleteMessageEl.textContent = `¿Estás seguro de que deseas eliminar "${clubName}"? Esta acción es irreversible.`;

        if (deleteConfirmModal) deleteConfirmModal.show();
    }

    if (btnConfirmDelete) {
        btnConfirmDelete.addEventListener("click", async () => {
            if (!clubToDeleteId) {
                mostrarAlerta("ID inválido", "error");
                deleteConfirmModal.hide();
                return;
            }

            try {
                const res = await fetch(`/api/clubs?id=${clubToDeleteId}`, {
                    method: "DELETE"
                });

                const r = await res.json();

                if (!r.success) {
                    mostrarAlerta(r.message || "Error eliminando", "error");
                    deleteConfirmModal.hide();
                    return;
                }

                mostrarAlerta("Club eliminado", "exito");
                clubToDeleteId = null;
                deleteConfirmModal.hide();
                cargarClubes();

            } catch (error) {
                console.error("Error eliminarClub:", error);
                mostrarAlerta("Error eliminando club", "error");
                deleteConfirmModal.hide();
            }
        });
    }

    // -----------------------------------------
    // Inicializar
    // -----------------------------------------
    setFechaDefault();
    cargarClubes();
});
