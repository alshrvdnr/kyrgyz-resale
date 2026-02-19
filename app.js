const tg = window.Telegram.WebApp;
tg.expand();

// ==========================================
// 1. КОНФИГУРАЦИЯ FIREBASE
// ==========================================
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

// ==========================================
// 2. ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// ==========================================
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
let curCat = "Все";
let curCity = "Бишкек";
let selectedTariff = "standard";
let editingId = null;
let selectedFiles = [];
let profTab = "active";
let currentManageId = null;
let holidayMode = false;
let receiptAttached = false;

// ==========================================
// 3. ЗАГРУЗКА ПРИ СТАРТЕ
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  initUser();
  listenSettings();
  listenAds();
});

function initUser() {
  const user = tg.initDataUnsafe?.user || { first_name: "Гость", id: 0 };
  const initial = user.first_name ? user.first_name[0].toUpperCase() : "?";
  // Устанавливаем иконку профиля в хедере и в самом профиле
  const topAvatar = document.getElementById("u-avatar-top");
  if (topAvatar) topAvatar.innerText = initial;

  const bigAvatar = document.getElementById("u-avatar-big");
  if (bigAvatar) bigAvatar.innerText = initial;

  const userNameLabel = document.getElementById("u-name");
  if (userNameLabel) userNameLabel.innerText = user.first_name || "Гость";
}

// ==========================================
// 4. СИНХРОНИЗАЦИЯ С FIREBASE (SETTINGS)
// ==========================================
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
    if (tBlock) tBlock.classList.add("hidden");
    if (vBlock) vBlock.classList.remove("hidden");
    const promoText = document.getElementById("vip-promo-text");
    if (promoText)
      promoText.innerText = "Сегодня праздничный день. Все объявления платные.";
  } else {
    if (tBlock) tBlock.classList.remove("hidden");
    if (selectedTariff !== "vip") {
      if (vBlock) vBlock.classList.add("hidden");
    } else {
      if (vBlock) vBlock.classList.remove("hidden");
    }
    const promoText = document.getElementById("vip-promo-text");
    if (promoText) promoText.innerText = "VIP-объявление будет в ТОПе 3 дня.";
  }
}

// ==========================================
// 5. СИНХРОНИЗАЦИЯ С FIREBASE (ADS)
// ==========================================
function listenAds() {
  db.ref("ads").on("value", (snap) => {
    const data = snap.val();
    // Превращаем объект из базы в массив и сохраняем ID каждой записи
    ads = data
      ? Object.keys(data).map((key) => ({ id: key, ...data[key] }))
      : [];
    renderFeed();
    renderProfile();
    checkVipExpiration();
  });
}

// Логика превращения VIP в Standard через 72 часа
function checkVipExpiration() {
  const now = Math.floor(Date.now() / 1000);
  ads.forEach((ad) => {
    if (ad.tariff === "vip" && ad.approvedAt && now - ad.approvedAt > 259200) {
      db.ref("ads/" + ad.id).update({ tariff: "standard" });
    }
  });
}

// ==========================================
// 6. ОСНОВНАЯ ЛЕНТА (РЕНДЕРИНГ)
// ==========================================
function renderFeed() {
  const grid = document.getElementById("home-grid");
  if (!grid) return;
  grid.innerHTML = "";

  // Фильтр по категории и городу. Скрываем только те, что на модерации (pending)
  let filtered = ads.filter(
    (ad) =>
      (curCat === "Все" || ad.cat === curCat) &&
      ad.city === curCity &&
      ad.status !== "pending"
  );

  // Сортировка: Deleted (внизу) -> Sold (внизу) -> VIP (вверху) -> Active (обычные)
  filtered.sort((a, b) => {
    // 1. Удаленные в самый низ
    if (a.status === "deleted" && b.status !== "deleted") return 1;
    if (a.status !== "deleted" && b.status === "deleted") return -1;

    // 2. Проданные ниже активных
    if (a.status === "sold" && b.status === "active") return 1;
    if (a.status === "active" && b.status === "sold") return -1;

    // 3. VIP в самый верх среди активных
    if (a.tariff === "vip" && b.tariff !== "vip" && a.status === "active")
      return -1;
    if (a.tariff !== "vip" && b.tariff === "vip" && b.status === "active")
      return 1;

    // 4. По дате одобрения (новые выше)
    return (b.approvedAt || 0) - (a.approvedAt || 0);
  });

  filtered.forEach((ad) => {
    const card = createAdCard(ad, false);
    grid.appendChild(card);
  });
}

