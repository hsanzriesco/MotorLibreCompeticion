document.addEventListener("DOMContentLoaded", () => {
    // 1. Obtener Token y Club ID del almacenamiento local/sesión
    const token = sessionStorage.getItem('jwtToken') || sessionStorage.getItem('token');
    const myClubId = sessionStorage.getItem('clubId');
    
    const form = document.getElementById("club-edit-form");
    const clubIdInput = document.getElementById("club-id");
    const currentImageElement = document.getElementById("current-image");
    
    // --- VERIFICACIÓN INICIAL DE SESIÓN Y CLUB ---
    if (!token) {
        alert("Debes iniciar sesión para editar tu club.");
        // Redirigir al login si no hay token
        // window.location.href = '/login.html'; 
        return;
    }

    if (!myClubId || isNaN(parseInt(myClubId))) {
        // Esto puede pasar si el clubId no fue almacenado durante el login/aprobación.
        // Se puede añadir aquí una llamada a /api/users para obtener el clubId si es necesario.
        alert("Error: No se encontró un ID de club asociado a tu cuenta.");
        // window.location.href = '/dashboard.html';
        return;
    }
    
    clubIdInput.value = myClubId; // Establecer el ID en el campo oculto del formulario

    // ----------------------------------------------------------------------------------
    // A. FUNCIÓN PARA CARGAR DATOS ACTUALES DEL CLUB (GET)
    // ----------------------------------------------------------------------------------
    async function loadClubData() {
        try {
            // Llamada a GET /api/clubs?id=[mi_club_id]
            const res = await fetch(`/api/clubs?id=${myClubId}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) {
                 // El 404/401 se maneja aquí.
                const errorData = await res.json();
                throw new Error(errorData.message || "No se pudo cargar la información del club.");
            }
            
            const data = await res.json();
            
            if (data.success && data.club) {
                // Rellenar formulario
                document.getElementById("nombre_evento").value = data.club.nombre_evento || '';
                document.getElementById("descripcion").value = data.club.descripcion || '';
                
                // Mostrar imagen actual
                if (currentImageElement && data.club.imagen_club) {
                    currentImageElement.src = data.club.imagen_club;
                } else if (currentImageElement) {
                     // Ocultar imagen si no hay URL
                    currentImageElement.style.display = 'none';
                }
            } else {
                alert("El club no existe o no está activo.");
                // window.location.href = '/dashboard.html';
            }
        } catch (error) {
            console.error("Error al cargar datos del club:", error);
            alert(`Fallo en la carga: ${error.message}`);
        }
    }
    
    // ----------------------------------------------------------------------------------
    // B. FUNCIÓN PARA MANEJAR EL ENVÍO DEL FORMULARIO (PUT)
    // ----------------------------------------------------------------------------------
    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        // Creamos FormData que incluye campos de texto y el archivo
        const formData = new FormData(form);

        // Opcional: Si no se seleccionó un nuevo archivo, elimina el campo de imagen del FormData
        const imageFile = document.getElementById("imagen_club").files[0];
        if (!imageFile) {
             // Esto evita enviar un campo 'imagen_club' vacío en FormData, forzando la API a no buscar el archivo.
             // Aunque la API maneja campos nulos, es una buena práctica.
             formData.delete('imagen_club'); 
        }

        try {
            // Llamada a PUT /api/clubs?id=[mi_club_id]
            const res = await fetch(`/api/clubs?id=${myClubId}`, {
                method: "PUT",
                headers: { 'Authorization': `Bearer ${token}` }, // Envía el Token del Presidente
                body: formData // FormData gestiona el Content-Type: multipart/form-data
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
            loadClubData(); 

        } catch (error) {
            console.error("Fallo de edición:", error);
            alert(`❌ Fallo en la actualización: ${error.message}`);
        }
    });

    // Iniciar la carga de datos al cargar la página
    loadClubData();
});