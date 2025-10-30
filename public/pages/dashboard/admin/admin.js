/**
 * admin.js
 * Lógica para la navegación y funcionalidades del Panel de Administración.
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Elementos de Navegación y Vistas
    const navItems = document.querySelectorAll('.nav-menu .nav-item');
    const viewPanels = document.querySelectorAll('.view-panel');

    // 2. Función para cambiar de vista
    const changeView = (viewId) => {
        // Desactiva todos los ítems de navegación
        navItems.forEach(item => item.classList.remove('active'));
        
        // Oculta todos los paneles de vista
        viewPanels.forEach(panel => panel.classList.remove('active'));

        // Activa el ítem de navegación y el panel correspondientes
        const activeNav = document.querySelector(`.nav-item[data-view="${viewId}"]`);
        const activePanel = document.getElementById(viewId);

        if (activeNav) {
            activeNav.classList.add('active');
        }

        if (activePanel) {
            activePanel.classList.add('active');
        }
    };

    // 3. Listener para la navegación
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const viewId = item.getAttribute('data-view');
            changeView(viewId);
        });
    });

    // 4. Lógica para botones de acción (ej. llamadas a API)
    const actionButtons = document.querySelectorAll('.action-btn');

    actionButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const action = button.getAttribute('data-action');
            
            // Aquí iría la lógica para interactuar con tu API
            switch(action) {
                case 'view-users':
                    console.log('Navegando a la vista de Usuarios...');
                    // Se podría llamar a changeView('users');
                    break;
                case 'delete-user':
                    // Normalmente requeriría una confirmación o un modal
                    alert('Acción: Eliminar Usuario (pendiente de implementación)');
                    break;
                case 'add-event':
                case 'create-event':
                    console.log('Navegando a la vista de Creación/Añadir Evento...');
                    // Se podría llamar a changeView('events'); y activar un formulario
                    break;
                default:
                    console.log(`Acción desconocida: ${action}`);
            }
        });
    });


    // 5. Función para cargar datos iniciales (Simulación)
    const loadInitialData = async () => {
        try {
            // **Aquí harías tus llamadas a la API**
            // const responseUsers = await fetch('/api/users');
            // const dataUsers = await responseUsers.json();
            
            // SIMULACIÓN de datos
            const totalUsers = 1245;
            const upcomingEvents = 8;

            document.getElementById('total-users').textContent = totalUsers.toLocaleString('es-ES');
            document.getElementById('upcoming-events').textContent = upcomingEvents;

        } catch (error) {
            console.error('Error al cargar datos iniciales:', error);
            document.getElementById('total-users').textContent = 'ERROR';
            document.getElementById('upcoming-events').textContent = 'ERROR';
        }
    };

    // Carga los datos al iniciar
    loadInitialData();

});