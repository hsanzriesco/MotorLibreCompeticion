document.addEventListener('DOMContentLoaded', () => {
    // 1. Elementos del DOM
    const profileForm = document.getElementById('profile-form');
    const passwordForm = document.getElementById('password-form');
    const carForm = document.getElementById('car-form');
    const carList = document.getElementById('car-list');
    const userNameElement = document.getElementById('user-name');
    const loginIcon = document.getElementById('login-icon');
    const logoutBtn = document.getElementById('logout-btn');
    const noCarsMessage = document.getElementById('no-cars-message');
    const deleteCarBtn = document.getElementById('delete-car-btn');

    let currentCarId = null;

    // 2. Comprobación de autenticación y Carga Inicial
    // Obtiene el objeto 'usuario' del localStorage
    const user = JSON.parse(localStorage.getItem('usuario'));

    if (!user || !user.id || !user.email) {
        // Muestra alerta si la sesión no es válida y redirige al login
        mostrarAlerta("Sesión no válida o expirada. Por favor, inicia sesión.", 'error', 2000);
        setTimeout(() => {
            window.location.href = '../auth/login/login.html';
        }, 2000);
        return;
    }
    
    // Configura el NavBar
    userNameElement.textContent = user.name;
    loginIcon.style.display = 'none';

    // Llena los campos del formulario de perfil
    document.getElementById('user-id').value = user.id;
    document.getElementById('profile-name').value = user.name;
    document.getElementById('profile-email').value = user.email;

    // --- Funciones del Garaje ---

    const renderCar = (car) => {
        const defaultImg = 'https://via.placeholder.com/300x150?text=Sin+Foto';
        return `
            <div class="col-md-6 col-lg-4" data-car-id="${car.id}">
                <div class="car-item shadow-sm" data-bs-toggle="modal" data-bs-target="#carModal">
                    <div class="car-image-container">
                        <img src="${car.photo_url || defaultImg}" alt="${car.car_name}" onerror="this.onerror=null; this.src='${defaultImg}'">
                    </div>
                    <div class="car-details">
                        <h5>${car.car_name}</h5>
                        <p class="mb-0 text-muted">${car.model || 'Modelo N/A'} (${car.year || 'Año N/A'})</p>
                    </div>
                </div>
            </div>
        `;
    };

    const loadCars = async () => {
        // SIMULACIÓN: Datos iniciales de ejemplo
        const initialCars = [
            { id: 1, car_name: 'Mazda RX-7', model: 'FD3S', year: 1999, description: 'Motor rotativo 13B', photo_url: 'https://cdn.motor1.com/images/mgl/z940y/s4/1993-2002-mazda-rx-7.jpg' },
            { id: 2, car_name: 'Nissan Skyline', model: 'R34 GT-R', year: 2000, description: 'Motor RB26DETT', photo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Nissan_Skyline_R34_GT-R_%28front-left%29.jpg/1200px-Nissan_Skyline_R34_GT-R_%28front-left%29.jpg' },
        ];
        
        // Carga desde localStorage para simular la persistencia
        const storedCars = JSON.parse(localStorage.getItem('user_cars')) || initialCars;


        carList.innerHTML = '';
        if (storedCars.length === 0) {
            noCarsMessage.style.display = 'block';
        } else {
            noCarsMessage.style.display = 'none';
            storedCars.forEach(car => {
                carList.innerHTML += renderCar(car);
            });
        }
        
        // Re-añadir listeners para abrir el modo Edición al hacer click
        carList.querySelectorAll('.car-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = parseInt(item.closest('[data-car-id]').dataset.carId);
                const car = storedCars.find(c => c.id === id);
                openCarModal(car);
            });
        });
        
        localStorage.setItem('user_cars', JSON.stringify(storedCars));
    };

    const openCarModal = (car = null) => {
        carForm.reset();
        currentCarId = null;
        
        if (car) {
            // Modo Edición
            document.getElementById('carModalTitle').textContent = 'Editar Coche';
            document.getElementById('car-id').value = car.id;
            document.getElementById('car-name').value = car.car_name;
            document.getElementById('car-model').value = car.model || '';
            document.getElementById('car-year').value = car.year || '';
            document.getElementById('car-description').value = car.description || '';
            document.getElementById('car-photo').value = car.photo_url || '';
            currentCarId = car.id;
            deleteCarBtn.style.display = 'block';
        } else {
            // Modo Añadir
            document.getElementById('carModalTitle').textContent = 'Añadir Coche';
            deleteCarBtn.style.display = 'none';
        }
    };
    
    // Event listener para abrir modal en modo Añadir
    document.querySelector('.garage-card .btn-danger').addEventListener('click', (e) => {
        // Asegura que solo se ejecute para el botón de añadir y no para los coches existentes
        if (e.currentTarget.id === '') { 
             openCarModal();
        }
    });

    // Cargar coches al inicio
    loadCars();
    
    // --- Fin Funciones del Garaje ---


    // 3. Manejo de Cierre de Sesión (Logout)
    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem("usuario");

        mostrarAlerta("Has cerrado sesión correctamente.", 'error', 1500);
        
        // Cierra el offcanvas de forma segura
        const offcanvasMenu = document.getElementById('offcanvasMenu');
        if (offcanvasMenu && typeof bootstrap !== 'undefined') {
            const offcanvasInstance = bootstrap.Offcanvas.getInstance(offcanvasMenu);
            if (offcanvasInstance) {
                offcanvasInstance.hide();
            }
        }

        setTimeout(() => {
            window.location.href = "../auth/login/login.html";
        }, 1500);
    });

    // 4. Manejo de Actualización de Perfil (Nombre)
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const newName = document.getElementById('profile-name').value.trim();
        
        if (newName === user.name) {
            mostrarAlerta("No hay cambios que guardar.", 'info');
            return;
        }

        // SIMULACIÓN: Aquí iría la llamada fetch para actualizar el nombre
        try {
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
        
        if (!currentPassword) {
            mostrarAlerta("Debes introducir la Contraseña Actual.", 'error');
            return;
        }
        if (newPassword !== confirmNewPassword) {
            mostrarAlerta("La nueva contraseña y la confirmación no coinciden.", 'error');
            return;
        }
        if (newPassword.length < 4) { // Poner una longitud mínima decente
            mostrarAlerta("La nueva contraseña debe tener al menos 4 caracteres.", 'error');
            return;
        }

        try {
            // SIMULACIÓN: Validación contra una contraseña "conocida" (ej: '1234')
            if (currentPassword === '1234') { 
                // En una app real, aquí se llamaría a la API con currentPassword y newPassword
                mostrarAlerta("Contraseña cambiada exitosamente.", 'success');
                
                // Cerrar modal
                const modalElement = document.getElementById('passwordModal');
                const modal = bootstrap.Modal.getInstance(modalElement);
                modal.hide();
                passwordForm.reset();
            } else {
                mostrarAlerta("Error: La contraseña actual es incorrecta o los datos no coinciden.", 'error');
            }
            
        } catch (error) {
            mostrarAlerta("Error al intentar cambiar la contraseña.", 'error');
        }
    });
    
    // 6. Manejo de Envío de Formulario de Coche (Añadir/Editar)
    carForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Recolección de datos del coche
        const carData = {
            id: currentCarId || Date.now(), // Usa timestamp como ID temporal si es nuevo
            user_id: user.id,
            car_name: document.getElementById('car-name').value,
            model: document.getElementById('car-model').value,
            year: document.getElementById('car-year').value ? parseInt(document.getElementById('car-year').value) : null,
            description: document.getElementById('car-description').value,
            photo_url: document.getElementById('car-photo').value,
        };

        let storedCars = JSON.parse(localStorage.getItem('user_cars')) || [];

        if (currentCarId) {
            // Modo Editar
            const index = storedCars.findIndex(c => c.id === currentCarId);
            if (index !== -1) {
                // SIMULACIÓN: Guardar en localStorage
                storedCars[index] = carData;
            }
            mostrarAlerta("Coche actualizado correctamente.", 'success');
        } else {
            // Modo Añadir
            // SIMULACIÓN: Guardar en localStorage
            storedCars.push(carData);
            mostrarAlerta("Coche añadido correctamente.", 'success');
        }
        
        localStorage.setItem('user_cars', JSON.stringify(storedCars));
        loadCars(); // Recargar la lista de coches

        // Cerrar modal
        const modalElement = document.getElementById('carModal');
        const modal = bootstrap.Modal.getInstance(modalElement);
        modal.hide();
    });
    
    // 7. Manejo de Eliminación de Coche
    deleteCarBtn.addEventListener('click', () => {
        if (!currentCarId) return;
        
        const confirmDelete = confirm("¿Estás seguro de que quieres eliminar este coche de tu garaje?");
        
        if (confirmDelete) {
            let storedCars = JSON.parse(localStorage.getItem('user_cars')) || [];
            // SIMULACIÓN: Filtrar el coche a eliminar
            storedCars = storedCars.filter(c => c.id !== currentCarId);
            localStorage.setItem('user_cars', JSON.stringify(storedCars));
            
            loadCars();
            mostrarAlerta("Coche eliminado correctamente.", 'error');
            
            // Cerrar modal
            const modalElement = document.getElementById('carModal');
            const modal = bootstrap.Modal.getInstance(modalElement);
            modal.hide();
        }
    });
});