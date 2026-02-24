const tg = window.Telegram.WebApp;
// 1. Насильно раскрываем окно на максимум (убирает возможность свернуть вниз)
tg.expand();

// 2. Красим верхнюю панель Telegram (где время и зарядки) в цвет твоего фона
tg.setHeaderColor("#121212");

// 3. Красим цвет подложки Telegram в цвет фона (видно, когда тянешь страницу вверх или вниз)
tg.setBackgroundColor("#121212");

// 1. CONFIG
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
const storage = firebase.storage(); // Теперь это заработает!

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

let ads = [],
  favs = JSON.parse(localStorage.getItem("favs_v15")) || [];
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

// 2. ИНИЦИАЛИЗАЦИЯ
document.addEventListener("DOMContentLoaded", () => {
  initUser();
  listenSettings();
  listenAds();
  const sIn = document.getElementById("main-search");
  if (sIn)
    sIn.addEventListener("keypress", (e) => {
      if (e.key === "Enter") startSearch(e.target.value);
    });
});

function initUser() {
  const user = tg.initDataUnsafe?.user || { id: 0, first_name: "Гость" };

  // 1. ПРОВЕРКА БАНА
  if (user.id !== 0) {
    db.ref("blacklist/" + user.id).on("value", (snap) => {
      if (snap.val() === true) {
        window.stop();
        document.body.innerHTML = `<div style="color:red; text-align:center; margin-top:50px;">Доступ заблокирован</div>`;
      }
    });
  }

  // 2. ЗАПОЛНЕНИЕ ДАННЫХ (теперь переменная user доступна)
  const initial = user.first_name ? user.first_name[0].toUpperCase() : "?";

  const avatarTop = document.getElementById("u-avatar-top");
  const avatarBig = document.getElementById("u-avatar-big");
  const uName = document.getElementById("u-name");

  if (avatarTop) avatarTop.innerText = initial;
  if (avatarBig) avatarBig.innerText = initial;
  if (uName) uName.innerText = user.first_name;
}

function renderProfile() {
  const grid = document.getElementById("my-ads-grid");
  if (!grid) return;

  grid.innerHTML = "";
  const myId = tg.initDataUnsafe?.user?.id || 0;

  // Фильтруем: только мои и только по выбранной вкладке (active или sold)
  const filtered = ads.filter(
    (ad) =>
      ad.userId === myId &&
      (profTab === "active" ? ad.status === "active" : ad.status === "sold")
  );

  if (filtered.length === 0) {
    grid.innerHTML = `<p style="text-align:center; color:gray; grid-column:1/3; margin-top:30px;">Здесь пока ничего нет</p>`;
  } else {
    // Рисуем карточки (второй параметр true говорит, что это для профиля)
    filtered.forEach((ad) => grid.appendChild(createAdCard(ad, true)));
  }
}

// 2. Переключатель вкладок (Активные / Архив)
window.switchProfileTab = function (t) {
  console.log("Переключение вкладки на:", t);
  profTab = t;

  const tabActive = document.getElementById("tab-active");
  const tabArchive = document.getElementById("tab-archive");

  if (tabActive) tabActive.classList.toggle("active", t === "active");
  if (tabArchive) tabArchive.classList.toggle("active", t === "archive");

  renderProfile();
};

// Оживляем переключение страниц
window.showPage = function (p) {
  console.log("Переход на страницу:", p);

  // 1. Прячем все страницы
  document.querySelectorAll(".page").forEach((s) => s.classList.add("hidden"));

  // 2. Находим нужную страницу и показываем её
  const targetPage = document.getElementById(`page-${p}`);
  if (targetPage) {
    targetPage.classList.remove("hidden");
  }

  // 3. ФИКС: Убираем шапку поиска везде, кроме главной, чтобы она не мешала кликам
  const header = document.getElementById("dynamic-header");
  if (header) {
    if (p === "home") {
      header.style.display = "block";
    } else {
      header.style.display = "none";
    }
  }

  // 4. Красим активную кнопку в желтый в нижнем меню
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.remove("active");
  });

  if (p === "home") document.getElementById("n-home")?.classList.add("active");
  if (p === "favs") {
    document.getElementById("n-favs")?.classList.add("active");
    // Если есть функция отрисовки избранного - запускаем
    if (typeof renderFavs === "function") renderFavs();
  }

  // 5. Если зашли в Профиль - запускаем его отрисовку
  if (p === "profile") {
    if (typeof renderProfile === "function") renderProfile();
  }

  // 6. Если зашли в Подать - сбрасываем форму
  if (p === "add") {
    if (!editingId && typeof resetAddForm === "function") resetAddForm();
  }
};

