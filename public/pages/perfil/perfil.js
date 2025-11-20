document.addEventListener('DOMContentLoaded', () => {

    const profileForm = document.getElementById('profile-form');
    const carForm = document.getElementById('car-form');
    const carList = document.getElementById('car-list');
    const userNameElement = document.getElementById('user-name');
    const loginIcon = document.getElementById('login-icon');
    const logoutBtn = document.getElementById('logout-btn');
    const noCarsMessage = document.getElementById('no-cars-message');
    const deleteCarBtn = document.getElementById('delete-car-btn');
    const openAddCarBtn = document.getElementById('open-add-car-btn');

    // ELEMENTOS DEL MODAL DE VEHÍCULO
    const carModal = document.getElementById('carModal');
    const carModalTitle = document.getElementById('carModalTitle');
    const carIdInput = document.getElementById('car-id');
    const carNameInput = document.getElementById('car-name');
    const carModelInput = document.getElementById('car-model');
    const carYearInput = document.getElementById('car-year');
    const carDescriptionInput = document.getElementById('car-description');

    // ELEMENTOS DE TIPO DE VEHÍCULO
    const vehicleTypeSelect = document.getElementById('vehicle-type-select');
    const vehicleTypeInput = document.getElementById('vehicle-type');
    const vehicleNameLabel = document.getElementById('vehicle-name-label');

    // ELEMENTOS DE IMAGEN
    const carPhotoFileInput = document.getElementById('carPhotoFile');
    const carPhotoUrlInput = document.getElementById('car-photo-url');
    const carPhotoPreview = document.getElementById('carPhotoPreview');
    const carPhotoContainer = document.getElementById('carPhotoContainer');
    const clearCarPhotoBtn = document.getElementById('clearCarPhotoBtn');

    let currentVehicle = null;

    // --- Carga Inicial de Usuario ---
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

    userNameElement.textContent = user.name || 'Usuario';
    if (loginIcon) loginIcon.style.display = 'none';

    document.getElementById('user-id').value = user.id || '';
    document.getElementById('profile-name').value = user.name || '';
    document.getElementById('profile-email').value = user.email || '';

    function escapeHtml(s) {
        return String(s || '').replace(/[&<>"']/g, c => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[c]));
    }

    // RENDER VEHÍCULO
    function renderVehicle(vehicle) {
        const isCar = vehicle.type === 'car';
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

    // CARGA VEHÍCULOS
    async function loadVehicles() {
        const allVehicles = [];
        const userId = encodeURIComponent(user.id);

        let carsHtml = '';
        let motorcyclesHtml = '';

        // CARGAR COCHES
        try {
            const carsResp = await fetch(`/api/carGarage?user_id=${userId}`);
            const carsData = await carsResp.json();
            const cars = (carsData.cars || []).map(c => ({ ...c, type: 'car' }));
            allVehicles.push(...cars);

            if (cars.length > 0) {
                carsHtml += '<h3 class="vehicle-section-title">Coches</h3><div class="row">';
                cars.forEach(car => carsHtml += renderVehicle(car));
                carsHtml += '</div>';
            }

        } catch (e) {
            console.error("Error al cargar coches:", e.message);
        }

        // CARGAR MOTOS
        try {
            const bikesResp = await fetch(`/api/motosGarage?user_id=${userId}`);
            const bikesData = await bikesResp.json();
            const motorcycles = (bikesData.motorcycles || []).map(m => ({ ...m, type: 'motorcycle' }));
            allVehicles.push(...motorcycles);

            if (motorcycles.length > 0) {
                motorcyclesHtml += '<h3 class="vehicle-section-title">Motos</h3><div class="row">';
                motorcycles.forEach(moto => motorcyclesHtml += renderVehicle(moto));
                motorcyclesHtml += '</div>';
            }
        } catch (e) {
            console.error("Error al cargar motos:", e.message);
        }

        carList.innerHTML = '';
        let finalHtml = '';

        if (!allVehicles.length) {
            noCarsMessage.style.display = 'block';
            return;
        }

        noCarsMessage.style.display = 'none';

        finalHtml += carsHtml;

        if (carsHtml.length > 0 && motorcyclesHtml.length > 0) {
            finalHtml += '<hr class="vehicle-separator">';
        }

        finalHtml += motorcyclesHtml;

        carList.innerHTML = finalHtml;

        carList.querySelectorAll('.car-card').forEach(item => {
            item.addEventListener('click', () => {
                const el = item.closest('[data-vehicle-id]');
                const id = parseInt(el.dataset.vehicleId);
                const type = el.dataset.vehicleType;
                const vehicle = allVehicles.find(v => v.id === id && v.type === type);

                if (vehicle) {
                    openCarModal(vehicle);
                    new bootstrap.Modal(carModal).show();
                }
            });
        });
    }

    // MODAL VEHÍCULO
    function updateCarModalUI(type, isEdit = false) {
        const isCar = type === 'car';
        vehicleTypeInput.value = type;

        carModalTitle.textContent = isEdit ? `Editar ${isCar ? 'Coche' : 'Moto'}` : `Añadir ${isCar ? 'Coche' : 'Moto'}`;
        vehicleNameLabel.textContent = isCar ? 'Nombre del coche' : 'Nombre de la moto';
        vehicleTypeSelect.disabled = isEdit;
    }

    function openCarModal(vehicle = null) {
        carForm.reset();
        currentVehicle = vehicle;

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
            carNameInput.value = vehicle[nameKey];
            carModelInput.value = vehicle.model || '';
            carYearInput.value = vehicle.year || '';
            carDescriptionInput.value = vehicle.description || '';

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

        vehicleTypeSelect.value = type;
        updateCarModalUI(type, isEdit);
    }

    // EVENTOS AÑADIR VEHÍCULO
    openAddCarBtn.addEventListener('click', () => {
        openCarModal(null);
        new bootstrap.Modal(carModal).show();
    });

    vehicleTypeSelect.addEventListener('change', (e) => {
        if (!currentVehicle) {
            updateCarModalUI(e.target.value, false);
        }
    });

    // PREVISUALIZACIÓN DE IMAGEN
    carPhotoFileInput.addEventListener('change', function () {
        const file = this.files[0];
        if (file) {
            const fileUrl = URL.createObjectURL(file);
            carPhotoPreview.src = fileUrl;
            carPhotoContainer.style.display = 'block';
            carPhotoUrlInput.value = 'FILE_PENDING';
        } else {
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
        carPhotoUrlInput.value = "";
        carPhotoFileInput.value = "";
        carPhotoContainer.style.display = 'none';
        carPhotoPreview.src = '';
    });

    // GUARDAR VEHÍCULO
    carForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const id = carIdInput.value;
        const type = vehicleTypeInput.value;
        const isCar = type === 'car';
        const nameInput = carNameInput.value.trim();

        const vehicleYear = parseInt(carYearInput.value.trim());
        const currentYear = new Date().getFullYear();

        if (isNaN(vehicleYear) || vehicleYear < 1900) {
            mostrarAlerta(`El año del vehículo no es válido. Debe ser entre 1900 y ${currentYear}.`, 'error');
            return;
        }

        if (vehicleYear > currentYear) {
            mostrarAlerta(`El año del vehículo (${vehicleYear}) no puede ser mayor que el año actual (${currentYear}).`, 'error');
            return;
        }

        if (!nameInput) {
            mostrarAlerta(`El nombre del ${isCar ? 'coche' : 'moto'} es obligatorio`, 'advertencia');
            return;
        }

        const formData = new FormData();
        formData.append('user_id', user.id);

        formData.append(isCar ? 'car_name' : 'motorcycle_name', nameInput);
        formData.append('model', carModelInput.value.trim() || '');
        formData.append('year', carYearInput.value.trim() || '');
        formData.append('description', carDescriptionInput.value.trim() || '');

        if (id) formData.append('id', id);

        const file = carPhotoFileInput.files[0];
        const currentURL = carPhotoUrlInput.value;

        if (file) {
            formData.append('imageFile', file);
        } else if (currentURL && currentURL !== 'FILE_PENDING') {
            formData.append('photoURL', currentURL);
        } else {
            formData.append('photoURL', '');
        }

        try {
            const apiSegment = isCar ? 'carGarage' : 'motosGarage';
            const url = id ? `/api/${apiSegment}?id=${id}` : `/api/${apiSegment}`;

            const resp = await fetch(url, {
                method: id ? 'PUT' : 'POST',
                body: formData
            });

            const json = await resp.json();
            if (!resp.ok || !json.ok) throw new Error(json.msg || 'Fallo en el servidor.');

            mostrarAlerta(id ? 'Vehículo actualizado' : 'Vehículo añadido', 'exito');

            await loadVehicles();

            const modalInstance = bootstrap.Modal.getInstance(carModal);
            if (modalInstance) modalInstance.hide();

        } catch (e) {
            console.error("Error al guardar el vehículo:", e);
            mostrarAlerta('Error guardando vehículo. ' + e.message, 'error');
        }
    });

    // ELIMINAR VEHÍCULO
    deleteCarBtn.addEventListener('click', async () => {
        if (!currentVehicle) return;

        const isCar = currentVehicle.type === 'car';
        const itemName = isCar ? 'coche' : 'moto';

        // Usa la función de confirmación antes de la eliminación
        const confirmar = await mostrarConfirmacion(`¿Seguro que quieres eliminar este ${itemName}?`, 'Eliminar');
        if (!confirmar) {
            mostrarAlerta('Eliminación cancelada', 'info');
            return;
        }

        try {
            const apiSegment = isCar ? 'carGarage' : 'motosGarage';
            const resp = await fetch(`/api/${apiSegment}?id=${encodeURIComponent(currentVehicle.id)}`, {
                method: 'DELETE'
            });

            if (!resp.ok) {
                const json = await resp.json();
                throw new Error(json.msg || 'Error al eliminar');
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

    // CONFIRMACIONES (Se mantiene para la eliminación de vehículo y actualización de perfil)
    function mostrarConfirmacion(mensaje = '¿Confirmar?', confirmText = 'Confirmar') {
        return new Promise((resolve) => {
            // Si ya hay un modal activo, salimos sin resolver la promesa.
            if (document.getElementById('mlc-confirm-overlay')) {
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
            btnConfirm.textContent = confirmText;
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

            let resolved = false;

            function cleanup(x) {
                if(resolved) return;
                resolved = true;
                
                btnCancel.removeEventListener('click', handleCancel);
                btnConfirm.removeEventListener('click', handleConfirm);
                document.removeEventListener('keydown', handleKeydown);
                
                overlay.remove();
                
                resolve(!!x);
            }

            const handleCancel = () => cleanup(false);
            const handleConfirm = () => cleanup(true);
            const handleKeydown = e => { if (e.key === 'Escape') cleanup(false); };

            btnCancel.addEventListener('click', handleCancel);
            btnConfirm.addEventListener('click', handleConfirm);
            document.addEventListener('keydown', handleKeydown, { once: true });
        });
    }

    // GUARDAR PERFIL
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
                throw new Error(json.msg || 'Error al actualizar perfil.');
            }

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

    // ⛔ LÓGICA DE CERRAR SESIÓN (SIN CONFIRMACIÓN)
    logoutBtn.addEventListener('click', (e) => {
        // Detiene el comportamiento por defecto inmediatamente
        e.preventDefault();

        // 1. Muestra el mensaje de éxito inmediatamente
        mostrarAlerta('Sesión cerrada correctamente', 'exito');

        // 2. Espera 1 segundo (1000ms) para que la alerta sea visible, luego limpia y redirige
        setTimeout(() => {
            sessionStorage.removeItem('usuario'); // Limpia la sesión
            window.location.href = '/index.html'; // Redirige
        }, 1000); 
    });

    // INICIALIZAR
    loadVehicles();

});