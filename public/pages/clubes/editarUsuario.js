// pages/clubes/editarUsuario.js

document.addEventListener("DOMContentLoaded", () => {
    // Es mejor leer el clubId directamente del objeto 'usuario' que viene del JWT actualizado.
    const storedUser = sessionStorage.getItem("usuario") || localStorage.getItem("usuario");
    const usuario = storedUser ? JSON.parse(storedUser) : null;

    // Elementos del DOM
    const clubNameHeader = document.getElementById('club-name-header');
    const clubPresident = document.getElementById('club-president');
    const clubDescription = document.getElementById('club-description');
    const membersCount = document.getElementById('members-count');
    const tableBody = document.getElementById('club-members-table-body');
    const loadingMessage = document.getElementById('loading-message');
    const btnLeaveClub = document.getElementById('btn-leave-club');
    const presidentNote = document.getElementById('president-note');
    const btnConfirmLeave = document.getElementById('btnConfirmLeave');
    
    // Inicializar el modal
    const leaveClubModal = new bootstrap.Modal(document.getElementById('leaveClubModal'));

    if (!usuario || !usuario.club_id) {
        // Usamos club_id (snake_case) porque es el formato que pusimos en el JWT/sesión.
        mostrarAlerta("No perteneces a ningún club. Por favor, únete a uno primero.", 'error', 3000);
        // Redirigir al usuario si no tiene club
        setTimeout(() => { window.location.href = './clubes.html'; }, 3000);
        return;
    }

    // Usamos el ID del club directamente del objeto usuario
    const clubId = usuario.club_id; 
    
    // 🛑 CORRECCIÓN DE LÓGICA DE PRESIDENTE: usar el flag 'is_presidente' 🛑
    const isPresident = usuario.is_presidente === true; 

    // ----------------------------------------------------
    // LÓGICA DE CARGA DE DATOS
    // ----------------------------------------------------
    async function loadClubData() {
        if (loadingMessage) loadingMessage.textContent = 'Cargando miembros...';
        
        try {
            const token = sessionStorage.getItem("token") || localStorage.getItem("token");

            // Notar que el parámetro en el cliente es 'clubId' o 'id', revisa tu API si es uno u otro.
            // Asumo que tu API de clubs.js espera 'clubId' para la búsqueda, o 'id' si estás usando la URL de navegación.
            const response = await fetch(`/api/clubs?clubId=${clubId}&includeMembers=true`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Error al cargar los datos del club.');
            }

            const data = await response.json();
            const club = data.club;
            const members = data.members || [];
            
            // 🛑 CORRECCIÓN DEL ERROR: Comprobación de existencia del objeto 'club' 🛑
            if (!club || typeof club !== 'object' || !club.name) {
                throw new Error("El servidor no devolvió los datos completos del club. Respuesta incompleta.");
            }
            // --------------------------------------------------------------------------

            // 1. Mostrar información del club
            clubNameHeader.textContent = club.name;
            document.getElementById('club-name-modal').textContent = club.name; // Para el modal
            clubPresident.textContent = club.president_name || 'N/A';
            clubDescription.textContent = club.description || 'Sin descripción.';

            // 2. Llenar la tabla de miembros
            tableBody.innerHTML = ''; // Limpiar mensaje de carga
            membersCount.textContent = members.length;

            if (members.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="3" class="text-center">No hay miembros registrados aún.</td></tr>';
            } else {
                members.forEach(member => {
                    const row = tableBody.insertRow();
                    row.innerHTML = `
                        <td>${member.username}</td>
                        <td>${member.email}</td>
                        <td>
                            ${member.user_id === club.president_id ? '<span class="badge bg-danger">Presidente</span>' : 'Miembro'}
                        </td>
                    `;
                });
            }

        } catch (error) {
            // Este catch maneja el error 'Cannot read properties of undefined (reading 'name')'
            // ahora que se ha envuelto con un throw Error más informativo.
            console.error('Error al cargar datos del club:', error);
            if (tableBody) tableBody.innerHTML = `<tr><td colspan="3" class="text-center text-danger">${error.message}</td></tr>`;
            mostrarAlerta(error.message, 'error', 4000);
        }
    }

    // ----------------------------------------------------
    // LÓGICA DE SALIR DEL CLUB
    // ----------------------------------------------------

    // Mostrar/ocultar botón de salir
    if (isPresident) {
        if (btnLeaveClub) btnLeaveClub.style.display = 'none';
        if (presidentNote) presidentNote.style.display = 'block';
    } else {
        if (btnLeaveClub) btnLeaveClub.style.display = 'block';
        if (presidentNote) presidentNote.style.display = 'none';
        
        // Abrir Modal
        if (btnLeaveClub) {
            btnLeaveClub.addEventListener('click', () => {
                leaveClubModal.show();
            });
        }
        
        // Confirmar Salida
        if (btnConfirmLeave) {
            btnConfirmLeave.addEventListener('click', async () => {
                leaveClubModal.hide();
                
                const token = sessionStorage.getItem("token") || localStorage.getItem("token");
                
                try {
                    const response = await fetch(`/api/clubs`, {
                        method: 'PUT',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ action: 'leave' }) // Usar la acción 'leave' en el API
                    });
                    
                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.message || 'Error al salir del club.');
                    }
                    
                    // Éxito
                    const result = await response.json();
                    
                    // 🛑 ACTUALIZACIÓN DE LA SESIÓN: usar club_id (snake_case) 🛑
                    if (usuario) {
                        // El JWT actualizado ya debería estar en la respuesta (result.token), pero si no lo está:
                        delete usuario.club_id; 
                        delete usuario.clubId; // Por si acaso
                        delete usuario.is_presidente; // Eliminar el flag de presidente
                        sessionStorage.setItem("usuario", JSON.stringify(usuario));
                        localStorage.removeItem("usuario"); 
                    }
                    sessionStorage.removeItem("clubId"); // Eliminar variable redundante
                    
                    mostrarAlerta(result.message || "Has salido del club correctamente.", 'exito', 2000);
                    
                    // Redirigir a la página de clubes
                    setTimeout(() => {
                        window.location.href = './clubes.html';
                    }, 2000);
                    
                } catch (error) {
                    console.error('Error al intentar salir del club:', error);
                    mostrarAlerta(error.message, 'error', 4000);
                }
            });
        }
    }

    // ----------------------------------------------------
    // INICIO DE LA PÁGINA
    // ----------------------------------------------------
    loadClubData();
});