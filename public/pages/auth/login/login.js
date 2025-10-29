document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");

    if (!emailInput || !passwordInput) {
      console.error("❌ No se encontraron los campos del formulario.");
      return;
    }

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email || !password) {
      showMessage("⚠️ Por favor, completa todos los campos.", "error");
      return;
    }

    try {
      const res = await fetch("/api/loginUser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const text = await res.text();
      let result;
      try {
        result = JSON.parse(text);
      } catch {
        console.error("Respuesta no JSON:", text);
        showMessage("❌ Error inesperado del servidor.", "error");
        return;
      }

      if (result.success) {
        const user = result.user;
        // ⭐ CAMBIO CLAVE: Usar sessionStorage
        **sessionStorage.setItem("usuario", JSON.stringify(user));**
        showMessage(`👋 Bienvenido, ${user.name}!`, "success");

        // Redirección según el rol
        setTimeout(() => {
          if (user.role === "admin") {
            window.location.href = "/pages/dashboard/admin/admin.html";
          } else {
            window.location.href = "/index.html"; // usuario normal → index
          }
        }, 1500);
      } else {
        showMessage("❌ " + result.message, "error");
      }
    } catch (error) {
      console.error("Error en login:", error);
      showMessage("⚠️ Error de conexión con el servidor.", "error");
    }
  });
});

// ✅ función para mostrar mensaje bonito en pantalla (sin cambios)
function showMessage(message, type = "info") {
  let msgBox = document.getElementById("messageBox");
  if (!msgBox) {
    msgBox = document.createElement("div");
    msgBox.id = "messageBox";
    msgBox.style.position = "fixed";
    msgBox.style.top = "20px";
    msgBox.style.left = "50%";
    msgBox.style.transform = "translateX(-50%)";
    msgBox.style.padding = "15px 25px";
    msgBox.style.borderRadius = "10px";
    msgBox.style.fontWeight = "bold";
    msgBox.style.zIndex = "9999";
    msgBox.style.transition = "opacity 0.5s ease";
    document.body.appendChild(msgBox);
  }

  msgBox.textContent = message;

  switch (type) {
    case "success":
      msgBox.style.backgroundColor = "#28a745";
      msgBox.style.color = "#fff";
      break;
    case "error":
      msgBox.style.backgroundColor = "#dc3545";
      msgBox.style.color = "#fff";
      break;
    default:
      msgBox.style.backgroundColor = "#ffc107";
      msgBox.style.color = "#000";
  }

  msgBox.style.opacity = "1";

  setTimeout(() => {
    msgBox.style.opacity = "0";
  }, 2500);
}