// La función mostrarAlerta debe estar definida en alertas.js y cargada antes.

function getTokenFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('token');
}

document.addEventListener('DOMContentLoaded', () => {
    const token = getTokenFromUrl();

    // 1. Buscamos el contenedor del formulario para mensajes de error.
    const container = document.getElementById('reset-form-container');

    if (!token) {
        // Manejo del error si falta el token
        if (container) {
            container.innerHTML = '<h2>Error: Token de restablecimiento faltante.</h2>';
        } else {
            // REEMPLAZADO: Usamos mostrarAlerta para el fallback
            mostrarAlerta('Error: Token de restablecimiento faltante. No se puede continuar.', 'error');
            console.error("Error: Missing reset token. Could not find 'reset-form-container'.");
        }
        return;
    }

    // 2. Usamos el ID correcto del formulario ('reset-password-form')
    const resetForm = document.getElementById('reset-password-form');

    // Verificación de seguridad
    if (!resetForm) {
        console.error("CRITICAL ERROR: The form element with ID 'reset-password-form' was not found.");
        return;
    }

    // Si el formulario existe, adjuntamos el escuchador de eventos
    resetForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;

        if (newPassword !== confirmPassword) {
            // REEMPLAZADO: Usamos mostrarAlerta para la validación
            mostrarAlerta('Las contraseñas no coinciden. Por favor, revísalas.', 'advertencia');
            return;
        }

        try {
            const response = await fetch('/api/resetPassword', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, newPassword })
            });

            const data = await response.json();

            if (response.ok) {
                // REEMPLAZADO: Usamos mostrarAlerta para el éxito
                mostrarAlerta('¡Contraseña restablecida con éxito! Ya puedes iniciar sesión.', 'exito');

                // Añadimos un pequeño retraso para que el usuario vea la alerta de éxito
                setTimeout(() => {
                    window.location.href = '/pages/auth/login/login.html';
                }, 1800);

            } else {
                // REEMPLAZADO: Usamos mostrarAlerta para el error de API
                mostrarAlerta(`Fallo al restablecer: ${data.message}`, 'error');
            }
        } catch (error) {
            console.error('API Error:', error);
            // REEMPLAZADO: Usamos mostrarAlerta para el error de conexión
            mostrarAlerta('Ocurrió un error inesperado. Por favor, inténtalo de nuevo.', 'error');
        }
    });
});