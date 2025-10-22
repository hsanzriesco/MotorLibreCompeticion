export function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = "toast-message";
  toast.textContent = message;

  if (type === "error") toast.style.backgroundColor = "#dc3545"; // rojo
  if (type === "info") toast.style.backgroundColor = "#0d6efd"; // azul

  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 100);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}
