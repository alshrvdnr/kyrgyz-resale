const tg = window.Telegram.WebApp;
tg.expand();

// FIREBASE CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyCxaC3C9dx6IEhXWH9eATdKZO8SCRYe33I",
  authDomain: "gifts-kg.firebaseapp.com",
  databaseURL: "https://gifts-kg-default-rtdb.firebaseio.com",
  projectId: "gifts-kg",
  storageBucket: "gifts-kg.firebasestorage.app",
  messagingSenderId: "419866659643",
  appId: "1:419866659643:web:2332c8856698705780451e",
  measurementId: "G-DH7RXQZ6Y3",
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.database();

const IMGBB_KEY = "94943ea3f656b4bc95e25c86d2880b94";
const catMap = {
  flowers: "Цветы",
  jewelry: "Ювелирка",
  gifts: "Подарки",
  certs: "Сертификаты",
  Все: "Все",
};
const catTitles = {
  Все: "Свежие предложения",
  flowers: "Свежие цветы",
  gifts: "Свежие подарки",
  jewelry: "Свежая ювелирка",
  certs: "Свежие сертификаты",
};

let ads = [];
let favs = JSON.parse(localStorage.getItem("favs_v15")) || [];
let curCat = "Все",
  curCity = "Бишкек",
  selectedTariff = "standard",
  editingId = null,
  selectedFiles = [],
  profTab = "active";
let currentManageId = null,
  holidayMode = false,
  receiptAttached = false,
  currentQrUrl = "";

document.addEventListener("DOMContentLoaded", () => {
  initUser();
  listenSettings();
  listenAds();
  document.getElementById("main-search").addEventListener("keypress", (e) => {
    if (e.key === "Enter") startSearch(e.target.value);
  });
});

function initUser() {
  const user = tg.initDataUnsafe?.user || { first_name: "Гость", id: 0 };
  const initial = user.first_name ? user.first_name[0].toUpperCase() : "?";
  document.getElementById("u-avatar-top").innerText = initial;
  document.getElementById("u-avatar-big").innerText = initial;
  document.getElementById("u-name").innerText = user.first_name || "Гость";
}

function listenSettings() {
  db.ref("settings").on("value", (snap) => {
    const dataFromFirebase = snap.val(); // Получаем данные
    console.log("ДАННЫЕ ИЗ БАЗЫ:", dataFromFirebase); // ВЫВОДИМ В КОНСОЛЬ

    const s = dataFromFirebase || {};
    holidayMode = s.holiday_mode || false;
    currentQrUrl = s.qr_url || "";
    applyHolidayUI();
  });
}

function applyHolidayUI() {
  const tBlock = document.getElementById("tariff-block");
  const vBlock = document.getElementById("vip-block");
  const qrImg = document.getElementById("qr-display");
  if (qrImg) qrImg.src = currentQrUrl;
  if (holidayMode) {
    tBlock.classList.add("hidden");
    vBlock.classList.remove("hidden");
    document.getElementById("vip-promo-text").innerText =
      "Сегодня праздничный день. Все объявления платные.";
  } else {
    tBlock.classList.remove("hidden");
    if (selectedTariff !== "vip") vBlock.classList.add("hidden");
    else vBlock.classList.remove("hidden");
  }
}

function listenAds() {
  db.ref("ads").on("value", (snap) => {
    const data = snap.val();
    ads = data
      ? Object.keys(data).map((key) => ({ id: key, ...data[key] }))
      : [];
    renderFeed();
    renderProfile();
  });
}

