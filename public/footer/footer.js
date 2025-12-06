// /js/footer.js

document.addEventListener("DOMContentLoaded", () => {
    // 1. Crear el elemento 'footer' principal
    const footerElement = document.createElement('footer');
    footerElement.id = 'main-footer'; // Para poder darle estilos
    
    // 2. Establecer el contenido HTML y estilos
    footerElement.innerHTML = `
        <div class="footer-content container py-5">
            <div class="row">
                
                <div class="col-md-4 mb-3">
                    <h5 class="text-danger fw-bold">Motor Libre Competición</h5>
                    <p class="text-white-50">
                        La plataforma oficial para gestionar competiciones y eventos de motor en tu región.
                    </p>
                </div>
                
                <div class="col-md-4 mb-3">
                    <h5 class="text-danger fw-bold">Navegación</h5>
                    <ul class="list-unstyled">
                        <li><a href="/index.html" class="text-light text-decoration-none">Inicio</a></li>
                        <li><a href="/pages/calendario/calendario.html" class="text-light text-decoration-none">Calendario</a></li>
                        <li><a href="/pages/clubes/clubes.html" class="text-light text-decoration-none">Clubes</a></li>
                        <li><a href="/pages/perfil/perfil.html" class="text-light text-decoration-none">Mi Perfil</a></li>
                    </ul>
                </div>

                <div class="col-md-4 mb-3">
                    <h5 class="text-danger fw-bold">Síguenos</h5>
                    <a href="#" class="text-light me-3"><i class="bi bi-facebook fs-4"></i></a>
                    <a href="#" class="text-light me-3"><i class="bi bi-twitter fs-4"></i></a>
                    <a href="#" class="text-light me-3"><i class="bi bi-instagram fs-4"></i></a>
                </div>
            </div>
            
            <div class="footer-bottom text-center pt-3 border-top border-secondary">
                <p class="mb-0 text-white-50">&copy; ${new Date().getFullYear()} Motor Libre Competición. Todos los derechos reservados.</p>
            </div>
        </div>
    `;

    // 3. Añadir el footer al final del body
    document.body.appendChild(footerElement);
});