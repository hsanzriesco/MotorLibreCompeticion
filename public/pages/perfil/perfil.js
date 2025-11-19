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

    // ⭐ NUEVOS ELEMENTOS DEL MODAL PARA MOTOS/COCHES ⭐
    const vehicleTypeSelect = document.getElementById('vehicle-type-select');
    const vehicleTypeInput = document.getElementById('vehicle-type'); // Hidden input
    const vehicleNameLabel = document.getElementById('vehicle-name-label');
    // ⭐ FIN NUEVOS ELEMENTOS ⭐

    // ⭐ ELEMENTOS DE IMAGEN ⭐
    const carPhotoFileInput = document.getElementById('carPhotoFile');
    const carPhotoUrlInput = document.getElementById('car-photo-url');
    const carPhotoPreview = document.getElementById('carPhotoPreview');
    const carPhotoContainer = document.getElementById('carPhotoContainer');
    const clearCarPhotoBtn = document.getElementById('clearCarPhotoBtn');

    let currentVehicle = null; // Almacenará { id, type, ...datos }

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

    // ⭐ FUNCIÓN RENDERIZADO DE VEHÍCULOS (COCHE O MOTO) ⭐
    function renderVehicle(vehicle) {
        // Determina si es coche o moto
        const isCar = vehicle.type === 'car';
        const nameKey = isCar ? 'car_name' : 'motorcycle_name';
        const name = vehicle[nameKey];

        // Usar imagen de Cloudinary si existe, si no, usar la placeholder específica
        const defaultImg = isCar
            ? 'https://via.placeholder.com/400x225?text=Coche+Sin+Foto'
            : 'https://via.placeholder.com/400x225?text=Moto+Sin+Foto';
        const imgSrc = escapeHtml(vehicle.photo_url) || defaultImg;

        return `
        <div class="col-12 col-sm-6 col-md-6 col-lg-6" data-vehicle-id="${vehicle.id}" data-vehicle-type="${vehicle.type}">
            <div class="car-card" role="button" tabindex="0">
                <div class="car-image-container">
                    <img src="${imgSrc}" 
                         alt="Foto de ${escapeHtml(name)}" 
                         loading="lazy"
                         onerror="this.onerror=null;this.src='${defaultImg}';" />
                </div>
                <div class="car-details-content">
                    <div class="car-name-group">
                        <h5 class="car-name">${escapeHtml(name)} (${isCar ? 'Coche' : 'Moto'})</h5>
                        <p class="car-model-year">
                            ${escapeHtml(vehicle.model || 'Modelo N/A')} (${vehicle.year || 'Año N/A'})
                        </p>
                    </div>
                    <button class="btn btn-edit-car">
                        <i class="bi bi-pencil-square"></i>
                    </button>
                </div>
            </div>
        </div>`;
    }

    // ⭐ FUNCIÓN CARGA DE VEHÍCULOS (COCHES + MOTOS) ⭐
    async function loadVehicles() {
        try {
            const userId = encodeURIComponent(user.id);

            // 1. Cargar Coches
            const carsResp = await fetch(`/api/carGarage?user_id=${userId}`);
            const carsData = await carsResp.json();
            const cars = (carsData.cars || []).map(c => ({
                ...c,
                type: 'car'
            }));

            // 2. Cargar Motos (usando la ruta motosGarage)
            const bikesResp = await fetch(`/api/motosGarage?user_id=${userId}`);
            const bikesData = await bikesResp.json();
            const motorcycles = (bikesData.motorcycles || []).map(m => ({
                ...m,
                type: 'motorcycle',
                // Para simplificar la compatibilidad con el modal, mapeamos 'motorcycle_name' a 'car_name'
                car_name: m.motorcycle_name
            }));

            // 3. Combinar y mostrar
            const allVehicles = [...cars, ...motorcycles];
            carList.innerHTML = '';

            if (!allVehicles.length) {
                noCarsMessage.style.display = 'block';
                return;
            }

            noCarsMessage.style.display = 'none';
            allVehicles.forEach(v => carList.innerHTML += renderVehicle(v));

            // ⭐ EVENT LISTENER para abrir modal ⭐
            carList.querySelectorAll('.car-card').forEach(item => {
                item.addEventListener('click', () => {
                    const el = item.closest('[data-vehicle-id]');
                    const id = parseInt(el.dataset.vehicleId);
                    const type = el.dataset.vehicleType;
                    const vehicle = allVehicles.find(v => v.id === id && v.type === type);

                    if (vehicle) {
                        openCarModal(vehicle);
                        new bootstrap.Modal(document.getElementById('carModal')).show();
                    }
                });
            });

        } catch (e) {
            console.error("Error al cargar vehículos:", e);
            mostrarAlerta("Error al cargar el garaje.", 'error');
        }
    }

    loadVehicles();

    // ⭐ LÓGICA DE CAMBIO DE SELECTOR EN EL MODAL ⭐
    vehicleTypeSelect.addEventListener('change', (e) => {
        const selectedType = e.target.value;
        const nameLabel = selectedType === 'car' ? 'Nombre del coche' : 'Nombre de la moto';
        vehicleNameLabel.textContent = nameLabel;
        vehicleTypeInput.value = selectedType; // Actualiza el hidden input
    });


    // ⭐ LÓGICA DE PREVISUALIZACIÓN Y LIMPIEZA DE IMAGEN DEL VEHÍCULO ⭐
    carPhotoFileInput.addEventListener('change', function () {
        const file = this.files[0];

        if (file) {
            const fileUrl = URL.createObjectURL(file);
            carPhotoPreview.src = fileUrl;
            carPhotoContainer.style.display = 'block';
        } else {
            if (carPhotoUrlInput.value) {
                carPhotoPreview.src = carPhotoUrlInput.value;
                carPhotoContainer.style.display = 'block';
            } else {
                carPhotoContainer.style.display = 'none';
            }
        }
    });

    clearCarPhotoBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        carPhotoUrlInput.value = "";
        carPhotoFileInput.value = "";
        carPhotoContainer.style.display = 'none';
        carPhotoPreview.src = '';
    });


    // ⭐ MODIFICACIÓN DE openCarModal (Ahora maneja VEHÍCULOS) ⭐
    function openCarModal(vehicle) {
        carForm.reset();
        currentVehicle = null;

        // Limpiar campos de imagen
        carPhotoFileInput.value = "";
        carPhotoUrlInput.value = "";
        carPhotoContainer.style.display = 'none';
        carPhotoPreview.src = '';


        if (vehicle) {
            currentVehicle = vehicle;
            const isCar = vehicle.type === 'car';
            const nameKey = isCar ? 'car_name' : 'motorcycle_name';

            document.getElementById('carModalTitle').textContent = `Editar ${isCar ? 'coche' : 'moto'}`;
            document.getElementById('car-id').value = vehicle.id;
            document.getElementById('car-name').value = vehicle[nameKey];
            document.getElementById('car-model').value = vehicle.model || '';
            document.getElementById('car-year').value = vehicle.year || '';
            document.getElementById('car-description').value = vehicle.description || '';

            // Setear el selector
            vehicleTypeSelect.value = vehicle.type;
            vehicleTypeSelect.disabled = true; // No permitir cambiar el tipo al editar
            vehicleTypeInput.value = vehicle.type;

            // Actualizar label
            vehicleNameLabel.textContent = isCar ? 'Nombre del coche' : 'Nombre de la moto';

            // Lógica de la imagen existente
            if (vehicle.photo_url) {
                carPhotoUrlInput.value = vehicle.photo_url;
                carPhotoPreview.src = vehicle.photo_url;
                carPhotoContainer.style.display = 'block';
            }

            deleteCarBtn.style.display = 'inline-block';
        } else {
            document.getElementById('carModalTitle').textContent = 'Añadir vehículo';
            vehicleTypeSelect.value = 'car'; // Default a coche
            vehicleTypeSelect.disabled = false; // Permitir cambiar al añadir
            vehicleTypeInput.value = 'car';
            vehicleNameLabel.textContent = 'Nombre del coche';
            deleteCarBtn.style.display = 'none';
        }
    }

    openAddCarBtn.addEventListener('click', () => {
        openCarModal(null);
        new bootstrap.Modal(document.getElementById('carModal')).show();
    });

    // ⭐ MODIFICACIÓN DE carForm.submit PARA VEHÍCULOS ⭐
    carForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const id = currentVehicle ? currentVehicle.id : null;
        const type = vehicleTypeInput.value;
        const isCar = type === 'car';
        const nameInput = document.getElementById('car-name').value.trim();

        if (!nameInput) {
            mostrarAlerta(`El nombre del ${isCar ? 'coche' : 'moto'} es obligatorio`, 'advertencia');
            return;
        }

        // 1. CREAR FORMDATA
        const formData = new FormData();
        formData.append('user_id', user.id);

        // CLAVE: Usar el nombre de campo correcto según el tipo de vehículo
        formData.append(isCar ? 'car_name' : 'motorcycle_name', nameInput);

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
            formData.append('imageFile', file);
        } else {
            formData.append('photoURL', currentURL);
        }

        try {
            // CLAVE: Seleccionar la API correcta
            const apiSegment = isCar ? 'carGarage' : 'motosGarage';
            const url = id ? `/api/${apiSegment}?id=${id}` : `/api/${apiSegment}`;

            const resp = await fetch(url, {
                method: id ? 'PUT' : 'POST',
                body: formData
            });

            const json = await resp.json();
            if (!resp.ok || !json.ok) throw new Error(json.msg || 'Fallo en la respuesta del servidor.');

            mostrarAlerta(id ? 'Vehículo actualizado' : 'Vehículo añadido', 'exito');

            await loadVehicles(); // Recargar la lista combinada
            const modal = bootstrap.Modal.getInstance(document.getElementById('carModal'));
            if (modal) modal.hide();

        } catch (e) {
            console.error("Error al guardar el vehículo:", e);
            mostrarAlerta('Error guardando vehículo. ' + e.message, 'error');
        }
    });

    // ⭐ MODIFICACIÓN DE deleteCarBtn PARA VEHÍCULOS ⭐
    deleteCarBtn.addEventListener('click', async () => {
        if (!currentVehicle) return;

        const isCar = currentVehicle.type === 'car';
        const itemName = isCar ? 'coche' : 'moto';

        const confirmar = await mostrarConfirmacion(`¿Seguro que quieres eliminar este ${itemName}?`, 'Eliminar');
        if (!confirmar) {
            mostrarAlerta('Eliminación cancelada', 'info');
            return;
        }

        try {
            // CLAVE: Seleccionar la API correcta
            const apiSegment = isCar ? 'carGarage' : 'motosGarage';
            const resp = await fetch(`/api/${apiSegment}?id=${encodeURIComponent(currentVehicle.id)}`, { method: 'DELETE' });
            if (!resp.ok) throw 0;

            mostrarAlerta('Vehículo eliminado', 'exito');
            await loadVehicles();
            const modal = bootstrap.Modal.getInstance(document.getElementById('carModal'));
            if (modal) modal.hide();

        } catch {
            mostrarAlerta('Error eliminando vehículo.', 'error');
        }
    });

    // *******************************************************************
    // EL RESTO DE FUNCIONES DE PERFIL, CONTRASEÑA Y CONFIRMACIÓN NO CAMBIAN
    // *******************************************************************

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