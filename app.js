const tg = window.Telegram.WebApp;
tg.expand();
tg.setHeaderColor("#121212");
tg.setBackgroundColor("#121212");

// --- 1. CONFIG & ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ РОЛЕЙ ---
const MY_ADMIN_ID = 1615492914; // !!! ЗАМЕНИ НА СВОЙ ID ЦИФРАМИ !!!
let currentUserRole = "user"; // Роль: user, business, admin
let myShopData = null; // Данные магазина (если роль business)

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
const storage = firebase.storage();

// Функция проверки роли (вызывается при старте)
function checkUserRole(uid) {
  // 1. Сначала проверяем на главного админа
  if (uid == MY_ADMIN_ID) {
    currentUserRole = "admin";
    document.body.classList.add("is-admin");
    console.log("Вход как АДМИН");
    // Даже админу нужно подтянуть данные магазина, если он хочет что-то постить
  }

  // 2. Слушаем изменения в папке пользователя в реальном времени (.on вместо .once)
  db.ref("users/" + uid).on("value", (snap) => {
    const userData = snap.val();
    console.log("Данные профиля из базы:", userData);

    if (userData && userData.role === "business") {
      currentUserRole = "business";
      myShopData = userData; // Сохраняем био, название и т.д.
      document.body.classList.add("is-business");
      console.log("Бизнес-аккаунт активен:", myShopData.shopName);
    } else if (uid != MY_ADMIN_ID) {
      currentUserRole = "user";
      document.body.classList.remove("is-business");
    }

    // ВАЖНО: Перерисовываем профиль сразу, как только роль обновилась
    if (
      document.getElementById("page-profile").classList.contains("hidden") ===
      false
    ) {
      renderProfile();
    }
  });
}
// -----------------------------------------------

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

let verifyPhotoFile = null; // Файл проверочного фото

let ads = [],
  favs = JSON.parse(localStorage.getItem("favs_v15")) || [];
let curCat = "Все",
  curCity = "bishkek", // Теперь по умолчанию латиница
  selectedTariff = "standard",
  editingId = null,
  selectedFiles = [],
  profTab = "active";
const cityNames = {
  bishkek: "Бишкек",
  osh: "Ош",
  manas: "Манас",
  tokmok: "Токмок",
  karakol: "Каракол",
};
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

function handleVerifyPhotoSelect(input) {
  if (input.files && input.files[0]) {
    verifyPhotoFile = input.files[0];
    document.getElementById("verify-preview").style.display = "block";
  }
}

async function initUser() {
  const user = tg.initDataUnsafe?.user || { id: 0, first_name: "Гость" };

  // 1. ПРИНУДИТЕЛЬНАЯ ПРОВЕРКА РОЛИ
  if (user.id !== 0) {
    await checkUserRole(user.id); // Ждем, пока база ответит, кто ты

    // ПРОВЕРКА БАНА
    db.ref("blacklist/" + user.id).on("value", (snap) => {
      if (snap.val() === true) {
        window.stop();
        document.body.innerHTML = `<div style="color:red; text-align:center; margin-top:50px;">Доступ заблокирован</div>`;
      }
    });
  }

  // 2. ЗАПОЛНЕНИЕ ДАННЫХ
  const initial = user.first_name ? user.first_name[0].toUpperCase() : "?";
  const avatarTop = document.getElementById("u-avatar-top");
  const avatarBig = document.getElementById("u-avatar-big");
  const uName = document.getElementById("u-name");

  if (avatarTop) avatarTop.innerText = initial;
  if (avatarBig) avatarBig.innerText = initial;

  // Если админ — припишем это к имени для теста
  if (currentUserRole === "admin") {
    uName.innerText = user.first_name + " (Админ 👑)";
  } else if (currentUserRole === "business" && myShopData) {
    uName.innerText = myShopData.shopName + " (Магазин)";
  } else {
    uName.innerText = user.first_name;
  }
}

