document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("registerForm");

    // === ELEMENTOS PARA EL TOGGLE DE CONTRASEÑA ===
    const passwordInput = document.getElementById("password");
    const confirmPasswordInput = document.getElementById("confirmPassword");
    const togglePassword = document.getElementById("togglePassword");
    const toggleConfirmPassword = document.getElementById("toggleConfirmPassword");

    // Función genérica para alternar la visibilidad
    function setupPasswordToggle(inputElement, iconElement) {
        iconElement.addEventListener('click', () => {
            // Alterna el tipo de input
            const type = inputElement.getAttribute('type') === 'password' ? 'text' : 'password';
            inputElement.setAttribute('type', type);
            
            // Alterna el icono
            iconElement.classList.toggle('bi-eye');
            iconElement.classList.toggle('bi-eye-slash');
        });
    }

    // Configurar los toggles para ambos campos
    setupPasswordToggle(passwordInput, togglePassword);
    setupPasswordToggle(confirmPasswordInput, toggleConfirmPassword);
    // ==============================================
    

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

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const name = document.getElementById("username").value.trim();
        const email = document.getElementById("email").value.trim();
        const password = passwordInput.value.trim();
        const confirmPassword = confirmPasswordInput.value.trim();

        if (!name || !email || !password || !confirmPassword) {
            // ✅ Uso de alerta global
            mostrarAlerta("Todos los campos son obligatorios.", "error"); 
            return;
        }

        if (password !== confirmPassword) {
            // ✅ Uso de alerta global
            mostrarAlerta("Las contraseñas no coinciden.", "error");
            return;
        }

        const passwordError = validatePassword(password);
        if (passwordError) {
            // ✅ Uso de alerta global
            mostrarAlerta(passwordError, "error");
            return;
        }

        try {
            const res = await fetch("/api/createUser", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, password }),
            });

            const result = await res.json();

            if (res.status === 409) {
                // ✅ Uso de alerta global
                mostrarAlerta("El nombre o correo ya están en uso.", "error");
                return;
            }

            if (result.success) {
                // ✅ Uso de alerta global
                mostrarAlerta("🎉 Usuario creado con éxito", "exito");
                setTimeout(() => {
                    window.location.href = "../login/login.html";
                }, 1500);
            } else {
                // ✅ Uso de alerta global
                mostrarAlerta(result.message || "Error desconocido al registrar.", "error");
            }
        } catch {
            // ✅ Uso de alerta global
            mostrarAlerta("❌ Error al conectar con el servidor.", "error");
        }
    });
});