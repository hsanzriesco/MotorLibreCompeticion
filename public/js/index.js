document.addEventListener("DOMContentLoaded", async () => {
    const usuario = JSON.parse(localStorage.getItem("usuario"));
    const bienvenida = document.getElementById("bienvenida");
    const userName = document.getElementById("user-name");
    const loginLink = document.getElementById("login-link");
    const logoutBtn = document.getElementById("logout-btn");

    // Mostrar saludo si hay usuario logueado
    if (usuario) {
        if (bienvenida) bienvenida.textContent = `👋 Bienvenido, ${usuario.name}!`;
        if (userName) userName.textContent = usuario.name;
        if (loginLink) loginLink.style.display = "none";
    }

    // Cerrar sesión
    if (logoutBtn) {
        logoutBtn.addEventListener("click", (e) => {
            e.preventDefault();
            localStorage.removeItem("usuario");

            const message = document.createElement("div");
            message.textContent = "👋 Has cerrado sesión correctamente.";
            message.classList.add("logout-message");
            document.body.appendChild(message);

            setTimeout(() => {
                message.remove();
                window.location.href = "./pages/auth/login/login.html";
            }, 1500);
        });
    }

    // Iniciamos el calendario para los eventos
    const calendarEl = document.getElementById("calendar");
    if (calendarEl) {
        const calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: "dayGridMonth",
            locale: "es",
            events: async (fetchInfo, successCallback, failureCallback) => {
                try {
                    const res = await fetch("/api/events");
                    const data = await res.json();
                    if (data.success) successCallback(data.data);
                    else failureCallback();
                } catch (err) {
                    console.error("Error al cargar eventos:", err);
                    failureCallback(err);
                }
            },
        });
        calendar.render();
    }
});
