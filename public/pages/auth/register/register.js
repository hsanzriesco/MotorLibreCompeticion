import { showToast } from "../../../js/toast.js";

document.getElementById("register-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("name").value;
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  try {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await res.json();

    if (data.success) {
      showToast("¡Usuario registrado correctamente!");
      setTimeout(() => (window.location.href = "/pages/auth/login/login.html"), 1500);
    } else {
      showToast(data.message || "Error al registrar usuario", "error");
    }
  } catch {
    showToast("Error al conectar con el servidor", "error");
  }
});