// Оживляем кнопку "X" и кнопку Профиля вверху
window.cancelAdd = function () {
  showPage("home");
};

// Привязываем клик к иконке профиля (буква "D") в шапке
const profileIcon = document.getElementById("u-avatar-top");
if (profileIcon) {
  profileIcon.onclick = function () {
    showPage("profile");
  };
}

// 4. СИНХРОНИЗАЦИЯ
function listenSettings() {
  db.ref("settings").on("value", (snap) => {
    const s = snap.val() || {};
    holidayMode = s.holiday_mode || false;
    currentQrUrl = s.qr_url || "";
    applyHolidayUI();
  });
}

function listenAds() {
  db.ref("ads").on("value", (snap) => {
    const data = snap.val();
    ads = data
      ? Object.keys(data).map((key) => ({ id: key, ...data[key] }))
      : [];
    renderFeed();
    renderProfile();

    // --- ДОБАВЬ ЭТОТ КУСОК ТУТ ---
    const splash = document.getElementById("splash-screen");
    if (splash) {
      setTimeout(() => {
        splash.classList.add("hidden-splash");
      }, 1000); // 1000 мс = 1 секунда показа логотипа
    }
    // ----------------------------
  });
}

function applyHolidayUI() {
  const vBlock = document.getElementById("vip-block");
  const qrImg = document.getElementById("qr-display");
  const priceStd = document.getElementById("price-std"),
    priceVip = document.getElementById("price-vip"),
    labelStd = document.getElementById("label-std");

  if (qrImg && currentQrUrl) qrImg.src = currentQrUrl;

  if (holidayMode) {
    if (labelStd) labelStd.innerText = "Стандарт + ТОП";
    if (priceStd) priceStd.innerText = "100 сом";
    if (priceVip) priceVip.innerText = "200 сом";
    if (vBlock) vBlock.classList.remove("hidden");
  } else {
    if (labelStd) labelStd.innerText = "Стандарт";
    if (priceStd) priceStd.innerText = "Бесплатно";
    if (priceVip) priceVip.innerText = "100 сом";
    if (vBlock) {
      if (selectedTariff === "vip") vBlock.classList.remove("hidden");
      else vBlock.classList.add("hidden");
    }
  }
}

// 5. ЛЕНТА И КАРТОЧКИ
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

  // ПРАВИЛЬНАЯ СОРТИРОВКА: VIP -> Свежие -> Продано
  filtered.sort((a, b) => {
    const aIsSold = a.status === "sold",
      bIsSold = b.status === "sold";
    if (aIsSold !== bIsSold) return aIsSold ? 1 : -1; // Проданные всегда вниз

    if (!aIsSold && !bIsSold && a.tariff !== b.tariff) {
      return a.tariff === "vip" ? -1 : 1; // VIP всегда вверх
    }

    const aTime = a.approvedAt || a.createdAt || 0;
    const bTime = b.approvedAt || b.createdAt || 0;
    return bTime - aTime; // Самые свежие (большое число) — выше всех
  });

  filtered.forEach((ad) => grid.appendChild(createAdCard(ad)));
}

