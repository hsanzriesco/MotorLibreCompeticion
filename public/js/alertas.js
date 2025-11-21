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

    alerta.innerHTML = `<i class="bi ${iconoClase}"></i><div class="alerta-texto">${mensaje}</div>`;

    // 3. Añadir al contenedor y mostrar con transición
    container.appendChild(alerta);

    // Forzar reflow para la transición CSS
    alerta.offsetWidth;
    alerta.classList.add('mostrar');

    // 4. Programar la desaparición
    const remover = () => {
        alerta.classList.remove('mostrar');
        alerta.addEventListener('transitionend', () => {
            alerta.remove();
            // Si el contenedor queda vacío, lo dejamos (no quitar para evitar re-flujo inesperado)
        }, { once: true });
    };

    // Timer para auto-cierre; si duracion <= 0 => no cerrar automáticamente
    if (duracion > 0) {
        setTimeout(remover, duracion);
    }

    // Devolver el nodo por si se quiere cerrar manualmente
    return {
        elemento: alerta,
        cerrar: remover
    };
}

/**
 * Muestra una confirmación centrada con estilo MLC (negro/rojo).
 * Devuelve una Promise<boolean> que se resuelve true si confirma, false si cancela.
 * @param {string} mensaje 
 * @returns {Promise<boolean>}
 */
function mostrarConfirmacion(mensaje) {
    return new Promise((resolve) => {
        // Crear overlay
        const overlay = document.createElement('div');
        overlay.className = 'confirmacion-overlay';

        overlay.innerHTML = `
            <div class="confirmacion-box" role="dialog" aria-modal="true">
                <h4>Confirmar acción</h4>
                <p>${mensaje}</p>
                <div class="confirmacion-btns">
                    <button class="confirm-btn confirm-yes">Sí</button>
                    <button class="confirm-btn confirm-no">No</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Forzar animación
        setTimeout(() => overlay.classList.add('mostrar'), 10);

        // Enfocar el botón Sí para accesibilidad
        const yesBtn = overlay.querySelector('.confirm-yes');
        const noBtn = overlay.querySelector('.confirm-no');

        // Manejo teclado: Esc = cancelar
        const keyHandler = (ev) => {
            if (ev.key === 'Escape') {
                cleanup(false);
            }
        };

        function cleanup(result) {
            document.removeEventListener('keydown', keyHandler);
            if (!overlay) return;
            overlay.classList.remove('mostrar');
            setTimeout(() => {
                if (overlay && overlay.parentNode) overlay.remove();
                resolve(result);
            }, 180);
        }

        yesBtn.addEventListener('click', () => cleanup(true), { once: true });
        noBtn.addEventListener('click', () => cleanup(false), { once: true });

        document.addEventListener('keydown', keyHandler);
    });
}
