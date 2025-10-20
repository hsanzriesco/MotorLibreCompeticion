document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("registerForm");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();

    try {
      const res = await fetch("https://motor-libre-competicion.vercel.app/api/createUser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (data.success) {
        alert("✅ Registro exitoso. Redirigiendo...");
        setTimeout(() => window.location.href = "../login/login.html", 1500);
      } else {
        alert("⚠️ " + data.message);
      }
    } catch (err) {
      console.error(err);
      alert("❌ Error al conectar con el servidor");
    }
  });
});
