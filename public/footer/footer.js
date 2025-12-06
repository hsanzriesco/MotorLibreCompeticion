// /js/footer.js
// Este script crea el elemento <footer> y lo añade al documento.

document.addEventListener("DOMContentLoaded", () => {
    // 1. Crear el elemento 'footer' principal
    const footerElement = document.createElement('footer');
    // Le asignamos el ID que usas en el CSS: #main-footer
    footerElement.id = 'main-footer';

    // 2. Definir el contenido HTML. Se usa una estructura de 3 columnas (3, 4, 5) para distribuir el contenido.
    footerElement.innerHTML = `
        <div class="footer-content container py-5">
            <div class="row">
                
                <div class="col-md-3 mb-5 mb-md-3 text-center text-md-start">
                    
                    <a href="./index.html" class="d-inline-block">
                        <img src="./img/imagen-tfg.png" alt="MLC Logo" height="80" class="img-fluid mb-3">
                    </a>

                    <div class="mt-3">
                        <a href="#" class="text-light me-3"><i class="bi bi-facebook fs-4"></i></a>
                        <a href="#" class="text-light me-3"><i class="bi bi-twitter fs-4"></i></a>
                        <a href="#" class="text-light"><i class="bi bi-instagram fs-4"></i></a>
                    </div>
                </div>
                
                <div class="col-md-4 mb-3 text-center text-md-start">
                    <h5 class="text-danger fw-bold mb-3">INFORMACIÓN</h5>
                    <ul class="list-unstyled">
                        <li><a href="#" class="text-light text-decoration-none">Prensa</a></li>
                        <li><a href="#" class="text-light text-decoration-none">Media</a></li>
                        <li><a href="#" class="text-light text-decoration-none">Contacto</a></li>
                        <li class="mt-2"><a href="./pages/calendario/calendario.html" class="text-light text-decoration-none">Calendario</a></li>
                        <li><a href="./pages/clubes/clubes.html" class="text-light text-decoration-none">Clubes</a></li>
                    </ul>
                </div>

                <div class="col-md-5 mb-3 text-center text-md-start">
                    <h5 class="text-danger fw-bold mb-3">SOBRE</h5>
                    <ul class="list-unstyled">
                        <li><a href="#" class="text-light text-decoration-none">Aviso Legal</a></li>
                        <li><a href="#" class="text-light text-decoration-none">Aviso de Cookies</a></li>
                        <li><a href="#" class="text-light text-decoration-none">Política de Privacidad</a></li>
                        <li><a href="#" class="text-light text-decoration-none">Términos y Condiciones</a></li>
                        <li><a href="#" class="text-light text-decoration-none">Venta Online</a></li>
                    </ul>
                </div>
            </div>
            
            <div class="footer-bottom text-center pt-3 mt-4 border-top border-danger">
                </div>
        </div>
    `;

    // 3. Añadir el footer al final del body
    document.body.appendChild(footerElement);
});