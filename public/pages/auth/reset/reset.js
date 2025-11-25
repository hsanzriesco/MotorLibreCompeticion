// La función mostrarAlerta se asume que está definida en alertas.js

function getTokenFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('token');
}

document.addEventListener('DOMContentLoaded', () => {
    // 1. Verificar el token de restablecimiento
    const token = getTokenFromUrl();
    if (!token) {
        // Mostrar alerta de error permanente y modificar la caja del formulario
        mostrarAlerta('Error: Falta el token de restablecimiento en la URL.', 'error', 0);

        const formBox = document.querySelector('.form-box');
        if (formBox) {
            formBox.innerHTML = '<h2 style="color:#e50914;">ERROR</h2><p style="color:#ccc;">Token no encontrado. Por favor, usa el enlace enviado a tu correo.</p>';
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

        // Validar que las contraseñas coincidan
        if (newPassword !== confirmPassword) {
            mostrarAlerta('Las contraseñas no coinciden.', 'error');
            return;
        }

        // Validación básica de longitud
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

            // 1. Verificar si la respuesta fue un éxito (código 200-299)
            if (response.ok) {
                const data = await response.json();

                mostrarAlerta('¡Contraseña restablecida con éxito! Serás redirigido.', 'exito');

                setTimeout(() => {
                    window.location.href = '/pages/auth/login/login.html';
                }, 2000);

            } else {
                // 2. Manejar Fallo HTTP (400, 401, 500, etc.)
                // Intentamos leer el mensaje de error del backend (asumimos que devuelve JSON)
                let errorMessage = 'Error desconocido al restablecer la contraseña.';
                try {
                    const data = await response.json();
                    errorMessage = data.message;
                } catch (e) {
                    // Si el servidor devuelve un error 500 que NO ES JSON
                    errorMessage = `Error del servidor (${response.status}). Respuesta inesperada.`;
                }

                mostrarAlerta(`Fallo al restablecer: ${errorMessage}`, 'error');
            }

        } catch (error) {
            console.error('API Error:', error);
            mostrarAlerta('Error de red: No se pudo conectar al servidor. Intenta de nuevo.', 'error');
        }
    });
});