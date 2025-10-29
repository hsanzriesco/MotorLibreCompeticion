document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (data.success) {
        // Guarda solo en sessionStorage (no persiste tras cerrar navegador)
        sessionStorage.setItem("usuario", JSON.stringify(data.user));

        if (data.user.role === "admin") {
          window.location.href = "/pages/admin/admin.html";
        } else {
          window.location.href = "/index.html";
        }
      } else {
        alert("❌ " + data.message);
      }
    } catch (err) {
      console.error("Error al iniciar sesión:", err);
      alert("❌ Error de conexión con el servidor.");
    }
  });
});
