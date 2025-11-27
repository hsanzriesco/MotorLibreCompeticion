document.addEventListener("DOMContentLoaded", async () => {
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
        // 🚨 ALERTA: Acceso denegado
        mostrarAlerta("Acceso denegado. Inicia sesión como administrador.", "error", 4000); 
        setTimeout(() => {
            window.location.href = "/pages/auth/login/login.html";
        }, 1500);
        return;
    }

    const calendarEl = document.getElementById("calendar");
    const eventModalEl = document.getElementById("eventModal");
    if (calendarEl && eventModalEl) {
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

    const imageFileInput = document.getElementById("imageFile");
    const imageURLInput = document.getElementById("imageURL");
    const currentImagePreview = document.getElementById("currentImagePreview");
    const currentImageContainer = document.getElementById("currentImageContainer");
    const clearImageBtn = document.getElementById("clearImageBtn");

    const saveEventBtn = document.getElementById("saveEventBtn");
    const deleteEventBtn = document.getElementById("deleteEventBtn");

    let selectedEvent = null;


    const carGarageForm = document.getElementById("carGarageForm");
    const carModalEl = document.getElementById("carGarageModal");

    const carIdInput = document.getElementById("carId");
    const carNameInput = document.getElementById("car_name");
    const carModelInput = document.getElementById("model");
    const carYearInput = document.getElementById("year");
    const carDescriptionInput = document.getElementById("description");

    const carPhotoFileInput = document.getElementById("carPhotoFile");
    const carPhotoUrlInput = document.getElementById("carPhotoURL");
    const carPhotoPreview = document.getElementById("carPhotoPreview");
    const carPhotoContainer = document.getElementById("carPhotoContainer");
    const clearCarPhotoBtn = document.getElementById("clearCarPhotoBtn");


    // ❌ SE ELIMINA LA FUNCIÓN OBSOLETA showConfirmAlert, 
    // Y AHORA SE USA mostrarConfirmacion() de alertas.js
    /*
    function showConfirmAlert(message, onConfirm) {
        // ... Lógica antigua ...
    }
    */


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
            // 🚨 ALERTA: Error al cargar eventos
            mostrarAlerta("Error al cargar los eventos: " + e.message, "error"); 
            return [];
        }
    }

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

                imageURLInput.value = currentURL;
                imageFileInput.value = "";

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
                    // Asegurar que el tiempo esté en formato HH:MM (slice(0, 5))
                    startTimeInput.value = startDate.toTimeString().slice(0, 5); 
                }

                if (event.end) {
                    const endDate = new Date(event.end);
                    // Asegurar que el tiempo esté en formato HH:MM (slice(0, 5))
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

        clearImageBtn.addEventListener('click', (e) => {
            e.preventDefault();
            imageURLInput.value = "";
            imageFileInput.value = "";
            currentImageContainer.style.display = 'none';
        });


        saveEventBtn.addEventListener("click", async () => {
            const id = eventIdInput.value;
            const date = startDateInput.value;
            const startTime = startTimeInput.value;
            const endTime = endTimeInput.value;

            if (!titleInput.value.trim() || !date || !startTime || !endTime) {
                // 🚨 ALERTA: Campos incompletos
                mostrarAlerta("Completa todos los campos obligatorios", "advertencia"); 
                return;
            }

            const start = `${date}T${startTime}`;
            const end = `${date}T${endTime}`;

            const formData = new FormData();
            formData.append('title', titleInput.value.trim());
            formData.append('description', descriptionInput.value.trim());
            formData.append('location', locationInput.value.trim());
            formData.append('start', start);
            formData.append('end', end);

            const file = imageFileInput.files[0];
            const currentURL = imageURLInput.value;

            if (file) {
                formData.append('imageFile', file);
            } else {
                formData.append('imageURL', currentURL);
            }

            try {
                const res = await fetch(id ? `/api/events?id=${id}` : "/api/events", {
                    method: id ? "PUT" : "POST",
                    body: formData
                });

                const data = await res.json();
                if (!data.success) throw new Error(data.message || "Fallo en la respuesta del servidor.");

                // 🟢 ALERTA: Éxito
                mostrarAlerta(id ? "Evento actualizado correctamente" : "Evento creado correctamente", "exito");
                eventModal.hide();
                calendar.refetchEvents();
            } catch (e) {
                console.error("Error al guardar:", e);
                // 🔴 ALERTA: Error al guardar
                mostrarAlerta("Error al guardar evento: " + e.message, "error"); 
            }
        });

        deleteEventBtn.addEventListener("click", async () => {
            if (!selectedEvent || !selectedEvent.id) {
                // 🚨 ALERTA: No hay evento seleccionado
                mostrarAlerta("No hay evento seleccionado", "info"); 
                return;
            }

            // ❓ CONFIRMACIÓN: Eliminar evento
            const confirmado = await mostrarConfirmacion("¿Estás seguro de que quieres eliminar este evento?");

            if (confirmado) {
                try {
                    const res = await fetch(`/api/events?id=${selectedEvent.id}`, { method: "DELETE" });
                    const data = await res.json();
                    if (!data.success) throw new Error();

                    // 🟢 ALERTA: Éxito
                    mostrarAlerta("Evento eliminado correctamente", "exito");
                    eventModal.hide();
                    calendar.refetchEvents();
                } catch {
                    // 🔴 ALERTA: Error al eliminar
                    mostrarAlerta("Error al eliminar evento", "error"); 
                }
            }
        });
    }
    
    // --- Lógica de Coche ---
    
    if (carGarageForm && usuario) {

        if (carPhotoFileInput) {
            carPhotoFileInput.addEventListener('change', function () {
                const file = this.files[0];

                if (file) {
                    const fileUrl = URL.createObjectURL(file);
                    carPhotoPreview.src = fileUrl;
                    carPhotoContainer.style.display = 'block';
                } else {
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
            clearCarPhotoBtn.addEventListener('click', (e) => {
                e.preventDefault();
                carPhotoUrlInput.value = "";
                carPhotoFileInput.value = "";
                carPhotoContainer.style.display = 'none';
            });
        }

        carGarageForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const id = carIdInput.value;
            const userId = usuario.id;

            if (!carNameInput.value.trim() || !userId) {
                // 🚨 ALERTA: Campos obligatorios
                mostrarAlerta("El nombre del coche y el usuario son obligatorios.", "advertencia"); 
                return;
            }

            const formData = new FormData();
            formData.append('user_id', userId);
            formData.append('car_name', carNameInput.value.trim());
            formData.append('model', carModelInput.value.trim());
            formData.append('year', carYearInput.value.trim());
            formData.append('description', carDescriptionInput.value.trim());

            if (id) {
                formData.append('id', id);
            }

            const file = carPhotoFileInput.files[0];
            const currentURL = carPhotoUrlInput.value;

            if (file) {
                formData.append('imageFile', file);
            } else {
                formData.append('photoURL', currentURL);
            }

            try {
                const url = id ? `/api/carGarage?id=${id}` : "/api/carGarage";

                const res = await fetch(url, {
                    method: id ? "PUT" : "POST",
                    body: formData
                });

                const data = await res.json();
                if (!data.ok) throw new Error(data.msg || "Fallo en la respuesta del servidor.");

                // 🟢 ALERTA: Éxito
                mostrarAlerta(id ? "Coche actualizado correctamente" : "Coche añadido correctamente", "exito");

            } catch (e) {
                console.error("Error al guardar el coche:", e);
                // 🔴 ALERTA: Error al guardar
                mostrarAlerta("Error al guardar el coche: " + e.message, "error");
            }
        });
    }

    // --- Lógica de Cerrar Sesión ---
    
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", async (e) => {
            e.preventDefault();
            
            // ❓ CONFIRMACIÓN: Cerrar sesión
            const confirmado = await mostrarConfirmacion("¿Deseas cerrar sesión?");

            if (confirmado) {
                sessionStorage.removeItem("usuario");
                setTimeout(() => {
                    window.location.href = "/pages/auth/login/login.html";
                }, 800);
            }
        });
    }
});