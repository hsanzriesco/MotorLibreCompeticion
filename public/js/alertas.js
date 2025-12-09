function mostrarAlerta(mensaje, tipo, duracion = 4000, limpiarPrevias = true) {
    let container = document.getElementById('alertas-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'alertas-container';
        // Usamos el ID como clase por consistencia, asumiendo que el CSS usa esta clase.
        container.classList.add('alerta-container'); 
        document.body.appendChild(container);
    }
    
    // === MODIFICACIÓN CLAVE: Cerrar alertas existentes para prevenir duplicación visible ===
    if (limpiarPrevias) {
        const alertasExistentes = container.querySelectorAll('.alerta');
        alertasExistentes.forEach(alerta => {
            // Aseguramos que se inicie el proceso de remoción, incluso si la transición no ha terminado
            alerta.remove(); 
        });
    }
    // ===================================================================================

    const alerta = document.createElement('div');
    alerta.classList.add('alerta', tipo);

    let iconoClase = '';
    switch (tipo) {
        case 'exito':
            iconoClase = 'bi-check-circle-fill';
            break;
        case 'error':
            // Se mantiene el icono estándar de Bootstrap
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

    // Forzar reflow para aplicar la transición de entrada
    alerta.offsetWidth; 
    alerta.classList.add('mostrar');

    const remover = () => {
        alerta.classList.remove('mostrar');
        // Usar transitionend para asegurar que se remueve DESPUÉS de la animación de salida
        alerta.addEventListener('transitionend', () => {
            if (alerta.parentNode) {
                alerta.remove();
            }
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

/**
 * Muestra una caja de confirmación modal.
 * @param {string} mensaje - El mensaje de confirmación a mostrar.
 * @returns {Promise<boolean>} Resuelve a true si el usuario presiona "Sí", false si presiona "No" o Escape.
 */
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
        // Pequeño timeout para permitir que el CSS aplique la transición de entrada
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
            if (!overlay || !overlay.parentNode) return resolve(result);

            overlay.classList.remove('mostrar');
            // Timeout para esperar la animación de salida (180ms)
            overlay.addEventListener('transitionend', () => {
                if (overlay.parentNode) {
                    overlay.remove();
                }
                resolve(result);
            }, { once: true });
        }

        yesBtn.addEventListener('click', () => cleanup(true), { once: true });
        noBtn.addEventListener('click', () => cleanup(false), { once: true });

        document.addEventListener('keydown', keyHandler);
    });
}