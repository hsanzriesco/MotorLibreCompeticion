// En pages/dashboard/admin/lugares/adminLugares.js

document.addEventListener('DOMContentLoaded', () => {
    // Definimos las variables necesarias
    const locationsTableBody = document.getElementById('locationsTableBody');
    const locationForm = document.getElementById('locationForm');
    const locationIdInput = document.getElementById('locationId');
    const btnCancelEdit = document.getElementById('btnCancelEdit');

    // NOTA: Se eliminan: locationToDeleteId, btnConfirmDelete, setLocationToDelete 
    //       y el modal de Bootstrap, ya que usamos las funciones de alertas.js.

    // Función para limpiar el formulario
    const resetForm = () => {
        locationForm.reset();
        locationIdInput.value = '';
        btnCancelEdit.style.display = 'none';
        document.querySelector('button[type="submit"]').textContent = 'Guardar Lugar';
    };

    // Función para cargar la tabla
    const loadLocations = async () => {
        // 1. Mostrar mensaje de carga usando la función personalizada o mensaje simple
        locationsTableBody.innerHTML = '<tr><td colspan="6" class="text-center">Cargando lugares...</td></tr>';

        try {
            const response = await fetch('/api/locations');
            const data = await response.json();

            if (data.success) {
                if (data.data.length > 0) {
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
                                <button class="btn btn-sm btn-danger" data-location-id="${location.id}">
                                    <i class="bi bi-trash"></i>
                                </button>
                            </td>
                        </tr>
                    `).join('');
                } else {
                    locationsTableBody.innerHTML = '<tr><td colspan="6" class="text-center">No hay lugares registrados.</td></tr>';
                }
            } else {
                // Usamos la función de alerta personalizada
                locationsTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Error de la API: ${data.message || 'No se pudieron cargar los lugares.'}</td></tr>`;
            }
        } catch (error) {
            console.error('Error al cargar los lugares:', error);
            // Usamos la función de alerta personalizada
            locationsTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error al conectar con el servidor.</td></tr>';
        }
    };

    // Función global para editar (se llama desde el botón 'onclick')
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
                // Usamos la función de alerta personalizada
                mostrarAlerta(data.message || 'No se pudo cargar el lugar para editar.', 'error');
            }
        } catch (error) {
            console.error('Error al cargar datos para edición:', error);
            // Usamos la función de alerta personalizada
            mostrarAlerta('Fallo en la comunicación con el servidor.', 'error');
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
                // Usamos la función de alerta personalizada
                mostrarAlerta(data.message, 'exito');
                resetForm();
                loadLocations();
            } else {
                // Usamos la función de alerta personalizada
                mostrarAlerta(data.message || 'Ocurrió un error al guardar el lugar.', 'error');
            }
        } catch (error) {
            console.error('Error al enviar formulario:', error);
            // Usamos la función de alerta personalizada
            mostrarAlerta('Fallo en la comunicación con el servidor.', 'error');
        }
    });

    // Cancelar edición
    btnCancelEdit.addEventListener('click', resetForm);

    // DELEGACIÓN DE EVENTOS PARA ELIMINACIÓN (Usando mostrarConfirmacion)
    locationsTableBody.addEventListener('click', async (e) => {
        // Buscamos el botón de eliminación
        const deleteButton = e.target.closest('.btn-danger');

        if (deleteButton) {
            const id = deleteButton.dataset.locationId;

            if (id) {
                // 1. Mostramos la confirmación personalizada
                const confirmed = await mostrarConfirmacion('¿Estás seguro de que deseas eliminar este lugar? Esta acción es irreversible.');

                if (confirmed) {
                    try {
                        const response = await fetch(`/api/locations?id=${id}`, {
                            method: 'DELETE',
                        });

                        const data = await response.json();

                        if (data.success) {
                            // 2. Usamos alerta de éxito
                            mostrarAlerta('Lugar eliminado correctamente.', 'exito');
                            loadLocations();
                        } else {
                            // 3. Usamos alerta de error
                            mostrarAlerta(data.message || 'Ocurrió un error al eliminar el lugar.', 'error');
                        }
                    } catch (error) {
                        console.error('Error al eliminar:', error);
                        mostrarAlerta('Fallo en la comunicación con el servidor al eliminar.', 'error');
                    }
                }
            }
        }
    });

    // Cargar la tabla al inicio
    loadLocations();
});