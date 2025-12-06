// public/js/navbar.js

document.addEventListener("DOMContentLoaded", () => {
    const userName = document.getElementById("user-name");
    const loginLink = document.getElementById("login-icon");
    const logoutBtn = document.getElementById("logout-btn");
    const logoLink = document.getElementById("logo-link");
    const menuInicio = document.getElementById("menu-inicio");

    // 🟢 RUTAS CENTRALIZADAS DEL DASHBOARD
    const ADMIN_DASHBOARD_HOME = "/pages/dashboard/admin/admin.html";
    // ⚠️ ATENCIÓN: Esta ruta parece incorrecta si tu login está en /pages/auth/login/login.html
    // Asumo que tienes una redirección desde /auth/login.html o que esta ruta es la correcta.
    // Si tu ruta es /pages/auth/login/login.html, deberías usar esa.
    const LOGIN_PAGE_PATH = "/auth/login.html";

    // ⭐ Referencias para el modal de Cierre de Sesión (de admin.html)
    const logoutConfirmModalEl = document.getElementById("logoutConfirmModal");
    const logoutConfirmModal = logoutConfirmModalEl ? new bootstrap.Modal(logoutConfirmModalEl) : null;
    const btnConfirmLogout = document.getElementById("btnConfirmLogout");

    // 1. CARGA DE USUARIO Y VALIDACIÓN DE SESIÓN
    const storedUser = sessionStorage.getItem("usuario") || localStorage.getItem("usuario");
    let user = null;

    if (storedUser) {
        try {
            user = JSON.parse(storedUser);
            if (userName) userName.textContent = user.name;
            if (loginLink) loginLink.style.display = "none";
        } catch (e) {
            console.error("Error parseando usuario:", e);
            // Si el JSON es inválido, forzamos el cierre de sesión
            sessionStorage.removeItem("usuario");
            localStorage.removeItem("usuario");
            // Esto forzará la redirección en la Guardia de Ruta (Paso 7)
        }
    } else {
        if (userName) userName.style.display = "none";
    }

    // -----------------------------------------------------------------------------------
    // 🔑 FUNCIONES DE SESIÓN Y CIERRE
    // -----------------------------------------------------------------------------------

    /**
     * Limpia los datos de sesión y redirige. Usada por el botón manual y el auto-logout.
     */
    function logoutUserAndRedirect(isAutoLogout = false) {
        // Limpiar ambos almacenamientos para asegurar el cierre de sesión
        sessionStorage.removeItem("usuario");
        localStorage.removeItem("usuario");

        // Ocultar el modal si está visible
        if (logoutConfirmModal) {
            logoutConfirmModal.hide();
        }

        // Muestra alerta (requiere alertas.js)
        if (typeof mostrarAlerta === 'function') {
            if (isAutoLogout) {
                // Alerta específica para inactividad
                mostrarAlerta("Sesión expirada por inactividad.", "advertencia");
            } else {
                mostrarAlerta("Sesión cerrada correctamente.", "exito");
            }
        }

        // Redirigir
        setTimeout(() => {
            window.location.href = "/index.html";
        }, 500);
    }

    // -----------------------------------------------------------------------------------
    // 6. LÓGICA DE CIERRE DE SESIÓN AUTOMÁTICO POR INACTIVIDAD (NUEVO)
    // -----------------------------------------------------------------------------------

    const INACTIVITY_TIMEOUT = 60000;
    let inactivityTimeout;

    function resetTimer() {
        // Detiene el temporizador existente
        clearTimeout(inactivityTimeout);

        // Inicia uno nuevo si el usuario está logueado
        if (user) {
            inactivityTimeout = setTimeout(autoLogout, INACTIVITY_TIMEOUT);
            // console.log("Temporizador reiniciado.");
        }
    }

    function autoLogout() {
        // Llama a la función central con el indicador de auto-logout
        if (user) {
            console.warn("Cierre de sesión automático por inactividad.");
            logoutUserAndRedirect(true);
        }
    }

    // -----------------------------------------------------------------------------------
    // 7. INICIALIZACIÓN DE INACTIVIDAD Y GUARDIA DE RUTA (CORREGIDA)
    // -----------------------------------------------------------------------------------

    if (user) {
        // 🚀 Iniciar y escuchar la actividad si hay sesión
        resetTimer();
        document.addEventListener('mousemove', resetTimer);
        document.addEventListener('keypress', resetTimer);
        document.addEventListener('click', resetTimer);
        document.addEventListener('scroll', resetTimer);

    } else {
        // 🚨 GUARDIA DE RUTA: Si no hay usuario y NO estamos en una de las páginas permitidas, forzar redirección.
        const currentPath = window.location.pathname;

        // 🟢 NUEVAS EXCEPCIONES AÑADIDAS: Calendario y Clubes
        const isPublicPage =
            currentPath.endsWith('/index.html') ||
            currentPath.includes(LOGIN_PAGE_PATH) ||
            currentPath.includes('/auth/register.html') ||
            currentPath.includes('/pages/calendario/calendario.html') || // <-- PERMITIDO SIN SESIÓN
            currentPath.includes('/pages/clubes/clubes.html');           // <-- PERMITIDO SIN SESIÓN

        if (!isPublicPage) {
            // Limpiar por si acaso y redirigir al index.
            localStorage.removeItem("usuario");
            sessionStorage.removeItem("usuario");

            // Opcional: Mostrar una alerta antes de redirigir
            if (typeof mostrarAlerta === 'function') {
                mostrarAlerta("Tienes que iniciar sesión para acceder a esta página.", 'advertencia');
            }

            setTimeout(() => {
                window.location.href = "/index.html";
            }, 500);
        }
    }


    // -----------------------------------------------------------------------------------
    // 8. CIERRE DE SESIÓN AL CERRAR LA PESTAÑA (NUEVO)
    // -----------------------------------------------------------------------------------

    window.addEventListener('beforeunload', function (e) {
        // Solo limpiar si hay un usuario logueado
        if (user) {
            // Limpiar el almacenamiento ANTES de que la página se descargue
            localStorage.removeItem("usuario");
            sessionStorage.removeItem("usuario");
            // console.log("Token limpiado al cerrar la pestaña.");
        }
    });


    // -----------------------------------------------------------------------------------
    // 2. REDIRECCIÓN DEL LOGO (MODIFICADO: Usar constante)
    // -----------------------------------------------------------------------------------
    if (logoLink) {
        if (user && user.role === "admin") {
            // 🟢 CORRECCIÓN: Usar la constante para la ruta de inicio del admin
            logoLink.href = ADMIN_DASHBOARD_HOME;
        } else {
            logoLink.href = "/index.html";
        }
    }

    // 3. REDIRECCIÓN DEL BOTÓN 'INICIO' DEL OFFCANVAS (MODIFICADO: Usar constante)
    if (menuInicio) {
        menuInicio.addEventListener("click", (ev) => {
            ev.preventDefault();
            if (user && user.role === "admin") {
                // 🟢 CORRECCIÓN: Usar la constante para la ruta de inicio del admin
                window.location.href = ADMIN_DASHBOARD_HOME;
            } else {
                window.location.href = "/index.html";
            }
        });
    }

    // 4. LÓGICA DE CERRAR SESIÓN MANUAL (Ajustado para limpiar temporizador)
    if (logoutBtn) {
        logoutBtn.addEventListener("click", (e) => {
            e.preventDefault();

            // ⚠️ IMPORTANTE: Limpiar el temporizador al iniciar el proceso manual de cierre de sesión
            clearTimeout(inactivityTimeout);

            if (user && user.role === "admin" && logoutConfirmModal) {
                // Si es admin y existe el modal, muestra el modal
                logoutConfirmModal.show();
            } else {
                // Cierra la sesión directamente 
                logoutUserAndRedirect();
            }
        });
    }

    // 5. LÓGICA DE CONFIRMACIÓN DEL MODAL (Mantenido)
    if (btnConfirmLogout) {
        btnConfirmLogout.addEventListener("click", () => {
            logoutUserAndRedirect();
        });
    }

    // Opcional: Si se cierra el modal de logout sin confirmar, reiniciar el temporizador
    if (logoutConfirmModalEl) {
        logoutConfirmModalEl.addEventListener('hidden.bs.modal', function () {
            resetTimer();
        });
    }
});