// 1. Обновляем отрисовку профиля
function renderProfile() {
  const myId = tg.initDataUnsafe?.user?.id || 0;

  const userView = document.getElementById("user-profile-view");
  const bizView = document.getElementById("biz-profile-view");
  const bizSettingsIcon = document.getElementById("biz-setup-icon");
  const grid = document.getElementById("my-ads-grid");

  if (!grid) return;

  // ПЕРЕКЛЮЧЕНИЕ ИНТЕРФЕЙСА
  if (currentUserRole === "business" || currentUserRole === "admin") {
    userView?.classList.add("hidden");
    bizView?.classList.remove("hidden");
    bizSettingsIcon?.classList.remove("hidden");
    updateBizProfileUI();
  } else {
    userView?.classList.remove("hidden");
    bizView?.classList.add("hidden");
    bizSettingsIcon?.classList.add("hidden");
  }

  // Отрисовка товаров
  grid.innerHTML = "";
  const myAds = ads.filter((ad) => ad.userId === myId);

  // Фильтруем по вкладкам (Активные / Архив)
  const filtered = myAds.filter((ad) =>
    profTab === "active" ? ad.status === "active" : ad.status === "sold"
  );

  // Обновляем счетчик товаров в шапке профиля
  const statCount = document.getElementById("biz-stat-ads");
  if (statCount) statCount.innerText = myAds.length;

  if (filtered.length === 0) {
    grid.innerHTML = `<p style="text-align:center; color:gray; grid-column:1/3; margin-top:30px;">Нет товаров в этой категории</p>`;
  } else {
    filtered.forEach((ad) => grid.appendChild(createAdCard(ad, true)));
  }
}

// 2. Функция заполнения Инста-шапки
function updateBizProfileUI() {
  if (!myShopData) return;

  const fields = {
    "biz-name-display": myShopData.shopName || "Мой Магазин",
    "biz-bio-display": myShopData.bio || "Описание не заполнено",
    "biz-hours-display": myShopData.workHours || "09:00 - 21:00",
    "biz-inst-display": myShopData.instagram
      ? "@" + myShopData.instagram
      : "Instagram не привязан",
  };

  for (let id in fields) {
    const el = document.getElementById(id);
    if (el) el.innerText = fields[id];
  }

  // Логотип
  const logoCircle = document.getElementById("biz-logo");
  if (logoCircle) {
    if (myShopData.logo) {
      logoCircle.style.backgroundImage = `url('${myShopData.logo}')`;
      logoCircle.innerText = "";
    } else {
      logoCircle.style.backgroundImage = "none";
      logoCircle.innerText = myShopData.shopName ? myShopData.shopName[0] : "?";
    }
  }
}

// 4. Сохранение профиля (с поддержкой загрузки логотипа)
window.saveBizProfile = async function () {
  const myId = tg.initDataUnsafe?.user?.id || 0;

  // Добавляем получение названия магазина, если оно есть в модалке
  const newName =
    document.getElementById("edit-biz-name")?.value || myShopData.shopName;
  const newBio = document.getElementById("edit-biz-bio").value;
  const newHours = document.getElementById("edit-biz-hours").value;
  const newInst = document.getElementById("edit-biz-inst").value;

  try {
    await db.ref("users/" + myId).update({
      shopName: newName, // Теперь сохраняем и имя
      bio: newBio,
      workHours: newHours,
      instagram: newInst,
    });

    // Обновляем локальную переменную
    myShopData.shopName = newName;
    myShopData.bio = newBio;
    myShopData.workHours = newHours;
    myShopData.instagram = newInst;

    closeEditBizModal();

    // ПРИНУДИТЕЛЬНО вызываем обновление текста в шапке
    updateBizProfileUI();
    renderProfile();

    alert("Профиль магазина обновлен!");
  } catch (e) {
    alert("Ошибка сохранения: " + e.message);
  }
};

// 3. Управление модалкой настроек
window.openEditBizModal = function () {
  document.getElementById("edit-biz-bio").value = myShopData.bio || "";
  document.getElementById("edit-biz-hours").value = myShopData.workHours || "";
  document.getElementById("edit-biz-inst").value = myShopData.instagram || "";
  document.getElementById("edit-biz-modal").classList.remove("hidden");
};

window.closeEditBizModal = function () {
  document.getElementById("edit-biz-modal").classList.add("hidden");
};

