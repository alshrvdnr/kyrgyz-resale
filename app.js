const tg = window.Telegram.WebApp;
tg.expand();

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
  receiptAttached = false;

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
    const s = snap.val() || {};
    holidayMode = s.holiday_mode || false;
    applyHolidayUI();
  });
}

function applyHolidayUI() {
  const tBlock = document.getElementById("tariff-block");
  const vBlock = document.getElementById("vip-block");
  if (holidayMode) {
    tBlock.classList.add("hidden");
    vBlock.classList.remove("hidden");
    document.getElementById("vip-promo-text").innerText =
      "Сегодня праздничный день. Все объявления платные.";
  } else {
    tBlock.classList.remove("hidden");
    if (selectedTariff !== "vip") vBlock.classList.add("hidden");
    else vBlock.classList.remove("hidden");
    document.getElementById("vip-promo-text").innerText =
      "VIP-объявление будет в ТОПе 3 дня.";
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

// КАРУСЕЛЬ С ТОЧКАМИ И СКРЫТИЕ ИНФО В SOLD
function openProduct(ad) {
  const modal = document.getElementById("product-modal");
  const isSold = ad.status === "sold";
  const isFav = favs.includes(ad.id);
  const dateStr = ad.approvedAt
    ? new Date(ad.approvedAt * 1000).toLocaleDateString()
    : "На проверке";

  let dots = ad.img
    .map(
      (_, i) =>
        `<div class="dot ${i === 0 ? "active" : ""}" id="dot-${
          ad.id
        }-${i}"></div>`
    )
    .join("");

  document.getElementById("pv-content").innerHTML = `
    <div class="modal-carousel-container">
      <i class="fa fa-arrow-left" onclick="closeProduct()" style="position:absolute; top:20px; left:20px; z-index:100; background:rgba(0,0,0,0.5); padding:10px; border-radius:50%;"></i>
      <i class="fa-solid fa-heart" onclick="toggleFav('${
        ad.id
      }')" style="position:absolute; top:20px; right:20px; z-index:100; font-size:24px; color:${
    isFav ? "var(--yellow-main)" : "#fff"
  }"></i>
      <div class="product-gallery-slider" id="slider-${ad.id}">
        ${ad.img.map((src) => `<img src="${src}">`).join("")}
      </div>
      <div class="carousel-dots">${dots}</div>
    </div>
    <div style="padding:20px;">
      <div style="font-size:28px; font-weight:800; color:var(--yellow-main);">${
        ad.price
      } KGS</div>
      <div style="margin:10px 0;"><b>${catMap[ad.cat]}</b> — ${ad.title}</div>
      
      ${
        isSold
          ? `<div style="background:#333; padding:15px; border-radius:12px; color:#ff3b30; text-align:center; font-weight:bold;">Информация скрыта, так как товар продан</div>`
          : `<a href="https://t.me/${ad.tgNick?.replace(
              "@",
              ""
            )}" class="btn-premium-unity" style="text-decoration:none;">Написать продавцу</a>`
      }

      <div style="color:var(--gray); font-size:12px; margin-top:15px;">Дата публикации: ${dateStr}</div>
      <div style="background:#2c2c2e; padding:15px; border-radius:12px; margin:20px 0;">${
        ad.desc || "Нет описания"
      }</div>
      
      ${
        !isSold
          ? `
        <div style="margin-bottom:8px;"><i class="fa fa-location-dot"></i> ${
          ad.city
        }, ${ad.address || "—"}</div>
        <div><i class="fa-brands fa-telegram"></i> ${ad.tgNick || "—"}</div>
      `
          : ""
      }
    </div>`;

  const slider = document.getElementById(`slider-${ad.id}`);
  slider.onscroll = () => {
    let idx = Math.round(slider.scrollLeft / slider.offsetWidth);
    document
      .querySelectorAll(`#dot-${ad.id}-.dot`)
      .forEach((d, i) => d.classList.toggle("active", i === idx));
    // Фикс селектора точек для кастомного ID
    const allDots = document.querySelectorAll(`[id^="dot-${ad.id}"]`);
    allDots.forEach((d, i) => d.classList.toggle("active", i === idx));
  };
  modal.classList.remove("hidden");
  tg.BackButton.show();
  tg.BackButton.onClick(closeProduct);
}

