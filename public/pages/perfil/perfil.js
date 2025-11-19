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

    // ⭐ NUEVOS ELEMENTOS DE IMAGEN ⭐
    const carPhotoFileInput = document.getElementById('carPhotoFile');
    const carPhotoUrlInput = document.getElementById('car-photo-url'); // Nuevo ID
    const carPhotoPreview = document.getElementById('carPhotoPreview');
    const carPhotoContainer = document.getElementById('carPhotoContainer');
    const clearCarPhotoBtn = document.getElementById('clearCarPhotoBtn');

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

    // ⭐ FUNCIÓN RENDERCAR ACTUALIZADA CON EL DISEÑO DE TARJETA MEJORADO ⭐
    function renderCar(car) {
        // Usar imagen de Cloudinary si existe, si no, usar la placeholder
        const defaultImg = 'https://via.placeholder.com/400x225?text=Sin+Foto'; // Placeholder 16:9
        const imgSrc = escapeHtml(car.photo_url) || defaultImg;

        return `
        <div class="col-12 col-sm-6 col-md-6 col-lg-6" data-car-id="${car.id}">
            <div class="car-card" data-car-id="${car.id}" role="button" tabindex="0">
                <div class="car-image-container">
                    <img src="${imgSrc}" 
                         alt="Foto de ${escapeHtml(car.car_name)}" 
                         loading="lazy"
                         onerror="this.onerror=null;this.src='${defaultImg}';" />
                </div>
                <div class="car-details-content">
                    <div class="car-name-group">
                        <h5 class="car-name">${escapeHtml(car.car_name)}</h5>
                        <p class="car-model-year">
                            ${escapeHtml(car.model || 'Modelo N/A')} (${car.year || 'Año N/A'})
                        </p>
                    </div>
                    <button class="btn btn-edit-car">
                        <i class="bi bi-pencil-square"></i>
                    </button>
                </div>
            </div>
        </div>`;
    }

    async function loadCars() {
        try {
            const resp = await fetch(`/api/carGarage?user_id=${encodeURIComponent(user.id)}`);
            if (!resp.ok) throw new Error('Error al cargar coches');
            const data = await resp.json();

            carList.innerHTML = '';

            if (!data.cars || !data.cars.length) {
                noCarsMessage.style.display = 'block';
                return;
            }

            noCarsMessage.style.display = 'none';
            data.cars.forEach(car => carList.innerHTML += renderCar(car));

            // ⭐ EVENT LISTENER EN LA NUEVA CLASE .car-card ⭐
            carList.querySelectorAll('.car-card').forEach(item => {
                item.addEventListener('click', () => {
                    const el = item.closest('[data-car-id]');
                    const id = parseInt(el.dataset.carId);
                    const car = data.cars.find(c => c.id === id);
                    openCarModal(car);
                    new bootstrap.Modal(document.getElementById('carModal')).show();
                });
            });

        } catch (e) { console.error(e); }
    }

    loadCars();

    // ⭐ LÓGICA DE PREVISUALIZACIÓN Y LIMPIEZA DE IMAGEN DEL COCHE ⭐

    // Previsualizar nuevo archivo seleccionado
    carPhotoFileInput.addEventListener('change', function () {
        const file = this.files[0];

        if (file) {
            const fileUrl = URL.createObjectURL(file);
            carPhotoPreview.src = fileUrl;
            carPhotoContainer.style.display = 'block';
        } else {
            // Si el usuario cancela la selección, mostramos la URL existente si la hay
            if (carPhotoUrlInput.value) {
                carPhotoPreview.src = carPhotoUrlInput.value;
                carPhotoContainer.style.display = 'block';
            } else {
                carPhotoContainer.style.display = 'none';
            }
        }
    });

    // Botón para eliminar la imagen
    clearCarPhotoBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        carPhotoUrlInput.value = ""; // Clave: Esto indica al backend que la URL debe ser NULL
        carPhotoFileInput.value = ""; // Limpia el archivo subido
        carPhotoContainer.style.display = 'none';
        carPhotoPreview.src = '';
    });


    // ⭐ MODIFICACIÓN DE openCarModal ⭐
    function openCarModal(car) {
        carForm.reset();
        currentCarId = null;

        // Limpiar campos de imagen
        carPhotoFileInput.value = "";
        carPhotoUrlInput.value = "";
        carPhotoContainer.style.display = 'none';
        carPhotoPreview.src = '';


        if (car) {
            document.getElementById('carModalTitle').textContent = 'Editar coche';
            document.getElementById('car-id').value = car.id;
            document.getElementById('car-name').value = car.car_name;
            document.getElementById('car-model').value = car.model || '';
            document.getElementById('car-year').value = car.year || '';
            document.getElementById('car-description').value = car.description || '';

            // ⭐ Lógica de la imagen existente ⭐
            if (car.photo_url) {
                carPhotoUrlInput.value = car.photo_url;
                carPhotoPreview.src = car.photo_url;
                carPhotoContainer.style.display = 'block';
            }

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

    // ⭐ MODIFICACIÓN DE carForm.submit PARA USAR FORMDATA ⭐
    carForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const id = currentCarId;
        const carName = document.getElementById('car-name').value.trim();

        if (!carName) {
            mostrarAlerta('El nombre del coche es obligatorio', 'advertencia');
            return;
        }

        // 1. CREAR FORMDATA
        const formData = new FormData();
        formData.append('user_id', user.id);
        formData.append('car_name', carName);
        formData.append('model', document.getElementById('car-model').value.trim() || '');
        formData.append('year', document.getElementById('car-year').value.trim() || '');
        formData.append('description', document.getElementById('car-description').value.trim() || '');

        if (id) {
            formData.append('id', id);
        }

        // 2. LÓGICA DE LA IMAGEN
        const file = carPhotoFileInput.files[0];
        const currentURL = carPhotoUrlInput.value;

        if (file) {
            // Caso 1: Nuevo archivo subido. Se añade como 'imageFile'
            formData.append('imageFile', file);
        } else {
            // Caso 2: No hay archivo nuevo. Se envía la URL existente o vacía como 'photoURL'
            formData.append('photoURL', currentURL);
        }

        try {
            const url = id ? `/api/carGarage?id=${id}` : "/api/carGarage";

            const resp = await fetch(url, {
                method: id ? 'PUT' : 'POST',
                body: formData // ⭐ CLAVE: Enviamos el FormData
            });

            const json = await resp.json();
            if (!resp.ok || !json.ok) throw new Error(json.msg || 'Fallo en la respuesta del servidor.');

            mostrarAlerta(id ? 'Coche actualizado' : 'Coche añadido', 'exito');

            await loadCars();
            const modal = bootstrap.Modal.getInstance(document.getElementById('carModal'));
            if (modal) modal.hide();

        } catch (e) {
            console.error("Error al guardar el coche:", e);
            mostrarAlerta('Error guardando coche. ' + e.message, 'error');
        }
    });

    // ... (El resto de funciones auxiliares y manejadores de perfil/contraseña quedan sin cambios) ...

    /**
     * Muestra una ventana de confirmación centralizada con el estilo de la app (negro/rojo).
     * @param {string} mensaje - Mensaje a mostrar.
     * @param {string} [confirmText='Confirmar'] - Texto del botón de confirmación.
     * @returns {Promise<boolean>} Resuelve a true si se confirma, false si se cancela.
     */
    function mostrarConfirmacion(mensaje = '¿Confirmar?', confirmText = 'Confirmar') {
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
            btnConfirm.textContent = confirmText; // Usamos el texto dinámico
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

        // Usamos 'Eliminar' como texto de confirmación
        const confirmar = await mostrarConfirmacion('¿Seguro que quieres eliminar este coche?', 'Eliminar');
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

        // ⭐ PASO 1: PEDIR CONFIRMACIÓN PARA GUARDAR CAMBIOS DE PERFIL
        const confirmar = await mostrarConfirmacion('¿Quieres guardar los cambios de tu perfil?', 'Guardar');
        if (!confirmar) {
            mostrarAlerta('Guardado cancelado', 'info');
            return;
        }

        const payload = { id: user.id, name: newName, email: newEmail };

        try {
            // RUTA SINGULAR: /api/userList
            const resp = await fetch('/api/userList', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const json = await resp.json(); // Leemos la respuesta

            // Lógica de éxito en la BD
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

        // ⭐ PASO 2: PEDIR CONFIRMACIÓN PARA ACTUALIZAR CONTRASEÑA
        const confirmar = await mostrarConfirmacion('¿Quieres actualizar tu contraseña?', 'Actualizar');
        if (!confirmar) {
            mostrarAlerta('Actualización cancelada', 'info');
            return;
        }

        try {
            // RUTA SINGULAR: /api/userList
            const resp = await fetch('/api/userList', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: user.id, password: nueva })
            });

            const json = await resp.json(); // Leemos la respuesta

            // Lógica de éxito en la BD
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
    });

    // Añadir lógica de cierre de sesión
    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        sessionStorage.removeItem('usuario');
        mostrarAlerta("Sesión cerrada. ¡Vuelve pronto!", 'info');
        setTimeout(() => window.location.href = '/index.html', 1000);
    });

});