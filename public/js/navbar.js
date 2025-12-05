document.addEventListener("DOMContentLoaded", () => {
    const userName = document.getElementById("user-name");
    const loginLink = document.getElementById("login-icon");
    const logoutBtn = document.getElementById("logout-btn");
    const logoLink = document.getElementById("logo-link");
    const menuInicio = document.getElementById("menu-inicio");

    // ⭐ NUEVO: Referencias para el modal de Cierre de Sesión (de admin.html)
    const logoutConfirmModalEl = document.getElementById("logoutConfirmModal");
    const logoutConfirmModal = logoutConfirmModalEl ? new bootstrap.Modal(logoutConfirmModalEl) : null;
    const btnConfirmLogout = document.getElementById("btnConfirmLogout");


    // 1. CARGA DE USUARIO Y VALIDACIÓN DE SESIÓN (Usa localStorage o sessionStorage)
    const storedUser = sessionStorage.getItem("usuario") || localStorage.getItem("usuario");
    let user = null;

    if (storedUser) {
        try {
            user = JSON.parse(storedUser);
            if (userName) userName.textContent = user.name;
            if (loginLink) loginLink.style.display = "none";
        } catch (e) {
            console.error("Error parseando usuario:", e);
            sessionStorage.removeItem("usuario");
            localStorage.removeItem("usuario"); // Limpiamos ambos por seguridad
        }
    } else {
        if (userName) userName.style.display = "none";
    }

    // 2. REDIRECCIÓN DEL LOGO
    if (logoLink) {
        if (user && user.role === "admin") {
            logoLink.href = "/pages/dashboard/admin/admin.html";
        } else {
            logoLink.href = "/index.html";
        }
    }

    // 3. REDIRECCIÓN DEL BOTÓN 'INICIO' DEL OFFCANVAS
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

    // 4. LÓGICA DE CERRAR SESIÓN (Muestra el modal o cierra directamente si no hay modal)
    if (logoutBtn) {
        logoutBtn.addEventListener("click", (e) => {
            e.preventDefault();

            if (user && user.role === "admin" && logoutConfirmModal) {
                // Si es admin y existe el modal (solo en admin.html), muestra el modal
                logoutConfirmModal.show();
            } else {
                // Cierra la sesión directamente (ej. si está en index.html)
                logoutUserAndRedirect();
            }
        });
    }

    // 5. LÓGICA DE CONFIRMACIÓN DEL MODAL (Solo existe en admin.html)
    if (btnConfirmLogout) {
        btnConfirmLogout.addEventListener("click", () => {
            logoutUserAndRedirect();
        });
    }

    // 🔑 FUNCIÓN CENTRAL DE CIERRE DE SESIÓN
    function logoutUserAndRedirect() {
        // Limpiar ambos almacenamientos para asegurar el cierre de sesión
        sessionStorage.removeItem("usuario");
        localStorage.removeItem("usuario");

        // Ocultar el modal si está visible
        if (logoutConfirmModal) {
            logoutConfirmModal.hide();
        }

        // Muestra alerta (requiere alertas.js)
        if (typeof mostrarAlerta === 'function') {
            mostrarAlerta("Sesión cerrada correctamente.", "exito");
        }

        // Redirigir
        setTimeout(() => {
            window.location.href = "/index.html";
        }, 500);
    }
});