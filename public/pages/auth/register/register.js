document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("registerForm");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Obtener valores del formulario
    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    // Validaciones básicas
    if (!name || !email || !password) {
      alert("⚠️ Todos los campos son obligatorios");
      return;
    }

    // Validación de formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      alert("⚠️ Ingresa un correo electrónico válido");
      return;
    }

    // Validación de contraseña mínima
    if (password.length < 8) {
      alert("⚠️ La contraseña debe tener al menos 8 caracteres");
      return;
    }

    try {
      const res = await fetch("/api/createUser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const result = await res.json();

      if (result.success) {
        alert("✅ Usuario registrado correctamente");
        // Redirige al login
        window.location.href = "../login/login.html";
      } else {
        alert("⚠️ " + (result.message || "Error al registrar el usuario"));
      }
    } catch (error) {
      console.error("❌ Error al conectar con el servidor:", error);
      alert("❌ Error al conectar con el servidor");
    }
  });
});
