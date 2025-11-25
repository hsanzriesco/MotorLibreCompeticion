// La función mostrarAlerta se asume que está definida en alertas.js

function getTokenFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('token');
}

document.addEventListener('DOMContentLoaded', () => {
    // 1. Verificar el token de restablecimiento
    const token = getTokenFromUrl();
    if (!token) {
        // En lugar de innerHTML, usamos el sistema de alertas
        // El formulario ya no se mostrará gracias al return, pero mostramos el error.
        mostrarAlerta('Error: Falta el token de restablecimiento en la URL.', 'error', 0); // 0 = Alerta permanente
        
        // Opcional: Ocultar el formulario si no hay token
        const formBox = document.querySelector('.form-box');
        if (formBox) {
            formBox.innerHTML = '<h2 class="form-box-error-title">Error: Token no encontrado.</h2><p>Por favor, usa el enlace enviado a tu correo.</p>';
        }
        return;
    }

    // El ID correcto en tu HTML es 'resetForm', no 'reset-form'
    const resetForm = document.getElementById('resetForm'); 
    
    // 2. Asegurarse de que el formulario existe antes de añadir el Listener
    if (!resetForm) {
        console.error("Error JS: Elemento con ID 'resetForm' no encontrado.");
        return;
    }

    // 3. Manejo del envío del formulario
    resetForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;

        // Validar que las contraseñas coincidan
        if (newPassword !== confirmPassword) {
            // Reemplazamos alert() por mostrarAlerta()
            mostrarAlerta('Las contraseñas no coinciden.', 'error');
            return;
        }
        
        // Validación básica de longitud (opcional, pero buena práctica)
        if (newPassword.length < 6) {
             mostrarAlerta('La nueva contraseña debe tener al menos 6 caracteres.', 'advertencia');
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
                // Éxito: Reemplazamos alert() por mostrarAlerta()
                mostrarAlerta('¡Contraseña restablecida con éxito! Serás redirigido.', 'exito');
                
                // Redirigir después de mostrar el mensaje por un breve momento
                setTimeout(() => {
                    window.location.href = '/pages/auth/login/login.html';
                }, 2000); // Espera 2 segundos
                
            } else {
                // Fallo de la API: Reemplazamos alert() por mostrarAlerta()
                mostrarAlerta(`Fallo al restablecer: ${data.message || 'Error desconocido del servidor.'}`, 'error');
            }
        } catch (error) {
            console.error('API Error:', error);
            // Error de conexión: Reemplazamos alert() por mostrarAlerta()
            mostrarAlerta('Error inesperado de conexión. Por favor, inténtalo de nuevo.', 'error');
        }
    });
});