// 4. Сохранение данных в Firebase
window.saveBizProfile = async function () {
  const myId = tg.initDataUnsafe?.user?.id || 0;
  const newBio = document.getElementById("edit-biz-bio").value;
  const newHours = document.getElementById("edit-biz-hours").value;
  const newInst = document.getElementById("edit-biz-inst").value;

  try {
    await db.ref("users/" + myId).update({
      bio: newBio,
      workHours: newHours,
      instagram: newInst,
    });
    // Обновляем локальные данные, чтобы не перезагружать страницу
    myShopData.bio = newBio;
    myShopData.workHours = newHours;
    myShopData.instagram = newInst;

    closeEditBizModal();
    renderProfile();
    alert("Профиль обновлен!");
  } catch (e) {
    alert("Ошибка сохранения: " + e.message);
  }
};

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

  // 1. Прячем абсолютно все страницы (секции с классом .page)
  document.querySelectorAll(".page").forEach((s) => s.classList.add("hidden"));

  // 2. ЛОГИКА ПЕРЕАДРЕСАЦИИ ДЛЯ КНОПКИ "ПОДАТЬ" (Центральный плюс)
  if (p === "add") {
    if (currentUserRole === "business" || currentUserRole === "admin") {
      // Если это бизнес или админ — принудительно меняем страницу на Офис
      p = "business-admin";
    }
  }

  // 3. Показываем нужную страницу
  const targetPage = document.getElementById(`page-${p}`);
  if (targetPage) {
    targetPage.classList.remove("hidden");
  } else {
    console.error("Страница не найдена: page-" + p);
  }

  // 4. УПРАВЛЕНИЕ ШАПКОЙ (Поиск и Город)
  // Шапка видна ТОЛЬКО на главной. На остальных (профиль, офис, подача) — прячем.
  const header = document.getElementById("dynamic-header");
  if (header) {
    header.style.display = p === "home" ? "block" : "none";
  }

  // 5. ПОДСВЕТКА КНОПОК В НИЖНЕМ МЕНЮ
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.remove("active");
  });

  // Подсвечиваем иконки (домашняя, магазины, избранное, профиль)
  if (p === "home") document.getElementById("n-home")?.classList.add("active");
  if (p === "shops")
    document.getElementById("n-shops")?.classList.add("active");
  if (p === "favs") document.getElementById("n-favs")?.classList.add("active");
  if (p === "profile")
    document.getElementById("n-profile")?.classList.add("active");

  // Если мы в Офисе, можно подсветить центральную кнопку (если у неё есть ID)
  // В твоем случае центральная кнопка — это div, но если добавишь ей ID n-add, будет работать:
  if (p === "business-admin" || p === "add") {
    document.getElementById("n-add")?.classList.add("active");
  }

  // 6. СПЕЦИАЛЬНАЯ ЛОГИКА ДЛЯ КАЖДОЙ СТРАНИЦЫ (Отрисовка данных)

  // Страница Избранного
  if (p === "favs") {
    if (typeof renderFavs === "function") renderFavs();
  }

  // Страница Профиля
  if (p === "profile") {
    // Если это бизнес — сначала обновляем текст в Инста-шапке
    if (currentUserRole === "business" || currentUserRole === "admin") {
      if (typeof updateBizProfileUI === "function") updateBizProfileUI();
    }
    // Затем рисуем список товаров
    if (typeof renderProfile === "function") renderProfile();
  }

  // Страница Обычной Подачи (только для юзеров)
  if (p === "add") {
    if (!editingId) {
      if (typeof resetAddForm === "function") resetAddForm();
      if (typeof generateVerifyCode === "function") generateVerifyCode();
    }
  }

  // Страница Офиса Магазина (Dashboard)
  if (p === "business-admin") {
    if (typeof renderBusinessDashboard === "function")
      renderBusinessDashboard();
  }

  // 7. СКРОЛЛ ВВЕРХ
  window.scrollTo({ top: 0, behavior: "instant" });
};

