document.addEventListener("DOMContentLoaded", () => {
    // Referencias a elementos del DOM
    const form = document.getElementById("resetPasswordForm");
    const newPasswordInput = document.getElementById("newPassword");
    const confirmPasswordInput = document.getElementById("confirmPassword");

    // Utilizamos la función global 'mostrarAlerta' de alertas.js
    // Nota: Asume que '../../../js/alertas.js' define esta función globalmente.
    const mostrarAlerta = window.mostrarAlerta;

    // 1. Obtener el token de la URL
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (!token) {
        mostrarAlerta("Token de restablecimiento no encontrado. Asegúrate de usar el enlace completo enviado a tu email.", "error");
        // Ocultar el formulario si no hay token
        if (form) form.style.display = 'none';
        return;
    }

    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();

            const newPassword = newPasswordInput.value.trim();
            const confirmPassword = confirmPasswordInput.value.trim();

            // 2. Validación de campos
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

                // --- MANEJO DE RESPUESTA MEJORADO ---
                // Leemos siempre el cuerpo como texto para manejar errores no JSON (como 500)
                const responseBody = await res.text();
                let result = {};

                // Si el status es 2xx, o si esperamos JSON (4xx que controlamos), intentamos parsear
                if (res.ok || (responseBody && res.headers.get('content-type')?.includes('application/json'))) {
                    try {
                        result = JSON.parse(responseBody);
                    } catch (e) {
                        // El servidor devolvió algo que no es JSON a pesar del status esperado
                        console.error("Error al parsear JSON:", e, "Respuesta:", responseBody);
                        mostrarAlerta(`Error de formato de respuesta del servidor (${res.status}).`, "error");
                        return;
                    }
                }

                if (res.ok) {
                    // Éxito (Status 200-299)
                    mostrarAlerta(result.message || "¡Contraseña restablecida con éxito! Serás redirigido al inicio de sesión.", "exito");

                    // 4. Limpiar campos antes de redirigir
                    newPasswordInput.value = '';
                    confirmPasswordInput.value = '';

                    // Redirigir al login después de un breve retraso
                    setTimeout(() => {
                        window.location.href = "../login/login.html";
                    }, 2000);

                } else {
                    // Fallo (Status 4xx o 5xx)
                    const errorMessage = result.message || `Error del servidor (${res.status}). Revisa los logs de Vercel.`;
                    mostrarAlerta(errorMessage, "error");
                }
                // --- FIN MANEJO DE RESPUESTA MEJORADO ---

            } catch (err) {
                console.error("Error de conexión al restablecer la contraseña:", err);
                mostrarAlerta("Error de conexión con el servidor. Por favor, inténtalo más tarde.", "error");
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = "Actualizar Contraseña";
            }
        });
    }
});