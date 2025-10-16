// Esperar a que el DOM cargue
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("registerForm");
  const message = document.getElementById("message");

  // Escuchar el evento de envío del formulario
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Obtener los valores de los inputs
    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    // Verificación rápida
    if (!name || !email || !password) {
      message.textContent = "⚠️ Todos los campos son obligatorios.";
      message.classList.add("text-danger");
      return;
    }

    console.log("📤 Enviando datos:", { name, email, password });

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();
      console.log("📥 Respuesta del servidor:", data);

      if (response.ok) {
        // Registro exitoso
        message.textContent = "✅ Registro exitoso. Bienvenido a Motor Libre Competición.";
        message.classList.remove("text-danger");
        message.classList.add("text-success");

        // Limpiar el formulario
        form.reset();
      } else {
        // Error controlado desde el backend
        message.textContent = "❌ " + (data.error || "Error en el registro.");
        message.classList.remove("text-success");
        message.classList.add("text-danger");
      }
    } catch (error) {
      // Error en la conexión o servidor
      console.error("❌ Error en el fetch:", error);
      message.textContent = "❌ Error de conexión con el servidor.";
      message.classList.remove("text-success");
      message.classList.add("text-danger");
    }
  });
});
