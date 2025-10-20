document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");

  if (!form) {
    console.error("login.js - no se encontró el formulario #loginForm");
    return;
  }

  // Buscar inputs una sola vez
  const inputEmail = document.getElementById("email");
  const inputPassword = document.getElementById("password");

  if (!inputEmail || !inputPassword) {
    console.error("login.js - faltan inputs con id 'email' o 'password' en el HTML");
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Leer valores de forma segura
    const email = (inputEmail.value || "").trim();
    const password = (inputPassword.value || "").trim();

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

      let result;
      try {
        result = await res.json();
      } catch (err) {
        console.error("Respuesta no JSON del servidor:", err);
        alert("Respuesta inesperada del servidor.");
        return;
      }

      console.log("Respuesta del servidor:", result);

      if (res.ok && result.success) {
        const nombreUsuario = result.user?.name || result.user?.username || "Usuario";
        localStorage.setItem("usuario", JSON.stringify(result.user));
        // Mensaje bonito en vez de alert (puedes cambiar por modal)
        alert(`👋 Bienvenido, ${nombreUsuario}!`);
        window.location.href = "/index.html";
      } else {
        alert("❌ " + (result.message || "Error al iniciar sesión"));
      }
    } catch (error) {
      console.error("Error en login:", error);
      alert("Error al conectar con el servidor.");
    }
  });
});
