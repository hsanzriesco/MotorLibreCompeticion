document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("registerForm");

    // === ❌ ELIMINACIÓN DE LA LÓGICA DE ALERTA LOCAL ===
    // let alertContainer = document.querySelector(".alert-container");
    // if (!alertContainer) {
    //   alertContainer = document.createElement("div");
    //   alertContainer.classList.add("alert-container");
    //   document.body.appendChild(alertContainer);
    // }
    // function showAlert(message, type = "success") { ... }

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
        const password = document.getElementById("password").value.trim();
        const confirmPassword = document.getElementById("confirmPassword").value.trim();

        if (!name || !email || !password || !confirmPassword) {
            // USO DE LA ALERTA GLOBAL
            mostrarAlerta("Todos los campos son obligatorios.", "error"); 
            return;
        }

        if (password !== confirmPassword) {
            // USO DE LA ALERTA GLOBAL
            mostrarAlerta("Las contraseñas no coinciden.", "error");
            return;
        }

        const passwordError = validatePassword(password);
        if (passwordError) {
            // USO DE LA ALERTA GLOBAL
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
                // USO DE LA ALERTA GLOBAL
                mostrarAlerta("El nombre o correo ya están en uso.", "error");
                return;
            }

            if (result.success) {
                // USO DE LA ALERTA GLOBAL
                mostrarAlerta("🎉 Usuario creado con éxito", "exito");
                setTimeout(() => {
                    window.location.href = "../login/login.html";
                }, 1500);
            } else {
                // USO DE LA ALERTA GLOBAL
                mostrarAlerta(result.message || "Error desconocido al registrar.", "error");
            }
        } catch {
            // USO DE LA ALERTA GLOBAL
            mostrarAlerta("❌ Error al conectar con el servidor.", "error");
        }
    });
});