// ДОБАВЬ ЭТУ ФУНКЦИЮ НИЖЕ, если её ещё нет в твоем файле app.js:
let currentVerifyCode = "";
function generateVerifyCode() {
  // Генерируем случайное число от 1000 до 9999
  currentVerifyCode = Math.floor(1000 + Math.random() * 9000).toString();
  const el = document.getElementById("display-verify-code");
  if (el) {
    el.innerText = currentVerifyCode;
  }
  console.log("Новый проверочный код:", currentVerifyCode);
}

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
  const splash = document.getElementById("splash-screen");

  db.ref("ads").on(
    "value",
    (snap) => {
      const data = snap.val();
      ads = data
        ? Object.keys(data).map((key) => ({ id: key, ...data[key] }))
        : [];

      renderFeed();
      renderProfile();

      // Когда данные загружены, убираем заставку
      if (splash && !splash.classList.contains("hidden-splash")) {
        splash.classList.add("hidden-splash");

        // --- ЛОГИКА ПЕРЕХОДА ПО ССЫЛКАМ ИЗ БОТА ---
        const hash = window.location.hash;
        console.log("Пришел хэш из бота:", hash);

        if (hash === "#add") {
          showPage("add");
        } else if (hash === "#profile") {
          showPage("profile");
        }
        // ------------------------------------------
      }
    },
    (error) => {
      console.error("Ошибка Firebase:", error);
      if (splash) splash.classList.add("hidden-splash");
    }
  );
}
// Если через 5 секунд ничего не произошло - убираем заставку принудительно
setTimeout(() => {
  if (splash && !splash.classList.contains("hidden-splash")) {
    splash.classList.add("hidden-splash");
  }
}, 5000);

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

  // 1. ФИЛЬТРАЦИЯ ОБЪЯВЛЕНИЙ
  let filtered = ads.filter((ad) => {
    // А. Проверка категории
    const catMatch = curCat === "Все" || ad.cat === curCat;

    // Б. Проверка города (самое важное!)
    // cityNames[curCity] берет "Бишкек" из словаря, если curCity равен "bishkek"
    const cityMatch = ad.city_key === curCity || ad.city === cityNames[curCity];

    // В. Проверка статуса
    const statusMatch =
      ad.status !== "deleted" &&
      ad.status !== "pending" &&
      ad.status !== "rejected";

    return catMatch && cityMatch && statusMatch;
  });

  // 2. СОРТИРОВКА: VIP (на 3 дня) выше, новые сверху
  filtered.sort((a, b) => {
    const now = Math.floor(Date.now() / 1000);
    const threeDays = 259200;

    // А. Проданные всегда в самом низу
    const aSold = a.status === "sold" ? 1 : 0;
    const bSold = b.status === "sold" ? 1 : 0;
    if (aSold !== bSold) return aSold - bSold;

    // Б. Проверка VIP с учетом времени (только если прошло меньше 3 дней)
    const aIsVip =
      a.tariff === "vip" && now - (a.approvedAt || a.createdAt) < threeDays
        ? 1
        : 0;
    const bIsVip =
      b.tariff === "vip" && now - (b.approvedAt || b.createdAt) < threeDays
        ? 1
        : 0;

    if (aIsVip !== bIsVip) return bIsVip - aIsVip; // Активные VIP ставим выше

    // В. Внутри своих групп сортируем по ВРЕМЕНИ (самые свежие — сверху)
    const aTime = Number(a.approvedAt || a.createdAt || 0);
    const bTime = Number(b.approvedAt || b.createdAt || 0);

    return bTime - aTime;
  });

  // 3. ОТРИСОВКА КАРТОЧЕК
  if (filtered.length === 0) {
    grid.innerHTML = `<p style="text-align:center; color:gray; grid-column: 1/3; margin-top:50px;">В этом городе пока нет объявлений</p>`;
  } else {
    filtered.forEach((ad) => grid.appendChild(createAdCard(ad)));
  }
}

