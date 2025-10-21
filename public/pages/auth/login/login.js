document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");

  if (!loginForm) {
    console.error("❌ No se encontró el formulario con id 'loginForm'");
    return;
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Obtenemos los inputs de forma segura
    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");

    if (!emailInput || !passwordInput) {
      alert("Error interno: no se encontraron los campos del formulario.");
      return;
    }

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email || !password) {
      alert("⚠️ Por favor, completa todos los campos.");
      return;
    }

    try {
      const res = await fetch("/api/loginUser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      // Verificar si la respuesta es válida antes de intentar parsear
      const text = await res.text();
      let result;

      try {
        result = JSON.parse(text);
      } catch {
        console.error("❌ Error al parsear la respuesta del servidor:", text);
        alert("Error en el servidor (respuesta no válida).");
        return;
      }

      console.log("📩 Respuesta del servidor:", result);

      if (result.success) {
        const usuario = result.user;

        // Guardamos usuario completo en localStorage (incluye rol)
        localStorage.setItem("usuario", JSON.stringify(usuario));

        // Mostramos mensaje de bienvenida
        alert(`👋 Bienvenido, ${usuario.name}!`);

        // Redirigir según el rol
        if (usuario.role === "admin") {
          window.location.href = "/pages/admin/dashboard.html";
        } else {
          window.location.href = "/index.html";
        }
      } else {
        alert("❌ " + (result.message || "Error en el inicio de sesión."));
      }
    } catch (error) {
      console.error("💥 Error en login:", error);
      alert("Error en la conexión con el servidor.");
    }
  });
});
