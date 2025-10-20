document.addEventListener("DOMContentLoaded", () => {
  const profileIcon = document.querySelector(".bi-person-circle");
  if (profileIcon) {
    profileIcon.addEventListener("click", () => {
      window.location.href = "./register/login.html";
    });
  }
});