// КАРУСЕЛЬ И ЛОГИКА КОНТАКТОВ
function openProduct(ad) {
  const modal = document.getElementById("product-modal");
  const isSold = ad.status === "sold";
  const isFav = favs.includes(ad.id);
  const dateStr = formatRelativeDate(ad.approvedAt);

  // Ссылка для кнопки
  let contactLink = ad.tgNick
    ? `https://t.me/${ad.tgNick.replace("@", "")}`
    : `https://wa.me/${ad.phone ? ad.phone.replace(/[^0-9]/g, "") : ""}`;

  let dots = ad.img
    ? ad.img
        .map(
          (_, i) =>
            `<div class="dot ${i === 0 ? "active" : ""}" id="dot-${
              ad.id
            }-${i}"></div>`
        )
        .join("")
    : "";

  document.getElementById("pv-content").innerHTML = `
    <div class="modal-carousel-container">
      <i class="fa fa-arrow-left" onclick="closeProduct()" style="position:absolute; top:20px; left:20px; z-index:100; background:rgba(0,0,0,0.5); padding:10px; border-radius:50%;"></i>
      <i class="fa-solid fa-heart" onclick="toggleFav('${
        ad.id
      }')" style="position:absolute; top:20px; right:20px; z-index:100; font-size:24px; color:${
    isFav ? "var(--yellow-main)" : "#fff"
  }"></i>
      <div class="product-gallery-slider" id="slider-${ad.id}">
        ${ad.img ? ad.img.map((src) => `<img src="${src}">`).join("") : ""}
      </div>
      <div class="carousel-dots">${dots}</div>
    </div>

    <div style="padding:20px;">
      <!-- ВЕРХНИЙ БЛОК -->
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:15px;">
        <div style="font-size:28px; font-weight:800; color:var(--yellow-main); line-height:1;">
          ${ad.price} KGS
        </div>
        
        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:5px;">
          <!-- Просто дата публикации без лишних слов -->
          <div style="color:var(--gray); font-size:11px;">${dateStr}</div>
          <!-- Аккуратная рамка поступления -->
          <div style="font-size:11px; color:#4cd964; font-weight:bold; background:rgba(76,217,100,0.1); padding:4px 8px; border-radius:6px; border:1px solid rgba(76,217,100,0.2);">
            Поступление: ${ad.receiveDate || "—"}
          </div>
        </div>
      </div>

      <div style="margin-bottom:20px; font-size:16px; line-height:1.4;">
        <b style="color:#fff;">${catMap[ad.cat] || "Товар"}</b> — ${ad.title}
      </div>
      
      ${
        isSold
          ? `<div style="background:#333; padding:15px; border-radius:12px; color:#ff3b30; text-align:center; font-weight:bold;">Информация скрыта, так как товар продан</div>`
          : `
          <a href="${contactLink}" class="btn-premium-unity" style="text-decoration:none; margin-bottom:20px;">Написать продавцу</a>

          <div style="background:#2c2c2e; padding:15px; border-radius:12px; margin:20px 0; white-space: pre-wrap; line-height:1.5; color:#efeff4; font-size:15px;">${
            ad.desc || "Нет описания"
          }</div>

          <!-- БЛОК КОНТАКТОВ -->
          <div style="background:#1c1c1e; padding:18px; border-radius:15px; border:1px solid #333; display:flex; flex-direction:column; gap:15px;">
             
             <!-- Локация -->
             <div style="display:flex; align-items:center; gap:12px;">
                <i class="fa-solid fa-location-dot" style="color:#ff3b30; font-size:18px; width:20px; text-align:center;"></i>
                <div style="font-size:14px; color:#ccc;">${ad.city}, ${
              ad.address || "—"
            }</div>
             </div>

             <!-- Телефон -->
             <div style="display:flex; align-items:center; gap:12px;">
                <i class="fa-solid fa-phone" style="color:var(--yellow-main); font-size:16px; width:20px; text-align:center;"></i>
                <div style="font-size:15px; font-weight:bold; color:#fff;">${
                  ad.phone || "—"
                }</div>
             </div>

             <!-- Telegram (Убрал слово Telegram, оставил только иконку и ник) -->
             ${
               ad.tgNick
                 ? `
             <div style="display:flex; align-items:center; gap:12px;">
                <i class="fa-brands fa-telegram" style="color:#0088cc; font-size:20px; width:20px; text-align:center;"></i>
                <div style="font-size:15px; font-weight:bold; color:#fff;">${ad.tgNick}</div>
             </div>
             `
                 : ""
             }

          </div>
        `
      }
    </div>`;

  // Логика слайдера
  const slider = document.getElementById(`slider-${ad.id}`);
  if (slider) {
    slider.onscroll = () => {
      let idx = Math.round(slider.scrollLeft / slider.offsetWidth);
      const allDots = document.querySelectorAll(`[id^="dot-${ad.id}"]`);
      allDots.forEach((d, i) => d.classList.toggle("active", i === idx));
    };
  }
  modal.classList.remove("hidden");
  tg.BackButton.show();
  tg.BackButton.onClick(closeProduct);
}

