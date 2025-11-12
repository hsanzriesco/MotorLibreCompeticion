// Mostrar alerta superior (bajo el navbar)
function showAlert(message, type = "info", duration = 3000) {
  const alert = document.createElement("div");
  alert.className = `custom-alert ${type}`;
  alert.textContent = message;
  document.body.appendChild(alert);

  setTimeout(() => alert.classList.add("show"), 10);
  setTimeout(() => {
    alert.classList.remove("show");
    setTimeout(() => alert.remove(), 300);
  }, duration);
}

// Mostrar confirmación centrada en pantalla
function showConfirm(message, onConfirm) {
  const modal = document.createElement("div");
  modal.classList.add("modal-confirm");

  modal.innerHTML = `
    <div class="modal-confirm-content">
      <p>${message}</p>
      <div class="modal-confirm-buttons">
        <button class="modal-btn-yes">Sí</button>
        <button class="modal-btn-no">No</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector(".modal-btn-yes").onclick = () => {
    onConfirm?.(true);
    modal.remove();
  };

  modal.querySelector(".modal-btn-no").onclick = () => {
    onConfirm?.(false);
    modal.remove();
  };
}
