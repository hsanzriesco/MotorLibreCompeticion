document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("registerForm");

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

    setTimeout(() => alert.classList.add("show"), 50);
    setTimeout(() => {
      alert.classList.remove("show");
      setTimeout(() => alert.remove(), 300);
    }, 3000);
  }

  function validatePassword(password) {
    const lengthOK = password.length >= 8 && password.length <= 12;
    const upperCaseOK = /[A-Z]/.test(password);
    const numberOK = /[0-9]/.test(password);
    const symbolOK = /[^A-Za-z0-9]/.test(password);

    if (!lengthOK) return "La contraseña debe tener entre 8 y 12 caracteres.";
    if (!upperCaseOK) return "Debe contener al menos una letra mayúscula.";
    if (!numberOK) return "Debe incluir al menos un número.";
    if (!symbolOK) return "Debe incluir al menos un símbolo.";
    return null;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("username").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();
    const confirmPassword = document.getElementById("confirmPassword").value.trim();

    if (!name || !email || !password || !confirmPassword) {
      showAlert("Todos los campos son obligatorios.", "error");
      return;
    }

    if (password !== confirmPassword) {
      showAlert("Las contraseñas no coinciden.", "error");
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      showAlert(passwordError, "error");
      return;
    }

    try {
      const res = await fetch("/api/createUser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const result = await res.json();

      if (res.status === 409) {
        showAlert("El nombre o correo ya están en uso.", "error");
        return;
      }

      if (result.success) {
        showAlert("Usuario creado con éxito", "success");
        setTimeout(() => {
          window.location.href = "../login/login.html";
        }, 1500);
      } else {
        showAlert(result.message, "error");
      }
    } catch {
      showAlert("Error al conectar con el servidor.", "error");
    }
  });
});
