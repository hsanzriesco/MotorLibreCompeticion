document.addEventListener("DOMContentLoaded", () => {

    const getBaseHref = () => {
        const pathSegments = window.location.pathname.split('/').filter(segment => segment.length > 0);
        let depth = 0;
        if (pathSegments.length > 0 && pathSegments[pathSegments.length - 1].endsWith('.html')) {
            depth = pathSegments.length - 1;
        } else {
            depth = pathSegments.length;
        }
        return depth > 0 ? Array(depth).fill('../').join('') : './';
    };

    const baseHref = getBaseHref();

    const footerElement = document.createElement('footer');
    footerElement.className = 'bg-dark border-top border-danger mt-auto mb-0';
    footerElement.id = 'main-footer';

    footerElement.innerHTML = `
        <div class="footer-content container py-3"> 
            <div class="row">
                
                <div class="col-md-3 col-12 mb-3 text-center text-md-start">
                    
                    <a href="${baseHref}index.html" class="d-inline-block">
                        <img src="${baseHref}img/imagen-tfg.png" alt="MLC Logo" height="80" class="img-fluid mb-2">
                    </a>

                    <div class="mt-2">
                        <a href="https://x.com/InfoMlc81196" class="text-light me-2" target="_blank"><i class="bi bi-twitter fs-6"></i></a>
                        <a href="https://www.instagram.com/motorlibrecompeticion.mlc/" class="text-light" target="_blank"><i class="bi bi-instagram fs-6"></i></a>
                    </div>
                </div>
                
                <div class="col-md-4 col-12 mb-3 text-center text-md-start">
                    <h6 class="text-danger fw-bold mb-2">CONTACTO</h6>
                    <ul class="list-unstyled small">
                        <li><a href="mailto:infmotorlibrecompeticion@gmail.com" class="text-light text-decoration-none"><i class="bi bi-envelope-fill me-1"></i> infmotorlibrecompeticion@gmail.com</a></li>
                        <li><a href="tel:+34629XXXXXXX" class="text-light text-decoration-none"><i class="bi bi-phone-fill me-1"></i> +34 629 XXX XXX</a></li>
                    </ul>
                </div>

                <div class="col-md-1 d-none d-md-block d-flex justify-content-center">
                    <hr class="vr text-danger mx-auto" />
                </div>

                <div class="col-md-4 col-12 mb-3 text-center text-md-start">
                    <h6 class="text-danger fw-bold mb-2">QUIENES SOMOS</h6>
                    <ul class="list-unstyled small">
                        <li><a href="${baseHref}quienes-somos.html" class="text-light text-decoration-none">Nuestra historia</a></li>
                        <li><a href="${baseHref}mision-vision.html" class="text-light text-decoration-none">Misión y Visión</a></li>
                        <li><a href="${baseHref}faq.html" class="text-light text-decoration-none">Preguntas frecuentes</a></li>
                    </ul>
                </div>
                
            </div>
            
            <div class="footer-bottom text-center pt-2 mt-3 border-top border-danger">
                <p class="text-white-50 small mb-0">&copy; 2026 Motor Libre Competición. Todos los derechos reservados.</p>
            </div>
        </div>
    `;


    document.body.appendChild(footerElement);
});
