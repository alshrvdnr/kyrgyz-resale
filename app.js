const tg = window.Telegram.WebApp;
tg.expand();
tg.enableClosingConfirmation();

// --- ДАННЫЕ ДЛЯ МОДЕРАЦИИ (Вставь свои токены!) ---
const BOT_TOKEN = "8399814024:AAEla8xBVk_9deHydJV0hrc5QYDyXAFpZ8k";
const ADMIN_CHAT_ID = "1615492914";

// Состояние базы данных
let ads_db = JSON.parse(localStorage.getItem("gifts_global_v10")) || [];
let favs_db = JSON.parse(localStorage.getItem("favs_global_v10")) || [];
let currentCategory = "Все";
let currentProfileTab = "active";
let tempUploadedPhoto = "";

document.addEventListener("DOMContentLoaded", () => {
  setupUser();
  renderFeed();
});

// Инициализация юзера из Telegram
function setupUser() {
  const user = tg.initDataUnsafe?.user || { first_name: "Пользователь", id: 0 };
  document.getElementById("u-name").innerText = user.first_name;
  document.getElementById("u-avatar").innerText = user.first_name[0];
}

// --- ЛОГИКА ПОИСКА ПО ENTER ---
function handleSearch(e) {
  if (e.key === "Enter") {
    const query = e.target.value.toLowerCase();
    const results = ads_db.filter(
      (a) =>
        a.title.toLowerCase().includes(query) ||
        a.desc.toLowerCase().includes(query)
    );

    const tabsBlock = document.getElementById("home-tabs-block");
    const errorBox = document.getElementById("search-error");

    if (results.length === 0 && query !== "") {
      tabsBlock.classList.add("hidden");
      errorBox.classList.remove("hidden");
      renderFeed([]);
    } else {
      tabsBlock.classList.remove("hidden");
      errorBox.classList.add("hidden");
      renderFeed(query === "" ? ads_db : results);
    }
    e.target.blur(); // Скрываем клавиатуру
  }
}

// Рендеринг ленты
function renderFeed(data = ads_db) {
  const grid = document.getElementById("home-grid");
  grid.innerHTML = "";

  let filtered =
    currentCategory === "Все"
      ? data
      : data.filter((a) => a.cat === currentCategory);

  filtered.forEach((ad) => {
    const isFav = favs_db.includes(ad.id);
    const card = document.createElement("div");
    card.className = "card";
    card.onclick = () => openProductDetails(ad);
    card.innerHTML = `
            <img src="${ad.img || "https://via.placeholder.com/300"}">
            <div class="card-body">
                <span class="card-price">${ad.price} KGS</span>
                <span class="card-title">${ad.title}</span>
                <i class="fa-heart fav-btn-icon ${isFav ? "fa active" : "far"}" 
                   style="position:absolute; bottom:12px; right:12px; color:${
                     isFav ? "#ff8fb1" : "#888"
                   }" 
                   onclick="toggleFavorite(event, ${ad.id})"></i>
            </div>
        `;
    grid.appendChild(card);
  });
}

// --- ЗАГРУЗКА ФОТО ---
function handleFile(input) {
  const file = input.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      tempUploadedPhoto = e.target.result;
      document.getElementById("image-preview").src = tempUploadedPhoto;
      document.getElementById("preview-container").classList.remove("hidden");
      document.getElementById("upload-text").innerText = "Фото загружено ✅";
    };
    reader.readAsDataURL(file);
  }
}

// --- МОДЕРАЦИЯ (ОТПРАВКА В БОТ) ---
async function sendToModerationBot(adData) {
  const messageText =
    `🔔 **НОВАЯ ЗАЯВКА**\n\n` +
    `📦 Товар: ${adData.title}\n` +
    `💰 Цена: ${adData.price} KGS\n` +
    `👤 TG: @${adData.tgNick}\n` +
    `📱 Тел: ${adData.phone}\n` +
    `📁 Кат: ${adData.cat}`;

  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: ADMIN_CHAT_ID,
        text: messageText,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "Одобрить ✅", callback_data: `ok_${adData.id}` },
              { text: "Отклонить ❌", callback_data: `no_${adData.id}` },
            ],
          ],
        },
      }),
    });
  } catch (err) {
    console.error("API Error:", err);
  }
}

// --- ПУБЛИКАЦИЯ С ОЧИСТКОЙ ---
function submitToModeration() {
  const title = document.getElementById("in-title").value;
  const price = document.getElementById("in-price").value;
  const phone = document.getElementById("in-phone").value;
  const tgNick = document.getElementById("in-tg").value;
  const cat = document.getElementById("in-cat").value;
  const desc = document.getElementById("in-desc").value;

  if (!title || !price || !tempUploadedPhoto) {
    tg.showAlert("Заполните название, цену и загрузите фото!");
    return;
  }

  const newAd = {
    id: Date.now(),
    userId: tg.initDataUnsafe?.user?.id || 0,
    userName: tg.initDataUnsafe?.user?.first_name || "User",
    title,
    price,
    phone,
    tgNick,
    cat,
    desc,
    img: tempUploadedPhoto,
    status: "active",
    views: Math.floor(Math.random() * 1200),
  };

  // Сохранение
  ads_db.unshift(newAd);
  localStorage.setItem("gifts_global_v10", JSON.stringify(ads_db));

  // Отправка боту
  sendToModerationBot(newAd);

  // ОЧИСТКА ФОРМЫ (Как просил)
  document.getElementById("in-title").value = "";
  document.getElementById("in-price").value = "";
  document.getElementById("in-phone").value = "";
  document.getElementById("in-tg").value = "";
  document.getElementById("in-desc").value = "";
  document.getElementById("file-input").value = "";
  tempUploadedPhoto = "";
  document.getElementById("preview-container").classList.add("hidden");
  document.getElementById("upload-text").innerText = "Загрузить фото";

  tg.showAlert("Объявление отправлено на проверку!");
  showPage("home");
  renderFeed();
}

