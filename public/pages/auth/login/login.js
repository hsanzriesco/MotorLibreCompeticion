document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();

    try {
      const res = await fetch("https://motor-libre-competicion.vercel.app/api/loginUser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (data.success) {
        localStorage.setItem("username", data.user.username);
        alert(`✅ Bienvenido ${data.user.username}`);
        window.location.href = "/index.html";
      } else {
        alert("⚠️ " + data.message);
      }
    } catch (err) {
      console.error(err);
      alert("❌ Error al conectar con el servidor");
    }
  });
});
