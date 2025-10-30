document.addEventListener("DOMContentLoaded", () => {
    console.log("✅ admin.js cargado correctamente");

    // ==== 1. ELEMENTOS DE INTERFAZ ====
    const menuEventos = document.getElementById("menuEventos");
    const menuUsuarios = document.getElementById("menuUsuarios");
    const seccionEventos = document.getElementById("seccionEventos");
    const seccionUsuarios = document.getElementById("seccionUsuarios");
    const logoutBtn = document.getElementById("logoutBtn");
    const calendarEl = document.getElementById("calendar");
    const modalEl = document.getElementById("eventModal");

    // ==== 2. VERIFICACIÓN DE ACCESO (La Barrera Crítica) ====
    const usuario = JSON.parse(sessionStorage.getItem("usuario"));
    
    // **CORRECCIÓN CLAVE:** Asegurar que la redirección funciona con la ruta relativa.
    const loginPath = "../../auth/login/login.html"; // Ajusta esta ruta si es necesario

    if (!usuario || usuario.role !== "admin") {
        alert("❌ Acceso denegado. Solo administradores pueden acceder.");
        window.location.href = loginPath; 
        return; // Detiene la ejecución
    }

    // ==== 3. INICIALIZACIÓN DE COMPONENTES BOOTSTRAP ====
    // Esto es necesario para que el modal funcione (si decides restaurar su lógica)
    let eventModal;
    if (modalEl) {
         eventModal = new bootstrap.Modal(modalEl);
    }
    // NOTA: El Offcanvas se inicializa automáticamente si usas bootstrap.bundle.min.js

    // ==== 4. CERRAR SESIÓN ====
    document.addEventListener("click", (e) => {
        if (e.target && e.target.id === "logoutBtn") {
            e.preventDefault();
            sessionStorage.clear();
            window.location.href = loginPath; // Redirección al login
        }
    });

    // ==== 5. NAVEGACIÓN ENTRE SECCIONES ====
    if (menuEventos && menuUsuarios && seccionEventos && seccionUsuarios) {
        
        async function cargarUsuarios() {
            const usersList = document.getElementById("usersList");
            if (usersList) {
                usersList.textContent = "Cargando usuarios...";
                // Mostrar contenido de ejemplo
                usersList.innerHTML = `<p class="mt-3">La gestión de usuarios funciona. Ahora carga datos.</p>`;
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

    // ==== 6. FULLCALENDAR ====
    if (calendarEl) {
        let calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: "dayGridMonth",
            locale: "es",
            selectable: true,
            editable: false, 
            height: "auto",
            events: [{ title: 'Evento de prueba', start: new Date().toISOString().split('T')[0] }],
            // Lógica para abrir el modal al hacer click
            select: (info) => {
                // Aquí iría tu función openModal(info) si la restauras
                // eventModal.show();
            },
            eventClick: (info) => {
                // eventModal.show();
            }
        });
        calendar.render();
    } else {
        console.warn("⚠️ No se encontró el calendario.");
    }
});