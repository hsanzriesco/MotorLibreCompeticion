document.getElementById("registerForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("name").value;
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  console.log("📤 Enviando:", { name, email, password }); // <- para verificar en consola

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
    console.error("Error en fetch:", error);
    document.getElementById("message").textContent = "❌ Error en el servidor";
  }
});
