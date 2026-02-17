const tg = window.Telegram.WebApp;
tg.expand();

// Данные
const cities = ["Бишкек", "Ош", "Каракол", "Манас", "Токмок"];
const categories = {
  ru: ["Все", "Цветы", "Подарки", "Ювелирка", "Сертификаты"],
  kg: ["Баары", "Гүлдөр", "Белектер", "Зергерчилик", "Сертификаттар"],
};

let currentLang = "ru";
let listings = JSON.parse(localStorage.getItem("kg_resale_ads")) || [];
let currentCategory = "Все";

// Инициализация
document.addEventListener("DOMContentLoaded", () => {
  initSelects();
  renderCategories();
  renderListings(listings);

  // Поиск
  document.getElementById("search-input").addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase();
    const filtered = listings.filter(
      (item) =>
        item.title.toLowerCase().includes(query) ||
        item.desc.toLowerCase().includes(query)
    );
    renderListings(filtered);
  });
});

function initSelects() {
  const citySelects = [
    document.getElementById("item-city"),
    document.getElementById("filter-city"),
  ];
  citySelects.forEach((select) => {
    select.innerHTML = cities
      .map((c) => `<option value="${c}">${c}</option>`)
      .join("");
  });

  const catSelect = document.getElementById("item-category");
  catSelect.innerHTML = categories.ru
    .slice(1)
    .map((c) => `<option value="${c}">${c}</option>`)
    .join("");
}

function renderCategories() {
  const container = document.getElementById("category-list");
  container.innerHTML = categories[currentLang]
    .map(
      (cat) => `
        <div class="cat-item ${
          currentCategory === cat ? "active" : ""
        }" onclick="filterByCategory('${cat}')">
            ${cat}
        </div>
    `
    )
    .join("");
}

function filterByCategory(cat) {
  currentCategory = cat;
  renderCategories();
  const filtered =
    cat === "Все" || cat === "Баары"
      ? listings
      : listings.filter((item) => item.category === cat);
  renderListings(filtered);
}

function renderListings(data) {
  const grid = document.getElementById("listings-grid");
  grid.innerHTML = "";

  if (data.length === 0) {
    grid.innerHTML =
      '<p style="grid-column: 1/3; text-align: center; color: gray; margin-top: 20px;">Объявлений пока нет</p>';
    return;
  }

  data.forEach((item) => {
    const isNew = Date.now() - item.date < 24 * 60 * 60 * 1000;
    const card = document.createElement("div");
    card.className = "card";
    card.onclick = () => showProductings(item.id);
    card.innerHTML = `
            ${isNew ? '<span class="badge-new">Новое</span>' : ""}
            <img src="${
              item.photos[0] || "https://via.placeholder.com/150"
            }" class="card-img">
            <div class="card-info">
                <span class="card-price">${item.price} сом</span>
                <span class="card-title">${item.title}</span>
                <div class="card-meta">${item.city} • ${new Date(
      item.date
    ).toLocaleDateString()}</div>
            </div>
        `;
    grid.appendChild(card);
  });
}

// Навигация
function showPage(pageId) {
  document.querySelectorAll(".view").forEach((v) => v.classList.add("hidden"));
  if (pageId === "home") {
    document.getElementById("main-content").classList.remove("hidden");
    renderListings(listings);
  } else {
    document.getElementById("main-content").classList.add("hidden");
    document.getElementById(`${pageId}-view`).classList.remove("hidden");
  }

  if (pageId === "profile") renderMyListings();
}

// Добавление товара
document.getElementById("add-form").onsubmit = async (e) => {
  e.preventDefault();

  const photosInput = document.getElementById("item-photos");
  const photoData = [];

  // Конвертация фото в Base64 (для MVP в localStorage)
  if (photosInput.files.length > 0) {
    for (let file of photosInput.files) {
      const base64 = await toBase64(file);
      photoData.push(base64);
    }
  }

  const newAd = {
    id: Date.now(),
    userId: tg.initDataUnsafe.user?.id || 0,
    userName: tg.initDataUnsafe.user?.first_name || "User",
    title: document.getElementById("item-title").value,
    desc: document.getElementById("item-desc").value,
    price: document.getElementById("item-price").value,
    category: document.getElementById("item-category").value,
    city: document.getElementById("item-city").value,
    phone: document.getElementById("item-phone").value,
    tgUser: document.getElementById("item-tg").value,
    photos: photoData,
    date: Date.now(),
    views: 0,
  };

  listings.unshift(newAd);
  localStorage.setItem("kg_resale_ads", JSON.stringify(listings));

  alert("Объявление опубликовано!");
  e.target.reset();
  showPage("home");
};

const toBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });

// Просмотр товара
function showProductings(id) {
  const item = listings.find((i) => i.id === id);
  if (!item) return;

  item.views = (item.views || 0) + 1;
  localStorage.setItem("kg_resale_ads", JSON.stringify(listings));

  const view = document.getElementById("product-view");
  const details = document.getElementById("product-details");

  details.innerHTML = `
        <img src="${
          item.photos[0] || "https://via.placeholder.com/400"
        }" class="product-img-large">
        <div class="product-info-block">
            <h2>${item.price} сом</h2>
            <h3>${item.title}</h3>
            <p style="color: gray; font-size: 14px;">${
              item.city
            } • Просмотров: ${item.views}</p>
            <hr>
            <p>${item.desc}</p>
            <hr>
            <div class="btn-row">
                <a href="https://t.me/${
                  item.tgUser
                }" class="btn-tg"><i class="fab fa-telegram"></i> Написать</a>
                <a href="tel:${
                  item.phone
                }" class="btn-call"><i class="fa fa-phone"></i> Позвонить</a>
            </div>
        </div>
    `;

  view.classList.remove("hidden");
}

function closeProduct() {
  document.getElementById("product-view").classList.add("hidden");
}

// Фильтры
function openFilter() {
  document.getElementById("filter-sheet").classList.remove("hidden");
}
function closeFilter() {
  document.getElementById("filter-sheet").classList.add("hidden");
}

function applyFilters() {
  const city = document.getElementById("filter-city").value;
  const sort = document.getElementById("filter-sort").value;

  let filtered = [...listings];

  if (city) filtered = filtered.filter((i) => i.city === city);

  if (sort === "cheap") filtered.sort((a, b) => a.price - b.price);
  if (sort === "expensive") filtered.sort((a, b) => b.price - a.price);
  if (sort === "new") filtered.sort((a, b) => b.date - a.date);

  renderListings(filtered);
  closeFilter();
}

// Личный кабинет
function renderMyListings() {
  const myId = tg.initDataUnsafe.user?.id || 0;
  const myAds = listings.filter((item) => item.userId === myId);
  const container = document.getElementById("my-listings-grid");

  container.innerHTML = myAds
    .map(
      (item) => `
        <div class="card">
            <img src="${item.photos[0]}" class="card-img">
            <div class="card-info">
                <b>${item.price} сом</b>
                <button onclick="deleteAd(${item.id})" style="color:red; border:none; background:none; font-size:12px;">Удалить</button>
            </div>
        </div>
    `
    )
    .join("");
}

function deleteAd(id) {
  if (confirm("Удалить объявление?")) {
    listings = listings.filter((i) => i.id !== id);
    localStorage.setItem("kg_resale_ads", JSON.stringify(listings));
    renderMyListings();
  }
}

// Язык
function toggleLang() {
  currentLang = currentLang === "ru" ? "kg" : "ru";
  document.getElementById("lang-toggle").innerText =
    currentLang === "ru" ? "KG" : "RU";

  const polyglot = {
    ru: {
      logo: "Кыргызстан Перепродажа",
      add: "Подать объявление",
      my: "Мои объявления",
      rules: "Правила платформы",
      home: "Главная",
      profile: "Профиль",
    },
    kg: {
      logo: "Кыргызстан Кайра сатуу",
      add: "Жарнак берүү",
      my: "Менин жарнамаларым",
      rules: "Платформанын эрежелери",
      home: "Башкы",
      profile: "Профиль",
    },
  };

  document.getElementById("txt-logo").innerText = polyglot[currentLang].logo;
  document.getElementById("nav-home").innerText = polyglot[currentLang].home;
  document.getElementById("nav-profile").innerText =
    polyglot[currentLang].profile;

  renderCategories();
}
