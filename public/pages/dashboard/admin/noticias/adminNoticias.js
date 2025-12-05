document.addEventListener("DOMContentLoaded", () => {
    const tablaNoticias = document.getElementById("tabla-noticias");
    const form = document.getElementById("noticia-form");

    let editId = null;

    // Cargar noticias
    async function cargarNoticias() {
        const res = await fetch("/api/noticias");
        const data = await res.json();

        tablaNoticias.innerHTML = "";

        data.forEach(noticia => {
            tablaNoticias.innerHTML += `
                <tr>
                    <td>${noticia.id}</td>
                    <td>${noticia.titulo}</td>
                    <td>${noticia.contenido.substring(0, 50)}...</td>
                    <td>${new Date(noticia.fecha).toLocaleDateString()}</td>
                    <td>
                        <button class="btn btn-warning btn-sm" onclick="editarNoticia(${noticia.id}, '${noticia.titulo}', \`${noticia.contenido}\`)">Editar</button>
                        <button class="btn btn-danger btn-sm" onclick="eliminarNoticia(${noticia.id})">Eliminar</button>
                    </td>
                </tr>
            `;
        });
    }

    cargarNoticias();

    // Crear o actualizar noticia
    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const titulo = document.getElementById("titulo").value;
        const contenido = document.getElementById("contenido").value;

        const url = editId ? `/api/noticias/${editId}` : "/api/noticias";
        const method = editId ? "PUT" : "POST";

        const res = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ titulo, contenido })
        });

        if (res.ok) {
            alert("Noticia guardada");
            form.reset();
            editId = null;
            cargarNoticias();
        }
    });

    // Función global para editar
    window.editarNoticia = (id, titulo, contenido) => {
        editId = id;
        document.getElementById("titulo").value = titulo;
        document.getElementById("contenido").value = contenido;
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    // Función global para eliminar
    window.eliminarNoticia = async (id) => {
        if (confirm("¿Seguro que quieres eliminar la noticia?")) {
            const res = await fetch(`/api/noticias/${id}`, { method: "DELETE" });
            if (res.ok) cargarNoticias();
        }
    };
});
