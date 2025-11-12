document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const usernameInput = document.getElementById("username");
    const passwordInput = document.getElementById("password");

    if (!usernameInput || !passwordInput) {
      console.error("No se encontraron los campos del formulario.");
      return;
    }

    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) {
      showAlert("Por favor, completa todos los campos.", "error");
      return;
    }

    try {
      const res = await fetch("/api/loginUser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const text = await res.text();
      let result;
      try {
        result = JSON.parse(text);
      } catch {
        console.error("Respuesta no JSON:", text);
        showAlert("Error inesperado del servidor.", "error");
        return;
      }

      if (result.success) {
        const user = result.user;
        sessionStorage.setItem("usuario", JSON.stringify(user));

        showAlert(`Bienvenido, ${user.name}!`, "success");

        setTimeout(() => {
          if (user.role === "admin") {
            window.location.href = "/pages/dashboard/admin/admin.html";
          } else {
            window.location.href = "/index.html";
          }
        }, 1500);
      } else {
        showAlert(result.message || "Credenciales incorrectas.", "error");
      }
    } catch (error) {
      console.error("Error en login:", error);
      showAlert("Error de conexión con el servidor.", "error");
    }
  });
});
