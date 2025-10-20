document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

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

      if (result.success) {
        const nombreUsuario = result.user.name;

        // Guarda los datos en localStorage
        localStorage.setItem("usuario", JSON.stringify(result.user));

        // Muestra mensaje de bienvenida
        alert(`👋 Bienvenido, ${nombreUsuario}!`);

        // Redirige al usuario a la página principal
        window.location.href = "/index.html";
      } else {
        alert("❌ " + result.message);
      }
    } catch (error) {
      console.error("Error en login:", error);
      alert("Error en el servidor.");
    }
  });
});
