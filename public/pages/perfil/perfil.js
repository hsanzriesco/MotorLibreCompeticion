document.addEventListener('DOMContentLoaded', () => {

    // 🛑 BANDERA DE CONTROL CRÍTICA PARA EVITAR MÚLTIPLES ALERTAS/REDIRECCIONES
    let redireccionEnCurso = false;

    // Función centralizada para manejar la falta de autenticación
    function manejarFaltaAutenticacion(mensaje, tipo = 'error') {
        if (redireccionEnCurso) return;

        redireccionEnCurso = true; // Activa la bandera

        // Limpiar cualquier sesión corrupta o residual
        sessionStorage.removeItem('usuario');
        localStorage.removeItem('usuario');
        // También limpia el token para mayor seguridad
        sessionStorage.removeItem('token');
        localStorage.removeItem('token');


        // ⭐ MODIFICACIÓN CLAVE: Muestra la ÚNICA alerta deseada (roja)
        // Se fuerza el mensaje y el tipo 'error' para evitar duplicados de diferente color
        mostrarAlerta("Tienes que iniciar sesión para acceder a tu perfil", 'error');

        // Redirige
        setTimeout(() => window.location.href = '../auth/login/login.html', 1200);
    }

    // --- Variables del DOM ---
    const profileForm = document.getElementById('profile-form');
    const carForm = document.getElementById('car-form');
    const carList = document.getElementById('car-list');
    const userNameElement = document.getElementById('user-name');
    const loginIcon = document.getElementById('login-icon');
    const noCarsMessage = document.getElementById('no-cars-message');
    const deleteCarBtn = document.getElementById('delete-car-btn');
    const openAddCarBtn = document.getElementById('open-add-car-btn');
    const carModal = document.getElementById('carModal');
    const carModalTitle = document.getElementById('carModalTitle');
    const carIdInput = document.getElementById('car-id');
    const carNameInput = document.getElementById('car-name');
    const carModelInput = document.getElementById('car-model');
    const carYearInput = document.getElementById('car-year');
    const carDescriptionInput = document.getElementById('car-description');
    const vehicleTypeSelect = document.getElementById('vehicle-type-select');
    const vehicleNameLabel = document.getElementById('vehicle-name-label');
    const carPhotoFileInput = document.getElementById('carPhotoFile');
    const carPhotoUrlInput = document.getElementById('car-photo-url');
    const carPhotoPreview = document.getElementById('carPhotoPreview');
    const carPhotoContainer = document.getElementById('carPhotoContainer');
    const clearCarPhotoBtn = document.getElementById('clearCarPhotoBtn');
    // Variable para el botón de Cerrar Sesión
    const btnConfirmLogout = document.getElementById('btnConfirmLogout');

    let currentVehicle = null;

    // 🛑 LÓGICA DE AUTENTICACIÓN CENTRALIZADA (INICIO) 🛑
    const stored = sessionStorage.getItem('usuario') || localStorage.getItem('usuario');
    let user = null;

    if (!stored) {
        // Si no hay sesión, llama a la función centralizada y sale.
        manejarFaltaAutenticacion("Mensaje irrelevante, la función lo reemplaza", 'error');
        return; // ⬅️ CRÍTICO: Detiene la ejecución del script y evita llamadas a la API
    }

    try {
        user = JSON.parse(stored);
    } catch (err) {
        // Si el JSON está mal, llama a la función centralizada y sale.
        manejarFaltaAutenticacion("Sesión corrupta. Vuelve a iniciar sesión.", 'error');
        return;
    }
    // ----------------------------------------

    // Si llegamos aquí, 'user' es válido.

    userNameElement.textContent = user.name || 'Usuario';
    if (loginIcon) loginIcon.style.display = 'none';

    document.getElementById('user-id').value = user.id || '';
    document.getElementById('profile-name').value = user.name || '';
    document.getElementById('profile-email').value = user.email || '';

    // --- FUNCIONES DE VEHÍCULOS Y UTILIDADES ---

    function escapeHtml(s) {
        return String(s || '').replace(/[&<>"']/g, c => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[c]));
    }

    function renderVehicle(vehicle) {
        const isCar = vehicle.type === 'car';
        const nameKey = isCar ? 'car_name' : 'motorcycle_name';
        const name = vehicle[nameKey];

        const defaultImg = isCar
            ? 'https://placehold.co/400x225/343a40/ffffff?text=Coche+Sin+Foto'
            : 'https://placehold.co/400x225/343a40/ffffff?text=Moto+Sin+Foto';

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

    async function loadVehicles() {
        // ⭐ SEGUNDA MODIFICACIÓN CLAVE: Si ya se inició la redirección/alerta, sal de aquí.
        if (redireccionEnCurso) return;

        const allVehicles = [];
        const userId = encodeURIComponent(user.id);

        let carsHtml = '';
        let motorcyclesHtml = '';

        // --- LÓGICA PARA COCHES (CORRECCIÓN APLICADA AQUÍ) ---
        try {
            const carsResp = await fetch(`/api/carGarage?user_id=${userId}`);

            // 🛑 CORRECCIÓN CRÍTICA: Verifica explícitamente el estado de la API
            if (carsResp.status === 401 || carsResp.status === 403) {
                // Si la sesión expiró/es inválida, redirige
                return manejarFaltaAutenticacion("Tu sesión API ha expirado. Por favor, inicia sesión de nuevo.", 'error');
            }

            // Manejo de otros errores no-OK (ej: 500 Internal Server Error)
            if (!carsResp.ok) {
                const errorJson = await carsResp.json().catch(() => ({ msg: `Error HTTP ${carsResp.status} al cargar coches.` }));
                throw new Error(errorJson.msg || `Error HTTP ${carsResp.status} al cargar coches.`);
            }

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

        // --- LÓGICA PARA MOTOS (CORRECCIÓN APLICADA AQUÍ) ---
        try {
            const bikesResp = await fetch(`/api/motosGarage?user_id=${userId}`);

            // 🛑 CORRECCIÓN CRÍTICA: Verifica explícitamente el estado de la API
            if (bikesResp.status === 401 || bikesResp.status === 403) {
                // Si la sesión expiró/es inválida, redirige
                return manejarFaltaAutenticacion("Tu sesión API ha expirado. Por favor, inicia sesión de nuevo.", 'error');
            }

            // Manejo de otros errores no-OK (ej: 500 Internal Server Error)
            if (!bikesResp.ok) {
                const errorJson = await bikesResp.json().catch(() => ({ msg: `Error HTTP ${bikesResp.status} al cargar motos.` }));
                throw new Error(errorJson.msg || `Error HTTP ${bikesResp.status} al cargar motos.`);
            }

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
                    // Asegurar que el modal se abre usando la clase de Bootstrap
                    const carModalInstance = bootstrap.Modal.getOrCreateInstance(carModal);
                    carModalInstance.show();
                }
            });
        });
    }

    /**
     * @description Actualiza el texto del modal y deshabilita el select si se está editando.
     * @param {string} type - 'car' o 'motorcycle'
     * @param {boolean} isEdit - Si es true, estamos editando.
     */
    function updateCarModalUI(type, isEdit = false) {
        const isCar = type === 'car';

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

        // Establecer el valor del SELECT para el tipo de vehículo
        vehicleTypeSelect.value = type;

        updateCarModalUI(type, isEdit);
    }

    // --- MANEJO DE EVENTOS ---

    openAddCarBtn.addEventListener('click', () => {
        openCarModal(null);
        // Asegurar que el modal se abre usando la clase de Bootstrap
        const carModalInstance = bootstrap.Modal.getOrCreateInstance(carModal);
        carModalInstance.show();
    });

    vehicleTypeSelect.addEventListener('change', (e) => {
        // Solo actualiza la UI si estamos en modo "Añadir" (no hay vehículo actual)
        if (!currentVehicle) {
            updateCarModalUI(e.target.value, false);
        }
    });

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

    carForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const id = carIdInput.value;
        const type = vehicleTypeSelect.value;
        const isCar = type === 'car';
        const nameInput = carNameInput.value.trim();

        const vehicleYear = parseInt(carYearInput.value.trim());
        const currentYear = new Date().getFullYear();

        // Validación de Año
        if (carYearInput.value.trim() && (isNaN(vehicleYear) || vehicleYear < 1900 || vehicleYear > currentYear)) {
            mostrarAlerta(`El año del vehículo no es válido. Debe ser entre 1900 y ${currentYear}.`, 'error');
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

            // CORRECCIÓN: Agregar chequeo de sesión en otras llamadas a la API
            if (resp.status === 401 || resp.status === 403) {
                return manejarFaltaAutenticacion("Tu sesión API ha expirado. Por favor, inicia sesión de nuevo.", 'error');
            }

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
            const apiSegment = isCar ? 'carGarage' : 'motosGarage';
            const resp = await fetch(`/api/${apiSegment}?id=${encodeURIComponent(currentVehicle.id)}`, {
                method: 'DELETE'
            });

            // CORRECCIÓN: Agregar chequeo de sesión en otras llamadas a la API
            if (resp.status === 401 || resp.status === 403) {
                return manejarFaltaAutenticacion("Tu sesión API ha expirado. Por favor, inicia sesión de nuevo.", 'error');
            }

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

    // --- FUNCIÓN DE CONFIRMACIÓN CUSTOM (SIN CAMBIOS) ---
    function mostrarConfirmacion(mensaje = '¿Confirmar?', confirmText = 'Confirmar') {
        return new Promise((resolve) => {
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
                if (resolved) return;
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

    // --- MANEJO DE FORMULARIO DE PERFIL ---

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
            // Nota: Este endpoint puede requerir un cambio si el email es la clave única y se está modificando.
            // Asumo que el backend maneja la validación de la contraseña si se cambia el email.
            const resp = await fetch('/api/users?action=updateName', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    id: user.id,
                    newName: newName,
                    newEmail: newEmail
                })
            });

            // CORRECCIÓN: Agregar chequeo de sesión en otras llamadas a la API
            if (resp.status === 401 || resp.status === 403) {
                return manejarFaltaAutenticacion("Tu sesión API ha expirado. Por favor, inicia sesión de nuevo.", 'error');
            }


            const json = await resp.json();
            if (!resp.ok || !json.success) {
                throw new Error(json.message || 'Error al actualizar perfil.');
            }

            // Actualizar el objeto de usuario y almacenamiento local/sesión
            user.name = newName;
            user.email = newEmail;

            if (localStorage.getItem('usuario')) {
                localStorage.setItem('usuario', JSON.stringify(user));
            }
            sessionStorage.setItem('usuario', JSON.stringify(user));

            userNameElement.textContent = newName || 'Usuario';
            mostrarAlerta('Perfil actualizado correctamente', 'exito');

        } catch (error) {
            console.error('Error al actualizar perfil:', error);
            mostrarAlerta('Error al actualizar perfil: ' + error.message, 'error');
        }
    });

    // ==========================================================
    // ⭐ NUEVA FUNCIÓN DE DESVINCULACIÓN DEL CLUB (GLOBAL)
    // ==========================================================
    window.desvincularUsuarioDelClub = async function () {
        if (!user || redireccionEnCurso) return;

        // 1. Confirmar la acción con el usuario
        const confirmar = await mostrarConfirmacion('¿Estás seguro de que quieres salir de tu club?', 'Sí, Salir del Club');
        if (!confirmar) {
            mostrarAlerta('Desvinculación cancelada', 'info');
            return;
        }

        try {
            // 2. Llama a la API para desvincular al usuario del club (AJUSTA ESTE ENDPOINT)
            const resp = await fetch('/api/club/desvincular', {
                method: 'PUT', // O DELETE, según tu API
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id: user.id
                })
            });

            if (resp.status === 401 || resp.status === 403) {
                return manejarFaltaAutenticacion("Tu sesión API ha expirado al intentar salir del club.", 'error');
            }

            const json = await resp.json();
            if (!resp.ok || !json.success) {
                throw new Error(json.msg || 'Fallo al desvincularse del club.');
            }

            // 3. Obtener la ubicación de almacenamiento (sessionStorage o localStorage)
            const storage = localStorage.getItem('usuario') ? localStorage : sessionStorage;

            // 4. Limpiar la información del club en el objeto de usuario (CLAVE)
            // Se asume que estos campos definen la pertenencia
            delete user.club_id;
            delete user.clubId;

            // Si el rol era de club, cambiarlo a usuario normal
            if (user.role === 'presidente' || user.role === 'miembro') {
                user.role = 'usuario';
            }

            // 5. Guardar el objeto de usuario actualizado (LIMPIO)
            storage.setItem('usuario', JSON.stringify(user));

            // 6. Establecer el indicador de recarga para clubes.html (CLAVE para la recarga)
            sessionStorage.setItem('clubesDebeRecargar', 'true');

            mostrarAlerta('Te has desvinculado del club con éxito. Actualizando lista de clubes...', 'exito');

            // 7. Redirigir a clubes.html
            redireccionEnCurso = true; // Impedir otras acciones
            setTimeout(() => {
                window.location.href = '../clubes/clubes.html';
            }, 1200);

        } catch (e) {
            console.error("Error al salir del club:", e);
            mostrarAlerta('Error al salir del club. ' + e.message, 'error');
        }
    }
    // ==========================================================


    // --- LÓGICA DE CIERRE DE SESIÓN AGREGADA ---

    function cerrarSesion() {
        // Limpia toda la información de la sesión
        sessionStorage.removeItem('usuario');
        localStorage.removeItem('usuario');
        sessionStorage.removeItem('token');
        localStorage.removeItem('token');


        mostrarAlerta('Has cerrado la sesión', 'info');
        // Redirigir al inicio después de un breve retraso
        setTimeout(() => window.location.href = '/index.html', 800);
    }

    if (btnConfirmLogout) {
        btnConfirmLogout.addEventListener('click', () => {
            // Cerrar el modal antes de cerrar la sesión
            const modalElement = document.getElementById('logoutConfirmModal');
            // Usar getOrCreateInstance para ser más robusto
            const modalInstance = bootstrap.Modal.getOrCreateInstance(modalElement);
            if (modalInstance) {
                modalInstance.hide();
            }
            cerrarSesion();
        });
    }
    // ---------------------------------------------


    // Iniciar la carga de vehículos (Solo si el script no ha salido antes)
    loadVehicles();
});