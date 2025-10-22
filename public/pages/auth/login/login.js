import { showToast } from "../../../js/toast.js";

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (data.success) {
      localStorage.setItem("usuario", JSON.stringify(data.user));
      showToast(`Bienvenido, ${data.user.name}!`);
      setTimeout(() => (window.location.href = "/index.html"), 1500);
    } else {
      showToast("Correo o contraseña incorrectos", "error");
    }
  } catch {
    showToast("Error al conectar con el servidor", "error");
  }
});
