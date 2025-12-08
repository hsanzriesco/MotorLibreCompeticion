/**
 * clubEdit.js
 * -----------------------------------------------------------------------------
 * Este script maneja la lógica para cargar el ID del club asociado al usuario
 * logueado y utiliza ese ID para inicializar las funciones de edición del club.
 */

// ⭐ CORRECCIÓN CLAVE: Usamos ?action=me para que el backend users.js lo reconozca.
const API_USERS_ME_URL = '/api/users?action=me';

// Función para obtener el token JWT del almacenamiento local
function getToken() {
    return localStorage.getItem('token');
}

// -----------------------------------------------------------------------------
// 1. Obtener ID del Club del Usuario Logueado
// -----------------------------------------------------------------------------

/**
 * Llama a la API para obtener el perfil del usuario logueado y extraer su club_id.
 * @returns {Promise<number>} El ID del club.
 * @throws {Error} Si la autenticación falla o el usuario no tiene club asignado.
 */
async function getClubIdFromUser() {
    const token = getToken();

    if (!token) {
        // clubEdit.js:33 (Aproximadamente)
        throw new Error('No se encontró el token de autenticación.');
    }

    try {
        console.log("Intentando obtener perfil del usuario desde:", API_USERS_ME_URL);

        // Línea 26: La URL corregida es usada aquí para evitar el 404
        const response = await fetch(API_USERS_ME_URL, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            // Maneja el error 401 que tu backend envia si el token es inválido/expirado
            if (response.status === 401) {
                throw new Error('Token inválido o expirado.');
            }
            // Captura cualquier otro error, incluido el 404 (si la corrección en Vercel no se aplicó)
            throw new Error(`Fallo en la API al obtener el perfil. Código: ${response.status}`);
        }

        const data = await response.json();

        // La estructura esperada de la respuesta es: { success: true, user: { id: ..., club_id: ... } }
        const clubId = data.user ? data.user.club_id : null;

        if (!clubId) {
            throw new Error('El usuario no está asignado a un club.');
        }

        console.log("ID de club del usuario obtenido:", clubId);
        return clubId;

    } catch (error) {
        // clubEdit.js:49 es donde se imprime el error de fallo
        console.error("Fallo al obtener el ID de club del usuario:", error.message);
        throw error;
    }
} // Fin de getClubIdFromUser

// -----------------------------------------------------------------------------
// 2. Inicialización del Editor (Función principal)
// -----------------------------------------------------------------------------

/**
 * Placeholder para la lógica que cargaría y permitiría editar el club.
 * Implementa aquí la lógica para interactuar con /api/clubs/{clubId}.
 */
function initializeClubEditor(clubId) {
    console.log(`Editor de club inicializado para el Club ID: ${clubId}.`);

    // Aquí iría el código para:
    // 1. Cargar los datos del club usando /api/clubs?id={clubId}
    // 2. Llenar los campos del formulario de edición.
    // 3. Añadir manejadores de eventos (submit) para guardar los cambios.
    // ...
}


/**
 * Función que se ejecuta cuando el DOM está completamente cargado.
 */
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Obtenemos el ID del club usando la función corregida
        const clubId = await getClubIdFromUser();

        // clubEdit.js:57 es el inicio de la ejecución asíncrona principal

        // Si el clubId se obtiene exitosamente, procedemos a inicializar el editor
        initializeClubEditor(clubId);

    } catch (error) {
        // Si hay un error, redirigimos o mostramos un mensaje
        console.error("Error crítico durante la inicialización:", error.message);

        // Manejo específico si el error viene de token expirado
        if (error.message.includes('Token inválido o expirado')) {
            alert('Sesión expirada. Por favor, vuelve a iniciar sesión.');
            // Opcional: Redirigir al login
            // window.location.href = '/login.html'; 
        } else {
            alert(`Acceso denegado: ${error.message}`);
        }
    }
});