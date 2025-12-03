function mostrarAlerta(mensaje, tipo, duracion = 4000) {
    // CORRECCIÓN: Usar 'alertas-container' para coincidir con admin.html
    let container = document.getElementById('alertas-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'alertas-container'; // ID corregido
        container.classList.add('alerta-container');
        document.body.appendChild(container);
    }

    const alerta = document.createElement('div');
    alerta.classList.add('alerta', tipo);

    let iconoClase = '';
    switch (tipo) {
        case 'exito':
            iconoClase = 'bi-check-circle-fill';
            break;
        case 'error':
            // Si quieres el icono hexagonal customizado: USA 'icono-error-custom'
            // Si quieres el icono estándar de Bootstrap: USA 'bi-x-octagon-fill'
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

    container.appendChild(alerta);

    alerta.offsetWidth;
    alerta.classList.add('mostrar');

    const remover = () => {
        alerta.classList.remove('mostrar');
        alerta.addEventListener('transitionend', () => {
            alerta.remove();
        }, { once: true });
    };

    if (duracion > 0) {
        setTimeout(remover, duracion);
    }

    return {
        elemento: alerta,
        cerrar: remover
    };
}

function mostrarConfirmacion(mensaje) {
    return new Promise((resolve) => {
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
        setTimeout(() => overlay.classList.add('mostrar'), 10);
        const yesBtn = overlay.querySelector('.confirm-yes');
        const noBtn = overlay.querySelector('.confirm-no');
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