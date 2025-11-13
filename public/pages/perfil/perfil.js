document.addEventListener('DOMContentLoaded', () => {
    // 1. Elementos del DOM
    const profileForm = document.getElementById('profile-form');
    const passwordForm = document.getElementById('password-form');
    const userNameElement = document.getElementById('user-name');
    const loginIcon = document.getElementById('login-icon');
    const logoutBtn = document.getElementById('logout-btn');

    // 2. Comprobación de autenticación y Carga Inicial
    const user = JSON.parse(localStorage.getItem('usuario'));

    if (!user || !user.id || !user.email) {
        // Si no hay usuario o faltan datos esenciales, redirigir al login
        mostrarAlerta("Sesión no válida o expirada. Por favor, inicia sesión.", 'error', 2000);
        setTimeout(() => {
            window.location.href = '../auth/login/login.html';
        }, 2000);
        return; // Detiene la ejecución del script
    }

    // Muestra datos en el NavBar
    userNameElement.textContent = user.name;
    loginIcon.style.display = 'none';

    // Llena los campos del formulario
    document.getElementById('user-id').value = user.id;
    document.getElementById('profile-name').value = user.name;
    document.getElementById('profile-email').value = user.email;


    // 3. Manejo de Cierre de Sesión (Logout)
    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem("usuario");

        mostrarAlerta("Has cerrado sesión correctamente.", 'error', 1500);

        // Cierra el offcanvas (si está abierto)
        const offcanvasMenu = bootstrap.Offcanvas.getInstance(document.getElementById('offcanvasMenu'));
        if (offcanvasMenu) {
            offcanvasMenu.hide();
        }

        setTimeout(() => {
            window.location.href = "../auth/login/login.html";
        }, 1500);
    });

    // 4. Manejo de Actualización de Perfil (Nombre)
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const id = document.getElementById('user-id').value;
        const newName = document.getElementById('profile-name').value.trim();
        const email = document.getElementById('profile-email').value; // El email no cambia

        if (newName === user.name) {
            mostrarAlerta("No hay cambios que guardar.", 'info');
            return;
        }

        try {
            // Simulación de llamada a la API
            // En una aplicación real, usarías 'fetch' aquí:
            // const response = await fetch('/api/user/updateProfile', { ... });

            // Suponiendo que la API devuelve éxito:

            // Actualizar LocalStorage
            user.name = newName;
            localStorage.setItem('usuario', JSON.stringify(user));
            userNameElement.textContent = newName;

            mostrarAlerta("Perfil actualizado correctamente.", 'success');

        } catch (error) {
            mostrarAlerta("Error al actualizar el perfil. Intenta de nuevo.", 'error');
        }
    });

    // 5. Manejo de Cambio de Contraseña
    passwordForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmNewPassword = document.getElementById('confirm-new-password').value;
        const userId = document.getElementById('user-id').value;

        if (newPassword !== confirmNewPassword) {
            mostrarAlerta("La nueva contraseña y la confirmación no coinciden.", 'error');
            return;
        }

        // La validación de longitud de contraseña debe ir aquí (ej. > 6 caracteres)

        try {
            // Simulación de llamada a la API
            // const response = await fetch('/api/user/changePassword', { 
            //     method: 'POST',
            //     headers: { 'Content-Type': 'application/json' },
            //     body: JSON.stringify({ userId, currentPassword, newPassword })
            // });

            // Simulación: Si la contraseña actual es '1234' -> Éxito
            if (currentPassword === '1234') {
                mostrarAlerta("Contraseña cambiada exitosamente.", 'success');
                // Cerrar modal
                const modalElement = document.getElementById('passwordModal');
                const modal = bootstrap.Modal.getInstance(modalElement);
                modal.hide();
                passwordForm.reset();
            } else {
                mostrarAlerta("Error: La contraseña actual es incorrecta.", 'error');
            }

        } catch (error) {
            mostrarAlerta("Error al intentar cambiar la contraseña.", 'error');
        }
    });
});