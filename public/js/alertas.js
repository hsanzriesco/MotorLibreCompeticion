// Mostrar alerta superior centrada (sin animaciones)
function showAlert(message, type = "info", duration = 3000) {
  const alert = document.createElement("div");
  alert.className = `custom-alert ${type}`;
  alert.textContent = message;
  document.body.appendChild(alert);

  // Eliminar automáticamente después del tiempo indicado
  setTimeout(() => alert.remove(), duration);
}

// Mostrar confirmación (centrada en el medio de la página)
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
