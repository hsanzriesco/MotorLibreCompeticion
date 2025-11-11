document.addEventListener("DOMContentLoaded", async () => {
  const user = JSON.parse(sessionStorage.getItem("usuario"));
  if (!user) {
    window.location.href = "../../../index.html";
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
      if (!newName) {
        showAlert("Introduce un nombre válido", "error");
        return;
      }

      try {
        const res = await fetch("/api/userActions/updateName", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: user.id, newName }),
        });

        const result = await res.json();
        if (result.success) {
          showAlert("Nombre actualizado correctamente", "success");
          user.name = newName;
          sessionStorage.setItem("usuario", JSON.stringify(user));
          usernameDisplay.textContent = newName;
        } else {
          showAlert(result.message, "error");
        }
      } catch (err) {
        console.error(err);
        showAlert("Error al actualizar el nombre", "error");
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

      if (!newPassword || !confirmPassword) {
        showAlert("Completa todos los campos", "error");
        return;
      }

      if (newPassword !== confirmPassword) {
        showAlert("Las contraseñas no coinciden", "error");
        return;
      }

      try {
        const res = await fetch("/api/userActions/updatePassword", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: user.id, newPassword }),
        });

        const result = await res.json();
        if (result.success) {
          showAlert("Contraseña actualizada correctamente", "success");
          passwordForm.reset();
        } else {
          showAlert(result.message, "error");
        }
      } catch (err) {
        console.error(err);
        showAlert("Error al actualizar la contraseña", "error");
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

      if (!carName) {
        showAlert("Introduce el nombre del coche", "error");
        return;
      }

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
          showAlert("Coche añadido correctamente", "success");
          carForm.reset();
          loadCars();
        } else {
          showAlert(result.message, "error");
        }
      } catch (err) {
        console.error(err);
        showAlert("Error al añadir el coche", "error");
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
            <img src="${car.image_url || '../../../img/default-car.jpg'}" alt="Coche" class="car-img">
            <p class="car-name">${car.name}</p>
          `;
          garageContainer.appendChild(card);
        });
      } else {
        garageContainer.innerHTML = "<p>No tienes coches añadidos.</p>";
      }
    } catch (err) {
      console.error(err);
      showAlert("Error al cargar los coches", "error");
    }
  }

  loadCars();

  // ===========================
  // ALERTAS BONITAS
  // ===========================
  function showAlert(message, type = "info") {
    const alert = document.createElement("div");
    alert.className = `custom-alert ${type}`;
    alert.textContent = message;
    document.body.appendChild(alert);

    setTimeout(() => alert.classList.add("show"), 50);
    setTimeout(() => {
      alert.classList.remove("show");
      setTimeout(() => alert.remove(), 300);
    }, 3000);
  }
});
