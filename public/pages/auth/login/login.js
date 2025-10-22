document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  try {
    const response = await fetch("/api/loginUser.js", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) throw new Error(data.message || "Error al iniciar sesión");

    showToast("¡Bienvenido a Motor Libre Competición!", "success");

    setTimeout(() => {
      if (data.role === "admin") {
        window.location.href = "/pages/dashboard/admin/admin.html";
      } else {
        window.location.href = "/index.html";
      }
    }, 1500);
  } catch (error) {
    showToast(error.message, "error");
  }
});
