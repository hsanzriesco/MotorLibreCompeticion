// pages/clubes/editarUsuario.js

// Asegúrate de que la función global 'mostrarAlerta' esté definida en algún lugar
// (por ejemplo, en un archivo utils.js o main.js que se carga antes).

document.addEventListener("DOMContentLoaded", () => {
    // 1. Cargar datos del usuario
    const storedUser = sessionStorage.getItem("usuario") || localStorage.getItem("usuario");
    const usuario = storedUser ? JSON.parse(storedUser) : null;

    // 2. Elementos del DOM
    const clubNameHeader = document.getElementById('club-name-header');
    const clubPresident = document.getElementById('club-president');
    const clubDescription = document.getElementById('club-description');
    const membersCount = document.getElementById('members-count');
    const tableBody = document.getElementById('club-members-table-body');
    const loadingMessage = document.getElementById('loading-message');
    const btnLeaveClub = document.getElementById('btn-leave-club');
    const presidentNote = document.getElementById('president-note');
    const btnConfirmLeave = document.getElementById('btnConfirmLeave');

    // Inicializar el modal (asumiendo Bootstrap está cargado)
    const leaveClubModalElement = document.getElementById('leaveClubModal');
    let leaveClubModal = null;
    if (leaveClubModalElement && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        leaveClubModal = new bootstrap.Modal(leaveClubModalElement);
    }


    // 3. Verificación inicial del club
    if (!usuario || !usuario.club_id) {
        // Usamos club_id (snake_case) porque es el formato que pusimos en el JWT/sesión.
        mostrarAlerta("No perteneces a ningún club. Por favor, únete a uno primero.", 'error', 3000);
        // Redirigir al usuario si no tiene club
        setTimeout(() => { window.location.href = './clubes.html'; }, 3000);
        return;
    }

    const clubId = usuario.club_id;
    // Usamos el flag 'is_presidente' para determinar el rol.
    const isPresident = usuario.is_presidente === true;

    // ----------------------------------------------------
    // LÓGICA DE CARGA DE DATOS DEL CLUB
    // ----------------------------------------------------
    async function loadClubData() {
        if (loadingMessage) loadingMessage.textContent = 'Cargando miembros...';

        try {
            const token = sessionStorage.getItem("token") || localStorage.getItem("token");

            // URL del API: Asegúrate de que este endpoint sea correcto en tu servidor
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

            // 🛑 VALIDACIÓN CLAVE PARA EL ERROR DE "RESPUESTA INCOMPLETA"
            if (!club || typeof club !== 'object' || !club.name) {
                console.error('Estructura de datos recibida:', data);
                throw new Error("El servidor no devolvió los datos completos del club. Respuesta incompleta o mal formada.");
            }
            // --------------------------------------------------------------------------

            // 1. Mostrar información del club
            if (clubNameHeader) clubNameHeader.textContent = club.name;
            const clubNameModal = document.getElementById('club-name-modal');
            if (clubNameModal) clubNameModal.textContent = club.name; // Para el modal
            if (clubPresident) clubPresident.textContent = club.president_name || 'N/A';
            if (clubDescription) clubDescription.textContent = club.description || 'Sin descripción.';

            // 2. Llenar la tabla de miembros
            if (tableBody) tableBody.innerHTML = ''; // Limpiar mensaje de carga/cuerpo anterior
            if (membersCount) membersCount.textContent = members.length;

            if (members.length === 0) {
                // El mensaje de no hay miembros también en blanco para consistencia
                if (tableBody) tableBody.innerHTML = '<tr><td colspan="3" class="text-center text-white">No hay miembros registrados aún.</td></tr>';
            } else {
                members.forEach(member => {
                    if (tableBody) {
                        const row = tableBody.insertRow();
                        // 🛠️ MODIFICACIÓN: Se añade la clase 'text-white' a los <td> para poner el texto en blanco
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
            // Mostrar error en la tabla y como alerta
            if (tableBody) tableBody.innerHTML = `<tr><td colspan="3" class="text-center text-danger">Error: ${error.message}</td></tr>`;
            mostrarAlerta(`Error al cargar club: ${error.message}`, 'error', 6000);
        } finally {
            if (loadingMessage) loadingMessage.textContent = ''; // Limpiar mensaje de carga al finalizar
        }
    }

    // ----------------------------------------------------
    // LÓGICA DE SALIR DEL CLUB
    // ----------------------------------------------------

    // Mostrar/ocultar elementos de presidente vs. miembro
    if (isPresident) {
        if (btnLeaveClub) btnLeaveClub.style.display = 'none';
        if (presidentNote) presidentNote.style.display = 'block';
    } else {
        if (btnLeaveClub) btnLeaveClub.style.display = 'block';
        if (presidentNote) presidentNote.style.display = 'none';

        // Abrir Modal
        if (btnLeaveClub && leaveClubModal) {
            btnLeaveClub.addEventListener('click', () => {
                leaveClubModal.show();
            });
        }

        // Confirmar Salida
        if (btnConfirmLeave) {
            btnConfirmLeave.addEventListener('click', async () => {
                if (leaveClubModal) leaveClubModal.hide();

                const token = sessionStorage.getItem("token") || localStorage.getItem("token");

                try {
                    // Endpoint genérico para modificar la pertenencia al club (acción 'leave')
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

                    // ACTUALIZACIÓN DE LA SESIÓN TRAS SALIR DEL CLUB
                    if (usuario) {
                        // Eliminar las propiedades relacionadas con el club del objeto de sesión
                        delete usuario.club_id;
                        delete usuario.clubId;
                        delete usuario.is_presidente;

                        // Guardar el objeto de usuario actualizado (sin club)
                        sessionStorage.setItem("usuario", JSON.stringify(usuario));
                        localStorage.removeItem("usuario"); // Se recomienda solo usar sessionStorage para la sesión activa
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