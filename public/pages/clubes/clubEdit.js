/**
 * clubEdit.js
 * -----------------------------------------------------------------------------
 * Este script maneja la lógica para cargar y editar los datos del club.
 */

// ⭐ Rutas de la API
const API_USERS_ME_URL = '/api/users?action=me';
// Asumimos que esta es la ruta para OBTENER y EDITAR un club
const API_CLUBS_URL = '/api/clubs';

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
// 2. Lógica para Cargar y Rellenar los Datos del Club (Implementación)
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
                // Aseguramos la autenticación también para la carga del club
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error(`Fallo al cargar los datos del club. Código: ${response.status}`);
        }

        const data = await response.json();
        const clubData = data.club;

        if (!clubData) {
            throw new Error('No se encontraron datos para este club ID.');
        }

        // ⭐ Rellenar los campos del formulario ⭐
        document.getElementById('club-id').value = clubData.id;
        document.getElementById('nombre_evento').value = clubData.nombre_evento || '';
        document.getElementById('descripcion').value = clubData.descripcion || '';

        // Rellenar la fecha de creación si existe el campo en el formulario
        const fechaCreacionInput = document.getElementById('fecha_creacion');
        if (fechaCreacionInput) {
            // Formatear la fecha a un string local, si la propiedad existe
            fechaCreacionInput.value = clubData.fecha_creacion
                ? new Date(clubData.fecha_creacion).toLocaleDateString()
                : 'N/A';
        }

        // Rellenar la imagen actual
        const currentImage = document.getElementById('current-image');
        if (currentImage) {
            if (clubData.imagen_url) {
                currentImage.src = clubData.imagen_url;
            } else {
                // Usamos la ruta corregida para evitar el 404 si la imagen no existe
                currentImage.src = '../../public/img/placeholder-club.png';
            }
        }

        console.log("Datos del club cargados exitosamente y formulario rellenado.");

    } catch (error) {
        console.error("Error al cargar los datos del club:", error.message);
        // Si no se pudo cargar, alertamos.
        alert(`Error: No se pudieron cargar los datos del club. ${error.message}`);
    }
}


/**
 * Inicializador principal del editor.
 */
function initializeClubEditor(clubId) {
    console.log(`Editor de club inicializado para el Club ID: ${clubId}.`);

    // ⭐ LLAMAMOS A LA FUNCIÓN PARA CARGAR LOS DATOS ⭐
    loadClubData(clubId);

    // TODO: Aquí iría la lógica para el envío del formulario (PUT/POST)
    // document.getElementById('club-edit-form').addEventListener('submit', handleFormSubmit); 
}


// -----------------------------------------------------------------------------
// 3. Ejecución Principal
// -----------------------------------------------------------------------------

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

        // Si hay un error de token, forzamos la redirección
        if (error.message.includes('token') || error.message.includes('asignado')) {
            alert('Acceso denegado. No tienes un club asignado o tu sesión expiró.');
            // Redirigir al inicio o login
            window.location.href = '../../index.html';
        } else {
            alert(`Error al iniciar la edición: ${error.message}`);
        }
    }
});