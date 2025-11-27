document.addEventListener("DOMContentLoaded", () => {
    // Referencias a elementos del DOM
    const form = document.getElementById("resetPasswordForm");
    const newPasswordInput = document.getElementById("newPassword");
    const confirmPasswordInput = document.getElementById("confirmPassword");

    // ⭐⭐ AGREGADO: Referencias para el toggle de visibilidad (asumiendo que existen en reset.html)
    const toggleNewPassword = document.getElementById("toggleNewPassword");
    const toggleConfirmPassword = document.getElementById("toggleConfirmPassword");

    // Utilizamos la función global 'mostrarAlerta' de alertas.js
    const mostrarAlerta = window.mostrarAlerta;

    // 1. Obtener el token de la URL
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (!token) {
        // Usa 'error' si el token falta en la URL
        mostrarAlerta("Token de restablecimiento no encontrado. Asegúrate de usar el enlace completo enviado a tu email.", "error");
        if (form) form.style.display = 'none';
        return;
    }

    // ⭐⭐⭐ FUNCIÓN DE VALIDACIÓN COPIADA DE register.js ⭐⭐⭐
    function validatePassword(password) {
        const lengthOK = password.length >= 8 && password.length <= 12;
        const upperCaseOK = /[A-Z]/.test(password);
        const numberOK = /[0-9]/.test(password);
        const symbolOK = /[^A-Za-z0-9]/.test(password);

        if (!lengthOK) return "La contraseña debe tener entre 8 y 12 caracteres.";
        if (!upperCaseOK) return "Debe contener al menos una letra mayúscula.";
        if (!numberOK) return "Debe incluir al menos un número.";
        if (!symbolOK) return "Debe incluir al menos un símbolo.";
        return null;
    }

    // ⭐⭐ AGREGADO: Función de toggle (copiada de register.js)
    function setupPasswordToggle(inputElement, iconElement) {
        if (!iconElement) return; // Si el icono no existe, salimos
        iconElement.addEventListener('click', () => {
            const type = inputElement.getAttribute('type') === 'password' ? 'text' : 'password';
            inputElement.setAttribute('type', type);
            iconElement.classList.toggle('bi-eye');
            iconElement.classList.toggle('bi-eye-slash');
        });
    }

    if (newPasswordInput && toggleNewPassword) {
        setupPasswordToggle(newPasswordInput, toggleNewPassword);
    }
    if (confirmPasswordInput && toggleConfirmPassword) {
        setupPasswordToggle(confirmPasswordInput, toggleConfirmPassword);
    }
    // ⭐⭐ FIN AGREGADO

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

            // ⭐⭐ AGREGADO: Validación de requisitos de contraseña
            const passwordError = validatePassword(newPassword);
            if (passwordError) {
                mostrarAlerta(passwordError, "error");
                return;
            }
            // ⭐⭐ FIN AGREGADO

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

                // Lógica robusta para evitar SyntaxError al leer la respuesta
                const responseBody = await res.text();
                let result = {};

                if (responseBody) {
                    try {
                        result = JSON.parse(responseBody);
                    } catch (e) {
                        console.error("Error al parsear JSON:", e, "Respuesta:", responseBody);
                        mostrarAlerta(`Error del servidor (${res.status}). Respuesta inesperada.`, "error");
                        return;
                    }
                }

                if (res.ok) {
                    // Éxito: Usa 'exito'
                    mostrarAlerta(result.message || "¡Contraseña restablecida con éxito! Serás redirigido al inicio de sesión.", "exito");

                    newPasswordInput.value = '';
                    confirmPasswordInput.value = '';

                    setTimeout(() => {
                        // Redirigir al login después de un breve retraso
                        window.location.href = "../login/login.html";
                    }, 2000);

                } else {
                    // Fallo del Servidor: Usa 'error'
                    const errorMessage = result.message || `Error del servidor (${res.status}). Por favor, inténtalo de nuevo.`;
                    mostrarAlerta(errorMessage, "error");
                }

            } catch (err) {
                // Fallo de Conexión: Usa 'error'
                console.error("Error de conexión al restablecer la contraseña:", err);
                mostrarAlerta("Error de conexión con el servidor. Por favor, inténtalo más tarde.", "error");
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = "Actualizar Contraseña";
            }
        });
    }
});