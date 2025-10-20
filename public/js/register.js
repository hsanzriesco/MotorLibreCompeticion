document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("registerForm");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = document.getElementById("username").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    if (!username || !email || !password) {
      alert("Por favor, completa todos los campos.");
      return;
    }

    try {
      // Petición al backend (Neon vía Vercel)
      const res = await fetch("https://motor-libre-competicion.vercel.app/api/createUser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        alert("✅ Usuario registrado correctamente");
        // Guardar temporalmente en localStorage (solo si quieres usarlo para mostrar el nombre)
        localStorage.setItem("user", JSON.stringify({ username }));

        // Redirigir al login
        window.location.href = "../login/login.html";
      } else {
        alert(`❌ ${data.error || "Error al registrar usuario"}`);
      }
    } catch (err) {
      console.error("Error:", err);
      alert("⚠️ Ocurrió un error al conectar con el servidor");
    }
  });
});
