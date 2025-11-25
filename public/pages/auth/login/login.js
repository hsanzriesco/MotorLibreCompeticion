document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("loginForm");
    const forgotPasswordLink = document.getElementById("forgotPasswordLink");
    const emailRequestForm = document.getElementById("emailRequestForm");
    const sendResetEmailBtn = document.getElementById("sendResetEmailBtn");
    const resetEmailInput = document.getElementById("resetEmail");

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
            // *** CAMBIO CLAVE: FORZAR VALIDACIÓN NATIVA ***
            // checkValidity() verifica si el input es válido (incluyendo type="email")
            // reportValidity() muestra el mensaje de error nativo si no es válido.
            if (!resetEmailInput.checkValidity()) {
                resetEmailInput.reportValidity();
                return; // Detiene la ejecución si la validación falla
            }

            const email = resetEmailInput.value.trim();
            const apiUrl = "/api/forgotPassword";

            // Se elimina la verificación manual de !email ya que checkValidity cubre required

            sendResetEmailBtn.disabled = true;
            sendResetEmailBtn.textContent = "Enviando...";

            try {
                const res = await fetch(apiUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email }),
                });
                
                // Intentar parsear el JSON de la respuesta
                let data = {};
                try {
                    data = await res.json();
                } catch (e) {
                    // Si no es JSON, asumir un error genérico del servidor
                    console.error("Respuesta no JSON:", await res.text());
                    mostrarAlerta("Error de servidor inesperado.", "error");
                    return;
                }


                if (res.ok || res.status === 200) {
                    // Éxito: Código 200
                    mostrarAlerta("Si el correo está registrado, recibirás un enlace de restablecimiento en breve. Revisa tu bandeja de spam.", "exito");
                    emailRequestForm.style.display = "none";
                    resetEmailInput.value = "";
                } else if (res.status === 400) {
                    // Error de validación de formato (e.g., falta @).
                    mostrarAlerta(data.message, "aviso");
                } else if (res.status === 404) {
                    // Error: Email no existe en la BD.
                    mostrarAlerta(data.message, "error");
                } else {
                    // Otros errores (500, etc.)
                    mostrarAlerta(data.message || "Error al solicitar el restablecimiento. Inténtalo más tarde.", "error");
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