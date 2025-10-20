document.getElementById("registerForm").addEventListener("submit", (e) => {
  e.preventDefault();

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  const newUser = { username, password };
  localStorage.setItem("user", JSON.stringify(newUser));

  alert("Usuario registrado correctamente");
  window.location.href = "../login/login.html";
});