function createAdCard(ad, isProfile = false) {
  // 1. ОЧИСТКА ЦЕНЫ: Оставляем только цифры для отображения
  const displayPrice = String(ad.price).replace(/[^0-9]/g, "") || "0";

  const isFav = favs.includes(ad.id),
    isSold = ad.status === "sold";

  // --- ЛОГИКА ТАЙМЕРА VIP (3 ДНЯ) ---
  const now = Math.floor(Date.now() / 1000); // Текущее время в секундах
  const approvedTime = Number(ad.approvedAt || ad.createdAt || 0); // Время старта
  const threeDaysInSeconds = 259200; // 3 * 24 * 60 * 60 (ровно 3 дня)

  // Объявление считается VIP только если:
  // 1. В базе стоит тариф "vip"
  // 2. Оно не продано
  // 3. Прошло МЕНЬШЕ 3 дней с момента публикации
  const isVip =
    ad.tariff === "vip" && !isSold && now - approvedTime < threeDaysInSeconds;
  // ---------------------------------

  const card = document.createElement("div");
  // Добавляем классы в зависимости от статуса и тарифа
  card.className = `card ${isVip ? "card-vip" : ""} ${
    ad.status === "deleted" ? "card-deleted" : ""
  }`;

  // Клик по всей карточке открывает просмотр товара
  card.onclick = () => openProduct(ad);

  card.innerHTML = `
    ${isSold ? '<div class="sold-badge">ПРОДАНО</div>' : ""}
    ${isVip ? '<div class="vip-badge">VIP</div>' : ""}
    
    <!-- ДОБАВЛЕНО: БЕЙДЖ ДЛЯ КОМБО-НАБОРОВ -->
    ${ad.isCombo ? '<div class="combo-badge">КОМБО 🔥</div>' : ""}

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
        <!-- ОТОБРАЖАЕМ ЦЕНУ И ВАЛЮТУ -->
        <div style="color:var(--yellow-main); font-weight:bold; font-size:15px;">${displayPrice} KGS</div>
        <div style="color:var(--gray); font-size:10px;">${formatRelativeDate(
          ad.approvedAt || ad.createdAt
        )}</div>
      </div>
      <div style="font-size:12px; color:#ccc; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${
        ad.title
      }</div>
      
      <!-- БЛОК ИНСТРУМЕНТОВ АДМИНИСТРАТОРА (Виден только если currentUserRole === "admin") -->
      ${
        currentUserRole === "admin"
          ? `
        <div style="margin-top:8px; padding-top:8px; border-top:1px dashed #444;">
          <div style="font-size:10px; color:#ff3b30; margin-bottom:5px; font-family:monospace;">
            USER_ID: <code>${ad.userId}</code>
          </div>
          <button onclick="event.stopPropagation(); adminDeleteAd('${ad.id}')" 
                  style="width:100%; background:#ff3b30; color:#fff; border:none; padding:6px; border-radius:6px; font-size:10px; font-weight:bold; cursor:pointer;">
            УДАЛИТЬ (АДМИН)
          </button>
        </div>
      `
          : ""
      }

      <!-- КНОПКА УПРАВЛЕНИЯ ДЛЯ ВЛАДЕЛЬЦА (В профиле или кабинете бизнеса) -->
      ${
        isProfile && ad.status === "active"
          ? `<button onclick="event.stopPropagation(); openManageModal('${ad.id}')" 
                     style="width:100%; background:var(--yellow-main); color:#000; border:none; padding:8px; border-radius:8px; font-size:11px; font-weight:bold; margin-top:8px;">
               Управление
             </button>`
          : ""
      }
    </div>`;

  return card;
}

// Вспомогательная функция для админа
window.adminDeleteAd = async function (adId) {
  if (!confirm("Внимание! Вы удаляете чужое объявление. Удалить?")) return;

  try {
    await db.ref("ads/" + adId).update({
      status: "deleted",
      needs_sync_tg: true, // Бот удалит из канала
    });
    alert("Объявление удалено админом.");
  } catch (e) {
    alert("Ошибка удаления: " + e.message);
  }
};

