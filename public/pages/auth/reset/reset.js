document.addEventListener("DOMContentLoaded", () => {
    // Referencias a elementos del DOM
    const form = document.getElementById("resetPasswordForm");
    const newPasswordInput = document.getElementById("newPassword");
    const confirmPasswordInput = document.getElementById("confirmPassword");

    // Utilizamos la función global 'mostrarAlerta' de alertas.js
    const mostrarAlerta = window.mostrarAlerta;

    // 1. Obtener el token de la URL
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (!token) {
        // Alerta de error si no hay token en la URL
        mostrarAlerta("Token de restablecimiento no encontrado. Asegúrate de usar el enlace completo enviado a tu email.", "error");
        if (form) form.style.display = 'none'; 
        return;
    }

    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();

            const newPassword = newPasswordInput.value.trim();
            const confirmPassword = confirmPasswordInput.value.trim();

            // 2. Validación de campos (Usa 'aviso')
            if (!newPassword || !confirmPassword) {
                mostrarAlerta("Por favor, completa ambos campos de contraseña.", "aviso");
                return;
            }

            if (newPassword !== confirmPassword) {
                mostrarAlerta("Las contraseñas no coinciden. Por favor, revísalas.", "aviso");
                return;
            }

            if (newPassword.length < 8) {
                mostrarAlerta("La contraseña debe tener al menos 8 caracteres.", "aviso");
                return;
            }

            const submitButton = form.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = "Actualizando...";

            try {
                // 3. Enviar el token y la nueva contraseña al endpoint del backend
                const res = await fetch("/api/resetPassword", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ token, newPassword }),
                });

                // Lógica robusta para manejar JSON o texto plano (para evitar el SyntaxError)
                const responseBody = await res.text();
                let result = {};

                if (responseBody) {
                    try {
                        result = JSON.parse(responseBody);
                    } catch (e) {
                        // El servidor devolvió algo que NO era JSON (ej. 500 crudo)
                        console.error("Error al parsear JSON:", e, "Respuesta:", responseBody);
                        mostrarAlerta(`Error del servidor (${res.status}). Respuesta inesperada.`, "error");
                        return; 
                    }
                }

                if (res.ok) {
                    // Éxito (Status 200-299)
                    // Utiliza el tipo 'exito'
                    mostrarAlerta(result.message || "¡Contraseña restablecida con éxito! Serás redirigido al inicio de sesión.", "exito");
                    
                    // Limpiar campos y redirigir
                    newPasswordInput.value = '';
                    confirmPasswordInput.value = '';
                    
                    setTimeout(() => {
                        window.location.href = "../login/login.html";
                    }, 2000);
                    
                } else {
                    // Fallo (Status 4xx o 5xx)
                    // Utiliza el tipo 'error'
                    const errorMessage = result.message || `Error del servidor (${res.status}). Por favor, inténtalo de nuevo.`;
                    mostrarAlerta(errorMessage, "error");
                }

            } catch (err) {
                // Fallo de conexión de red (No se pudo llegar al servidor)
                console.error("Error de conexión al restablecer la contraseña:", err);
                mostrarAlerta("Error de conexión con el servidor. Por favor, inténtalo más tarde.", "error");
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = "Actualizar Contraseña";
            }
        });
    }
});