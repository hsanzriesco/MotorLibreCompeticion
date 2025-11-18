/* perfil.js - compacto (usa API en Vercel)
   Endpoints (asumidos):
   GET    /api/carGarage?user_id=ID
   POST   /api/carGarage        (body JSON)
   PUT    /api/carGarage        (body JSON)
   DELETE /api/carGarage        (body JSON { id })
   PUT    /api/usersList        (body JSON para actualizar user / password)
*/
(() => {
    const API = 'https://motor-libre-competicion.vercel.app/api/carGarage';
    const USERS_API = '/api/usersList'; // tu endpoint de usuarios (server.js ya enrutó usersList)
    const $ = id => document.getElementById(id);

    // elementos
    const carList = $('car-list'), noCarsMessage = $('no-cars-message');
    const carForm = $('car-form'), deleteCarBtn = $('delete-car-btn'), openAddCarBtn = $('open-add-car-btn');
    const profileForm = $('profile-form'), passwordForm = $('password-form');
    const userNameElement = $('user-name'), loginIcon = $('login-icon'), logoutBtn = $('logout-btn');

    // estado
    let currentCarId = null;
    const stored = sessionStorage.getItem('usuario');
    if (!stored) { mostrarAlerta('Sesión expirada. Inicia sesión.', 'error'); setTimeout(() => location.href = '../auth/login/login.html', 1200); return; }
    const user = JSON.parse(stored);
    userNameElement.textContent = user.name || 'Usuario'; if (loginIcon) loginIcon.style.display = 'none';
    $('user-id').value = user.id || ''; $('profile-name').value = user.name || ''; $('profile-email').value = user.email || '';

    // util
    const h = s => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const request = async (url, opts = {}) => {
        try {
            const res = await fetch(url, opts);
            const ct = res.headers.get('content-type') || '';
            const body = ct.includes('application/json') ? await res.json() : null;
            if (!res.ok) throw { status: res.status, body };
            return body;
        } catch (err) { throw err; }
    };

    /* ---------- CARGAR COCHES ---------- */
    async function loadCars() {
        try {
            const data = await request(`${API}?user_id=${encodeURIComponent(user.id)}`);
            carList.innerHTML = '';
            const cars = (data && data.cars) ? data.cars : (Array.isArray(data) ? data : []);
            if (!cars.length) { noCarsMessage.style.display = 'block'; return; }
            noCarsMessage.style.display = 'none';
            cars.forEach(car => carList.insertAdjacentHTML('beforeend', renderCar(car)));
            // attach click
            carList.querySelectorAll('.car-item').forEach(el => el.addEventListener('click', () => {
                const id = el.closest('[data-car-id]').dataset.carId;
                const car = cars.find(c => String(c.id) === String(id));
                openCarModal(car);
                new bootstrap.Modal($('carModal')).show();
            }));
        } catch (e) {
            console.error(e);
            mostrarAlerta('No se pudieron cargar los coches.', 'error');
            carList.innerHTML = ''; noCarsMessage.style.display = 'block';
        }
    }

    function renderCar(car) {
        const img = h(car.photo_url) || 'https://via.placeholder.com/300x150?text=Sin+Foto';
        return `<div class="col-12 col-md-6" data-car-id="${h(car.id)}">
      <div class="car-item d-flex gap-2 align-items-center p-2" style="cursor:pointer">
        <div style="width:90px"><img src="${img}" alt="${h(car.car_name)}" style="width:100%;border-radius:6px"></div>
        <div>
          <h6 class="mb-1" style="color:#e50914">${h(car.car_name)}</h6>
          <p class="mb-0 text-muted">${h(car.model || 'Modelo N/A')} (${h(car.year || 'Año N/A')})</p>
        </div>
      </div></div>`;
    }

    /* ---------- MODAL AÑADIR/EDITAR ---------- */
    function openCarModal(car) {
        carForm.reset(); currentCarId = null;
        if (car) {
            $('carModalTitle').textContent = 'Editar coche';
            $('car-id').value = car.id; $('car-name').value = car.car_name || '';
            $('car-model').value = car.model || ''; $('car-year').value = car.year || '';
            $('car-photo').value = car.photo_url || ''; currentCarId = car.id; deleteCarBtn.style.display = 'inline-block';
        } else {
            $('carModalTitle').textContent = 'Añadir coche'; deleteCarBtn.style.display = 'none';
        }
    }
    openAddCarBtn.addEventListener('click', () => openCarModal(null));

    /* ---------- GUARDAR (POST/PUT) ---------- */
    carForm.addEventListener('submit', async e => {
        e.preventDefault();
        const payload = {
            id: currentCarId || null,
            user_id: user.id,
            car_name: $('car-name').value.trim(),
            model: $('car-model').value.trim(),
            year: $('car-year').value.trim() || null,
            photo_url: $('car-photo').value.trim() || null
        };
        if (!payload.car_name) { mostrarAlerta('Nombre del coche obligatorio', 'advertencia'); return; }
        try {
            if (currentCarId) {
                await request(API, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                mostrarAlerta('Coche actualizado', 'exito');
            } else {
                await request(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                mostrarAlerta('Coche añadido', 'exito');
            }
            await loadCars();
            const modal = bootstrap.Modal.getInstance($('carModal')); if (modal) modal.hide();
        } catch (err) {
            console.error(err); mostrarAlerta('Error guardando coche', 'error');
        }
    });

    /* ---------- CONFIRMACIÓN SIMPLE (inyectada) ---------- */
    function mostrarConfirmacion(mensaje = '¿Confirmar?') {
        return new Promise(resolve => {
            if ($('mlc-confirm-overlay')) return resolve(false);
            const overlay = document.createElement('div');
            overlay.id = 'mlc-confirm-overlay';
            overlay.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:20000;background:rgba(0,0,0,0.6)';
            const box = document.createElement('div');
            box.style.cssText = 'background:#0b0b0b;border:1px solid rgba(229,9,20,0.35);padding:18px;border-radius:10px;width:92%;max-width:420px;text-align:center;color:#fff';
            box.innerHTML = `<p style="margin:0 0 14px">${mensaje}</p>
        <div style="display:flex;gap:10px;justify-content:center">
          <button id="mlc-cancel" class="btn">Cancelar</button>
          <button id="mlc-yes" class="btn" style="background:#e50914;border-color:rgba(229,9,20,0.9);color:#fff">Eliminar</button>
        </div>`;
            overlay.appendChild(box); document.body.appendChild(overlay);
            $('mlc-yes').focus();
            const cleanup = (res) => {
                overlay.remove(); resolve(res);
            };
            $('mlc-cancel').addEventListener('click', () => cleanup(false), { once: true });
            $('mlc-yes').addEventListener('click', () => cleanup(true), { once: true });
            document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { cleanup(false); document.removeEventListener('keydown', esc); } });
        });
    }

    /* ---------- ELIMINAR ---------- */
    deleteCarBtn.addEventListener('click', async () => {
        if (!currentCarId) return;
        const ok = await mostrarConfirmacion('¿Seguro que quieres eliminar este coche?');
        if (!ok) { mostrarAlerta('Eliminación cancelada', 'info'); return; }
        try {
            await request('/api/carGarage', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: currentCarId }) });
            mostrarAlerta('Coche eliminado', 'exito');
            await loadCars();
            const modal = bootstrap.Modal.getInstance($('carModal')); if (modal) modal.hide();
        } catch (err) { console.error(err); mostrarAlerta('Error eliminando coche', 'error'); }
    });

    /* ---------- PERFIL: guardar nombre/email ---------- */
    profileForm.addEventListener('submit', async e => {
        e.preventDefault();
        const newName = $('profile-name').value.trim(), newEmail = $('profile-email').value.trim();
        if (newName === (user.name || '') && newEmail === (user.email || '')) { mostrarAlerta('No hay cambios', 'info'); return; }
        const payload = { id: user.id, name: newName, email: newEmail };
        try {
            const res = await request(USERS_API, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            // si backend confirma, actualizar sesión; si no, fallback local
            user.name = newName; user.email = newEmail; sessionStorage.setItem('usuario', JSON.stringify(user)); userNameElement.textContent = newName;
            mostrarAlerta('Datos actualizados correctamente', 'exito');
        } catch (err) {
            console.error(err); user.name = newName; user.email = newEmail; sessionStorage.setItem('usuario', JSON.stringify(user)); userNameElement.textContent = newName;
            mostrarAlerta('Actualizado localmente. Error servidor.', 'info');
        }
    });

    /* ---------- CAMBIO DE CONTRASEÑA ---------- */
    document.getElementById('passwordModal').addEventListener('show.bs.modal', () => passwordForm.reset());
    passwordForm.addEventListener('submit', async e => {
        e.preventDefault();
        const actual = $('current-password').value, nueva = $('new-password').value, repetir = $('confirm-new-password').value;
        if (nueva !== repetir) { mostrarAlerta('Las contraseñas no coinciden', 'error'); return; }
        if (!user.password) { mostrarAlerta('No hay contraseña en sesión para validar', 'error'); return; }
        if (actual !== user.password) { mostrarAlerta('Contraseña actual incorrecta', 'error'); return; }
        try {
            await request(USERS_API, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: user.id, password: nueva }) });
            user.password = nueva; sessionStorage.setItem('usuario', JSON.stringify(user));
            mostrarAlerta('Contraseña actualizada correctamente', 'exito');
        } catch (err) {
            console.error(err); user.password = nueva; sessionStorage.setItem('usuario', JSON.stringify(user));
            mostrarAlerta('Contraseña actualizada localmente. Error servidor.', 'info');
        }
        const modal = bootstrap.Modal.getInstance($('passwordModal')); if (modal) modal.hide();
    });

    /* ---------- LOGOUT y menú inicio ---------- */
    logoutBtn.addEventListener('click', e => { e.preventDefault(); sessionStorage.clear(); mostrarAlerta('Sesión cerrada', 'exito'); setTimeout(() => location.href = '../auth/login/login.html', 700); });
    const menuInicio = $('menu-inicio'); if (menuInicio) menuInicio.addEventListener('click', ev => { ev.preventDefault(); if (user && user.role === 'admin') location.href = '/pages/dashboard/admin/admin.html'; else location.href = '/index.html'; });

    // cargar inicialmente
    loadCars();
})();
