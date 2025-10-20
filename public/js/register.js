document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("registerForm");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();

    try {
      const res = await fetch("/api/createUser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const result = await res.json();

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
