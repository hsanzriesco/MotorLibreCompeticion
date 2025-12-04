// Cargar lista de clubes al entrar en la página
document.addEventListener("DOMContentLoaded", cargarClubes);


// ======================================================
//               OBTENER CLUBES
// ======================================================
async function cargarClubes() {
    try {
        const res = await fetch("/api/clubs");
        const clubes = await res.json();

        const cont = document.getElementById("clubesLista");

        if (clubes.length === 0) {
            cont.innerHTML = "<p>No hay clubes creados todavía.</p>";
            return;
        }

        cont.innerHTML = clubes.map(c => `
            <div class="club-card">
                <h3>${c.nombre}</h3>
                <p>${c.descripcion || "Sin descripción"}</p>

                ${c.imagen ? `<img src="${c.imagen}" width="180" style="border-radius:5px;">` : ""}

                <br><br>
                <button onclick="unirme(${c.id})">Unirme</button>
            </div>
        `).join("");

    } catch (error) {
        console.error("Error cargando clubes:", error);
    }
}


// ======================================================
//               CREAR CLUB
// ======================================================
async function crearClub() {
    const nombre = document.getElementById("clubNombre").value.trim();
    const descripcion = document.getElementById("clubDescripcion").value.trim();
    const imagen = document.getElementById("clubImagen").value.trim();

    if (!nombre) return alert("El nombre del club es obligatorio");

    try {
        const res = await fetch("/api/clubs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nombre, descripcion, imagen })
        });

        const data = await res.json();

        alert("Club creado con éxito");
        cargarClubes();
    } catch (error) {
        console.error("Error al crear club:", error);
        alert("Error al crear el club");
    }
}


// ======================================================
//               UNIRSE A UN CLUB
// ======================================================
async function unirme(clubID) {

    // Aquí supongo que tienes guardado el ID del usuario logueado
    const userID = localStorage.getItem("userID");

    if (!userID) {
        alert("Debes iniciar sesión");
        return;
    }

    try {
        const res = await fetch("/api/clubs/join", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ club_id: clubID, user_id: userID })
        });

        const text = await res.text();
        alert(text);

    } catch (error) {
        console.error("Error al unirse al club:", error);
        alert("Error al unirse al club");
    }
}
