// public/js/clubEdit.js

const API_USERS_ME_URL = '/api/users?action=me';
const API_CLUBS_URL = '/api/clubs';

// 🛑 BANDERA DE CONTROL Y FUNCIÓN CENTRALIZADA
let redireccionEnCurso = false;

/**
 * Función para manejar la falta de autenticación o errores críticos de sesión.
 * Limpia la sesión y redirige a la página de login.
 */
function manejarFaltaAutenticacion(mensaje, tipo = 'error') {
    if (redireccionEnCurso) return;

    redireccionEnCurso = true;

    // Limpiar todas las claves de sesión posibles para un logout forzado
    sessionStorage.removeItem('usuario');
    sessionStorage.removeItem('user'); // Nueva clave para la sesión completa
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('jwtToken');
    sessionStorage.removeItem('club_id');
    sessionStorage.removeItem('role');

    // Limpiar localStorage (para opción "recordarme")
    localStorage.removeItem('usuario');
    localStorage.removeItem('token');
    localStorage.removeItem('jwtToken');

    // Muestra la ÚNICA alerta deseada
    if (typeof mostrarAlerta === 'function') {
        mostrarAlerta(tipo, mensaje, 'error');
    } else {
        alert(mensaje);
    }

    // Redirige
    setTimeout(() => {
        // Asumiendo que la ruta de login es correcta
        window.location.href = '/pages/auth/login/login.html';
    }, 1200);
}

/**
 * Función mejorada para obtener el token.
 * Busca en sessionStorage y localStorage, y busca 'jwtToken' o 'token'.
 */
function getToken() {
    let token = sessionStorage.getItem('jwtToken');
    if (token) return token;

    token = sessionStorage.getItem('token');
    if (token) return token;

    // Si se usó "recordarme"
    token = localStorage.getItem('jwtToken');
    if (token) return token;

    return localStorage.getItem('token');
}

/**
 * MODIFICADO: Ahora devuelve el clubId, el objeto de usuario y la bandera isPresidente.
 */
async function getClubIdAndUser() {
    const token = getToken();
    if (!token) {
        throw new Error('Unauthorized: Token no encontrado.');
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
            let errorMessage = `Fallo en la API al obtener el perfil. Código: ${response.status}`;

            try {
                const errorData = await response.json();
                errorMessage = errorData.message || errorData.error || errorMessage;
            } catch (e) {
                // Fallback
            }

            if (response.status === 401 || response.status === 403) {
                throw new Error('Unauthorized');
            }
            throw new Error(errorMessage);
        }

        const data = await response.json();
        const user = data.user || data.data?.user;

        if (!user) {
            throw new Error('No se encontró el objeto de usuario en la respuesta.');
        }

        // Asumimos que la API devuelve 'club_id'
        const clubId = user.club_id || null;

        // 💡 Ajuste: Usar la propiedad 'is_presidente' o 'rol' para determinar si es presidente
        const isPresidente = user.is_presidente === 1 || user.is_presidente === true || user.rol === 'presidente';

        // Opcional: Persistir el club_id en sesión para otros scripts (aunque no es necesario aquí)
        if (clubId) {
            sessionStorage.setItem('club_id', clubId);
        }

        if (!clubId) {
            // Este es el error original si el usuario no tiene club asociado.
            throw new new Error('El usuario no está asignado a un club.');
        }

        console.log("ID de club del usuario obtenido:", clubId);
        console.log("Es presidente:", isPresidente);

        return { clubId, user, isPresidente };

    } catch (error) {
        console.error("Fallo al obtener el ID de club del usuario:", error.message);
        throw error;
    }
}

