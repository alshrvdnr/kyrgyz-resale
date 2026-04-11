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
// --- ПОЛНЫЙ КОД ПРОВЕРКИ РОЛИ ---
function checkUserRole(uid) {
  if (!uid) {
    console.error("Ошибка: UID не передан в checkUserRole");
    return;
  }

  // 1. Устанавливаем слушатель Firebase на папку пользователя
  // Используем .on('value'), чтобы приложение само менялось, если ты изменишь что-то в базе
  db.ref("users/" + uid).on("value", (snap) => {
    const userData = snap.val() || {};

    // Сохраняем данные в глобальную переменную (для использования в Storefront)
    myShopData = userData;

    // 2. ЛОГИКА ОПРЕДЕЛЕНИЯ РОЛИ (Приоритет сверху вниз)

    if (uid == MY_ADMIN_ID) {
      // ПЕРВЫЙ ПРИОРИТЕТ: Твой личный ID (Админ)
      currentUserRole = "admin";
      document.body.classList.add("is-admin");
      document.body.classList.remove("is-business");
      console.log("ROLE: Авторизован как Главный Администратор 👑");
    } else if (userData.role === "business") {
      // ВТОРОЙ ПРИОРИТЕТ: Если в базе стоит пометка 'business'
      currentUserRole = "business";
      document.body.classList.add("is-business");
      document.body.classList.remove("is-admin");
      console.log("ROLE: Авторизован как Магазин / Партнер 🛡️");
    } else {
      // ПО УМОЛЧАНИЮ: Обычный покупатель
      currentUserRole = "user";
      document.body.classList.remove("is-admin", "is-business");
      console.log("ROLE: Обычный пользователь 👤");
    }

    // 3. МГНОВЕННОЕ ОБНОВЛЕНИЕ ИНТЕРФЕЙСА
    // Проверяем, открыта ли сейчас страница профиля
    const profilePage = document.getElementById("page-profile");
    if (profilePage && !profilePage.classList.contains("hidden")) {
      // Если открыта — вызываем перерисовку (чтобы применился Storefront или Админка)
      if (typeof renderProfile === "function") {
        renderProfile();
      }
    }

    // Также обновляем имя в шапке, если оно там есть
    const uName = document.getElementById("u-name");
    if (uName) {
      if (currentUserRole === "admin")
        uName.innerText =
          (tg.initDataUnsafe?.user?.first_name || "Админ") + " 👑";
      else if (currentUserRole === "business")
        uName.innerText = myShopData.shopName || "Магазин";
      else uName.innerText = tg.initDataUnsafe?.user?.first_name || "Гость";
    }
  });
}
// -----------------------------------------------

const catMap = {
  flowers: "Цветы",
  jewelry: "Ювелирка",
  gifts: "Подарки",
  certs: "Сертификаты",
  kyrgyz: "Кыргыз Товарлары",
  Все: "Все",
};
const catTitles = {
  Все: "Свежие предложения",
  flowers: "Свежие цветы",
  gifts: "Свежие подарки",
  jewelry: "Свежая ювелирка",
  certs: "Свежие сертификаты",
  kyrgyz: "Кыргыз Товарлары",
};

let verifyPhotoFile = null; // Файл проверочного фото

let ads = [],
  curCat = "Все",
  favs = JSON.parse(localStorage.getItem("favs_v15")) || [];
let curCity = localStorage.getItem("selected_city_v15") || "bishkek",
  selectedTariff = "standard",
  editingId = null,
  selectedFiles = [],
  profTab = "active";

const CITY_COORDS = {
  bishkek: { lat: 42.87, lng: 74.59 },
  osh: { lat: 40.51, lng: 72.81 },
  manas: { lat: 43.06, lng: 74.47 },
  tokmok: { lat: 42.84, lng: 75.30 },
  karakol: { lat: 42.49, lng: 78.39 },
};

const CITY_NAMES = {
  bishkek: "Бишкек",
  osh: "Ош",
  manas: "Манас",
  tokmok: "Токмок",
  karakol: "Каракол"
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
  initSmartLocation(); // Автоматическое определение города и VPN
  
  // Резервный таймер для скрытия сплеша (на случай сбоя API)
  setTimeout(() => {
    const splash = document.getElementById("splash-screen");
    if (splash && !splash.classList.contains("hidden-splash")) {
      splash.classList.add("hidden-splash");
      renderFeed();
    }
  }, 4000); 
  // Удаляем обработчики старого поиска и добавляем для модалки
  const modalInput = document.getElementById("search-modal-input");
  if (modalInput) {
    modalInput.addEventListener("input", (e) => {
      showSearchSuggestionsModal(e.target.value);
    });
    modalInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        startSearch(e.target.value);
        modalInput.blur();
      }
    });
  }

  // Обновляем UI монетизации при смене города в форме подачи
  const cityIn = document.getElementById("in-city");
  if (cityIn) {
    cityIn.addEventListener("change", () => {
      applyHolidayUI();
    });
  }

  // Глобальный фикс для скрытия клавиатуры (нет кнопки Готово на мобилках)
  // 1. По клику вне поля
  document.addEventListener('touchstart', (e) => {
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
      if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        activeEl.blur();
      }
    }
  });

  // 2. По нажатию Enter/Go/Готово (если кнопка все же есть)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const activeEl = document.activeElement;
      // Для TextArea оставляем перенос строки (Enter),
      // а для обычных INPUT - скрываем клавиатуру.
      if (activeEl && activeEl.tagName === 'INPUT') {
        activeEl.blur();
      }
    }
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
// --- ПОЛНАЯ ФУНКЦИЯ ПРОФИЛЯ (АДМИН + БИЗНЕС + ЮЗЕР) ---
// --- ПОЛНАЯ И ЕДИНСТВЕННАЯ ФУНКЦИЯ ПРОФИЛЯ ---
function renderProfile() {
  const myId = tg.initDataUnsafe?.user?.id || 0;

  // 1. Находим все три контейнера
  const vAdmin = document.getElementById("view-admin");
  const vBusiness = document.getElementById("view-business");
  const vUser = document.getElementById("view-user");

  // Если какого-то блока нет в HTML, пишем ошибку и выходим
  if (!vAdmin || !vBusiness || !vUser) {
    console.error(
      "Критическая ошибка: Не найдены блоки view-admin/business/user в index.html"
    );
    return;
  }

  // 2. ОБЯЗАТЕЛЬНО: Скрываем все блоки перед отрисовкой
  // Это гарантирует, что интерфейсы не наложатся друг на друга
  vAdmin.classList.add("hidden");
  vBusiness.classList.add("hidden");
  vUser.classList.add("hidden");

  console.log("Текущая роль при отрисовке:", currentUserRole);

  // 3. ПРОВЕРКА РОЛИ И ПОКАЗ НУЖНОГО ЭКРАНА

  // --- А: РЕЖИМ АДМИНИСТРАТОРА ---
  if (currentUserRole === "admin") {
    vAdmin.classList.remove("hidden"); // Показываем только админку

    // Заполняем цифры в админ-панели
    renderAdminStats();

    // Запускаем мониторинг бота
    if (typeof monitorBotStatus === "function") {
      monitorBotStatus();
    }
    console.log("Отрисован: Экран Админа");
  }

  // --- Б: РЕЖИМ МАГАЗИНА (БИЗНЕС) ---
  else if (currentUserRole === "business") {
    vBusiness.classList.remove("hidden"); // Показываем только витрину

    // Рисуем баннер, логотип и название (WB Style)
    if (typeof updateStorefrontUI === "function") {
      updateStorefrontUI();
    }

    // Выводим товары магазина с быстрыми кнопками (Изменить цену/Скрыть)
    if (typeof renderBizAds === "function") {
      renderBizAds();
    }
    
    // ДОБАВЛЯЕМ VIP-РЕКОМЕНДАЦИИ И В ПРОФИЛЬ МАГАЗИНА
    renderVipRecommendations("biz-recommendations-grid", "biz-recommendations-header", myId);
    
    console.log("Отрисован: Экран Магазина");
  }

  // --- В: РЕЖИМ ОБЫЧНОГО ПОЛЬЗОВАТЕЛЯ (СТАРЫЙ ФОРМАТ) ---
  else {
    vUser.classList.remove("hidden"); // Показываем только обычный профиль

    // Обновляем имя
    const uNameSimple = document.getElementById("u-name-simple");
    if (uNameSimple) {
      uNameSimple.innerText =
        tg.initDataUnsafe?.user?.first_name || "Пользователь";
    }

    // Отрисовка товаров пользователя (Старая логика с кнопкой "Управление")
    const userGrid = document.getElementById("my-ads-grid");
    if (userGrid) {
      userGrid.innerHTML = "";

      // Берем только товары этого юзера
      const myAds = ads.filter((ad) => ad.userId === myId);

      // Фильтр по вкладкам Активные / Архив
      const filtered = myAds.filter((ad) =>
        profTab === "active" ? ad.status === "active" : ad.status === "sold"
      );

      if (filtered.length === 0) {
        userGrid.innerHTML = `<p style="text-align:center; color:gray; grid-column:1/3; margin-top:30px;">Пусто</p>`;
      } else {
        filtered.forEach((ad) => {
          // Вызываем createAdCard, она сама поймет (через роль), какую кнопку рисовать
          userGrid.appendChild(createAdCard(ad, true));
        });
      }
    }
    console.log("Отрисован: Экран Юзера");
  }
}

// --- ФУНКЦИЯ ДЛЯ ЦИФР АДМИНА И ЛЕНТЫ ---
function renderAdminStats() {
  const total = ads.length;
  const active = ads.filter((a) => a.status === "active").length;
  const sellers = new Set(ads.map((a) => a.userId)).size;

  if (document.getElementById("adm-total-ads"))
    document.getElementById("adm-total-ads").innerText = total;
  if (document.getElementById("adm-active-ads"))
    document.getElementById("adm-active-ads").innerText = active;
  if (document.getElementById("adm-active-users"))
    document.getElementById("adm-active-users").innerText = sellers;
}

