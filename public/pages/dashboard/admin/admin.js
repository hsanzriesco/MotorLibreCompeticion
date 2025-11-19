document.addEventListener("DOMContentLoaded", async () => {

    // ===== VERIFICAR SESIÓN (Sin cambios) =====
    const storedUser = sessionStorage.getItem("usuario");

    let usuario = null;
    if (storedUser) {
        try {
            usuario = JSON.parse(storedUser);
        } catch (e) {
            console.error("Error al parsear usuario:", e);
        }
    }

    if (!usuario || usuario.role?.toLowerCase() !== "admin") {
        sessionStorage.removeItem("usuario");
        alert("Acceso denegado. Inicia sesión como administrador.");
        setTimeout(() => {
            window.location.href = "/pages/auth/login/login.html";
        }, 1500);
        return;
    }

    // ===== ELEMENTOS DEL DOM (IDs del HTML) =====
    const calendarEl = document.getElementById("calendar");
    const eventModalEl = document.getElementById("eventModal");

    // --- ELEMENTOS DE EVENTOS (Ya existentes) ---
    if (calendarEl && eventModalEl) {
        // Resto de declaraciones de eventos...
    }
    const eventModal = new bootstrap.Modal(eventModalEl);
    const form = document.getElementById("eventForm");

    const titleInput = document.getElementById("title");
    const descriptionInput = document.getElementById("description");
    const locationInput = document.getElementById("location");
    const startDateInput = document.getElementById("start-date");
    const startTimeInput = document.getElementById("start-time");
    const endTimeInput = document.getElementById("end-time");
    const eventIdInput = document.getElementById("eventId");

    // ⭐ ELEMENTOS DE IMAGEN CLAVE DE EVENTOS ⭐
    const imageFileInput = document.getElementById("imageFile"); // input type="file"
    const imageURLInput = document.getElementById("imageURL");   // input type="hidden"
    const currentImagePreview = document.getElementById("currentImagePreview");
    const currentImageContainer = document.getElementById("currentImageContainer");
    const clearImageBtn = document.getElementById("clearImageBtn");

    const saveEventBtn = document.getElementById("saveEventBtn");
    const deleteEventBtn = document.getElementById("deleteEventBtn");

    let selectedEvent = null;


    // --- ELEMENTOS DEL GARAGE (NUEVOS) ---
    const carGarageForm = document.getElementById("carGarageForm");
    const carModalEl = document.getElementById("carGarageModal"); // Asumiendo un ID para el modal del coche
    // if (carModalEl) const carModal = new bootstrap.Modal(carModalEl); // Si existe un modal de coche

    const carIdInput = document.getElementById("carId");
    const carNameInput = document.getElementById("car_name");
    const carModelInput = document.getElementById("model");
    const carYearInput = document.getElementById("year");
    const carDescriptionInput = document.getElementById("description");

    // ⭐ ELEMENTOS DE IMAGEN CLAVE DEL GARAGE ⭐
    const carPhotoFileInput = document.getElementById("carPhotoFile"); // input type="file" del coche (Clave)
    const carPhotoUrlInput = document.getElementById("carPhotoURL");   // input type="hidden" del coche (Clave)
    const carPhotoPreview = document.getElementById("carPhotoPreview");
    const carPhotoContainer = document.getElementById("carPhotoContainer");
    const clearCarPhotoBtn = document.getElementById("clearCarPhotoBtn");


    // ... (Función showConfirmAlert sin cambios) ...
    function showConfirmAlert(message, onConfirm) {
        let confirmBox = document.getElementById("customConfirmContainer")?.querySelector(".custom-confirm");

        if (!confirmBox) {
            confirmBox = document.createElement("div");
            confirmBox.className = "custom-confirm";
            const container = document.getElementById("customConfirmContainer");
            if (container) container.appendChild(confirmBox);
        }

        confirmBox.innerHTML = `
            <div class="confirm-content">
                <p>${message}</p>
                <div class="buttons">
                    <button id="confirmYes" class="btn btn-danger">Sí</button>
                    <button id="confirmNo" class="btn btn-secondary">No</button>
                </div>
            </div>
        `;
        confirmBox.classList.add("show");

        document.getElementById("confirmNo").onclick = () => {
            confirmBox.classList.remove("show");
            setTimeout(() => confirmBox.innerHTML = "", 300);
        };

        document.getElementById("confirmYes").onclick = () => {
            confirmBox.classList.remove("show");
            setTimeout(() => confirmBox.innerHTML = "", 300);
            onConfirm();
        };
    }


    // ===== CARGAR EVENTOS (Sin cambios) =====
    async function fetchEvents() {
        try {
            const res = await fetch("/api/events");
            const json = await res.json();
            if (!json.success || !Array.isArray(json.data)) throw new Error(json.message || "Error desconocido al obtener eventos.");
            return json.data.map((e) => ({
                id: e.id,
                title: e.title,
                start: e.start,
                end: e.end,
                extendedProps: {
                    description: e.description,
                    location: e.location,
                    image_url: e.image_url
                }
            }));
        } catch (e) {
            console.error("Error al obtener eventos:", e);
            alert("Error al cargar los eventos: " + e.message);
            return [];
        }
    }

    // ==========================================================
    // ⭐ LÓGICA DE EVENTOS (CALENDARIO) (Sin cambios funcionales) ⭐
    // ==========================================================
    if (calendarEl) {
        const calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: "dayGridMonth",
            selectable: true,
            editable: false,
            height: "auto",
            locale: "es",

            select: (info) => {
                selectedEvent = null;
                form.reset();
                startDateInput.value = info.startStr.split("T")[0];
                eventIdInput.value = "";
                deleteEventBtn.style.display = "none";

                // Lógica de imagen al crear: limpiar todo
                imageFileInput.value = "";
                imageURLInput.value = "";
                currentImageContainer.style.display = "none";

                eventModal.show();
            },

            eventClick: (info) => {
                const event = info.event;
                selectedEvent = event;
                const extendedProps = event.extendedProps;
                const currentURL = extendedProps.image_url || "";

                eventIdInput.value = event.id;
                titleInput.value = event.title;
                descriptionInput.value = extendedProps.description || "";
                locationInput.value = extendedProps.location || "";

                // ASIGNAR URL EXISTENTE a hidden y VACIAR input file
                imageURLInput.value = currentURL;
                imageFileInput.value = "";

                // Lógica para previsualizar la imagen existente
                if (currentURL) {
                    currentImagePreview.src = currentURL;
                    currentImageContainer.style.display = 'block';
                } else {
                    currentImagePreview.src = '';
                    currentImageContainer.style.display = 'none';
                }

                if (event.start) {
                    const startDate = new Date(event.start);
                    startDateInput.value = startDate.toISOString().split("T")[0];
                    startTimeInput.value = startDate.toTimeString().slice(0, 5);
                }

                if (event.end) {
                    const endDate = new Date(event.end);
                    endTimeInput.value = endDate.toTimeString().slice(0, 5);
                }

                deleteEventBtn.style.display = "inline-block";
                eventModal.show();
            },

            events: async (info, successCallback) => {
                const events = await fetchEvents();
                successCallback(events);
            }
        });

        calendar.render();


        // ===== LÓGICA DE PREVISUALIZACIÓN Y LIMPIEZA DE IMAGEN DE EVENTOS =====

        // Previsualizar nuevo archivo seleccionado (Usa URL.createObjectURL)
        imageFileInput.addEventListener('change', function () {
            const file = this.files[0];

            if (file) {
                const fileUrl = URL.createObjectURL(file);
                currentImagePreview.src = fileUrl;
                currentImageContainer.style.display = 'block';
            } else {
                if (imageURLInput.value) {
                    currentImagePreview.src = imageURLInput.value;
                    currentImageContainer.style.display = 'block';
                } else {
                    currentImageContainer.style.display = 'none';
                }
            }
        });

        // Botón para eliminar la imagen
        clearImageBtn.addEventListener('click', (e) => {
            e.preventDefault();
            imageURLInput.value = ""; // INDICA al backend que la URL debe ser NULL
            imageFileInput.value = ""; // Limpia el archivo subido
            currentImageContainer.style.display = 'none';
        });


        // ===== GUARDAR EVENTO (CORRECCIÓN CLAVE EN LA LÓGICA DE FormData) =====
        saveEventBtn.addEventListener("click", async () => {
            const id = eventIdInput.value;
            const date = startDateInput.value;
            const startTime = startTimeInput.value;
            const endTime = endTimeInput.value;

            // Validación de campos obligatorios
            if (!titleInput.value.trim() || !date || !startTime || !endTime) {
                alert("Completa todos los campos obligatorios");
                return;
            }

            const start = `${date}T${startTime}`;
            const end = `${date}T${endTime}`;

            // 1. Crear FormData para enviar archivos al backend
            const formData = new FormData();
            formData.append('title', titleInput.value.trim());
            formData.append('description', descriptionInput.value.trim());
            formData.append('location', locationInput.value.trim());
            formData.append('start', start);
            formData.append('end', end);

            const file = imageFileInput.files[0];
            const currentURL = imageURLInput.value;

            // ⭐ LÓGICA DE ADJUNTAR IMAGEN DE EVENTOS ⭐
            if (file) {
                formData.append('imageFile', file);
            } else {
                formData.append('imageURL', currentURL);
            }

            try {
                const res = await fetch(id ? `/api/events?id=${id}` : "/api/events", {
                    method: id ? "PUT" : "POST",
                    body: formData // Envía el FormData correctamente
                });

                const data = await res.json();
                if (!data.success) throw new Error(data.message || "Fallo en la respuesta del servidor.");

                alert(id ? "Evento actualizado correctamente" : "Evento creado correctamente");
                eventModal.hide();
                calendar.refetchEvents();
            } catch (e) {
                console.error("Error al guardar:", e);
                alert("Error al guardar evento: " + e.message);
            }
        });

        // ===== ELIMINAR EVENTO (Sin cambios) =====
        deleteEventBtn.addEventListener("click", async () => {
            if (!selectedEvent || !selectedEvent.id) {
                alert("No hay evento seleccionado");
                return;
            }

            showConfirmAlert("¿Eliminar este evento?", async () => {
                try {
                    const res = await fetch(`/api/events?id=${selectedEvent.id}`, { method: "DELETE" });
                    const data = await res.json();
                    if (!data.success) throw new Error();

                    alert("Evento eliminado correctamente");
                    eventModal.hide();
                    calendar.refetchEvents();
                } catch {
                    alert("Error al eliminar evento");
                }
            });
        });
    } // Fin del bloque de Eventos/Calendario
    // ==========================================================


    // ==========================================================
    // ⭐ LÓGICA DEL CAR GARAGE (NUEVA IMPLEMENTACIÓN) ⭐
    // ==========================================================
    if (carGarageForm && usuario) {

        // ===== LÓGICA DE PREVISUALIZACIÓN Y LIMPIEZA DEL COCHE =====
        if (carPhotoFileInput) {
            // Previsualizar nuevo archivo
            carPhotoFileInput.addEventListener('change', function () {
                const file = this.files[0];

                if (file) {
                    const fileUrl = URL.createObjectURL(file);
                    carPhotoPreview.src = fileUrl;
                    carPhotoContainer.style.display = 'block';
                } else {
                    // Si cancela, vuelve a mostrar la URL antigua si existe
                    if (carPhotoUrlInput.value) {
                        carPhotoPreview.src = carPhotoUrlInput.value;
                        carPhotoContainer.style.display = 'block';
                    } else {
                        carPhotoContainer.style.display = 'none';
                    }
                }
            });
        }

        if (clearCarPhotoBtn) {
            // Botón para eliminar la imagen
            clearCarPhotoBtn.addEventListener('click', (e) => {
                e.preventDefault();
                carPhotoUrlInput.value = ""; // INDICA al backend que la URL debe ser NULL
                carPhotoFileInput.value = ""; // Limpia el archivo subido
                carPhotoContainer.style.display = 'none';
            });
        }

        // ===== GUARDADO DEL COCHE (POST/PUT) =====
        carGarageForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            // 1. Obtener datos básicos
            const id = carIdInput.value;
            const userId = usuario.id;

            if (!carNameInput.value.trim() || !userId) {
                alert("El nombre del coche y el usuario son obligatorios.");
                return;
            }

            // 2. Crear FormData para enviar el archivo
            const formData = new FormData();
            formData.append('user_id', userId);
            formData.append('car_name', carNameInput.value.trim());
            formData.append('model', carModelInput.value.trim());
            formData.append('year', carYearInput.value.trim());
            formData.append('description', carDescriptionInput.value.trim());

            // El ID solo se requiere en PUT y se añade al FormData
            if (id) {
                formData.append('id', id);
            }

            // 3. Lógica de Imagen
            const file = carPhotoFileInput.files[0];
            const currentURL = carPhotoUrlInput.value;

            if (file) {
                // Caso 1: Nuevo archivo subido. Lo adjuntamos como 'imageFile' (nombre que espera carGarage.js)
                formData.append('imageFile', file);
            } else {
                // Caso 2: No hay archivo nuevo. Enviamos la URL existente/vacía como 'photoURL'
                formData.append('photoURL', currentURL); // photoURL es el nombre que espera carGarage.js
            }

            try {
                // Si es PUT, añadimos el ID como query parameter
                const url = id ? `/api/carGarage?id=${id}` : "/api/carGarage";

                const res = await fetch(url, {
                    method: id ? "PUT" : "POST",
                    body: formData // Envía el FormData correctamente
                });

                const data = await res.json();
                if (!data.ok) throw new Error(data.msg || "Fallo en la respuesta del servidor.");

                alert(id ? "Coche actualizado correctamente" : "Coche añadido correctamente");

                // Si tienes un modal de coche, lo cierras aquí:
                // carModal.hide(); 
                // Y recargas la lista de coches si tienes esa función:
                // loadCarList(userId); 

            } catch (e) {
                console.error("Error al guardar el coche:", e);
                alert("Error al guardar el coche: " + e.message);
            }
        });
    }
    // ==========================================================


    // ... (Lógica de Logout sin cambios) ...
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", (e) => {
            e.preventDefault();
            showConfirmAlert("¿Deseas cerrar sesión?", () => {
                sessionStorage.removeItem("usuario");
                setTimeout(() => {
                    window.location.href = "/pages/auth/login/login.html";
                }, 800);
            });
        });
    }
});