async function loadClubData(clubId) {
    const token = getToken();
    const clubUrl = `${API_CLUBS_URL}?id=${clubId}`;

    try {
        console.log(`Cargando datos del club desde: ${clubUrl}`);
        const response = await fetch(clubUrl, {
            method: 'GET',
            headers: {
                // No necesitamos Content-Type: application/json en GET, pero es inofensivo
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            let errorMessage = `Fallo al cargar los datos del club. Código: ${response.status}`;

            try {
                const errorData = await response.json();
                errorMessage = errorData.message || errorData.error || errorMessage;
            } catch (e) {
                // Fallback
            }

            if (response.status === 401) {
                throw new Error('Unauthorized');
            }
            throw new Error(errorMessage);
        }

        const data = await response.json();
        // Buscar el objeto club en diferentes formatos de respuesta
        const clubData = data.club || (Array.isArray(data.clubs) ? data.clubs[0] : null) || (Array.isArray(data) ? data[0] : null);

        if (!clubData) {
            throw new Error('No se encontraron datos para este club ID.');
        }

        // Rellenar campos del formulario
        document.getElementById('club-id').value = clubData.id || '';

        // 🛑 Importante: Mapear a nombre_club del formulario
        const clubName = clubData.nombre_evento || clubData.nombre || clubData.name || clubData.titulo || '';
        document.getElementById('nombre_club').value = clubName;

        // Si el backend es moderno, ya devuelve estos campos
        const enfoque = clubData.enfoque || '';
        const ciudad = clubData.ciudad || '';
        let descripcion = clubData.descripcion || '';

        // Lógica de compatibilidad legacy (por si el backend no se ha actualizado a columnas separadas)
        if (!ciudad && descripcion) {
            const cityMatch = descripcion.match(/\[Ciudad:\s*([^\]]+)\]/i);
            if (cityMatch && cityMatch[1]) {
                ciudad = cityMatch[1].trim();
                descripcion = descripcion.replace(/\[Ciudad:\s*[^\]]+\]\s*/i, '').trim();
            }
        }
        if (!enfoque && descripcion) {
            const enfoqueMatch = descripcion.match(/\[Enfoque:\s*([^\]]+)\]/i);
            if (enfoqueMatch && enfoqueMatch[1]) {
                enfoque = enfoqueMatch[1].trim();
                descripcion = descripcion.replace(/\[Enfoque:\s*[^\]]+\]\s*/i, '').trim();
            }
        }
        // Fin Lógica de compatibilidad

        document.getElementById('enfoque').value = enfoque;
        document.getElementById('descripcion').value = descripcion;
        document.getElementById('ciudad').value = ciudad;

        const fechaCreacionInput = document.getElementById('fecha_creacion');
        if (fechaCreacionInput && clubData.fecha_creacion) {
            const date = new Date(clubData.fecha_creacion);
            // Mostrar la fecha de creación en formato local
            fechaCreacionInput.value = date.toLocaleDateString();
        }

        // Lógica de imagen
        const currentImage = document.getElementById('current-club-thumb');
        const noImageText = document.getElementById('no-image-text');

        const imgUrl = clubData.imagen_url || clubData.imagen_club;
        if (imgUrl) {
            currentImage.src = imgUrl;
            currentImage.style.display = 'inline';
            if (noImageText) noImageText.style.display = 'none';
        } else {
            currentImage.style.display = 'none';
            if (noImageText) noImageText.style.display = 'inline';
        }

        console.log("Datos del club cargados exitosamente y formulario rellenado.");

    } catch (error) {
        console.error("Error al cargar los datos del club:", error.message);

        if (error.message.includes('Unauthorized')) {
            manejarFaltaAutenticacion('Sesión expirada o no autorizado.', 'error');
            return;
        }

        if (typeof mostrarAlerta === 'function') {
            mostrarAlerta('error', `Error al cargar: ${error.message}`);
        } else {
            alert(`Error: No se pudieron cargar los datos del club. ${error.message}`);
        }
    }
}

