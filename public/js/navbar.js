document.addEventListener("DOMContentLoaded", () => {
    const userName = document.getElementById("user-name");
    const loginLink = document.getElementById("login-icon");
    const logoutBtn = document.getElementById("logout-btn");
    const logoLink = document.getElementById("logo-link");
    const menuInicio = document.getElementById("menu-inicio");

    // ⭐️ REFERENCIAS A ELEMENTOS DEL MODAL PERSONALIZADO
    const modal = document.getElementById("custom-logout-modal");
    const btnConfirmarLogout = document.getElementById("btn-confirmar-logout");
    const btnCancelarLogout = document.getElementById("btn-cancelar-logout");
    
    // Función centralizada para ejecutar el cierre de sesión
    function realizarLogout() {
        sessionStorage.clear();
        window.location.href = "/index.html";
    }

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

    // ⭐⭐ LÓGICA MODIFICADA: Muestra el MODAL PERSONALIZADO ⭐⭐
    if (logoutBtn) {
        logoutBtn.addEventListener("click", (e) => {
            e.preventDefault();
            if (modal) {
                // Si el modal existe en el HTML, lo mostramos.
                modal.style.display = "flex"; 
            } else {
                // Si el modal NO existe (esto causa el error que describes), 
                // hacemos el logout de forma inmediata (como fallback).
                console.warn("ADVERTENCIA: No se encontró el modal 'custom-logout-modal'. Cerrando sesión directamente.");
                realizarLogout();
            }
        });
    }

    // ⭐⭐ Manejadores para los botones del MODAL ⭐⭐
    
    // 1. Botón "Sí, Cerrar Sesión" (ejecuta el logout)
    if (btnConfirmarLogout) {
        btnConfirmarLogout.addEventListener("click", () => {
            if (modal) modal.style.display = "none"; // Oculta el modal
            realizarLogout(); // Ejecuta el cierre de sesión
        });
    }

    // 2. Botón "No, Cancelar" (solo oculta el modal)
    if (btnCancelarLogout) {
        btnCancelarLogout.addEventListener("click", () => {
            if (modal) modal.style.display = "none";
        });
    }
});
