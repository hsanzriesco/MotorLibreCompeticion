// login.js
document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("loginForm");
    const forgotPasswordLink = document.getElementById("forgotPasswordLink");
    const emailRequestForm = document.getElementById("emailRequestForm");
    const sendResetEmailBtn = document.getElementById("sendResetEmailBtn");
    const resetEmailInput = document.getElementById("resetEmail");

    const passwordInput = document.getElementById("password");
    const togglePassword = document.getElementById("togglePassword");

    // Asumimos que esta función está definida en otro script global
    const mostrarAlerta = window.mostrarAlerta;

    // Mostrar / ocultar contraseña
    if (passwordInput && togglePassword) {
        togglePassword.addEventListener("click", () => {
            const type = passwordInput.getAttribute("type") === "password" ? "text" : "password";
            passwordInput.setAttribute("type", type);
            togglePassword.classList.toggle("bi-eye");
            togglePassword.classList.toggle("bi-eye-slash");
        });
    }

    // Login
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
                // Llamada al API de login
                const res = await fetch("/api/users?action=login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username, password }),
                });

                const raw = await res.text();
                let result;

                try {
                    result = JSON.parse(raw);
                } catch {
                    mostrarAlerta("Error inesperado del servidor. Respuesta no JSON.", "error");
                    return;
                }

                if (!result.success) {
                    mostrarAlerta(result.message || "Credenciales incorrectas.", "error");
                    return;
                }

                const user = result.user;
                const token = result.token;

                // ⭐⭐ VERIFICACIÓN DE DATOS ESENCIALES ⭐⭐
                if (!token || !user || !user.role) {
                    console.error("Falta token o rol en la respuesta del servidor.");
                    mostrarAlerta("Error de sesión: Falta información clave del usuario.", "error");
                    return;
                }

                const userData = {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    club_id: user.club_id || null,
                };

                const userDataString = JSON.stringify(userData);

                // Guardar la sesión en SESSIONSTORAGE (usado por users.js)
                sessionStorage.setItem("token", token);
                sessionStorage.setItem("role", user.role);
                sessionStorage.setItem("usuario", userDataString);

                // Limpiar LOCALSTORAGE para evitar conflictos si no se usa persistencia
                localStorage.clear();

                mostrarAlerta(`Bienvenido, ${user.name}!`, "exito");

                // 🟢 CORRECCIÓN DE RUTAS DE REDIRECCIÓN A ABSOLUTAS (desde la raíz /)
                setTimeout(() => {
                    if (user.role === "admin") {
                        // Redirigir a la página de gestión de usuarios (asumiendo que es la ruta deseada)
                        window.location.href = "/dashboard/admin/users.html";
                    } else {
                        // Redirigir al índice para usuarios normales
                        window.location.href = "/index.html";
                    }
                }, 1200);

            } catch (err) {
                console.error(err);
                mostrarAlerta("Error de conexión con el servidor.", "error");
            }
        });
    }

    // Olvidé mi contraseña (no modificado)
    if (forgotPasswordLink && emailRequestForm && sendResetEmailBtn) {

        forgotPasswordLink.addEventListener("click", (e) => {
            e.preventDefault();
            emailRequestForm.style.display =
                emailRequestForm.style.display === "none" ? "block" : "none";
        });

        sendResetEmailBtn.addEventListener("click", async () => {
            const email = resetEmailInput.value.trim();

            if (!email) {
                mostrarAlerta("Por favor, introduce tu correo electrónico.", "aviso");
                return;
            }

            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                mostrarAlerta("Formato de email inválido.", "aviso");
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

                let result;
                try {
                    result = await res.json();
                } catch {
                    result = { message: "Respuesta del servidor no válida." };
                }

                if (res.ok) {
                    mostrarAlerta("Se ha enviado un enlace de restablecimiento.", "exito");
                    emailRequestForm.style.display = "none";
                    resetEmailInput.value = "";
                } else {
                    mostrarAlerta(result.message, "error");
                }

            } catch (err) {
                console.error("Error:", err);
                mostrarAlerta("Error de conexión con el servidor.", "error");
            } finally {
                sendResetEmailBtn.disabled = false;
                sendResetEmailBtn.textContent = "Enviar Enlace";
            }
        });
    }
});