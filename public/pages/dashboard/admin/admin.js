document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ admin.js cargado correctamente");

  // ==== 1. ELEMENTOS DE INTERFAZ (DEBE SER LO PRIMERO) ====
  const menuEventos = document.getElementById("menuEventos");
  const menuUsuarios = document.getElementById("menuUsuarios");
  const seccionEventos = document.getElementById("seccionEventos");
  const seccionUsuarios = document.getElementById("seccionUsuarios");
  const logoutBtn = document.getElementById("logoutBtn");

  // ==== 2. VERIFICACIÓN DE ACCESO (La barrera de seguridad) ====
  const usuario = JSON.parse(sessionStorage.getItem("usuario"));
  if (!usuario || usuario.role !== "admin") {
    alert("❌ Acceso denegado. Solo administradores pueden acceder.");
    // Asegúrate de que esta RUTA sea correcta
    window.location.href = "/pages/auth/login/login.html"; 
    return; // Detiene la ejecución si no es admin
  }

  // ==== 3. CERRAR SESIÓN ====
  document.addEventListener("click", (e) => {
    if (e.target && e.target.id === "logoutBtn") {
      e.preventDefault();
      sessionStorage.clear();
      window.location.href = "/pages/auth/login/login.html";
    }
  });

  // ==== 4. NAVEGACIÓN ENTRE SECCIONES (Ahora funciona sin el warning) ====
  if (menuEventos && menuUsuarios && seccionEventos && seccionUsuarios) {
    
    // Función de carga de usuarios (dejada como marcador de posición)
    async function cargarUsuarios() {
      const usersList = document.getElementById("usersList");
      if (usersList) {
          usersList.textContent = "Cargando usuarios...";
          // **AQUÍ IRÍA LA LLAMADA A LA API REAL:**
          // const res = await fetch("/api/userList"); 
          // ...
          usersList.innerHTML = "<p>Contenido de la gestión de usuarios (Simulación).</p>";
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
      await cargarUsuarios(); // Llama a la función simplificada
    });
  } else {
    console.warn("⚠️ No se encontraron los menús o secciones para navegar.");
  }

  // ==== 5. FULLCALENDAR (Solo inicialización, se elimina la lógica de modales) ====
  const calendarEl = document.getElementById("calendar");
  if (calendarEl) {
    let calendar = new FullCalendar.Calendar(calendarEl, {
      initialView: "dayGridMonth",
      locale: "es",
      selectable: false, // Desactivado para simplificar
      editable: false, 
      height: "auto",
      events: [{ title: 'Evento de prueba', start: new Date().toISOString().split('T')[0] }]
      
      // **LA LÓGICA COMPLETA DE EVENTOS Y MODALES FUE ELIMINADA DE AQUÍ**
      
    });
    calendar.render();
  } else {
    console.warn("⚠️ No se encontró el calendario.");
  }
});