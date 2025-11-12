// Mostrar alerta centrada
function showAlert(message, type = "info") {
  const alert = document.createElement("div");
  alert.className = `custom-alert ${type}`;
  alert.textContent = message;
  document.body.appendChild(alert);

  setTimeout(() => alert.classList.add("show"), 10);
  setTimeout(() => {
    alert.classList.remove("show");
    setTimeout(() => alert.remove(), 300);
  }, 2500);
}

// Mostrar confirmación tipo modal
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
    onConfirm?.();
    modal.remove();
  };

  modal.querySelector(".modal-btn-no").onclick = () => modal.remove();
}
