document.addEventListener("DOMContentLoaded", cargarNoticias);

async function cargarNoticias() {
    const tabla = document.getElementById("tabla-noticias");

    try {
        const res = await fetch("/api/noticias");
        const noticias = await res.json();

        tabla.innerHTML = noticias
            .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
            .map(n => `
                <tr>
                    <td>${n.titulo}</td>
                    <td>${new Date(n.fecha).toLocaleDateString()}</td>
                    <td>
                        <button class="btn btn-warning btn-sm me-2" onclick="editarNoticia(${n.id})">Editar</button>
                        <button class="btn btn-danger btn-sm" onclick="eliminarNoticia(${n.id})">Eliminar</button>
                    </td>
                </tr>
            `)
            .join("");

    } catch (error) {
        mostrarAlerta("Error al cargar noticias", "error");
    }
}

// ====================
// GUARDAR (crear o editar)
// ====================
document.getElementById("form-noticia").addEventListener("submit", async e => {
    e.preventDefault();

    const id = document.getElementById("noticia-id").value;
    const titulo = document.getElementById("titulo").value;
    const contenido = document.getElementById("contenido").value;

    const datos = { titulo, contenido };

    const metodo = id ? "PUT" : "POST";
    const url = id ? `/api/noticias/${id}` : "/api/noticias";

    try {
        const res = await fetch(url, {
            method: metodo,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(datos)
        });

        await res.json();

        mostrarAlerta(id ? "Noticia actualizada" : "Noticia creada", "exito");

        document.getElementById("form-noticia").reset();
        document.getElementById("noticia-id").value = "";
        cargarNoticias();

    } catch (error) {
        mostrarAlerta("Error al guardar noticia", "error");
    }
});

// ====================
// EDITAR
// ====================
async function editarNoticia(id) {
    const res = await fetch("/api/noticias");
    const noticias = await res.json();

    const n = noticias.find(x => x.id === id);

    document.getElementById("noticia-id").value = n.id;
    document.getElementById("titulo").value = n.titulo;
    document.getElementById("contenido").value = n.contenido;
}

// ====================
// ELIMINAR
// ====================
async function eliminarNoticia(id) {
    if (!confirm("¿Seguro que deseas eliminar esta noticia?")) return;

    try {
        await fetch(`/api/noticias/${id}`, { method: "DELETE" });
        mostrarAlerta("Noticia eliminada", "exito");
        cargarNoticias();
    } catch (error) {
        mostrarAlerta("Error al eliminar noticia", "error");
    }
}