function createAdCard(ad, isProfile = false) {
  const isFav = favs.includes(ad.id),
    isSold = ad.status === "sold",
    isVip = ad.tariff === "vip" && !isSold;
  const card = document.createElement("div");
  card.className = `card ${isVip ? "card-vip" : ""} ${
    ad.status === "deleted" ? "card-deleted" : ""
  }`;
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
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
        <div style="color:var(--yellow-main); font-weight:bold; font-size:15px;">${
          ad.price
        } KGS</div>
        <div style="color:var(--gray); font-size:10px;">${formatRelativeDate(
          ad.approvedAt || ad.createdAt
        )}</div>
      </div>
      <div style="font-size:12px; color:#ccc; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${
        ad.title
      }</div>
      ${
        isProfile && ad.status === "active"
          ? `<button onclick="event.stopPropagation(); openManageModal('${ad.id}')" style="width:100%; background:var(--yellow-main); color:#000; border:none; padding:8px; border-radius:8px; font-size:11px; font-weight:bold; margin-top:8px;">Управление</button>`
          : ""
      }
    </div>`;
  return card;
}

// 6. МОДАЛКА И КОНТАКТЫ
function openProduct(ad) {
  const modal = document.getElementById("product-modal");
  const isSold = ad.status === "sold",
    isFav = favs.includes(ad.id);
  const isVerified = ad.verified === true;
  let contactLink = ad.tgNick
    ? `https://t.me/${ad.tgNick.replace("@", "")}`
    : `https://wa.me/${ad.phone?.replace(/[^0-9]/g, "")}`;
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
      <div class="product-gallery-slider" id="slider-${ad.id}">${
    ad.img ? ad.img.map((src) => `<img src="${src}">`).join("") : ""
  }</div>
      <div class="carousel-dots">${dots}</div>
    </div>
    <div style="padding:20px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:15px;">
        <div style="font-size:28px; font-weight:800; color:var(--yellow-main);">${
          ad.price
        } KGS</div>
        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:5px;">
          <div style="color:var(--gray); font-size:11px;">${formatRelativeDate(
            ad.approvedAt || ad.createdAt
          )}</div>
          <div style="font-size:11px; color:#4cd964; font-weight:bold; background:rgba(76,217,100,0.1); padding:4px 8px; border-radius:6px;">Поступление: ${
            ad.receiveDate || "—"
          }</div>
        </div>
      </div>
      <div style="margin-bottom:20px; font-size:16px;"><b>${
        catMap[ad.cat] || "Товар"
      }</b> — ${ad.title} ${isVerified ? "🔵" : ""}</div>
      ${
        isSold
          ? `<div style="background:#333; padding:15px; border-radius:12px; color:#ff3b30; text-align:center; font-weight:bold;">Продано</div>`
          : `
          <a href="${contactLink}" class="btn-premium-unity" style="text-decoration:none; margin-bottom:20px;">Написать продавцу</a>
          <div style="background:#2c2c2e; padding:15px; border-radius:12px; margin:20px 0; white-space: pre-wrap; font-size:15px;">${
            ad.desc || "Нет описания"
          }</div>
          <div style="background:#1c1c1e; padding:18px; border-radius:15px; border:1px solid #333; display:flex; flex-direction:column; gap:15px;">
             <div style="display:flex; align-items:center; gap:12px;"><i class="fa-solid fa-location-dot" style="color:#ff3b30; font-size:18px; width:20px; text-align:center;"></i><div>${
               ad.city
             }, ${ad.address || "—"}</div></div>
             <div style="display:flex; align-items:center; gap:12px;"><i class="fa-solid fa-phone" style="color:var(--yellow-main); font-size:16px; width:20px; text-align:center;"></i><div>${
               ad.phone || "—"
             }</div></div>
             ${
               ad.tgNick
                 ? `<div style="display:flex; align-items:center; gap:12px;"><i class="fa-brands fa-telegram" style="color:#0088cc; font-size:20px; width:20px; text-align:center;"></i><div>${ad.tgNick}</div></div>`
                 : ""
             }
          </div>
          <div onclick="reportAd('${ad.id}', '${
              ad.userId
            }')" style="background:rgba(255,204,0,0.1); color:var(--yellow-main); border:1px solid var(--yellow-main); padding:12px; border-radius:12px; text-align:center; font-size:14px; font-weight:bold; cursor:pointer; margin-top:25px;">Пожаловаться на мошенника</div>
      `
      }
    </div>`;
  const slider = document.getElementById(`slider-${ad.id}`);
  if (slider)
    slider.onscroll = () => {
      let idx = Math.round(slider.scrollLeft / slider.offsetWidth);
      document
        .querySelectorAll(`[id^="dot-${ad.id}"]`)
        .forEach((d, i) => d.classList.toggle("active", i === idx));
    };
  modal.classList.remove("hidden");
  tg.BackButton.show();
  tg.BackButton.onClick(closeProduct);
}

// 7. ПОДАЧА (STORAGE)
async function uploadFile(file) {
  if (!file) return null;
  try {
    const fileName = Date.now() + "_" + file.name;
    // Используем firebase.storage() напрямую
    const storageRef = firebase.storage().ref("ads/" + fileName);
    const snapshot = await storageRef.put(file);
    const url = await snapshot.ref.getDownloadURL();
    return url;
  } catch (e) {
    console.error("Ошибка загрузки:", e);
    alert("Ошибка загрузки фото: " + e.message);
    return null;
  }
}

async function publishAndSend() {
  const btn = document.getElementById("pub-btn");
  const title = document.getElementById("in-title").value;
  const price = document.getElementById("in-price").value;

  // --- АНТИ-СПАМ: Ограничение 1 минута ---
  const lastPost = localStorage.getItem("last_post_time");
  const now = Date.now();
  if (lastPost && now - lastPost < 60000) {
    const waitSec = Math.ceil((60000 - (now - lastPost)) / 1000);
    return alert(`Слишком часто! Подождите ${waitSec} сек.`);
  }

  // --- ЛОГИКА РЕДАКТИРОВАНИЯ ---
  if (editingId) {
    btn.disabled = true;
    btn.innerText = "СОХРАНЕНИЕ...";
    try {
      await db.ref("ads/" + editingId).update({
        title: title,
        price: price,
        address: document.getElementById("in-address").value,
        phone: document.getElementById("in-wa").value,
        desc: document.getElementById("in-desc").value,
        needs_sync_tg: true, // Флаг для бота, чтобы обновил пост в канале
      });
      alert("Изменения сохранены! Данные в Telegram обновятся скоро.");
      resetAddForm();
      showPage("home");
    } catch (e) {
      alert("Ошибка при сохранении: " + e.message);
    } finally {
      btn.disabled = false;
      btn.innerText = "Опубликовать";
    }
    return;
  }

  // --- ЛОГИКА СОЗДАНИЯ НОВОГО ОБЪЯВЛЕНИЯ ---
  const isPaid = holidayMode || selectedTariff === "vip";

  // Проверка прикрепленного чека для платных тарифов
  if (isPaid && !receiptAttached) {
    return alert(
      "В праздничные дни или для VIP нужно прикрепить чек об оплате!"
    );
  }

  btn.disabled = true;
  btn.innerText = "ЗАГРУЗКА...";

  try {
    // А. Загрузка чека на Firebase Storage
    let receiptUrl = null;
    if (isPaid) {
      const receiptFile = document.getElementById("receipt-input").files[0];
      receiptUrl = await uploadFile(receiptFile); // Использует твою функцию uploadFile
      if (!receiptUrl) throw new Error("Не удалось загрузить чек об оплате.");
    }

    // Б. Загрузка фотографий товара на Firebase Storage
    const imgs = await Promise.all(
      selectedFiles.map((file) => uploadFile(file))
    );

    // В. Формирование объекта объявления
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
      img: imgs.filter((i) => i !== null), // Очищаем от пустых ссылок
      receipt_url: receiptUrl,
      status: "pending", // Отправляем на модерацию
      bot_notified: false, // Важно: чтобы бот увидел новую запись в sync_job
      tariff: selectedTariff,
      is_holiday: holidayMode,
      userId: tg.initDataUnsafe?.user?.id || 0,
      createdAt: Math.floor(Date.now() / 1000),
    };

    // Г. Отправка в базу данных Firebase
    await db.ref("ads").push(newAd);
    localStorage.setItem("last_post_time", Date.now());

    alert("Успешно! Объявление и чек отправлены на проверку модератору.");
    resetAddForm();
    showPage("home");
  } catch (e) {
    alert("Ошибка при публикации: " + e.message);
  } finally {
    btn.disabled = false;
    btn.innerText = "Опубликовать";
  }
}

// 8. ФИЛЬТРЫ И УТИЛИТЫ
function filterByCat(c, el) {
  curCat = c;
  document
    .querySelectorAll(".cat-card")
    .forEach((i) => i.classList.remove("active"));
  if (el) el.classList.add("active");
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
  renderFavs();
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
        <h3 style="margin: 0 0 10px 0;">У вас пока нет избранных</h3>
        <!-- Сделал кнопку меньше через инлайновые стили -->
        <button class="btn-premium-unity" 
                style="width:auto; padding:12px 35px; font-size:14px; text-transform:none;" 
                onclick="showPage('home')">
          Найти подарки
        </button>
      </div>`;
  } else {
    container.innerHTML = '<div class="listings-grid" id="fav-grid"></div>';
    filtered.forEach((ad) => {
      const grid = document.getElementById("fav-grid");
      if (grid) grid.appendChild(createAdCard(ad));
    });
  }
}

