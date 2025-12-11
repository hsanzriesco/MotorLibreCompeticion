document.addEventListener("DOMContentLoaded", () => {
    // 1. ENCONTRAR el elemento 'footer' principal existente en el HTML
    // CAMBIO CLAVE: Usamos getElementById en lugar de createElement
    const footerElement = document.getElementById('main-footer');

    // Si por alguna razón no existe, salimos
    if (!footerElement) return;

    // 2. Definir el contenido HTML (el resto del código se mantiene igual).
    // Se usa py-3 para menos padding vertical y h6 para encabezados más pequeños.
    footerElement.innerHTML = `
        <div class="footer-content container py-3"> 
            <div class="row">
                
                <div class="col-md-3 col-12 mb-3 text-center text-md-start">
                    
                    <a href="./index.html" class="d-inline-block">
                        <img src="/img/imagen-tfg.png" alt="MLC Logo" height="80" class="img-fluid mb-2">
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
                        <li><a href="/quienes-somos.html" class="text-light text-decoration-none">Nuestra historia</a></li>
                        <li><a href="/mision-vision.html" class="text-light text-decoration-none">Misión y Visión</a></li>
                        <li><a href="/faq.html" class="text-light text-decoration-none">Preguntas frecuentes</a></li>
                    </ul>
                </div>
                
            </div>
            
            <div class="footer-bottom text-center pt-2 mt-3 border-top border-danger">
            </div>
        </div>
    `;


    // 3. ELIMINAR ESTA LÍNEA: document.body.appendChild(footerElement);
    // Ya no es necesario añadirlo, ya que se modificó el elemento existente.
});