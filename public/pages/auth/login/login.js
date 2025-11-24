document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("loginForm");

    // Elementos del formulario de restablecimiento
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

                // Guardamos la información del usuario en sessionStorage
                sessionStorage.setItem("usuario", JSON.stringify({
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    // NOTA DE SEGURIDAD: Guardar la contraseña sin hashear en sessionStorage es INSEGURO. 
                    // Se recomienda NO GUARDAR LA CONTRASEÑA en el cliente.
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

    // --- LÓGICA DE RESTABLECIMIENTO DE CONTRASEÑA ---
    if (forgotPasswordLink && emailRequestForm && sendResetEmailBtn) {

        // 1. Mostrar/Ocultar el formulario de solicitud de email
        forgotPasswordLink.addEventListener("click", (e) => {
            e.preventDefault();
            // Alterna la visibilidad del formulario de email
            emailRequestForm.style.display = emailRequestForm.style.display === "none" ? "block" : "none";
        });

        // 2. Manejar el envío del email de restablecimiento
        sendResetEmailBtn.addEventListener("click", async () => {
            const email = resetEmailInput.value.trim();

            if (!email) {
                mostrarAlerta("Por favor, introduce tu correo electrónico.", "aviso");
                return;
            }

            // Deshabilitar botón
            sendResetEmailBtn.disabled = true;
            sendResetEmailBtn.textContent = "Enviando...";

            try {
                const res = await fetch("/api/forgotPassword", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email }),
                });

                // 3. Manejar la respuesta (siempre mensaje genérico por seguridad)
                if (res.ok || res.status === 200) {
                    mostrarAlerta("Si el correo está registrado, recibirás un enlace de restablecimiento en breve. Revisa tu bandeja de spam.", "exito");
                    emailRequestForm.style.display = "none";
                    resetEmailInput.value = "";
                } else {
                    // Aquí manejamos errores de servidor (ej. 500)
                    const errorData = await res.json();
                    mostrarAlerta(errorData.message || "Error al solicitar el restablecimiento. Inténtalo más tarde.", "error");
                }
            } catch (err) {
                console.error("Error de conexión al solicitar restablecimiento:", err);
                mostrarAlerta("Error de conexión con el servidor.", "error");
            } finally {
                // Habilitar el botón de nuevo
                sendResetEmailBtn.disabled = false;
                sendResetEmailBtn.textContent = "Enviar Enlace";
            }
        });
    }
});