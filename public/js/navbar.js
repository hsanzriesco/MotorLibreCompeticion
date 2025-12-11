// public/js/navbar.js

document.addEventListener("DOMContentLoaded", () => {
    const userName = document.getElementById("user-name");
    const loginLink = document.getElementById("login-icon");
    const logoutBtn = document.getElementById("logout-btn");
    const logoLink = document.getElementById("logo-link");
    const menuInicio = document.getElementById("menu-inicio");

    // 1. NUEVOS ELEMENTOS DEL OFFCANVAS
    const miClubLink = document.getElementById("mi-club-link");
    const presidenteClubLink = document.getElementById("presidente-club-link"); // <-- NUEVO ENLACE

    // 🛑 BANDERA DE CONTROL CRÍTICA
    let redireccionExternaEnCurso = false;

    // 🟢 RUTAS CENTRALIZADAS DEL DASHBOARD
    const ADMIN_DASHBOARD_HOME = "/pages/dashboard/admin/admin.html";
    const LOGIN_PAGE_PATH = "/auth/login/login.html";
    const REGISTER_PAGE_PATH = "/auth/register.html";
    const CALENDARIO_PAGE_PATH = "/pages/calendario/calendario.html";
    const CLUBES_PAGE_PATH = "/pages/clubes/clubes.html";
    const CLUB_EDITAR_USUARIO_PATH = "/pages/clubes/editarUsuario.html";
    const CLUB_EDITAR_PRESIDENTE_PATH = "/pages/clubes/presidente/editarPresidente.html";

    // ⭐ Referencias para el modal de Cierre de Sesión
    const logoutConfirmModalEl = document.getElementById("logoutConfirmModal");
    const logoutConfirmModal = logoutConfirmModalEl ? new bootstrap.Modal(logoutConfirmModalEl) : null;
    const btnConfirmLogout = document.getElementById("btnConfirmLogout");

    // 1. CARGA DE USUARIO Y VALIDACIÓN DE SESIÓN
    const storedUser = sessionStorage.getItem("usuario") || localStorage.getItem("usuario");
    const clubIdInSession = sessionStorage.getItem("clubId");
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

        } catch (e) {
            console.error("Error parseando usuario:", e);
            // Si el JSON es inválido, forzamos el cierre de sesión
            sessionStorage.removeItem("usuario");
            localStorage.removeItem("usuario");
            user = null; // Reajustamos la variable user
        }
    }

    // --- HEURÍSTICA DE RUTA RELATIVA ---
    /**
     * Calcula el prefijo ../../... necesario para llegar a la raíz.
     * @returns {string} El prefijo relativo (ej: './', '../', '../../').
     */
    function getRelativeToRootPrefix() {
        let pathPrefix = '';
        // Contar la profundidad de la ruta (niveles de carpeta desde la raíz)
        const pathSegments = window.location.pathname.split('/').filter(s => s.length > 0 && s !== 'index.html');
        let depth = 0;

        // Calcular la profundidad después de la raíz (ignorando el primer segmento si existe, que suele ser la raíz)
        if (pathSegments.length > 0) {
            // Si el primer segmento es 'pages', la cuenta comienza desde ahí.
            const pagesIndex = pathSegments.indexOf('pages');
            if (pagesIndex !== -1) {
                depth = pathSegments.length - pagesIndex; // Ej: ['pages', 'clubes', 'editarUsuario.html'] -> depth = 2
            } else {
                depth = pathSegments.length; // Ej: ['otra_pagina.html'] -> depth = 1
            }
        }

        // Si la página es la raíz o index.html, usar './'
        if (window.location.pathname === '/' || window.location.pathname.endsWith('/index.html')) {
            return './';
        }

        // De lo contrario, subir tantos niveles como profundidad - 1 (para ignorar el nombre del archivo)
        // Por ejemplo: /pages/clubes/editarUsuario.html necesita ../../
        return Array(depth).fill('../').join('');
    }

    const relativeToRootPrefix = getRelativeToRootPrefix();
    // -----------------------------------


    // 💥 MODIFICACIÓN CRÍTICA PARA DESHABILITAR Y OCULTAR SI NO HAY SESIÓN 💥
    if (!user) { // Si no hay usuario:
        if (userName) userName.style.display = "none";
        if (loginLink) loginLink.style.display = "block";

        if (logoutBtn) {
            logoutBtn.classList.add('disabled-link');
            logoutBtn.removeAttribute('href');
        }

        // Ocultar links específicos del usuario
        if (miClubLink) miClubLink.style.display = "none";
        if (presidenteClubLink) presidenteClubLink.style.display = "none"; // <-- OCULTAR SI NO HAY USUARIO

    } else {
        // Si el usuario está logueado, aseguramos que el botón esté habilitado
        if (logoutBtn) {
            logoutBtn.classList.remove('disabled-link');
            logoutBtn.href = "#";
        }

        // =========================================================
        // ⭐ LÓGICA DE VISIBILIDAD DE ENLACES DE CLUBES ⭐
        // =========================================================
        const clubId = user.club_id || user.clubId || clubIdInSession;
        // La validación de presidente debe ser robusta
        const isPresidente = user.is_presidente === 1 || user.is_presidente === true || user.role === "presidente" || user.role === "admin";

        // Quitar la barra inicial de las constantes para hacer la ruta relativa
        const clubPathPresidenteBase = CLUB_EDITAR_PRESIDENTE_PATH.substring(1);
        const clubPathUsuarioBase = CLUB_EDITAR_USUARIO_PATH.substring(1);


        // --- Lógica del Mi Club (Editar/Ver) ---
        if (clubId && miClubLink) {

            const targetPathBase = isPresidente ? clubPathPresidenteBase : clubPathUsuarioBase;

            miClubLink.href = `${relativeToRootPrefix}${targetPathBase}?id=${clubId}`;
            miClubLink.textContent = isPresidente ? "Mi Club (Presidente)" : "Mi Club";
            miClubLink.style.display = "block";
        } else if (miClubLink) {
            miClubLink.style.display = "none";
        }

        // --- Lógica del Presidente de Club (Solo si es presidente) ---
        // Este enlace es visible si el usuario es presidente Y tiene un club asignado.
        if (presidenteClubLink) {
            if (isPresidente && clubId) {
                presidenteClubLink.href = `${relativeToRootPrefix}${clubPathPresidenteBase}?id=${clubId}`;
                presidenteClubLink.style.display = "block";
            } else {
                presidenteClubLink.style.display = "none";
            }
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
        sessionStorage.removeItem("clubId"); // Limpiamos clubId

        // Ocultar el modal si está visible
        if (logoutConfirmModal) {
            logoutConfirmModal.hide();
        }

        redireccionExternaEnCurso = true;

        // Muestra alerta (requiere alertas.js)
        if (typeof mostrarAlerta === 'function') {
            if (isAutoLogout) {
                mostrarAlerta("Sesión expirada por inactividad.", "error");
            } else {
                mostrarAlerta("Sesión cerrada correctamente.", "exito");
            }
        }

        // Redirigir a la raíz absoluta
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

        // 🛑 LÓGICA CLAVE: DETECCIÓN DE ALERTA ROJA 🛑
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
            currentPath.endsWith('/') ||
            currentPath.includes(LOGIN_PAGE_PATH) ||
            currentPath.includes(REGISTER_PAGE_PATH) ||
            currentPath.includes(CALENDARIO_PAGE_PATH) ||
            currentPath.includes(CLUBES_PAGE_PATH);


        // ⭐ EJECUCIÓN DE LA GUARDIA PREDETERMINADA
        if (!isPublicPage && !redireccionExternaEnCurso) {

            redireccionExternaEnCurso = true;

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
    // 2. REDIRECCIÓN DEL LOGO
    // -----------------------------------------------------------------------------------
    if (logoLink) {
        if (user && user.role === "admin") {
            logoLink.href = ADMIN_DASHBOARD_HOME;
        } else {
            logoLink.href = "/index.html";
        }
    }

    // 3. REDIRECCIÓN DEL BOTÓN 'INICIO' DEL OFFCANVAS (Asumiendo que es el link con id="menu-inicio")
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

    // 4. LÓGICA DE CERRAR SESIÓN MANUAL (CORREGIDA)
    if (logoutBtn) {
        logoutBtn.addEventListener("click", (e) => {
            e.preventDefault();

            if (!user || redireccionExternaEnCurso) {
                if (!user && typeof mostrarAlerta === 'function') {
                    mostrarAlerta("No has iniciado sesión.", 'info');
                }
                return;
            }

            clearTimeout(inactivityTimeout);

            if (logoutConfirmModal) {
                const offcanvasMenu = bootstrap.Offcanvas.getInstance(document.getElementById('offcanvasMenu'));
                if (offcanvasMenu) offcanvasMenu.hide();

                logoutConfirmModal.show();
            } else {
                logoutUserAndRedirect();
            }
        });
    }

    // 5. LÓGICA DE CONFIRMACIÓN DEL MODAL
    if (btnConfirmLogout) {
        btnConfirmLogout.addEventListener("click", () => {
            logoutUserAndRedirect();
        });
    }

    // Opcional: Si se cierra el modal de logout sin confirmar, reiniciar el temporizador
    if (logoutConfirmModalEl && user) {
        logoutConfirmModalEl.addEventListener('hidden.bs.modal', function () {
            resetTimer();
        });
    }
});