document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('reset-password-form');
    const newPasswordInput = document.getElementById('new-password');
    const confirmPasswordInput = document.getElementById('confirm-password');
    const messageArea = document.getElementById('message-display'); // Usamos el ID de tu HTML

    // 1. Obtener el token de la URL
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    // Función auxiliar para mostrar mensajes
    const displayMessage = (message, isError = false) => {
        messageArea.textContent = message;
        messageArea.style.display = 'block';
        // Usamos estilos inline básicos ya que el CSS de la página es más complejo
        messageArea.style.color = isError ? '#e50914' : '#4CAF50';
        messageArea.style.fontWeight = 'bold';
        messageArea.style.textAlign = 'center';
        messageArea.style.marginTop = '20px';
    };

    if (!token) {
        displayMessage('Error: Enlace de restablecimiento inválido o faltante.', true);
        form.style.display = 'none';
        return;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const newPassword = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;
        
        // 2. Validación local
        if (newPassword.length < 6) {
            displayMessage('La contraseña debe tener al menos 6 caracteres.', true);
            return;
        }
        
        if (newPassword !== confirmPassword) {
            displayMessage('Las contraseñas no coinciden.', true);
            return;
        }
        
        displayMessage('Actualizando contraseña...', false); 

        // Deshabilitar botón mientras se procesa
        const submitButton = form.querySelector('button');
        submitButton.disabled = true;
        const originalButtonText = submitButton.textContent;
        submitButton.textContent = 'Procesando...';

        try {
            // 3. Enviar datos al endpoint del servidor
            // La ruta es /api/resetPassword (ubicado en la raíz/api/resetPassword.js)
            const apiUrl = "/api/resetPassword"; 
            const res = await fetch(apiUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, newPassword }),
            });

            const data = await res.json();

            if (res.ok && data.success) {
                displayMessage('¡Contraseña restablecida con éxito! Redirigiendo...', false);
                
                // Redirigir al usuario al login después de 2.5 segundos
                setTimeout(() => {
                    // Asume que la página de login está en '../login/login.html'
                    window.location.href = "../login/login.html"; 
                }, 2500);

            } else {
                // Mostrar mensaje de error del servidor (token expirado/inválido)
                displayMessage(data.message || 'Error al restablecer. El enlace pudo haber expirado o es inválido.', true);
                
                // Si falla por token, ocultamos el formulario para evitar reintentos inútiles
                if (data.message && (data.message.includes('expirado') || data.message.includes('inválido'))) {
                    form.style.display = 'none';
                }
            }
        } catch (error) {
            console.error("Error en la petición:", error);
            displayMessage('Error de conexión con el servidor. Inténtalo más tarde.', true);
        } finally {
            // Restaurar el botón solo si el formulario no fue ocultado
            if (form.style.display !== 'none') {
                submitButton.disabled = false;
                submitButton.textContent = originalButtonText;
            }
        }
    });
});