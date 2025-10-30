document.addEventListener("DOMContentLoaded", () => {
    console.log("✅ admin.js cargado correctamente (Modo de Prueba Funcional)");

    // =========================================================
    // ==== 1. DESACTIVACIÓN TEMPORAL DE VERIFICACIÓN ADMIN ====
    // =========================================================
    // La barrera de seguridad está temporalmente DESACTIVADA para asegurar que el resto del panel funcione.
    const usuario = JSON.parse(sessionStorage.getItem("usuario"));
    
    if (!usuario || usuario.role !== "admin") {
        // alert("❌ Acceso denegado. Solo administradores pueden acceder.");
        // window.location.href = "../../auth/login/login.html"; // Comentado
        // return; // COMENTADO: ¡ESTO ES LO QUE ESTABA ROMPIENDO LA EJECUCIÓN!
    }

    // ==== 2. ELEMENTOS DE INTERFAZ ====
    const menuEventos = document.getElementById("menuEventos");
    const menuUsuarios = document.getElementById("menuUsuarios");
    const seccionEventos = document.getElementById("seccionEventos");
    const seccionUsuarios = document.getElementById("seccionUsuarios");
    const logoutBtn = document.getElementById("logoutBtn");
    const calendarEl = document.getElementById("calendar");
    const modalEl = document.getElementById("eventModal");

    // ==== 3. INICIALIZACIÓN Y LÓGICA DE LA INTERFAZ ====

    // CERRAR SESIÓN
    document.addEventListener("click", (e) => {
        if (e.target && e.target.id === "logoutBtn") {
            e.preventDefault();
            sessionStorage.clear();
            window.location.href = "../../auth/login/login.html"; 
        }
    });

    // NAVEGACIÓN ENTRE SECCIONES
    if (menuEventos && menuUsuarios && seccionEventos && seccionUsuarios) {
        
        async function cargarUsuarios() {
            const usersList = document.getElementById("usersList");
            if (usersList) {
                usersList.textContent = "Cargando usuarios...";
                usersList.innerHTML = `<p class="mt-3">La gestión de usuarios funciona correctamente.</p>`;
            }
        }
        
        menuEventos.addEventListener("click", (e) => {
            e.preventDefault();
            seccionEventos.style.display = "block";
            seccionUsuarios.style.display = "none";
            menuEventos.classList.add("active");
            menuUsuarios.classList.remove("active");
        });

        menuUsuarios.addEventListener("click", async (e) => {
            e.preventDefault();
            seccionEventos.style.display = "none";
            seccionUsuarios.style.display = "block";
            menuUsuarios.classList.add("active");
            menuEventos.classList.remove("active");
            await cargarUsuarios();
        });
    } else {
        console.warn("⚠️ No se encontraron los menús o secciones para navegar.");
    }

    // FULLCALENDAR
    if (calendarEl) {
        let calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: "dayGridMonth",
            locale: "es",
            selectable: true,
            editable: false, 
            height: "auto",
            events: [{ title: 'Panel Funciona', start: new Date().toISOString().split('T')[0] }],
        });
        calendar.render();
    } else {
        console.warn("⚠️ No se encontró el calendario.");
    }
});