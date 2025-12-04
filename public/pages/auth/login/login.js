document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("loginForm");
    const forgotPasswordLink = document.getElementById("forgotPasswordLink");
    const emailRequestForm = document.getElementById("emailRequestForm");
    const sendResetEmailBtn = document.getElementById("sendResetEmailBtn");
    const resetEmailInput = document.getElementById("resetEmail");

    // Elementos para el toggle de contraseña
    const passwordInput = document.getElementById("password");
    const togglePassword = document.getElementById("togglePassword");

    const mostrarAlerta = window.mostrarAlerta;

    // --- Toggle de contraseña ---
    if (passwordInput && togglePassword) {
        togglePassword.addEventListener("click", () => {
            const type = passwordInput.getAttribute("type") === "password" ? "text" : "password";
            passwordInput.setAttribute("type", type);

            togglePassword.classList.toggle("bi-eye");
            togglePassword.classList.toggle("bi-eye-slash");
        });
    }

    // --- Login ---
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

                // ⭐⭐ GUARDAR club_id TAMBIÉN ⭐⭐
                sessionStorage.setItem("usuario", JSON.stringify({
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    club_id: user.club_id ?? null,   // << AÑADIDO
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

    // --- Olvidé mi contraseña ---
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

                let result;
                try {
                    result = await res.json();
                } catch {
                    result = { message: "Respuesta del servidor no válida." };
                }

                if (res.ok) {
                    mostrarAlerta("Se ha enviado un enlace de restablecimiento. Revisa tu bandeja de entrada y spam.", "exito");
                    emailRequestForm.style.display = "none";
                    resetEmailInput.value = "";
                } else if (res.status === 404) {
                    mostrarAlerta(result.message || "El correo ingresado no existe.", "error");
                } else {
                    mostrarAlerta(result.message || `Error del servidor (${res.status}).`, "error");
                }
            } catch (err) {
                console.error("Error al solicitar restablecimiento:", err);
                mostrarAlerta("Error de conexión con el servidor.", "error");
            } finally {
                sendResetEmailBtn.disabled = false;
                sendResetEmailBtn.textContent = "Enviar Enlace";
            }
        });
    }
});
