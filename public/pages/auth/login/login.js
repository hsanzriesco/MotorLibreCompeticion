// login.js
document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("loginForm");
    const forgotPasswordLink = document.getElementById("forgotPasswordLink");
    const emailRequestForm = document.getElementById("emailRequestForm");
    const sendResetEmailBtn = document.getElementById("sendResetEmailBtn");
    const resetEmailInput = document.getElementById("resetEmail");

    const passwordInput = document.getElementById("password");
    const togglePassword = document.getElementById("togglePassword");

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
            // Nota: Aquí se podría añadir la comprobación de "Recuérdame" si tienes un checkbox

            const username = usernameInput.value.trim();
            const password = passwordInput.value.trim();

            if (!username || !password) {
                mostrarAlerta("Por favor, completa todos los campos.", "aviso");
                return;
            }

            try {
                // 🚀 CAMBIO CLAVE AQUÍ: Se añade ?action=login para que el handler unificado sepa que debe iniciar sesión.
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
                    mostrarAlerta("Error inesperado del servidor.", "error");
                    return;
                }

                if (!result.success) {
                    mostrarAlerta(result.message || "Credenciales incorrectas.", "error");
                    return;
                }

                // Asegúrate de que tu Backend devuelve: { success: true, token: '...', user: { id:..., role: '...' } }
                const user = result.user;
                const token = result.token; // 🚨 ASUMIMOS QUE EL TOKEN VIENE EN result.token

                // ⭐⭐⭐ INICIO DE LAS CORRECCIONES CLAVE ⭐⭐⭐

                if (!token || !user.role) {
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

                // 1. Guardar el token y el rol en SESSIONSTORAGE (para la sesión actual)
                sessionStorage.setItem("token", token);
                sessionStorage.setItem("role", user.role);
                sessionStorage.setItem("usuario", userDataString);

                // 2. Guardar el token, rol y usuario en LOCALSTORAGE (para persistencia)
                // 🛑 CRÍTICO: Si el usuario quiere persistencia (como en el admin), esto debe guardarse
                localStorage.setItem("token", token);
                localStorage.setItem("role", user.role);
                localStorage.setItem("usuario", userDataString);

                // ⭐⭐⭐ FIN DE LAS CORRECCIONES CLAVE ⭐⭐⭐

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
                // Asumiendo que esta API de forgotPassword.js sigue existiendo
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