function renderProfile() {
  const grid = document.getElementById("my-ads-grid");
  if (!grid) return;
  grid.innerHTML = "";
  const filtered = ads.filter(
    (ad) =>
      ad.userId === (tg.initDataUnsafe?.user?.id || 0) &&
      (profTab === "active" ? ad.status === "active" : ad.status === "sold")
  );
  if (filtered.length === 0)
    grid.innerHTML =
      "<p style='text-align:center;color:gray;grid-column:1/3;margin-top:20px;'>Пусто</p>";
  filtered.forEach((ad) => grid.appendChild(createAdCard(ad, true)));
}

function switchProfileTab(t) {
  profTab = t;
  document
    .getElementById("tab-active")
    ?.classList.toggle("active", t === "active");
  document
    .getElementById("tab-archive")
    ?.classList.toggle("active", t === "archive");
  renderProfile();
}

function formatRelativeDate(ts) {
  if (!ts) return "Сегодня";
  const date = new Date(ts * 1000),
    now = new Date();
  const diff = Math.floor(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()) -
      new Date(date.getFullYear(), date.getMonth(), date.getDate())) /
      86400000
  );
  if (diff === 0) return "Сегодня";
  if (diff === 1) return "Вчера";
  return date.toLocaleDateString("ru-RU");
}

