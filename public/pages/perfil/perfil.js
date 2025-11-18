document.addEventListener('DOMContentLoaded', () => {

    const profileForm = document.getElementById('profile-form');
    const passwordForm = document.getElementById('password-form');
    const carForm = document.getElementById('car-form');
    const carList = document.getElementById('car-list');
    const userNameElement = document.getElementById('user-name');
    const loginIcon = document.getElementById('login-icon');
    const logoutBtn = document.getElementById('logout-btn');
    const noCarsMessage = document.getElementById('no-cars-message');
    const deleteCarBtn = document.getElementById('delete-car-btn');
    const openAddCarBtn = document.getElementById('open-add-car-btn');

    let currentCarId = null;

    // 1) CARGAR USUARIO (sessionStorage)
    const stored = sessionStorage.getItem('usuario');
    if (!stored) {
        mostrarAlerta("Sesión expirada. Inicia sesión.", 'error');
        setTimeout(() => window.location.href = '../auth/login/login.html', 1200);
        return;
    }

    let user;
    try {
        user = JSON.parse(stored);
    } catch (err) {
        sessionStorage.removeItem('usuario');
        mostrarAlerta("Sesión corrupta. Vuelve a iniciar sesión.", 'error');
        setTimeout(() => window.location.href = '../auth/login/login.html', 1200);
        return;
    }

    // Mostrar en navbar
    userNameElement.textContent = user.name || 'Usuario';
    if (loginIcon) loginIcon.style.display = 'none';

    // Rellenar formulario
    document.getElementById('user-id').value = user.id || '';
    document.getElementById('profile-name').value = user.name || '';
    document.getElementById('profile-email').value = user.email || '';

    // === GARAJE ===
    const renderCar = (car) => {
        const defaultImg = 'https://via.placeholder.com/300x150?text=Sin+Foto';
        return `
      <div class="col-12 col-md-6" data-car-id="${car.id}">
        <div class="car-item" data-car-id="${car.id}">
          <div class="car-image-container">
            <img src="${car.photo_url || defaultImg}" alt="${car.car_name}" />
          </div>
          <div class="car-details">
            <h6 class="mb-1" style="color:#e50914;">${escapeHtml(car.car_name)}</h6>
            <p class="mb-0 text-muted">${escapeHtml(car.model || 'Modelo N/A')} (${car.year || 'Año N/A'})</p>
          </div>
        </div>
      </div>
    `;
    };

    function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

    function loadCars() {
        const storedCars = JSON.parse(localStorage.getItem('user_cars')) || [];
        carList.innerHTML = '';
        if (!storedCars.length) {
            noCarsMessage.style.display = 'block';
        } else {
            noCarsMessage.style.display = 'none';
            storedCars.forEach(car => carList.innerHTML += renderCar(car));
        }

        // Click to edit car
        carList.querySelectorAll('.car-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const el = item.closest('[data-car-id]');
                const id = parseInt(el.dataset.carId);
                const storedCars = JSON.parse(localStorage.getItem('user_cars')) || [];
                const car = storedCars.find(c => c.id === id);
                openCarModal(car);
                new bootstrap.Modal(document.getElementById('carModal')).show();
            });
        });

        localStorage.setItem('user_cars', JSON.stringify(JSON.parse(localStorage.getItem('user_cars') || '[]')));
    }

    loadCars();

    // Open add car
    openAddCarBtn.addEventListener('click', () => {
        openCarModal(null);
        new bootstrap.Modal(document.getElementById('carModal')).show();
    });

    function openCarModal(car) {
        carForm.reset();
        currentCarId = null;
        if (car) {
            document.getElementById('carModalTitle').textContent = 'Editar coche';
            document.getElementById('car-id').value = car.id;
            document.getElementById('car-name').value = car.car_name;
            document.getElementById('car-model').value = car.model || '';
            document.getElementById('car-year').value = car.year || '';
            document.getElementById('car-photo').value = car.photo_url || '';
            currentCarId = car.id;
            deleteCarBtn.style.display = 'inline-block';
        } else {
            document.getElementById('carModalTitle').textContent = 'Añadir coche';
            deleteCarBtn.style.display = 'none';
        }
    }

    // Save car
    carForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const carData = {
            id: currentCarId || Date.now(),
            user_id: user.id,
            car_name: document.getElementById('car-name').value.trim(),
            model: document.getElementById('car-model').value.trim(),
            year: document.getElementById('car-year').value.trim() || null,
            description: '',
            photo_url: document.getElementById('car-photo').value.trim()
        };

        let storedCars = JSON.parse(localStorage.getItem('user_cars')) || [];
        if (currentCarId) {
            const idx = storedCars.findIndex(c => c.id === currentCarId);
            if (idx !== -1) storedCars[idx] = carData;
            mostrarAlerta('Coche actualizado', 'success');
        } else {
            storedCars.push(carData);
            mostrarAlerta('Coche añadido', 'success');
        }
        localStorage.setItem('user_cars', JSON.stringify(storedCars));
        loadCars();
        const modal = bootstrap.Modal.getInstance(document.getElementById('carModal'));
        if (modal) modal.hide();
    });

    // Delete car
    deleteCarBtn.addEventListener('click', () => {
        if (!currentCarId) return;
        if (!confirm('¿Eliminar este coche?')) return;
        let storedCars = JSON.parse(localStorage.getItem('user_cars')) || [];
        storedCars = storedCars.filter(c => c.id !== currentCarId);
        localStorage.setItem('user_cars', JSON.stringify(storedCars));
        loadCars();
        mostrarAlerta('Coche eliminado', 'error');
        const modal = bootstrap.Modal.getInstance(document.getElementById('carModal'));
        if (modal) modal.hide();
    });

    // PROFILE: Save (name + email). Email change requires verification (contraseña actual)
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newName = document.getElementById('profile-name').value.trim();
        const newEmail = document.getElementById('profile-email').value.trim();

        // If nothing changed
        if (newName === (user.name || '') && newEmail === (user.email || '')) {
            mostrarAlerta('No hay cambios que guardar.', 'info');
            return;
        }

        // If email changed -> ask for current password (verification)
        if (newEmail !== (user.email || '')) {
            const pwd = prompt('Para cambiar el correo introduce tu contraseña actual:');
            if (pwd === null) {
                mostrarAlerta('Cambio de correo cancelado.', 'info');
                return;
            }
            // Compare with session password if exists
            if (!user.password) {
                mostrarAlerta('No hay contraseña en sesión para verificar. Inicia sesión de nuevo.', 'error');
                return;
            }
            if (pwd !== user.password) {
                mostrarAlerta('Contraseña incorrecta. No se cambió el correo.', 'error');
                return;
            }
            // If you want, here you could call API to update email server-side.
        }

        // Save locally in sessionStorage
        user.name = newName;
        user.email = newEmail;
        sessionStorage.setItem('usuario', JSON.stringify(user));
        userNameElement.textContent = newName;

        mostrarAlerta('Datos actualizados correctamente.', 'success');
    });

    // PASSWORD CHANGE: use modal, validate against session password
    document.getElementById('passwordModal').addEventListener('show.bs.modal', () => {
        passwordForm.reset();
    });

    passwordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const actual = document.getElementById('current-password').value;
        const nueva = document.getElementById('new-password').value;
        const repetir = document.getElementById('confirm-new-password').value;

        if (nueva !== repetir) {
            mostrarAlerta('Las contraseñas no coinciden', 'error');
            return;
        }

        if (!user.password) {
            mostrarAlerta('No hay contraseña en sesión para verificar. Inicia sesión de nuevo.', 'error');
            return;
        }

        if (actual !== user.password) {
            mostrarAlerta('Contraseña actual incorrecta', 'error');
            return;
        }

        // Success: update sessionStorage
        user.password = nueva;
        sessionStorage.setItem('usuario', JSON.stringify(user));

        // Optional: attempt to update on server via PUT /api/userList (if exists)
        try {
            const res = await fetch('/api/userList', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: user.id, password: nueva })
            });
            // If backend returns non-success, ignore but warn
            if (res.ok) {
                const json = await res.json();
                if (!json.success) {
                    // server-side refused update; we still updated local session
                    mostrarAlerta('Contraseña actualizada localmente. No se actualizó en el servidor.', 'info');
                } else {
                    mostrarAlerta('Contraseña actualizada correctamente.', 'success');
                }
            } else {
                mostrarAlerta('Contraseña actualizada localmente. No se pudo actualizar en servidor.', 'info');
            }
        } catch (err) {
            mostrarAlerta('Contraseña actualizada localmente. Error conexión servidor.', 'info');
        }

        const modal = bootstrap.Modal.getInstance(document.getElementById('passwordModal'));
        if (modal) modal.hide();
    });

    // LOGOUT
    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        sessionStorage.clear();
        mostrarAlerta('Sesión cerrada', 'success');
        setTimeout(() => window.location.href = '../auth/login/login.html', 700);
    });

    // helper to ensure menu "Inicio" points depending on role (navbar.js already does similar)
    const menuInicio = document.getElementById('menu-inicio');
    if (menuInicio) {
        menuInicio.addEventListener('click', (ev) => {
            ev.preventDefault();
            if (user && user.role === 'admin') {
                window.location.href = '/pages/dashboard/admin/admin.html';
            } else {
                window.location.href = '/index.html';
            }
        });
    }

});