import { showAlert } from "../../../js/alert.js";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("register-form");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const password = form.password.value.trim();

    try {
      const res = await fetch("/pages/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (data.success) {
        showAlert("Usuario registrado correctamente", "success");
        setTimeout(() => (window.location.href = "../login/login.html"), 2000);
      } else {
        showAlert(data.message || "Error al registrar usuario", "error");
      }
    } catch (error) {
      console.error(error);
      showAlert("Error del servidor", "error");
    }
  });
});
