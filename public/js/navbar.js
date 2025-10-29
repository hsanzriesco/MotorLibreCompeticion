document.addEventListener("DOMContentLoaded", () => {
  const userName = document.getElementById("user-name");
  const loginLink = document.getElementById("login-link");
  const logoutBtn = document.getElementById("logout-btn");

  // Mostrar nombre de usuario si hay sesión guardada
  // ⭐ CAMBIO CLAVE: Usar sessionStorage y la clave "usuario"
  const storedUser = sessionStorage.getItem("usuario");
  if (storedUser) {
    try {
      const user = JSON.parse(storedUser);
      userName.textContent = user.name;
      loginLink.style.display = "none";
    } catch (e) {
      console.error("Error al parsear usuario de sessionStorage", e);
      // Si hay un error, lo borramos para evitar bucles
      sessionStorage.removeItem("usuario");
    }
  }

  // Cerrar sesión
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      // ⭐ CAMBIO CLAVE: Usar sessionStorage.removeItem
      **sessionStorage.removeItem("usuario");**
      window.location.href = "/index.html";
    });
  }
});