// --- 4. ОТРИСОВКА ТОВАРОВ БИЗНЕСА МАГАЗИНА (С ТЕКУЩИМ УПРАВЛЕНИЕМ ДЛЯ АМДИНОВ/ВЛАДЕЛЬЦЕВ) ---
function renderBizAds() {
  const grid = document.getElementById("biz-ads-grid");
  if (!grid) return;
  grid.innerHTML = "";

  const myId = tg.initDataUnsafe?.user?.id || 0;

  // Фильтруем: только мои товары + статус (активные или архив)
  const myAds = ads.filter((ad) => ad.userId === myId);
  const filtered = myAds.filter((ad) =>
    profTab === "active"
      ? ad.status === "active" || ad.status === "hidden"
      : ad.status === "sold"
  );

  if (filtered.length === 0) {
    grid.innerHTML = `<p style="grid-column:1/3; text-align:center; color:gray; padding:40px;">Нет товаров</p>`;
    return;
  }

  filtered.forEach((ad) => {
    const card = createAdCard(ad, true); // true передаем, чтобы внутри createAdCard знать, что это режим владельца

    // ДОБАВЛЯЕМ ПАНЕЛЬ БЫСТРОГО УПРАВЛЕНИЯ прямо под карточку
    const managePanel = document.createElement("div");
    managePanel.className = "quick-manage-bar";
    managePanel.innerHTML = `
      <button class="btn-quick" onclick="event.stopPropagation(); quickEditPrice('${ad.id
      }', ${ad.price})">
        ${ad.price} KGS <i class="fa-solid fa-pen"></i>
      </button>
      <button class="btn-quick" onclick="event.stopPropagation(); quickToggleStatus('${ad.id
      }', '${ad.status}')">
        ${ad.status === "active" ? "👁️ Скрыть" : "👁️ Показать"}
      </button>
    `;
    card.appendChild(managePanel);
    grid.appendChild(card);
  });
}

// --- 5. ФУНКЦИИ БЫСТРОГО ДЕЙСТВИЯ ---
window.quickEditPrice = async function (adId, currentPrice) {
  const newPrice = prompt("Введите новую цену (KGS):", currentPrice);
  if (newPrice !== null && newPrice !== "" && !isNaN(newPrice)) {
    try {
      await db.ref("ads/" + adId).update({
        price: parseInt(newPrice),
        needs_sync_tg: true,
      });
      // Лента сама обновится через .on("value") в listenAds
    } catch (e) {
      alert("Ошибка при сохранении цены");
    }
  }
};

window.quickToggleStatus = async function (adId, currentStatus) {
  const newStatus = currentStatus === "active" ? "hidden" : "active";
  try {
    await db.ref("ads/" + adId).update({ status: newStatus });
  } catch (e) {
    alert("Ошибка при смене статуса");
  }
};

// 2. Функция заполнения Инста-шапки
// --- НОВАЯ ФУНКЦИЯ ОБНОВЛЕНИЯ ВИТРИНЫ (STOREFRONT) ---
function updateStorefrontUI() {
  if (!myShopData) {
    console.error("Ошибка: Данные myShopData не загружены.");
    return;
  }

  // 1. ОБНОВЛЯЕМ НАЗВАНИЕ МАГАЗИНА
  const nameEl = document.getElementById("biz-name-main");
  if (nameEl) {
    nameEl.innerText = myShopData.shopName || "Мой Магазин";
  }

  // 2. ОБНОВЛЯЕМ ЛОГОТИП
  const logoEl = document.getElementById("biz-logo-main");
  if (logoEl) {
    if (myShopData.logo) {
      logoEl.style.backgroundImage = `url('${myShopData.logo}')`;
      logoEl.innerText = "";
    } else {
      logoEl.style.backgroundImage = "none";
      logoEl.style.backgroundColor = "#2c2c2e";
      logoEl.innerText = myShopData.shopName ? myShopData.shopName[0].toUpperCase() : "?";
    }
  }

  // 3. ОБНОВЛЯЕМ БАННЕР (Большая обложка)
  const bannerEl = document.getElementById("biz-banner");
  if (bannerEl) {
    if (myShopData.cover) {
      bannerEl.style.backgroundImage = `url('${myShopData.cover}')`;
    } else {
      bannerEl.style.backgroundImage = "url('https://images.unsplash.com/photo-1513519245088-0e12902e5a38?q=80&w=1000')";
    }
  }

  // 4. ТЕКСТОВЫЕ ПОЛЯ
  const bioEl = document.getElementById("biz-bio-display");
  if (bioEl) bioEl.innerText = myShopData.bio || "Описание не заполнено.";

  const hoursEl = document.getElementById("biz-hours-display");
  if (hoursEl) hoursEl.innerText = myShopData.workHours || "09:00 - 20:00";

  const instEl = document.getElementById("biz-inst-display");
  if (instEl) {
    instEl.innerText = myShopData.instagram ? "@" + myShopData.instagram : "Не указан";
  }

  // 5. ОБНОВЛЯЕМ СТАТИСТИКУ
  const viewsEl = document.getElementById("biz-views-count");
  if (viewsEl) {
    viewsEl.innerText = myShopData.views || "0";
  }

  console.log("Интерфейс витрины обновлен");
}

// Загрузка фото обложки или лого (Сразу в Firebase)
window.handleBizMedia = async function (input, type) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  const loader = document.getElementById("media-upload-loader");

  if (loader) loader.classList.remove("hidden");

  try {
    const url = await uploadFile(file);
    if (!url) throw new Error("Не удалось загрузить файл");

    const myId = tg.initDataUnsafe?.user?.id || getUserId();

    // Обновляем нужный параметр
    const updatePayload = {};
    if (!myShopData) myShopData = {};

    if (type === 'cover') {
      updatePayload.cover = url;
      myShopData.cover = url;
    } else if (type === 'logo') {
      updatePayload.logo = url;
      myShopData.logo = url;
    }

    await db.ref("users/" + myId).update(updatePayload);

    // Мгновенно обновляем UI
    updateStorefrontUI();

  } catch (e) {
    alert("Ошибка загрузки: " + e.message);
  } finally {
    if (loader) loader.classList.add("hidden");
    input.value = ""; // Сбрасываем input
  }
};

// ЕДИНАЯ ФУНКЦИЯ СОХРАНЕНИЯ ПРОФИЛЯ МАГАЗИНА
window.saveBizProfile = async function () {
  const myId = tg.initDataUnsafe?.user?.id || getUserId();
  if (!myId) return;

  const newName = document.getElementById("edit-biz-name")?.value || myShopData.shopName;
  const newBio = document.getElementById("edit-biz-bio")?.value || "";
  const newHours = document.getElementById("edit-biz-hours")?.value || "";
  const newInst = document.getElementById("edit-biz-inst")?.value || "";

  const newPhone = document.getElementById("edit-biz-phone")?.value || "";
  const newTg = document.getElementById("edit-biz-tg")?.value || "";
  const newAddr = document.getElementById("edit-biz-address")?.value || "";

  try {
    await db.ref("users/" + myId).update({
      shopName: newName,
      bio: newBio,
      workHours: newHours,
      instagram: newInst,
      phone: newPhone,
      tgNick: newTg,
      address: newAddr,
    });

    if (!myShopData) myShopData = {};
    myShopData.shopName = newName;
    myShopData.bio = newBio;
    myShopData.workHours = newHours;
    myShopData.instagram = newInst;
    myShopData.phone = newPhone;
    myShopData.tgNick = newTg;
    myShopData.address = newAddr;

    if (typeof closeEditBizModal === "function") closeEditBizModal();
    updateStorefrontUI();

  } catch (e) {
    console.error("Ошибка при сохранении профиля:", e);
    alert("Не удалось сохранить: " + e.message);
  }
};

window.openEditBizModal = function () {
  const nameInput = document.getElementById("edit-biz-name");
  if (nameInput) nameInput.value = myShopData.shopName || "";

  const bioInput = document.getElementById("edit-biz-bio");
  if (bioInput) bioInput.value = myShopData.bio || "";

  const hoursInput = document.getElementById("edit-biz-hours");
  if (hoursInput) hoursInput.value = myShopData.workHours || "";

  const instInput = document.getElementById("edit-biz-inst");
  if (instInput) instInput.value = myShopData.instagram || "";
  
  const phoneInput = document.getElementById("edit-biz-phone");
  if (phoneInput) phoneInput.value = myShopData.phone || "";
  
  const tgInput = document.getElementById("edit-biz-tg");
  if (tgInput) tgInput.value = myShopData.tgNick || "";
  
  const addrInput = document.getElementById("edit-biz-address");
  if (addrInput) addrInput.value = myShopData.address || "";

  document.getElementById("edit-biz-modal").classList.remove("hidden");
};

window.closeEditBizModal = function () {
  document.getElementById("edit-biz-modal").classList.add("hidden");
};

