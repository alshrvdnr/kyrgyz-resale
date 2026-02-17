const tg = window.Telegram.WebApp;
tg.expand();

// Инициализация базы данных
let ads = JSON.parse(localStorage.getItem("kyrgyz_gifts_db")) || [];
let favorites = JSON.parse(localStorage.getItem("kyrgyz_favs_db")) || [];
let currentCategory = "Все";
let profileTab = "active";
let uploadedBase64 = "";

document.addEventListener("DOMContentLoaded", () => {
  updateUserInfo();
  renderFeed();
});

// Работа с пользователем
function updateUserInfo() {
  const user = tg.initDataUnsafe?.user || { first_name: "Никнейм", id: 0 };
  document.getElementById("u-name").innerText = user.first_name;
  document.getElementById("u-avatar").innerText = user.first_name[0];
}

// РЕАЛЬНЫЙ ПОИСК (Enter)
function handleSearch(e) {
  if (e.key === "Enter") {
    const query = e.target.value.toLowerCase();
    const results = ads.filter(
      (a) =>
        a.title.toLowerCase().includes(query) ||
        a.desc.toLowerCase().includes(query)
    );

    const tabs = document.getElementById("home-tabs-container");
    const error = document.getElementById("search-error");

    if (results.length === 0 && query !== "") {
      tabs.classList.add("hidden");
      error.classList.remove("hidden");
      renderFeed([]);
    } else {
      tabs.classList.remove("hidden");
      error.classList.add("hidden");
      renderFeed(query === "" ? ads : results);
    }
    e.target.blur(); // Скрыть клавиатуру
  }
}

// Отрисовка ленты
function renderFeed(data = ads) {
  const grid = document.getElementById("home-grid");
  grid.innerHTML = "";

  let filtered = data;
  if (currentCategory !== "Все") {
    filtered = data.filter((a) => a.cat === currentCategory);
  }

  filtered.forEach((ad) => {
    const isFav = favorites.includes(ad.id);
    const card = document.createElement("div");
    card.className = "card";
    card.onclick = () => openProduct(ad);
    card.innerHTML = `
            <img src="${ad.img || "https://via.placeholder.com/300"}">
            <div class="card-body">
                <span class="card-price">${ad.price} KGS</span>
                <span class="card-title">${ad.title}</span>
                <i class="fa-heart fav-btn ${
                  isFav ? "fa active" : "far"
                }" onclick="toggleFav(event, ${ad.id})"></i>
            </div>
        `;
    grid.appendChild(card);
  });
}

// Навигация
function showPage(pageId) {
  document.querySelectorAll(".page").forEach((p) => p.classList.add("hidden"));
  document.getElementById(`page-${pageId}`).classList.remove("hidden");

  document
    .querySelectorAll(".nav-item")
    .forEach((n) => n.classList.remove("active"));
  if (pageId !== "add") {
    const navBtn = document.getElementById(`n-${pageId}`);
    if (navBtn) navBtn.classList.add("active");
  }

  if (pageId === "home") {
    document.getElementById("home-tabs-container").classList.remove("hidden");
    document.getElementById("search-error").classList.add("hidden");
    renderFeed();
  }
  if (pageId === "favs") renderFavorites();
  if (pageId === "profile") renderProfileAds();

  tg.HapticFeedback.impactOccurred("light");
}

// ЗАГРУЗКА ФОТО
function previewFile(input) {
  const file = input.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function (e) {
      uploadedBase64 = e.target.result;
      document.getElementById("image-preview").src = uploadedBase64;
      document
        .getElementById("image-preview-container")
        .classList.remove("hidden");
      document.getElementById("upload-text").innerText =
        "Фото успешно выбрано ✅";
    };
    reader.readAsDataURL(file);
  }
}

// Публикация
function submitAd() {
  const title = document.getElementById("in-title").value;
  const price = document.getElementById("in-price").value;
  const phone = document.getElementById("in-phone").value;
  const tgNick = document.getElementById("in-tg").value;
  const cat = document.getElementById("in-cat").value;
  const desc = document.getElementById("in-desc").value;

  if (!title || !price || !uploadedBase64) {
    tg.showAlert("Заполните название, цену и загрузите фото!");
    return;
  }

  const newAd = {
    id: Date.now(),
    userId: tg.initDataUnsafe?.user?.id || 0,
    title,
    price,
    phone,
    tgNick,
    cat,
    desc,
    img: uploadedBase64,
    status: "active", // Может быть 'active' или 'history'
  };

  ads.unshift(newAd);
  localStorage.setItem("kyrgyz_gifts_db", JSON.stringify(ads));

  // Сброс
  uploadedBase64 = "";
  document.getElementById("file-input").value = "";
  document.getElementById("image-preview-container").classList.add("hidden");

  showPage("home");
}

