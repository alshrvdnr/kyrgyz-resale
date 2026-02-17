const tg = window.Telegram.WebApp;
tg.expand();

// Хранилище данных (в localStorage)
let listings = JSON.parse(localStorage.getItem("kg_resale_data")) || [];
let currentUser = tg.initDataUnsafe?.user || {
  id: 0,
  first_name: "Гость",
  username: "diniar",
};

// Инициализация при загрузке
document.addEventListener("DOMContentLoaded", () => {
  updateUI();
  setupProfile();
});

// Переключение страниц
function showPage(pageId) {
  document.querySelectorAll(".page").forEach((p) => p.classList.add("hidden"));
  document
    .querySelectorAll(".nav-item")
    .forEach((n) => n.classList.remove("active"));

  document.getElementById(`page-${pageId}`).classList.remove("hidden");
  if (pageId !== "add") {
    const activeNav = document.getElementById(`nav-${pageId}`);
    if (activeNav) activeNav.classList.add("active");
  }

  if (pageId === "home") updateUI();
  if (pageId === "profile") renderMyAds();

  tg.HapticFeedback.impactOccurred("light");
}

// Рендеринг главной
function updateUI(data = listings) {
  const grid = document.getElementById("listings-grid");
  grid.innerHTML = "";

  if (data.length === 0) {
    grid.innerHTML = `<div style="grid-column: 1/3; text-align: center; padding-top: 50px; color: gray;">
            Пока ничего нет. Станьте первым!
        </div>`;
    return;
  }

  data.forEach((ad) => {
    const el = document.createElement("div");
    el.className = "card";
    el.onclick = () => showDetails(ad);
    el.innerHTML = `
            <img src="${
              ad.img || "https://via.placeholder.com/300?text=Нет+фото"
            }" onerror="this.src='https://via.placeholder.com/300?text=Ошибка+загрузки'">
            <div class="card-content">
                <span class="price">${ad.price} KGS</span>
                <span class="title">${ad.title}</span>
                <span style="font-size: 10px; color: gray;">${
                  ad.category
                }</span>
            </div>
        `;
    grid.appendChild(el);
  });
}

// Добавление объявления
document.getElementById("add-ad-form").onsubmit = (e) => {
  e.preventDefault();

  const newAd = {
    id: Date.now(),
    userId: currentUser.id,
    userName: currentUser.first_name,
    userTg: currentUser.username,
    title: document.getElementById("ad-title").value,
    price: document.getElementById("ad-price").value,
    category: document.getElementById("ad-category").value,
    desc: document.getElementById("ad-desc").value,
    img: document.getElementById("ad-img").value,
    date: new Date().toLocaleDateString(),
  };

  listings.unshift(newAd);
  localStorage.setItem("kg_resale_data", JSON.stringify(listings));

  e.target.reset();
  tg.showAlert("Объявление успешно добавлено!");
  showPage("home");
};

// Детали товара
function showDetails(ad) {
  const modal = document.getElementById("product-modal");
  const content = document.getElementById("product-content");

  content.innerHTML = `
        <img src="${
          ad.img
        }" style="width:100%; border-radius:15px; margin-top:40px;">
        <h1 style="color: var(--accent-pink);">${ad.price} KGS</h1>
        <h2>${ad.title}</h2>
        <p style="color: gray;">Категория: ${ad.category}</p>
        <p>${ad.desc || "Нет описания"}</p>
        <hr style="border: 0.5px solid #222;">
        <p style="font-size: 12px; color: gray;">Продавец: ${ad.userName}</p>
        <a href="https://t.me/${ad.userTg}" target="_blank" 
           style="display: block; background: #0088cc; color: white; text-align: center; padding: 15px; border-radius: 10px; text-decoration: none; font-weight: bold; margin-top: 20px;">
           <i class="fab fa-telegram"></i> Написать продавцу
        </a>
    `;

  toggleModal("product-modal", true);
}

// Работа с модалками
function toggleModal(id, show) {
  const el = document.getElementById(id);
  if (show) el.classList.remove("hidden");
  else el.classList.add("hidden");
}

// Профиль
function setupProfile() {
  document.getElementById("user-name").innerText = currentUser.first_name;
  document.getElementById("user-photo").innerText = currentUser.first_name[0];
}

function renderMyAds() {
  const container = document.getElementById("my-listings");
  const myAds = listings.filter((a) => a.userId === currentUser.id);
  container.innerHTML = "";

  myAds.forEach((ad) => {
    const el = document.createElement("div");
    el.className = "card";
    el.innerHTML = `
            <img src="${ad.img}">
            <div class="card-content">
                <span class="price">${ad.price} KGS</span>
                <button onclick="deleteAd(${ad.id})" style="background:none; border:none; color:red; font-size:12px; padding:0;">Удалить</button>
            </div>
        `;
    container.appendChild(el);
  });
}

function deleteAd(id) {
  if (confirm("Удалить это объявление?")) {
    listings = listings.filter((a) => a.id !== id);
    localStorage.setItem("kg_resale_data", JSON.stringify(listings));
    renderMyAds();
  }
}

// Фильтры (простая сортировка)
function sortAds(type) {
  const sorted = [...listings].sort((a, b) => {
    return type === "low" ? a.price - b.price : b.price - a.price;
  });
  updateUI(sorted);
  toggleModal("filter-sheet", false);
}