// ПАРАЛЛЕЛЬНАЯ ЗАГРУЗКА
async function publishAndSend() {
  const title = document.getElementById("in-title").value;
  const price = document.getElementById("in-price").value;
  const btn = document.querySelector(".btn-premium-unity");
  if (!title || !price) return alert("Заполни поля!");

  if (editingId) {
    // Сохраняем измененные данные
    await db.ref("ads/" + editingId).update({
      title: title,
      price: price,
      address: document.getElementById("in-address").value,
      phone: document.getElementById("in-wa").value, // Сохраняем новый телефон
      desc: document.getElementById("in-desc").value,
    });
    resetAddForm();
    showPage("home");
    return;
  }

  const isVipNeeded = selectedTariff === "vip" || holidayMode;
  if (isVipNeeded && !receiptAttached) return alert("Нужно прикрепить чек!");

  btn.disabled = true;
  btn.innerText = "ЗАГРУЗКА...";

  try {
    let receiptUrl = isVipNeeded
      ? await uploadToImgBB(document.getElementById("receipt-input").files[0])
      : null;
    const imgs = await Promise.all(
      selectedFiles.map((file) => uploadToImgBB(file))
    );

    const newAd = {
      title,
      price,
      cat: document.getElementById("in-cat").value,
      city: document.getElementById("in-city").value,
      address: document.getElementById("in-address").value,
      phone: document.getElementById("in-wa").value,
      tgNick: document.getElementById("in-tg").value,
      desc: document.getElementById("in-desc").value,
      receiveDate: document.getElementById("in-receive-date").value,
      img: imgs.filter((i) => i !== null),
      receipt_url: receiptUrl,
      status: "pending",
      tariff: selectedTariff,
      userId: tg.initDataUnsafe?.user?.id || 0,
      createdAt: Math.floor(Date.now() / 1000),
    };

    await db.ref("ads").push(newAd);
    alert("Отправлено на модерацию!");
    resetAddForm();
    showPage("home");
  } catch (e) {
    alert("Ошибка!");
  } finally {
    btn.disabled = false;
    btn.innerText = "Опубликовать";
  }
}

function startSearch(val) {
  if (!val) return;
  const results = ads.filter(
    (ad) =>
      ad.title.toLowerCase().includes(val.toLowerCase()) &&
      ad.status !== "deleted"
  );
  const container = document.getElementById("search-results-area");
  container.innerHTML = "";
  results.forEach((ad) => container.appendChild(createAdCard(ad)));
  document.getElementById("search-results-page").classList.remove("hidden");
}

function cancelAdd() {
  resetAddForm();
  showPage("home");
}
function resetAddForm() {
  editingId = null;
  selectedFiles = [];
  receiptAttached = false;
  document.querySelectorAll(".main-input").forEach((i) => (i.value = ""));
  document.getElementById("gallery-preview").innerHTML = "";
  document.getElementById("receipt-label").innerText = "Добавить чек";
  [
    // СЮДА НЕЛЬЗЯ ПИСАТЬ "tariff-block"
    "file-group",
    "cat-group",
    "city-group",
    "date-group",
    "tg-group",
    "phone-group",
    "desc-group",
  ].forEach((id) => document.getElementById(id).classList.remove("hidden"));

  // ДОБАВЛЯЕМ ЭТУ СТРОЧКУ ЗДЕСЬ:
  applyHolidayUI();
}