// Детали товара
function openProduct(ad) {
  const modal = document.getElementById("product-modal");
  const details = document.getElementById("product-details");
  const footer = document.getElementById("product-footer");

  details.innerHTML = `
        <img src="${
          ad.img
        }" style="width:100%; height:380px; object-fit:cover;">
        <div style="padding:20px;">
            <h1 style="color:var(--pink); margin:0;">${ad.price} KGS</h1>
            <h2 style="margin:10px 0;">${ad.title}</h2>
            <div style="display:flex; gap:10px; margin-bottom:15px;">
                <a href="tel:${
                  ad.phone
                }" style="color:var(--gray); text-decoration:none;"><i class="fa fa-phone"></i> Позвонить</a>
                <a href="https://wa.me/${ad.phone.replace(
                  /\D/g,
                  ""
                )}" style="color:var(--gray); text-decoration:none;"><i class="fab fa-whatsapp"></i> WhatsApp</a>
            </div>
            <p style="color:#ddd; line-height:1.6;">${ad.desc}</p>
        </div>
    `;

  // Кнопка НАПИСАТЬ (Прямой переход в чат)
  footer.innerHTML = `
        <button class="btn-publish" onclick="window.open('https://t.me/${ad.tgNick.replace(
          "@",
          ""
        )}', '_blank')">Написать</button>
    `;

  modal.classList.remove("hidden");
}

function closeProduct() {
  document.getElementById("product-modal").classList.add("hidden");
}

// ИЗБРАННОЕ
function toggleFav(e, id) {
  e.stopPropagation();
  if (favorites.includes(id)) {
    favorites = favorites.filter((f) => f !== id);
  } else {
    favorites.push(id);
  }
  localStorage.setItem("kyrgyz_favs_db", JSON.stringify(favorites));
  renderFeed();
  tg.HapticFeedback.selectionChanged();
}

function renderFavorites() {
  const grid = document.getElementById("favs-grid");
  const favData = ads.filter((a) => favorites.includes(a.id));
  grid.innerHTML = favData.length
    ? ""
    : '<div class="error-container">В избранном пока пусто</div>';

  favData.forEach((ad) => {
    const card = document.createElement("div");
    card.className = "card";
    card.onclick = () => openProduct(ad);
    card.innerHTML = `<img src="${ad.img}"><div class="card-body"><b>${ad.price} KGS</b><br><small>${ad.title}</small></div>`;
    grid.appendChild(card);
  });
}

function clearFavs() {
  if (confirm("Удалить все избранные товары?")) {
    favorites = [];
    localStorage.setItem("kyrgyz_favs_db", JSON.stringify(favorites));
    renderFavorites();
  }
}

// Категории
function filterByCat(cat, el) {
  currentCategory = cat;
  document
    .querySelectorAll(".cat-chip")
    .forEach((c) => c.classList.remove("active"));
  el.classList.add("active");
  renderFeed();
}

// Профиль
function switchProfileTab(tab, el) {
  profileTab = tab;
  document
    .querySelectorAll(".p-tab")
    .forEach((t) => t.classList.remove("active"));
  el.classList.add("active");
  renderProfileAds();
}

function renderProfileAds() {
  const grid = document.getElementById("my-ads-grid");
  const myId = tg.initDataUnsafe?.user?.id || 0;

  const myAds = ads.filter(
    (a) =>
      a.userId === myId &&
      a.status === (profileTab === "active" ? "active" : "history")
  );

  grid.innerHTML = myAds.length
    ? ""
    : '<div class="error-container">Ничего не найдено</div>';

  myAds.forEach((ad) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
            <img src="${ad.img}">
            <div class="card-body">
                <b>${ad.price} KGS</b>
                <button onclick="moveAdStatus(${
                  ad.id
                })" style="background:none; border:none; color:var(--pink); font-size:12px; display:block; padding:5px 0;">
                    ${
                      profileTab === "active"
                        ? "В архив / Продано"
                        : "Удалить навсегда"
                    }
                </button>
            </div>
        `;
    grid.appendChild(card);
  });
}

function moveAdStatus(id) {
  const ad = ads.find((a) => a.id === id);
  if (profileTab === "active") {
    ad.status = "history";
  } else {
    ads = ads.filter((a) => a.id !== id);
  }
  localStorage.setItem("kyrgyz_gifts_db", JSON.stringify(ads));
  renderProfileAds();
}

// Пустые функции для неработающих кнопок (для красоты)
function switchFeed(type, el) {
  document
    .querySelectorAll(".feed-tab")
    .forEach((t) => t.classList.remove("active"));
  el.classList.add("active");
  tg.HapticFeedback.impactOccurred("medium");
}
