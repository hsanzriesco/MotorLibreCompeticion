// public/js/clubEdit.js

const API_USERS_ME_URL = '/api/users?action=me';
const API_CLUBS_URL = '/api/clubs';

// 🛑 BANDERA DE CONTROL Y FUNCIÓN CENTRALIZADA
let redireccionEnCurso = false;

function manejarFaltaAutenticacion(mensaje, tipo = 'error') {
    if (redireccionEnCurso) return;

    redireccionEnCurso = true;

    // Limpiar cualquier sesión corrupta o residual (Todas las claves posibles)
    sessionStorage.removeItem('usuario');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('jwtToken');
    sessionStorage.removeItem('usuario');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('jwtToken');

    // Muestra la ÚNICA alerta deseada
    if (typeof mostrarAlerta === 'function') {
        mostrarAlerta('Tienes que iniciar sesión para acceder a esta página', 'error');
    } else {
        alert('Tienes que iniciar sesión para acceder a esta página');
    }

    // Redirige
    setTimeout(() => {
        // Asumiendo que la ruta de login es correcta
        window.location.href = '/pages/auth/login/login.html';
    }, 1200);
}

// ---------------------------------------------

/**
 * Función mejorada para obtener el token.
 * Busca en sessionStorage y sessionStorage, y busca 'jwtToken' o 'token'.
 */
function getToken() {
    // 1. Prioridad: sessionStorage 'jwtToken' (estándar usado en otros scripts)
    let token = sessionStorage.getItem('jwtToken');
    if (token) return token;

    // 2. Fallback: sessionStorage 'token'
    token = sessionStorage.getItem('token');
    if (token) return token;

    // 3. Fallback: sessionStorage (si implementaste "recordarme")
    token = sessionStorage.getItem('jwtToken');
    if (token) return token;

    return sessionStorage.getItem('token');
}

/**
 * MODIFICADO: Ahora devuelve el objeto de usuario completo.
 * Lanza error si no tiene club_id.
 */
