const API_USERS_ME_URL = '/api/users?action=me';
const API_CLUBS_URL = '/api/clubs';

function getToken() {
    return sessionStorage.getItem('token');
}

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
        const clubData = data.club || (Array.isArray(data) && data.length > 0 ? data[0] : null);

        if (!clubData) {
            throw new Error('No se encontraron datos para este club ID.');
        }

        document.getElementById('club-id').value = clubData.id || '';

        const clubName = clubData.nombre || clubData.name || clubData.titulo || '';
        document.getElementById('nombre_club').value = clubName;

        let descripcion = clubData.descripcion || '';

        let ciudad = clubData.ciudad || '';

        if (!ciudad && descripcion) {
            const cityMatch = descripcion.match(/\[Ciudad:\s*([^\]]+)\]/i);

            if (cityMatch && cityMatch[1]) {
                ciudad = cityMatch[1].trim();

                descripcion = descripcion.replace(/\[Ciudad:\s*[^\]]+\]\s*/i, '').trim();
            }
        }

        document.getElementById('descripcion').value = descripcion;
        const ciudadInput = document.getElementById('ciudad');
        if (ciudadInput) {
            ciudadInput.value = ciudad;
        }

        document.getElementById('presidente_id').value = clubData.presidente_id || 'Desconocido';

        const fechaCreacionInput = document.getElementById('fecha_creacion');
        if (fechaCreacionInput && clubData.fecha_creacion) {
            const date = new Date(clubData.fecha_creacion);
            fechaCreacionInput.value = date.toISOString().split('T')[0];
        }

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
        if (typeof mostrarAlerta === 'function') {
            mostrarAlerta('Falta el token de autenticación o el ID del club.', 'error');
        } else {
            alert('Falta el token de autenticación o el ID del club.');
        }
        return;
    }

    const newName = document.getElementById('nombre_club').value;
    const newDescription = document.getElementById('descripcion').value;
    const newCity = document.getElementById('ciudad')?.value || '';
    const newImageFile = document.getElementById('imagen_club_nueva').files[0];

    const updateData = new FormData();
    updateData.append('id', clubId);
    updateData.append('nombre', newName);
    updateData.append('descripcion', newDescription);
    updateData.append('ciudad', newCity);

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
            throw new Error(result.message || 'Error desconocido al actualizar el club.');
        }

        mostrarAlerta('Club actualizado exitosamente!', 'success');

        loadClubData(clubId);

    } catch (error) {
        console.error("Error al actualizar el club:", error.message);
        mostrarAlerta(`Fallo al actualizar el club: ${error.message}`, 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Actualizar Club';
        }
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
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const clubId = await getClubIdFromUser();

        initializeClubEditor(clubId);

    } catch (error) {
        console.error("Error crítico durante la inicialización:", error.message);

        if (error.message.includes('token') || error.message.includes('asignado')) {
            if (typeof mostrarAlerta === 'function') {
                mostrarAlerta('Acceso denegado. Redirigiendo al inicio de sesión...', 'warning');
            }

            setTimeout(() => {
                window.location.href = '../../index.html';
            }, 3000);
        } else {
            if (typeof mostrarAlerta === 'function') {
                mostrarAlerta(`Error al iniciar la edición: ${error.message}`, 'error');
            }
        }
    }
});