document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("loginForm");
    const forgotPasswordLink = document.getElementById("forgotPasswordLink");
    const emailRequestForm = document.getElementById("emailRequestForm");
    const sendResetEmailBtn = document.getElementById("sendResetEmailBtn");
    const resetEmailInput = document.getElementById("resetEmail");

    // Función auxiliar para mostrar alertas (asumiendo que existe)
    function mostrarAlerta(message, type) {
        console.log(`[ALERTA ${type.toUpperCase()}]: ${message}`);
        // Implementación real de mostrarAlerta
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

                if (res.ok) { // res.ok es true para códigos de estado 200-299
                    // No es necesario leer el cuerpo JSON si el código 200 es suficiente
                    mostrarAlerta("Email enviado, revisa la bandeja de spam", "exito");
                    emailRequestForm.style.display = "none";
                    resetEmailInput.value = "";
                } else {
                    // Si no es ok (400, 500, etc.), intentamos leer el cuerpo para obtener el mensaje de error controlado.
                    let errorMessage = "Error al solicitar el restablecimiento. Inténtalo más tarde.";

                    try {
                        // 1. Intentamos leer el JSON devuelto por el servidor (tu 400 o 500 controlado)
                        const errorData = await res.json();
                        errorMessage = errorData.message || errorMessage;
                    } catch (e) {
                        // 2. Si falla la lectura de JSON (porque es el HTML de error de Vercel), registramos y damos un mensaje genérico.
                        const errorBody = await res.text();
                        console.error(`Respuesta de error no es JSON (Status: ${res.status}):`, errorBody);
                        errorMessage = "Error interno del servidor. Revisa los logs de Vercel.";
                    }

                    mostrarAlerta(errorMessage, "error");
                }
            } catch (err) {
                // Esto captura errores de red (p. ej., servidor totalmente caído)
                console.error("Error de conexión al solicitar restablecimiento:", err);
                mostrarAlerta("Error de conexión con el servidor.", "error");
            } finally {
                sendResetEmailBtn.disabled = false;
                sendResetEmailBtn.textContent = "Enviar Enlace";
            }
        });
    }
});