async function handleFormSubmit(event) {
    event.preventDefault();

    const clubId = document.getElementById('club-id').value;
    const token = getToken();

    if (!token || !clubId) {
        manejarFaltaAutenticacion('Sesión inválida', 'error');
        return;
    }

    const form = event.target;
    const formData = new FormData(form);

    // 🛑 CORRECCIÓN CLAVE: Mapear 'nombre_club' del cliente a 'nombre_evento' del servidor
    // 'nombre_club' es el ID del input, 'nombre_evento' es lo que espera el backend
    const newName = formData.get('nombre_club');
    formData.append('nombre_evento', newName);
    formData.delete('nombre_club'); // Eliminar la clave redundante

    // El campo id es necesario para la API
    formData.append('id', clubId);

    // 🛑 CORRECCIÓN CLAVE: Asegurarse de que el input file coincida con el nombre del campo del HTML
    const newImageFile = document.getElementById('imagen_club_nueva').files[0];
    if (newImageFile) {
        // En el HTML el input tiene name="imagen_club_nueva", así se envía en FormData.
        formData.set('imagen_club_nueva', newImageFile);
    } else {
        // Si no hay nueva imagen, asegurarse de no enviar una clave con valor vacío o file vacío
        formData.delete('imagen_club_nueva');
    }

    const submitBtn = document.querySelector('button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Actualizando...';
    }

    // Ocultar la alerta info si existe
    if (typeof limpiarAlertas === 'function') limpiarAlertas();
    if (typeof mostrarAlerta === 'function') mostrarAlerta('info', 'Actualizando...', 'Enviando datos...');


    try {
        const response = await fetch(`${API_CLUBS_URL}?id=${clubId}`, {
            method: 'PUT',
            headers: {
                // ⚠️ NOTA: Al enviar FormData, NO se debe incluir el Content-Type.
                'Authorization': `Bearer ${token}`
            },
            body: formData // FormData se encarga del Content-Type: multipart/form-data
        });

        if (!response.ok) {
            let errorMessage = 'Error desconocido al actualizar el club.';
            try {
                const errorData = await response.json();
                errorMessage = errorData.message || errorData.error || errorMessage;
            } catch (e) {
                errorMessage += ` (Código: ${response.status})`;
            }

            if (response.status === 401 || response.status === 403) {
                throw new Error('Unauthorized');
            }
            throw new Error(errorMessage);
        }

        // Si la respuesta fue OK, parseamos el resultado
        const result = await response.json();

        if (typeof mostrarAlerta === 'function') {
            mostrarAlerta('exito', '¡Club actualizado exitosamente!', result.message || 'Los cambios se han guardado.');
        } else {
            alert('Club actualizado exitosamente!');
        }

        // Recargar los datos para mostrar la nueva imagen/datos
        loadClubData(clubId);

    } catch (error) {
        console.error("Error al actualizar el club:", error.message);

        if (error.message.includes('Unauthorized')) {
            manejarFaltaAutenticacion('Sesión expirada o no autorizado.', 'error');
            return;
        }

        if (typeof mostrarAlerta === 'function') {
            mostrarAlerta('error', `Fallo al actualizar el club: ${error.message}`);
        } else {
            alert(`Fallo al actualizar: ${error.message}`);
        }
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Actualizar Club';
        }
    }
}

/**
 * Función CLAVE: Maneja el evento de clic en el botón de confirmación de eliminación.
 * @param {string} clubId El ID del club a eliminar.
 */
