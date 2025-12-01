document.addEventListener('DOMContentLoaded', () => {
    const locationsTableBody = document.getElementById('locationsTableBody');
    const locationForm = document.getElementById('locationForm');
    const locationIdInput = document.getElementById('locationId');
    const btnCancelEdit = document.getElementById('btnCancelEdit');
    const btnConfirmDelete = document.getElementById('btnConfirmDelete');
    
    let locationToDeleteId = null;

    // Función para limpiar el formulario
    const resetForm = () => {
        locationForm.reset();
        locationIdInput.value = '';
        btnCancelEdit.style.display = 'none';
        document.querySelector('button[type="submit"]').textContent = 'Guardar Lugar';
    };

    // Función para cargar la tabla
    const loadLocations = async () => {
        locationsTableBody.innerHTML = '<tr><td colspan="6" class="text-center">Cargando lugares...</td></tr>';
        
        try {
            const response = await fetch('/api/locations');
            const data = await response.json();

            if (data.success && data.data.length > 0) {
                locationsTableBody.innerHTML = data.data.map(location => `
                    <tr>
                        <td>${location.id}</td>
                        <td>${location.name}</td>
                        <td>${location.city || '-'}</td>
                        <td>${location.country || '-'}</td>
                        <td>${location.capacity || '-'}</td>
                        <td>
                            <button class="btn btn-sm btn-info text-white me-2" onclick="editLocation(${location.id})">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-sm btn-danger" data-bs-toggle="modal" data-bs-target="#deleteConfirmModal" onclick="setLocationToDelete(${location.id})">
                                <i class="bi bi-trash"></i>
                            </button>
                        </td>
                    </tr>
                `).join('');
            } else {
                locationsTableBody.innerHTML = '<tr><td colspan="6" class="text-center">No hay lugares registrados.</td></tr>';
            }
        } catch (error) {
            console.error('Error al cargar los lugares:', error);
            locationsTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error al conectar con la API.</td></tr>';
        }
    };

    // Función global para establecer el ID a eliminar
    window.setLocationToDelete = (id) => {
        locationToDeleteId = id;
    };

    // Función global para editar
    window.editLocation = async (id) => {
        try {
            const response = await fetch(`/api/locations?id=${id}`);
            const data = await response.json();

            if (data.success) {
                const location = data.data;
                locationIdInput.value = location.id;
                document.getElementById('name').value = location.name;
                document.getElementById('address').value = location.address;
                document.getElementById('city').value = location.city;
                document.getElementById('country').value = location.country;
                document.getElementById('capacity').value = location.capacity;
                
                document.querySelector('button[type="submit"]').textContent = 'Actualizar Lugar';
                btnCancelEdit.style.display = 'inline-block';
            } else {
                mostrarAlerta('error', 'Error', data.message || 'No se pudo cargar el lugar para editar.');
            }
        } catch (error) {
            console.error('Error al cargar datos para edición:', error);
            mostrarAlerta('error', 'Error', 'Fallo en la comunicación con el servidor.');
        }
    };

    // Manejador del formulario (Crear/Actualizar)
    locationForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const id = locationIdInput.value;
        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/locations?id=${id}` : '/api/locations';

        const locationData = {
            name: document.getElementById('name').value,
            address: document.getElementById('address').value,
            city: document.getElementById('city').value,
            country: document.getElementById('country').value,
            capacity: document.getElementById('capacity').value,
        };

        try {
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(locationData),
            });

            const data = await response.json();

            if (data.success) {
                mostrarAlerta('success', 'Éxito', data.message);
                resetForm();
                loadLocations();
            } else {
                mostrarAlerta('error', 'Error', data.message || 'Ocurrió un error al guardar el lugar.');
            }
        } catch (error) {
            console.error('Error al enviar formulario:', error);
            mostrarAlerta('error', 'Error', 'Fallo en la comunicación con el servidor.');
        }
    });

    // Cancelar edición
    btnCancelEdit.addEventListener('click', resetForm);

    // Confirmar eliminación
    btnConfirmDelete.addEventListener('click', async () => {
        if (!locationToDeleteId) return;

        try {
            const response = await fetch(`/api/locations?id=${locationToDeleteId}`, {
                method: 'DELETE',
            });
            
            const data = await response.json();

            if (data.success) {
                mostrarAlerta('success', 'Éxito', data.message);
                loadLocations();
                locationToDeleteId = null;
                // Cerrar el modal manualmente
                const modalElement = document.getElementById('deleteConfirmModal');
                const modal = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
                modal.hide();
            } else {
                mostrarAlerta('error', 'Error', data.message || 'Ocurrió un error al eliminar el lugar.');
            }
        } catch (error) {
            console.error('Error al eliminar:', error);
            mostrarAlerta('error', 'Error', 'Fallo en la comunicación con el servidor.');
        }
    });

    // Cargar la tabla al inicio
    loadLocations();
});