function createAdCard(ad, isProfile = false) {
  const isFav = favs.includes(ad.id);
  const isSold = ad.status === "sold";
  const isDeleted = ad.status === "deleted";
  const isVip = ad.tariff === "vip" && ad.status === "active";

  const card = document.createElement("div");
  // Если VIP - добавляем класс свечения, если Удален - класс разбитой карточки
  card.className = `card ${isVip ? "card-vip" : ""} ${
    isDeleted ? "card-deleted" : ""
  }`;
  card.onclick = () => openProduct(ad);

  card.innerHTML = `
    ${isSold || isDeleted ? '<div class="sold-badge">ПРОДАНО</div>' : ""}
    ${isVip ? '<div class="vip-badge">VIP</div>' : ""}
    ${
      !isProfile
        ? `
      <div class="fav-heart-btn ${isFav ? "active" : ""}" onclick="toggleFav('${
            ad.id
          }', event)">
        <i class="fa-solid fa-heart"></i>
      </div>`
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

// ==========================================
// 7. МОДАЛКА ТОВАРА И ПРОСМОТРЫ
// ==========================================
function openProduct(ad) {
  const modal = document.getElementById("product-modal");

  // Счетчик просмотров: увеличиваем значение в Firebase
  if (ad.userId !== tg.initDataUnsafe?.user?.id) {
    db.ref("ads/" + ad.id + "/views").transaction(
      (current) => (current || 0) + 1
    );
  }

  const isFav = favs.includes(ad.id);
  const dateStr = ad.approvedAt
    ? new Date(ad.approvedAt * 1000).toLocaleDateString()
    : "На модерации";

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
      <div style="color:var(--gray); font-size:12px; margin-top:10px;">Дата публикации: ${dateStr}</div>
      <div style="background:#2c2c2e; padding:15px; border-radius:12px; margin:20px 0;">${
        ad.desc || "Нет описания"
      }</div>
      <div style="margin-bottom:8px;"><i class="fa fa-location-dot"></i> ${
        ad.city
      }, ${ad.address || "—"}</div>
      <div><i class="fa-brands fa-telegram"></i> ${ad.tgNick || "—"}</div>
    </div>`;

  modal.classList.remove("hidden");
  tg.BackButton.show();
  tg.BackButton.onClick(closeProduct);
}

// ==========================================
// 8. ПУБЛИКАЦИЯ (VALIDATION + LOADING + RESET)
// ==========================================
async function publishAndSend() {
  const title = document.getElementById("in-title").value;
  const price = document.getElementById("in-price").value;
  const pubBtn = document.querySelector("#page-add .btn-premium-unity");

  if (!title || !price) return alert("Заполни поля название и цена!");

  // Если мы в режиме редактирования (только 3 поля)
  if (editingId) {
    await db.ref("ads/" + editingId).update({
      title: title,
      price: price,
      address: document.getElementById("in-address").value,
    });
    editingId = null;
    alert("Изменения сохранены!");
    showPage("home");
    return;
  }

  // Проверка чека: если VIP или Праздничный режим
  const isVipNeeded = selectedTariff === "vip" || holidayMode;
  if (isVipNeeded && !receiptAttached) {
    return alert(
      "Для VIP-объявления необходимо прикрепить скриншот чека об оплате!"
    );
  }

  // ВКЛЮЧАЕМ ИНДИКАТОР ЗАГРУЗКИ
  if (pubBtn) {
    pubBtn.disabled = true;
    pubBtn.innerText = "ПОДОЖДИТЕ, ИДЕТ ЗАГРУЗКА...";
    pubBtn.style.opacity = "0.7";
  }
  tg.showProgress(); // Системный спиннер Telegram

  try {
    // 1. Загружаем чек в ImgBB (если есть)
    let receiptUrl = null;
    const receiptInput = document.getElementById("receipt-input");
    if (isVipNeeded && receiptInput.files[0]) {
      receiptUrl = await uploadToImgBB(receiptInput.files[0]);
    }

    // 2. Загружаем фото товара в ImgBB
    let imgs = [];
    for (let f of selectedFiles) {
      const url = await uploadToImgBB(f);
      if (url) imgs.push(url);
    }

    // 3. Собираем объект объявления
    const newAd = {
      title: title,
      price: price,
      cat: document.getElementById("in-cat").value,
      city: document.getElementById("in-city").value,
      address: document.getElementById("in-address").value,
      phone: document.getElementById("in-wa").value,
      tgNick: document.getElementById("in-tg").value,
      desc: document.getElementById("in-desc").value,
      receiveDate: document.getElementById("in-receive-date").value,
      img: imgs,
      receipt_url: receiptUrl,
      status: "pending", // Отправляем на модерацию
      tariff: selectedTariff,
      userId: tg.initDataUnsafe?.user?.id || 0,
      createdAt: Math.floor(Date.now() / 1000),
      views: 0,
      notified: false,
    };

    // 4. Сохраняем в Firebase
    await db.ref("ads").push(newAd);

    alert("Ваше объявление отправлено на модерацию!");
    resetAddForm(); // Полная очистка полей
    showPage("home");
  } catch (err) {
    console.error(err);
    alert("Произошла ошибка при публикации. Попробуйте еще раз.");
  } finally {
    // ВЫКЛЮЧАЕМ ИНДИКАТОР
    if (pubBtn) {
      pubBtn.disabled = false;
      pubBtn.innerText = "Опубликовать";
      pubBtn.style.opacity = "1";
    }
    tg.hideProgress();
  }
}

