// public/js/navbar.js

document.addEventListener("DOMContentLoaded", () => {
    const userName = document.getElementById("user-name");
    const loginLink = document.getElementById("login-icon");
    const logoutBtn = document.getElementById("logout-btn");
    const logoLink = document.getElementById("logo-link");
    const menuInicio = document.getElementById("menu-inicio");

    // ⭐ Referencia al enlace de Mi Club
    const miClubLink = document.getElementById("mi-club-link");

    // ⭐ Ruta específica del club para presidentes (asumo que es donde apunta este enlace)
    const MI_CLUB_EDIT_PAGE_PATH = "/pages/miClub/editarPresidente.html";

    // ⭐ REFUERZO DE SEGURIDAD INICIAL: Asegurar que esté oculto Y NO CLICABLE por defecto.
    if (miClubLink) {
        miClubLink.style.display = 'none';
        miClubLink.removeAttribute('href'); // 🔑 Bloquea la funcionalidad de click/navegación
    }

    // 🛑 BANDERA DE CONTROL CRÍTICA
    let redireccionExternaEnCurso = false;

    // 🟢 RUTAS CENTRALIZADAS DEL DASHBOARD
    const ADMIN_DASHBOARD_HOME = "/pages/dashboard/admin/admin.html";
    const LOGIN_PAGE_PATH = "/auth/login/login.html";
    const REGISTER_PAGE_PATH = "/auth/register.html";
    const CALENDARIO_PAGE_PATH = "/pages/calendario/calendario.html";
    const CLUBES_PAGE_PATH = "/pages/clubes/clubes.html";

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
                userName.style.display = "inline";
            }

            // Ocultar el icono de inicio de sesión
            if (loginLink) loginLink.style.display = "none";

            // ⭐ LÓGICA DE HABILITACIÓN: Mostrar Y ASIGNAR HREF si is_presidente es TRUE
            if (miClubLink && user.is_presidente === true) {
                miClubLink.style.display = 'block';
                miClubLink.href = MI_CLUB_EDIT_PAGE_PATH; // 🔑 Restaurar el enlace
            }


        } catch (e) {
            console.error("Error parseando usuario:", e);
            // Si el JSON es inválido, forzamos el cierre de sesión
            sessionStorage.removeItem("usuario");
            localStorage.removeItem("usuario");
            user = null; // Reajustamos la variable user
        }
    }

    // 💥 MODIFICACIÓN CRÍTICA PARA DESHABILITAR Y OCULTAR SI NO HAY SESIÓN 💥
    if (!user) { // Si no hay usuario:
        if (userName) userName.style.display = "none";

        // Asegurar que el login link está visible
        if (loginLink) loginLink.style.display = "block";

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
        sessionStorage.removeItem("token");
        localStorage.removeItem("token");

        // Ocultar el modal si está visible
        if (logoutConfirmModal) {
            logoutConfirmModal.hide();
        }

        redireccionExternaEnCurso = true;

        // Muestra alerta (requiere alertas.js)
        if (typeof mostrarAlerta === 'function') {
            if (isAutoLogout) {
                // Alerta específica para inactividad
                mostrarAlerta("Sesión expirada por inactividad.", "error");
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
        clearTimeout(inactivityTimeout);

        if (user) {
            inactivityTimeout = setTimeout(autoLogout, INACTIVITY_TIMEOUT);
            // console.log("Temporizador reiniciado.");
        }
    }

    function autoLogout() {
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

        // 🛑 LÓGICA CLAVE: DETECCIÓN DE ALERTA ROJA (PARA QUITAR LA AMARILLA DUPLICADA) 🛑
        // Si otro script ya generó una alerta de tipo 'error' (roja), significa que
        // la página específica ya está manejando la redirección. Salimos.
        // ASUMIMOS QUE LA CLASE DE ERROR ES '.mlc-alert-box.error'
        if (document.querySelector('.mlc-alert-box.error')) {
            console.warn("navbar.js: Detectada alerta de error externa. Guardrail de navbar deshabilitado.");
            redireccionExternaEnCurso = true;
            return;
        }

        // 🚨 GUARDIA DE RUTA: Si no hay usuario y NO estamos en una de las páginas permitidas, forzar redirección.
        const currentPath = window.location.pathname;

        // 🟢 EXCEPCIONES: Páginas permitidas sin sesión
        const isPublicPage =
            currentPath.endsWith('/index.html') ||
            currentPath.includes(LOGIN_PAGE_PATH) ||
            currentPath.includes(REGISTER_PAGE_PATH) ||
            currentPath.includes(CALENDARIO_PAGE_PATH) ||
            currentPath.includes(CLUBES_PAGE_PATH);


        // ⭐ EJECUCIÓN DE LA GUARDIA PREDETERMINADA (Muestra la ALERTA ROJA/CRÍTICA)
        if (!isPublicPage && !redireccionExternaEnCurso) {

            redireccionExternaEnCurso = true; // Activar la bandera de control

            // Usando 'error' para el estilo crítico.
            if (typeof mostrarAlerta === 'function') {
                mostrarAlerta("Tienes que iniciar sesión para acceder a esta página.", "error");
            }

            // Limpiar y redirigir
            setTimeout(() => {
                window.location.href = "/index.html";
            }, 1500);

            localStorage.removeItem("usuario");
            sessionStorage.removeItem("usuario");
        }
    }

    // -----------------------------------------------------------------------------------
    // 8. LÓGICA DE BLOQUEO DE CLICK PARA MI CLUB (ULTRA-SEGURIDAD)
    // -----------------------------------------------------------------------------------
    if (miClubLink) {
        miClubLink.addEventListener("click", (e) => {
            // Verificamos si el enlace no tiene el atributo 'href' (porque fue removido por JS)
            if (miClubLink.getAttribute('href') === null) {
                e.preventDefault(); // Bloquea la navegación

                // Muestra alerta si intentan hacer clic en un enlace deshabilitado
                if (typeof mostrarAlerta === 'function' && !redireccionExternaEnCurso) {
                    mostrarAlerta("Solo los presidentes de club pueden acceder a esta opción.", "advertencia");
                }
            }
        });
    }

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

            // Evitar la ejecución si está deshabilitado o si ya hay una redirección externa
            if (!user || redireccionExternaEnCurso) {
                console.warn("Cierre de sesión bloqueado: Usuario no logueado o redirección en curso.");
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