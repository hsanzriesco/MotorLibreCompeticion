// === alert.js ===
export function showAlert(message, type = "success") {
  // Crear contenedor si no existe
  let container = document.querySelector(".alert-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "alert-container";
    document.body.appendChild(container);
  }

  // Crear alerta
  const alertBox = document.createElement("div");
  alertBox.className = `custom-alert ${type}`;
  alertBox.textContent = message;

  // Insertar y mostrar
  container.appendChild(alertBox);
  setTimeout(() => alertBox.classList.add("visible"), 50);

  // Eliminar tras 3s
  setTimeout(() => {
    alertBox.classList.remove("visible");
    setTimeout(() => alertBox.remove(), 500);
  }, 3000);
}
