const tg = window.Telegram.WebApp;
tg.expand();

// ---------------------------------------------------------
// НАСТРОЙКИ
// ---------------------------------------------------------
const IMGBB_KEY = "94943ea3f656b4bc95e25c86d2880b94";
const BOT_TOKEN = "8399814024:AAEla8xBVk_9deHydJV0hrc5QYDyXAFpZ8k";
const ADMIN_ID = "1615492914";

const catMap = {
  flowers: "Цветы",
  jewelry: "Ювелирка",
  gifts: "Подарки",
  certs: "Сертификаты",
  Все: "Все",
};

// ---------------------------------------------------------
// ДАННЫЕ
// ---------------------------------------------------------
let ads = JSON.parse(localStorage.getItem("gifts_final_v12")) || [];
let favs = JSON.parse(localStorage.getItem("favs_final_v12")) || [];

// Состояние редактирования
let editingId = null;

// Состояние фильтров
let curCat = "Все";
let curCity = "Все";
let curMainTab = "rec";
let filterSort = "default";

let currentProfileTab = "active";
let selectedFiles = [];
let selectedReceipt = null;
let selectedTariff = "standard";

document.addEventListener("DOMContentLoaded", () => {
  initUser();
  renderFeed();
});

function initUser() {
  const user = tg.initDataUnsafe?.user || { first_name: "Пользователь", id: 0 };
  if (document.getElementById("u-name"))
    document.getElementById("u-name").innerText = user.first_name;
  if (document.getElementById("u-avatar"))
    document.getElementById("u-avatar").innerText = user.first_name[0];
}

// ---------------------------------------------------------
// ПОИСК И ЛЕНТА
// ---------------------------------------------------------
function handleSearch(e) {
  if (e.key === "Enter") {
    const query = e.target.value.toLowerCase();
    const results = ads.filter((a) => a.title.toLowerCase().includes(query));
    renderFeedInternal(results, "results-grid");
    showPage("results");
    e.target.blur();
  }
}

function switchMainTab(tab) {
  curMainTab = tab;
  document.getElementById("mtab-rec").classList.toggle("active", tab === "rec");
  document.getElementById("mtab-new").classList.toggle("active", tab === "new");
  renderFeed();
}

function renderFeed(data = ads) {
  renderFeedInternal(data, "home-grid");
}

function renderFeedInternal(data, gridId) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  grid.innerHTML = "";

  let filtered = data.filter((ad) => {
    const catMatch = curCat === "Все" || ad.cat === curCat;
    const cityMatch = curCity === "Все" || ad.city === curCity;
    return catMatch && cityMatch;
  });

  const now = Date.now();
  filtered.sort((a, b) => {
    const getRank = (item) => {
      if (item.status === "sold" || item.status === "deleted") return 2;
      if (item.tariff === "vip" && item.vipTill > now) return 0;
      return 1;
    };
    const rankA = getRank(a);
    const rankB = getRank(b);
    if (rankA !== rankB) return rankA - rankB;
    if (filterSort === "cheap")
      return parseFloat(a.price) - parseFloat(b.price);
    if (filterSort === "expensive")
      return parseFloat(b.price) - parseFloat(a.price);
    return b.id - a.id;
  });

  filtered.forEach((ad) => {
    grid.appendChild(createAdCard(ad));
  });
}

