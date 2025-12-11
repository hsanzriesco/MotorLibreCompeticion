// pages/clubes/editar.js

document.addEventListener("DOMContentLoaded", () => {
    const clubIdInSession = sessionStorage.getItem("clubId");
    const storedUser = sessionStorage.getItem("usuario") || localStorage.getItem("usuario");
    const usuario = storedUser ? JSON.parse(storedUser) : null;

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

    if (!usuario || (!usuario.clubId && !clubIdInSession)) {
        mostrarAlerta("No perteneces a ningún club. Por favor, únete a uno primero.", 'error', 3000);
        // Redirigir al usuario si no tiene club
        setTimeout(() => { window.location.href = './clubes.html'; }, 3000);
        return;
    }

    const clubId = usuario.clubId || clubIdInSession;
    const isPresident = usuario.clubId === clubId; // Asume que si clubId coincide con el clubId del club, es el presidente

    // ----------------------------------------------------
    // LÓGICA DE CARGA DE DATOS
    // ----------------------------------------------------
    async function loadClubData() {
        if (loadingMessage) loadingMessage.textContent = 'Cargando miembros...';
        
        try {
            const token = sessionStorage.getItem("token") || localStorage.getItem("token");

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
            console.error('Error al cargar datos del club:', error);
            tableBody.innerHTML = `<tr><td colspan="3" class="text-center text-danger">${error.message}</td></tr>`;
            mostrarAlerta(error.message, 'error', 4000);
        }
    }

    // ----------------------------------------------------
    // LÓGICA DE SALIR DEL CLUB
    // ----------------------------------------------------

    // Mostrar/ocultar botón de salir
    if (isPresident) {
        btnLeaveClub.style.display = 'none';
        presidentNote.style.display = 'block';
    } else {
        btnLeaveClub.style.display = 'block';
        presidentNote.style.display = 'none';
        
        // Abrir Modal
        btnLeaveClub.addEventListener('click', () => {
            leaveClubModal.show();
        });
        
        // Confirmar Salida
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
                
                // Actualizar la sesión del usuario para reflejar que ya no tiene club
                if (usuario) {
                    delete usuario.clubId;
                    delete usuario.club_id;
                    sessionStorage.setItem("usuario", JSON.stringify(usuario));
                    localStorage.removeItem("usuario"); // Asumiendo que el clubId no se guarda en local
                }
                sessionStorage.removeItem("clubId");
                
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

    // ----------------------------------------------------
    // INICIO DE LA PÁGINA
    // ----------------------------------------------------
    loadClubData();
});