// 6. МОДАЛКА И КОНТАКТЫ
function openProduct(ad) {
  const modal = document.getElementById("product-modal");
  const isSold = ad.status === "sold",
    isFav = favs.includes(ad.id);
  const isVerified = ad.verified === true;

  // Проверка прав админа
  const isAdmin = currentUserRole === "admin";

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
          ? `<div style="background:#333; padding:15px; border-radius:12px; color:#ff3b30; text-align:center; font-weight:bold; margin-bottom:20px;">Продано</div>`
          : `
          <a href="${contactLink}" class="btn-premium-unity" style="text-decoration:none; margin-bottom:20px;">Написать продавцу</a>

          <!-- ЛОГИКА ОТОБРАЖЕНИЯ СОСТАВА КОМБО -->
          ${
            ad.isCombo
              ? `
            <div class="combo-items-list">
              <div style="font-weight:bold; color:var(--yellow-main); margin-bottom:10px;">В наборе:</div>
              ${ad.comboItems
                .split(",")
                .map(
                  (item) => `
                <div class="combo-item-row">
                  <i class="fa-solid fa-check"></i>
                  <div>${item.trim()}</div>
                </div>
              `
                )
                .join("")}
              ${
                ad.comboBenefit
                  ? `<div style="margin-top:10px; font-size:12px; color:#4cd964; font-weight:bold;">🔥 ${ad.comboBenefit}</div>`
                  : ""
              }
            </div>
          `
              : ""
          }

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

      <!-- СПЕЦИАЛЬНЫЙ БЛОК ДЛЯ АДМИНА -->
      ${
        isAdmin
          ? `
        <div style="margin-top:30px; padding:15px; background:rgba(255,59,48,0.1); border:1px solid #ff3b30; border-radius:15px;">
          <div style="color:#ff3b30; font-weight:bold; margin-bottom:12px; font-size:14px; text-transform:uppercase; letter-spacing:1px;">Админ-панель</div>
          <div style="font-size:12px; color:#fff; display:flex; flex-direction:column; gap:8px; font-family:monospace;">
            <div>🆔 ID Продавца: <span style="color:var(--yellow-main)">${
              ad.userId
            }</span></div>
            <div>📅 Дата публ.: ${new Date(
              (ad.approvedAt || ad.createdAt) * 1000
            ).toLocaleString()}</div>
            <div>📑 ID Поста: ${ad.id}</div>
            <div>🎫 Тариф: ${ad.tariff}</div>
          </div>
          <button onclick="adminDeleteAd('${
            ad.id
          }')" style="width:100%; background:#ff3b30; color:#fff; border:none; padding:12px; border-radius:10px; margin-top:15px; font-weight:bold; cursor:pointer;">УДАЛИТЬ ПОСТ (АДМИН)</button>
        </div>
      `
          : ""
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
    const fileName = Date.now() + "_" + Math.random().toString(36).substring(7);
    const storageRef = firebase.storage().ref("ads/" + fileName);

    // МЕТАДАННЫЕ: Без них ваши правила Storage могут блокировать загрузку
    const metadata = {
      contentType: file.type || "image/jpeg",
    };

    // Загрузка
    const snapshot = await storageRef.put(file, metadata);
    // Ссылка
    const url = await snapshot.ref.getDownloadURL();
    console.log("Файл загружен:", url);
    return url;
  } catch (e) {
    console.error("Ошибка загрузки в Storage:", e);
    return null;
  }
}

async function publishAndSend() {
  const btn = document.getElementById("pub-btn");
  const title = document.getElementById("in-title").value;
  const priceInput = document.getElementById("in-price").value;

  // --- 1. ПРЕДВАРИТЕЛЬНАЯ ПРОВЕРКА (ВАЛИДАЦИЯ) ---
  const isPartner =
    currentUserRole === "business" || currentUserRole === "admin";
  const cleanTitle = title.trim();
  const numericPrice = parseInt(priceInput);

  if (cleanTitle.length < 3) return alert("Название слишком короткое!");
  if (isNaN(numericPrice) || numericPrice <= 0)
    return alert("Введите корректную цену!");
  if (numericPrice > 1000000) return alert("Цена слишком высокая!");

  // Проверка анти-спама для обычных юзеров
  if (!isPartner && !editingId) {
    const lastPost = localStorage.getItem("last_post_time");
    if (lastPost && Date.now() - lastPost < 60000) {
      const waitSec = Math.ceil((60000 - (Date.now() - lastPost)) / 1000);
      return alert(`Слишком часто! Подождите ${waitSec} сек.`);
    }
  }

  // --- 2. ВКЛЮЧАЕМ ОПТИМИСТИЧНЫЙ ЛОАДЕР ---
  const overlay = document.getElementById("upload-overlay");
  const lTitle = document.getElementById("loader-title");
  const lText = document.getElementById("loader-text");
  const lBtn = document.getElementById("loader-error-btn");
  const lVisual = document.getElementById("loader-visual");

  if (overlay) {
    overlay.classList.remove("hidden");
    lTitle.innerText = "Принято!";
    lVisual.classList.remove("error-shake");
    lVisual.classList.add("pulse-heart");
    lVisual.style.color = "var(--yellow-main)";
    lBtn.classList.add("hidden");
    lText.innerText = "Ваши данные получены, загружаем фотографии в облако...";
  }

  try {
    // --- 3. ЛОГИКА РЕДАКТИРОВАНИЯ ---
    if (editingId) {
      await db.ref("ads/" + editingId).update({
        title: cleanTitle,
        price: numericPrice,
        address: document.getElementById("in-address").value,
        phone: document.getElementById("in-wa").value,
        desc: document.getElementById("in-desc").value,
        needs_sync_tg: true,
      });

      finishUpload("Изменения сохранены!");
      return;
    }

    // --- 4. ПОДГОТОВКА ФАЙЛОВ И ДАННЫХ ---
    const catSelect = document.getElementById("in-cat");
    const citySelect = document.getElementById("in-city");

    // Проверки перед загрузкой для обычных юзеров
    if (!isPartner) {
      if ((holidayMode || selectedTariff === "vip") && !receiptAttached)
        throw new Error("Прикрепите чек об оплате!");
      if (!verifyPhotoFile)
        throw new Error("Загрузите проверочное фото с кодом!");
    }
    if (selectedFiles.length === 0)
      throw new Error("Добавьте фотографии товара!");

    // Загрузка чека
    let receiptUrl = "";
    if (!isPartner && (holidayMode || selectedTariff === "vip")) {
      const receiptFile = document.getElementById("receipt-input").files[0];
      if (receiptFile) receiptUrl = await uploadFile(receiptFile);
    }

    // Загрузка проверочного фото
    let verifyPhotoUrl = "";
    if (verifyPhotoFile) {
      verifyPhotoUrl = await uploadFile(verifyPhotoFile);
    }

    // Загрузка основных фото
    if (lText) lText.innerText = "Почти готово, сохраняем изображения...";
    const imgs = await Promise.all(
      selectedFiles.map((file) => uploadFile(file))
    );
    const validImgs = imgs.filter((url) => url !== null);

    if (validImgs.length === 0)
      throw new Error("Ошибка при загрузке изображений");

    // --- 5. ФОРМИРОВАНИЕ ОБЪЕКТА ДЛЯ БАЗЫ ---
    const newAd = {
      title: cleanTitle,
      price: numericPrice,

      // КАТЕГОРИЯ: Берем ключ (flowers), а не текст
      cat: catSelect.value,

      // ГОРОД: Ключ для бота (osh) + Название для людей (Ош)
      city_key: citySelect.value,
      city: citySelect.options[citySelect.selectedIndex].text,

      address: document.getElementById("in-address").value,
      phone: document.getElementById("in-wa").value,
      tgNick: document.getElementById("in-tg").value,
      desc: document.getElementById("in-desc").value,
      receiveDate: document.getElementById("in-receive-date").value,

      isCombo:
        typeof currentAddingType !== "undefined" &&
        currentAddingType === "combo",
      comboItems: document.getElementById("in-combo-items")?.value || "",
      comboBenefit: document.getElementById("in-combo-benefit")?.value || "",

      img: validImgs,
      verify_photo: verifyPhotoUrl || "",
      verify_code: isPartner ? "PARTNER_BYPASS" : currentVerifyCode,
      receipt_url: receiptUrl,

      status: isPartner ? "active" : "pending",
      bot_notified: isPartner ? true : false,
      isShop: isPartner,
      shopName: isPartner
        ? myShopData
          ? myShopData.shopName
          : "Администрация"
        : "",
      verified: isPartner,
      tariff: selectedTariff,
      is_holiday: isPartner ? false : holidayMode,

      userId: tg.initDataUnsafe?.user?.id || 0,
      createdAt: Math.floor(Date.now() / 1000),
    };

    // 6. ОТПРАВКА
    await db.ref("ads").push(newAd);
    localStorage.setItem("last_post_time", Date.now());

    finishUpload(
      isPartner ? "Опубликовано мгновенно!" : "Отправлено на модерацию!"
    );
  } catch (e) {
    // ОБРАБОТКА ОШИБОК
    if (overlay) {
      lVisual.classList.remove("pulse-heart");
      lVisual.classList.add("error-shake");
      lVisual.style.color = "#ff3b30";
      lTitle.innerText = "Ой, ошибка!";
      lText.innerText = e.message;
      lBtn.classList.remove("hidden");
    } else {
      alert("Ошибка: " + e.message);
    }
    console.error(e);
  }
}

// Вспомогательная функция для красивого финала
function finishUpload(msg) {
  const lTitle = document.getElementById("loader-title");
  const lText = document.getElementById("loader-text");
  const overlay = document.getElementById("upload-overlay");

  if (lTitle) lTitle.innerText = "Успешно!";
  if (lText) lText.innerText = msg;

  setTimeout(() => {
    if (overlay) overlay.classList.add("hidden");
    resetAddForm();
    showPage("home");
  }, 1800);
}

// Функция закрытия окна ошибки
window.closeUploadOverlay = function () {
  const overlay = document.getElementById("upload-overlay");
  if (overlay) overlay.classList.add("hidden");
};

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
  const date = new Date(ts * 1000);
  const now = new Date();

  // Получаем полночь сегодняшнего дня
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();
  // Получаем полночь вчерашнего дня
  const yesterdayStart = todayStart - 86400000;
  // Получаем время поста в миллисекундах
  const adTime = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  ).getTime();

  if (adTime === todayStart) return "Сегодня";
  if (adTime === yesterdayStart) return "Вчера";

  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
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

// В app.js, там где вы отправляете обновления в базу
async function confirmAction(type) {
  if (!confirm("Подтвердить действие?")) return;

  // 1. Сначала меняем статус самого объявления
  let updateData = { status: type, needs_sync_tg: true }; // Бот увидит этот флаг!
  await db.ref("ads/" + currentManageId).update(updateData);

  // 2. Отправляем запрос на управление (для истории)
  db.ref("management_requests").push({
    adId: currentManageId,
    action: type,
    userId: tg.initDataUnsafe?.user?.id || 0,
    processed: false,
  });

  alert("Выполнено!");
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

// ФУНКЦИЯ ДЛЯ ОБЫЧНЫХ ФОТО ТОВАРА (макс 5 штук)
window.handleFileSelect = function (input) {
  // Сохраняем файлы в глобальный массив selectedFiles (не более 5)
  selectedFiles = Array.from(input.files).slice(0, 5);

  const preview = document.getElementById("gallery-preview");
  if (!preview) return;

  // Очищаем старые превью
  preview.innerHTML = "";

  selectedFiles.forEach((file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = document.createElement("img");
      img.src = e.target.result;
      img.style =
        "width:70px;height:70px;object-fit:cover;border-radius:10px;border:1px solid #333;";
      preview.appendChild(img);
    };
    reader.readAsDataURL(file);
  });

  console.log("Выбрано основных фото:", selectedFiles.length);
};

window.handleVerifyPhotoSelect = function (input) {
  if (input.files && input.files[0]) {
    verifyPhotoFile = input.files[0]; // Сохраняем файл в переменную

    const preview = document.getElementById("verify-preview");
    if (preview) {
      preview.classList.remove("hidden");
      preview.innerHTML = `<i class="fa-solid fa-check-double"></i> Фото подтверждения добавлено`;
    }

    // Подсвечиваем кнопку зеленым, чтобы юзер видел успех
    const btn = document.querySelector(".verification-btn");
    if (btn) {
      btn.style.borderColor = "#4cd964";
      btn.style.color = "#4cd964";
      btn.style.background = "rgba(76,217,100,0.1)";
    }
  }
};

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
  console.log("Выбран город (ключ):", c);
  curCity = c;

  // Берем "Бишкек" из словаря cityNames по ключу "bishkek"
  const label = document.getElementById("current-city-label");
  if (label) label.innerText = cityNames[c] || c;

  toggleCitySelector();
  renderFeed(); // Перерисовываем ленту
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

function renderBusinessDashboard() {
  const container = document.getElementById("biz-my-ads");
  if (!container) return;

  const myId = tg.initDataUnsafe?.user?.id || 0;
  document.getElementById("biz-name").innerText = myShopData
    ? myShopData.shopName
    : "Мой Магазин";

  // Фильтруем: только мои товары
  const myAds = ads.filter(
    (ad) => ad.userId === myId && ad.status !== "deleted"
  );

  container.innerHTML = "";
  if (myAds.length === 0) {
    container.innerHTML = `<p style="grid-column: 1/3; color:gray; text-align:center;">У вас пока нет товаров</p>`;
  } else {
    myAds.forEach((ad) => {
      const card = createAdCard(ad, true); // true означает режим профиля (с кнопками управления)
      container.appendChild(card);
    });
  }
}

// Функция для открытия формы (обычный товар или комбо)
let currentAddingType = "standard"; // Глобальная переменная

window.openAddForm = function (type) {
  currentAddingType = type;
  showPage("add");

  const comboBlock = document.getElementById("combo-fields");
  const titleText = document.getElementById("add-title-text");

  if (type === "combo") {
    titleText.innerText = "Создать КОМБО";
    comboBlock.classList.remove("hidden");
  } else {
    titleText.innerText = "Новый товар";
    comboBlock.classList.add("hidden");
  }
};
