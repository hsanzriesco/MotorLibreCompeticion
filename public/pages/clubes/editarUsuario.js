document.addEventListener("DOMContentLoaded", () => {
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

    const leaveClubModalElement = document.getElementById('leaveClubModal');
    let leaveClubModal = null;
    if (leaveClubModalElement && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        leaveClubModal = new bootstrap.Modal(leaveClubModalElement);
    }


    if (!usuario || !usuario.club_id) {
        mostrarAlerta("No perteneces a ningún club. Por favor, únete a uno primero.", 'error', 3000);
        setTimeout(() => { window.location.href = './clubes.html'; }, 3000);
        return;
    }

    const clubId = usuario.club_id;
    const isPresident = usuario.is_presidente === true;

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
                throw new Error(errorData.message || 'Error al cargar los datos del club. Código de estado: ' + response.status);
            }

            const data = await response.json();
            const club = data.club;
            const members = data.members || [];

            if (!club || typeof club !== 'object' || !club.name) {
                console.error('Estructura de datos recibida:', data);
                throw new Error("El servidor no devolvió los datos completos del club. Respuesta incompleta o mal formada.");
            }

            if (clubNameHeader) clubNameHeader.textContent = club.name;
            const clubNameModal = document.getElementById('club-name-modal');
            if (clubNameModal) clubNameModal.textContent = club.name;
            if (clubPresident) clubPresident.textContent = club.president_name || 'N/A';
            if (clubDescription) clubDescription.textContent = club.description || 'Sin descripción.';

            if (tableBody) tableBody.innerHTML = '';
            if (membersCount) membersCount.textContent = members.length;

            if (members.length === 0) {
                if (tableBody) tableBody.innerHTML = '<tr><td colspan="3" class="text-center text-white">No hay miembros registrados aún.</td></tr>';
            } else {
                members.forEach(member => {
                    if (tableBody) {
                        const row = tableBody.insertRow();
                        row.innerHTML = `
                            <td class="text-white">${member.username || 'Desconocido'}</td>
                            <td class="text-white">${member.email || 'N/A'}</td>
                            <td class="text-white">
                                ${member.user_id === club.president_id ? '<span class="badge bg-danger">Presidente</span>' : 'Miembro'}
                            </td>
                        `;
                    }
                });
            }

        } catch (error) {
            console.error('Error al cargar datos del club:', error);
            if (tableBody) tableBody.innerHTML = `<tr><td colspan="3" class="text-center text-danger">Error: ${error.message}</td></tr>`;
            mostrarAlerta(`Error al cargar club: ${error.message}`, 'error', 6000);
        } finally {
            if (loadingMessage) loadingMessage.textContent = '';
        }
    }

    if (isPresident) {
        if (btnLeaveClub) btnLeaveClub.style.display = 'none';
        if (presidentNote) presidentNote.style.display = 'block';
    } else {
        if (btnLeaveClub) btnLeaveClub.style.display = 'block';
        if (presidentNote) presidentNote.style.display = 'none';

        if (btnLeaveClub && leaveClubModal) {
            btnLeaveClub.addEventListener('click', () => {
                leaveClubModal.show();
            });
        }

        if (btnConfirmLeave) {
            btnConfirmLeave.addEventListener('click', async () => {
                if (leaveClubModal) leaveClubModal.hide();

                const token = sessionStorage.getItem("token") || localStorage.getItem("token");

                try {
                    const response = await fetch(`/api/clubs`, {
                        method: 'PUT',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ action: 'leave' })
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.message || 'Error al salir del club.');
                    }

                    const result = await response.json();

                    if (usuario) {
                        delete usuario.club_id;
                        delete usuario.clubId;
                        delete usuario.is_presidente;

                        sessionStorage.setItem("usuario", JSON.stringify(usuario));
                        localStorage.removeItem("usuario");
                    }
                    sessionStorage.removeItem("clubId");

                    mostrarAlerta(result.message || "Has salido del club correctamente.", 'exito', 2000);

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

    loadClubData();
});
