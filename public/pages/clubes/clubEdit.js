/**
 * clubEdit.js
 * -----------------------------------------------------------------------------
 * Este script maneja la lógica para cargar y editar los datos del club.
 */

// ⭐ Rutas de la API
const API_USERS_ME_URL = '/api/users?action=me';
const API_CLUBS_URL = '/api/clubs'; // Ruta para OBTENER y EDITAR un club

// Función para obtener el token JWT de sessionStorage
function getToken() {
    return sessionStorage.getItem('token');
}

// -----------------------------------------------------------------------------
// 1. Obtener ID del Club del Usuario Logueado (Lógica ya funcional)
// -----------------------------------------------------------------------------

/**
 * Llama a la API para obtener el perfil del usuario logueado y extraer su club_id.
 * @returns {Promise<number>} El ID del club.
 */
async function getClubIdFromUser() {
    const token = getToken();

    if (!token) {
        throw new Error('No se encontró el token de autenticación.');
    }

    try {
        console.log("Intentando obtener perfil del usuario desde:", API_USERS_ME_URL);
        const response = await fetch(API_USERS_ME_URL, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Token inválido o expirado.');
            }
            throw new Error(`Fallo en la API al obtener el perfil. Código: ${response.status}`);
        }

        const data = await response.json();
        const clubId = data.user ? data.user.club_id : null;

        if (!clubId) {
            // Un usuario presidente sin club aún puede ser un caso a manejar
            throw new Error('El usuario no está asignado a un club.');
        }

        console.log("ID de club del usuario obtenido:", clubId);
        return clubId;

    } catch (error) {
        console.error("Fallo al obtener el ID de club del usuario:", error.message);
        throw error;
    }
}

// -----------------------------------------------------------------------------
// 2. Lógica para Cargar y Rellenar los Datos del Club
// -----------------------------------------------------------------------------

/**
 * Llama a la API para obtener los datos del club y rellena el formulario.
 * @param {number} clubId El ID del club a cargar.
 */
async function loadClubData(clubId) {
    const token = getToken();
    const clubUrl = `${API_CLUBS_URL}?id=${clubId}`;

    try {
        console.log(`Cargando datos del club desde: ${clubUrl}`);
        const response = await fetch(clubUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error(`Fallo al cargar los datos del club. Código: ${response.status}`);
        }

        const data = await response.json();
        // Acceder a 'data.club' o al primer elemento del array si la respuesta es un array
        const clubData = data.club || (Array.isArray(data) && data.length > 0 ? data[0] : null);

        if (!clubData) {
            throw new Error('No se encontraron datos para este club ID.');
        }

        // ⭐ CORRECCIÓN DE IDS Y RELLENO DEL FORMULARIO ⭐
        document.getElementById('club-id').value = clubData.id || '';

        // 🎯 CORRECCIÓN NOMBRE: Intentar obtener 'nombre', luego 'name', o dejar vacío
        const clubName = clubData.nombre || clubData.name || '';
        document.getElementById('nombre_club').value = clubName;

        document.getElementById('descripcion').value = clubData.descripcion || '';
        document.getElementById('presidente_id').value = clubData.presidente_id || 'Desconocido';

        // 🎯 NUEVO CAMPO CIUDAD: Usar la propiedad 'ciudad' de la API
        const ciudadInput = document.getElementById('ciudad');
        if (ciudadInput) {
            ciudadInput.value = clubData.ciudad || '';
        }

        // Rellenar la fecha de creación (Formateado a YYYY-MM-DD para input[type="date"])
        const fechaCreacionInput = document.getElementById('fecha_creacion');
        if (fechaCreacionInput && clubData.fecha_creacion) {
            const date = new Date(clubData.fecha_creacion);
            // El componente date en HTML solo acepta el formato YYYY-MM-DD
            fechaCreacionInput.value = date.toISOString().split('T')[0];
        }

        // Rellenar la imagen actual
        const currentImage = document.getElementById('current-club-thumb');
        const noImageText = document.getElementById('no-image-text');

        if (currentImage) {
            if (clubData.imagen_url) {
                currentImage.src = clubData.imagen_url;
                currentImage.style.display = 'inline';
                if (noImageText) noImageText.style.display = 'none';
            } else {
                currentImage.style.display = 'none';
                if (noImageText) noImageText.style.display = 'inline';
            }
        }

        console.log("Datos del club cargados exitosamente y formulario rellenado.");

    } catch (error) {
        console.error("Error al cargar los datos del club:", error.message);
        // Asumiendo que showAlert es global de alertas.js
        if (typeof showAlert === 'function') {
            showAlert(`Error al cargar: ${error.message}`, 'error');
        } else {
            alert(`Error: No se pudieron cargar los datos del club. ${error.message}`);
        }
    }
}


