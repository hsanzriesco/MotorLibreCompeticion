document.getElementById("registerForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document.getElementById("username").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  try {
    const response = await fetch("/api/createUser.js", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Error al registrarse");

    showToast("¡Usuario registrado con éxito!", "success");
    setTimeout(() => (window.location.href = "../login/login.html"), 1500);
  } catch (error) {
    showToast(error.message, "error");
  }
});