// ОСТАЛЬНЫЕ ФУНКЦИИ (БЕЗ СОКРАЩЕНИЙ)
function renderFeed() {
  const grid = document.getElementById("home-grid");
  if (!grid) return;
  grid.innerHTML = "";
  let filtered = ads.filter(
    (ad) =>
      (curCat === "Все" || ad.cat === curCat) &&
      ad.city === curCity &&
      ad.status !== "deleted" &&
      ad.status !== "pending" &&
      ad.status !== "rejected"
  );
  filtered.sort((a, b) => {
    // 1. Проданные всегда в самый низ
    if (a.status !== b.status) {
      return a.status === "sold" ? 1 : -1;
    }

    // 2. Если оба активны, VIP ставим выше обычных
    if (a.tariff !== b.tariff) {
      return a.tariff === "vip" ? -1 : 1;
    }

    // 3. Если тарифы одинаковые, свежие ставим выше (по дате создания)
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
  filtered.forEach((ad) => grid.appendChild(createAdCard(ad)));
}
function createAdCard(ad, isProfile = false) {
  const isFav = favs.includes(ad.id);
  const isSold = ad.status === "sold";
  const isDeleted = ad.status === "deleted";
  const isVip = ad.tariff === "vip" && !isSold;
  const card = document.createElement("div");
  card.className = `card ${isVip ? "card-vip" : ""} ${
    isDeleted ? "card-deleted" : ""
  }`;
  card.onclick = () => openProduct(ad);
  card.innerHTML = `${
    isSold || isDeleted ? '<div class="sold-badge">ПРОДАНО</div>' : ""
  } ${isVip ? '<div class="vip-badge">VIP</div>' : ""} ${
    !isProfile
      ? `<div class="fav-heart-btn ${
          isFav ? "active" : ""
        }" onclick="toggleFav('${
          ad.id
        }', event)"><i class="fa-solid fa-heart"></i></div>`
      : ""
  } <img src="${
    ad.img ? ad.img[0] : ""
  }" loading="lazy"> <div style="padding:10px;"> <div style="color:var(--yellow-main); font-weight:bold; font-size:16px;">${
    ad.price
  } KGS</div> <div style="font-size:12px; color:#ccc;">${ad.title}</div> ${
    isProfile && ad.status === "active"
      ? `<button onclick="event.stopPropagation(); openManageModal('${ad.id}')" style="width:100%; background:var(--yellow-main); color:#000; border:none; padding:8px; border-radius:8px; font-size:11px; font-weight:bold; margin-top:8px;">Управление</button>`
      : ""
  } </div>`;
  return card;
}
function handleFileSelect(i) {
  selectedFiles = Array.from(i.files).slice(0, 5);
  const p = document.getElementById("gallery-preview");
  p.innerHTML = "";
  selectedFiles.forEach((f) => {
    const r = new FileReader();
    r.onload = (e) => {
      const img = document.createElement("img");
      img.src = e.target.result;
      img.style.width = "60px";
      img.style.height = "60px";
      img.style.objectFit = "cover";
      img.style.borderRadius = "8px";
      p.appendChild(img);
    };
    r.readAsDataURL(f);
  });
}
function filterByCat(c, el) {
  curCat = c;
  document
    .querySelectorAll(".cat-card")
    .forEach((i) => i.classList.remove("active"));
  el.classList.add("active");
  document.getElementById("dynamic-feed-title").innerText =
    catTitles[c] || "Свежие предложения";
  renderFeed();
}
function selectCity(c) {
  curCity = c;
  document.getElementById("current-city-label").innerText = c;
  toggleCitySelector();
  renderFeed();
}
function toggleCitySelector() {
  document.getElementById("city-selector").classList.toggle("hidden");
}
function toggleFav(id, event) {
  if (event) event.stopPropagation();
  favs = favs.includes(id) ? favs.filter((f) => f !== id) : [...favs, id];
  localStorage.setItem("favs_v15", JSON.stringify(favs));
  renderFeed();
}
function selectTariff(t) {
  selectedTariff = t;
  document.getElementById("tariff-std").className =
    "tariff-card-box" + (t === "standard" ? " active-std" : "");
  document.getElementById("tariff-vip").className =
    "tariff-card-box" + (t === "vip" ? " active-vip" : "");
  applyHolidayUI();
}
function handleReceiptSelect(i) {
  if (i.files[0]) {
    receiptAttached = true;
    document.getElementById("receipt-label").innerText = "Чек добавлен ✅";
  }
}
async function uploadToImgBB(file) {
  if (!file) return null;
  const fd = new FormData();
  fd.append("image", file);
  const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, {
    method: "POST",
    body: fd,
  });
  const data = await res.json();
  return data.success ? data.data.url : null;
}
function showPage(p) {
  document.querySelectorAll(".page").forEach((s) => s.classList.add("hidden"));
  document.getElementById(`page-${p}`).classList.remove("hidden");
  if (p === "favs") renderFavs();
  if (p === "add" && !editingId) resetAddForm();
  if (p === "profile") renderProfile();
}
function openManageModal(id) {
  currentManageId = id;
  const ad = ads.find((a) => a.id === id);
  if (ad)
    document.getElementById("manage-info").innerHTML = `Название: <b>${
      ad.title
    }</b><br>Телефон: <b>${ad.phone || "—"}</b><br>Адрес: <b>${
      ad.address || "—"
    }</b>`;
  document.getElementById("manage-modal").classList.remove("hidden");
}
function confirmAction(type) {
  document.getElementById("manage-modal").classList.add("hidden");
  const modal = document.getElementById("confirm-modal");
  if (type === "sold") {
    document.getElementById("confirm-text").innerText =
      "Объявление будет убрано в архив.";
    document.getElementById("confirm-btn-final").onclick = () => {
      db.ref("ads/" + currentManageId).update({ status: "sold" });
      closeConfirmModal();
    };
  } else {
    document.getElementById("confirm-text").innerText =
      "Объявление уйдёт с сайта навсегда.";
    document.getElementById("confirm-btn-final").onclick = () => {
      db.ref("ads/" + currentManageId).update({ status: "deleted" });
      closeConfirmModal();
    };
  }
  modal.classList.remove("hidden");
}
function startAdEdit() {
  const ad = ads.find((a) => a.id === currentManageId);
  if (!ad) return;

  editingId = currentManageId;
  showPage("add"); // Открываем страницу формы

  // Меняем заголовок, чтобы юзер понимал, что он редактирует
  document.getElementById("add-title-text").innerText = "Редактирование";

  // СКРЫВАЕМ блоки, которые не нужны при редактировании
  document.getElementById("tariff-block").classList.add("hidden");
  document.getElementById("vip-block").classList.add("hidden"); // Убираем чек и QR
  document.getElementById("file-group").classList.add("hidden"); // Фото менять нельзя
  document.getElementById("cat-group").classList.add("hidden");
  document.getElementById("city-group").classList.add("hidden");
  document.getElementById("date-group").classList.add("hidden");

  // ПОКАЗЫВАЕМ поле телефона и описания
  document.getElementById("phone-group").classList.remove("hidden");
  document.getElementById("desc-group").classList.remove("hidden");

  // ЗАПОЛНЯЕМ поля текущими данными из базы
  document.getElementById("in-title").value = ad.title || "";
  document.getElementById("in-price").value = ad.price || "";
  document.getElementById("in-address").value = ad.address || "";
  document.getElementById("in-wa").value = ad.phone || ""; // Теперь телефон подтягивается
  document.getElementById("in-desc").value = ad.desc || "";

  closeManageModal();
}
function closeProduct() {
  document.getElementById("product-modal").classList.add("hidden");
  tg.BackButton.hide();
}
function closeManageModal() {
  document.getElementById("manage-modal").classList.add("hidden");
}
function closeConfirmModal() {
  document.getElementById("confirm-modal").classList.add("hidden");
}
function closeSearch() {
  document.getElementById("search-results-page").classList.add("hidden");
}
function clearFavs() {
  favs = [];
  localStorage.setItem("favs_v15", "[]");
  renderFavs();
  renderFeed();
}
function renderProfile() {
  const grid = document.getElementById("my-ads-grid");
  if (!grid) return;
  grid.innerHTML = "";
  const myId = tg.initDataUnsafe?.user?.id || 0;
  const filtered = ads.filter(
    (ad) =>
      ad.userId === myId &&
      (profTab === "active" ? ad.status === "active" : ad.status === "sold")
  );
  filtered.forEach((ad) => grid.appendChild(createAdCard(ad, true)));
}
function renderFavs() {
  const container = document.getElementById("favs-content-area");
  const filtered = ads.filter((ad) => favs.includes(ad.id));
  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-favs-center"><div style="width:80px; height:80px; background:#2c2c2e; border-radius:20px; display:flex; align-items:center; justify-content:center; margin-bottom:20px; color:var(--yellow-main); font-size:32px;"><i class="fa-solid fa-heart"></i></div><h3 style="margin:0 0 10px 0;">У вас пока нет избранных объявлений</h3><button class="btn-premium-unity" style="width:auto; padding:12px 40px;" onclick="showPage('home')">Поиск</button></div>`;
  } else {
    container.innerHTML = '<div class="listings-grid" id="fav-grid"></div>';
    filtered.forEach((ad) =>
      document.getElementById("fav-grid").appendChild(createAdCard(ad))
    );
  }
}
function switchProfileTab(t) {
  profTab = t;
  document
    .getElementById("tab-active")
    .classList.toggle("active", t === "active");
  document
    .getElementById("tab-archive")
    .classList.toggle("active", t === "archive");
  renderProfile();
}

function formatRelativeDate(timestamp) {
  if (!timestamp) return "На проверке";

  const date = new Date(timestamp * 1000);
  const now = new Date();

  // Проверка на "Сегодня"
  const isToday = date.toDateString() === now.toDateString();

  // Проверка на "Вчера"
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) return "Сегодня";
  if (isYesterday) return "Вчера";

  // Если не сегодня и не вчера — возвращаем дату (например, 20.02.2026)
  return date.toLocaleDateString();
}
