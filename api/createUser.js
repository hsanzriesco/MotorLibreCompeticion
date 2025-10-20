document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("registerForm");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const data = Object.fromEntries(new FormData(form).entries());

    // Validar contraseña antes de enviar
    const passwordError = validatePassword(data.password);
    if (passwordError) {
      showMessage(passwordError, "error");
      return;
    }

    try {
      const res = await fetch("/api/registerUser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (result.success) {
        showMessage("✅ Registro exitoso. Redirigiendo...", "success");
        setTimeout(() => {
          window.location.href = "login.html";
        }, 3000);
      } else {
        showMessage(`❌ ${result.error || "Error al registrar"}`, "error");
      }
    } catch {
      showMessage("⚠️ Error al conectar con el servidor", "error");
    }
  });
});

/* Validación avanzada de contraseña */
function validatePassword(password) {
  if (password.length < 8)
    return "La contraseña debe tener al menos 8 caracteres.";
  if (!/[A-Z]/.test(password))
    return "La contraseña debe incluir al menos una letra mayúscula.";
  if (!/[a-z]/.test(password))
    return "La contraseña debe incluir al menos una letra minúscula.";
  if (!/[0-9]/.test(password))
    return "La contraseña debe incluir al menos un número.";
  if (!/[!@#$%^&*(),.?\":{}|<>_\-]/.test(password))
    return "La contraseña debe incluir al menos un carácter especial.";

  return null; // ✅ Sin errores
}

/* Mensaje flotante reutilizable */
function showMessage(text, type = "info") {
  const div = document.createElement("div");
  div.textContent = text;
  div.className = `floating-msg ${type}`;
  document.body.appendChild(div);

  setTimeout(() => div.remove(), 5000);
}
