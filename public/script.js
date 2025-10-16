document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("registerForm");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = form.name.value;
        const email = form.email.value;
        const password = form.password.value;
        const msg = document.getElementById("msg");
        msg.innerHTML = '<div class="alert alert-info">Registrando...</div>';

        try {
            const res = await fetch("/api/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, password })
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || "Error en el registro");

            msg.innerHTML = '<div class="alert alert-success">Usuario registrado correctamente ✅</div>';
            form.reset();
        } catch (err) {
            msg.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
        }
    });
});
