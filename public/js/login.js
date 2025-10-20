document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  try {
    const res = await fetch("/api/loginUser", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();

    if (res.ok) {
      alert(`Bienvenido ${data.username}`);
      window.location.href = "/public/index.html";
    } else {
      alert(data.message || "Error al iniciar sesión");
    }
  } catch (err) {
    console.error("Error:", err);
    alert("Ocurrió un error al conectar con el servidor");
  }
});
