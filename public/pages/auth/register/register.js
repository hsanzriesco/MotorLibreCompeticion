document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("registerForm");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("username").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    console.log("Datos enviados:", { name, email, password }); // 👈 Verifica en consola

    try {
      const res = await fetch("/api/createUser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const result = await res.json();
      console.log("Respuesta del servidor:", result); // 👈 Verifica también esto

      if (result.success) {
        alert("✅ Usuario creado con éxito");
        window.location.href = "../login/login.html";
      } else {
        alert("⚠️ " + result.message);
      }
    } catch (err) {
      alert("❌ Error al conectar con el servidor");
      console.error(err);
    }
  });
});
