document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('reset-password-form');
    const newPasswordInput = document.getElementById('new-password');
    const confirmPasswordInput = document.getElementById('confirm-password');
    // messageArea se usará solo como fallback si 'mostrarAlerta' no está disponible
    const messageArea = document.getElementById('message-display'); 

    // 1. Obtener el token de la URL
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    // Función unificada para mostrar mensajes usando mostrarAlerta o fallback
    const showAppAlert = (message, type) => {
        // Verifica si la función global 'mostrarAlerta' existe (cargada desde alertas.js)
        if (typeof mostrarAlerta === 'function') {
            mostrarAlerta(message, type);
            // Si usamos la alerta flotante, ocultamos el div de fallback.
            messageArea.style.display = 'none'; 
        } else {
            // Fallback: usar el div #message-display
            messageArea.textContent = message;
            messageArea.style.display = 'block';
            messageArea.style.color = (type === 'error' || type === 'advertencia') ? '#e50914' : '#4CAF50';
            messageArea.style.fontWeight = 'bold';
            messageArea.style.textAlign = 'center';
            messageArea.style.marginTop = '20px';
        }
    };
    
    if (!token) {
        // Usar la alerta de error al cargar la página si falta el token
        showAppAlert('Error: Enlace de restablecimiento inválido o faltante.', 'error');
        form.style.display = 'none';
        return;
    }
    
    // Ocultar el messageArea inicial
    messageArea.style.display = 'none';

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const newPassword = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;
        
        // 2. Validación local
        if (newPassword.length < 6) {
            showAppAlert('La contraseña debe tener al menos 6 caracteres.', 'error');
            return;
        }
        
        if (newPassword !== confirmPassword) {
            showAppAlert('Las contraseñas no coinciden.', 'error');
            return;
        }
        
        showAppAlert('Actualizando contraseña...', 'info'); 

        // Deshabilitar botón mientras se procesa
        const submitButton = form.querySelector('button');
        submitButton.disabled = true;
        const originalButtonText = submitButton.textContent;
        submitButton.textContent = 'Procesando...';

        try {
            // 3. Enviar datos al endpoint del servidor
            const apiUrl = "/api/resetPassword"; 
            const res = await fetch(apiUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, newPassword }),
            });

            const data = await res.json();

            if (res.ok && data.success) {
                showAppAlert('¡Contraseña restablecida con éxito! Redirigiendo...', 'exito');
                
                // CORRECCIÓN CLAVE: Limpiar sessionStorage
                // Esto elimina cualquier dato guardado que pueda interferir con el login.
                try {
                    sessionStorage.clear();
                    console.log("sessionStorage limpiado para evitar persistencia de la contraseña.");
                } catch (e) {
                    console.error("Error al limpiar sessionStorage:", e);
                }
                
                // Redirigir al usuario al login después de 2.5 segundos
                setTimeout(() => {
                    // Asume que la página de login está en '../login/login.html'
                    window.location.href = "../login/login.html"; 
                }, 2500);

            } else {
                // Mostrar mensaje de error del servidor (token expirado/inválido)
                showAppAlert(data.message || 'Error al restablecer. El enlace pudo haber expirado o es inválido.', 'error');
                
                // Si falla por token, ocultamos el formulario para evitar reintentos inútiles
                if (data.message && (data.message.includes('expirado') || data.message.includes('inválido'))) {
                    form.style.display = 'none';
                }
            }
        } catch (error) {
            console.error("Error en la petición:", error);
            showAppAlert('Error de conexión con el servidor. Inténtalo más tarde.', 'error');
        } finally {
            // Restaurar el botón solo si el formulario no fue ocultado
            if (form.style.display !== 'none') {
                submitButton.disabled = false;
                submitButton.textContent = originalButtonText;
            }
        }
    });
});