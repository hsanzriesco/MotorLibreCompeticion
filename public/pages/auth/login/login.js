document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");

  if (!form || !emailInput || !passwordInput) {
    console.error("Formulario o campos no encontrados en el DOM");
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

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

      const text = await res.text();
      console.log("Respuesta del servidor (texto):", text);

      // Intentar convertir a JSON
      let result;
      try {
        result = JSON.parse(text);
      } catch (err) {
        throw new Error("Respuesta del servidor no es JSON válido");
      }

      if (res.ok && result.success) {
        localStorage.setItem("usuario", JSON.stringify(result.user));
        alert(`👋 Bienvenido, ${result.user.name || "Usuario"}!`);
        window.location.href = "/index.html";
      } else {
        alert("❌ " + (result.message || "Credenciales incorrectas"));
      }
    } catch (error) {
      console.error("Error en login:", error);
      alert("Error en el servidor o conexión fallida.");
    }
  });
});
