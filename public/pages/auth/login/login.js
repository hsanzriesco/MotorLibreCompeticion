document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("loginForm");
    const forgotPasswordLink = document.getElementById("forgotPasswordLink");
    const emailRequestForm = document.getElementById("emailRequestForm");
    const sendResetEmailBtn = document.getElementById("sendResetEmailBtn");
    const resetEmailInput = document.getElementById("resetEmail");

    // Elementos para el toggle de contraseña
    const passwordInput = document.getElementById("password");
    const togglePassword = document.getElementById("togglePassword"); // ID del icono en el HTML

    const mostrarAlerta = window.mostrarAlerta;

    // --- Lógica del Toggle de Contraseña ---
    if (passwordInput && togglePassword) {
        togglePassword.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            // Alternar las clases de los iconos de Bootstrap
            togglePassword.classList.toggle('bi-eye');
            togglePassword.classList.toggle('bi-eye-slash');
        });
    }

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
            emailRequestForm.style.display = emailRequestForm.style.display === "none" ? "block" : "none";
        });

        sendResetEmailBtn.addEventListener("click", async () => {
            const email = resetEmailInput.value.trim();

            if (!email) {
                mostrarAlerta("Por favor, introduce tu correo electrónico.", "aviso");
                return;
            }

            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                mostrarAlerta("Por favor, introduce un formato de email válido.", "aviso");
                return;
            }

            sendResetEmailBtn.disabled = true;
            sendResetEmailBtn.textContent = "Verificando...";

            try {
                const res = await fetch("/api/forgotPassword", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email }),
                });

                // Intentamos leer el cuerpo de la respuesta, incluso si es un error.
                let result;
                try {
                    result = await res.json();
                } catch (e) {
                    result = { message: "Respuesta del servidor no válida." };
                }

                // Si el servidor responde con 200 OK (el correo existe y se envió el enlace)
                if (res.ok) {
                    mostrarAlerta("Se ha enviado un enlace de restablecimiento. Revisa tu bandeja de entrada y spam.", "exito");
                    emailRequestForm.style.display = "none";
                    resetEmailInput.value = "";
                }
                // Si el servidor responde con 404 (el correo NO existe, gracias a la modificación en el backend)
                else if (res.status === 404) {
                    const errorMessage = result.message || "El correo electrónico ingresado no se encuentra registrado.";
                    // Muestra alerta de ERROR
                    mostrarAlerta(errorMessage, "error");
                }
                // Manejo de otros errores (400, 500, etc.)
                else {
                    const errorMessage = result.message || `Error interno del servidor (${res.status}).`;
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