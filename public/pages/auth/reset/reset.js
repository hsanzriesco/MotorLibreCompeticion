function getTokenFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('token');
}

document.addEventListener('DOMContentLoaded', () => {
    const token = getTokenFromUrl();
    
    // 1. Buscamos el contenedor del formulario para mensajes de error.
    // NOTA: Este ID ('reset-form-container') no existe en tu HTML,
    // por lo que he añadido un fallback. Si lo añades a tu HTML, funcionará.
    const container = document.getElementById('reset-form-container'); 
    
    if (!token) {
        // Manejo del error si falta el token
        if (container) {
            container.innerHTML = '<h2>Error: Missing reset token.</h2>';
        } else {
            // Fallback si el contenedor no existe
            console.error("Error: Missing reset token. Could not find 'reset-form-container' to display message.");
            alert('Error: Missing reset token.');
        }
        return;
    }

    // 2. CORRECCIÓN PRINCIPAL: Usamos el ID correcto del formulario ('reset-password-form')
    const resetForm = document.getElementById('reset-password-form');
    
    // Verificación de seguridad para el elemento del formulario
    if (!resetForm) {
        console.error("CRITICAL ERROR: The form element with ID 'reset-password-form' was not found.");
        // Si no se encuentra el formulario, detenemos la ejecución.
        return; 
    }
    
    // Si el formulario existe, adjuntamos el escuchador de eventos
    resetForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;

        if (newPassword !== confirmPassword) {
            // Se recomienda usar tu función mostrarAlerta aquí, si está disponible.
            // Por ahora, usamos alert.
            alert('Passwords do not match.');
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
                alert('Password successfully reset! You can now log in.');
                window.location.href = '/pages/auth/login/login.html';
            } else {
                alert(`Reset failed: ${data.message}`);
            }
        } catch (error) {
            console.error('API Error:', error);
            alert('An unexpected error occurred. Please try again.');
        }
    });
});