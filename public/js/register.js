document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("registerForm");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    try {
      const res = await fetch("/api/createUser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (data.success) {
        alert(`Usuario ${data.user.username} creado correctamente.`);
        window.location.href = "../login/login.html";
      } else {
        alert(`Error: ${data.message}`);
      }
    } catch (err) {
      console.error("Error al conectar:", err);
      alert("No se pudo conectar al servidor.");
    }
  });
});
