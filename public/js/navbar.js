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

    // ⭐⭐ LÓGICA DE CIERRE DE SESIÓN MODIFICADA CON CONFIRMACIÓN ⭐⭐
    if (logoutBtn) {
        logoutBtn.addEventListener("click", (e) => {
            e.preventDefault();
            
            // Muestra la ventana de confirmación al usuario
            const confirmarCierre = confirm("¿Estás seguro/a de que quieres cerrar la sesión?");

            if (confirmarCierre) {
                // Si el usuario confirma ('Aceptar'), procede a cerrar la sesión
                sessionStorage.clear();
                window.location.href = "/index.html";
            } else {
                // Si el usuario cancela, no hace nada y se queda en la página
                console.log("Cierre de sesión cancelado por el usuario.");
            }
        });
    }
});
