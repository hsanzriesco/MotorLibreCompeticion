document.getElementById("registerForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = document.getElementById("name").value;
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const response = await fetch("/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password })
  });

  const messageEl = document.getElementById("message");

  try {
    const data = await response.json();
    messageEl.textContent = data.message || "Registro completado.";
    messageEl.style.color = response.ok ? "green" : "red";
  } catch {
    messageEl.textContent = "Error al registrar usuario.";
    messageEl.style.color = "red";
  }
});