async function getClubIdAndUser() {
    const token = getToken();

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
                throw new Error('Unauthorized');
            }
            throw new Error(`Fallo en la API al obtener el perfil. Código: ${response.status}`);
        }

        const data = await response.json();
        // Ajuste: A veces la API devuelve data.data.user o data.user
        const user = data.user || data.data?.user;

        if (!user) {
            throw new Error('No se encontró el objeto de usuario en la respuesta.');
        }

        const clubId = user.club_id || null;

        if (!clubId) {
            // Este es el error original que salta.
            throw new Error('El usuario no está asignado a un club.');
        }

        // 💡 NOTA: Asumimos que la API YA devuelve 'is_presidente'
        const isPresidente = user.is_presidente === 1 || user.is_presidente === true || user.rol === 'presidente';

        console.log("ID de club del usuario obtenido:", clubId);
        console.log("Es presidente:", isPresidente);

        // Devolvemos el objeto completo para usar más adelante si es necesario
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
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Unauthorized');
            }
            throw new Error(`Fallo al cargar los datos del club. Código: ${response.status}`);
        }

        const data = await response.json();
        const clubData = data.club || (Array.isArray(data.clubs) ? data.clubs[0] : null) || (Array.isArray(data) ? data[0] : null);

        if (!clubData) {
            throw new Error('No se encontraron datos para este club ID.');
        }

        document.getElementById('club-id').value = clubData.id || '';

        const clubName = clubData.nombre || clubData.name || clubData.titulo || clubData.nombre_evento || '';
        document.getElementById('nombre_club').value = clubName;

        let descripcion = clubData.descripcion || '';
        let ciudad = clubData.ciudad || '';
        let enfoque = clubData.enfoque || '';

        // --- Lógica de compatibilidad (dejamos la tuya para evitar regresiones) ---
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
        // --- Fin Lógica de compatibilidad ---

        const enfoqueInput = document.getElementById('enfoque');
        if (enfoqueInput) {
            enfoqueInput.value = enfoque;
        }

        document.getElementById('descripcion').value = descripcion;

        const ciudadInput = document.getElementById('ciudad');
        if (ciudadInput) {
            ciudadInput.value = ciudad;
        }

        const fechaCreacionInput = document.getElementById('fecha_creacion');
        if (fechaCreacionInput && clubData.fecha_creacion) {
            const date = new Date(clubData.fecha_creacion);
            // Formatear a YYYY-MM-DD para input[type="date"] o mostrar correctamente
            fechaCreacionInput.value = date.toISOString().split('T')[0];
        }

        const currentImage = document.getElementById('current-club-thumb');
        const noImageText = document.getElementById('no-image-text');

        if (currentImage) {
            const imgUrl = clubData.imagen_url || clubData.imagen_club;
            if (imgUrl) {
                currentImage.src = imgUrl;
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

        if (error.message.includes('Unauthorized')) {
            manejarFaltaAutenticacion('Sesión expirada', 'error');
            return;
        }

        if (typeof mostrarAlerta === 'function') {
            mostrarAlerta(`Error al cargar: ${error.message}`, 'error');
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

    const newName = document.getElementById('nombre_club').value;
    const newDescription = document.getElementById('descripcion').value;
    const newCity = document.getElementById('ciudad')?.value || '';
    const newEnfoque = document.getElementById('enfoque')?.value || '';
    // Asegurarse de usar la clave del input file correcta (imagen_club_nueva es una convención común)
    const newImageFile = document.getElementById('imagen_club_nueva').files[0];

    const updateData = new FormData();
    updateData.append('id', clubId);
    updateData.append('nombre_evento', newName); // Clave correcta para backend
    updateData.append('descripcion', newDescription);
    updateData.append('ciudad', newCity);
    updateData.append('enfoque', newEnfoque);

    if (newImageFile) {
        updateData.append('imagen', newImageFile); // El backend debe esperar 'imagen' o 'imagen_club_nueva'
    }

    const submitBtn = event.submitter;
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Actualizando...';
    }

    try {
        const response = await fetch(`${API_CLUBS_URL}?id=${clubId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: updateData
        });

        const result = await response.json();

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Unauthorized');
            }
            throw new Error(result.message || 'Error desconocido al actualizar el club.');
        }

        if (typeof mostrarAlerta === 'function') {
            mostrarAlerta('Club actualizado exitosamente!', 'exito');
        } else {
            alert('Club actualizado exitosamente!');
        }

        // Recargar los datos para mostrar la nueva imagen/datos
        loadClubData(clubId);

    } catch (error) {
        console.error("Error al actualizar el club:", error.message);

        if (error.message.includes('Unauthorized')) {
            manejarFaltaAutenticacion('Sesión expirada', 'error');
            return;
        }

        if (typeof mostrarAlerta === 'function') {
            mostrarAlerta(`Fallo al actualizar el club: ${error.message}`, 'error');
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
 * 💡 NUEVA FUNCIÓN CLAVE: Maneja el evento de clic en el botón de confirmación de eliminación.
 * @param {string} clubId El ID del club a eliminar.
 */
async function handleClubDeletion(clubId) {
    const btnConfirmDelete = document.getElementById('btnConfirmDelete');
    const deleteConfirmModalEl = document.getElementById('deleteConfirmModal');

    // El modal de Bootstrap debe estar disponible globalmente
    if (!deleteConfirmModalEl || typeof bootstrap === 'undefined') {
        console.warn("ADVERTENCIA: No se encontró el elemento del modal o Bootstrap no está cargado. La eliminación NO funcionará.");
        return;
    }

    // Inicializar el modal de Bootstrap
    const deleteConfirmModal = new bootstrap.Modal(deleteConfirmModalEl);

    if (btnConfirmDelete) {
        btnConfirmDelete.addEventListener('click', async () => {
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
                // Llamada a la API con método DELETE
                const response = await fetch(`${API_CLUBS_URL}?id=${clubToDeleteId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                const result = await response.json();

                deleteConfirmModal.hide(); // Ocultar el modal

                if (response.ok) {

                    if (typeof mostrarAlerta === 'function') {
                        mostrarAlerta(result.message || 'Club eliminado. Redirigiendo...', 'exito', 3000);
                    } else {
                        alert(result.message || 'Club eliminado. Redirigiendo...');
                    }

                    // Limpiar datos de sesión relevantes
                    sessionStorage.removeItem('club_id');
                    sessionStorage.removeItem('role');

                    // Redirigir a la lista de clubes
                    setTimeout(() => {
                        // AJUSTA ESTA RUTA A DONDE DEBA IR EL USUARIO DESPUÉS DE ELIMINAR SU CLUB
                        window.location.href = '/pages/clubes/clubes.html';
                    }, 1500);

                } else {
                    if (response.status === 401) {
                        manejarFaltaAutenticacion(result.message || 'Acceso no autorizado para eliminar club.');
                        return;
                    }
                    if (typeof mostrarAlerta === 'function') {
                        mostrarAlerta(result.message || 'Error al eliminar el club.', 'error');
                    } else {
                        alert(result.message || 'Error al eliminar el club.');
                    }
                }

            } catch (error) {
                console.error('Error al intentar eliminar el club:', error);
                deleteConfirmModal.hide();
                if (typeof mostrarAlerta === 'function') {
                    mostrarAlerta('Error de conexión con el servidor al eliminar el club.', 'error');
                } else {
                    alert('Error de conexión con el servidor al eliminar el club.');
                }
            } finally {
                // Volver a habilitar el botón
                btnConfirmDelete.disabled = false;
                btnConfirmDelete.textContent = 'Sí, Eliminar Club';
            }
        });
    }
}