// Детали (Дизайн из скриншота PS5)
function openProductDetails(ad) {
  const modal = document.getElementById("product-modal");
  const inner = document.getElementById("product-full-content");

  inner.innerHTML = `
        <img src="${ad.img}" class="pd-hero-img">
        <div class="pd-details-box">
            <div class="pd-stats-row">
                <span>Просмотры: ${ad.views}</span>
                <div><i class="fa fa-eye"></i> ${
                  ad.views
                } <i class="fa fa-heart" style="margin-left:10px;"></i> 12</div>
            </div>
            <div class="pd-price-large">${ad.price} KGS</div>
            <div class="pd-title-large">${ad.title}</div>
            
            <div class="pd-actions-row">
                <!-- Прямая ссылка в чат TG -->
                <a href="https://t.me/${ad.tgNick.replace(
                  "@",
                  ""
                )}" target="_blank" class="btn-pd-write">Написать</a>
                <a href="tel:${ad.phone}" class="btn-pd-call">Позвонить</a>
            </div>

            <p style="color:var(--text-gray); font-size:14px;">Доставка: Бесплатная доставка по городу</p>
            <div style="margin:20px 0; line-height:1.7; color:#eee; white-space: pre-wrap;">${
              ad.desc
            }</div>

            <div class="pd-seller-card">
                <div class="ps-avatar-mock"></div>
                <div>
                    <b>${ad.userName}</b><br>
                    <small style="color:var(--text-gray);">Отвечает на 100% сообщений</small>
                </div>
            </div>
        </div>
    `;
  modal.classList.remove("hidden");
}

function closeProduct() {
  document.getElementById("product-modal").classList.add("hidden");
}

// Навигация
function showPage(pageId) {
  document.querySelectorAll(".page").forEach((p) => p.classList.add("hidden"));
  document.getElementById(`page-${pageId}`).classList.remove("hidden");

  document
    .querySelectorAll(".tab-item")
    .forEach((n) => n.classList.remove("active"));
  if (pageId !== "add") {
    const btn = document.getElementById(`n-${pageId}`);
    if (btn) btn.classList.add("active");
  }

  if (pageId === "home") {
    document.getElementById("home-tabs-block").classList.remove("hidden");
    document.getElementById("search-error").classList.add("hidden");
    renderFeed();
  }
  if (pageId === "favs") renderFavorites();
  if (pageId === "profile") renderProfileAds();

  tg.HapticFeedback.impactOccurred("light");
}

// Избранное
function toggleFavorite(e, id) {
  e.stopPropagation();
  if (favs_db.includes(id)) favs_db = favs_db.filter((f) => f !== id);
  else favs_db.push(id);
  localStorage.setItem("favs_global_v10", JSON.stringify(favs_db));
  renderFeed();
  tg.HapticFeedback.selectionChanged();
}

function renderFavorites() {
  const grid = document.getElementById("favs-grid");
  const empty = document.getElementById("favs-empty");
  const data = ads_db.filter((a) => favs_db.includes(a.id));

  if (data.length === 0) {
    grid.innerHTML = "";
    empty.classList.remove("hidden");
  } else {
    empty.classList.add("hidden");
    grid.innerHTML = data
      .map(
        (ad) =>
          `<div class="card" onclick="openProductDetails(${ad.id})"><img src="${ad.img}"><div class="card-body"><b>${ad.price} KGS</b><br><small>${ad.title}</small></div></div>`
      )
      .join("");
  }
}

function clearFavs() {
  if (confirm("Удалить все избранное?")) {
    favs_db = [];
    localStorage.setItem("favs_global_v10", JSON.stringify(favs_db));
    renderFavorites();
  }
}

// Фильтр категорий
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
  currentProfileTab = tab;
  document
    .querySelectorAll(".p-tab")
    .forEach((t) => t.classList.remove("active"));
  el.classList.add("active");
  renderProfileAds();
}

function renderProfileAds() {
  const grid = document.getElementById("my-ads-grid");
  const myId = tg.initDataUnsafe?.user?.id || 0;
  const myAds = ads_db.filter(
    (a) =>
      a.userId === myId &&
      (currentProfileTab === "active"
        ? a.status === "active"
        : a.status === "sold")
  );

  grid.innerHTML = myAds.length
    ? ""
    : '<div class="search-error-box">Ничего не найдено</div>';
  myAds.forEach((ad) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
            <img src="${ad.img}">
            <div class="card-body">
                <b>${ad.price} KGS</b>
                <button onclick="changeAdStatus(${
                  ad.id
                })" style="background:none; border:none; color:var(--pink); font-size:12px; display:block; padding:10px 0;">
                    ${currentProfileTab === "active" ? "В архив" : "Удалить"}
                </button>
            </div>
        `;
    grid.appendChild(card);
  });
}

function changeAdStatus(id) {
  const ad = ads_db.find((a) => a.id === id);
  if (currentProfileTab === "active") ad.status = "sold";
  else ads_db = ads_db.filter((a) => a.id !== id);
  localStorage.setItem("gifts_global_v10", JSON.stringify(ads_db));
  renderProfileAds();
}

// Заглушки для дизайна
function switchFeed(type, el) {
  document
    .querySelectorAll(".feed-tab")
    .forEach((t) => t.classList.remove("active"));
  el.classList.add("active");
}
