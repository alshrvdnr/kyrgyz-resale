const tg = window.Telegram.WebApp;
tg.expand();

// ДАННЫЕ БОТА (Вставь свои!)
const BOT_TOKEN = "8399814024:AAEla8xBVk_9deHydJV0hrc5QYDyXAFpZ8k";
const ADMIN_ID = "1615492914";

let ads = JSON.parse(localStorage.getItem("gifts_final_v4")) || [];
let favorites = JSON.parse(localStorage.getItem("favs_final_v4")) || [];
let currentCategory = "Все";
let uploadedBase64 = "";

document.addEventListener("DOMContentLoaded", () => {
  initApp();
});

function initApp() {
  const user = tg.initDataUnsafe?.user || { first_name: "Пользователь" };
  document.getElementById("u-name").innerText = user.first_name;
  document.getElementById("u-avatar").innerText = user.first_name[0];
  renderFeed();
}

// ПОИСК (ENTER)
function handleSearch(e) {
  if (e.key === "Enter") {
    const query = e.target.value.toLowerCase();
    const results = ads.filter((a) => a.title.toLowerCase().includes(query));

    const tabs = document.getElementById("home-tabs-wrapper");
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
    e.target.blur();
  }
}

function renderFeed(data = ads) {
  const grid = document.getElementById("home-grid");
  grid.innerHTML = "";
  let filtered = data;
  if (currentCategory !== "Все")
    filtered = data.filter((a) => a.cat === currentCategory);

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
            </div>
        `;
    grid.appendChild(card);
  });
}

// ФОТО
function processFile(input) {
  const file = input.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      uploadedBase64 = e.target.result;
      document.getElementById("img-pre").src = uploadedBase64;
      document.getElementById("pre-view-box").classList.remove("hidden");
      document.getElementById("file-label").innerText = "Фото выбрано ✅";
    };
    reader.readAsDataURL(file);
  }
}

// ОТПРАВКА В БОТ (МОДЕРАЦИЯ)
async function sendToModerator(ad) {
  const text =
    `🚀 **ЗАЯВКА НА ПУБЛИКАЦИЮ**\n\n` +
    `👤 От: ${ad.userName} (@${ad.userNick})\n` +
    `📦 Товар: ${ad.title}\n` +
    `💰 Цена: ${ad.price} KGS\n` +
    `📱 Тел: ${ad.phone}\n` +
    `📁 Категория: ${ad.cat}`;

  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: ADMIN_ID,
        text: text,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "Одобрить ✅", callback_data: `ok_${ad.id}` },
              { text: "Отклонить ❌", callback_data: `no_${ad.id}` },
            ],
          ],
        },
      }),
    });
  } catch (e) {
    console.error(e);
  }
}

function publishAd() {
  const title = document.getElementById("in-title").value;
  const price = document.getElementById("in-price").value;
  const phone = document.getElementById("in-phone").value;
  const tgNick = document.getElementById("in-tg").value;
  const cat = document.getElementById("in-cat").value;
  const desc = document.getElementById("in-desc").value;

  if (!title || !price || !uploadedBase64)
    return tg.showAlert("Заполни все поля и загрузи фото!");

  const ad = {
    id: Date.now(),
    userId: tg.initDataUnsafe?.user?.id || 0,
    userName: tg.initDataUnsafe?.user?.first_name || "User",
    userNick: tg.initDataUnsafe?.user?.username || "",
    title,
    price,
    phone,
    tgNick,
    cat,
    desc,
    img: uploadedBase64,
    status: "active",
    views: Math.floor(Math.random() * 900),
  };

  ads.unshift(ad);
  localStorage.setItem("gifts_final_v4", JSON.stringify(ads));

  sendToModerator(ad);

  // ОЧИСТКА ФОРМЫ
  document.getElementById("in-title").value = "";
  document.getElementById("in-price").value = "";
  document.getElementById("in-phone").value = "";
  document.getElementById("in-tg").value = "";
  document.getElementById("in-desc").value = "";
  document.getElementById("file-input").value = "";
  uploadedBase64 = "";
  document.getElementById("pre-view-box").classList.add("hidden");
  document.getElementById("file-label").innerText = "Загрузить фото";

  tg.showAlert("Отправлено на проверку!");
  showPage("home");
}

function openProduct(ad) {
  const modal = document.getElementById("product-modal");
  const inner = document.getElementById("product-details-inner");

  inner.innerHTML = `
        <img src="${ad.img}" class="pd-image">
        <div class="pd-content">
            <div class="pd-stats">
                <span>Показы: 81 511</span>
                <div><i class="fa fa-eye"></i> ${
                  ad.views
                } <i class="fa fa-heart" style="margin-left:10px;"></i> 12</div>
            </div>
            <div class="pd-price">${ad.price} KGS</div>
            <div class="pd-title">${ad.title}</div>
            
            <div class="pd-actions">
                <a href="https://t.me/${ad.tgNick.replace(
                  "@",
                  ""
                )}" target="_blank" class="btn-pd-write">Написать</a>
                <a href="tel:${ad.phone}" class="btn-pd-call">Позвонить</a>
            </div>

            <p style="color:var(--gray); font-size:14px;">Доставка: Бесплатная доставка по городу</p>
            <div style="margin:20px 0; line-height:1.6; color:#ddd;">${
              ad.desc
            }</div>

            <button class="btn-track"><i class="fa fa-heart"></i> Отслеживать объявление</button>

            <div class="pd-seller">
                <div class="ps-avatar"></div>
                <div>
                    <b>${ad.userName}</b><br>
                    <small style="color:var(--gray);">Отвечает на 100% сообщений</small>
                </div>
            </div>
        </div>
    `;
  modal.classList.remove("hidden");
}

function closeProduct() {
  document.getElementById("product-modal").classList.add("hidden");
}

function showPage(pageId) {
  document.querySelectorAll(".page").forEach((p) => p.classList.add("hidden"));
  document.getElementById(`page-${pageId}`).classList.remove("hidden");
  document
    .querySelectorAll(".nav-item")
    .forEach((n) => n.classList.remove("active"));
  if (pageId !== "add")
    document.getElementById(`n-${pageId}`).classList.add("active");
  if (pageId === "home") renderFeed();
  if (pageId === "profile") renderProfileAds();
  tg.HapticFeedback.impactOccurred("light");
}

function filterByCat(cat, el) {
  currentCategory = cat;
  document
    .querySelectorAll(".cat-chip")
    .forEach((c) => c.classList.remove("active"));
  el.classList.add("active");
  renderFeed();
}

function clearFavs() {
  favorites = [];
  localStorage.setItem("favs_final_v4", JSON.stringify(favorites));
  renderFavs();
}

function switchProfileTab(t, el) {
  document
    .querySelectorAll(".p-tab")
    .forEach((item) => item.classList.remove("active"));
  el.classList.add("active");
  renderProfileAds();
}

function renderProfileAds() {
  const grid = document.getElementById("my-ads-grid");
  grid.innerHTML = '<div class="error-container">Ничего не найдено</div>';
}
