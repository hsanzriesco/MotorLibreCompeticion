// /public/js/register.js
import { showToast } from "./alert.js";

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.querySelector("#login-form");
  const registerForm = document.querySelector("#register-form");

  // === LOGIN ===
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = document.querySelector("#email").value.trim();
      const password = document.querySelector("#password").value.trim();

      if (!email || !password) {
        showToast("⚠️ Completa todos los campos", "error");
        return;
      }

      try {
        const res = await fetch("/api/loginUser/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        const data = await res.json();

        if (data.success) {
          localStorage.setItem("usuario", JSON.stringify(data.user));
          showToast(`✅ Bienvenido, ${data.user.role === "admin" ? "Administrador" : data.user.name}!`, "success");
          setTimeout(() => {
            window.location.href =
              data.user.role === "admin"
                ? "/pages/dashboard/admin/admin.html"
                : "/index.html";
          }, 1500);
        } else {
          showToast(`❌ ${data.message}`, "error");
        }
      } catch {
        showToast("Error de conexión con el servidor", "error");
      }
    });
  }

  // === REGISTRO ===
  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const name = document.querySelector("#name").value.trim();
      const email = document.querySelector("#email").value.trim();
      const password = document.querySelector("#password").value.trim();

      if (!name || !email || !password) {
        showToast("⚠️ Completa todos los campos", "error");
        return;
      }

      try {
        const res = await fetch("/api/loginUser/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });

        const data = await res.json();

        if (data.success) {
          showToast("✅ Registro exitoso, redirigiendo...", "success");
          setTimeout(() => (window.location.href = "/pages/auth/login/login.html"), 1500);
        } else {
          showToast(`⚠️ ${data.message}`, "error");
        }
      } catch {
        showToast("Error de conexión con el servidor", "error");
      }
    });
  }
});
