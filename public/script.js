document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("registerForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const msg = document.getElementById("message");
    const response = await res.json();

    if (res.ok) {
      msg.className = "alert alert-success";
      msg.textContent = "✅ Usuario registrado correctamente";
      form.reset();
    } else {
      msg.className = "alert alert-danger";
      msg.textContent = response.error || "Error al registrar";
    }
  });
});
