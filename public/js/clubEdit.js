document.addEventListener("DOMContentLoaded", async () => { // Hacemos la función principal async

    // --- ELEMENTOS CLAVE ---
    const form = document.getElementById("club-edit-form");
    const submitButton = form ? form.querySelector('button[type="submit"]') : null;
    const clubIdInput = document.getElementById("club-id");
    const currentImageElement = document.getElementById("current-image");

    // 1. Obtener Token y Club ID del almacenamiento local/sesión
    const token = sessionStorage.getItem('jwtToken') || sessionStorage.getItem('token');
    let myClubId = sessionStorage.getItem('clubId');

    // --- VERIFICACIÓN INICIAL DE SESIÓN Y CLUB ---
    if (!token) {
        alert("Debes iniciar sesión para editar tu club.");
        window.location.href = '/login.html';
        return;
    }

    // ----------------------------------------------------------------------------------
    // A. FUNCIÓN DE RESPALDO: Obtener Club ID del usuario si falta en sessionStorage
    // ----------------------------------------------------------------------------------
    async function getClubIdFromUser(authToken) {
        try {
            // Suponemos que este endpoint devuelve el perfil del usuario, incluyendo el clubId.
            const res = await fetch('/api/users/me', {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${authToken}` }
            });

            if (!res.ok) {
                // Si la API no devuelve el usuario o el token es inválido, puede fallar aquí.
                throw new Error("No se pudo obtener el perfil de usuario. Token inválido o expirado.");
            }

            const userData = await res.json();

            // Asume que la respuesta es { success: true, user: { clubId: 123, ... } }
            const foundClubId = userData.user && userData.user.clubId;

            if (foundClubId && !isNaN(parseInt(foundClubId))) {
                sessionStorage.setItem('clubId', foundClubId); // Guardar para futuro uso
                return foundClubId;
            } else {
                return null; // El usuario no tiene un club asociado
            }

        } catch (error) {
            console.error("Fallo al obtener el ID de club del usuario:", error);
            return null;
        }
    }

    // 2. Intentar recuperar myClubId si es necesario
    if (!myClubId || isNaN(parseInt(myClubId))) {
        // Si el clubId no está en sessionStorage, intentamos obtenerlo de la API
        myClubId = await getClubIdFromUser(token);
    }

    // 3. Verificación final después del intento de recuperación
    if (!myClubId || isNaN(parseInt(myClubId))) {
        alert("Error: No se encontró un ID de club asociado a tu cuenta. Contacta al soporte.");
        window.location.href = '/dashboard.html';
        return;
    }

    // Establecer el ID en el campo oculto del formulario
    if (clubIdInput) {
        clubIdInput.value = myClubId;
    } else {
        console.warn("Elemento #club-id no encontrado. El formulario podría fallar en el envío.");
    }

    // ----------------------------------------------------------------------------------
    // B. FUNCIÓN PARA CARGAR DATOS ACTUALES DEL CLUB (GET)
    // ----------------------------------------------------------------------------------
    async function loadClubData() {
        if (submitButton) submitButton.disabled = true; // Deshabilitar durante la carga

        try {
            const res = await fetch(`/api/clubs?id=${myClubId}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.message || "No se pudo cargar la información del club.");
            }

            const data = await res.json();

            if (data.success && data.club) {
                // Rellenar formulario con optional chaining (?. ) para más seguridad
                document.getElementById("nombre_evento").value = data.club?.nombre_evento || '';
                document.getElementById("descripcion").value = data.club?.descripcion || '';

                // Mostrar imagen actual
                if (currentImageElement && data.club?.imagen_club) {
                    currentImageElement.src = data.club.imagen_club;
                    currentImageElement.style.display = 'block';
                } else if (currentImageElement) {
                    currentImageElement.style.display = 'none';
                }
            } else {
                alert("El club no existe, no está activo, o la respuesta fue incompleta.");
                window.location.href = '/dashboard.html';
            }
        } catch (error) {
            console.error("Error al cargar datos del club:", error);
            alert(`Fallo en la carga: ${error.message}`);
        } finally {
            if (submitButton) submitButton.disabled = false; // Re-habilitar después de la carga
        }
    }

    // ----------------------------------------------------------------------------------
    // C. FUNCIÓN PARA MANEJAR EL ENVÍO DEL FORMULARIO (PUT)
    // ----------------------------------------------------------------------------------
    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();

            if (submitButton) submitButton.disabled = true; // Deshabilitar el botón durante el envío

            const formData = new FormData(form);

            // Opcional: Si no se seleccionó un nuevo archivo, elimina el campo de imagen del FormData
            const imageFile = document.getElementById("imagen_club").files[0];
            if (!imageFile) {
                formData.delete('imagen_club');
            }

            try {
                // Llamada a PUT /api/clubs?id=[mi_club_id]
                const res = await fetch(`/api/clubs?id=${myClubId}`, {
                    method: "PUT",
                    // Solo enviamos el Token. fetch añade automáticamente el Content-Type para FormData.
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });

                if (!res.ok) {
                    const errorData = await res.json();

                    if (res.status === 403) {
                        throw new Error("Acceso Denegado: No tienes permisos para editar este club.");
                    }
                    if (res.status === 400) {
                        throw new Error(`Error de validación: ${errorData.message}`);
                    }
                    throw new Error(errorData.message || "Error desconocido al actualizar.");
                }

                const data = await res.json();
                alert(`✅ ${data.message}`);

                // Recargar los datos para mostrar la nueva imagen o cambios
                await loadClubData();

            } catch (error) {
                console.error("Fallo de edición:", error);
                alert(`❌ Fallo en la actualización: ${error.message}`);
            } finally {
                if (submitButton) submitButton.disabled = false; // Re-habilitar el botón
            }
        });
    }


    // Iniciar la carga de datos al cargar la página
    await loadClubData();
});