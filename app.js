const tg = window.Telegram.WebApp;
tg.expand();

// ТВОЙ КОНФИГ FIREBASE (Уже вставлен)
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

// Инициализация базы данных
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
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
let currentManageId = null;
let holidayMode = false;
let receiptAttached = false;

// ЗАГРУЗКА ДАННЫХ
document.addEventListener("DOMContentLoaded", () => {
  initUser();
  listenSettings(); // Слушаем праздничный режим
  listenAds(); // Слушаем объявления из базы
});

function initUser() {
  const user = tg.initDataUnsafe?.user || { first_name: "Гость", id: 0 };
  const initial = user.first_name ? user.first_name[0].toUpperCase() : "?";
  document.getElementById("u-avatar-top").innerText = initial;
  document.getElementById("u-avatar-big").innerText = initial;
  document.getElementById("u-name").innerText = user.first_name || "Гость";
}

// СЛУШАЕМ НАСТРОЙКИ (Праздничный режим)
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
  } else {
    tBlock.classList.remove("hidden");
    if (selectedTariff !== "vip") vBlock.classList.add("hidden");
  }
}

// СЛУШАЕМ ОБЪЯВЛЕНИЯ ИЗ FIREBASE
function listenAds() {
  db.ref("ads").on("value", (snap) => {
    const data = snap.val();
    // Превращаем объект Firebase в массив для удобства
    ads = data
      ? Object.keys(data).map((key) => ({ id: key, ...data[key] }))
      : [];
    renderFeed();
    renderProfile();
  });
}