function createAdCard(ad) {
  const catName = catMap[ad.cat] || "Товар";
  let coverImg = Array.isArray(ad.img) ? ad.img[0] : ad.img;
  const isSold = ad.status === "sold";
  const isDeleted = ad.status === "deleted";
  const timeStr = ad.id
    ? new Date(ad.id).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  let badgeHTML = "";
  if (isDeleted || isSold) badgeHTML = `<div class="sold-badge">ПРОДАНО</div>`;
  else if (ad.tariff === "vip" && ad.vipTill > Date.now())
    badgeHTML = `<div class="vip-badge">VIP</div>`;

  let imageHTML = isDeleted
    ? `${badgeHTML}<div class="deleted-placeholder"><span class="deleted-text">Фото скрыто<br>конфиденциально</span></div>`
    : `${badgeHTML}<img src="${coverImg}" loading="lazy" style="height:140px; object-fit:cover; width:100%;">`;

  const isFav = favs.includes(ad.id);
  const heartColor = isFav ? "var(--pink)" : "white";
  const heartClass = isFav ? "fa-solid" : "fa-regular";

  let dateStr = ad.dateReceived
    ? new Date(ad.dateReceived).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "numeric",
        year: "2-digit",
      })
    : "-";

  const card = document.createElement("div");
  card.className = "card";
  card.onclick = () => openProduct(ad);

  // Кнопки управления в зависимости от статуса
  let actionsHTML = "";
  const myId = tg.initDataUnsafe?.user?.id || 0;
  if (ad.userId === myId) {
    if (ad.status === "active") {
      actionsHTML = `
        <div class="profile-actions">
            <button class="btn-mini btn-edit" onclick="event.stopPropagation(); editAd(${ad.id})">Изменить</button>
            <button class="btn-mini btn-sold-action" onclick="event.stopPropagation(); markAsSold(${ad.id})">Продано</button>
        </div>`;
    } else if (ad.status === "sold") {
      actionsHTML = `
        <div class="profile-actions">
            <button class="btn-mini btn-edit" style="background:#ff3b30; color:white; flex:1;" onclick="event.stopPropagation(); deleteAd(${ad.id})">Удалить</button>
        </div>`;
    }
  }

  card.innerHTML = `
      <button class="card-fav-btn" onclick="toggleFavCard(event, ${ad.id})">
         <i class="${heartClass} fa-heart" style="color:${heartColor}"></i>
      </button>
      ${imageHTML}
      <div class="card-body">
        <div class="card-price-row">
            <span class="card-price">${ad.price} KGS</span>
            <span class="card-time">${timeStr}</span>
        </div>
        <div class="card-cat-row">
            <span class="card-category">${catName}</span> ${ad.title}
        </div>
        <div class="card-date-block">
            <span class="date-label">Дата получения</span>
            <span class="date-value">${dateStr}</span>
        </div>
        ${actionsHTML}
      </div>`;
  return card;
}

// ---------------------------------------------------------
// ЛОГИКА ПРОДАЖИ И УДАЛЕНИЯ
// ---------------------------------------------------------
function markAsSold(id) {
  tg.showConfirm(
    "Вы точно уверены нажать «Продано», потому что объявление исчезнет из активных?",
    (ok) => {
      if (ok) {
        const idx = ads.findIndex((a) => a.id === id);
        if (idx !== -1) {
          ads[idx].status = "sold";
          localStorage.setItem("gifts_final_v12", JSON.stringify(ads));
          renderFeed();
          renderProfileAds();
        }
      }
    }
  );
}

function deleteAd(id) {
  const idx = ads.findIndex((a) => a.id === id);
  if (idx !== -1) {
    ads[idx].status = "deleted";
    localStorage.setItem("gifts_final_v12", JSON.stringify(ads));
    renderFeed();
    renderProfileAds();
  }
}

// ---------------------------------------------------------
// ЛОГИКА РЕДАКТИРОВАНИЯ
// ---------------------------------------------------------
function editAd(id) {
  const ad = ads.find((a) => a.id === id);
  if (!ad) return;

  editingId = id;
  showPage("add");

  document.getElementById("add-page-title").innerText = "Редактирование";
  document.getElementById("btn-publish-main").innerText = "Сохранить изменения";
  document.getElementById("add-tariff-block").style.display = "none"; // Нельзя менять тариф при редактировании

  document.getElementById("in-title").value = ad.title;
  document.getElementById("in-price").value = ad.price;
  document.getElementById("in-date").value = ad.dateReceived;
  document.getElementById("in-wa").value = ad.phone;
  document.getElementById("in-address").value = ad.address;
  document.getElementById("in-tg").value = ad.tgNick;
  document.getElementById("in-city").value = ad.city;
  document.getElementById("in-cat").value = ad.cat;
  document.getElementById("in-desc").value = ad.desc || "";
}

function cancelEditOrGoHome() {
  editingId = null;
  document.getElementById("add-page-title").innerText = "Новое объявление";
  document.getElementById("btn-publish-main").innerText = "Опубликовать";
  document.getElementById("add-tariff-block").style.display = "flex";
  showPage("home");
}

