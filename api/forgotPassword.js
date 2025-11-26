// login.js
document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("loginForm");
    const forgotPasswordLink = document.getElementById("forgotPasswordLink");
    const emailRequestForm = document.getElementById("emailRequestForm");
    const sendResetEmailBtn = document.getElementById("sendResetEmailBtn");
    const resetEmailInput = document.getElementById("resetEmail");

    function mostrarAlerta(message, type) {
        console.log(`[ALERTA ${type.toUpperCase()}]: ${message}`);
        // Implementación real de la alerta...
    }

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

    if (forgotPasswordLink && emailRequestForm && sendResetEmailBtn) {

        forgotPasswordLink.addEventListener("click", (e) => {
            e.preventDefault();
            emailRequestForm.style.display = emailRequestForm.style.display === "none" ? "block" : "none";
        });

        sendResetEmailBtn.addEventListener("click", async () => {
            const email = resetEmailInput.value.trim();

            if (!email) {
                mostrarAlerta("Por favor, introduce tu correo electrónico.", "aviso");
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

                // **LEEMOS EL CUERPO UNA SOLA VEZ**
                const responseBody = await res.text();

                if (res.ok) { // Éxito (Códigos 200-299)
                    mostrarAlerta("Email enviado, revisa la bandeja de spam", "exito");
                    emailRequestForm.style.display = "none";
                    resetEmailInput.value = "";
                } else { // Error (4xx, 5xx)
                    let errorMessage = "Error al solicitar el restablecimiento. Inténtalo más tarde.";

                    try {
                        // 1. Intentamos analizar el cuerpo que ya leímos como JSON (para errores 400 controlados)
                        const errorData = JSON.parse(responseBody);
                        errorMessage = errorData.message || errorMessage;
                    } catch (e) {
                        // 2. Si falla el análisis JSON, asumimos que es el error HTML/texto del servidor (500 no controlado)
                        console.error(`Respuesta de error no es JSON (Status: ${res.status}):`, responseBody);
                        errorMessage = `Error interno del servidor (${res.status}). Revisa los logs de Vercel.`;
                    }

                    mostrarAlerta(errorMessage, "error");
                }
            } catch (err) {
                console.error("Error de conexión al solicitar restablecimiento:", err);
                mostrarAlerta("Error de conexión con el servidor.", "error");
            } finally {
                sendResetEmailBtn.disabled = false;
                sendResetEmailBtn.textContent = "Enviar Enlace";
            }
        });
    }
});