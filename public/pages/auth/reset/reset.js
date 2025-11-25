// La función mostrarAlerta se asume que está definida y cargada desde alertas.js

function getTokenFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('token');
}

document.addEventListener('DOMContentLoaded', () => {
    // 1. Verificar el token de restablecimiento al cargar la página
    const token = getTokenFromUrl();
    if (!token) {
        // Mostrar alerta de error permanente (duracion=0)
        mostrarAlerta('Error: Falta el token de restablecimiento en la URL.', 'error', 0);

        // Modificar la caja del formulario para mostrar un mensaje de error limpio
        const formBox = document.querySelector('.form-box');
        if (formBox) {
            // Reemplaza el formulario con un mensaje
            formBox.innerHTML = '<h2 style="color:#e50914; font-size: 1.8rem;">ERROR</h2><p style="color:#ccc;">Token no encontrado o inválido. Por favor, usa el enlace enviado a tu correo.</p>';
        }
        return;
    }

    // Usar el ID correcto del HTML: 'resetForm'
    const resetForm = document.getElementById('resetForm');

    // 2. Asegurarse de que el formulario existe
    if (!resetForm) {
        console.error("Error JS: Elemento con ID 'resetForm' no encontrado.");
        return;
    }

    // 3. Manejo del envío del formulario
    resetForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;

        // Validaciones de frontend
        if (newPassword !== confirmPassword) {
            mostrarAlerta('Las contraseñas no coinciden.', 'error');
            return;
        }

        if (newPassword.length < 6) {
            mostrarAlerta('La nueva contraseña debe tener al menos 6 caracteres.', 'advertencia');
            return;
        }

        // Deshabilitar el botón para evitar envíos múltiples
        const submitButton = resetForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Procesando...';

        try {
            const response = await fetch('/api/resetPassword', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, newPassword })
            });

            // 1. Éxito: Código de respuesta 200-299
            if (response.ok) {
                const data = await response.json();

                mostrarAlerta('¡Contraseña restablecida con éxito! Serás redirigido.', 'exito');

                setTimeout(() => {
                    window.location.href = '/pages/auth/login/login.html';
                }, 2000);

            } else {
                // 2. Fallo HTTP: Código de respuesta 4xx o 5xx
                let errorMessage = 'Error desconocido al restablecer la contraseña.';
                let status = response.status;

                try {
                    // Intenta leer el JSON que *debería* enviar el backend
                    const data = await response.json();
                    errorMessage = data.message;
                } catch (e) {
                    // Si el servidor falla y no devuelve JSON (e.g., error de servidor genérico 500)
                    errorMessage = `Error del servidor (${status}). Respuesta inesperada.`;
                }

                // Mostrar el error específico
                mostrarAlerta(`Fallo al restablecer: ${errorMessage}`, 'error');
            }

        } catch (error) {
            console.error('API Error:', error);
            // Error de conexión (red, DNS, CORS)
            mostrarAlerta('Error de red: No se pudo conectar al servidor. Intenta de nuevo.', 'error');
        } finally {
            // Habilitar el botón de nuevo en caso de error
            submitButton.disabled = false;
            submitButton.textContent = 'Restablecer Contraseña';
        }
    });
});