function handleClubDeletion(clubId) {
    const btnConfirmDelete = document.getElementById('btnConfirmDelete');
    const deleteConfirmModalEl = document.getElementById('deleteConfirmModal');

    // Comprobación de que Bootstrap y el modal están cargados
    if (!deleteConfirmModalEl || typeof bootstrap === 'undefined') {
        console.error("ADVERTENCIA: Elemento del modal o Bootstrap no está cargado. La eliminación no puede ser manejada.");
        return;
    }

    // Usar una instancia del modal para poder ocultarlo programáticamente
    const deleteConfirmModal = new bootstrap.Modal(deleteConfirmModalEl);

    if (btnConfirmDelete) {
        // Asegurarse de adjuntar el evento solo una vez
        btnConfirmDelete.removeEventListener('click', handleConfirmDeleteClick);
        btnConfirmDelete.addEventListener('click', handleConfirmDeleteClick);
    }

    async function handleConfirmDeleteClick() {
        const clubToDeleteId = document.getElementById('club-id').value;
        const token = getToken();

        if (!clubToDeleteId || !token) {
            deleteConfirmModal.hide();
            manejarFaltaAutenticacion('Sesión inválida o ID de club faltante.');
            return;
        }

        // Deshabilitar botón
        btnConfirmDelete.disabled = true;
        btnConfirmDelete.textContent = 'Eliminando...';

        try {
            // Ocultar el modal ANTES de la llamada a la API
            deleteConfirmModal.hide();
            if (typeof mostrarAlerta === 'function') mostrarAlerta('info', 'Eliminando...', 'Procesando la solicitud de eliminación.');

            // Llamada a la API con método DELETE
            const response = await fetch(`${API_CLUBS_URL}?id=${clubToDeleteId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                let errorMessage = 'Error al eliminar el club.';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.message || errorData.error || errorMessage;
                } catch (e) {
                    errorMessage += ` (Código: ${response.status})`;
                }

                if (response.status === 401 || response.status === 403) {
                    manejarFaltaAutenticacion('Error de autorización al intentar eliminar el club. ', 'error');
                    return;
                }

                if (typeof mostrarAlerta === 'function') {
                    mostrarAlerta('error', errorMessage);
                } else {
                    alert(errorMessage);
                }

                throw new Error(errorMessage); // Lanzar para el catch y el finally
            }

            // Si es OK, leemos el resultado
            const result = await response.json();

            // Lógica de éxito
            if (typeof mostrarAlerta === 'function') {
                mostrarAlerta('exito', result.message || 'Club eliminado con éxito. Redirigiendo...', 3000);
            } else {
                alert(result.message || 'Club eliminado. Redirigiendo...');
            }

            // 🛑 Limpiar sesión completa del usuario (ya no tiene club)
            sessionStorage.removeItem('club_id');
            sessionStorage.removeItem('role');
            sessionStorage.removeItem('jwtToken');
            sessionStorage.removeItem('user');

            setTimeout(() => {
                // Redirigir a la lista de clubes o inicio
                window.location.href = '../../../index.html';
            }, 1500);

        } catch (error) {
            console.error('Error al intentar eliminar el club:', error);

            // La alerta ya se mostró dentro del if (!response.ok), solo manejamos el finally aquí.
            if (!error.message.includes('Error al eliminar el club') && !error.message.includes('Unauthorized')) {
                if (typeof mostrarAlerta === 'function') {
                    mostrarAlerta('error', 'Error de conexión o inesperado al eliminar el club.');
                }
            }
        } finally {
            // Volver a habilitar el botón
            btnConfirmDelete.disabled = false;
            btnConfirmDelete.textContent = 'Sí, Eliminar Club';
        }
    }
}

function initializeClubEditor(clubId) {
    console.log(`Editor de club inicializado para el Club ID: ${clubId}.`);

    // 1. Cargar datos del club
    loadClubData(clubId);

    // 2. Adjuntar listener para la actualización
    const form = document.getElementById('club-edit-form');
    if (form) {
        form.removeEventListener('submit', handleFormSubmit); // Evitar duplicados
        form.addEventListener('submit', handleFormSubmit);
    } else {
        console.error("No se encontró el formulario con ID 'club-edit-form'.");
    }

    // 3. Inicializar el manejo de la eliminación
    handleClubDeletion(clubId);
}

document.addEventListener('DOMContentLoaded', async () => {
    // 🛑 PRIMERA COMPROBACIÓN (rápida)
    const localToken = getToken();

    if (!localToken) {
        manejarFaltaAutenticacion('Debes iniciar sesión para acceder', 'error');
        return;
    }

    try {
        // MODIFICADO: Llamamos a la nueva función que devuelve el objeto de usuario completo
        const { clubId, isPresidente } = await getClubIdAndUser();

        // 💡 COMPROBACIÓN CRÍTICA: Solo el presidente puede acceder a esta página
        if (!isPresidente) {
            if (typeof mostrarAlerta === 'function') {
                mostrarAlerta('error', 'Acceso denegado', 'Solo el presidente del club puede editar el perfil.');
            }
            // Redirigir si no es presidente (opcional, pero buena práctica)
            setTimeout(() => { window.location.href = '/pages/clubes/clubes.html'; }, 1500);
            return;
        }

        // Si es presidente, inicializar el editor
        initializeClubEditor(clubId);

    } catch (error) {
        console.error("Error crítico durante la inicialización:", error.message);

        if (error.message.includes('Unauthorized')) {
            manejarFaltaAutenticacion('Error de autenticación: Sesión expirada.', 'error');
        } else if (error.message.includes('asignado')) {
            if (typeof mostrarAlerta === 'function') {
                mostrarAlerta('error', 'No tienes un club asignado para editar.', 'Información');
            }
            // Redirigir a la lista de clubes
            setTimeout(() => { window.location.href = '/pages/clubes/clubes.html'; }, 1500);
        } else {
            if (typeof mostrarAlerta === 'function') {
                mostrarAlerta('error', `Error al iniciar la edición: ${error.message}`);
            }
        }
    }
});