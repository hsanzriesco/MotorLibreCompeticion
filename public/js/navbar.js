// public/js/navbar.js

document.addEventListener("DOMContentLoaded", () => {
    const userName = document.getElementById("user-name");
    const loginLink = document.getElementById("login-icon");
    const logoutBtn = document.getElementById("logout-btn");
    const logoLink = document.getElementById("logo-link");
    const menuInicio = document.getElementById("menu-inicio");

    // 🟢 RUTAS CENTRALIZADAS DEL DASHBOARD
    const ADMIN_DASHBOARD_HOME = "/pages/dashboard/admin/admin.html";
    const LOGIN_PAGE_PATH = "/auth/login.html";

    // ⭐ Referencias para el modal de Cierre de Sesión
    const logoutConfirmModalEl = document.getElementById("logoutConfirmModal");
    const logoutConfirmModal = logoutConfirmModalEl ? new bootstrap.Modal(logoutConfirmModalEl) : null;
    const btnConfirmLogout = document.getElementById("btnConfirmLogout");

    // 1. CARGA DE USUARIO Y VALIDACIÓN DE SESIÓN
    const storedUser = sessionStorage.getItem("usuario") || localStorage.getItem("usuario");
    let user = null;

    if (storedUser) {
        try {
            user = JSON.parse(storedUser);

            // 🟢 MODIFICACIÓN CLAVE: Mostrar el nombre de usuario
            if (userName) {
                userName.textContent = user.name;
                userName.style.display = "inline"; // ⭐ HACER VISIBLE EL NOMBRE

                // 💡 CAMBIO SOLICITADO: Establecer el texto en negrita
                userName.style.fontWeight = "bold";
            }

            // Ocultar el icono de inicio de sesión
            if (loginLink) loginLink.style.display = "none";

        } catch (e) {
            console.error("Error parseando usuario:", e);
            // Si el JSON es inválido, forzamos el cierre de sesión
            sessionStorage.removeItem("usuario");
            localStorage.removeItem("usuario");
        }
    }

    // 💥 MODIFICACIÓN CRÍTICA PARA DESHABILITAR Y OCULTAR SI NO HAY SESIÓN 💥
    if (!user) { // Si no hay usuario:
        if (userName) userName.style.display = "none"; // Asegurar que el nombre está oculto

        // Asegurar que el login link está visible
        if (loginLink) loginLink.style.display = "block"; // o 'inline-block' si prefieres

        if (logoutBtn) {
            logoutBtn.classList.add('disabled-link');
            logoutBtn.removeAttribute('href');
        }
    } else {
        // Si el usuario está logueado, aseguramos que el botón esté habilitado
        if (logoutBtn) {
            logoutBtn.classList.remove('disabled-link');
            logoutBtn.href = "#";
        }
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
    // 6. LÓGICA DE CIERRE DE SESIÓN AUTOMÁTICO POR INACTIVIDAD
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
    // 7. INICIALIZACIÓN DE INACTIVIDAD Y GUARDIA DE RUTA (GUARDRAIL)
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

        // 🟢 EXCEPCIONES: Páginas permitidas sin sesión (Index, Login, Register, Calendario, Clubes)
        const isPublicPage =
            currentPath.endsWith('/index.html') ||
            currentPath.includes(LOGIN_PAGE_PATH) ||
            currentPath.includes('/auth/register.html') ||
            currentPath.includes('/pages/calendario/calendario.html') ||
            currentPath.includes('/pages/clubes/clubes.html');

        if (!isPublicPage) {
            // Mostrar alerta de inicio de sesión antes de redirigir
            if (typeof mostrarAlerta === 'function') {
                mostrarAlerta("Tienes que iniciar sesión para acceder a esta página.", "advertencia");
            }

            // Limpiar y redirigir
            setTimeout(() => {
                window.location.href = "/index.html"; // Redirigir a Index o a Login si prefieres
            }, 1500); // 1.5 segundos para que se vea la alerta.

            localStorage.removeItem("usuario");
            sessionStorage.removeItem("usuario");
        }
    }


    // -----------------------------------------------------------------------------------
    // 8. CIERRE DE SESIÓN AL CERRAR LA PESTAÑA (BLOQUEADO)
    // -----------------------------------------------------------------------------------

    /*
    // 🛑 BLOQUE DESACTIVADO: La limpieza de sesión en 'beforeunload' se dispara al navegar
    // dentro de la app (cambio de página), causando cierres de sesión automáticos no deseados.
    window.addEventListener('beforeunload', function (e) {
        // Solo limpiar si hay un usuario logueado
        if (user) {
            // Limpiar el almacenamiento ANTES de que la página se descargue
            localStorage.removeItem("usuario");
            sessionStorage.removeItem("usuario");
            // console.log("Token limpiado al cerrar la pestaña.");
        }
    });
    */


    // -----------------------------------------------------------------------------------
    // 2. REDIRECCIÓN DEL LOGO
    // -----------------------------------------------------------------------------------
    if (logoLink) {
        if (user && user.role === "admin") {
            logoLink.href = ADMIN_DASHBOARD_HOME;
        } else {
            logoLink.href = "/index.html";
        }
    }

    // 3. REDIRECCIÓN DEL BOTÓN 'INICIO' DEL OFFCANVAS
    if (menuInicio) {
        menuInicio.addEventListener("click", (ev) => {
            ev.preventDefault();
            if (user && user.role === "admin") {
                window.location.href = ADMIN_DASHBOARD_HOME;
            } else {
                window.location.href = "/index.html";
            }
        });
    }

    // -----------------------------------------------------------------------------------
    // 4. LÓGICA DE CERRAR SESIÓN MANUAL (CORREGIDA)
    // -----------------------------------------------------------------------------------
    if (logoutBtn) {
        logoutBtn.addEventListener("click", (e) => {
            e.preventDefault();

            // Evitar la ejecución si está deshabilitado
            if (!user) {
                console.warn("Cierre de sesión bloqueado: Usuario no logueado.");
                return;
            }

            // Limpiar el temporizador al iniciar el proceso manual de cierre de sesión
            clearTimeout(inactivityTimeout);

            // Muestra el modal si el elemento existe en la página actual.
            if (logoutConfirmModal) {
                logoutConfirmModal.show();
            } else {
                // Si el modal no existe, o no se encontró el elemento, se cierra la sesión directamente.
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