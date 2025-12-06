// /js/footer.js
// Este script crea el elemento <footer> y lo añade al documento.

document.addEventListener("DOMContentLoaded", () => {
    // 1. Crear el elemento 'footer' principal
    const footerElement = document.createElement('footer');
    // Le asignamos el ID que usas en el CSS: #main-footer
    footerElement.id = 'main-footer';

    // 2. Definir el contenido HTML. Se reemplaza el texto de la primera columna por la imagen.
    footerElement.innerHTML = `
        <div class="footer-content container py-5">
            <div class="row">
                
                <div class="col-md-4 mb-4 text-center">
                    
                    <a href="./index.html" class="d-inline-block">
                        <img src="./img/imagen-tfg.png" alt="Motor Libre Competición Logo" height="80" class="img-fluid mb-2">
                    </a>
                    
                    <h5 class="text-danger fw-bold mt-2">Motor Libre Competición</h5>
                    <p class="text-white-50">
                        La plataforma oficial para gestionar competiciones y eventos de motor en tu región.
                    </p>
                </div>
                
                <div class="col-md-4 mb-4 text-center text-md-start">
                    <h5 class="text-danger fw-bold">Navegación</h5>
                    <ul class="list-unstyled">
                        <li><a href="./index.html" class="text-light text-decoration-none">Inicio</a></li>
                        <li><a href="./pages/calendario/calendario.html" class="text-light text-decoration-none">Calendario</a></li>
                        <li><a href="./pages/clubes/clubes.html" class="text-light text-decoration-none">Clubes</a></li>
                        <li><a href="./pages/perfil/perfil.html" class="text-light text-decoration-none">Mi Perfil</a></li>
                    </ul>
                </div>

                <div class="col-md-4 mb-4 text-center text-md-end">
                    <h5 class="text-danger fw-bold">Síguenos</h5>
                    <a href="#" class="text-light me-3"><i class="bi bi-facebook fs-4"></i></a>
                    <a href="#" class="text-light me-3"><i class="bi bi-twitter fs-4"></i></a>
                    <a href="#" class="text-light"><i class="bi bi-instagram fs-4"></i></a>
                </div>
            </div>
            
            <div class="footer-bottom text-center pt-3 border-top border-secondary">
                </div>
        </div>
    `;

    // 3. Añadir el footer al final del body
    document.body.appendChild(footerElement);
});