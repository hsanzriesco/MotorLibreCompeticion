document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("loginForm");
    if (!form) return;

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

            // Guardamos contraseña también
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
});