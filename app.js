const tg = window.Telegram.WebApp;
tg.expand();

// Состояние приложения
let listings = JSON.parse(localStorage.getItem("resale_kg_ads")) || [];
let currentCategory = "Все";
let searchQuery = "";

// При запуске
document.addEventListener("DOMContentLoaded", () => {
  initUser();
  renderAll();

  // РЕАЛЬНЫЙ ПОИСК: вешаем событие на ввод текста
  document.getElementById("search-input").addEventListener("input", (e) => {
    searchQuery = e.target.value.toLowerCase();
    renderAll(); // Перерисовываем при каждом символе
  });
});

function initUser() {
  const user = tg.initDataUnsafe?.user || { first_name: "Дилфуза", id: 0 };
  const nameEl = document.getElementById("user-name-display");
  const avatarEl = document.getElementById("user-avatar");
  if (nameEl) nameEl.innerText = user.first_name;
  if (avatarEl) avatarEl.innerText = user.first_name[0];
}

// ГЛАВНАЯ ФУНКЦИЯ ОТРИСОВКИ (с учетом поиска и категорий)
function renderAll() {
  const grid = document.getElementById("listings-grid");
  grid.innerHTML = "";

  // Фильтрация данных
  let filtered = listings.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery) ||
      item.desc.toLowerCase().includes(searchQuery);
    const matchesCat =
      currentCategory === "Все" || item.category === currentCategory;
    return matchesSearch && matchesCat;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `<div style="grid-column: 1/3; text-align: center; padding: 40px; color: gray;">Ничего не найдено</div>`;
    return;
  }

  filtered.forEach((ad) => {
    const card = document.createElement("div");
    card.className = "card";
    card.onclick = () => openProduct(ad);
    card.innerHTML = `
            <img src="${
              ad.img || "https://via.placeholder.com/300x200?text=Нет+фото"
            }" class="card-img">
            <div class="card-body">
                <span class="card-price">${ad.price} KGS</span>
                <span class="card-title">${ad.title}</span>
            </div>
        `;
    grid.appendChild(card);
  });
}

// Переключение страниц
function showPage(pageId) {
  document.querySelectorAll(".page").forEach((p) => p.classList.add("hidden"));
  document
    .querySelectorAll(".tab-btn")
    .forEach((b) => b.classList.remove("active"));

  document.getElementById(`page-${pageId}`).classList.remove("hidden");
  const navBtn = document.getElementById(`nav-${pageId}`);
  if (navBtn) navBtn.classList.add("active");

  if (pageId === "profile") renderMyAds();
  tg.HapticFeedback.impactOccurred("light");
}

// Создание объявления
function createAd() {
  const title = document.getElementById("ad-title").value;
  const price = document.getElementById("ad-price").value;
  const category = document.getElementById("ad-category").value;
  const desc = document.getElementById("ad-desc").value;
  const img = document.getElementById("ad-img").value;

  if (!title || !price) {
    tg.showAlert("Заполните название и цену!");
    return;
  }

  const newAd = {
    id: Date.now(),
    userId: tg.initDataUnsafe?.user?.id || 0,
    userName: tg.initDataUnsafe?.user?.first_name || "Продавец",
    userNick: tg.initDataUnsafe?.user?.username || "",
    title,
    price,
    category,
    desc,
    img,
    date: new Date().toLocaleDateString(),
  };

  listings.unshift(newAd);
  localStorage.setItem("resale_kg_ads", JSON.stringify(listings));

  // Сброс и возврат
  document.getElementById("ad-title").value = "";
  document.getElementById("ad-price").value = "";
  showPage("home");
  renderAll();
  tg.showAlert("Объявление опубликовано!");
}

// Детали товара
function openProduct(ad) {
  const modal = document.getElementById("product-modal");
  const content = document.getElementById("product-details-content");

  content.innerHTML = `
        <img src="${ad.img}" style="width:100%; height:300px; object-fit:cover;">
        <div style="padding: 20px;">
            <h1 style="color: var(--accent); margin-bottom: 5px;">${ad.price} KGS</h1>
            <h2 style="margin-top: 0;">${ad.title}</h2>
            <div style="background: #222; padding: 10px; border-radius: 10px; margin-bottom: 20px; font-size: 14px; color: #ccc;">
                ${ad.desc}
            </div>
            <p style="color: gray; font-size: 13px;">Продавец: ${ad.userName}</p>
            <a href="https://t.me/${ad.userNick}" class="main-btn" style="display: block; text-align: center; text-decoration: none;">Написать в Telegram</a>
        </div>
    `;
  modal.classList.remove("hidden");
}

function closeProduct() {
  document.getElementById("product-modal").classList.add("hidden");
}

function filterByCat(cat) {
  currentCategory = cat;
  // Обновляем визуально чипы
  document.querySelectorAll(".cat-chip").forEach((chip) => {
    chip.classList.toggle(
      "active",
      chip.innerText.includes(cat) ||
        (cat === "Все" && chip.innerText === "Все")
    );
  });
  renderAll();
}

function renderMyAds() {
  const myGrid = document.getElementById("my-listings");
  const myId = tg.initDataUnsafe?.user?.id || 0;
  const myAds = listings.filter((a) => a.userId === myId);

  myGrid.innerHTML = myAds.length
    ? ""
    : '<p style="padding: 20px; color: gray;">У вас нет объявлений</p>';

  myAds.forEach((ad) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
            <img src="${ad.img}" class="card-img">
            <div class="card-body">
                <span class="card-price">${ad.price} KGS</span>
                <button onclick="deleteAd(${ad.id})" style="background:none; border:none; color:red; font-size:12px; margin-top:5px;">Удалить</button>
            </div>
        `;
    myGrid.appendChild(card);
  });
}

function deleteAd(id) {
  if (confirm("Удалить объявление?")) {
    listings = listings.filter((a) => a.id !== id);
    localStorage.setItem("resale_kg_ads", JSON.stringify(listings));
    renderMyAds();
    renderAll();
  }
}