// 4. Сохранение данных в Firebase

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
  // Мы больше не форсируем переход на business-admin для бизнеса/админа
  // При нажатии + Товар, они должны переходить напрямую к форме

  
  // 3. Показываем нужную страницу
  // ЕСЛИ ЭТО ДОБАВИТЬ ТОВАР И ЮЗЕР = БИЗНЕС
  let finalPage = p;
  if (p === "add") {
    const isBiz = (currentUserRole === "business"); // Only business gets the special form
    const bizFields = document.getElementById("biz-only-fields");
    const titleText = document.getElementById("add-title-text");
    const tariffBlock = document.getElementById("tariff-block");
    const verificationBlock = document.getElementById("verification-block");
    const vipBlock = document.getElementById("vip-block");
    
    // Default user contact groups
    const addressGroup = document.getElementById("address-group");
    const tgGroup = document.getElementById("tg-group");
    const phoneGroup = document.getElementById("phone-group");
    
    if (isBiz) {
       if (bizFields) bizFields.classList.remove("hidden");
       if (titleText) titleText.innerText = "Новый товар магазина";
       if (tariffBlock) tariffBlock.classList.add("hidden");
       if (verificationBlock) verificationBlock.classList.add("hidden");
       if (vipBlock) vipBlock.classList.add("hidden");
       if (addressGroup) addressGroup.classList.add("hidden");
       if (tgGroup) tgGroup.classList.add("hidden");
       if (phoneGroup) phoneGroup.classList.add("hidden");
    } else {
       if (bizFields) bizFields.classList.add("hidden");
       if (titleText) titleText.innerText = "Новое объявление";
       if (tariffBlock) tariffBlock.classList.remove("hidden");
       if (verificationBlock) verificationBlock.classList.remove("hidden");
       // we do not remove hidden from vipBlock entirely, selectTariff logic handles it, but user starts with 'standard'.
      if (window.selectedTariff !== 'vip' && vipBlock) vipBlock.classList.add("hidden");
       if (addressGroup) addressGroup.classList.remove("hidden");
       if (tgGroup) tgGroup.classList.remove("hidden");
       if (phoneGroup) phoneGroup.classList.remove("hidden");
    }
    
    // СИНХРОНИЗАЦИЯ: Устанавливаем город в форме таким же, какой выбран в приложении
    const cityIn = document.getElementById("in-city");
    if (cityIn && !editingId) {
      cityIn.value = curCity;
    }

    // ВАЖНО: Применяем UI монетизации с учетом теперь уже точно правильного города
    applyHolidayUI();
  }

  const targetPage = document.getElementById(`page-${finalPage}`);
  if (targetPage) {
    targetPage.classList.remove("hidden");
  } else {
    console.error("Страница не найдена: page-" + p);
  }

  // 4. УПРАВЛЕНИЕ ШАПКОЙ (Поиск и Город)
  // Шапка видна ТОЛЬКО на главной. На остальных (профиль, офис, подача) — плавно убираем.
  const header = document.getElementById("dynamic-header");
  const bottomNav = document.querySelector(".bottom-nav");

  if (header) {
    if (p === "home") {
      header.classList.remove("header-hidden");
    } else {
      header.classList.add("header-hidden");
    }
  }

  // При переключении страницы всегда показываем нижнюю панель (сбрасываем скрытие от скролла)
  if (bottomNav) {
    bottomNav.classList.remove("bottom-nav-hidden");
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

  // Если открыли страницу админки бизнеса
  if (p === "business-admin") {
    if (typeof renderBusinessDashboard === "function")
      renderBusinessDashboard();
  }

  // Если открыли новую вкладку магазинов
  if (p === "shops") {
    if (typeof renderShopsLine === "function") renderShopsLine();
    if (typeof renderShopsFeed === "function") renderShopsFeed();
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
      // Превращаем объект из базы в массив для удобной работы
      ads = data
        ? Object.keys(data).map((key) => ({ id: key, ...data[key] }))
        : [];

      // Отрисовываем ленты
      renderFeed();
      renderProfile();
      if (document.getElementById("page-shops") && !document.getElementById("page-shops").classList.contains("hidden")) {
        renderShopsLine();
        renderShopsFeed();
      }
      if (splash && !splash.classList.contains("hidden-splash")) {
        splash.classList.add("hidden-splash");
        // ПРИНУДИТЕЛЬНО: Еще раз рендерим фид после скрытия сплеша для гарантии
        setTimeout(() => renderFeed(), 100);

        // --- 1. ЛОГИКА ПАРАМЕТРОВ TELEGRAM (Deep Linking) ---
        // Это сработает, если ссылка была t.me/bot/app?startapp=ID
        const startParam = tg.initDataUnsafe?.start_param;
        if (startParam) {
          console.log("Обнаружена прямая ссылка на объявление:", startParam);
          // Ищем объявление с таким ID в нашем массиве ads
          const targetAd = ads.find((a) => a.id === startParam);
          if (targetAd) {
            // Если нашли — открываем его модальное окно
            openProduct(targetAd);
          }
        }

        // --- 2. ЛОГИКА ПЕРЕХОДА ПО ХЭШАМ (Из твоего старого кода) ---
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
      // Убираем сплеш даже при ошибке, чтобы юзер не застрял
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

window.applyHolidayUI = function() {
  const vBlock = document.getElementById("vip-block");
  const priceStd = document.getElementById("price-std");
  const priceVip = document.getElementById("price-vip");
  const labelStd = document.getElementById("label-std");
  const cityInput = document.getElementById("in-city");

  if (!priceStd || !priceVip || !cityInput) return;

  const currentVal = (cityInput.value || "").toLowerCase().trim();
  const currentText = (cityInput.options[cityInput.selectedIndex]?.text || "").toLowerCase().trim();

  // Список ПЛАТНЫХ городов (Бишкек во всех вариантах)
  const isBishkek = 
    currentVal === "bishkek" || 
    currentVal === "бишкек" || 
    currentText === "бишкек" || 
    currentVal === ""; // По умолчанию Бишкек

  if (isBishkek) {
    if (labelStd) labelStd.innerText = "Стандарт";
    priceStd.innerText = "100 сом";
    priceStd.style.color = ""; // Сбрасываем цвет
    priceVip.innerText = "200 сом";
    if (vBlock) vBlock.classList.remove("hidden");
  } else {
    // ДЛЯ ОСТАЛЬНЫХ ГОРОДОВ (Ош, Манас и т.д.)
    if (labelStd) labelStd.innerText = "Стандарт";
    priceStd.innerText = "Бесплатно";
    priceStd.style.color = "#4cd964"; // ЗЕЛЕНЫЙ ЦВЕТ ДЛЯ МОМЕНТАЛЬНОГО ПОДТВЕРЖДЕНИЯ
    priceVip.innerText = "100 сом";
    if (vBlock) {
      if (selectedTariff === "vip") vBlock.classList.remove("hidden");
      else vBlock.classList.add("hidden");
    }
  }
};

// глобальный фильтр ленты
window.currentFeedFilter = 'all';
window.setFeedFilter = function (opt) {
  window.currentFeedFilter = opt;

  const btnAll = document.getElementById("f-btn-all");
  const btnResale = document.getElementById("f-btn-resale");
  if (btnAll && btnResale) {
    if (opt === "all") {
      btnAll.style.color = "var(--yellow-main)";
      btnAll.style.borderBottom = "2px solid var(--yellow-main)";
      btnResale.style.color = "gray";
      btnResale.style.borderBottom = "2px solid transparent";
    } else {
      btnResale.style.color = "var(--yellow-main)";
      btnResale.style.borderBottom = "2px solid var(--yellow-main)";
      btnAll.style.color = "gray";
      btnAll.style.borderBottom = "2px solid transparent";
    }
  }

  // При переключении на глобальный фильтр сбрасываем категорию
  if (opt === 'all' || opt === 'resale') {
    window.curCat = 'Все';
    const titleEl = document.getElementById("dynamic-feed-title");
    if (titleEl) titleEl.innerText = opt === 'all' ? "Свежие предложения" : "Ресейл предложения";

    // Снимаем выделение со всех категорий в карусели
    document.querySelectorAll(".cat-card").forEach((i) => i.classList.remove("active"));
  }

  renderFeed();
};

// 5. ЛЕНТА И КАРТОЧКИ
function renderFeed() {
  const grid = document.getElementById("home-grid");
  if (!grid) return;
  grid.innerHTML = "";

  // 1. ФИЛЬТРАЦИЯ ОБЪЯВЛЕНИЙ
  let filtered = ads.filter((ad) => {
    // 0. ФИЛЬТР ПО РЕСЕЙЛУ И МАГАЗИНАМ
    if (window.currentFeedFilter === "resale") {
      if (ad.isShop) return false; // В "Ресейл" скрываем магазины, оставляем только обычные
    }
    // Во вкладке "Все" показываем и магазины, и обычные
    // А. Проверка категории
    const catMatch = curCat === "Все" || ad.cat === curCat;

    // Б. Проверка города (самое важное!)
    const targetCityName = (CITY_NAMES[curCity] || "").toLowerCase();
    const adCityLow = (ad.city || "").toLowerCase().trim();
    const cityMatch = ad.city_key === curCity || 
                      adCityLow === targetCityName || 
                      adCityLow === curCity.toLowerCase();
    
    // console.log(`Checking ad: ${ad.title}, City: ${ad.city}, Target: ${targetCityName}, Match: ${cityMatch}`);

    // В. Проверка статуса
    const statusMatch =
      ad.status !== "deleted" &&
      ad.status !== "pending" &&
      ad.status !== "rejected";

    return catMatch && cityMatch && statusMatch;
  });

  // 2. СОРТИРОВКА
  const now = Math.floor(Date.now() / 1000);
  const threeDays = 259200;

  let vips = [];
  let regulars = [];
  let shops = [];
  let sold = [];

  // Разделяем на группы
  filtered.forEach(ad => {
    if (ad.status === "sold") {
      sold.push(ad);
      return;
    }

    // Проверка VIP
    const adTime = Number(ad.approvedAt || ad.createdAt || 0);
    const isVip = ad.tariff === "vip" && (now - adTime < threeDays);

    if (isVip) {
      vips.push(ad);
    } else if (ad.isShop) {
      shops.push(ad);
    } else {
      regulars.push(ad);
    }
  });

  // VIP и Regular сортируем по времени
  const sortByTime = (a, b) => Number(b.approvedAt || b.createdAt || 0) - Number(a.approvedAt || a.createdAt || 0);
  vips.sort(sortByTime);
  regulars.sort(sortByTime);

  // Магазины просто перемешиваем случайным образом
  for (let i = shops.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shops[i], shops[j]] = [shops[j], shops[i]];
  }

  // Внедряем перемешанные магазины в ленту обычных товаров
  // Если у нас нет обычных товаров, просто объединяем
  let interleaved = [...regulars];
  shops.forEach(shopAd => {
    // Случайный индекс для вставки: от 0 до текущей длины массива interleaved
    const dropIndex = Math.floor(Math.random() * (interleaved.length + 1));
    interleaved.splice(dropIndex, 0, shopAd);
  });

  // Итоговый массив: VIP -> Смешанные -> Проданные
  const finalArray = [...vips, ...interleaved, ...sold];

  // 3. ОТРИСОВКА КАРТОЧЕК
  if (finalArray.length === 0) {
    grid.innerHTML = `<p style="text-align:center; color:gray; grid-column: 1/3; margin-top:50px;">В этом городе пока нет объявлений</p>`;
  } else {
    finalArray.forEach((ad) => grid.appendChild(createAdCard(ad)));
  }
}

// --- ПОЛНАЯ ФУНКЦИЯ ОТРИСОВКИ КАРТОЧКИ ТОВАРА ---
function createAdCard(ad, isProfile = false) {
  // 1. ПОДГОТОВКА ДАННЫХ
  const displayPrice = String(ad.price).replace(/[^0-9]/g, "") || "0";
  const isFav = favs.includes(ad.id);
  const isSold = ad.status === "sold";

  // 2. ЛОГИКА VIP (3 дня)
  const now = Math.floor(Date.now() / 1000);
  const approvedTime = Number(ad.approvedAt || ad.createdAt || 0);
  const threeDaysInSeconds = 259200;
  const isVip =
    ad.tariff === "vip" && !isSold && now - approvedTime < threeDaysInSeconds;

  // 3. СОЗДАНИЕ КОНТЕЙНЕРА КАРТОЧКИ
  const card = document.createElement("div");
  card.className = `card ${isVip ? "card-vip" : ""} ${ad.status === "deleted" ? "card-deleted" : ""
    }`;

  // Клик по карточке открывает детальный просмотр
  card.onclick = () => openProduct(ad);

  // 4. ГЕНЕРАЦИЯ БЛОКА УПРАВЛЕНИЯ (Кнопки под товаром)
  let managementHtml = "";

  // А: БЛОК ДЛЯ АДМИНИСТРАТОРА (Виден тебе на любой карточке в приложении)
  if (currentUserRole === "admin") {
    managementHtml += `
      <div style="margin-top:10px; padding-top:10px; border-top:1px dashed rgba(255,255,255,0.2);">
        <div style="font-size:10px; color:#ff3b30; margin-bottom:5px; font-family:monospace; font-weight:bold;">
          ID ПРОДАВЦА: <code>${ad.userId}</code>
        </div>
        <button onclick="event.stopPropagation(); adminDeleteAd('${ad.id}')" 
                style="width:100%; background:#ff3b30; color:#fff; border:none; padding:8px; border-radius:8px; font-size:10px; font-weight:bold; cursor:pointer; text-transform:uppercase;">
          УДАЛИТЬ (АДМИН)
        </button>
      </div>
    `;
  }

  // Б: БЛОК ДЛЯ ОБЫЧНОГО ПОЛЬЗОВАТЕЛЯ (Только в его личном профиле)
  // Показываем желтую кнопку "Управление", только если роль - user и мы в профиле
  else if (isProfile && currentUserRole === "user" && ad.status === "active") {
    managementHtml += `
      <button onclick="event.stopPropagation(); openManageModal('${ad.id}')" 
              style="width:100%; background:var(--yellow-main); color:#000; border:none; padding:10px; border-radius:10px; font-size:11px; font-weight:900; margin-top:10px; cursor:pointer;">
        УПРАВЛЕНИЕ
      </button>
    `;
  }

  // 5. СБОРКА ВНУТРЕННЕГО HTML КАРТОЧКИ
  card.innerHTML = `
    <!-- Бейджи статусов -->
    ${isSold ? '<div class="sold-badge">ПРОДАНО</div>' : ""}
    ${isVip ? '<div class="vip-badge">VIP</div>' : ""}
    ${ad.isCombo ? '<div class="combo-badge">КОМБО 🔥</div>' : ""}

    <!-- Сердечко (только в общей ленте) -->
    ${!isProfile
      ? `
      <div class="fav-heart-btn ${isFav ? "active" : ""}" 
           onclick="toggleFav('${ad.id}', event)">
        <i class="fa-solid fa-heart"></i>
      </div>`
      : ""
    }

    <!-- Изображение товара -->
    <img src="${ad.img ? ad.img[0] : ""}" loading="lazy">
    
    <div style="padding:10px;">
      <!-- Цена и Дата -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
        <div style="color:var(--yellow-main); font-weight:bold; font-size:15px;">${displayPrice} KGS</div>
        <div style="color:var(--gray); font-size:10px;">${formatRelativeDate(
      ad.approvedAt || ad.createdAt
    )}</div>
      </div>
      
      <!-- Заголовок -->
      <div style="font-size:12px; color:#ccc; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
        ${ad.title}
      </div>
      
      <!-- Сюда вставится блок управления (Админ или Юзер) -->
      ${managementHtml}
    </div>
  `;

  return card;
}

// Вспомогательная функция для админа
window.adminDeleteAd = async function (adId) {
  if (
    !confirm(
      "Внимание! Вы удаляете чужое объявление. Отправить запрос боту на удаление?"
    )
  )
    return;
  try {
    // Пишем запрос в специальную папку, которую бот проверяет
    await db.ref("management_requests").push({
      adId: adId,
      action: "delete",
      userId: tg.initDataUnsafe?.user?.id || 0,
      processed: false,
      timestamp: Date.now(),
    });
    alert(
      "Запрос отправлен боту! Пост исчезнет из всех каналов и с сайта в течение 20 секунд."
    );
  } catch (e) {
    alert("Ошибка отправки запроса: " + e.message);
  }
};

// 6. МОДАЛКА И КОНТАКТЫ
function openProduct(ad) {
  // 1. ПЕРВИЧНАЯ ПРОВЕРКА
  // Если данных нет, выходим, чтобы не вызвать ошибку
  if (!ad) {
    console.error("Ошибка: Данные объявления не получены");
    return;
  }

  const modal = document.getElementById("product-modal");
  const pvContent = document.getElementById("pv-content");

  if (!modal || !pvContent) return;

  try {
    // 2. ПОДГОТОВКА ДАННЫХ (с защитой от пустых полей)
    const isSold = ad.status === "sold";
    const isFav = favs.includes(ad.id);
    const isVerified = ad.verified === true;

    // Проверка прав админа (по роли или по ID из конфига)
    const isAdmin =
      currentUserRole === "admin" || tg.initDataUnsafe?.user?.id == MY_ADMIN_ID;

    // Безопасные переменные (подставляем заглушки, если данных нет в базе)
    const price = ad.price || "0";
    const title = ad.title || "Без названия";
    const categoryName = catMap[ad.cat] || "Товар";
    const description = ad.desc || "Описание не указано";
    const city = ad.city || "Город не указан";
    const address = ad.address || "—";
    const phone = ad.phone || ad.whatsapp || "—";
    const telegramNick = ad.tgNick || "";
    const receiveDate = ad.receiveDate || "—";

    // Защита от ошибки .toUpperCase() если поля tariff нет
    const tariff = (ad.tariff || "standard").toUpperCase();

    const displayDate =
      typeof formatRelativeDate === "function"
        ? formatRelativeDate(ad.approvedAt || ad.createdAt)
        : "Недавно";

    // Формируем ссылку для связи
    let contactLink = telegramNick
      ? `https://t.me/${telegramNick.replace("@", "")}`
      : `https://wa.me/${phone.replace(/[^0-9]/g, "")}`;

    // 3. ГЕНЕРАЦИЯ ТОЧЕК КАРУСЕЛИ
    let dots = "";
    if (ad.img && Array.isArray(ad.img)) {
      dots = ad.img
        .map(
          (_, i) => `
        <div class="dot ${i === 0 ? "active" : ""}" id="dot-${ad.id
            }-${i}"></div>
      `
        )
        .join("");
    }

    // 4. СБОРКА HTML
    pvContent.innerHTML = `
      <div class="modal-carousel-container">
        <!-- Кнопка закрытия -->
        <i class="fa fa-arrow-left" onclick="closeProduct()" style="position:absolute; top:20px; left:20px; z-index:100; background:rgba(0,0,0,0.5); padding:10px; border-radius:50%; color:#fff; cursor:pointer;"></i>
        
        <!-- Кнопка Избранное -->
        <i class="fa-solid fa-heart" onclick="toggleFav('${ad.id
      }')" style="position:absolute; top:20px; right:20px; z-index:100; font-size:24px; color:${isFav ? "var(--yellow-main)" : "#fff"
      }; cursor:pointer;"></i>

        <!-- Слайдер картинок -->
        <div class="product-gallery-slider" id="slider-${ad.id}">
          ${ad.img && Array.isArray(ad.img)
        ? ad.img.map((src) => `<img src="${src}" alt="product">`).join("")
        : '<div style="display:flex; align-items:center; justify-content:center; height:100%; color:gray;">Нет фото</div>'
      }
        </div>
        <div class="carousel-dots">${dots}</div>
      </div>

      <div style="padding:20px;">
        <!-- БЛОК ЦЕНЫ И ДАТЫ -->
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:15px;">
          <div style="font-size:28px; font-weight:800; color:var(--yellow-main);">${price} KGS</div>
          <div style="display:flex; flex-direction:column; align-items:flex-end; gap:5px;">
            <div style="color:var(--gray); font-size:11px;">${displayDate}</div>
            <div style="font-size:11px; color:#4cd964; font-weight:bold; background:rgba(76,217,100,0.1); padding:4px 8px; border-radius:6px;">
               Поступление: ${receiveDate}
            </div>
          </div>
        </div>

        <!-- НАЗВАНИЕ И КАТЕГОРИЯ -->
        <div style="margin-bottom:20px; font-size:18px; font-weight:700; color:#fff;">
          <b>${categoryName}</b> — ${title} ${isVerified ? "🔵" : ""}
        </div>

        <!-- БАННЕР БЕЗОПАСНОСТИ -->
        <div style="background: rgba(255, 59, 48, 0.1); border: 1px solid #ff3b30; border-radius: 15px; padding: 15px; margin-bottom: 25px; display: flex; gap: 12px; align-items: center;">
          <i class="fa-solid fa-shield-halved" style="color: #ff3b30; font-size: 22px;"></i>
          <div style="font-size: 13px; color: #eee; line-height: 1.4;">
            <b>БЕЗОПАСНОСТЬ:</b> Никогда не отправляйте предоплату! Старайтесь проверять товар через видеозвонок или при личной встрече.
          </div>
        </div>
        
        <!-- КНОПКА СВЯЗИ ИЛИ СТАТУС ПРОДАНО -->
        ${isSold
        ? `<div style="background:#333; padding:18px; border-radius:15px; color:#ff3b30; text-align:center; font-weight:800; margin-bottom:20px; text-transform:uppercase;">Продано</div>`
        : `<a href="${contactLink}" class="btn-premium-unity" style="text-decoration:none; margin-bottom:20px; display:block;">Написать продавцу</a>`
      }

        <!-- СОСТАВ КОМБО (если есть) -->
        ${ad.isCombo && ad.comboItems
        ? `
          <div class="combo-items-list" style="margin-bottom: 25px; background: rgba(255,204,0,0.05); padding: 15px; border-radius: 12px; border: 1px dashed var(--yellow-main);">
            <div style="font-weight:bold; color:var(--yellow-main); margin-bottom:10px; font-size:14px;">В наборе:</div>
            ${ad.comboItems
          .split(",")
          .map(
            (item) => `
              <div style="display:flex; align-items:center; gap:8px; font-size:14px; color:#eee; margin-bottom:6px;">
                <i class="fa-solid fa-circle-check" style="color:var(--yellow-main); font-size:12px;"></i>
                <div>${item.trim()}</div>
              </div>
            `
          )
          .join("")}
            ${ad.comboBenefit
          ? `<div style="margin-top:10px; font-size:12px; color:#4cd964; font-weight:bold;">🔥 Выгода: ${ad.comboBenefit}</div>`
          : ""
        }
          </div>
        `
        : ""
      }

        <!-- ДАННЫЕ МАГАЗИНА (ПЕСЛИ ЕСТЬ) -->
        ${(ad.shelfLife || ad.season || ad.productionTime) ? `
          <div style="background:#222224; padding:15px; border-radius:12px; margin-bottom:20px; border:1px solid #333;">
             <div style="font-weight:bold; color:var(--yellow-main); margin-bottom:10px; font-size:14px;"><i class="fa-solid fa-list-check"></i> Характеристики:</div>
             ${ad.shelfLife ? `<div style="font-size:13px; color:#ccc; margin-bottom:5px;"><b>Срок хранения:</b> ${ad.shelfLife}</div>` : ''}
             ${ad.season ? `<div style="font-size:13px; color:#ccc; margin-bottom:5px;"><b>Сезон:</b> ${ad.season}</div>` : ''}
             ${ad.productionTime ? `<div style="font-size:13px; color:#ccc; margin-bottom:5px;"><b>Изготовление:</b> ${ad.productionTime}</div>` : ''}
          </div>
        ` : ""}

        <!-- ОПИСАНИЕ -->
        <div style="background:#2c2c2e; padding:15px; border-radius:12px; margin-bottom:25px; white-space: pre-wrap; font-size:15px; color:#ccc; line-height:1.5;">
          ${description}
        </div>

        <!-- КОНТАКТНАЯ ИНФОРМАЦИЯ -->
        <div style="background:#1c1c1e; padding:18px; border-radius:15px; border:1px solid #333; display:flex; flex-direction:column; gap:15px;">
           <div style="display:flex; align-items:center; gap:12px;">
              <i class="fa-solid fa-location-dot" style="color:#ff3b30; font-size:18px; width:20px; text-align:center;"></i>
              <div style="font-size:14px; color:#fff;">${city}, ${address}</div>
           </div>
           <div style="display:flex; align-items:center; gap:12px;">
              <i class="fa-solid fa-phone" style="color:var(--yellow-main); font-size:16px; width:20px; text-align:center;"></i>
              <div style="font-size:14px; color:#fff;">${phone}</div>
           </div>
           ${telegramNick
        ? `
             <div style="display:flex; align-items:center; gap:12px;">
                <i class="fa-brands fa-telegram" style="color:#0088cc; font-size:20px; width:20px; text-align:center;"></i>
                <div style="font-size:14px; color:#fff;">${telegramNick}</div>
             </div>
           `
        : ""
      }
        </div>
        
        <!-- КНОПКА ЖАЛОБЫ -->
        <div onclick="reportAd('${ad.id}', '${ad.userId
      }')" style="background:rgba(255,204,0,0.05); color:var(--yellow-main); border:1px solid rgba(255,204,0,0.2); padding:12px; border-radius:12px; text-align:center; font-size:13px; font-weight:bold; cursor:pointer; margin-top:25px;">
          Пожаловаться на мошенника
        </div>

        <!-- СПЕЦИАЛЬНЫЙ БЛОК ДЛЯ АДМИНИСТРАТОРА -->
        ${isAdmin
        ? `
          <div style="margin-top:35px; padding:18px; background:rgba(255,59,48,0.1); border:1px solid #ff3b30; border-radius:15px;">
            <div style="color:#ff3b30; font-weight:bold; margin-bottom:12px; font-size:14px; text-transform:uppercase; letter-spacing:1px;">Админ-панель управления</div>
            <div style="font-size:12px; color:#fff; display:flex; flex-direction:column; gap:10px; font-family:monospace;">
              <div>🆔 ID Продавца: <span style="color:var(--yellow-main)">${ad.userId || "не указан"
        }</span></div>
              <div>📅 Дата публикации: ${new Date(
          (ad.approvedAt || ad.createdAt || 0) * 1000
        ).toLocaleString()}</div>
              <div>📑 ID Объявления: ${ad.id}</div>
              <div>🎫 Тарифный план: ${tariff}</div>
            </div>
            <button onclick="adminDeleteAd('${ad.id
        }')" style="width:100%; background:#ff3b30; color:#fff; border:none; padding:14px; border-radius:12px; margin-top:18px; font-weight:bold; cursor:pointer; text-transform:uppercase; font-size:12px;">УДАЛИТЬ ПОСТ (АДМИН)</button>
          </div>
        `
        : ""
      }
      </div>
    `;

    // 5. ИНИЦИАЛИЗАЦИЯ СКРОЛЛА КАРУСЕЛИ
    const slider = document.getElementById(`slider-${ad.id}`);
    if (slider) {
      slider.onscroll = () => {
        let idx = Math.round(slider.scrollLeft / slider.offsetWidth);
        document
          .querySelectorAll(`[id^="dot-${ad.id}"]`)
          .forEach((d, i) => d.classList.toggle("active", i === idx));
      };
    }

    // 6. ПОКАЗ МОДАЛКИ
    modal.classList.remove("hidden");
    tg.BackButton.show();
    tg.BackButton.onClick(closeProduct);
  } catch (error) {
    console.error("Критическая ошибка при отрисовке объявления:", error);
    alert(
      "Не удалось загрузить данные этого объявления. Пожалуйста, сообщите администратору."
    );
  }
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

  // Проверка анти-спама для обычных юзеров (1 пост в минуту)
  if (!isPartner && !editingId) {
    const lastPost = localStorage.getItem("last_post_time");
    if (lastPost && Date.now() - lastPost < 60000) {
      const waitSec = Math.ceil((60000 - (Date.now() - lastPost)) / 1000);
      return alert(`Слишком часто! Подождите ${waitSec} сек.`);
    }
  }

  // --- 2. ВКЛЮЧАЕМ ИНФОРМАТИВНЫЙ ЛОАДЕР ---
  const overlay = document.getElementById("upload-overlay");
  const lTitle = document.getElementById("loader-title");
  const lText = document.getElementById("loader-text");
  const lBtn = document.getElementById("loader-error-btn");
  const lVisual = document.getElementById("loader-visual");

  if (overlay) {
    overlay.classList.remove("hidden");
    lTitle.innerText = "ЗАГРУЗКА...";
    lVisual.classList.remove("error-shake");
    lVisual.classList.add("pulse-heart");
    lVisual.style.color = "var(--yellow-main)";
    lBtn.classList.add("hidden");
    lText.innerHTML =
      "Начинаем процесс публикации...<br><b>ПОЖАЛУЙСТА, НЕ ЗАКРЫВАЙТЕ ОКНО!</b>";
  }

  try {
    // ИСПРАВЛЕНО: Используем твою функцию getUserId()
    const myId = getUserId();

    // --- 3. ЛОГИКА РЕДАКТИРОВАНИЯ (если обновляем старое) ---
    if (editingId) {
      lText.innerText = "Сохраняем изменения текста...";
      await db.ref("ads/" + editingId).update({
        title: cleanTitle,
        price: numericPrice,
        address: document.getElementById("in-address").value,
        phone: document.getElementById("in-wa").value,
        desc: document.getElementById("in-desc").value,
        needs_sync_tg: true, // Пометка для бота на Hetzner обновить пост в ТГ
      });

      finishUpload("Изменения успешно сохранены!");
      return;
    }

    // --- 4. ПОДГОТОВКА ФАЙЛОВ И ДАННЫХ ---
    const catSelect = document.getElementById("in-cat");
    const citySelect = document.getElementById("in-city");

    // Проверки перед загрузкой для обычных юзеров
    if (!isPartner) {
      const cityIn = document.getElementById("in-city");
      const isBishkek = cityIn ? cityIn.value === "bishkek" : true;
      const isPaid = isBishkek || selectedTariff === "vip";
      
      if (isPaid && !receiptAttached)
        throw new Error("Необходимо прикрепить чек об оплате!");
      if (!verifyPhotoFile)
        throw new Error("Загрузите проверочное фото с кодом!");
    }

    if (selectedFiles.length === 0)
      throw new Error("Добавьте хотя бы одну фотографию товара!");

    // ШАГ А: Загрузка чека (если нужно)
    let receiptUrl = "";
    const cityIn = document.getElementById("in-city");
    const isBishkek = cityIn ? cityIn.value === "bishkek" : true;
    const isPaid = isBishkek || selectedTariff === "vip";

    if (!isPartner && isPaid) {
      lText.innerText = "Загружаем чек об оплате...";
      const receiptFile = document.getElementById("receipt-input").files[0];
      if (receiptFile) receiptUrl = await uploadFile(receiptFile);
    }

    // ШАГ Б: Загрузка проверочного фото
    let verifyPhotoUrl = "";
    if (verifyPhotoFile) {
      lText.innerText = "Загружаем проверочное фото с кодом...";
      verifyPhotoUrl = await uploadFile(verifyPhotoFile);
    }

    // ШАГ В: Загрузка основных фотографий товара (по очереди)
    const validImgs = [];
    for (let i = 0; i < selectedFiles.length; i++) {
      lText.innerHTML = `Загрузка фото товара (${i + 1} из ${selectedFiles.length
        })...<br><b>Осталось еще немного.</b>`;
      const url = await uploadFile(selectedFiles[i]);
      if (url) validImgs.push(url);
    }

    if (validImgs.length === 0)
      throw new Error("Ошибка при загрузке изображений. Проверьте соединение.");

    // --- 5. ФОРМИРОВАНИЕ ОБЪЕКТА ДЛЯ БАЗЫ ДАННЫХ ---
    lText.innerText = "Финальный этап: Синхронизация с базой...";

    const newAd = {
      title: cleanTitle,
      price: numericPrice,

      // КАТЕГОРИЯ И ГОРОД
      cat: catSelect.value,
      city_key: citySelect.value,
      city: citySelect.options[citySelect.selectedIndex].text,

      // КОНТАКТЫ И ОПИСАНИЕ
      address: isPartner ? (myShopData?.address || document.getElementById("in-address").value) : document.getElementById("in-address").value,
      phone: isPartner ? (myShopData?.phone || document.getElementById("in-wa").value) : document.getElementById("in-wa").value,
      tgNick: isPartner ? (myShopData?.tgNick || document.getElementById("in-tg").value) : document.getElementById("in-tg").value,
      desc: document.getElementById("in-desc").value,
      receiveDate: document.getElementById("in-receive-date").value,

      // ЛОГИКА КОМБО-НАБОРОВ
      isCombo: (typeof currentAddingType !== "undefined" && currentAddingType === "combo") || (document.getElementById("in-is-combo")?.checked || false),
      comboItems: document.getElementById("in-combo-items")?.value || "",
      comboBenefit: document.getElementById("in-combo-benefit")?.value || "",

      // МЕДИА-ФАЙЛЫ
      img: validImgs,
      verify_photo: verifyPhotoUrl || "",
      verify_code: isPartner ? "PARTNER_BYPASS" : currentVerifyCode,
      receipt_url: receiptUrl,

      // СИСТЕМНЫЕ ПОЛЯ
      status: isPartner ? "active" : "pending",
      bot_notified: false, // Чтобы бот на сервере прислал уведомление админу
      isShop: isPartner,
      shopName: isPartner ? myShopData?.shopName || "Администрация" : "",
      verified: isPartner,
      tariff: selectedTariff,
      is_holiday: isPartner ? false : holidayMode,
      
      // БИЗНЕС ПОЛЯ
      shelfLife: document.getElementById("in-biz-shelf") ? document.getElementById("in-biz-shelf").value : "",
      season: document.getElementById("in-biz-season") ? document.getElementById("in-biz-season").value : "",
      productionTime: document.getElementById("in-biz-production") ? document.getElementById("in-biz-production").value : "",

      // АВТОР И ВРЕМЯ
      userId: myId,
      createdAt: Math.floor(Date.now() / 1000),
    };

    // 6. ОТПРАВКА В FIREBASE
    await db.ref("ads").push(newAd);

    // Запоминаем время последнего поста (для анти-спама)
    localStorage.setItem("last_post_time", Date.now());

    // ФИНАЛ: Красивое завершение
    lTitle.innerText = "ГОТОВО!";
    lVisual.style.color = "#4cd964"; // Зеленый цвет при успехе

    finishUpload(
      isPartner
        ? "Ваше объявление опубликовано мгновенно! ✨"
        : "Заявка отправлена модератору на проверку! ⏳"
    );
  } catch (e) {
    // ОБРАБОТКА ОШИБОК ЗАГРУЗКИ
    console.error("Ошибка при выполнении publishAndSend:", e);

    if (overlay) {
      lVisual.classList.remove("pulse-heart");
      lVisual.classList.add("error-shake");
      lVisual.style.color = "#ff3b30";
      lTitle.innerText = "ПРОИЗОШЛА ОШИБКА";
      lText.innerText = e.message;
      lBtn.classList.remove("hidden");
    } else {
      alert("Критическая ошибка: " + e.message);
    }
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
  if (!confirm("Вы уверены?")) return;

  // Вместо прямой записи в ads, мы ТОЛЬКО шлем запрос боту
  try {
    await db.ref("management_requests").push({
      adId: currentManageId,
      action: type, // 'sold' или 'delete'
      userId: getUserId(),
      processed: false,
      timestamp: Date.now(),
    });

    alert("Запрос отправлен! Бот обновит статус через 10-20 секунд.");
    closeManageModal();
  } catch (e) {
    alert("Ошибка: " + e.message);
  }
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

// --- (Старая логика скрытия шапки удалена, заменена новой в конце файла) ---

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
      // Исключаем кнопки "Все" из поиска категорий если они внутри
      if (card.id === "f-btn-all" || card.id === "f-btn-resale") return;
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

// --- SMART LOCATION & VPN ENGINE ---
async function initSmartLocation() {
  // 1. Попытка получить координаты через IP API
  try {
    const response = await fetch("https://ipapi.co/json/");
    if (!response.ok) throw new Error("API Limit reached");
    
    const data = await response.json();
    const { latitude, longitude, country_code } = data;

    console.log("Detected location:", country_code, latitude, longitude);

    // 2. Детектор VPN (если страна не KG)
    if (country_code && country_code !== "KG") {
      showVpnAlert();
    }

    // 3. Если город не выбран вручную, определяем ближайший
    const userSelected = localStorage.getItem("selected_city_v15");
    
    if (latitude && longitude && !userSelected) {
      let closestCity = "bishkek";
      let minDistance = Infinity;

      for (const [key, coords] of Object.entries(CITY_COORDS)) {
        const dist = getHaversineDistance(latitude, longitude, coords.lat, coords.lng);
        if (dist < minDistance) {
          minDistance = dist;
          closestCity = key;
        }
      }

      curCity = closestCity;
      updateCityUI(closestCity);
    } else if (userSelected) {
      // Если выбран вручную, просто обновляем интерфейс
      curCity = userSelected;
      updateCityUI(userSelected);
    } else {
      // Fallback
      curCity = "bishkek";
      updateCityUI("bishkek");
    }
  } catch (err) {
    console.warn("Smart Location Error:", err.message);
    // Если API не сработало, проверяем localStorage или ставим Бишкек
    const saved = localStorage.getItem("selected_city_v15") || "bishkek";
    updateCityUI(saved);
  }
}

function getHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Радиус Земли в км
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function showVpnAlert() {
  const alert = document.getElementById("vpn-alert");
  if (alert) alert.classList.remove("hidden");
  
  // КРИТИЧНО: Прячем сплеш-скрин, чтобы юзер видел модалку
  const splash = document.getElementById("splash-screen");
  if (splash && !splash.classList.contains("hidden-splash")) {
    splash.classList.add("hidden-splash");
  }
}

window.closeVpnAlert = function() {
  const alert = document.getElementById("vpn-alert");
  if (alert) alert.classList.add("hidden");
};

function updateCityUI(cityKey) {
  const label = document.getElementById("current-city-label");
  if (label) label.innerText = CITY_NAMES[cityKey] || cityKey;

  // ОБНОВЛЯЕМ АКТИВНЫЙ ГОРОД В МОДАЛКЕ
  document.querySelectorAll(".city-btn").forEach((btn) => {
    if (btn.getAttribute("data-city") === cityKey) {
      btn.classList.add("active-city");
    } else {
      btn.classList.remove("active-city");
    }
  });

  renderFeed();
}

// 2. Выбор города
window.selectCity = function (c) {
  console.log("Выбран город (ключ):", c);
  curCity = c;
  localStorage.setItem("selected_city_v15", c);

  updateCityUI(c);
  toggleCitySelector();
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

// 4. ПРОДВИНУТЫЙ ПОИСК (Lalafo Style)
window.currentSearchResults = [];
window.currentSearchSort = 'relevance';

// Помощник для нормализации текста
function normalizeSearchText(text) {
  if (!text) return "";
  return text.toLowerCase()
    .replace(/[^\w\sа-яёөүң]/gi, ' ') // Добавлена поддержка ө, ү, ң
    .replace(/\s+/g, ' ')            // Убираем лишние пробелы
    .trim();
}

// Помощник для токенизации
function tokenize(text) {
  return normalizeSearchText(text).split(' ').filter(word => word.length > 1);
}

// Расчет веса (Score) объявления для поиска
function calculateAdSearchScore(ad, queryTokens) {
  const titleNorm = normalizeSearchText(ad.title);
  const descNorm = normalizeSearchText(ad.description || "");
  const catNorm = normalizeSearchText(ad.cat || "");
  
  let score = 0;

  queryTokens.forEach(token => {
    // 1. Проверка в заголовке (Title) - Вес 5 за точное слово, 3 за частичное
    if (titleNorm.includes(token)) {
      // Имитируем границу слова (\b) для кириллицы
      const index = titleNorm.indexOf(token);
      
      // БОЛЕЕ ГИБКАЯ ПРОВЕРКА: Если слово короткое ( < 4 букв ), требуем границы. 
      // Если длинное ( роза -> розы ), разрешаем частичное совпадение как полное.
      if (token.length > 3) {
        score += 5; // Для длинных слов считаем включение за 5
      } else {
        const before = index === 0 || /\s/.test(titleNorm[index - 1]);
        const after = (index + token.length === titleNorm.length) || /\s/.test(titleNorm[index + token.length]);
        if (before && after) score += 5; 
        else score += 3;
      }
    }
    
    // 2. Проверка в описании (Description) - Вес 2
    if (descNorm.includes(token)) score += 2;
    
    // 3. Проверка в категории - Вес 2
    if (catNorm.includes(token)) score += 2;
  });

  // 4. Бонус за свежесть (Freshness Score)
  const now = Math.floor(Date.now() / 1000);
  const createdAt = Number(ad.approvedAt || ad.createdAt || 0);
  const diffHours = (now - createdAt) / 3600;

  if (diffHours < 24) score += 3;
  else if (diffHours < 72) score += 2;
  else if (diffHours < 168) score += 1;

  // 5. Бонус за популярность (Views Score)
  score += (ad.views || 0) / 100;

  // 6. Продвигаемые объявления (Promotion Score) - Огромный буст +10
  if (ad.tariff === "vip" || ad.is_promoted) {
    score += 10;
  }

  return score;
}

// Главная функция старта поиска
window.startSearch = function (val) {
  const query = val || document.getElementById("main-search")?.value;
  if (!query || query.trim().length < 2) return;

  console.log("Запуск умного поиска:", query);
  
  // Закрываем подсказки
  const suggestBox = document.getElementById("search-suggestions-box");
  if (suggestBox) suggestBox.classList.add("hidden");

  // Сохраняем запрос для аналитики ( Firebase )
  trackSearchQuery(query);

  const queryTokens = tokenize(query);
  
  // Фильтрация и расчет весов
  const results = ads.filter(ad => ad.status === "active")
    .map(ad => ({
      ...ad,
      searchScore: calculateAdSearchScore(ad, queryTokens)
    }))
    .filter(ad => ad.searchScore > 1); // Показываем только если есть хоть какое-то совпадение

  window.currentSearchResults = results;
  window.currentSearchSort = 'relevance';
  
  renderSearchResults();
  
  const searchPage = document.getElementById("search-results-page");
  if (searchPage) searchPage.classList.remove("hidden");
  
  // Добавляем в историю
  addSearchToHistory(query);
  closeSearchModal();
};

// Отрисовка результатов с учетом сортировки
function renderSearchResults() {
  const container = document.getElementById("search-results-area");
  if (!container) return;
  container.innerHTML = "";

  let sorted = [...window.currentSearchResults];

  if (window.currentSearchSort === 'relevance') {
    sorted.sort((a,b) => b.searchScore - a.searchScore);
  } else if (window.currentSearchSort === 'new') {
    sorted.sort((a,b) => Number(b.createdAt) - Number(a.createdAt));
  } else if (window.currentSearchSort === 'cheap') {
    sorted.sort((a,b) => Number(a.price) - Number(b.price));
  } else if (window.currentSearchSort === 'expensive') {
    sorted.sort((a,b) => Number(b.price) - Number(a.price));
  }

  if (sorted.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:80px 20px; color:gray; width:100%; grid-column:1/3;">
        <div style="display:flex; justify-content:center; gap:10px; margin-bottom:20px; opacity:0.4;">
          <i class="fa fa-mountain" style="font-size:40px;"></i>
          <div class="tunduk-brand" style="width:40px; height:40px;"></div>
        </div>
        <p style="font-size:17px; color:#fff; font-weight:bold;">Ничего не найдено</p>
        <p style="font-size:14px; margin-top:10px;">Попробуйте изменить запрос</p>
      </div>
    `;
  } else {
    sorted.forEach(ad => container.appendChild(createAdCard(ad)));
  }
}

// Переключение вкладок сортировки
window.updateSearchSort = function(mode, btn) {
  window.currentSearchSort = mode;
  document.querySelectorAll('.s-tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderSearchResults();
};

// --- УПРАВЛЕНИЕ МОДАЛКОЙ ПОИСКА ---
window.openSearchModal = function() {
  const modal = document.getElementById("search-modal");
  if (modal) {
    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    setTimeout(() => document.getElementById("search-modal-input")?.focus(), 100);
    renderSearchHistory();
    renderPopularQueries();
  }
};

window.closeSearchModal = function() {
  const modal = document.getElementById("search-modal");
  if (modal) {
    modal.classList.add("hidden");
    document.body.style.overflow = "auto";
  }
};

// История поиска
function addSearchToHistory(q) {
  let history = JSON.parse(localStorage.getItem("search_history") || "[]");
  history = [q, ...history.filter(i => i !== q)].slice(0, 5);
  localStorage.setItem("search_history", JSON.stringify(history));
}

function renderSearchHistory() {
  const list = document.getElementById("search-history-list");
  if (!list) return;
  const history = JSON.parse(localStorage.getItem("search_history") || "[]");
  
  list.innerHTML = history.length ? "" : "<p style='color:gray; font-size:14px;'>История пуста</p>";
  history.forEach(q => {
    const div = document.createElement("div");
    div.className = "history-item";
    div.innerHTML = `<i class="fa fa-history"></i><span>${q}</span><i class="fa fa-times remove-history"></i>`;
    div.onclick = (e) => {
      if (e.target.classList.contains("remove-history")) {
        removeFromHistory(q);
      } else {
        startSearch(q);
      }
    };
    list.appendChild(div);
  });
}

function removeFromHistory(q) {
  let history = JSON.parse(localStorage.getItem("search_history") || "[]");
  history = history.filter(i => i !== q);
  localStorage.setItem("search_history", JSON.stringify(history));
  renderSearchHistory();
}

async function renderPopularQueries() {
  const container = document.getElementById("popular-queries-list");
  if (!container) return;
  
  try {
    const snap = await db.ref("searchQueries").orderByValue().limitToLast(6).once("value");
    const data = snap.val() || {};
    const queries = Object.keys(data).sort((a,b) => data[b] - data[a]);
    
    container.innerHTML = "";
    queries.forEach(q => {
      const tag = document.createElement("div");
      tag.className = "popular-tag";
      tag.innerText = q.replace(/_/g, '.');
      tag.onclick = () => startSearch(tag.innerText);
      container.appendChild(tag);
    });
  } catch(e) { console.error(e); }
}

// Автодополнение в модалке
window.showSearchSuggestionsModal = function(val) {
  const box = document.getElementById("search-suggestions-box-modal");
  if (!box) return;

  if (!val || val.trim().length < 2) {
    box.classList.add("hidden");
    return;
  }

  const query = val.toLowerCase();
  const matches = ads.filter(ad => ad.status === "active" && ad.title.toLowerCase().includes(query)).slice(0, 5);

  if (matches.length === 0) {
    box.classList.add("hidden");
    return;
  }

  box.innerHTML = "";
  matches.forEach(m => {
    const div = document.createElement("div");
    div.className = "suggestion-item";
    div.innerHTML = `<i class="fa fa-search"></i><span>${m.title}</span>`;
    div.onclick = () => startSearch(m.title);
    box.appendChild(div);
  });
  box.classList.remove("hidden");
};

// Аналитика поиска
async function trackSearchQuery(q) {
  const cleanQ = normalizeSearchText(q);
  if (!cleanQ) return;
  
  try {
    const qRef = db.ref("searchQueries/" + cleanQ.replace(/\./g, '_'));
    const snap = await qRef.once("value");
    const count = snap.val() || 0;
    await qRef.set(count + 1);
  } catch(e) { console.error("Search analytics error:", e); }
}

window.closeSearch = function () {
  const searchPage = document.getElementById("search-results-page");
  if (searchPage) searchPage.classList.add("hidden");
};

// Функция для открытия формы (обычный товар или комбо)
let currentAddingType = "standard"; // Глобальная переменная

window.openAddForm = function (type) {
  currentAddingType = type;
  showPage("add");

  const comboBlock = document.getElementById("combo-fields");
  const titleText = document.getElementById("add-title-text");

  if (type === "combo") {
    titleText.innerText = "Создать КОМБО";
    if (comboBlock) comboBlock.classList.remove("hidden");
  } else {
    // We let showPage determine the text "Новый товар" vs "Новый товар магазина"
    if (comboBlock) comboBlock.classList.add("hidden");
  }
};

// Функция мониторинга бота (Сердцебиение)
function monitorBotStatus() {
  // 1. Проверка прав: если не админ, выходим
  if (currentUserRole !== "admin") return;

  const block = document.getElementById("admin-bot-status");
  const dot = document.getElementById("status-dot");
  const text = document.getElementById("status-text");
  const timeLabel = document.getElementById("status-time");

  if (block) block.classList.remove("hidden");

  // 2. Слушаем метку времени из Firebase
  db.ref("settings/bot_status/last_seen").on("value", (snap) => {
    const lastSeen = snap.val() || 0;

    // Сбрасываем старый таймер если он был
    if (window.botMonitorInterval) clearInterval(window.botMonitorInterval);

    // Обновляем статус каждую секунду
    window.botMonitorInterval = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      const diff = now - lastSeen;

      if (diff < 45) {
        // Если бот подавал признаки жизни меньше 45 сек назад
        dot.className = "dot-online";
        text.innerText = "БОТ ОНЛАЙН";
        text.style.color = "#4cd964";
        timeLabel.innerText = "Сигнал получен " + diff + " сек. назад";
        block.style.borderColor = "rgba(76,217,100,0.3)";
      } else {
        dot.className = "dot-offline";
        text.innerText = "БОТ ОФФЛАЙН";
        text.style.color = "#ff3b30";
        timeLabel.innerText = "Нет связи уже " + diff + " сек.";
        block.style.borderColor = "rgba(255,59,48,0.3)";
      }
    }, 1000);
  });
}

window.quickEditPrice = async function (adId, currentPrice) {
  const newPrice = prompt("Введите новую цену (KGS):", currentPrice);
  if (newPrice !== null && newPrice !== "" && !isNaN(newPrice)) {
    await db
      .ref("ads/" + adId)
      .update({ price: parseInt(newPrice), needs_sync_tg: true });
  }
};

window.quickToggleStatus = async function (adId, currentStatus) {
  const newStatus = currentStatus === "active" ? "hidden" : "active";
  await db.ref("ads/" + adId).update({ status: newStatus });
};

function getUserId() {
  const tgUser = tg.initDataUnsafe?.user;

  // Если ID есть и он не равен 0 — берем его
  if (tgUser && tgUser.id && tgUser.id !== 0) return tgUser.id;

  // Если ID нет (скрыт) или он равен 0, берем/создаем ID из памяти телефона
  let guestId = localStorage.getItem("guest_uuid");
  if (!guestId) {
    // Создаем ID: префикс 'g_' + случайные буквы + время
    guestId = "g_" + Math.random().toString(36).substr(2, 9) + Date.now();
    localStorage.setItem("guest_uuid", guestId);
  }
  return guestId;
}

// --- ОТКРЫТИЕ ПУБЛИЧНОЙ ВИТРИНЫ МАГАЗИНА ---
window.openPublicShop = async function (shopId) {
  // 1. Показываем страницу
  showPage("public-shop");

  // 2. Получаем данные магазина из Firebase
  const snap = await db.ref("users/" + shopId).once("value");
  const shopUser = snap.val();

  if (!shopUser) {
    alert("Магазин не найден");
    showPage("home");
    return;
  }

  const sData = shopUser.shopData || {};

  // Установка обложки
  const banner = document.getElementById("public-shop-banner");
  const fallbackCover = sData.cover || shopUser.cover;
  if (fallbackCover) {
    banner.style.backgroundImage = `url('${fallbackCover}')`;
  } else {
    banner.style.backgroundImage = `url('https://images.unsplash.com/photo-1513519245088-0e12902e5a38?q=80&w=1000')`;
  }

  // Установка логотипа
  const logo = document.getElementById("public-shop-logo");
  const fallbackLogo = sData.logo || shopUser.logo;
  if (fallbackLogo) {
    logo.innerHTML = `<img src="${fallbackLogo}" style="width:100%; height:100%; object-fit:cover; border-radius:12px;">`;
    logo.style.background = "transparent";
  } else {
    const shopChar = (sData.shopName || shopUser.shopName || shopUser.first_name || "M").charAt(0).toUpperCase();
    logo.innerHTML = `<span style="font-size:24px; font-weight:bold; color:#000;">${shopChar}</span>`;
    logo.style.background = "var(--premium-grad)";
    logo.style.borderRadius = "12px";
  }

  // Текстовые данные
  document.getElementById("public-shop-name").innerText = sData.shopName || shopUser.shopName || shopUser.first_name || "Магазин";
  document.getElementById("public-shop-bio").innerText = sData.bio || shopUser.bio || "Описание магазина отсутствует.";
  document.getElementById("public-shop-hours").innerText = sData.hours || shopUser.workHours || "Не указаны";

  const instagram = sData.inst || shopUser.instagram || "";
  document.getElementById("public-shop-inst").innerText = instagram ? "@" + instagram : "Не указан";

  // Сохраняем instagram для клика
  window.currentPublicInst = instagram;

  // 3. Фильтруем товары этого магазина
  const shopAds = ads.filter(a => a.userId === shopId && a.status === "active");

  // Отрисовка всех товаров магазина
  const rGrid = document.getElementById("public-shop-grid");
  rGrid.innerHTML = "";
  if (shopAds.length > 0) {
    shopAds.forEach(ad => rGrid.appendChild(createAdCard(ad)));
  } else {
    rGrid.innerHTML = "<p style='color:gray; width:100%; text-align:center; grid-column:1/3;'>Товаров пока нет</p>";
  }

  // Отрисовка рекомендаций (только VIP)
  renderVipRecommendations("public-recommendations-grid", "public-recommendations-header", shopId);
};

// --- ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ДЛЯ VIP-РЕКОМЕНДАЦИЙ ---
window.renderVipRecommendations = function (containerId, headerId, excludeShopId) {
  const grid = document.getElementById(containerId);
  const header = document.getElementById(headerId);
  if (!grid) return;

  grid.innerHTML = "";
  const now = Math.floor(Date.now() / 1000);
  const threeDays = 259200; // 3 дня в секундах

  // Фильтруем только активные VIP-объявления (не старше 3 дней)
  const vips = ads.filter(ad => {
    if (ad.status !== "active") return false;
    if (ad.userId === excludeShopId) return false;
    
    const adTime = Number(ad.approvedAt || ad.createdAt || 0);
    const isVip = ad.tariff === "vip" && (now - adTime < threeDays);
    return isVip;
  });

  // Берем максимум 4 случайных VIP объявления
  const shuffled = vips.sort(() => 0.5 - Math.random()).slice(0, 4);

  if (shuffled.length > 0) {
    if (header) header.style.display = "block";
    grid.style.display = "grid";
    shuffled.forEach(ad => grid.appendChild(createAdCard(ad)));
  } else {
    if (header) header.style.display = "none";
    grid.style.display = "none";
  }
};

window.openPublicInst = function () {
  if (window.currentPublicInst) {
    window.location.href = `https://instagram.com/${window.currentPublicInst}`;
  }
};
// --- ГОРИЗОНТАЛЬНАЯ ЛИНИЯ ПАРТНЕРОВ (Магазины) ---
window.renderShopsLine = async function () {
  const container = document.getElementById("verified-shops-list");
  if (!container) return;

  // Запрашиваем юзеров из Firebase один раз
  const snap = await db.ref("users").once("value");
  const usersData = snap.val();
  if (!usersData) return;

  // Ищем бизнес-юзеров
  const shops = Object.keys(usersData)
    .map(k => ({ id: k, ...usersData[k] }))
    .filter(u => u.role === "business" || u.role === "admin");

  container.innerHTML = "";


  const storiesContainer = document.getElementById("shop-stories");
  if (storiesContainer) {
    storiesContainer.innerHTML = "";
  }

  shops.forEach(shop => {
    let logoUrl = "?";
    let isTextLogo = true;

    // Fallback logic to grab logo from root if missing in shopData
    const sData = shop.shopData || {};
    const fallbackLogo = sData.logo || shop.logo;

    if (fallbackLogo) {
      logoUrl = fallbackLogo;
      isTextLogo = false;
    } else {
      logoUrl = (sData.shopName || shop.shopName || shop.first_name || "M").charAt(0).toUpperCase();
    }

    const shopName = sData.shopName || shop.shopName || shop.first_name || "Магазин";

    const div = document.createElement("div");
    // New design: Dark rounded card with logo taking top space, title below, and hover/active animations
    div.style = "display:flex; flex-direction:column; background: #222224; border-radius: 12px; padding: 6px; cursor:pointer; width: 126px; position:relative; box-shadow: 0 4px 6px rgba(0,0,0,0.4); transition: transform 0.2s ease;";
    div.className = "flex-shrink-0";
    div.onmousedown = () => div.style.transform = 'scale(0.95)';
    div.onmouseup = () => div.style.transform = 'scale(1)';
    div.onmouseleave = () => div.style.transform = 'scale(1)';
    div.ontouchstart = () => div.style.transform = 'scale(0.95)';
    div.ontouchend = () => div.style.transform = 'scale(1)';
    div.onclick = () => {
      div.style.transform = 'scale(1)';
      openPublicShop(shop.id);
    };

    if (isTextLogo) {
      div.innerHTML = `
        <div style="width:100%; height:90px; background:var(--premium-grad); color:#000; font-weight:bold; font-size:28px; border-radius:8px; display:flex; align-items:center; justify-content:center; margin-bottom:6px;">
          ${logoUrl}
        </div>
        <div style="display:flex; align-items:center;">
          <span style="font-size:12px; color:#fff; font-weight:bold; display:-webkit-box; -webkit-line-clamp:1; -webkit-box-orient:vertical; overflow:hidden;">${shopName}</span>
          <i class="fa-solid fa-circle-check" style="color:#007aff; font-size:11px; margin-left:4px;"></i>
        </div>
        <span style="font-size:10px; color:gray; margin-top:3px; display:-webkit-box; -webkit-line-clamp:1; -webkit-box-orient:vertical; overflow:hidden;">Partner</span>
      `;
    } else {
      div.innerHTML = `
        <div style="width:100%; height:90px; border-radius:8px; margin-bottom:6px; overflow:hidden; background:#1c1c1e;">
          <img src="${logoUrl}" style="width:100%; height:100%; object-fit:cover;">
        </div>
        <div style="display:flex; align-items:center;">
          <span style="font-size:12px; color:#fff; font-weight:bold; display:-webkit-box; -webkit-line-clamp:1; -webkit-box-orient:vertical; overflow:hidden;">${shopName}</span>
          <i class="fa-solid fa-circle-check" style="color:#007aff; font-size:11px; margin-left:4px;"></i>
        </div>
        <span style="font-size:10px; color:gray; margin-top:3px; display:-webkit-box; -webkit-line-clamp:1; -webkit-box-orient:vertical; overflow:hidden;">Partner</span>
      `;
    }
    container.appendChild(div);

    // Добавляем этот же магазин в виде "Истории" в верхнюю ленту (shop-stories)
    if (storiesContainer) {
       const storyItem = document.createElement("div");
       storyItem.className = "story-item";
       storyItem.onclick = () => openPublicShop(shop.id);
       
       if (isTextLogo) {
         storyItem.innerHTML = `
           <div class="story-circle-empty" style="background:var(--premium-grad); display:flex; align-items:center; justify-content:center; color:#000; font-weight:bold; font-size:24px; border:none;">
             ${logoUrl}
           </div>
           <span style="display:-webkit-box; -webkit-line-clamp:1; -webkit-box-orient:vertical; overflow:hidden; font-size:11px;">${shopName}</span>
         `;
       } else {
         storyItem.innerHTML = `
           <div class="story-circle-empty" style="padding:2px; background:var(--premium-grad); border:none; display:flex; align-items:center; justify-content:center;">
             <img src="${logoUrl}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">
           </div>
           <span style="display:-webkit-box; -webkit-line-clamp:1; -webkit-box-orient:vertical; overflow:hidden; font-size:11px;">${shopName}</span>
         `;
       }
       storiesContainer.appendChild(storyItem);
    }
  });

  // Добавляем кнопки "Стать партнером" в самый конец списков
  const addBtnHTML = `
    <div onclick="tg.openTelegramLink('https://t.me/D1NCHO')" style="display:flex; flex-direction:column; align-items:center; cursor:pointer; width: 105px; transition: transform 0.2s ease;" class="flex-shrink-0">
      <div style="width:105px; height:75px; background:rgba(255,204,0,0.1); border-radius:12px; display:flex; align-items:center; justify-content:center; margin-bottom:5px; border: 1px dashed var(--yellow-main)">
        <i class="fa-solid fa-plus" style="color:var(--yellow-main); font-size:24px;"></i>
      </div>
      <span style="font-size:12px; color:gray; font-weight:bold;">Стать партнером</span>
    </div>
  `;
  container.insertAdjacentHTML("beforeend", addBtnHTML);

  if (storiesContainer) {
    const partnerInviteStoryHTML = `
      <div class="story-item partner-invite" onclick="tg.openTelegramLink('https://t.me/D1NCHO')">
        <div class="story-circle-add">
          <span style="font-size: 30px; font-weight: 200; color: var(--yellow-main); margin-bottom: 3px;">+</span>
        </div>
        <span>Стать партнером</span>
      </div>
    `;
    storiesContainer.insertAdjacentHTML("beforeend", partnerInviteStoryHTML);
  }
};

// --- ЛЕНТА ТОВАРОВ ИСКЛЮЧИТЕЛЬНО ОТ МАГАЗИНОВ ---
window.renderShopsFeed = function () {
  const grid = document.getElementById("shops-grid");
  if (!grid) return;
  grid.innerHTML = "";

  const shopAds = ads.filter(ad =>
    ad.isShop === true &&
    !ad.isResale &&
    ad.status !== "deleted" &&
    ad.status !== "pending" &&
    ad.status !== "rejected"
  );

  // Перемешиваем товары в случайном порядке
  for (let i = shopAds.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shopAds[i], shopAds[j]] = [shopAds[j], shopAds[i]];
  }

  if (shopAds.length === 0) {
    grid.innerHTML = `
      <div style="text-align:center; padding:80px 20px; color:gray; width:100%; grid-column:1/3;">
        <div style="display:flex; justify-content:center; gap:10px; margin-bottom:20px; opacity:0.4;">
          <i class="fa fa-mountain" style="font-size:40px;"></i>
          <div class="tunduk-brand" style="width:40px; height:40px;"></div>
        </div>
        <p style="font-size:17px; color:#fff; font-weight:bold;">Объявлений пока нет</p>
        <p style="font-size:14px; margin-top:10px;">Будьте первым, кто подаст объявление в этом разделе!</p>
      </div>
    `;
    return;
  }
  shopAds.forEach(ad => grid.appendChild(createAdCard(ad)));
};


window.toggleComboFields = function(isChecked) {
  const cFields = document.getElementById("combo-fields");
  if (cFields) {
    if (isChecked) {
      cFields.classList.remove("hidden");
    } else {
      cFields.classList.add("hidden");
    }
  }
};

// --- ЛОГИКА СКРОЛЛА ДЛЯ ПЛАВНОГО ИНТЕРФЕЙСА ---
// Эта логика отвечает за автоскрытие шапки и нижней панели при прокрутке ленты вниз
// и их появление при прокрутке вверх.
let lastScrollTop = 0;
const scrollDelta = 10; // Минимальная дистанция скролла для срабатывания

window.addEventListener("scroll", () => {
  const currentScrollPos = window.scrollY || document.documentElement.scrollTop;
  const homePage = document.getElementById("page-home");
  
  // Проверяем, находимся ли мы на главной странице
  const isHome = homePage && !homePage.classList.contains("hidden");
  const header = document.getElementById("dynamic-header");
  const nav = document.querySelector(".bottom-nav");

  // Игнорируем слишком мелкие колебания (дребезг)
  if (Math.abs(lastScrollTop - currentScrollPos) <= scrollDelta) return;

  if (currentScrollPos > lastScrollTop && currentScrollPos > 80) {
    // Прокрутка вниз — "умное" скрытие элементов для экономии места
    if (isHome && header) {
      header.classList.add("header-hidden");
    }
    if (nav) {
      nav.classList.add("bottom-nav-hidden");
    }
  } else {
    // Прокрутка вверх или мы в самом верху — возвращаем элементы на место
    if (isHome && header) {
      header.classList.remove("header-hidden");
    }
    if (nav) {
      nav.classList.remove("bottom-nav-hidden");
    }
  }

  // Запоминаем позицию скролла. Не позволяем ей быть отрицательной (для iOS rubber-band)
  lastScrollTop = currentScrollPos <= 0 ? 0 : currentScrollPos;
}, { passive: true });
