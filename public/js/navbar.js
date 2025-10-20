document.addEventListener("DOMContentLoaded", () => {
  const userName = document.getElementById("user-name");
  const loginLink = document.getElementById("login-link");
  const logoutBtn = document.getElementById("logout-btn");

  // Mostrar nombre de usuario si hay sesión guardada
  const loggedUser = localStorage.getItem("username");
  if (loggedUser) {
    userName.textContent = loggedUser;
    loginLink.style.display = "none";
  }

  // Cerrar sesión
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("username");
      window.location.href = "/index.html";
    });
  }
});
