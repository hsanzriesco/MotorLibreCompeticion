document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("loginForm");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const usernameInput = document.getElementById("username");
        const passwordInput = document.getElementById("password");

        if (!usernameInput || !passwordInput) {
            console.error("No se encontraron los campos del formulario.");
            return;
        }

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

            const text = await res.text();
            let result;
            try {
                result = JSON.parse(text);
            } catch {
                console.error("Respuesta no JSON:", text);
                mostrarAlerta("Error inesperado del servidor.", "error");
                return;
            }

            if (result.success) {
                const user = result.user;

                // 🚨 CORRECCIÓN CLAVE: Usamos localStorage para persistencia y compatibilidad con perfil.js
                // Asegúrate de que user contiene {id, name, email}
                localStorage.setItem("usuario", JSON.stringify({
                    id: user.id,
                    name: user.name,
                    email: user.email
                }));


                mostrarAlerta(`Bienvenido, ${user.name}!`, "exito");

                // Redirección según el rol y la estructura de carpetas
                setTimeout(() => {
                    if (user.role === "admin") {
                        // RUTA CORREGIDA: Va a /pages/dashboard/admin/user/admin.html
                        window.location.href = "../../dashboard/admin/user/admin.html";
                    } else {
                        // Redirige al perfil inmediatamente después del login exitoso
                        window.location.href = "../perfil/perfil.html";
                    }
                }, 1500);
            } else {
                mostrarAlerta(result.message || "Credenciales incorrectas.", "error");
            }
        } catch (error) {
            console.error("Error en login:", error);
            mostrarAlerta("Error de conexión con el servidor.", "error");
        }
    });
});