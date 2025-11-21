document.addEventListener("DOMContentLoaded", () => {
    const userName = document.getElementById("user-name");
    const loginLink = document.getElementById("login-icon");
    const logoutBtn = document.getElementById("logout-btn");
    const logoLink = document.getElementById("logo-link");
    const menuInicio = document.getElementById("menu-inicio");

    const storedUser = sessionStorage.getItem("usuario");
    let user = null;

    if (storedUser) {
        try {
            user = JSON.parse(storedUser);
            if (userName) userName.textContent = user.name;
            if (loginLink) loginLink.style.display = "none";
        } catch (e) {
            console.error("Error parseando usuario:", e);
            sessionStorage.removeItem("usuario");
        }
    } else {
        if (userName) userName.style.display = "none";
    }

    if (logoLink) {
        if (user && user.role === "admin") {
            logoLink.href = "/pages/dashboard/admin/admin.html";
        } else {
            logoLink.href = "/index.html";
        }
    }

    if (menuInicio) {
        menuInicio.addEventListener("click", (ev) => {
            ev.preventDefault();
            if (user && user.role === "admin") {
                window.location.href = "/pages/dashboard/admin/admin.html";
            } else {
                window.location.href = "/index.html";
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener("click", (e) => {
            e.preventDefault();
            sessionStorage.clear();
            window.location.href = "/index.html";
        });
    }
});
