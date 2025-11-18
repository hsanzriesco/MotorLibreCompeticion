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

    const stored = sessionStorage.getItem('usuario');
    if (!stored) {
        mostrarAlerta("Sesión expirada. Inicia sesión.", 'error');
        setTimeout(() => window.location.href = '../auth/login/login.html', 1200);
        return;
    }

    let user;
    try { user = JSON.parse(stored); }
    catch (err) {
        sessionStorage.removeItem('usuario');
        mostrarAlerta("Sesión corrupta. Vuelve a iniciar sesión.", 'error');
        setTimeout(() => window.location.href = '../auth/login/login.html', 1200);
        return;
    }

    userNameElement.textContent = user.name || 'Usuario';
    if (loginIcon) loginIcon.style.display = 'none';

    document.getElementById('user-id').value = user.id || '';
    document.getElementById('profile-name').value = user.name || '';
    document.getElementById('profile-email').value = user.email || '';

    function escapeHtml(s) {
        return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function renderCar(car) {
        const defaultImg = 'https://via.placeholder.com/300x150?text=Sin+Foto';
        return `
      <div class="col-12 col-md-6" data-car-id="${car.id}">
        <div class="car-item" data-car-id="${car.id}" style="cursor:pointer;">
          <div class="car-image-container" style="width:120px;">
            <img src="${escapeHtml(car.photo_url) || defaultImg}" alt="${escapeHtml(car.car_name)}" style="width:100%; border-radius:6px;" />
          </div>
          <div class="car-details" style="padding-left:12px;">
            <h6 class="mb-1" style="color:#e50914;">${escapeHtml(car.car_name)}</h6>
            <p class="mb-0 text-muted">${escapeHtml(car.model || 'Modelo N/A')} (${car.year || 'Año N/A'})</p>
          </div>
        </div>
      </div>`;
    }

    async function loadCars() {
        try {
            // Nota: Se asume que /api/carGarage está implementado en otro lugar.
            const resp = await fetch(`/api/carGarage?user_id=${encodeURIComponent(user.id)}`);
            if (!resp.ok) throw new Error();
            const data = await resp.json();

            carList.innerHTML = '';

            if (!data.cars || !data.cars.length) {
                noCarsMessage.style.display = 'block';
                return;
            }

            noCarsMessage.style.display = 'none';
            data.cars.forEach(car => carList.innerHTML += renderCar(car));

            carList.querySelectorAll('.car-item').forEach(item => {
                item.addEventListener('click', () => {
                    const el = item.closest('[data-car-id]');
                    const id = parseInt(el.dataset.carId);
                    const car = data.cars.find(c => c.id === id);
                    openCarModal(car);
                    new bootstrap.Modal(document.getElementById('carModal')).show();
                });
            });

        } catch { }
    }

    loadCars();

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

    openAddCarBtn.addEventListener('click', () => {
        openCarModal(null);
        new bootstrap.Modal(document.getElementById('carModal')).show();
    });

    carForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const carData = {
            id: currentCarId || null,
            user_id: user.id,
            car_name: document.getElementById('car-name').value.trim(),
            model: document.getElementById('car-model').value.trim(),
            year: document.getElementById('car-year').value.trim() || null,
            description: '',
            photo_url: document.getElementById('car-photo').value.trim()
        };

        if (!carData.car_name) {
            mostrarAlerta('El nombre del coche es obligatorio', 'advertencia');
            return;
        }

        try {
            let resp;

            if (currentCarId) {
                // Asume que la actualización de coche está en /api/carGarage (PUT)
                resp = await fetch('/api/carGarage', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: carData.id,
                        car_name: carData.car_name,
                        model: carData.model,
                        year: carData.year,
                        description: carData.description,
                        photo_url: carData.photo_url
                    })
                });
                if (!resp.ok) throw 0;
                mostrarAlerta('Coche actualizado', 'exito');
            } else {
                // Asume que añadir coche está en /api/carGarage (POST) o en userAction (el problema de tu backend)
                resp = await fetch('/api/carGarage', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(carData)
                });
                if (!resp.ok) throw 0;
                mostrarAlerta('Coche añadido', 'exito');
            }

            await loadCars();
            const modal = bootstrap.Modal.getInstance(document.getElementById('carModal'));
            if (modal) modal.hide();

        } catch {
            mostrarAlerta('Error guardando coche.', 'error');
        }
    });

    function mostrarConfirmacion(mensaje = '¿Confirmar?') {
        return new Promise((resolve) => {
            if (document.getElementById('mlc-confirm-overlay')) {
                resolve(false);
                return;
            }

            const overlay = document.createElement('div');
            overlay.id = 'mlc-confirm-overlay';
            overlay.style.position = 'fixed';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100%';
            overlay.style.height = '100%';
            overlay.style.display = 'flex';
            overlay.style.alignItems = 'center';
            overlay.style.justifyContent = 'center';
            overlay.style.background = 'rgba(0,0,0,0.6)';
            overlay.style.zIndex = '20000';

            const box = document.createElement('div');
            box.style.background = '#0b0b0b';
            box.style.border = '1px solid rgba(229,9,20,0.4)';
            box.style.padding = '18px';
            box.style.borderRadius = '12px';
            box.style.width = '90%';
            box.style.maxWidth = '420px';
            box.style.boxShadow = '0 10px 30px rgba(229,9,20,0.12)';
            box.style.color = '#fff';
            box.style.textAlign = 'center';

            const text = document.createElement('p');
            text.style.margin = '0 0 14px 0';
            text.style.fontSize = '1rem';
            text.textContent = mensaje;

            const btnRow = document.createElement('div');
            btnRow.style.display = 'flex';
            btnRow.style.gap = '12px';
            btnRow.style.justifyContent = 'center';

            const btnCancel = document.createElement('button');
            btnCancel.className = 'btn';
            btnCancel.textContent = 'Cancelar';
            btnCancel.style.background = 'transparent';
            btnCancel.style.border = '1px solid rgba(255,255,255,0.12)';
            btnCancel.style.color = '#fff';
            btnCancel.style.padding = '8px 14px';
            btnCancel.style.borderRadius = '8px';

            const btnConfirm = document.createElement('button');
            btnConfirm.className = 'btn';
            btnConfirm.textContent = 'Eliminar';
            btnConfirm.style.background = '#e50914';
            btnConfirm.style.border = '1px solid rgba(229,9,20,0.9)';
            btnConfirm.style.color = '#fff';
            btnConfirm.style.padding = '8px 14px';
            btnConfirm.style.borderRadius = '8px';

            btnRow.appendChild(btnCancel);
            btnRow.appendChild(btnConfirm);
            box.appendChild(text);
            box.appendChild(btnRow);
            overlay.appendChild(box);
            document.body.appendChild(overlay);

            btnConfirm.focus();

            function cleanup(x) {
                overlay.remove();
                resolve(!!x);
            }

            btnCancel.addEventListener('click', () => cleanup(false), { once: true });
            btnConfirm.addEventListener('click', () => cleanup(true), { once: true });
            document.addEventListener('keydown', e => { if (e.key === 'Escape') cleanup(false); }, { once: true });
        });
    }

    deleteCarBtn.addEventListener('click', async () => {
        if (!currentCarId) return;

        const confirmar = await mostrarConfirmacion('¿Seguro que quieres eliminar este coche?');
        if (!confirmar) {
            mostrarAlerta('Eliminación cancelada', 'info');
            return;
        }

        try {
            const resp = await fetch(`/api/carGarage?id=${encodeURIComponent(currentCarId)}`, { method: 'DELETE' });
            if (!resp.ok) throw 0;

            mostrarAlerta('Coche eliminado', 'exito');
            await loadCars();
            const modal = bootstrap.Modal.getInstance(document.getElementById('carModal'));
            if (modal) modal.hide();

        } catch {
            mostrarAlerta('Error eliminando coche.', 'error');
        }
    });

    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const newName = document.getElementById('profile-name').value.trim();
        const newEmail = document.getElementById('profile-email').value.trim();

        if (newName === (user.name || '') && newEmail === (user.email || '')) {
            mostrarAlerta('No hay cambios que guardar.', 'info');
            return;
        }

        const payload = { id: user.id, name: newName, email: newEmail };

        try {
            const resp = await fetch('/api/userList', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const json = await resp.json(); // Leemos la respuesta

            // 💡 CORRECCIÓN PRINCIPAL AQUÍ:
            if (resp.ok && json && json.success === true) {
                user.name = newName;
                user.email = newEmail;
                sessionStorage.setItem('usuario', JSON.stringify(user));
                userNameElement.textContent = newName;
                mostrarAlerta('Datos actualizados correctamente.', 'exito');
                return;
            }

            // Lógica de fallback si el servidor responde mal (aunque en teoría ya está actualizado)
            user.name = newName;
            user.email = newEmail;
            sessionStorage.setItem('usuario', JSON.stringify(user));
            userNameElement.textContent = newName;
            mostrarAlerta('Error en la respuesta del servidor. Datos actualizados localmente.', 'info');

        } catch {
            // Lógica de error de red
            user.name = newName;
            user.email = newEmail;
            sessionStorage.setItem('usuario', JSON.stringify(user));
            userNameElement.textContent = newName;
            mostrarAlerta('Error de red. Datos actualizados localmente.', 'info');
        }
    });

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
            mostrarAlerta('Error interno. Contraseña anterior no disponible.', 'error');
            return;
        }

        // ⚠️ ADVERTENCIA: Esta verificación es insegura, la contraseña no debería estar en sessionStorage
        if (actual !== user.password) {
            mostrarAlerta('Contraseña actual incorrecta', 'error');
            return;
        }

        const confirmar = await mostrarConfirmacion('¿Quieres actualizar tu contraseña?');
        if (!confirmar) {
            mostrarAlerta('Actualización cancelada', 'info');
            return;
        }

        try {
            const resp = await fetch('/api/userList', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: user.id, password: nueva })
            });

            const json = await resp.json(); // Leemos la respuesta

            // 💡 CORRECCIÓN PRINCIPAL AQUÍ:
            if (resp.ok && json && json.success === true) {
                user.password = nueva;
                sessionStorage.setItem('usuario', JSON.stringify(user));
                mostrarAlerta('Contraseña actualizada correctamente.', 'exito');
            } else {
                // Lógica de fallback si el servidor responde mal
                user.password = nueva;
                sessionStorage.setItem('usuario', JSON.stringify(user));
                mostrarAlerta('Error en la respuesta del servidor. Contraseña actualizada localmente.', 'info');
            }
        } catch {
            // Lógica de error de red
            user.password = nueva;
            sessionStorage.setItem('usuario', JSON.stringify(user));
            mostrarAlerta('Error de red. Contraseña actualizada localmente.', 'info');
        }

        const modal = bootstrap.Modal.getInstance(document.getElementById('passwordModal'));
        if (modal) modal.hide();
    });

    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        sessionStorage.clear();
        mostrarAlerta('Sesión cerrada', 'exito');
        setTimeout(() => window.location.href = '../auth/login/login.html', 700);
    });

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