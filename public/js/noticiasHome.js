document.addEventListener("DOMContentLoaded", async () => {
    const contenedor = document.getElementById("ultimas-noticias");

    try {
        const res = await fetch("/api/noticias");
        const noticias = await res.json();

        if (!noticias.length) {
            contenedor.innerHTML = `<p class="text-secondary">No hay noticias disponibles por el momento.</p>`;
            return;
        }

        contenedor.innerHTML = noticias
            .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
            .slice(0, 5)
            .map(noticia => `
                <div class="noticia-card">
                    <h3>${noticia.titulo}</h3>
                    <p>${noticia.contenido}</p>
                    <span class="fecha">${new Date(noticia.fecha).toLocaleDateString()}</span>
                </div>
            `)
            .join("");

    } catch (error) {
        contenedor.innerHTML = `<p class="text-danger">Error al cargar noticias.</p>`;
    }
});