function resetAddForm() {
  editingId = null;
  selectedFiles = [];
  receiptAttached = false;

  // Сброс всех текстовых полей
  document.getElementById("in-title").value = "";
  document.getElementById("in-price").value = "";
  document.getElementById("in-address").value = "";
  document.getElementById("in-wa").value = "";
  document.getElementById("in-tg").value = "";
  document.getElementById("in-desc").value = "";
  document.getElementById("in-receive-date").value = "";

  // Сброс файлов
  document.getElementById("file-input").value = "";
  document.getElementById("receipt-input").value = "";

  // Очистка превью
  document.getElementById("gallery-preview").innerHTML = "";
  document.getElementById("receipt-label").innerText = "Добавить чек";

  // Возвращаем все скрытые при редактировании блоки
  const blocks = [
    "tariff-block",
    "file-group",
    "cat-group",
    "city-group",
    "date-group",
    "tg-group",
    "phone-group",
    "desc-group",
  ];
  blocks.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.remove("hidden");
  });
}

// ==========================================
// 9. ЦЕНТР УПРАВЛЕНИЯ (PROFILE LOGIC)
// ==========================================
function openManageModal(id) {
  currentManageId = id;
  const ad = ads.find((a) => a.id === id);
  if (ad) {
    const infoContainer = document.getElementById("manage-info");
    if (infoContainer) {
      infoContainer.innerHTML = `
          Название: <b>${ad.title}</b><br>
          Телефон: <b>${ad.phone || "—"}</b><br>
          Адрес: <b>${ad.address || "—"}</b>
        `;
    }
  }
  const modal = document.getElementById("manage-modal");
  if (modal) modal.classList.remove("hidden");
}

function confirmAction(type) {
  // Закрываем первое окно управления
  const manageModal = document.getElementById("manage-modal");
  if (manageModal) manageModal.classList.add("hidden");

  const confirmModal = document.getElementById("confirm-modal");
  const confirmText = document.getElementById("confirm-text");
  const confirmBtn = document.getElementById("confirm-btn-final");

  if (type === "sold") {
    if (confirmText) confirmText.innerText = "Объявление будет убрано в архив.";
    if (confirmBtn)
      confirmBtn.onclick = () => {
        setAdStatus("sold");
        closeConfirmModal();
      };
  } else if (type === "delete") {
    if (confirmText)
      confirmText.innerText = "Объявление уйдёт с сайта навсегда.";
    if (confirmBtn)
      confirmBtn.onclick = () => {
        setAdStatus("deleted");
        closeConfirmModal();
      };
  }

  if (confirmModal) confirmModal.classList.remove("hidden");
}

function setAdStatus(status) {
  if (!currentManageId) return;
  // Просто обновляем статус в Firebase. Удаление = статус deleted.
  db.ref("ads/" + currentManageId).update({ status: status });
  currentManageId = null;
}

