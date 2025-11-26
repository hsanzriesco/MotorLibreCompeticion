document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("loginForm");
    const forgotPasswordLink = document.getElementById("forgotPasswordLink");
    const emailRequestForm = document.getElementById("emailRequestForm");
    const sendResetEmailBtn = document.getElementById("sendResetEmailBtn");
    const resetEmailInput = document.getElementById("resetEmail");

    // Utilizamos la función global 'mostrarAlerta' que se carga desde alertas.js
    const mostrarAlerta = window.mostrarAlerta;

    // --- Lógica del Formulario de Login ---
    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();

            const usernameInput = document.getElementById("username");
            const passwordInput = document.getElementById("password");

            const username = usernameInput.value.trim();
            const password = passwordInput.value.trim();

            if (!username || !password) {
                mostrarAlerta("Por favor, completa todos los campos.", "aviso");
                return;
            }

            try {
                const res = await fetch("/api/loginUser", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username, password }),
                });

                const raw = await res.text();
                let result;

                try {
                    result = JSON.parse(raw);
                } catch {
                    mostrarAlerta("Error inesperado del servidor.", "error");
                    return;
                }

                if (!result.success) {
                    mostrarAlerta(result.message || "Credenciales incorrectas.", "error");
                    return;
                }

                const user = result.user;

                sessionStorage.setItem("usuario", JSON.stringify({
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    password: password
                }));

                mostrarAlerta(`Bienvenido, ${user.name}!`, "exito");

                setTimeout(() => {
                    if (user.role === "admin") {
                        window.location.href = "../../dashboard/admin/admin.html";
                    } else {
                        window.location.href = "../../../index.html";
                    }
                }, 1200);

            } catch (err) {
                console.error(err);
                mostrarAlerta("Error de conexión con el servidor.", "error");
            }
        });
    }

    // --- Lógica de Olvidé mi Contraseña (forgotPassword) ---
    if (forgotPasswordLink && emailRequestForm && sendResetEmailBtn) {

        forgotPasswordLink.addEventListener("click", (e) => {
            e.preventDefault();
            // Alternar la visibilidad del formulario de email
            emailRequestForm.style.display = emailRequestForm.style.display === "none" ? "block" : "none";
        });

        sendResetEmailBtn.addEventListener("click", async () => {
            const email = resetEmailInput.value.trim();

            if (!email) {
                mostrarAlerta("Por favor, introduce tu correo electrónico.", "aviso");
                return;
            }
            
            // Validación básica de formato de email (opcional, pero útil)
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                 mostrarAlerta("Por favor, introduce un formato de email válido.", "aviso");
                 return;
            }

            sendResetEmailBtn.disabled = true;
            sendResetEmailBtn.textContent = "Enviando...";

            try {
                const res = await fetch("/api/forgotPassword", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email }),
                });

                // **Mejora de Seguridad/Usabilidad:** // La API (forgotPassword) DEBE devolver un 200/204, incluso si el email no existe,
                // para evitar la enumeración de usuarios. El mensaje de éxito debe ser genérico.
                if (res.ok) { 
                    // El servidor respondió correctamente (200-299)
                    mostrarAlerta("Si el email está registrado, se ha enviado un enlace de restablecimiento. Revisa tu bandeja de entrada y spam.", "exito");
                    emailRequestForm.style.display = "none";
                    resetEmailInput.value = "";
                } else { 
                    // El servidor devolvió un error (4xx, 5xx), lo cual es inesperado si la API sigue la práctica segura
                    const responseBody = await res.text();
                    let errorMessage = "Ocurrió un error inesperado al contactar con el servidor. Inténtalo más tarde.";

                    try {
                        const errorData = JSON.parse(responseBody);
                        errorMessage = errorData.message || errorMessage;
                    } catch (e) {
                        console.error(`Respuesta de error no es JSON (Status: ${res.status}):`, responseBody);
                        // Si no es JSON, asumimos un error interno del servidor no controlado (500)
                        errorMessage = `Error interno del servidor (${res.status}).`;
                    }

                    mostrarAlerta(errorMessage, "error");
                }
            } catch (err) {
                console.error("Error de conexión al solicitar restablecimiento:", err);
                mostrarAlerta("Error de conexión con el servidor. Verifica tu red.", "error");
            } finally {
                sendResetEmailBtn.disabled = false;
                sendResetEmailBtn.textContent = "Enviar Enlace";
            }
        });
    }
});