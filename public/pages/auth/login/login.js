document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  if (!form) {
    console.error("❌ No se encontró el formulario con id='loginForm'");
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email")?.value.trim();
    const password = document.getElementById("password")?.value.trim();

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

      const result = await res.json();
      console.log("Respuesta del servidor:", result);

      if (result.success) {
        const user = result.user;
        localStorage.setItem("usuario", JSON.stringify(user));
        alert(`👋 Bienvenido, ${user.name}!`);

        // Redirección según rol
        if (user.role === "admin") {
          window.location.href = "/pages/dashboard/admin/admin.html";
        } else {
          window.location.href = "/pages/dashboard/user/user.html";
        }
      } else {
        alert("❌ " + result.message);
      }
    } catch (error) {
      console.error("Error en login:", error);
      alert("Error en el servidor.");
    }
  });
});
