document.getElementById("registerForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

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
      document.getElementById("message").textContent = "✅ Registro exitoso";
      document.getElementById("registerForm").reset();
    } else {
      document.getElementById("message").textContent =
        "❌ " + (data.error || "Error en el registro");
    }
  } catch (error) {
    console.error("❌ Error en el fetch:", error);
    document.getElementById("message").textContent = "❌ Error en el servidor";
  }
});
