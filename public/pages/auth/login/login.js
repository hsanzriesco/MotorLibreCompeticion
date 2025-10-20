document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");

  if (!form) {
    console.error("Formulario login no encontrado");
    return;
  }

  const inputEmail = document.getElementById("email");
  const inputPassword = document.getElementById("password");

  if (!inputEmail || !inputPassword) {
    console.error("Campos de login faltantes en el HTML");
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = inputEmail.value.trim();
    const password = inputPassword.value.trim();

    if (!email || !password) {
      alert("Por favor, completa todos los campos.");
      return;
    }

    try {
      const res = await fetch("/api/loginUser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const result = await res.json();
      console.log("Respuesta del servidor:", result);

      if (res.ok && result.success) {
        const nombreUsuario = result.user.name || "Usuario";

        // Guarda el usuario en localStorage
        localStorage.setItem("usuario", JSON.stringify(result.user));

        // Muestra bienvenida
        alert(`👋 Bienvenido, ${nombreUsuario}!`);

        // Redirige al index
        window.location.href = "/index.html";
      } else {
        alert("❌ " + (result.message || "Credenciales incorrectas"));
      }
    } catch (error) {
      console.error("Error en login:", error);
      alert("Error al conectar con el servidor.");
    }
  });
});
