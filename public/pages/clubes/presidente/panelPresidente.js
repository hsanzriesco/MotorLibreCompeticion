// pages/clubes/panelPresidente.js

document.addEventListener('DOMContentLoaded', () => {

    // -----------------------------------------
    // 1. VERIFICAR AUTENTICACIÓN Y ROL
    // -----------------------------------------
    const storedUser = sessionStorage.getItem("usuario") || localStorage.getItem("usuario");
    const usuario = storedUser ? JSON.parse(storedUser) : null;
    const clubNombreEl = document.getElementById('club-nombre');

    if (!usuario) {
        mostrarAlerta("Debes iniciar sesión para acceder a este panel.", "error");
        setTimeout(() => window.location.href = '../auth/login/login.html', 1500);
        return;
    }

    // -----------------------------------------
    // 2. OBTENER CLUB ID DE LA URL
    // -----------------------------------------
    const urlParams = new URLSearchParams(window.location.search);
    const clubId = urlParams.get('clubId');

    if (!clubId) {
        mostrarAlerta("ID de club no proporcionado.", "error");
        clubNombreEl.textContent = "Error: Club no encontrado";
        return;
    }

    // -----------------------------------------
    // 3. CARGAR DATOS DEL CLUB Y MIEMBROS
    // -----------------------------------------
    async function cargarDatosClub() {
        try {
            // ⭐ Reemplaza esta URL con tu endpoint para obtener un club por ID ⭐
            const clubRes = await fetch(`/api/clubs/${clubId}`);
            const clubData = await clubRes.json();

            if (!clubData.success || clubData.data.id_presidente !== usuario.id) {
                mostrarAlerta("Acceso denegado o club no encontrado.", "error");
                clubNombreEl.textContent = "Acceso Restringido";
                return;
            }

            const club = clubData.data;

            // Mostrar el nombre del club
            if (clubNombreEl) clubNombreEl.textContent = `Gestión de: ${club.nombre_evento}`;
            
            // ⭐ Verificar que el usuario sea realmente el presidente (Doble chequeo) ⭐
            if (club.id_presidente !== usuario.id) {
                 mostrarAlerta("No eres el presidente de este club.", "error");
                 setTimeout(() => window.location.href = './clubes.html', 1500);
                 return;
            }
            
            // Cargar la lista de miembros
            cargarMiembros(clubId);
            
            // Inicializar otras funciones de gestión (eventos, edición, etc.) aquí
            
        } catch (error) {
            console.error("Error al cargar datos del club:", error);
            mostrarAlerta("Error de conexión al cargar el panel.", "error");
            clubNombreEl.textContent = "Error de Servidor";
        }
    }

    // -----------------------------------------
    // 4. FUNCIÓN PARA CARGAR MIEMBROS
    // -----------------------------------------
    async function cargarMiembros(clubId) {
        const miembrosListaEl = document.getElementById('miembros-lista');
        if (!miembrosListaEl) return;
        miembrosListaEl.innerHTML = '<p class="text-info">Cargando lista de miembros...</p>';
        
        try {
            // ⭐ Reemplaza esta URL con tu endpoint para obtener los miembros del club ⭐
            const miembrosRes = await fetch(`/api/clubs/${clubId}/members`);
            const miembrosData = await miembrosRes.json();
            
            if (!miembrosData.success) {
                 miembrosListaEl.innerHTML = '<p class="text-warning">Error al cargar la lista de miembros.</p>';
                 return;
            }
            
            const miembros = miembrosData.data;
            
            if (miembros.length === 0) {
                 miembrosListaEl.innerHTML = '<p class="text-secondary">Este club aún no tiene miembros (¡aparte de ti!).</p>';
                 return;
            }
            
            // Renderizar la tabla de miembros
            let html = `<table class="table table-dark table-striped table-hover">
                            <thead>
                                <tr>
                                    <th>Piloto</th>
                                    <th>Fecha de Unión</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>`;
            
            miembros.forEach(miembro => {
                const esElPresidente = miembro.id === usuario.id;
                
                html += `<tr>
                            <td>${miembro.nombre_usuario} ${esElPresidente ? '(Tú - Presidente)' : ''}</td>
                            <td>${miembro.fecha_union || 'N/A'}</td>
                            <td>
                                ${esElPresidente 
                                    ? '<span class="badge bg-danger">NO EXPULSABLE</span>' 
                                    : `<button class="btn btn-sm btn-outline-danger expulsar-btn" data-miembro-id="${miembro.id}">
                                            Expulsar
                                       </button>`
                                }
                            </td>
                        </tr>`;
            });

            html += `</tbody></table>`;
            miembrosListaEl.innerHTML = html;
            
            // Asignar listeners a los botones de expulsar
            document.querySelectorAll('.expulsar-btn').forEach(btn => {
                btn.addEventListener('click', manejarExpulsion);
            });

        } catch (error) {
            console.error("Error al cargar miembros:", error);
            miembrosListaEl.innerHTML = '<p class="text-danger">Error de servidor al cargar miembros.</p>';
        }
    }
    
    // -----------------------------------------
    // 5. FUNCIÓN PARA EXPULSAR MIEMBRO
    // -----------------------------------------
    async function manejarExpulsion(e) {
        const miembroId = e.currentTarget.dataset.miembroId;
        
        if (!confirm(`¿Estás seguro de expulsar a este miembro (ID: ${miembroId}) del club?`)) {
            return;
        }
        
        try {
            // ⭐ Reemplaza esta URL con tu endpoint para expulsar un miembro ⭐
            const res = await fetch(`/api/clubs/${clubId}/members/${miembroId}`, {
                method: 'DELETE'
            });

            const r = await res.json();

            if (!r.success) {
                mostrarAlerta(r.message || "Error al expulsar al miembro.", "error");
                return;
            }

            mostrarAlerta("Miembro expulsado correctamente.", "exito");
            cargarMiembros(clubId); // Recargar la lista

        } catch (error) {
            console.error("Error expulsando miembro:", error);
            mostrarAlerta("Error de conexión al expulsar.", "error");
        }
    }


    // Iniciar la carga
    cargarDatosClub();
});