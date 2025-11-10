document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");

  let alertContainer = document.querySelector(".alert-container");
  if (!alertContainer) {
    alertContainer = document.createElement("div");
    alertContainer.classList.add("alert-container");
    document.body.appendChild(alertContainer);
  }

  function showAlert(message, type = "success") {
    const alert = document.createElement("div");
    alert.className = `custom-alert ${type}`;
    alert.textContent = message;
    alertContainer.appendChild(alert);

    setTimeout(() => alert.classList.add("visible"), 50);
    setTimeout(() => {
      alert.classList.remove("visible");
      setTimeout(() => alert.remove(), 400);
    }, 3000);
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!username || !password) {
      showAlert("Todos los campos son obligatorios.", "error");
      return;
    }

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const result = await res.json();

      if (res.status === 401) {
        showAlert("Nombre de usuario o contraseña incorrectos.", "error");
        return;
      }

      if (result.success) {
        showAlert("Inicio de sesión exitoso.", "success");

        // Guardamos el usuario en localStorage (nombre)
        localStorage.setItem("user", JSON.stringify(result.user));

        // Redirigir según el tipo de usuario
        setTimeout(() => {
          if (result.user.role === "admin") {
            window.location.href = "../../admin/admin.html";
          } else {
            window.location.href = "../../user/user.html";
          }
        }, 1200);
      } else {
        showAlert(result.message || "Error al iniciar sesión.", "error");
      }
    } catch (err) {
      console.error(err);
      showAlert("Error al conectar con el servidor.", "error");
    }
  });
});
