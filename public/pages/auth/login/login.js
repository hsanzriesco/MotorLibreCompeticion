import { showAlert } from "../../../js/alert.js";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("login-form");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = form.email.value.trim();
    const password = form.password.value.trim();

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (data.success) {
        localStorage.setItem("usuario", JSON.stringify(data.usuario));
        showAlert(`Bienvenido, ${data.usuario.role === "admin" ? "Administrador" : data.usuario.name}!`, "success");

        setTimeout(() => {
          window.location.href = data.usuario.role === "admin"
            ? "../../dashboard/admin/admin.html"
            : "../../dashboard/user/user.html";
        }, 2000);
      } else {
        showAlert(data.message || "Credenciales incorrectas", "error");
      }
    } catch (error) {
      console.error(error);
      showAlert("Error del servidor", "error");
    }
  });
});