// ---------------------------------------------------------
// ОТПРАВКА И СОХРАНЕНИЕ
// ---------------------------------------------------------
async function publishAndSend() {
  const title = document.getElementById("in-title").value;
  const price = document.getElementById("in-price").value;
  const date = document.getElementById("in-date").value;
  const wa = document.getElementById("in-wa").value;
  const addr = document.getElementById("in-address").value;
  const tgNick = document.getElementById("in-tg").value;
  const city = document.getElementById("in-city").value;
  const cat = document.getElementById("in-cat").value;
  const desc = document.getElementById("in-desc").value;

  if (!title || !price || !date)
    return tg.showAlert("Заполните основные поля!");

  tg.MainButton.showProgress();
  tg.MainButton.show();

  let finalImg = [];
  if (editingId) {
    const oldAd = ads.find((a) => a.id === editingId);
    finalImg = oldAd.img;
  }

  // Если выбраны новые фото
  if (selectedFiles.length > 0) {
    finalImg = [];
    for (let file of selectedFiles) {
      const url = await uploadToImgBB(file);
      if (url) finalImg.push(url);
    }
  }

  if (finalImg.length === 0) {
    tg.MainButton.hide();
    return tg.showAlert("Нужно хотя бы 1 фото!");
  }

  if (editingId) {
    const idx = ads.findIndex((a) => a.id === editingId);
    ads[idx] = {
      ...ads[idx],
      title,
      price,
      dateReceived: date,
      phone: wa,
      address: addr,
      tgNick,
      city,
      cat,
      desc,
      img: finalImg,
    };
    editingId = null;
  } else {
    const ad = {
      id: Date.now(),
      title,
      price,
      dateReceived: date,
      phone: wa,
      address: addr,
      tgNick,
      city,
      cat,
      desc,
      img: finalImg,
      status: "active",
      userId: tg.initDataUnsafe?.user?.id || 0,
      tariff: selectedTariff,
      vipTill: selectedTariff === "vip" ? Date.now() + 259200000 : 0,
    };
    ads.unshift(ad);
    await sendToBot(ad);
  }

  localStorage.setItem("gifts_final_v12", JSON.stringify(ads));
  resetForm();
  tg.MainButton.hide();
  showPage("home");
}

function resetForm() {
  document.querySelectorAll(".main-input").forEach((i) => (i.value = ""));
  selectedFiles = [];
  document.getElementById("gallery-preview").innerHTML = "";
  document.getElementById("preview-box").classList.add("hidden");
  document.getElementById("add-page-title").innerText = "Новое объявление";
  document.getElementById("btn-publish-main").innerText = "Опубликовать";
  document.getElementById("add-tariff-block").style.display = "flex";
}

// ---------------------------------------------------------
// МОДАЛКА (МАКЕТ ПОСТА)
// ---------------------------------------------------------
function openProduct(ad) {
  const modal = document.getElementById("product-modal");
  const favIconArea = document.getElementById("modal-fav-icon");
  const isFav = favs.includes(ad.id);
  const catName = catMap[ad.cat] || "Товар";
  const images = Array.isArray(ad.img) ? ad.img : [ad.img];

  favIconArea.innerHTML = `<i class="${
    isFav ? "fa-solid" : "fa-regular"
  } fa-heart" style="color:var(--pink); font-size:22px;" onclick="toggleFav(${
    ad.id
  })"></i>`;

  let galleryHTML =
    ad.status === "deleted"
      ? `<div class="deleted-placeholder" style="height:350px">Фото скрыто для конфиденциальности</div>`
      : `<div class="product-gallery">${images
          .map((s) => `<img src="${s}">`)
          .join("")}</div>`;

  document.getElementById("pv-content").innerHTML = `
    ${galleryHTML}
    <div class="pd-body">
        <div class="pd-price">${ad.price} KGS</div>
        <div class="pd-title" style="margin-bottom:15px; font-size:18px;">${catName} — ${
    ad.title
  }</div>
        
        <a href="https://t.me/${
          ad.tgNick
        }" class="pd-btn-write">Написать продавцу</a>

        <div class="desc-header">Описание</div>
        <p style="margin-bottom:20px; color:#ddd; font-size:14px; line-height:1.4;">${
          ad.desc || "Нет описания"
        }</p>

        <div class="info-cell">
            <span class="info-cell-label">Город</span>
            <span class="info-cell-value">${ad.city}</span>
        </div>
        <div class="info-cell">
            <span class="info-cell-label">Адрес</span>
            <span class="info-cell-value">${ad.address || "Не указан"}</span>
        </div>
        <div class="info-cell">
            <span class="info-cell-label">Дата получения</span>
            <span class="info-cell-value">${ad.dateReceived}</span>
        </div>
        <div class="info-cell">
            <span class="info-cell-label">Связь (Telegram / Телефон)</span>
            <span class="info-cell-value">@${ad.tgNick} <br> ${
    ad.phone || "—"
  }</span>
        </div>
    </div>`;

  modal.classList.remove("hidden");
  tg.BackButton.show();
  tg.BackButton.onClick(closeProduct);
}

function closeProduct() {
  document.getElementById("product-modal").classList.add("hidden");
  tg.BackButton.hide();
}

// ---------------------------------------------------------
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (БЕЗ ИЗМЕНЕНИЙ)
// ---------------------------------------------------------
function toggleFavCard(e, id) {
  e.stopPropagation();
  toggleFav(id);
}

