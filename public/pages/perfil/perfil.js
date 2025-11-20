document.addEventListener('DOMContentLoaded', () => {

    const profileForm = document.getElementById('profile-form');
    // const passwordForm = document.getElementById('password-form'); // ELIMINADO: Ya no se usa
    const carForm = document.getElementById('car-form');
    const carList = document.getElementById('car-list');
    const userNameElement = document.getElementById('user-name');
    const loginIcon = document.getElementById('login-icon');
    const logoutBtn = document.getElementById('logout-btn');
    const noCarsMessage = document.getElementById('no-cars-message');
    const deleteCarBtn = document.getElementById('delete-car-btn');
    const openAddCarBtn = document.getElementById('open-add-car-btn');

    // ELEMENTOS DEL MODAL DE CONTRASEÑA
    // const passwordModal = document.getElementById('passwordModal'); // ELIMINADO: Ya no se usa
    // const newPasswordInput = document.getElementById('new-password'); // ELIMINADO: Ya no se usa
    // const confirmNewPasswordInput = document.getElementById('confirm-new-password'); // ELIMINADO: Ya no se usa

    // ELEMENTOS DEL MODAL DE VEHÍCULO
    const carModal = document.getElementById('carModal'); // Obtenemos el DOM, no la instancia de Bootstrap aquí
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

    let currentVehicle = null; // Almacenará { id, type, ...datos }

    // --- Carga Inicial de Usuario ---
    const stored = sessionStorage.getItem('usuario');
    if (!stored) {
        // Asumo que 'mostrarAlerta' está disponible
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

    userNameElement.textContent = user.name || 'Usuario';
    if (loginIcon) loginIcon.style.display = 'none';

    document.getElementById('user-id').value = user.id || '';
    document.getElementById('profile-name').value = user.name || '';
    document.getElementById('profile-email').value = user.email || '';

    // Función de saneamiento de HTML (XSS prevention)
    function escapeHtml(s) {
        return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    // --- FUNCIÓN RENDERIZADO DE VEHÍCULOS (COCHE O MOTO) ---
    function renderVehicle(vehicle) {
        const isCar = vehicle.type === 'car';
        // Usa la clave correcta: 'car_name' o 'motorcycle_name'
        const nameKey = isCar ? 'car_name' : 'motorcycle_name';
        const name = vehicle[nameKey];

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
                // Dejamos la clave original 'motorcycle_name'
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

                // Buscar el vehículo en la lista combinada
                currentVehicle = allVehicles.find(v => v.id === id && v.type === type);

                if (currentVehicle) {
                    openCarModal(currentVehicle);
                }
            });
        });

        // Habilitar el botón de añadir vehículo
        openAddCarBtn.disabled = false;
    }

    // --- FUNCIÓN ABRIR MODAL VEHÍCULO ---
    function openCarModal(vehicle = null) {
        carForm.reset();
        carPhotoFileInput.value = '';
        carPhotoPreview.style.backgroundImage = 'none';
        carPhotoContainer.classList.add('d-none');
        clearCarPhotoBtn.classList.add('d-none');
        deleteCarBtn.style.display = 'none';

        if (vehicle) {
            // Modo Edición
            carModalTitle.textContent = `Editar ${vehicle.type === 'car' ? 'Coche' : 'Moto'}`;
            carIdInput.value = vehicle.id;
            vehicleTypeInput.value = vehicle.type;
            deleteCarBtn.style.display = 'block';

            // Establecer el tipo de vehículo para el selector (solo visualmente)
            vehicleTypeSelect.value = vehicle.type;
            vehicleTypeSelect.disabled = true; // No permitir cambiar el tipo al editar

            // Llenar campos
            const nameKey = vehicle.type === 'car' ? 'car_name' : 'motorcycle_name';
            carNameInput.value = vehicle[nameKey] || '';
            carModelInput.value = vehicle.model || '';
            carYearInput.value = vehicle.year || '';
            carDescriptionInput.value = vehicle.description || '';

            // Foto
            carPhotoUrlInput.value = vehicle.photo_url || '';
            if (vehicle.photo_url) {
                carPhotoPreview.style.backgroundImage = `url(${escapeHtml(vehicle.photo_url)})`;
                carPhotoContainer.classList.remove('d-none');
                clearCarPhotoBtn.classList.remove('d-none');
            }

            // Actualizar Label
            updateVehicleNameLabel(vehicle.type);

        } else {
            // Modo Creación
            carModalTitle.textContent = 'Añadir Nuevo Vehículo';
            carIdInput.value = '';
            vehicleTypeSelect.disabled = false;
            // Forzar selección inicial (coche por defecto)
            vehicleTypeSelect.value = 'car';
            vehicleTypeInput.value = 'car';
            updateVehicleNameLabel('car');
        }

        const bootstrapCarModal = new bootstrap.Modal(carModal);
        bootstrapCarModal.show();
    }

    // --- FUNCIÓN LIMPIAR INPUT DE FOTO ---
    function clearCarPhoto() {
        carPhotoFileInput.value = '';
        carPhotoUrlInput.value = '';
        carPhotoPreview.style.backgroundImage = 'none';
        carPhotoContainer.classList.add('d-none');
        clearCarPhotoBtn.classList.add('d-none');
    }

    // --- FUNCIÓN ACTUALIZAR LABEL DE NOMBRE ---
    function updateVehicleNameLabel(type) {
        if (type === 'car') {
            vehicleNameLabel.textContent = 'Nombre del Coche';
        } else if (type === 'motorcycle') {
            vehicleNameLabel.textContent = 'Nombre de la Moto';
        }
    }

    // --- EVENT LISTENERS ---

    // 1. Guardar Perfil
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const userId = document.getElementById('user-id').value;
        const name = document.getElementById('profile-name').value.trim();
        const email = document.getElementById('profile-email').value.trim();

        if (!name || !email) {
            mostrarAlerta('Por favor, rellena todos los campos.', 'warning');
            return;
        }

        try {
            const response = await fetch('/api/userAction', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    id: userId,
                    name: name,
                    email: email,
                    action: 'updateProfile'
                })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                // Actualizar la sesión
                user.name = name;
                user.email = email;
                sessionStorage.setItem('usuario', JSON.stringify(user));
                userNameElement.textContent = name;
                mostrarAlerta('Perfil actualizado con éxito.', 'success');
            } else {
                mostrarAlerta(result.message || 'Error al actualizar el perfil.', 'error');
            }

        } catch (error) {
            console.error('Error:', error);
            mostrarAlerta('Error de conexión o del servidor.', 'error');
        }
    });

    // 2. Logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            sessionStorage.removeItem('usuario');
            mostrarAlerta("Sesión cerrada.", 'info');
            // Redirigir a la página de inicio o login
            setTimeout(() => window.location.href = '../../index.html', 800);
        });
    }

    // 3. Abrir Modal Añadir Vehículo
    if (openAddCarBtn) {
        openAddCarBtn.addEventListener('click', () => {
            openCarModal(null);
        });
    }

    // 4. Cambiar Tipo de Vehículo en Modal
    vehicleTypeSelect.addEventListener('change', (e) => {
        const type = e.target.value;
        vehicleTypeInput.value = type;
        updateVehicleNameLabel(type);
    });

    // 5. Borrar Foto de Vehículo (limpiar inputs de imagen)
    clearCarPhotoBtn.addEventListener('click', clearCarPhoto);

    // 6. Previsualizar Foto del Vehículo (subida de archivo)
    carPhotoFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) { // Límite de 2MB
                mostrarAlerta('La imagen es demasiado grande. Máximo 2MB.', 'warning');
                e.target.value = ''; // Limpiar el input
                return;
            }

            const reader = new FileReader();
            reader.onload = function (event) {
                carPhotoPreview.style.backgroundImage = `url(${event.target.result})`;
                carPhotoContainer.classList.remove('d-none');
                clearCarPhotoBtn.classList.remove('d-none');
                carPhotoUrlInput.value = ''; // Limpiar URL si se sube archivo
            };
            reader.readAsDataURL(file);
        } else {
            // Si el input file se limpia y no hay URL, oculta el contenedor
            if (!carPhotoUrlInput.value) {
                clearCarPhoto();
            }
        }
    });

    // 7. Previsualizar Foto del Vehículo (input URL)
    carPhotoUrlInput.addEventListener('input', (e) => {
        const url = e.target.value.trim();
        if (url) {
            carPhotoPreview.style.backgroundImage = `url(${escapeHtml(url)})`;
            carPhotoContainer.classList.remove('d-none');
            clearCarPhotoBtn.classList.remove('d-none');
            carPhotoFileInput.value = ''; // Limpiar archivo si se usa URL
        } else {
            // Si no hay URL ni archivo, oculta
            if (!carPhotoFileInput.value) {
                clearCarPhoto();
            }
        }
    });

    // 8. Guardar/Actualizar Vehículo
    carForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const isEditing = !!carIdInput.value;
        const type = vehicleTypeInput.value;
        const nameKey = type === 'car' ? 'car_name' : 'motorcycle_name';
        const endpoint = type === 'car' ? '/api/carGarage' : '/api/motosGarage';
        const method = isEditing ? 'PUT' : 'POST';

        const carData = {
            user_id: user.id,
            id: isEditing ? parseInt(carIdInput.value) : undefined, // Solo se incluye si se está editando
            [nameKey]: carNameInput.value.trim(),
            model: carModelInput.value.trim(),
            year: parseInt(carYearInput.value) || null,
            description: carDescriptionInput.value.trim() || null,
            photo_url: carPhotoUrlInput.value.trim() || null // Usar URL si existe
        };

        // Manejar subida de archivo (si no hay URL)
        let file = carPhotoFileInput.files[0];
        let body;
        let headers = {};

        if (file && !carData.photo_url) {
            // Si hay archivo y no hay URL, usamos FormData
            body = new FormData();
            // Añadir campos al FormData
            for (const key in carData) {
                if (carData[key] !== undefined) {
                    // Convertir el nombre clave dinámico a un nombre estándar para el backend
                    const backendKey = key === nameKey ? 'name' : key;
                    body.append(backendKey, carData[key]);
                }
            }
            // Añadir el archivo
            body.append('photo', file);
            // No establecemos Content-Type, el navegador lo hace por nosotros con el boundary
        } else {
            // Si hay URL o no hay foto, usamos JSON
            // Ajustar la clave del nombre para el backend
            carData.name = carData[nameKey];
            delete carData[nameKey];

            body = JSON.stringify(carData);
            headers['Content-Type'] = 'application/json';
        }

        try {
            const response = await fetch(endpoint, {
                method: method,
                headers: headers,
                body: body,
            });

            const result = await response.json();
            const bootstrapCarModal = bootstrap.Modal.getInstance(carModal);

            if (response.ok && result.success) {
                if (bootstrapCarModal) bootstrapCarModal.hide();
                mostrarAlerta(`Vehículo ${isEditing ? 'actualizado' : 'añadido'} con éxito.`, 'success');
                loadVehicles(); // Recargar la lista de vehículos
            } else {
                mostrarAlerta(result.message || `Error al ${isEditing ? 'actualizar' : 'añadir'} el vehículo.`, 'error');
            }

        } catch (error) {
            console.error('Error al guardar vehículo:', error);
            mostrarAlerta('Error de conexión o del servidor.', 'error');
        }
    });


    // 9. Eliminar Vehículo
    deleteCarBtn.addEventListener('click', async () => {
        if (!confirm("¿Estás seguro de que quieres eliminar este vehículo? Esta acción no se puede deshacer.")) {
            return;
        }

        const id = carIdInput.value;
        const type = vehicleTypeInput.value;
        const endpoint = type === 'car' ? '/api/carGarage' : '/api/motosGarage';

        if (!id || !type) {
            mostrarAlerta('Error: ID de vehículo o tipo no encontrado.', 'error');
            return;
        }

        try {
            const response = await fetch(endpoint, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: parseInt(id) }),
            });

            const result = await response.json();
            const bootstrapCarModal = bootstrap.Modal.getInstance(carModal);

            if (response.ok && result.success) {
                if (bootstrapCarModal) bootstrapCarModal.hide();
                mostrarAlerta('Vehículo eliminado con éxito.', 'success');
                loadVehicles(); // Recargar la lista
            } else {
                mostrarAlerta(result.message || 'Error al eliminar el vehículo.', 'error');
            }

        } catch (error) {
            console.error('Error al eliminar vehículo:', error);
            mostrarAlerta('Error de conexión o del servidor.', 'error');
        }
    });

    // --- Carga Inicial ---
    loadVehicles();

});