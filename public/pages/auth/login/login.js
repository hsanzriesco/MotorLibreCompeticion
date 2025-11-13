document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("loginForm");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        // Cambiamos email → username
        const usernameInput = document.getElementById("username");
        const passwordInput = document.getElementById("password");

        if (!usernameInput || !passwordInput) {
            console.error("No se encontraron los campos del formulario.");
            return;
        }

        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();

        if (!username || !password) {
            // USO DE LA ALERTA GLOBAL
            mostrarAlerta("Por favor, completa todos los campos.", "aviso");
            return;
        }

        try {
            const res = await fetch("/api/loginUser", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                // Enviamos username en lugar de email
                body: JSON.stringify({ username, password }),
            });

            const text = await res.text();
            let result;
            try {
                result = JSON.parse(text);
            } catch {
                console.error("Respuesta no JSON:", text);
                // USO DE LA ALERTA GLOBAL
                mostrarAlerta("Error inesperado del servidor.", "error");
                return;
            }

            if (result.success) {
                const user = result.user;

                // 🚨 ¡CORRECCIÓN CRÍTICA!
                // Usar localStorage.setItem en lugar de sessionStorage.setItem
                // para que la sesión sea leída correctamente por perfil.js.
                // Además, aseguramos las claves 'id' y 'email' si no vienen directamente.
                localStorage.setItem("usuario", JSON.stringify({
                    id: user.id,
                    name: user.name,
                    email: user.email // Asumimos que el backend proporciona el email
                }));


                // USO DE LA ALERTA GLOBAL
                mostrarAlerta(`Bienvenido, ${user.name}!`, "exito");

                // Redirección según el rol
                setTimeout(() => {
                    if (user.role === "admin") {
                        // Cambiado a la ruta de dashboard de admin
                        window.location.href = "/pages/dashboard/admin/admin.html";
                    } else {
                        // 🚨 ¡MODIFICACIÓN!
                        // Redirigimos al perfil después del login para el usuario normal
                        // ya que la lógica de perfil está lista para gestionar esto.
                        window.location.href = "../perfil/perfil.html"; 
                    }
                }, 1500);
            } else {
                // USO DE LA ALERTA GLOBAL
                mostrarAlerta(result.message || "Credenciales incorrectas.", "error");
            }
        } catch (error) {
            console.error("Error en login:", error);
            // USO DE LA ALERTA GLOBAL
            mostrarAlerta("Error de conexión con el servidor.", "error");
        }
    });
});