document.addEventListener("DOMContentLoaded", () => {
    const carList = document.getElementById("car-list");
    const noCarsMessage = document.getElementById("no-cars-message");
    const carForm = document.getElementById("car-form");
    const deleteCarBtn = document.getElementById("delete-car-btn");
    const openAddCarBtn = document.getElementById("open-add-car-btn");

    let currentCarId = null;

    // ============================
    // 1) CARGAR USUARIO
    // ============================
    const stored = sessionStorage.getItem("usuario");
    if (!stored) return (window.location.href = "../auth/login/login.html");
    const user = JSON.parse(stored);

    // ============================
    // 2) CARGAR COCHES DESDE BD
    // ============================
    async function loadCars() {
        const res = await fetch(`/api/carGarage?user_id=${user.id}`);
        const data = await res.json();

        carList.innerHTML = "";

        if (!data.cars.length) {
            noCarsMessage.style.display = "block";
            return;
        }

        noCarsMessage.style.display = "none";
        data.cars.forEach((car) => {
            carList.innerHTML += `
            <div class="col-12 col-md-6" data-car-id="${car.id}">
                <div class="car-item" data-car-id="${car.id}">
                    <img src="${car.photo_url || "https://via.placeholder.com/300x150"}" />
                    <div>
                        <h6>${car.car_name}</h6>
                        <p>${car.model} (${car.year || "N/A"})</p>
                    </div>
                </div>
            </div>`;
        });

        // abrir modal al clicar
        carList.querySelectorAll(".car-item").forEach((el) => {
            el.addEventListener("click", () => {
                const id = el.dataset.carId;
                const car = data.cars.find((c) => c.id == id);
                openCarModal(car);
                new bootstrap.Modal("#carModal").show();
            });
        });
    }

    loadCars();

    // ============================
    // 3) MODAL AÑADIR / EDITAR
    // ============================
    function openCarModal(car) {
        carForm.reset();
        currentCarId = car ? car.id : null;

        document.getElementById("carModalTitle").textContent = car ? "Editar coche" : "Añadir coche";
        deleteCarBtn.style.display = car ? "block" : "none";

        if (car) {
            document.getElementById("car-name").value = car.car_name;
            document.getElementById("car-model").value = car.model;
            document.getElementById("car-year").value = car.year;
            document.getElementById("car-photo").value = car.photo_url;
        }
    }

    openAddCarBtn.addEventListener("click", () => {
        openCarModal(null);
    });

    // ============================
    // 4) GUARDAR (POST / PUT)
    // ============================
    carForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const payload = {
            id: currentCarId,
            user_id: user.id,
            car_name: carForm["car-name"].value,
            model: carForm["car-model"].value,
            year: carForm["car-year"].value,
            photo_url: carForm["car-photo"].value,
        };

        let method = currentCarId ? "PUT" : "POST";

        await fetch("/api/carGarage", {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        mostrarAlerta(currentCarId ? "Coche actualizado" : "Coche añadido", "exito");

        bootstrap.Modal.getInstance("#carModal").hide();
        loadCars();
    });

    // ============================
    // 5) ELIMINAR (DELETE)
    // ============================
    deleteCarBtn.addEventListener("click", async () => {
        if (!currentCarId) return;

        await fetch(`/api/carGarage?id=${currentCarId}`, { method: "DELETE" });

        mostrarAlerta("Coche eliminado", "exito");

        bootstrap.Modal.getInstance("#carModal").hide();
        loadCars();
    });
});