function reportAd(adId, sellerId) {
  // 1. ПРОВЕРКА: Не жаловался ли юзер на ЭТО конкретное объявление раньше?
  let reportedAds = JSON.parse(localStorage.getItem("reported_ads") || "[]");
  if (reportedAds.includes(adId)) {
    return alert(
      "Вы уже отправили жалобу на это объявление. Модератор скоро его проверит."
    );
  }

  // 2. ПРОВЕРКА: Не шлет ли он жалобы слишком часто (анти-спам 5 минут)?
  const lastReport = localStorage.getItem("last_report_timestamp");
  const now = Date.now();
  if (lastReport && now - lastReport < 300000) {
    // 300000 мс = 5 минут
    const minutesLeft = Math.ceil((300000 - (now - lastReport)) / 60000);
    return alert(`Слишком много жалоб! Подождите еще ${minutesLeft} мин.`);
  }

  // 3. ПОДТВЕРЖДЕНИЕ
  if (
    !confirm("Вы уверены, что это мошенник? Жалоба будет передана модератору.")
  )
    return;

  // Получаем данные текущего пользователя из Telegram
  const user = tg.initDataUnsafe?.user || {
    id: 0,
    first_name: "Guest",
    username: "",
  };

  // Ищем ник продавца в текущем списке объявлений
  const ad = ads.find((a) => a.id === adId);
  const sellerNick = ad ? ad.tgNick || ad.phone || "Не указан" : "Неизвестно";

  // 4. ОТПРАВКА В БАЗУ FIREBASE
  db.ref("reports").push({
    adId: adId,
    sellerId: sellerId,
    sellerNick: sellerNick,
    reporterId: user.id, // Твой цифровой ID для ссылки в боте
    reporterName: user.username ? "@" + user.username : user.first_name, // Твое имя или ник
    timestamp: Math.floor(Date.now() / 1000),
    bot_notified: false, // ОБЯЗАТЕЛЬНО: чтобы бот увидел новую запись
  });

  // 5. ЗАПОМИНАЕМ ДЕЙСТВИЕ (в памяти телефона, чтобы нельзя было спамить)
  reportedAds.push(adId);
  localStorage.setItem("reported_ads", JSON.stringify(reportedAds)); // Блокируем повтор на этот пост
  localStorage.setItem("last_report_timestamp", now); // Блокируем спам по времени (5 мин)

  alert("Жалоба отправлена модератору! Спасибо за помощь.");
}