// ПАРАЛЛЕЛЬНАЯ ЗАГРУЗКА ФОТО
async function publishAndSend() {
  const title = document.getElementById("in-title").value;
  const price = document.getElementById("in-price").value;
  const btn = document.querySelector(".btn-premium-unity");
  if (!title || !price) return alert("Заполни поля!");

  if (editingId) {
    await db
      .ref("ads/" + editingId)
      .update({
        title,
        price,
        address: document.getElementById("in-address").value,
      });
    resetAddForm();
    showPage("home");
    return;
  }

  const isVipNeeded = selectedTariff === "vip" || holidayMode;
  if (isVipNeeded && !receiptAttached) return alert("Нужно прикрепить чек!");

  btn.disabled = true;
  btn.innerText = "ЗАГРУЗКА...";
  tg.showProgress();

  try {
    let receiptUrl = isVipNeeded
      ? await uploadToImgBB(document.getElementById("receipt-input").files[0])
      : null;

    // Загружаем все фото одновременно (Promise.all)
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
      notified: false,
      views: 0,
    };

    await db.ref("ads").push(newAd);
    alert("Отправлено на модерацию!");
    resetAddForm();
    showPage("home");
  } catch (e) {
    alert("Ошибка загрузки!");
  } finally {
    btn.disabled = false;
    btn.innerText = "Опубликовать";
    tg.hideProgress();
  }
}

// ПОИСК В ОТДЕЛЬНОМ ОКНЕ
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
function closeSearch() {
  document.getElementById("search-results-page").classList.add("hidden");
}

// ВСЕ ОСТАЛЬНЫЕ ФУНКЦИИ (БЕЗ СОКРАЩЕНИЙ)
function renderFeed() {
  const grid = document.getElementById("home-grid");
  if (!grid) return;
  grid.innerHTML = "";
  let filtered = ads.filter(
    (ad) =>
      (curCat === "Все" || ad.cat === curCat) &&
      ad.city === curCity &&
      ad.status !== "deleted" &&
      ad.status !== "pending"
  );
  filtered.sort((a, b) => {
    if (a.status === "sold" && b.status !== "sold") return 1;
    if (a.status !== "sold" && b.status === "sold") return -1;
    if (a.tariff === "vip" && b.tariff !== "vip" && a.status === "active")
      return -1;
    if (a.tariff !== "vip" && b.tariff === "vip" && b.status === "active")
      return 1;
    return (b.approvedAt || 0) - (a.approvedAt || 0);
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
function handleFileSelect(input) {
  const files = Array.from(input.files).slice(0, 5);
  selectedFiles = files;
  const prev = document.getElementById("gallery-preview");
  prev.innerHTML = "";
  files.forEach((f) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = document.createElement("img");
      img.src = e.target.result;
      img.style.width = "60px";
      img.style.height = "60px";
      img.style.objectFit = "cover";
      img.style.borderRadius = "8px";
      prev.appendChild(img);
    };
    reader.readAsDataURL(f);
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
function resetAddForm() {
  editingId = null;
  selectedFiles = [];
  receiptAttached = false;
  document.querySelectorAll(".main-input").forEach((i) => (i.value = ""));
  document.getElementById("gallery-preview").innerHTML = "";
  document.getElementById("receipt-label").innerText = "Добавить чек";
  [
    "tariff-block",
    "file-group",
    "cat-group",
    "city-group",
    "date-group",
    "tg-group",
    "phone-group",
    "desc-group",
  ].forEach((id) => document.getElementById(id).classList.remove("hidden"));
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
function closeProduct() {
  document.getElementById("product-modal").classList.add("hidden");
  tg.BackButton.hide();
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
function closeManageModal() {
  document.getElementById("manage-modal").classList.add("hidden");
}
function closeConfirmModal() {
  document.getElementById("confirm-modal").classList.add("hidden");
}
function setAdStatus(status) {
  if (!currentManageId) return;
  db.ref("ads/" + currentManageId).update({ status: status });
  currentManageId = null;
}
function startAdEdit() {
  const ad = ads.find((a) => a.id === currentManageId);
  if (!ad) return;
  editingId = currentManageId;
  showPage("add");
  document.getElementById("add-title-text").innerText = "Редактирование";
  [
    "tariff-block",
    "file-group",
    "cat-group",
    "city-group",
    "date-group",
    "tg-group",
    "phone-group",
    "desc-group",
  ].forEach((id) => document.getElementById(id).classList.add("hidden"));
  document.getElementById("in-title").value = ad.title || "";
  document.getElementById("in-price").value = ad.price || "";
  document.getElementById("in-address").value = ad.address || "";
  closeManageModal();
}
function confirmAction(type) {
  document.getElementById("manage-modal").classList.add("hidden");
  const modal = document.getElementById("confirm-modal");
  document.getElementById("confirm-text").innerText =
    type === "sold"
      ? "Объявление будет убрано в архив."
      : "Объявление уйдёт с сайта навсегда.";
  document.getElementById("confirm-btn-final").onclick = () => {
    setAdStatus(type === "sold" ? "sold" : "deleted");
    closeConfirmModal();
  };
  modal.classList.remove("hidden");
}