// ГЛАВНАЯ ЛЕНТА
function renderFeed() {
  const grid = document.getElementById("home-grid");
  if (!grid) return;
  grid.innerHTML = "";

  // Показываем только Активные и Проданные (Удаленные скрыты)
  let filtered = ads.filter(
    (ad) =>
      (curCat === "Все" || ad.cat === curCat) &&
      ad.city === curCity &&
      ad.status !== "deleted"
  );

  // Сортировка: VIP -> Active -> Sold (внизу)
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
  const isVip = ad.tariff === "vip" && !isSold;

  const card = document.createElement("div");
  card.className = `card ${isVip ? "card-vip" : ""}`;
  card.onclick = () => openProduct(ad);

  card.innerHTML = `
    ${isSold ? '<div class="sold-badge">ПРОДАНО</div>' : ""}
    ${isVip ? '<div class="vip-badge">VIP</div>' : ""}
    ${
      !isProfile
        ? `<div class="fav-heart-btn ${
            isFav ? "active" : ""
          }" onclick="toggleFav('${
            ad.id
          }', event)"><i class="fa-solid fa-heart"></i></div>`
        : ""
    }
    <img src="${ad.img ? ad.img[0] : ""}" loading="lazy">
    <div style="padding:10px;">
      <div style="color:var(--yellow-main); font-weight:bold; font-size:16px;">${
        ad.price
      } KGS</div>
      <div style="font-size:12px; color:#ccc; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${
        ad.title
      }</div>
      ${
        isProfile && ad.status === "active"
          ? `
        <button onclick="event.stopPropagation(); openManageModal('${ad.id}')" style="width:100%; background:var(--yellow-main); color:#000; border:none; padding:8px; border-radius:8px; font-size:11px; font-weight:bold; margin-top:8px;">Управление</button>
      `
          : ""
      }
    </div>
  `;
  return card;
}

// ОТКРЫТИЕ ОБЪЯВЛЕНИЯ + СЧЕТЧИК ПРОСМОТРОВ
function openProduct(ad) {
  const modal = document.getElementById("product-modal");

  // Считаем просмотр, если это не автор
  if (ad.userId !== tg.initDataUnsafe?.user?.id) {
    db.ref("ads/" + ad.id + "/views").transaction((c) => (c || 0) + 1);
  }

  const isFav = favs.includes(ad.id);
  const dateStr = ad.approvedAt
    ? new Date(ad.approvedAt * 1000).toLocaleDateString()
    : "На проверке";

  document.getElementById("pv-content").innerHTML = `
    <div class="modal-carousel-container">
      <i class="fa fa-arrow-left" onclick="closeProduct()" style="position:absolute; top:20px; left:20px; z-index:100; background:rgba(0,0,0,0.5); padding:10px; border-radius:50%;"></i>
      <i class="fa-solid fa-heart" onclick="toggleFav('${
        ad.id
      }')" style="position:absolute; top:20px; right:20px; z-index:100; font-size:24px; color:${
    isFav ? "var(--yellow-main)" : "#fff"
  }"></i>
      <div class="product-gallery-slider">
        ${ad.img ? ad.img.map((src) => `<img src="${src}">`).join("") : ""}
      </div>
    </div>
    <div style="padding:20px;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div style="font-size:28px; font-weight:800; color:var(--yellow-main);">${
          ad.price
        } KGS</div>
        <div style="color:var(--gray); font-size:14px;"><i class="fa fa-eye"></i> ${
          ad.views || 0
        }</div>
      </div>
      <div style="margin:10px 0;"><b>${catMap[ad.cat]}</b> — ${ad.title}</div>
      <a href="https://t.me/${ad.tgNick?.replace(
        "@",
        ""
      )}" class="btn-premium-unity" style="text-decoration:none;">Написать продавцу</a>
      <div style="color:var(--gray); font-size:12px; margin-top:15px;">Дата публикации: ${dateStr}</div>
      <div style="background:#2c2c2e; padding:15px; border-radius:12px; margin:20px 0;">${
        ad.desc || "Нет описания"
      }</div>
      <div>📍 ${ad.city}, ${ad.address || "—"}</div>
    </div>`;
  modal.classList.remove("hidden");
}

// ПУБЛИКАЦИЯ В FIREBASE (ВМЕСТО LOCALSTORAGE)
async function publishAndSend() {
  const title = document.getElementById("in-title").value;
  const price = document.getElementById("in-price").value;
  if (!title || !price) return alert("Заполни поля!");

  // Если это редактирование
  if (editingId) {
    await db.ref("ads/" + editingId).update({
      title: title,
      price: price,
      address: document.getElementById("in-address").value,
    });
    editingId = null;
    showPage("home");
    return;
  }

  // Проверка чека для VIP или Праздника
  const isVipNeeded = selectedTariff === "vip" || holidayMode;
  if (isVipNeeded && !receiptAttached) {
    return alert("Для этого тарифа нужно прикрепить чек!");
  }

  tg.MainButton.showProgress();

  // Загружаем чек если нужен
  let receiptUrl = null;
  if (isVipNeeded) {
    const rFile = document.getElementById("receipt-input").files[0];
    receiptUrl = await uploadToImgBB(rFile);
  }

  // Загружаем фото товара
  let imgs = [];
  for (let f of selectedFiles) {
    const url = await uploadToImgBB(f);
    if (url) imgs.push(url);
  }

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
    img: imgs,
    receipt_url: receiptUrl,
    status: "pending", // ОТПРАВЛЯЕМ НА ПРОВЕРКУ
    tariff: selectedTariff,
    userId: tg.initDataUnsafe?.user?.id || 0,
    createdAt: Math.floor(Date.now() / 1000),
  };

  // СОХРАНЯЕМ В FIREBASE
  await db.ref("ads").push(newAd);

  tg.MainButton.hide();
  alert("Ваше объявление отправлено на модерацию!");
  showPage("home");
}

// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (УПРАВЛЕНИЕ)
function openManageModal(id) {
  currentManageId = id;
  const ad = ads.find((a) => a.id === id);
  if (ad) {
    document.getElementById("manage-info").innerHTML = `
        Название: <b>${ad.title}</b><br>
        Телефон: <b>${ad.phone || "—"}</b><br>
        Адрес: <b>${ad.address || "—"}</b>
      `;
  }
  document.getElementById("manage-modal").classList.remove("hidden");
}

function confirmStatus(type) {
  document.getElementById("manage-modal").classList.add("hidden");
  const modal = document.getElementById("confirm-modal");
  const text = document.getElementById("confirm-text");
  const btn = document.getElementById("confirm-btn-final");

  if (type === "sold") {
    text.innerText = "Объявление будет убрано в архив.";
    btn.onclick = () => {
      setAdStatus("sold");
      closeConfirmModal();
    };
  } else {
    text.innerText = "Объявление уйдёт с сайта навсегда.";
    btn.onclick = () => {
      setAdStatus("deleted");
      closeConfirmModal();
    };
  }
  modal.classList.remove("hidden");
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
  // Скрываем лишние поля
  [
    "tariff-block",
    "file-group",
    "cat-group",
    "city-group",
    "date-group",
    "tg-group",
    "phone-group",
    "desc-group",
  ].forEach((id) => {
    document.getElementById(id).classList.add("hidden");
  });
  document.getElementById("in-title").value = ad.title || "";
  document.getElementById("in-price").value = ad.price || "";
  document.getElementById("in-address").value = ad.address || "";
  closeManageModal();
}

// СТАНДАРТНЫЕ ФУНКЦИИ (ГОРОД, ТАРИФЫ, ФОТО)
function toggleCitySelector() {
  document.getElementById("city-selector").classList.toggle("hidden");
}
function selectCity(c) {
  curCity = c;
  document.getElementById("current-city-label").innerText = c;
  toggleCitySelector();
  renderFeed();
}
function filterByCat(c, el) {
  curCat = c;
  document
    .querySelectorAll(".cat-card")
    .forEach((i) => i.classList.remove("active"));
  el.classList.add("active");
  renderFeed();
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
function handleFileSelect(i) {
  selectedFiles = Array.from(i.files).slice(0, 5);
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
}

function resetAddForm() {
  document.getElementById("add-title-text").innerText = "Новое объявление";
  [
    "tariff-block",
    "file-group",
    "cat-group",
    "city-group",
    "date-group",
    "tg-group",
    "phone-group",
    "desc-group",
  ].forEach((id) => {
    document.getElementById(id).classList.remove("hidden");
  });
  receiptAttached = false;
  document.getElementById("receipt-label").innerText = "Добавить чек";
}

function closeProduct() {
  document.getElementById("product-modal").classList.add("hidden");
}
function closeManageModal() {
  document.getElementById("manage-modal").classList.add("hidden");
}
function closeConfirmModal() {
  document.getElementById("confirm-modal").classList.add("hidden");
}
function cancelAdd() {
  editingId = null;
  showPage("home");
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
    container.innerHTML = `<div class="empty-favs-center"><div style="width:80px; height:80px; background:#2c2c2e; border-radius:20px; display:flex; align-items:center; justify-content:center; margin-bottom:20px; color:var(--yellow-main); font-size:32px;"><i class="fa-solid fa-heart"></i></div><h3 style="margin:0 0 10px 0;">Пусто</h3><button class="btn-premium-unity" style="width:auto; padding:12px 40px;" onclick="showPage('home')">Поиск</button></div>`;
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
