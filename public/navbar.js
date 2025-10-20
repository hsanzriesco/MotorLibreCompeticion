document.addEventListener("DOMContentLoaded", () => {
  const navbar = document.createElement("nav");
  navbar.classList.add("navbar");

  navbar.innerHTML = `
    <div class="navbar-logo">MOTOR LIBRE COMPETICIÓN</div>
    <div class="navbar-icons">
      <a href="/public/register/login.html"><i class="fa-solid fa-user"></i></a>
      <button class="menu-toggle"><i class="fa-solid fa-bars"></i></button>
    </div>
  `;

  document.body.prepend(navbar);
});