function startAdEdit() {
  const ad = ads.find((a) => a.id === currentManageId);
  if (!ad) return;

  editingId = currentManageId;
  showPage("add");

  const titleHeader = document.getElementById("add-title-text");
  if (titleHeader) titleHeader.innerText = "Редактирование";

  // Скрываем блоки, которые нельзя менять по твоей просьбе
  const hideIds = [
    "tariff-block",
    "file-group",
    "cat-group",
    "city-group",
    "date-group",
    "tg-group",
    "phone-group",
    "desc-group",
  ];
  hideIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.add("hidden");
  });

  // Заполняем разрешенные поля
  document.getElementById("in-title").value = ad.title || "";
  document.getElementById("in-price").value = ad.price || "";
  document.getElementById("in-address").value = ad.address || "";

  closeManageModal();
}

// ==========================================
// 10. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (ГОРОД, ТАРИФЫ)
// ==========================================
function toggleCitySelector() {
  document.getElementById("city-selector").classList.toggle("hidden");
}

function selectCity(c) {
  curCity = c;
  document.getElementById("current-city-label").innerText = c;
  toggleCitySelector();
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

function handleFileSelect(input) {
  const files = Array.from(input.files).slice(0, 5);
  selectedFiles = files;
  const prev = document.getElementById("gallery-preview");
  if (!prev) return;
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
  try {
    const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, {
      method: "POST",
      body: fd,
    });
    const data = await res.json();
    return data.success ? data.data.url : null;
  } catch (e) {
    return null;
  }
}

// ==========================================
// 11. НАВИГАЦИЯ И СТРАНИЦЫ
// ==========================================
function showPage(p) {
  document.querySelectorAll(".page").forEach((s) => s.classList.add("hidden"));
  const targetPage = document.getElementById(`page-${p}`);
  if (targetPage) targetPage.classList.remove("hidden");

  // Управление активными иконками в таббаре
  document
    .querySelectorAll(".nav-item")
    .forEach((i) => i.classList.remove("active"));
  const activeNav = document.getElementById(`n-${p}`);
  if (activeNav) activeNav.classList.add("active");

  if (p === "favs") renderFavs();
  if (p === "add" && !editingId) resetAddForm();
  if (p === "profile") renderProfile();
}

function renderProfile() {
  const grid = document.getElementById("my-ads-grid");
  if (!grid) return;
  grid.innerHTML = "";
  const myId = tg.initDataUnsafe?.user?.id || 0;

  // Фильтр профиля: Активные или Архив (Sold)
  const filtered = ads.filter(
    (ad) =>
      ad.userId === myId &&
      (profTab === "active" ? ad.status === "active" : ad.status === "sold")
  );

  filtered.forEach((ad) => {
    const card = createAdCard(ad, true);
    grid.appendChild(card);
  });
}

function renderFavs() {
  const container = document.getElementById("favs-content-area");
  if (!container) return;
  const filtered = ads.filter((ad) => favs.includes(ad.id));

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-favs-center">
        <div style="width:80px; height:80px; background:#2c2c2e; border-radius:20px; display:flex; align-items:center; justify-content:center; margin-bottom:20px; color:var(--yellow-main); font-size:32px;">
          <i class="fa-solid fa-heart"></i>
        </div>
        <h3 style="margin:0 0 10px 0;">У вас пока нет избранных объявлений</h3>
        <button class="btn-premium-unity" style="width:auto; padding:12px 40px;" onclick="showPage('home')">Поиск</button>
      </div>`;
  } else {
    container.innerHTML = '<div class="listings-grid" id="fav-grid"></div>';
    const favGrid = document.getElementById("fav-grid");
    filtered.forEach((ad) => {
      favGrid.appendChild(createAdCard(ad, false));
    });
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

function toggleFav(id, event) {
  if (event) event.stopPropagation();
  favs = favs.includes(id) ? favs.filter((f) => f !== id) : [...favs, id];
  localStorage.setItem("favs_v15", JSON.stringify(favs));
  renderFeed();
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
function cancelAdd() {
  resetAddForm();
  showPage("home");
}
function clearFavs() {
  favs = [];
  localStorage.setItem("favs_v15", "[]");
  renderFavs();
  renderFeed();
}
