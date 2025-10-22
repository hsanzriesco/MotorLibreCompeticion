// /public/js/toast.js

export function showToast(message, type = "success") {
  const toastContainer = document.createElement("div");
  toastContainer.className = `custom-toast ${type}`;
  toastContainer.textContent = message;
  document.body.appendChild(toastContainer);

  setTimeout(() => toastContainer.classList.add("visible"), 100);
  setTimeout(() => {
    toastContainer.classList.remove("visible");
    setTimeout(() => toastContainer.remove(), 500);
  }, 3000);
}