function toggleFav(id) {
  favs = favs.includes(id) ? favs.filter((f) => f !== id) : [...favs, id];
  localStorage.setItem("favs_final_v12", JSON.stringify(favs));
  renderFeed();
  renderFavs();
}

function switchProfileTab(tab) {
  currentProfileTab = tab;
  document
    .getElementById("p-tab-active")
    .classList.toggle("active", tab === "active");
  document
    .getElementById("p-tab-sold")
    .classList.toggle("active", tab === "sold");
  renderProfileAds();
}

function renderProfileAds() {
  const grid = document.getElementById("my-ads-grid");
  const myId = tg.initDataUnsafe?.user?.id || 0;
  const myAds = ads.filter(
    (a) =>
      a.userId === myId &&
      (currentProfileTab === "active"
        ? a.status === "active"
        : a.status === "sold" || a.status === "deleted")
  );
  grid.innerHTML = myAds.length
    ? ""
    : '<p style="text-align:center; padding:50px; color:gray;">Пусто</p>';
  myAds.forEach((ad) => grid.appendChild(createAdCard(ad)));
}

function filterByCat(c, el) {
  curCat = c;
  document
    .querySelectorAll(".category-row .cat-chip")
    .forEach((i) => i.classList.remove("active"));
  el.classList.add("active");
  renderFeed();
}
function filterByCity(c, el) {
  curCity = c;
  document
    .querySelectorAll(".city-row .cat-chip")
    .forEach((i) => i.classList.remove("active"));
  el.classList.add("active");
  renderFeed();
}

function selectTariff(t) {
  selectedTariff = t;
  document
    .getElementById("tariff-std")
    .classList.toggle("active", t === "standard");
  document.getElementById("tariff-vip").classList.toggle("active", t === "vip");
  document.getElementById("vip-block").classList.toggle("hidden", t !== "vip");
}

function handleFileSelect(input) {
  const files = Array.from(input.files);
  if (files.length > 0) {
    selectedFiles = files.slice(0, 5);
    const gallery = document.getElementById("gallery-preview");
    gallery.innerHTML = "";
    document.getElementById("preview-box").classList.remove("hidden");
    document.getElementById("photo-count").innerText = selectedFiles.length;
    selectedFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = document.createElement("img");
        img.src = e.target.result;
        gallery.appendChild(img);
      };
      reader.readAsDataURL(file);
    });
  }
}

function handleReceiptSelect(input) {
  if (input.files[0]) {
    selectedReceipt = input.files[0];
    document.getElementById("receipt-label").innerText = "Чек добавлен ✅";
  }
}

async function uploadToImgBB(file) {
  const formData = new FormData();
  formData.append("image", file);
  try {
    const response = await fetch(
      `https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`,
      { method: "POST", body: formData }
    );
    const data = await response.json();
    return data.success ? data.data.url : null;
  } catch {
    return null;
  }
}

async function sendToBot(ad) {
  let text = `📦 ${ad.title}\n💰 ${ad.price} KGS\n📍 ${ad.city}`;
  try {
    let media = ad.img.map((url, i) => ({
      type: "photo",
      media: url,
      caption: i === 0 ? text : "",
    }));
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMediaGroup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: ADMIN_ID, media: media }),
    });
  } catch (e) {}
}

function showPage(p) {
  document.querySelectorAll(".page").forEach((s) => s.classList.add("hidden"));
  document.getElementById(`page-${p}`).classList.remove("hidden");
  document
    .querySelectorAll(".nav-item")
    .forEach((i) => i.classList.remove("active"));
  if (document.getElementById(`n-${p}`))
    document.getElementById(`n-${p}`).classList.add("active");
  document.querySelector(".bottom-nav").style.display =
    p === "filter" || p === "add" ? "none" : "flex";
  if (p === "home") renderFeed();
  if (p === "favs") renderFavs();
  if (p === "profile") renderProfileAds();
}

function renderFavs() {
  const container = document.getElementById("favs-content-area");
  const data = ads.filter((a) => favs.includes(a.id));
  container.innerHTML = data.length
    ? `<div class="listings-grid"></div>`
    : `<p style="text-align:center; padding:50px; color:gray;">Пусто</p>`;
  if (data.length) {
    const grid = container.querySelector(".listings-grid");
    data.forEach((ad) => grid.appendChild(createAdCard(ad)));
  }
}

function clearFavs() {
  favs = [];
  localStorage.setItem("favs_final_v12", JSON.stringify(favs));
  renderFavs();
}
