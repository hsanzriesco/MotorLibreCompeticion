const API_USERS_ME_URL = '/api/users?action=me';
const API_CLUBS_URL = '/api/clubs';

let redireccionEnCurso = false;

function manejarFaltaAutenticacion(mensaje, tipo = 'error') {
    if (redireccionEnCurso) return;
    redireccionEnCurso = true;

    sessionStorage.removeItem('usuario');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('jwtToken');
    localStorage.removeItem('usuario');
    localStorage.removeItem('token');
    localStorage.removeItem('jwtToken');

    if (typeof mostrarAlerta === 'function') {
        mostrarAlerta('Tienes que iniciar sesión para acceder a esta página', 'error');
    } else {
        alert('Tienes que iniciar sesión para acceder a esta página');
    }

    setTimeout(() => {
        window.location.href = '/pages/auth/login/login.html';
    }, 1200);
}

function getToken() {
    let token = sessionStorage.getItem('jwtToken');
    if (token) return token;
    token = sessionStorage.getItem('token');
    if (token) return token;
    token = localStorage.getItem('jwtToken');
    if (token) return token;
    return localStorage.getItem('token');
}

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
        const user = data.user || data.data?.user;

        if (!user) {
            throw new Error('No se encontró el objeto de usuario en la respuesta.');
        }

        const clubId = user.club_id || null;

        if (!clubId) {
            throw new Error('El usuario no está asignado a un club.');
        }

        const isPresidente = user.is_presidente === 1 || user.is_presidente === true || user.rol === 'presidente';

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
    const newImageFile = document.getElementById('imagen_club_nueva').files[0];

    const updateData = new FormData();
    updateData.append('id', clubId);
    updateData.append('nombre_evento', newName);
    updateData.append('descripcion', newDescription);
    updateData.append('ciudad', newCity);
    updateData.append('enfoque', newEnfoque);

    if (newImageFile) {
        updateData.append('imagen', newImageFile);
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

async function handleClubDeletion(clubId) {
    const btnConfirmDelete = document.getElementById('btnConfirmDelete');
    const deleteConfirmModalEl = document.getElementById('deleteConfirmModal');

    if (!deleteConfirmModalEl || typeof bootstrap === 'undefined') {
        console.warn("ADVERTENCIA: No se encontró el elemento del modal o Bootstrap no está cargado.");
        return;
    }

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

            btnConfirmDelete.disabled = true;
            btnConfirmDelete.textContent = 'Eliminando...';

            try {
                const response = await fetch(`${API_CLUBS_URL}?id=${clubToDeleteId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                const result = await response.json();

                deleteConfirmModal.hide();

                if (response.ok) {
                    if (result.token) {
                        console.log("Actualizando token con rol degradado (usuario)...");
                        sessionStorage.setItem('jwtToken', result.token);
                        sessionStorage.setItem('token', result.token);
                        localStorage.setItem('jwtToken', result.token);
                    }

                    sessionStorage.removeItem('club_id');
                    sessionStorage.removeItem('role');
                    sessionStorage.removeItem('is_presidente');

                    if (typeof mostrarAlerta === 'function') {
                        mostrarAlerta(result.message || 'Club eliminado. Redirigiendo...', 'exito', 3000);
                    } else {
                        alert(result.message || 'Club eliminado. Redirigiendo...');
                    }

                    setTimeout(() => {
                        window.location.href = '/pages/clubes/clubes.html';
                    }, 1500);

                } else {
                    if (response.status === 401) {
                        manejarFaltaAutenticacion(result.message || 'Acceso no autorizado.');
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
                    mostrarAlerta('Error de conexión con el servidor.', 'error');
                } else {
                    alert('Error de conexión con el servidor.');
                }
            } finally {
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

    handleClubDeletion(clubId);
}

document.addEventListener('DOMContentLoaded', async () => {
    const localToken = getToken();

    if (!localToken) {
        manejarFaltaAutenticacion('Debes iniciar sesión', 'error');
        return;
    }

    try {
        const { clubId, isPresidente } = await getClubIdAndUser();

        if (!isPresidente) {
            if (typeof mostrarAlerta === 'function') {
                mostrarAlerta('Acceso denegado: Solo el presidente del club puede editar.', 'error');
            }
            setTimeout(() => { window.location.href = '/pages/clubes/clubes.html'; }, 1500);
            return;
        }

        initializeClubEditor(clubId);

    } catch (error) {
        console.error("Error crítico durante la inicialización:", error.message);

        if (error.message.includes('Token') || error.message.includes('Unauthorized')) {
            manejarFaltaAutenticacion('Error de autenticación', 'error');
        } else if (error.message.includes('asignado')) {
            if (typeof mostrarAlerta === 'function') {
                mostrarAlerta('No tienes un club asignado para editar.', 'error');
            }
            setTimeout(() => { window.location.href = '/pages/clubes/clubes.html'; }, 1500);
        } else {
            if (typeof mostrarAlerta === 'function') {
                mostrarAlerta(`Error al iniciar la edición: ${error.message}`, 'error');
            }
        }
    }
});
