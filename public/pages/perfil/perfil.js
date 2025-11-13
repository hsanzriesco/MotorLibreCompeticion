document.addEventListener("DOMContentLoaded", async () => {
    // CAMBIO: Usamos localStorage para ser consistentes con el HTML y el index.html
    const user = JSON.parse(localStorage.getItem("usuario")); 

    // ===========================
    // CONTROL DE ACCESO
    // ===========================
    if (!user) {
        // USO DE LA ALERTA GLOBAL: mostrarAlerta(mensaje, tipo, duracion)
        mostrarAlerta("⚠️ Debes iniciar sesión para acceder a tu perfil.", "error", 2000); 
        setTimeout(() => {
            // Ajusta esta ruta si es necesario, basándome en la estructura actual
            window.location.href = "/pages/auth/login/login.html"; 
        }, 2000);
        return;
    }

    // Mostrar nombre actual del usuario
    const usernameDisplay = document.getElementById("usernameDisplay");
    if (usernameDisplay) usernameDisplay.textContent = user.name;

    // ===========================
    // CAMBIAR NOMBRE DE USUARIO
    // ===========================
    const nameForm = document.getElementById("updateNameForm");
    if (nameForm) {
        nameForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const newName = document.getElementById("newUsername").value.trim();
            // USO DE LA ALERTA GLOBAL
            if (!newName) return mostrarAlerta("Introduce un nombre válido", "error"); 

            try {
                const res = await fetch("/api/userActions/updateName", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: user.id, newName }),
                });

                const result = await res.json();
                if (result.success) {
                    // USO DE LA ALERTA GLOBAL
                    mostrarAlerta("Nombre actualizado correctamente", "exito"); 
                    user.name = newName;
                    // CAMBIO: Usamos localStorage para persistencia
                    localStorage.setItem("usuario", JSON.stringify(user)); 
                    usernameDisplay.textContent = newName;
                } else {
                    // USO DE LA ALERTA GLOBAL
                    mostrarAlerta(result.message, "error"); 
                }
            } catch (err) {
                console.error(err);
                // USO DE LA ALERTA GLOBAL
                mostrarAlerta("Error al actualizar el nombre", "error"); 
            }
        });
    }

    // ===========================
    // CAMBIAR CONTRASEÑA
    // ===========================
    const passwordForm = document.getElementById("updatePasswordForm");
    if (passwordForm) {
        passwordForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const newPassword = document.getElementById("newPassword").value.trim();
            const confirmPassword = document.getElementById("confirmPassword").value.trim();

            if (!newPassword || !confirmPassword)
                 // USO DE LA ALERTA GLOBAL
                return mostrarAlerta("Completa todos los campos", "error"); 

            if (newPassword !== confirmPassword)
                 // USO DE LA ALERTA GLOBAL
                return mostrarAlerta("Las contraseñas no coinciden", "error"); 

            try {
                const res = await fetch("/api/userActions/updatePassword", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: user.id, newPassword }),
                });

                const result = await res.json();
                if (result.success) {
                    // USO DE LA ALERTA GLOBAL
                    mostrarAlerta("Contraseña actualizada correctamente", "exito"); 
                    passwordForm.reset();
                } else {
                    // USO DE LA ALERTA GLOBAL
                    mostrarAlerta(result.message, "error"); 
                }
            } catch (err) {
                console.error(err);
                // USO DE LA ALERTA GLOBAL
                mostrarAlerta("Error al actualizar la contraseña", "error"); 
            }
        });
    }

    // ===========================
    // AÑADIR COCHE
    // ===========================
    const carForm = document.getElementById("addCarForm");
    if (carForm) {
        carForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const carName = document.getElementById("carName").value.trim();
            const carImage = document.getElementById("carImage").files[0];

            // USO DE LA ALERTA GLOBAL
            if (!carName) return mostrarAlerta("Introduce el nombre del coche", "error"); 

            const formData = new FormData();
            formData.append("userId", user.id);
            formData.append("carName", carName);
            if (carImage) formData.append("carImage", carImage);

            try {
                const res = await fetch("/api/userActions/addCar", {
                    method: "POST",
                    body: formData,
                });

                const result = await res.json();
                if (result.success) {
                    // USO DE LA ALERTA GLOBAL
                    mostrarAlerta("Coche añadido correctamente", "exito"); 
                    carForm.reset();
                    loadCars();
                } else {
                    // USO DE LA ALERTA GLOBAL
                    mostrarAlerta(result.message, "error"); 
                }
            } catch (err) {
                console.error(err);
                // USO DE LA ALERTA GLOBAL
                mostrarAlerta("Error al añadir el coche", "error"); 
            }
        });
    }

    // ===========================
    // CARGAR COCHES DEL USUARIO
    // ===========================
    async function loadCars() {
        const garageContainer = document.getElementById("garageContainer");
        if (!garageContainer) return;

        try {
            const res = await fetch(`/api/userActions/getCars?userId=${user.id}`);
            const data = await res.json();

            garageContainer.innerHTML = "";
            if (data.cars && data.cars.length > 0) {
                data.cars.forEach((car) => {
                    const card = document.createElement("div");
                    card.classList.add("car-card");

                    card.innerHTML = `
                        <img src="${car.image_url || '/img/default-car.jpg'}" alt="Coche" class="car-img">
                        <p class="car-name">${car.name}</p>
                    `;
                    garageContainer.appendChild(card);
                });
            } else {
                garageContainer.innerHTML = "<p>No tienes coches añadidos.</p>";
            }
        } catch (err) {
            console.error(err);
            // USO DE LA ALERTA GLOBAL
            mostrarAlerta("Error al cargar los coches", "error"); 
        }
    }

    loadCars();
});