// -----------------------------------------------------------------------------
// 3. Lógica para Manejar el Envío del Formulario (Edición PUT)
// -----------------------------------------------------------------------------

/**
 * Maneja el evento de envío del formulario para actualizar el club.
 * @param {Event} event Evento de submit.
 */
async function handleFormSubmit(event) {
    event.preventDefault();

    const clubId = document.getElementById('club-id').value;
    const token = getToken();

    if (!token || !clubId) {
        // Usamos showAlert directamente, asumiendo que alertas.js está cargado
        if (typeof showAlert === 'function') {
            showAlert('Falta el token de autenticación o el ID del club.', 'error');
        } else {
            alert('Falta el token de autenticación o el ID del club.');
        }
        return;
    }

    // Recolección de datos
    const newName = document.getElementById('nombre_club').value;
    const newDescription = document.getElementById('descripcion').value;
    const newCity = document.getElementById('ciudad')?.value || ''; // Obtener la Ciudad
    const newImageFile = document.getElementById('imagen_club_nueva').files[0];

    // Creación de FormData para manejar archivos y otros campos
    const updateData = new FormData();
    updateData.append('id', clubId);
    updateData.append('nombre', newName);
    updateData.append('descripcion', newDescription);
    updateData.append('ciudad', newCity); // Añadir la Ciudad

    // Añadir la imagen si existe
    if (newImageFile) {
        updateData.append('imagen', newImageFile);
    }

    // Deshabilitar el botón para evitar envíos dobles
    const submitBtn = event.submitter;
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Actualizando...';
    }


    try {
        const response = await fetch(`${API_CLUBS_URL}?id=${clubId}`, {
            method: 'PUT', // Usamos PUT para la edición de recursos
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: updateData
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || 'Error desconocido al actualizar el club.');
        }

        showAlert('Club actualizado exitosamente!', 'success');

        // Recargar los datos para mostrar posibles cambios de imagen
        loadClubData(clubId);

    } catch (error) {
        console.error("Error al actualizar el club:", error.message);
        showAlert(`Fallo al actualizar el club: ${error.message}`, 'error');
    } finally {
        // Habilitar el botón al finalizar
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Actualizar Club';
        }
    }
}


// -----------------------------------------------------------------------------
// 4. Inicialización y Ejecución Principal
// -----------------------------------------------------------------------------

/**
 * Inicializador principal del editor.
 */
function initializeClubEditor(clubId) {
    console.log(`Editor de club inicializado para el Club ID: ${clubId}.`);

    // 1. Cargar los datos existentes
    loadClubData(clubId);

    // 2. Adjuntar el listener para el envío del formulario
    const form = document.getElementById('club-edit-form');
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    } else {
        console.error("No se encontró el formulario con ID 'club-edit-form'.");
    }
}


/**
 * Función que se ejecuta cuando el DOM está completamente cargado.
 */
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Obtenemos el ID del club
        const clubId = await getClubIdFromUser();

        // Inicializamos el editor con el ID obtenido
        initializeClubEditor(clubId);

    } catch (error) {
        console.error("Error crítico durante la inicialización:", error.message);

        // Si hay un error de token o club no asignado, forzamos la redirección
        if (error.message.includes('token') || error.message.includes('asignado')) {
            if (typeof showAlert === 'function') {
                showAlert('Acceso denegado. Redirigiendo al inicio de sesión...', 'warning');
            }

            setTimeout(() => {
                window.location.href = '../../index.html';
            }, 3000);
        } else {
            if (typeof showAlert === 'function') {
                showAlert(`Error al iniciar la edición: ${error.message}`, 'error');
            }
        }
    }
});