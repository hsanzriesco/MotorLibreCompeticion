document.addEventListener('DOMContentLoaded', () => {

    // --- Selectores de Elementos ---
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

    // ELEMENTOS DEL MODAL DE CONTRASEÑA
    const passwordModal = document.getElementById('passwordModal');
    const newPasswordInput = document.getElementById('new-password');
    const confirmNewPasswordInput = document.getElementById('confirm-new-password');


    // ELEMENTOS DEL MODAL DE VEHÍCULO
    const carModal = document.getElementById('carModal'); // Obtenemos el DOM
    const carModalTitle = document.getElementById('carModalTitle');
    const carIdInput = document.getElementById('car-id');
    const carNameInput = document.getElementById('car-name');
    const carModelInput = document.getElementById('car-model');
    const carYearInput = document.getElementById('car-year');
    const carDescriptionInput = document.getElementById('car-description');

    // ELEMENTOS DE TIPO DE VEHÍCULO
    const vehicleTypeSelect = document.getElementById('vehicle-type-select');
    const vehicleTypeInput = document.getElementById('vehicle-type'); // Hidden input
    const vehicleNameLabel = document.getElementById('vehicle-name-label');

    // ELEMENTOS DE IMAGEN
    const carPhotoFileInput = document.getElementById('carPhotoFile');
    const carPhotoUrlInput = document.getElementById('car-photo-url');
    const carPhotoPreview = document.getElementById('carPhotoPreview');
    const carPhotoContainer = document.getElementById('carPhotoContainer');
    const clearCarPhotoBtn = document.getElementById('clearCarPhotoBtn');

    let currentVehicle = null;
    let user;

    // --- Carga Inicial de Usuario ---
    const stored = sessionStorage.getItem('usuario');
    if (!stored) {
        mostrarAlerta("Sesión expirada. Inicia sesión.", 'error');
        setTimeout(() => window.location.href = '../auth/login/login.html', 1200);
        return;
    }

    try {
        user = JSON.parse(stored);
    } catch (err) {
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

    // Función de saneamiento de HTML (XSS prevention)
    function escapeHtml(s) {
        return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }


    // *******************************************************************
    // ⭐ MODIFICACIÓN: VISUALIZACIÓN DE CONTRASEÑA CON ÍCONOS DE BOOTSTRAP ⭐
    // *******************************************************************

    /**
     * Configura la funcionalidad de alternar la visibilidad de la contraseña
     * usando los íconos bi-eye-slash y bi-eye.
     */
    const setupPasswordToggle = () => {
        document.querySelectorAll('.toggle-password').forEach(icon => {
            icon.addEventListener('click', function () {
                // 1. Obtener el ID del input objetivo
                const targetId = this.getAttribute('data-target-id');
                const passwordInput = document.getElementById(targetId);

                if (!passwordInput) return;

                // 2. Comprobar el tipo de input y cambiarlo
                const isPassword = passwordInput.type === 'password';
                passwordInput.type = isPassword ? 'text' : 'password';

                // 3. Cambiar la clase del ícono (bi-eye-slash <-> bi-eye)
                this.classList.toggle('bi-eye-slash', !isPassword);
                this.classList.toggle('bi-eye', isPassword);

                // Opcional: Mantener el foco en el campo después de hacer clic
                passwordInput.focus();
            });
        });
    };

    // Inicializar el toggle al cargar la página
    setupPasswordToggle();

    // *******************************************************************
    // ⭐ FIN MODIFICACIÓN DE CONTRASEÑA ⭐
    // *******************************************************************


    // --- FUNCIÓN RENDERIZADO DE VEHÍCULOS (COCHE O MOTO) ---
    function renderVehicle(vehicle) {
        const isCar = vehicle.type === 'car';
        // Usa la clave correcta: 'car_name' o 'motorcycle_name'
        const nameKey = isCar ? 'car_name' : 'motorcycle_name';
        const name = vehicle[nameKey];

        const defaultImg = isCar
            ? 'https://via.placeholder.com/400x225/e50914/FFFFFF?text=Coche+Sin+Foto'
            : 'https://via.placeholder.com/400x225/0e0e0e/FFFFFF?text=Moto+Sin+Foto';
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

    // --- FUNCIÓN CARGA DE VEHÍCULOS (COCHES + MOTOS) ---
    async function loadVehicles() {
        const allVehicles = [];
        const userId = encodeURIComponent(user.id);

        let carsHtml = '';
        let motorcyclesHtml = '';

        // 1. Cargar Coches
        try {
            const carsResp = await fetch(`/api/carGarage?user_id=${userId}`);
            const carsData = await carsResp.json();
            const cars = (carsData.cars || []).map(c => ({
                ...c,
                type: 'car'
            }));
            allVehicles.push(...cars);

            // Renderizar coches si hay
            if (cars.length > 0) {
                carsHtml += '<h3 class="vehicle-section-title">Coches</h3><div class="row">';
                cars.forEach(car => {
                    carsHtml += renderVehicle(car);
                });
                carsHtml += '</div>';
            }

        } catch (e) {
            console.error("Error al cargar coches:", e.message);
        }

        // 2. Cargar Motos
        try {
            const bikesResp = await fetch(`/api/motosGarage?user_id=${userId}`);
            const bikesData = await bikesResp.json();
            const motorcycles = (bikesData.motorcycles || []).map(m => ({
                ...m,
                type: 'motorcycle',
            }));
            allVehicles.push(...motorcycles);

            // Renderizar motos si hay
            if (motorcycles.length > 0) {
                motorcyclesHtml += '<h3 class="vehicle-section-title">Motos</h3><div class="row">';
                motorcycles.forEach(moto => {
                    motorcyclesHtml += renderVehicle(moto);
                });
                motorcyclesHtml += '</div>';
            }
        } catch (e) {
            console.error("Error al cargar motos:", e.message);
        }

        // 3. Combinar y mostrar con el Separador
        carList.innerHTML = '';
        let finalHtml = '';

        if (!allVehicles.length) {
            noCarsMessage.style.display = 'block';
            return;
        }

        noCarsMessage.style.display = 'none';

        // 3.1. Añadir Coches
        finalHtml += carsHtml;

        // 3.2. ⭐ Insertar Separador si hay COCHES Y MOTOS ⭐
        if (carsHtml.length > 0 && motorcyclesHtml.length > 0) {
            finalHtml += '<hr class="vehicle-separator">';
        }

        // 3.3. Añadir Motos
        finalHtml += motorcyclesHtml;

        carList.innerHTML = finalHtml; // Renderizamos todo el contenido combinado

        // Event Listener para abrir modal al hacer clic en el vehículo
        carList.querySelectorAll('.car-card').forEach(item => {
            item.addEventListener('click', () => {
                const el = item.closest('[data-vehicle-id]');
                const id = parseInt(el.dataset.vehicleId);
                const type = el.dataset.vehicleType;
                const vehicle = allVehicles.find(v => v.id === id && v.type === type);

                if (vehicle) {
                    openCarModal(vehicle);
                    // Obtener la instancia de Bootstrap justo antes de mostrar
                    new bootstrap.Modal(carModal).show();
                }
            });
        });
    }

    // --- Lógica del Modal de Vehículo ---
    function updateCarModalUI(type, isEdit = false) {
        const isCar = type === 'car';
        vehicleTypeInput.value = type;

        // Actualizar título y etiqueta
        carModalTitle.textContent = isEdit ? `Editar ${isCar ? 'Coche' : 'Moto'}` : `Añadir ${isCar ? 'Coche' : 'Moto'}`;
        vehicleNameLabel.textContent = isCar ? 'Nombre del coche' : 'Nombre de la moto';
        vehicleTypeSelect.disabled = isEdit;
    }

    // MODIFICACIÓN de openCarModal (Ahora maneja VEHÍCULOS)
    function openCarModal(vehicle = null) {
        carForm.reset();
        currentVehicle = vehicle;

        // Limpiar campos de imagen
        carPhotoFileInput.value = "";
        carPhotoUrlInput.value = "";
        carPhotoContainer.style.display = 'none';
        carPhotoPreview.src = '';

        const isEdit = !!vehicle;
        const type = isEdit ? vehicle.type : 'car';

        if (vehicle) {
            const isCar = vehicle.type === 'car';
            const nameKey = isCar ? 'car_name' : 'motorcycle_name';

            carIdInput.value = vehicle.id;
            carNameInput.value = vehicle[nameKey]; // Usa la clave correcta
            carModelInput.value = vehicle.model || '';
            carYearInput.value = vehicle.year || '';
            carDescriptionInput.value = vehicle.description || '';

            // Lógica de la imagen existente
            if (vehicle.photo_url) {
                carPhotoUrlInput.value = vehicle.photo_url;
                carPhotoPreview.src = vehicle.photo_url;
                carPhotoContainer.style.display = 'block';
            }

            deleteCarBtn.style.display = 'inline-block';
        } else {
            carIdInput.value = '';
            deleteCarBtn.style.display = 'none';
        }

        // Configuración final de UI (Tanto para editar como para añadir)
        vehicleTypeSelect.value = type;
        updateCarModalUI(type, isEdit);
    }

    // --- Listeners de Eventos del Garaje ---

    // Abrir modal de añadir
    openAddCarBtn.addEventListener('click', () => {
        openCarModal(null);
        new bootstrap.Modal(carModal).show();
    });

    // Cambiar etiqueta cuando cambia el tipo en el modal (Solo al AÑADIR)
    vehicleTypeSelect.addEventListener('change', (e) => {
        if (!currentVehicle) { // Solo si estamos en modo "Añadir"
            const newType = e.target.value;
            updateCarModalUI(newType, false);
        }
    });

    // LÓGICA DE PREVISUALIZACIÓN Y LIMPIEZA DE IMAGEN DEL VEHÍCULO
    carPhotoFileInput.addEventListener('change', function () {
        const file = this.files[0];
        if (file) {
            const fileUrl = URL.createObjectURL(file);
            carPhotoPreview.src = fileUrl;
            carPhotoContainer.style.display = 'block';
            carPhotoUrlInput.value = 'FILE_PENDING'; // Marcador temporal
        } else {
            // Si el usuario borra la selección del input file, respetamos la URL previa si existe.
            if (carPhotoUrlInput.value && carPhotoUrlInput.value !== 'FILE_PENDING') {
                carPhotoPreview.src = carPhotoUrlInput.value;
                carPhotoContainer.style.display = 'block';
            } else {
                carPhotoUrlInput.value = '';
                carPhotoContainer.style.display = 'none';
            }
        }
    });

    clearCarPhotoBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        carPhotoUrlInput.value = ""; // Borrar URL existente
        carPhotoFileInput.value = ""; // Borrar archivo seleccionado
        carPhotoContainer.style.display = 'none';
        carPhotoPreview.src = '';
    });


    // --- Lógica de Sometimiento del Formulario de Vehículo ---
    carForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const id = carIdInput.value;
        const type = vehicleTypeInput.value;
        const isCar = type === 'car';
        const nameInput = carNameInput.value.trim();

        // ⭐ VALIDACIÓN DE AÑO ⭐
        const vehicleYear = parseInt(carYearInput.value.trim());
        const currentYear = new Date().getFullYear();

        if (isNaN(vehicleYear) || vehicleYear < 1900) {
            mostrarAlerta(`El año del vehículo no es válido. Debe ser un número entre 1900 y ${currentYear}.`, 'error');
            return;
        }

        // 🚨 VERIFICACIÓN DE AÑO SUPERIOR
        if (vehicleYear > currentYear) {
            mostrarAlerta(`El año del vehículo (${vehicleYear}) no puede ser superior al año actual (${currentYear}).`, 'error');
            return; // Detiene el envío del formulario
        }
        // ⭐ FIN: VALIDACIÓN DE AÑO ⭐

        if (!nameInput) {
            mostrarAlerta(`El nombre del ${isCar ? 'coche' : 'moto'} es obligatorio`, 'advertencia');
            return;
        }

        // 1. CREAR FORMDATA
        const formData = new FormData();
        formData.append('user_id', user.id);

        // CLAVE: Usar el nombre de campo correcto según el tipo de vehículo
        formData.append(isCar ? 'car_name' : 'motorcycle_name', nameInput);
        formData.append('model', carModelInput.value.trim() || '');
        formData.append('year', carYearInput.value.trim() || '');
        formData.append('description', carDescriptionInput.value.trim() || '');

        if (id) {
            formData.append('id', id);
        }

        // 2. LÓGICA DE LA IMAGEN
        const file = carPhotoFileInput.files[0];
        const currentURL = carPhotoUrlInput.value;

        if (file) {
            // Si hay un nuevo archivo seleccionado
            formData.append('imageFile', file);
            // No adjuntamos photoURL
        } else if (currentURL && currentURL !== 'FILE_PENDING') {
            // Si no hay archivo nuevo, pero hay una URL existente
            formData.append('photoURL', currentURL);
        } else {
            // Si no hay ni archivo ni URL (para borrar la imagen existente si no hay nada en el campo)
            formData.append('photoURL', '');
        }

        try {
            // CLAVE: Seleccionar la API correcta
            const apiSegment = isCar ? 'carGarage' : 'motosGarage';
            const url = id ? `/api/${apiSegment}?id=${id}` : `/api/${apiSegment}`;

            const resp = await fetch(url, {
                method: id ? 'PUT' : 'POST',
                // Importante: No establecer Content-Type para FormData
                body: formData
            });

            // Leer la respuesta, incluso si es un error
            const json = await resp.json();
            if (!resp.ok || !json.ok) throw new Error(json.msg || 'Fallo en la respuesta del servidor.');

            mostrarAlerta(id ? 'Vehículo actualizado' : 'Vehículo añadido', 'exito');

            await loadVehicles(); // Recargar la lista combinada
            const modalInstance = bootstrap.Modal.getInstance(carModal);
            if (modalInstance) modalInstance.hide();

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

            // Si la respuesta es 200 o 204
            if (!resp.ok) {
                const json = await resp.json();
                throw new Error(json.msg || 'Error al eliminar en el servidor');
            }

            mostrarAlerta('Vehículo eliminado', 'exito');
            await loadVehicles();
            const modalInstance = bootstrap.Modal.getInstance(carModal);
            if (modalInstance) modalInstance.hide();

        } catch (e) {
            console.error("Error eliminando vehículo:", e);
            mostrarAlerta('Error eliminando vehículo.', 'error');
        }
    });

    // *******************************************************************
    // ⭐ EL RESTO DE FUNCIONES (CONFIRMACIÓN, PERFIL, CONTRASEÑA, LOGOUT) ⭐
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

    // --- Lógica del Formulario de Perfil ---
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const newName = document.getElementById('profile-name').value.trim();
        const newEmail = document.getElementById('profile-email').value.trim();

        if (newName === (user.name || '') && newEmail === (user.email || '')) {
            mostrarAlerta('No hay cambios que guardar.', 'info');
            return;
        }

        const confirmar = await mostrarConfirmacion('¿Quieres guardar los cambios de tu perfil?', 'Guardar');
        if (!confirmar) {
            mostrarAlerta('Cambios cancelados', 'info');
            // Recargar para restaurar los valores iniciales si se cancela
            document.getElementById('profile-name').value = user.name || '';
            document.getElementById('profile-email').value = user.email || '';
            return;
        }

        try {
            const resp = await fetch('/api/userAction', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    id: user.id,
                    name: newName,
                    email: newEmail
                })
            });

            const json = await resp.json();
            if (!resp.ok || !json.ok) {
                throw new Error(json.msg || 'Fallo en la actualización del perfil.');
            }

            // Actualizar la sesión y la UI
            user.name = newName;
            user.email = newEmail;
            sessionStorage.setItem('usuario', JSON.stringify(user));

            userNameElement.textContent = newName || 'Usuario';
            mostrarAlerta('Perfil actualizado correctamente', 'exito');

        } catch (error) {
            console.error('Error al actualizar perfil:', error);
            mostrarAlerta('Error al actualizar perfil: ' + error.message, 'error');
        }
    });

    // --- Lógica del Formulario de Contraseña ---
    passwordForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const newPassword = newPasswordInput.value;
        const confirmNewPassword = confirmNewPasswordInput.value;

        // Se envía un campo de contraseña actual vacía, asumiendo que el backend 
        // permite el cambio solo con la nueva contraseña si el campo no está presente.
        const currentPassword = '';

        if (newPassword !== confirmNewPassword) {
            mostrarAlerta('La nueva contraseña y su confirmación no coinciden.', 'error');
            return;
        }

        if (newPassword.length < 6) {
            mostrarAlerta('La nueva contraseña debe tener al menos 6 caracteres.', 'advertencia');
            return;
        }

        const confirmar = await mostrarConfirmacion('¿Deseas cambiar tu contraseña?', 'Cambiar');
        if (!confirmar) {
            mostrarAlerta('Cambio de contraseña cancelado', 'info');
            return;
        }

        try {
            const resp = await fetch('/api/userAction', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    id: user.id,
                    current_password: currentPassword, // Enviamos vacío
                    new_password: newPassword,
                    action: 'change_password'
                })
            });

            const json = await resp.json();
            if (!resp.ok || !json.ok) {
                throw new Error(json.msg || 'Fallo en el cambio de contraseña.');
            }

            mostrarAlerta('Contraseña cambiada correctamente. Vuelve a iniciar sesión.', 'exito');

            // Cerrar el modal y redirigir
            const modalInstance = bootstrap.Modal.getInstance(passwordModal);
            if (modalInstance) modalInstance.hide();

            setTimeout(() => {
                sessionStorage.removeItem('usuario');
                window.location.href = '../auth/login/login.html';
            }, 1200);

        } catch (error) {
            console.error('Error al cambiar contraseña:', error);
            mostrarAlerta('Error al cambiar contraseña: ' + error.message, 'error');
        } finally {
            // Limpiar los campos del formulario de contraseña
            passwordForm.reset();
        }
    });

    // --- Lógica de Cerrar Sesión ---
    logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const confirmar = await mostrarConfirmacion('¿Estás seguro de que quieres cerrar sesión?', 'Cerrar');
        if (confirmar) {
            sessionStorage.removeItem('usuario');
            mostrarAlerta('Sesión cerrada', 'info');
            setTimeout(() => window.location.href = '/index.html', 800);
        } else {
            mostrarAlerta('Cierre de sesión cancelado', 'info');
        }
    });

    // --- Inicialización ---
    loadVehicles();
});