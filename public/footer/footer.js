// /footer/footer.js
// Este script crea el elemento <footer> y lo añade al documento.

document.addEventListener("DOMContentLoaded", () => {
    // 1. Crear el elemento 'footer' principal
    const footerElement = document.createElement('footer');
    // Le asignamos el ID que usas en el CSS: #main-footer
    footerElement.id = 'main-footer';

    // 2. Definir el contenido HTML. Se usa py-3 para menos padding vertical y h6 para encabezados más pequeños.
    footerElement.innerHTML = `
        <div class="footer-content container py-3"> 
            <div class="row">
                
                <div class="col-md-3 mb-3 text-center text-md-start">
                    
                    <a href="./index.html" class="d-inline-block">
                        <img src="./img/imagen-tfg.png" alt="MLC Logo" height="80" class="img-fluid mb-2">
                    </a>

                    <div class="mt-2">
                        <a href="#" class="text-light me-2"><i class="bi bi-facebook fs-6"></i></a>
                        <a href="#" class="text-light me-2"><i class="bi bi-twitter fs-6"></i></a>
                        <a href="#" class="text-light"><i class="bi bi-instagram fs-6"></i></a>
                    </div>
                </div>
                
                <div class="col-md-4 mb-3 text-center text-md-start">
                    <h6 class="text-danger fw-bold mb-2">INFORMACIÓN</h6>
                    <ul class="list-unstyled small">
                        <li><a href="#" class="text-light text-decoration-none">Prensa</a></li>
                        <li><a href="#" class="text-light text-decoration-none">Media</a></li>
                        <li><a href="#" class="text-light text-decoration-none">Contacto</a></li>
                        <li class="mt-1"><a href="./pages/calendario/calendario.html" class="text-light text-decoration-none">Calendario</a></li>
                        <li><a href="./pages/clubes/clubes.html" class="text-light text-decoration-none">Clubes</a></li>
                    </ul>
                </div>

                <div class="col-md-5 mb-3 text-center text-md-start">
                    <h6 class="text-danger fw-bold mb-2">SOBRE</h6>
                    <ul class="list-unstyled small">
                        <li><a href="#" class="text-light text-decoration-none">Aviso Legal</a></li>
                        <li><a href="#" class="text-light text-decoration-none">Aviso de Cookies</a></li>
                        <li><a href="#" class="text-light text-decoration-none">Política de Privacidad</a></li>
                        <li><a href="#" class="text-light text-decoration-none">Términos y Condiciones</a></li>
                        <li><a href="#" class="text-light text-decoration-none">Venta Online</a></li>
                    </ul>
                </div>
            </div>
            
            <div class="footer-bottom text-center pt-2 mt-3 border-top border-danger">
                </div>
        </div>
    `;

    // 3. Añadir el footer al final del body
    document.body.appendChild(footerElement);
});