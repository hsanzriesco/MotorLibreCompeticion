const API_USERS_ME_URL = '/api/users?action=me';
const API_CLUBS_URL = '/api/clubs';

// 🛑 BANDERA DE CONTROL Y FUNCIÓN CENTRALIZADA
let redireccionEnCurso = false;

function manejarFaltaAutenticacion(mensaje, tipo = 'error') {
    if (redireccionEnCurso) return;

    redireccionEnCurso = true;

    // Limpiar cualquier sesión corrupta o residual
    sessionStorage.removeItem('usuario');
    localStorage.removeItem('usuario');
    sessionStorage.removeItem('token');

    // Muestra la ÚNICA alerta deseada (se fuerza el mensaje y el tipo 'error')
    mostrarAlerta('Tienes que iniciar sesión para acceder a esta página', 'error');

    // Redirige
    setTimeout(() => {
        // Asegúrate de que la ruta sea correcta
        window.location.href = '/pages/auth/login/login.html';
    }, 1200);
}
// ---------------------------------------------


function getToken() {
    return sessionStorage.getItem('token');
}

async function getClubIdFromUser() {
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
                throw new Error('Token inválido o expirado. Unauthorized');
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
            // Manejo de 401 en loadClubData por si acaso
            if (response.status === 401) {
                throw new Error('Unauthorized');
            }
            throw new Error(`Fallo al cargar los datos del club. Código: ${response.status}`);
        }

        const data = await response.json();
        const clubData = data.club || (Array.isArray(data) && data.length > 0 ? data[0] : null);

        if (!clubData) {
            throw new Error('No se encontraron datos para este club ID.');
        }

        document.getElementById('club-id').value = clubData.id || '';

        const clubName = clubData.nombre || clubData.name || clubData.titulo || clubData.nombre_evento || '';
        document.getElementById('nombre_club').value = clubName;

        let descripcion = clubData.descripcion || '';
        let ciudad = clubData.ciudad || '';

        // Lógica de compatibilidad para extraer ciudad si aún está incrustada
        if (!ciudad && descripcion) {
            const cityMatch = descripcion.match(/\[Ciudad:\s*([^\]]+)\]/i);

            if (cityMatch && cityMatch[1]) {
                ciudad = cityMatch[1].trim();

                descripcion = descripcion.replace(/\[Ciudad:\s*[^\]]+\]\s*/i, '').trim();
            }
        }

        // Lógica para extraer Enfoque de la descripción para compatibilidad
        let enfoque = clubData.enfoque || '';

        // Si 'enfoque' no viene directamente de la BD, lo buscamos en la descripción.
        if (!enfoque && descripcion) {
            // Patrón para buscar [Enfoque: Valor]
            const enfoqueMatch = descripcion.match(/\[Enfoque:\s*([^\]]+)\]/i);

            if (enfoqueMatch && enfoqueMatch[1]) {
                enfoque = enfoqueMatch[1].trim();
                // Eliminar el marcador [Enfoque: Valor] de la descripción original
                descripcion = descripcion.replace(/\[Enfoque:\s*[^\]]+\]\s*/i, '').trim();
            }
        }

        // Asignar los valores extraídos/cargados a los campos del formulario
        const enfoqueInput = document.getElementById('enfoque');
        if (enfoqueInput) {
            enfoqueInput.value = enfoque;
        }

        document.getElementById('descripcion').value = descripcion;

        const ciudadInput = document.getElementById('ciudad');
        if (ciudadInput) {
            ciudadInput.value = ciudad;
        }

        // ⭐⭐⭐ ELIMINADO: Se removió la línea que buscaba 'presidente_id' ya que se eliminó del HTML

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

        // Si hay un error de token, redirigir
        if (error.message.includes('Unauthorized')) {
            manejarFaltaAutenticacion('Mensaje irrelevante, la función lo reemplaza', 'error');
            return;
        }

        // Manejo de otros errores
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
        // Usar función centralizada para garantizar una única alerta
        manejarFaltaAutenticacion('Mensaje irrelevante, la función lo reemplaza', 'error');
        return;
    }

    const newName = document.getElementById('nombre_club').value;
    const newDescription = document.getElementById('descripcion').value;
    const newCity = document.getElementById('ciudad')?.value || '';

    // Capturar el valor de enfoque
    const newEnfoque = document.getElementById('enfoque')?.value || '';

    const newImageFile = document.getElementById('imagen_club_nueva').files[0];

    const updateData = new FormData();
    updateData.append('id', clubId);

    // CORRECCIÓN: Usar 'nombre_evento' que es la clave esperada por el backend clubs.js
    updateData.append('nombre_evento', newName);

    updateData.append('descripcion', newDescription);
    updateData.append('ciudad', newCity);

    // Añadir enfoque al FormData
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
            // Manejo de 401 en la actualización
            if (response.status === 401) {
                throw new Error('Unauthorized');
            }
            throw new Error(result.message || 'Error desconocido al actualizar el club.');
        }

        mostrarAlerta('Club actualizado exitosamente!', 'success');

        // Recargar los datos después de una actualización exitosa para reflejar los cambios (descripción limpia)
        loadClubData(clubId);

    } catch (error) {
        console.error("Error al actualizar el club:", error.message);

        if (error.message.includes('Unauthorized')) {
            manejarFaltaAutenticacion('Mensaje irrelevante, la función lo reemplaza', 'error');
            return;
        }

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
    // 🛑 PRIMERA COMPROBACIÓN CRÍTICA: Impedir la llamada a la API si no hay token.
    const localToken = getToken();

    if (!localToken) {
        // Muestra la ÚNICA alerta roja y detiene la ejecución del script.
        manejarFaltaAutenticacion('Mensaje irrelevante, la función lo reemplaza', 'error');
        return;
    }
    // ----------------------------------------------------------------------

    try {
        const clubId = await getClubIdFromUser();

        initializeClubEditor(clubId);

    } catch (error) {
        console.error("Error crítico durante la inicialización:", error.message);

        // 🛑 SEGUNDA COMPROBACIÓN CRÍTICA: Error devuelto por la API (Token inválido o club no asignado)
        if (error.message.includes('Token') || error.message.includes('asignado') || error.message.includes('Unauthorized')) {
            // Usamos la función centralizada para garantizar una sola alerta/redirección.
            manejarFaltaAutenticacion('Mensaje irrelevante, la función lo reemplaza', 'error');
        } else {
            // Manejar otros errores que no son de autenticación.
            if (typeof mostrarAlerta === 'function') {
                mostrarAlerta(`Error al iniciar la edición: ${error.message}`, 'error');
            }
        }
    }
});