function initializeClubEditor(clubId) {
    console.log(`Editor de club inicializado para el Club ID: ${clubId}.`);
    loadClubData(clubId);

    const form = document.getElementById('club-edit-form');
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    } else {
        console.error("No se encontró el formulario con ID 'club-edit-form'.");
    }

    // 💡 MODIFICACIÓN CLAVE: Inicializar el manejo de la eliminación
    handleClubDeletion(clubId);
}

document.addEventListener('DOMContentLoaded', async () => {
    // 🛑 PRIMERA COMPROBACIÓN
    const localToken = getToken();

    if (!localToken) {
        manejarFaltaAutenticacion('Debes iniciar sesión', 'error');
        return;
    }

    try {
        // MODIFICADO: Llamamos a la nueva función que devuelve el objeto
        const { clubId, isPresidente } = await getClubIdAndUser();

        // 💡 NUEVA COMPROBACIÓN ADICIONAL
        if (!isPresidente) {
            if (typeof mostrarAlerta === 'function') {
                mostrarAlerta('Acceso denegado: Solo el presidente del club puede editar.', 'error');
            }
            // Redirigir si no es presidente (opcional, pero buena práctica)
            setTimeout(() => { window.location.href = '/pages/clubes/clubes.html'; }, 1500);
            return;
        }

        // Llamamos a initializeClubEditor CON el clubId que obtuvimos
        initializeClubEditor(clubId);

    } catch (error) {
        console.error("Error crítico durante la inicialización:", error.message);

        if (error.message.includes('Token') || error.message.includes('Unauthorized')) {
            manejarFaltaAutenticacion('Error de autenticación', 'error');
        } else if (error.message.includes('asignado')) {
            if (typeof mostrarAlerta === 'function') {
                mostrarAlerta('No tienes un club asignado para editar.', 'error');
            }
            // Redirigir a la lista de clubes
            setTimeout(() => { window.location.href = '/pages/clubes/clubes.html'; }, 1500);
        } else {
            if (typeof mostrarAlerta === 'function') {
                mostrarAlerta(`Error al iniciar la edición: ${error.message}`, 'error');
            }
        }
    }
});