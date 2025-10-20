document.getElementById("loginForm").addEventListener("submit", (e) => {
  e.preventDefault();

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  // Simulación de login local
  const storedUser = localStorage.getItem("user");
  if (!storedUser) {
    alert("No hay ningún usuario registrado.");
    return;
  }

  const user = JSON.parse(storedUser);
  if (user.username === username && user.password === password) {
    localStorage.setItem("username", user.username);
    alert(`Bienvenido ${user.username}`);
    window.location.href = "/index.html";
  } else {
    alert("Usuario o contraseña incorrectos");
  }
});