function confirmAction(type) {
  if (!confirm("Подтвердить действие?")) return;
  db.ref("management_requests").push({
    adId: currentManageId,
    action: type,
    userId: tg.initDataUnsafe?.user?.id || 0,
    processed: false,
  });
  alert("Запрос отправлен!");
  closeManageModal();
}

function resetAddForm() {
  editingId = null;
  selectedFiles = [];
  receiptAttached = false;
  document.querySelectorAll(".main-input").forEach((i) => (i.value = ""));
  document.getElementById("gallery-preview").innerHTML = "";
  [
    "file-group",
    "cat-group",
    "city-group",
    "date-group",
    "tg-group",
    "phone-group",
    "desc-group",
  ].forEach((id) => document.getElementById(id)?.classList.remove("hidden"));
  applyHolidayUI();
}

function handleFileSelect(i) {
  selectedFiles = Array.from(i.files).slice(0, 5);
  const p = document.getElementById("gallery-preview");
  if (p) {
    p.innerHTML = "";
    selectedFiles.forEach((f) => {
      const r = new FileReader();
      r.onload = (e) => {
        const img = document.createElement("img");
        img.src = e.target.result;
        img.style =
          "width:60px;height:60px;object-fit:cover;border-radius:8px;";
        p.appendChild(img);
      };
      r.readAsDataURL(f);
    });
  }
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
window.openManageModal = function (id) {
  currentManageId = id;
  const modal = document.getElementById("manage-modal");
  if (modal) {
    modal.classList.remove("hidden");
    // Блокируем скролл страницы под модалкой
    document.body.style.overflow = "hidden";
  }
};

function startAdEdit() {
  const ad = ads.find((a) => a.id === currentManageId);
  if (!ad) return;
  editingId = currentManageId;
  showPage("add");
  document.getElementById("add-title-text").innerText = "Редактирование";
  [
    "tariff-block",
    "vip-block",
    "file-group",
    "cat-group",
    "city-group",
    "date-group",
  ].forEach((id) => document.getElementById(id)?.classList.add("hidden"));
  document.getElementById("in-title").value = ad.title || "";
  document.getElementById("in-price").value = ad.price || "";
  document.getElementById("in-wa").value = ad.phone || "";
  closeManageModal();
}
function startSearch(val) {
  if (!val) return;
  const res = ads.filter(
    (ad) =>
      ad.title.toLowerCase().includes(val.toLowerCase()) &&
      ad.status !== "deleted"
  );
  const area = document.getElementById("search-results-area");
  if (area) {
    area.innerHTML = "";
    res.forEach((ad) => area.appendChild(createAdCard(ad)));
    document.getElementById("search-results-page").classList.remove("hidden");
  }
}
function closeProduct() {
  document.getElementById("product-modal").classList.add("hidden");
  tg.BackButton.hide();
}
window.closeManageModal = function () {
  const modal = document.getElementById("manage-modal");
  if (modal) {
    modal.classList.add("hidden");
    document.body.style.overflow = "auto";
  }
};
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

// --- ЛОГИКА СКРЫТИЯ ШАПКИ (СКРОЛЛ) ---
let lastScrollTop = 0;

window.addEventListener(
  "scroll",
  function () {
    const header = document.getElementById("dynamic-header");

    // Если шапка скрыта функцией showPage (мы в Профиле или Подать), скролл не трогаем
    if (!header || header.style.display === "none") return;

    let currentScroll =
      window.pageYOffset || document.documentElement.scrollTop;

    if (currentScroll > lastScrollTop && currentScroll > 100) {
      // Скроллим ВНИЗ — прячем шапку (уводим вверх)
      header.style.top = "-250px";
    } else if (currentScroll < lastScrollTop) {
      // Скроллим ВВЕРХ — показываем шапку
      header.style.top = "0";
    }

    // Запоминаем позицию (фикс для iOS)
    lastScrollTop = currentScroll <= 0 ? 0 : currentScroll;
  },
  { passive: true }
);

// --- ЛОГИКА КАТЕГОРИЙ И ПОИСКА ---

// 1. Фильтр по категориям (Цветы, Подарки и т.д.)
window.filterByCat = function (c, el) {
  console.log("Выбрана категория:", c);
  curCat = c;

  // Переключаем активный класс на кнопках
  document
    .querySelectorAll(".cat-card")
    .forEach((i) => i.classList.remove("active"));
  if (el) {
    el.classList.add("active");
  } else {
    // Если элемент не передан, ищем его по тексту
    const cards = document.querySelectorAll(".cat-card");
    cards.forEach((card) => {
      if (card.innerText.includes(catMap[c] || c)) card.classList.add("active");
    });
  }

  // Меняем заголовок над лентой
  const titleEl = document.getElementById("dynamic-feed-title");
  if (titleEl) {
    titleEl.innerText = catTitles[c] || "Свежие предложения";
  }

  // Обновляем ленту
  if (typeof renderFeed === "function") renderFeed();
};

// 2. Выбор города
window.selectCity = function (c) {
  console.log("Выбран город:", c);
  curCity = c;

  const label = document.getElementById("current-city-label");
  if (label) label.innerText = c;

  // Закрываем окно выбора
  window.toggleCitySelector();

  // Обновляем ленту под новый город
  if (typeof renderFeed === "function") renderFeed();
};

// 3. Показать/скрыть выбор города
window.toggleCitySelector = function () {
  const selector = document.getElementById("city-selector");
  if (selector) {
    const isHidden = selector.classList.contains("hidden");
    if (isHidden) {
      selector.classList.remove("hidden");
      document.body.style.overflow = "hidden";
    } else {
      selector.classList.add("hidden");
      document.body.style.overflow = "auto";
    }
  }
};

// 4. Поиск (глобальная функция для HTML)
window.startSearch = function (val) {
  if (!val || val.trim() === "") return;

  console.log("Поиск по запросу:", val);

  // Фильтруем объявления по названию
  const results = ads.filter(
    (ad) =>
      ad.title.toLowerCase().includes(val.toLowerCase()) &&
      ad.status !== "deleted"
  );

  const container = document.getElementById("search-results-area");
  const searchPage = document.getElementById("search-results-page");

  if (container && searchPage) {
    container.innerHTML = "";
    if (results.length === 0) {
      container.innerHTML = `<p style="text-align:center; color:gray; margin-top:50px;">Ничего не найдено</p>`;
    } else {
      results.forEach((ad) => container.appendChild(createAdCard(ad)));
    }
    searchPage.classList.remove("hidden");
  }
};

// 5. Закрыть окно поиска
window.closeSearch = function () {
  const searchPage = document.getElementById("search-results-page");
  if (searchPage) searchPage.classList.add("hidden");
};
