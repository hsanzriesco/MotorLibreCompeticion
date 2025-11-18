/**
 * Muestra una alerta temporal en la esquina superior derecha de la pantalla.
 * @param {string} mensaje - El texto del mensaje a mostrar.
 * @param {('exito'|'error'|'advertencia'|'info')} tipo - El tipo de alerta (define el color y el icono).
 * @param {number} [duracion=4000] - Duración en milisegundos que la alerta estará visible.
 */
function mostrarAlerta(mensaje, tipo, duracion = 4000) {
    // 1. Asegurar la existencia del contenedor principal
    let container = document.getElementById('alerta-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'alerta-container';
        container.classList.add('alerta-container');
        document.body.appendChild(container);
    }

    // 2. Crear el elemento de alerta
    const alerta = document.createElement('div');
    alerta.classList.add('alerta', tipo);

    // Definir el icono basado en el tipo (usando Bootstrap Icons)
    let iconoClase = '';
    switch (tipo) {
        case 'exito':
            iconoClase = 'bi-check-circle-fill';
            break;
        case 'error':
            iconoClase = 'bi-x-octagon-fill';
            break;
        case 'advertencia':
            iconoClase = 'bi-exclamation-triangle-fill';
            break;
        case 'info':
        default:
            iconoClase = 'bi-info-circle-fill';
            break;
    }

    alerta.innerHTML = `<i class="bi ${iconoClase}"></i> ${mensaje}`;

    // 3. Añadir al contenedor y mostrar con transición
    container.appendChild(alerta);
    
    // Forzar reflow para la transición CSS
    alerta.offsetWidth; 
    alerta.classList.add('mostrar');

    // 4. Programar la desaparición
    setTimeout(() => {
        alerta.classList.remove('mostrar');
        // Esperar a que termine la transición para eliminar el elemento
        alerta.addEventListener('transitionend', () => {
            alerta.remove();
            // Opcional: Si el contenedor queda vacío, también se puede eliminar
            if (container.children.length === 0) {
                // container.remove(); 
            }
        }, { once: true });
    }, duracion);
}