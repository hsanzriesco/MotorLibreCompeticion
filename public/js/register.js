document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("registerForm");

  // Crear contenedor para alertas si no existe
  let alertContainer = document.querySelector(".alert-container");
  if (!alertContainer) {
    alertContainer = document.createElement("div");
    alertContainer.classList.add("alert-container");
    document.body.appendChild(alertContainer);
  }

  // Función para mostrar mensajes personalizados
  function showAlert(message, type = "success") {
    const alert = document.createElement("div");
    alert.className = `custom-alert ${type}`;
    alert.textContent = message;
    alertContainer.appendChild(alert);

    // Mostrar con animación
    setTimeout(() => alert.classList.add("visible"), 50);

    // Desaparecer luego de 3 segundos
    setTimeout(() => {
      alert.classList.remove("visible");
      setTimeout(() => alert.remove(), 400);
    }, 3000);
  }

  // Función para validar la contraseña
  function validatePassword(password) {
    const lengthOK = password.length >= 8 && password.length <= 12;
    const upperCaseOK = /[A-Z]/.test(password);
    const numberOK = /[0-9]/.test(password);
    const symbolOK = /[^A-Za-z0-9]/.test(password);

    if (!lengthOK)
      return "La contraseña debe tener entre 8 y 12 caracteres.";
    if (!upperCaseOK)
      return "La contraseña debe contener al menos una letra mayúscula.";
    if (!numberOK)
      return "La contraseña debe incluir al menos un número.";
    if (!symbolOK)
      return "La contraseña debe incluir al menos un símbolo.";

    return null; // Todo correcto
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("username").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    // Verificación de campos vacíos
    if (!name || !email || !password) {
      showAlert("Todos los campos son obligatorios.", "error");
      return;
    }

    // Validar contraseña antes de enviar
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
        showAlert("✅ Usuario creado con éxito", "success");
        setTimeout(() => {
          window.location.href = "../login/login.html";
        }, 1500);
      } else {
        showAlert(`${result.message}`, "error");
      }
    } catch (err) {
      console.error(err);
      showAlert("Error al conectar con el servidor.", "error");
    }
  });
});
