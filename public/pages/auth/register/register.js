document.addEventListener("DOMContentLoaded", () => {
  const registerForm = document.getElementById("registerForm");

  if (!registerForm) return;

  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("username").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!name || !email || !password) {
      alert("⚠️ Por favor, completa todos los campos.");
      return;
    }

    try {
      const res = await fetch("/api/createUser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const result = await res.json();
      console.log("Respuesta del servidor:", result);

      if (result.success) {
        const nombreUsuario = result.user.name;

        // ✅ Guardar datos del usuario en localStorage
        localStorage.setItem("usuario", JSON.stringify(result.user));

        // ✅ Mostrar el mismo tipo de mensaje que en el login
        alert(`🎉 Bienvenido, ${nombreUsuario}! Tu cuenta ha sido creada correctamente.`);

        // ✅ Redirigir al index
        window.location.href = "/index.html";
      } else {
        alert("❌ " + result.message);
      }
    } catch (error) {
      console.error("Error en registro:", error);
      alert("❌ Error en el servidor. Inténtalo nuevamente.");
    }
  });
});
