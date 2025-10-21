document.addEventListener('DOMContentLoaded', async () => {
  const usuario = JSON.parse(localStorage.getItem('usuario'));

  // Verifica si el usuario es admin
  if (!usuario || usuario.role !== 'admin') {
    alert('❌ Acceso denegado. Solo administradores pueden entrar aquí.');
    window.location.href = '/index.html';
    return;
  }

  document.getElementById('userInfo').textContent = `👋 Bienvenido, ${usuario.name} (Administrador)`;

  // Cargar eventos existentes
  let eventos = await fetch('/api/events').then(res => res.json()).catch(() => []);
  eventos = eventos.success ? eventos.data : [];

  // Inicializa FullCalendar
  const calendarEl = document.getElementById('calendar');
  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    selectable: true,
    editable: true,
    events: eventos,

    // Crear evento
    select: async (info) => {
      const titulo = prompt('Nombre del evento:');
      if (titulo) {
        const nuevoEvento = {
          title: titulo,
          start: info.startStr,
          end: info.endStr,
        };
        const res = await fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(nuevoEvento),
        });
        const result = await res.json();
        if (result.success) {
          calendar.addEvent(nuevoEvento);
          alert('✅ Evento creado correctamente.');
        } else {
          alert('❌ Error al crear evento.');
        }
      }
    },

    // Editar evento
    eventChange: async (info) => {
      const evento = info.event;
      const res = await fetch(`/api/events/${evento.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: evento.title,
          start: evento.startStr,
          end: evento.endStr,
        }),
      });
      const result = await res.json();
      if (!result.success) {
        alert('❌ Error al actualizar evento.');
      }
    },

    // Eliminar evento
    eventClick: async (info) => {
      if (confirm(`¿Eliminar evento "${info.event.title}"?`)) {
        const res = await fetch(`/api/events/${info.event.id}`, { method: 'DELETE' });
        const result = await res.json();
        if (result.success) {
          info.event.remove();
          alert('🗑️ Evento eliminado.');
        } else {
          alert('❌ Error al eliminar evento.');
        }
      }
    },
  });

  calendar.render();
});
