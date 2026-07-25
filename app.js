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
  currentQrUrl = "",
  currentQr100 = "",
  currentQr200 = "",
  maintenanceMode = false;

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
  window.scrollTo({ top: 0, behavior: "smooth" });

  // ПРОВЕРКА НА ТЕХНИЧЕСКИЕ РАБОТЫ (KILL SWITCH)
  if (p === "add" && maintenanceMode && currentUserRole !== "admin") {
    const mAlert = document.getElementById("maintenance-alert");
    if (mAlert) mAlert.classList.remove("hidden");
    return;
  }

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
      const targetCity = (curCity || "bishkek").toLowerCase().trim();
      // Пробуем установить напрямую
      cityIn.value = targetCity;
      
      // Если прямое значение не подошло (например в curCity кириллица), ищем по тексту
      if (cityIn.value !== targetCity) {
        for (let i = 0; i < cityIn.options.length; i++) {
          const opt = cityIn.options[i];
          if (opt.value.toLowerCase().trim() === targetCity || 
              opt.text.toLowerCase().trim() === targetCity) {
            cityIn.selectedIndex = i;
            break;
          }
        }
      }
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
    currentQr100 = s.qr_100 || "";
    currentQr200 = s.qr_200 || "";
    maintenanceMode = !!s.maintenance_mode;
    
    const mToggle = document.getElementById("admin-maintenance-toggle");
    if (mToggle) mToggle.checked = maintenanceMode;
    
    applyHolidayUI();
  });
}

// --- ДИНАМИЧЕСКИЙ СЧЕТЧИК СПАСЕННЫХ БУКЕТОВ (ПРОДАННЫЕ И УДАЛЕННЫЕ ИЗ FIREBASE) ---
function updateSavedCounterUI(count) {
  const el = document.getElementById("footer-saved-counter");
  const textEl = document.querySelector(".saved-title");

  const num = Math.max(48, Number(count) || 48);
  const curLang = localStorage.getItem("app_lang") || "ru";

  if (curLang === "kg") {
    if (textEl) {
      textEl.innerHTML = `<span id="footer-saved-counter">${num.toLocaleString("ru-RU")}</span> гүлдесте сакталып калды`;
    } else if (el) {
      el.innerText = num.toLocaleString("ru-RU");
    }
  } else if (curLang === "en") {
    if (textEl) {
      textEl.innerHTML = `<span id="footer-saved-counter">${num.toLocaleString("ru-RU")}</span> bouquets saved`;
    } else if (el) {
      el.innerText = num.toLocaleString("ru-RU");
    }
  } else {
    let label = "букетов";
    const mod10 = num % 10;
    const mod100 = num % 100;
    if (mod100 >= 11 && mod100 <= 19) {
      label = "букетов";
    } else if (mod10 === 1) {
      label = "букет";
    } else if (mod10 >= 2 && mod10 <= 4) {
      label = "букета";
    } else {
      label = "букетов";
    }

    if (textEl) {
      textEl.innerHTML = `Спасено <span id="footer-saved-counter">${num.toLocaleString("ru-RU")}</span> ${label}`;
    } else if (el) {
      el.innerText = num.toLocaleString("ru-RU");
    }
  }
}

function initSavedCounter(allAdsArray = []) {
  let soldOrDeletedCount = 0;
  if (Array.isArray(allAdsArray)) {
    soldOrDeletedCount = allAdsArray.filter(
      (ad) => ad && (ad.status === "sold" || ad.status === "deleted")
    ).length;
  }

  db.ref("stats/saved_count").on("value", (snapshot) => {
    let dbExtra = snapshot.val();
    if (dbExtra === null || dbExtra === undefined) {
      db.ref("stats/saved_count").set(48);
      dbExtra = 48;
    }
    const totalSaved = soldOrDeletedCount + Number(dbExtra);
    updateSavedCounterUI(totalSaved);
  });
}

window.incrementSavedCounter = function () {
  try {
    db.ref("stats/saved_count").transaction((current) => {
      return (current || 0) + 1;
    });
  } catch (e) {
    console.error("Ошибка при инкременте счетчика спасенных букетов:", e);
  }
};

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
      initSavedCounter(ads);
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
// Если через 3 секунды ничего не произошло - убираем заставку принудительно
setTimeout(() => {
  const splash = document.getElementById("splash-screen");
  if (splash && !splash.classList.contains("hidden-splash")) {
    splash.classList.add("hidden-splash");
  }
}, 3000);

function applyHolidayUI() {
  const vBlock = document.getElementById("vip-block");
  const qrImg = document.getElementById("qr-display");
  const priceStd = document.getElementById("price-std");
  const priceVip = document.getElementById("price-vip");
  const labelStd = document.getElementById("label-std");
  const cityInput = document.getElementById("in-city");

  if (!priceStd || !priceVip || !cityInput) return;

  const currentVal = (cityInput.value || "").toLowerCase().trim();
  let currentText = "";
  if (cityInput.selectedIndex >= 0) {
    currentText = (cityInput.options[cityInput.selectedIndex].text || "").toLowerCase().trim();
  }

  // Список ПЛАТНЫХ городов (Бишкек во всех вариантах)
  const isBishkek = 
    currentVal === "bishkek" || 
    currentVal === "бишкек" || 
    currentText === "бишкек" || 
    currentVal === ""; // По умолчанию Бишкек

  // ВЫБОР QR КОДА
  // Для Бишкека: Стандарт=100, VIP=200. Для других: Standard=0, VIP=100.
  let targetQr = currentQrUrl; // Fallback
  if (isBishkek) {
    if (selectedTariff === "standard") targetQr = currentQr100 || currentQrUrl;
    else targetQr = currentQr200 || currentQrUrl;
  } else {
    // Для других городов QR нужен только для VIP (100)
    targetQr = currentQr100 || currentQrUrl;
  }

  if (qrImg && targetQr) qrImg.src = targetQr;

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

  // ДИАГНОСТИКА: Показываем уведомление (только если город Ош/и т.д. для отладки)
  if (!isBishkek) {
    console.log("Debug: Detected other city -> " + currentVal);
  }
}
window.applyHolidayUI = applyHolidayUI;

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
  let pressTimer = null;
  let isLongPress = false;
  let startX = 0; let startY = 0;

  card.addEventListener("touchstart", (e) => {
    isLongPress = false;
    if (e.touches.length > 0) {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }
    card.classList.add("long-press-active");

    pressTimer = setTimeout(() => {
      isLongPress = true;
      card.classList.remove("long-press-active");
      if (typeof showQuickPreview === "function") {
        showQuickPreview(ad);
        if (navigator.vibrate) navigator.vibrate(50);
      }
    }, 500);
  }, { passive: true });

  card.addEventListener("touchmove", (e) => {
    if (e.touches.length > 0) {
      let dx = Math.abs(e.touches[0].clientX - startX);
      let dy = Math.abs(e.touches[0].clientY - startY);
      if (dx > 10 || dy > 10) {
        clearTimeout(pressTimer);
        card.classList.remove("long-press-active");
      }
    }
  }, { passive: true });

  card.addEventListener("touchend", (e) => {
    clearTimeout(pressTimer);
    card.classList.remove("long-press-active");

    if (isLongPress) {
      if (e.changedTouches && e.changedTouches.length > 0) {
        let touch = e.changedTouches[0];
        let elem = document.elementFromPoint(touch.clientX, touch.clientY);
        if (elem && (elem.id === "quick-preview-btn" || elem.closest("#quick-preview-btn"))) {
          openProduct(ad);
        }
      }
      if (typeof hideQuickPreview === "function") hideQuickPreview();
    }
  });

  card.addEventListener("touchcancel", () => {
    clearTimeout(pressTimer);
    card.classList.remove("long-press-active");
    if (typeof hideQuickPreview === "function") hideQuickPreview();
  });

  card.onclick = (e) => {
    if (isLongPress) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    openProduct(ad);
  };

  // 4. ГЕНЕРАЦИЯ БЛОКА УПРАВЛЕНИЯ (Кнопки под товаром)
  let managementHtml = "";

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
  } else if (isProfile && currentUserRole === "user" && ad.status === "active") {
    managementHtml += `
      <button onclick="event.stopPropagation(); openManageModal('${ad.id}')" 
              style="width:100%; background:var(--rose-main); color:#fff; border:none; padding:10px; border-radius:10px; font-size:11px; font-weight:900; margin-top:10px; cursor:pointer;">
        УПРАВЛЕНИЕ
      </button>
    `;
  }

  // 5. СБОРКА ВНУТРЕННЕГО HTML КАРТОЧКИ (С СТИЛЕМ RESALEBUKET.KZ)
  const timeVal = ad.approvedAt || ad.createdAt;
  const relDateText = typeof formatRelativeDate === "function" ? formatRelativeDate(timeVal) : "Сегодня";
  const numPrice = Number(displayPrice) || 0;
  const formattedPrice = numPrice.toLocaleString("ru-RU");

  function getAdImageUrl(adObj) {
    if (!adObj) return null;
    let candidates = [];
    if (Array.isArray(adObj.img)) candidates.push(...adObj.img);
    else if (typeof adObj.img === "string") candidates.push(adObj.img);

    if (Array.isArray(adObj.images)) candidates.push(...adObj.images);
    else if (typeof adObj.images === "string") candidates.push(adObj.images);

    if (Array.isArray(adObj.photos)) candidates.push(...adObj.photos);
    else if (typeof adObj.photos === "string") candidates.push(adObj.photos);

    if (typeof adObj.photo === "string") candidates.push(adObj.photo);
    if (typeof adObj.imageUrl === "string") candidates.push(adObj.imageUrl);
    if (typeof adObj.image === "string") candidates.push(adObj.image);

    for (let c of candidates) {
      if (c && typeof c === "string") {
        const trimmed = c.trim();
        if (trimmed !== "" && trimmed !== "null" && trimmed !== "undefined" && trimmed !== "[object Object]") {
          return trimmed;
        }
      }
    }
    return null;
  }

  const imgUrl = getAdImageUrl(ad);
  const imgMediaHtml = imgUrl
    ? `<img src="${imgUrl}" alt="${ad.title || "Букет"}" onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'rb-no-img-placeholder\\'><i class=\\'fa-solid fa-leaf\\'></i><span>Свежий букет</span></div>';">`
    : `<div class="rb-no-img-placeholder"><i class="fa-solid fa-leaf"></i><span>Свежий букет</span></div>`;

  card.innerHTML = `
    <!-- Изображение и Избранное -->
    <div class="rb-card-img-box">
      ${isSold ? '<div class="sold-badge">ПРОДАНО</div>' : ""}
      ${isVip ? '<div class="vip-badge">VIP</div>' : ""}
      ${imgMediaHtml}
      
      ${!isProfile
        ? `
        <div class="rb-fav-heart-btn ${isFav ? "active" : ""}" 
             onclick="toggleFav('${ad.id}', event)" title="В избранное">
          <i class="fa-solid fa-heart"></i>
        </div>`
        : ""
      }
    </div>

    <!-- Текстовый контент -->
    <div class="rb-card-content">
      <!-- Строка Цены и Локации -->
      <div class="rb-card-price-row">
        <div class="rb-card-price">${formattedPrice} KGS</div>
        <div class="rb-card-location">
          <i class="fa-solid fa-location-dot" style="color: var(--rose-main); font-size: 10px;"></i>
          <span>${ad.city || "Бишкек"}</span>
        </div>
      </div>

      <!-- Бейдж свежести -->
      ${!isSold ? `
        <div class="rb-status-tag">
          <span class="${relDateText === 'Сегодня' ? 'rb-status-dot-green' : 'rb-status-dot-yellow'}"></span>
          Получен ${relDateText.toLowerCase()}
        </div>
      ` : ""}

      <!-- Название / Цветы -->
      <div class="rb-card-specs">
        ${ad.flowerCount ? ad.flowerCount + ' цветов' : (ad.title || "Свежий букет")}
      </div>

      <!-- Мета-теги -->
      <div class="rb-card-tags">
        <span>Можно забрать сегодня</span>
        <span>•</span>
        <span>${ad.cat === 'flowers' ? 'Розы' : 'Подарок'}</span>
      </div>

      <!-- Кнопка действия -->
      <button class="rb-card-btn">
        Смотреть букет <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 11px;"></i>
      </button>

      <!-- Блок управления (Админ/Юзер) -->
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
    await db.ref("management_requests").push({
      adId: adId,
      action: "delete",
      userId: tg.initDataUnsafe?.user?.id || 0,
      processed: false,
      timestamp: Date.now(),
    });
    if (typeof incrementSavedCounter === "function") incrementSavedCounter();
    alert(
      "Запрос отправлен боту! Пост исчезнет из всех каналов и с сайта в течение 20 секунд."
    );
  } catch (e) {
    alert("Ошибка отправки запроса: " + e.message);
  }
};

// Динамические вспомогательные функции для карточки "СОСТОЯНИЕ"
function getRecencyBadgeHtml(ad) {
  const timeVal = ad.approvedAt || ad.createdAt || Math.floor(Date.now() / 1000);
  const nowSec = Math.floor(Date.now() / 1000);
  const diffDays = Math.floor((nowSec - timeVal) / 86400);

  if (diffDays <= 0) {
    return `<span class="spec-pill pill-green">● Получен сегодня</span>`;
  } else if (diffDays === 1) {
    return `<span class="spec-pill pill-yellow">● Получен вчера</span>`;
  } else {
    return `<span class="spec-pill pill-gray">● Получен ${diffDays} дн. назад</span>`;
  }
}

function getActiveCountdownBadgeHtml(ad) {
  const timeVal = ad.approvedAt || ad.createdAt || Math.floor(Date.now() / 1000);
  const nowSec = Math.floor(Date.now() / 1000);
  const daysPassed = Math.floor((nowSec - timeVal) / 86400);
  const totalActiveDays = 7;
  const daysLeft = Math.max(1, totalActiveDays - daysPassed);

  if (daysLeft === 1) {
    return `<span class="spec-pill pill-gray">⏱ Активно последний день</span>`;
  }
  return `<span class="spec-pill pill-gray">⏱ Активно ещё ${daysLeft} дн.</span>`;
}

function getFlowerCountBadgeHtml(ad) {
  let count = ad.flowerCount || ad.count;
  if (!count) {
    const match = String(ad.title || "").match(/(\d+)\s*(?:роз|цветов|шт)/i);
    if (match) count = parseInt(match[1]);
  }

  if (count) {
    const num = Number(count);
    let label = "цветок";
    const mod10 = num % 10;
    const mod100 = num % 100;
    if (mod100 >= 11 && mod100 <= 19) {
      label = "цветов";
    } else if (mod10 === 1) {
      label = "цветок";
    } else if (mod10 >= 2 && mod10 <= 4) {
      label = "цветка";
    } else {
      label = "цветов";
    }
    return `<span class="spec-pill pill-gray">💐 ${num} ${label}</span>`;
  }

  return `<span class="spec-pill pill-gray">💐 ${ad.cat === 'flowers' ? 'Свежий букет' : 'Подарочный набор'}</span>`;
}

function getCityBadgeHtml(ad) {
  const cityNamesMap = {
    bishkek: "Бишкек",
    osh: "Ош",
    manas: "Манас",
    tokmok: "Токмок",
    karakol: "Каракол",
    jalalabad: "Джалал-Абад",
    naryn: "Нарын",
    talas: "Талас",
    batken: "Баткен"
  };
  const cityName = cityNamesMap[ad.city] || ad.city || "Бишкек";
  return `<span class="spec-pill pill-gray">📍 ${cityName}</span>`;
}

// 6. МОДАЛКА И КОНТАКТЫ
function openProduct(ad) {
  if (!ad) return;

  const modal = document.getElementById("product-modal");
  const pvContent = document.getElementById("pv-content");

  if (!modal || !pvContent) return;

  try {
    const isSold = ad.status === "sold";
    const isFav = favs.includes(ad.id);
    const isVerified = ad.verified === true;
    const isAdmin = currentUserRole === "admin" || tg.initDataUnsafe?.user?.id == MY_ADMIN_ID;

    const displayPrice = String(ad.price).replace(/[^0-9]/g, "") || "0";
    const numPrice = Number(displayPrice) || 0;
    const formattedPrice = numPrice.toLocaleString("ru-RU");

    const price = formattedPrice;
    const title = ad.title || "Свежий букет";
    const categoryName = catMap[ad.cat] || "Товар";
    const description = ad.desc || "Описание не указано";
    const city = ad.city || "Бишкек";
    const address = ad.address || "Алтын Орда";
    const phone = ad.phone || ad.whatsapp || "—";
    const telegramNick = ad.tgNick || "";
    const receiveDate = ad.receiveDate || "—";
    const tariff = (ad.tariff || "standard").toUpperCase();

    const displayDate = typeof formatRelativeDate === "function"
      ? formatRelativeDate(ad.approvedAt || ad.createdAt)
      : "Недавно";

    let contactLink = telegramNick
      ? `https://t.me/${telegramNick.replace("@", "")}`
      : `https://wa.me/${phone.replace(/[^0-9]/g, "")}`;

    const imgList = (ad.img && Array.isArray(ad.img) && ad.img.length > 0) ? ad.img : [];
    const mainImg = imgList[0] || "";

    let dots = "";
    if (imgList.length > 0) {
      dots = imgList.map((_, i) => `<div class="dot ${i === 0 ? "active" : ""}" id="dot-${ad.id}-${i}"></div>`).join("");
    }

    pvContent.innerHTML = `
      <!-- МОБИЛЬНЫЙ ВАРИАНТ (ТОЛЬКО ДЛЯ ТЕЛЕФОНОВ) -->
      <div class="mobile-product-details">
        <div class="modal-carousel-container">
          <i class="fa fa-arrow-left" onclick="closeProduct()" style="position:absolute; top:20px; left:20px; z-index:100; background:rgba(0,0,0,0.5); padding:10px; border-radius:50%; color:#fff; cursor:pointer;"></i>
          <i class="fa-solid fa-heart" onclick="toggleFav('${ad.id}')" style="position:absolute; top:20px; right:20px; z-index:100; font-size:24px; color:${isFav ? "var(--rose-main)" : "#fff"}; cursor:pointer;"></i>

          <div class="product-gallery-slider" id="slider-${ad.id}">
            ${imgList.length > 0
              ? imgList.map((src) => `<img src="${src}" alt="product">`).join("")
              : '<div style="display:flex; align-items:center; justify-content:center; height:100%; color:gray;">Нет фото</div>'
            }
          </div>
          <div class="carousel-dots">${dots}</div>
        </div>

        <div style="padding:20px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:15px;">
            <div style="font-size:28px; font-weight:800; color:var(--ink);">${price} KGS</div>
            <div style="display:flex; flex-direction:column; align-items:flex-end; gap:5px;">
              <div style="color:var(--ink-muted); font-size:11px;">${displayDate}</div>
            </div>
          </div>

          <div style="margin-bottom:20px; font-size:18px; font-weight:700; color:var(--ink);">
            <b>${categoryName}</b> — ${title} ${isVerified ? "🔵" : ""}
          </div>

          ${isSold
            ? `<div style="background:#333; padding:18px; border-radius:15px; color:#ff3b30; text-align:center; font-weight:800; margin-bottom:20px;">Продано</div>`
            : `<a href="${contactLink}" target="_blank" class="dt-act-btn dark-btn" style="text-decoration:none; margin-bottom:20px; display:flex;">Написать продавцу</a>`
          }

          <div style="background:var(--input-bg); padding:15px; border-radius:12px; margin-bottom:25px; font-size:15px; color:var(--ink); line-height:1.5; border:1px solid var(--beige-border);">
            ${description}
          </div>
        </div>
      </div>

      <!-- ДЕСКТОПНЫЙ ВАРИАНТ (ПОДЛИННЫЙ ВИД RESALEBUKET) -->
      <div class="desktop-product-details">
        <div class="dt-breadcrumbs">
          <a href="#" onclick="closeProduct(); return false;">&larr; Букеты в ${city}</a>
        </div>

        <div class="dt-details-main-grid">
          <div class="dt-gallery-box">
            <div class="dt-large-img-wrapper">
              <img id="dt-main-photo-${ad.id}" src="${mainImg}" alt="${title}">
              <span class="dt-watermark">resalebuket.kg</span>
            </div>

            ${imgList.length > 1 ? `
              <div class="dt-thumbs-strip">
                ${imgList.map((src, i) => `
                  <div class="dt-thumb ${i === 0 ? 'active' : ''}" onclick="switchDtPhoto('${src}', this, '${ad.id}')">
                    <img src="${src}" alt="thumb">
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </div>

          <div class="dt-details-info-box">
            <div class="dt-tree-card-frame">
              <div class="dt-details-head">
                <h1 class="dt-head-title">${title}</h1>
                <div class="dt-fav-icon ${isFav ? 'active' : ''}" onclick="toggleFav('${ad.id}', event)">
                  <i class="fa-solid fa-heart"></i>
                </div>
              </div>

              <div class="dt-spec-card">
                <span class="dt-spec-tag">ЦЕНА</span>
                <div class="dt-spec-price">${price} KGS</div>
              </div>

              <div class="dt-spec-card">
                <span class="dt-spec-tag">СОСТОЯНИЕ</span>
                <div class="dt-spec-pills">
                  ${getRecencyBadgeHtml(ad)}
                  ${getActiveCountdownBadgeHtml(ad)}
                  ${getFlowerCountBadgeHtml(ad)}
                  ${getCityBadgeHtml(ad)}
                </div>
              </div>

              <div class="dt-spec-card seller-action-card">
                <span class="dt-spec-tag">СВЯЗАТЬСЯ С ПРОДАВЦОМ</span>
                <p class="dt-seller-notice">resalebuket.kg не участвует в оплате и передаче букета.</p>

                <button class="dt-act-btn dark-btn" onclick="showSellerContact('${phone}', '${telegramNick}')">
                  <i class="fa-solid fa-eye"></i> Показать контакты продавца
                </button>
                <button class="dt-act-btn light-btn" onclick="window.open('${contactLink}', '_blank')">
                  <i class="fa-solid fa-calendar"></i> Забронировать
                </button>
                <button class="dt-act-btn muted-btn" onclick="window.open('${contactLink}', '_blank')">
                  Букет ещё актуален?
                </button>
                <a href="#" class="dt-inactive-link" onclick="reportAd('${ad.id}', '${ad.userId}'); return false;">Объявление неактуально?</a>
              </div>

              <div class="dt-spec-card">
                <span class="dt-spec-tag">О БУКЕТЕ</span>
                <div class="dt-flower-tags-row">
                  <span class="flower-chip">Розы</span>
                  <span class="flower-chip">Можно забрать сегодня</span>
                </div>
                <div class="dt-seller-comment">
                  <strong>КОММЕНТАРИЙ ПРОДАВЦА:</strong>
                  <p>${description}</p>
                </div>
              </div>

              <div class="dt-spec-card">
                <span class="dt-spec-tag">ПЕРЕДАЧА</span>
                <div class="dt-transfer-grid">
                  <div>
                    <span class="sub-label">ОРИЕНТИР</span>
                    <div class="sub-val">${address}</div>
                  </div>
                  <div>
                    <span class="sub-label">ПЕРЕДАЧА</span>
                    <div class="sub-val">Можно забрать сегодня</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="dt-actions-bar">
          <button onclick="copyProductLink()"><i class="fa-solid fa-link"></i> Скопировать ссылку</button>
          <button onclick="reportAd('${ad.id}', '${ad.userId}')"><i class="fa-solid fa-flag"></i> Пожаловаться</button>
          <button onclick="openTgSupport()"><i class="fa-brands fa-telegram"></i> Telegram</button>
          <button onclick="shareProduct('${title}')"><i class="fa-solid fa-share-nodes"></i> Поделиться</button>
          <button class="dt-pub-cta" onclick="closeProduct(); showPage('add');"><i class="fa-solid fa-traffic-light" style="color:#4cd964"></i> Разместить объявление</button>
        </div>
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

// 7. ПОДАЧА И ОПТИМИЗАЦИЯ ИЗОБРАЖЕНИЙ (CANVAS COMPRESSION)
async function compressImage(file, maxWidth = 1080, quality = 0.8) {
  if (!file || !file.type || !file.type.startsWith("image/")) return file;
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) return resolve(file);
            const compressedFile = new File([blob], file.name || "compressed.jpg", {
              type: "image/jpeg",
              lastModified: Date.now(),
            });
            console.log(`Оптимизация фото: ${(file.size / 1024 / 1024).toFixed(2)}MB -> ${(compressedFile.size / 1024).toFixed(1)}KB`);
            resolve(compressedFile);
          },
          "image/jpeg",
          quality
        );
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
}

function fileToDataURL(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

async function uploadFile(file) {
  if (!file) return null;
  if (typeof file === "string" && (file.startsWith("data:") || file.startsWith("http"))) {
    return file;
  }

  try {
    // 1. Автоматическое сжатие (1080px, ~100KB)
    const compressedFile = await compressImage(file, 1080, 0.75);

    // 2. Пробуем загрузить в Firebase Storage
    try {
      if (window.firebase && firebase.storage) {
        const fileName = Date.now() + "_" + Math.random().toString(36).substring(7) + ".jpg";
        const storageRef = firebase.storage().ref("ads/" + fileName);
        const metadata = {
          contentType: "image/jpeg",
          cacheControl: "public,max-age=31536000",
        };

        const snapshot = await storageRef.put(compressedFile, metadata);
        const url = await snapshot.ref.getDownloadURL();
        if (url) {
          console.log("Файл успешно загружен в Firebase Storage:", url);
          return url;
        }
      }
    } catch (storageErr) {
      console.warn("Storage недоступен или выдал ошибку, переключаемся на резервный DataURL:", storageErr);
    }

    // 3. Резервный надежный вариант: превращаем сжатое фото в DataURL
    const dataUrl = await fileToDataURL(compressedFile);
    console.log("Файл сжат и конвертирован в резервный DataURL");
    return dataUrl;
  } catch (e) {
    console.error("Ошибка при обработке фото:", e);
    return await fileToDataURL(file);
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
    overlay.style.display = "flex";
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

    // 4. ПОДГОТОВКА ФАЙЛОВ И ДАННЫХ
    const catSelect = document.getElementById("in-cat");
    const citySelect = document.getElementById("in-city");

    if (selectedFiles.length === 0)
      throw new Error("Добавьте хотя бы одну фотографию товара!");

    // ШАГ А: Загрузка чека (если есть)
    let receiptUrl = "";
    const receiptFile = document.getElementById("receipt-input")?.files?.[0];
    if (receiptFile) {
      lText.innerText = "Загружаем чек об оплате...";
      receiptUrl = await uploadFile(receiptFile);
    }

    // ШАГ Б: Загрузка проверочного фото (если есть)
    let verifyPhotoUrl = "";
    if (verifyPhotoFile) {
      lText.innerText = "Загружаем проверочное фото...";
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
    lText.innerText = "Финальный этап: Публикация...";

    const inAddressEl = document.getElementById("in-address");
    const inWaEl = document.getElementById("in-wa");
    const inTgEl = document.getElementById("in-tg");
    const inDescEl = document.getElementById("in-desc");
    const inReceiveEl = document.getElementById("in-receive-date");

    const newAd = {
      title: cleanTitle,
      price: numericPrice,

      // КАТЕГОРИЯ И ГОРОД
      cat: catSelect ? catSelect.value : "flowers",
      city_key: citySelect ? citySelect.value : "bishkek",
      city: citySelect && citySelect.options[citySelect.selectedIndex] ? citySelect.options[citySelect.selectedIndex].text : "Бишкек",

      // КОНТАКТЫ И ОПИСАНИЕ
      address: inAddressEl ? inAddressEl.value : "Бишкек",
      phone: inWaEl ? inWaEl.value : "",
      tgNick: inTgEl ? inTgEl.value : "",
      desc: inDescEl ? inDescEl.value : "",
      receiveDate: inReceiveEl ? inReceiveEl.value : "Сегодня",

      // ЛОГИКА КОМБО-НАБОРОВ
      isCombo: (typeof currentAddingType !== "undefined" && currentAddingType === "combo") || (document.getElementById("in-is-combo")?.checked || false),
      comboItems: document.getElementById("in-combo-items")?.value || "",
      comboBenefit: document.getElementById("in-combo-benefit")?.value || "",

      // МЕДИА-ФАЙЛЫ
      img: validImgs,
      verify_photo: verifyPhotoUrl || "",
      verify_code: isPartner ? "PARTNER_BYPASS" : (currentVerifyCode || "0000"),
      receipt_url: receiptUrl,

      // СИСТЕМНЫЕ ПОЛЯ (АКТИВНО СРАЗУ)
      status: "active",
      bot_notified: false,
      isShop: isPartner,
      shopName: isPartner ? (myShopData?.shopName || "Администрация") : "",
      verified: isPartner,
      tariff: selectedTariff || "standard",
      is_holiday: isPartner ? false : holidayMode,
      
      // БИЗНЕС ПОЛЯ
      shelfLife: document.getElementById("in-biz-shelf") ? document.getElementById("in-biz-shelf").value : "",
      season: document.getElementById("in-biz-season") ? document.getElementById("in-biz-season").value : "",
      productionTime: document.getElementById("in-biz-production") ? document.getElementById("in-biz-production").value : "",

      // АВТОР И ВРЕМЯ
      userId: myId,
      createdAt: Math.floor(Date.now() / 1000),
      approvedAt: Math.floor(Date.now() / 1000),
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
    if (overlay) {
      overlay.classList.add("hidden");
      overlay.style.display = "none";
    }
    resetAddForm();
    showPage("home");
  }, 1800);
}

// Функция закрытия окна ошибки
window.closeUploadOverlay = function () {
  const overlay = document.getElementById("upload-overlay");
  if (overlay) {
    overlay.classList.add("hidden");
    overlay.style.display = "none";
  }
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

  try {
    await db.ref("management_requests").push({
      adId: currentManageId,
      action: type, // 'sold' или 'delete'
      userId: getUserId(),
      processed: false,
      timestamp: Date.now(),
    });

    if (type === 'sold' || type === 'delete') {
      if (typeof incrementSavedCounter === "function") incrementSavedCounter();
    }

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
  selectedFiles = Array.from(input.files).slice(0, 5);

  const preview = document.getElementById("gallery-preview");
  const dtPreview = document.getElementById("dt-gallery-preview");
  const dtPrevImg = document.getElementById("dt-prev-img");
  const dtPrevFallback = document.getElementById("dt-prev-img-fallback");

  if (preview) preview.innerHTML = "";
  if (dtPreview) dtPreview.innerHTML = "";

  selectedFiles.forEach((file, i) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target.result;

      if (preview) {
        const img = document.createElement("img");
        img.src = src;
        img.style = "width:70px;height:70px;object-fit:cover;border-radius:10px;border:1px solid #333;";
        preview.appendChild(img);
      }

      if (dtPreview) {
        const dtImg = document.createElement("img");
        dtImg.src = src;
        dtImg.style = "width:80px;height:80px;object-fit:cover;border-radius:14px;border:2px solid var(--rose-main);";
        dtPreview.appendChild(dtImg);
      }

      // Настройка обложки карточки
      if (i === 0 && dtPrevImg && dtPrevFallback) {
        dtPrevImg.src = src;
        dtPrevImg.style.display = "block";
        dtPrevFallback.style.display = "none";
      }
    };
    reader.readAsDataURL(file);
  });

  console.log("Выбрано основных фото:", selectedFiles.length);
};

// СИНХРОНИЗАЦИЯ ДЕСКТОПНОЙ И МОБИЛЬНОЙ ФОРМЫ
window.syncDesktopAddForm = function () {
  const dtTitle = document.getElementById("dt-in-title");
  const inTitle = document.getElementById("in-title");
  if (dtTitle && inTitle) inTitle.value = dtTitle.value;

  const dtPrice = document.getElementById("dt-in-price");
  const inPrice = document.getElementById("in-price");
  if (dtPrice && inPrice) inPrice.value = dtPrice.value;

  const dtCity = document.getElementById("dt-in-city");
  const inCity = document.getElementById("in-city");
  if (dtCity && inCity) inCity.value = dtCity.value;

  const dtCat = document.getElementById("dt-in-cat");
  const inCat = document.getElementById("in-cat");
  if (dtCat && inCat) inCat.value = dtCat.value;

  const dtDesc = document.getElementById("dt-in-desc");
  const inDesc = document.getElementById("in-desc");
  if (dtDesc && inDesc) inDesc.value = dtDesc.value;

  const dtWa = document.getElementById("dt-in-wa");
  const inWa = document.getElementById("in-wa");
  if (dtWa && inWa) inWa.value = dtWa.value;

  const dtTg = document.getElementById("dt-in-tg");
  const inTg = document.getElementById("in-tg");
  if (dtTg && inTg) inTg.value = dtTg.value;

  const dtAddress = document.getElementById("dt-in-address");
  const inAddress = document.getElementById("in-address");
  if (dtAddress && inAddress) inAddress.value = dtAddress.value;

  // Обновление интерактивного превью карточки
  const prevTitle = document.getElementById("dt-prev-title");
  if (prevTitle) prevTitle.innerText = dtTitle?.value.trim() || "Ваше название букета";

  const prevPrice = document.getElementById("dt-prev-price");
  if (prevPrice) {
    const num = Number(dtPrice?.value) || 0;
    prevPrice.innerText = num > 0 ? num.toLocaleString("ru-RU") + " KGS" : "0 KGS";
  }

  const prevCity = document.getElementById("dt-prev-city");
  if (prevCity && dtCity) {
    prevCity.innerText = dtCity.options[dtCity.selectedIndex]?.text || "Бишкек";
  }

  const prevCat = document.getElementById("dt-prev-cat");
  if (prevCat && dtCat) {
    prevCat.innerText = dtCat.options[dtCat.selectedIndex]?.text || "Розы";
  }
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
  const block = document.getElementById("admin-bot-status");
  // 1. Проверка прав: если не админ, надежно скрываем и выходим
  if (currentUserRole !== "admin") {
    if (block) {
      block.classList.add("hidden");
      block.style.display = "none";
    }
    return;
  }

  const dot = document.getElementById("status-dot");
  const text = document.getElementById("status-text");
  const timeLabel = document.getElementById("status-time");

  if (block) {
    block.classList.remove("hidden");
    block.style.display = "block";
  }

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

window.toggleMaintenanceMode = async function() {
  if (currentUserRole !== "admin") return;
  const newState = !maintenanceMode;
  try {
    await db.ref("settings/maintenance_mode").set(newState);
    console.log("Технические работы:", newState ? "ВКЛЮЧЕНЫ" : "ВЫКЛЮЧЕНЫ");
  } catch (e) {
    console.error("Ошибка при обновлении статуса:", e);
    alert("Ошибка базы данных: " + e.message);
  }
};

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

// --- QUICK PREVIEW LOGIC ---
window.showQuickPreview = function (ad) {
  let overlay = document.getElementById("quick-preview-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "quick-preview-overlay";
    overlay.innerHTML = `
      <div id="quick-preview-card">
        <img id="quick-preview-img" />
        <h3 id="quick-preview-title"></h3>
        <div id="quick-preview-price"></div>
        <div id="quick-preview-btn">Открыть</div>
      </div>
    `;
    document.body.appendChild(overlay);
  }
  
  const img = overlay.querySelector("#quick-preview-img");
  if (ad.img && ad.img[0]) {
    img.src = ad.img[0];
    img.style.display = "block";
  } else {
    img.style.display = "none";
  }
  
  overlay.querySelector("#quick-preview-title").innerText = ad.title || "Без названия";
  const displayPrice = String(ad.price).replace(/[^0-9]/g, "") || "0";
  overlay.querySelector("#quick-preview-price").innerText = displayPrice + " KGS";
  
  overlay.style.display = "flex";
  void overlay.offsetWidth; // trigger reflow
  overlay.style.opacity = "1";
  overlay.querySelector("#quick-preview-card").style.transform = "scale(1)";
  
  document.body.style.overflow = "hidden";
  
  // Добавляем обработчик, чтобы если кликнули ВНЕ карточки на десктопе или мыши - закрывалось
  overlay.onclick = function(e) {
    if (e.target === overlay || e.target.id === "quick-preview-btn") {
      if (e.target.id === "quick-preview-btn") {
        openProduct(ad);
      }
      hideQuickPreview();
    }
  };
};

window.hideQuickPreview = function () {
  const overlay = document.getElementById("quick-preview-overlay");
  if (!overlay) return;
  
  overlay.style.opacity = "0";
  const card = overlay.querySelector("#quick-preview-card");
  if (card) card.style.transform = "scale(0.8)";
  
  setTimeout(() => {
    overlay.style.display = "none";
    document.body.style.overflow = "";
  }, 200);
};

// --- RESALEBUKET DESKTOP HELPERS ---
window.scrollToFeed = function (e) {
  if (e && e.preventDefault) e.preventDefault();
  const target = document.getElementById("fresh-section-header") || document.getElementById("home-grid");
  if (target) {
    target.scrollIntoView({ behavior: "smooth" });
  }
};

window.selectCityFilter = function (cityKey, elem) {
  curCity = cityKey === "all" ? "bishkek" : cityKey;
  localStorage.setItem("selected_city_v15", curCity);
  
  // Обновляем плашки в десктопном блоке городов
  document.querySelectorAll(".city-chip-btn").forEach(btn => btn.classList.remove("active"));
  if (elem) {
    elem.classList.add("active");
  }

  // Обновляем метки городов в шапках
  const cityName = CITY_NAMES[curCity] || (cityKey === "all" ? "Все города" : "Бишкек");
  const dtLabel = document.getElementById("dt-city-label");
  const mbLabel = document.getElementById("current-city-label");
  if (dtLabel) dtLabel.innerText = cityKey === "all" ? "Все города" : cityName;
  if (mbLabel) mbLabel.innerText = cityName;

  renderFeed();
};

// --- СИСТЕМА ТЕМЫ (АВТОМАТИЧЕСКАЯ СИНХРОНИЗАЦИЯ С НАСТРОЙКАМИ ТЕЛЕФОНА/ПК) ---
function applyTheme(theme) {
  const isDark = theme === "dark";
  document.body.classList.toggle("dark-theme", isDark);
  document.body.setAttribute("data-theme", isDark ? "dark" : "light");

  const icon = document.querySelector("#dt-theme-toggle i");
  if (icon) {
    icon.className = isDark ? "fa-solid fa-sun" : "fa-solid fa-moon";
  }
}

function initThemeSystem() {
  const savedTheme = localStorage.getItem("app_theme");
  if (savedTheme) {
    applyTheme(savedTheme);
  } else {
    // Автоматическая подстройка под дневной/ночной режим телефона
    const systemDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(systemDark ? "dark" : "light");
  }

  // Динамическая реакция на смену темы в телефоне на лету
  if (window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
      if (!localStorage.getItem("app_theme")) {
        applyTheme(e.matches ? "dark" : "light");
      }
    });
  }
}

window.toggleTheme = function () {
  const isCurrentlyDark = document.body.classList.contains("dark-theme");
  const newTheme = isCurrentlyDark ? "light" : "dark";
  localStorage.setItem("app_theme", newTheme);
  applyTheme(newTheme);
};

// --- МНОГОЯЗЫЧНАЯ СИСТЕМА (RU / KG / EN) ---
const i18nDict = {
  ru: {
    heroTitlePrefix: "Свежие букеты —",
    heroTitleAccent: "за пол цены",
    heroDescription: "Сравнивайте объявления продавцов по дате, цене и городу — и договаривайтесь напрямую.",
    browseBouquets: "Смотреть букеты",
    sellBouquet: "Продать букет",
    searchPlaceholder: "Поиск подарков...",
    categoriesAll: "Все",
    categoriesFlowers: "Цветы",
    categoriesGifts: "Подарки",
    categoriesJewelry: "Ювелирка",
    categoriesCerts: "Сертификаты",
    freshTitle: "Свежие предложения",
    becomePartner: "Стать партнером",
    faq: "Вопросы и ответы",
    safety: "Безопасность",
    tariffs: "Тарифы",
    savedSearches: "Сохранённые поиски",
    support: "Поддержка",
    howTag: "ИНСТРУКЦИЯ",
    howTitle: "Как это работает?",
    payTitle: "Что именно вы оплачиваете",
    footerAbout: "Свежие букеты от людей в вашем городе. Контакт, передача и оплата — напрямую между сторонами.",
    tgSupport: "Поддержка в Telegram"
  },
  kg: {
    heroTitlePrefix: "Жаңы гүлдестелер —",
    heroTitleAccent: "жарым баада",
    heroDescription: "Сатуучулардын кулактандырууларын датасы, баасы жана шаары боюнча салыштырып, түз макулдашыңыз.",
    browseBouquets: "Гүлдөрдү көрүү",
    sellBouquet: "Гүл сатуу",
    searchPlaceholder: "Белектерди издөө...",
    categoriesAll: "Баары",
    categoriesFlowers: "Гүлдөр",
    categoriesGifts: "Белектер",
    categoriesJewelry: "Зер буюмдар",
    categoriesCerts: "Сертификаттар",
    freshTitle: "Жаңы сунуштар",
    becomePartner: "Өнөктөш болуу",
    faq: "Суроолор жана жооптор",
    safety: "Коопсуздук",
    tariffs: "Тарифтер",
    savedSearches: "Сакталган издөөлөр",
    support: "Колдоо",
    howTag: "НУСКАМА",
    howTitle: "Кантип иштейт?",
    payTitle: "Эмне үчүн төлөйсүз",
    footerAbout: "Шаарыңыздагы адамдардан жаңы гүлдестелер. Байланыш, өткөрүү жана төлөө — түз тараптар ортосунда.",
    tgSupport: "Telegram аркылуу колдоо"
  },
  en: {
    heroTitlePrefix: "Fresh bouquets —",
    heroTitleAccent: "at half price",
    heroDescription: "Compare listings by date, price, and city — and agree directly with sellers.",
    browseBouquets: "Browse bouquets",
    sellBouquet: "Sell bouquet",
    searchPlaceholder: "Search gifts...",
    categoriesAll: "All",
    categoriesFlowers: "Flowers",
    categoriesGifts: "Gifts",
    categoriesJewelry: "Jewelry",
    categoriesCerts: "Certificates",
    freshTitle: "Fresh Listings",
    becomePartner: "Become partner",
    faq: "FAQ",
    safety: "Safety",
    tariffs: "Tariffs",
    savedSearches: "Saved searches",
    support: "Support",
    howTag: "GUIDE",
    howTitle: "How it works?",
    payTitle: "What you are paying for",
    footerAbout: "Fresh bouquets from people in your city. Direct contact, handoff, and payment between parties.",
    tgSupport: "Support in Telegram"
  }
};

window.setLanguage = function (lang) {
  if (!i18nDict[lang]) return;
  localStorage.setItem("app_lang", lang);

  // Обновление активного состояния кнопок выбора языка
  document.querySelectorAll(".dt-lang-opt, .ft-lang").forEach((btn) => {
    const btnText = btn.innerText.trim().toLowerCase();
    btn.classList.toggle("active", btnText === lang);
  });

  const d = i18nDict[lang];

  // Навигационные ссылки
  const navBouquets = document.getElementById("nav-link-bouquets");
  const navFaq = document.getElementById("nav-link-faq");
  const navSafety = document.getElementById("nav-link-safety");
  const navTariffs = document.getElementById("nav-link-tariffs");
  const navSaved = document.getElementById("nav-link-saved");
  const navSupport = document.getElementById("nav-link-support");

  if (navBouquets) navBouquets.innerText = d.browseBouquets;
  if (navFaq) navFaq.innerText = d.faq;
  if (navSafety) navSafety.innerText = d.safety;
  if (navTariffs) navTariffs.innerText = d.tariffs;
  if (navSaved) navSaved.innerText = d.savedSearches;
  if (navSupport) navSupport.innerText = d.support;

  // Герой секция
  const prefixEl = document.querySelector(".hero-title-prefix");
  const accentEl = document.querySelector(".hero-title-accent");
  const descEl = document.querySelector(".hero-description");
  if (prefixEl) prefixEl.innerText = d.heroTitlePrefix;
  if (accentEl) accentEl.innerText = d.heroTitleAccent;
  if (descEl) descEl.innerText = d.heroDescription;

  // Плейсхолдеры поиска
  const searchInputs = document.querySelectorAll("#main-search-trigger, #search-modal-input");
  searchInputs.forEach((inp) => (inp.placeholder = d.searchPlaceholder));

  // Заголовок свежих предложений
  const freshTitleEl = document.getElementById("dynamic-feed-title");
  if (freshTitleEl) freshTitleEl.innerText = d.freshTitle;

  // Кнопки действия в шапке
  const sellBtns = document.querySelectorAll(".dt-sell-btn, .hero-btn-light");
  sellBtns.forEach((b) => (b.innerText = d.sellBouquet));

  const browseBtns = document.querySelectorAll(".hero-btn-dark");
  browseBtns.forEach((b) => (b.innerText = d.browseBouquets));

  // Секции
  const howTag = document.querySelector(".how-it-works-section .section-tag-center");
  const howTitle = document.querySelector(".how-it-works-section .section-title-center");
  if (howTag) howTag.innerText = d.howTag;
  if (howTitle) howTitle.innerText = d.howTitle;

  const payTitle = document.querySelector(".payment-info-title");
  if (payTitle) payTitle.innerText = d.payTitle;

  // Футер
  const ftAboutEl = document.querySelector(".footer-about-text");
  if (ftAboutEl) ftAboutEl.innerText = d.footerAbout;

  const tgSuppBtn = document.querySelector(".tg-support-btn");
  if (tgSuppBtn) tgSuppBtn.innerHTML = `<i class="fa-brands fa-telegram"></i> ${d.tgSupport}`;
};

// Автоматический запуск темы, языка и 3D слайдера отзывов при загрузке
document.addEventListener("DOMContentLoaded", () => {
  initThemeSystem();
  const savedLang = localStorage.getItem("app_lang") || "ru";
  window.setLanguage(savedLang);
  init3DReviewsSlider();
});
initThemeSystem();
setTimeout(() => {
  init3DReviewsSlider();
}, 200);

// --- СТИЛЬНЫЕ МОДАЛЬНЫЕ ОКНА ИНФОРМАЦИИ ---
window.openInfoModal = function (title, contentText) {
  const modal = document.getElementById("info-modal");
  const titleEl = document.getElementById("info-modal-title");
  const bodyEl = document.getElementById("info-modal-body");

  if (titleEl) titleEl.innerText = title;
  if (bodyEl) bodyEl.innerText = contentText;
  if (modal) modal.classList.remove("hidden");
};

window.closeInfoModal = function (e) {
  if (e && e.stopPropagation) e.stopPropagation();
  const modal = document.getElementById("info-modal");
  if (modal) modal.classList.add("hidden");
};

window.openFaqModal = function (e) {
  if (e && e.preventDefault) e.preventDefault();
  const currentLang = localStorage.getItem("app_lang") || "ru";
  if (currentLang === "kg") {
    openInfoModal(
      "Көп берилүүчү суроолор (FAQ)",
      "1. Гүлдестени кантип сатып алса болот?\nСатуучу менен түздөн-түз Telegram же телефон аркылуу байланышыңыз.\n\n2. Гүлдестени кантип сатса болот?\n'Гүл сатуу' баскычын басып, форманы толтуруңуз.\n\n3. Төлөм жана өткөрүп берүү\nСаткандар менен сатып алуучулар түз сүйлөшүшөт."
    );
  } else if (currentLang === "en") {
    openInfoModal(
      "Frequently Asked Questions (FAQ)",
      "1. How to buy a bouquet?\nContact the seller directly via Telegram or phone.\n\n2. How to sell a bouquet?\nClick the 'Sell bouquet' button and submit your listing.\n\n3. Payment & Handoff\nArranged directly between buyer and seller without extra fees."
    );
  } else {
    openInfoModal(
      "Часто задаваемые вопросы (FAQ)",
      "1. Как купить букет?\nСвяжитесь с продавцом напрямую в Telegram или по телефону.\n\n2. Как продать букет?\nНажмите кнопку 'Продать букет' и заполните простую форму.\n\n3. Оплата и передача\nВсе условия согласуются напрямую между покупателем и продавцом."
    );
  }
};

window.openSafetyModal = function (e) {
  if (e && e.preventDefault) e.preventDefault();
  const currentLang = localStorage.getItem("app_lang") || "ru";
  if (currentLang === "kg") {
    openInfoModal(
      "Коопсуздук эрежелери",
      "• Гүлдестени кездешүүдө өзүңүз текшериңиз.\n• Бейтааныш сатуучуларга алдын ала төлөм которбоңуз.\n• Күмөндүү кулактандыруулар тууралуу модераторлорго кабарлаңыз."
    );
  } else if (currentLang === "en") {
    openInfoModal(
      "Safety Rules",
      "• Inspect the bouquet in person during handoff.\n• Never send upfront prepayment to unknown sellers.\n• Report any suspicious listings directly to moderators."
    );
  } else {
    openInfoModal(
      "Безопасность на ResaleBuket",
      "• Осматривайте букет лично при встрече.\n• Не переводите предоплату незнакомым продавцам.\n• Сообщайте о подозрительных объявлениях модераторам."
    );
  }
};

window.openTariffsModal = function (e) {
  if (e && e.preventDefault) e.preventDefault();
  const currentLang = localStorage.getItem("app_lang") || "ru";
  if (currentLang === "kg") {
    openInfoModal(
      "Жайгаштыруу тарифтери",
      "• Стандарттык — Акысыз\n• VIP — Лентанын башында 3 күн турат\n• Дүкөн — Өздүк витрина жана бекитилген бейдж"
    );
  } else if (currentLang === "en") {
    openInfoModal(
      "Listing Tariffs",
      "• Standard — Free listing\n• VIP — Featured at top of feed for 3 days\n• Store — Personal store showcase & verified badge"
    );
  } else {
    openInfoModal(
      "Тарифы размещения",
      "• Стандартный — Бесплатно\n• VIP — Закрепление вверху ленты на 3 дня\n• Магазин — Личная витрина товаров и проверенный бейдж"
    );
  }
};

window.openSupportModal = function (e) {
  if (e && e.preventDefault) e.preventDefault();
  if (window.tg && window.tg.openTelegramLink) {
    window.tg.openTelegramLink("https://t.me/D1NCHO");
  } else {
    window.open("https://t.me/D1NCHO", "_blank");
  }
};

window.openTgSupport = function (e) {
  if (e && e.preventDefault) e.preventDefault();
  if (window.tg && window.tg.openTelegramLink) {
    window.tg.openTelegramLink("https://t.me/D1NCHO");
  } else {
    window.open("https://t.me/D1NCHO", "_blank");
  }
};

window.scrollToHowItWorks = function (e) {
  if (e && e.preventDefault) e.preventDefault();
  const sec = document.querySelector(".how-it-works-section");
  if (sec) {
    sec.scrollIntoView({ behavior: "smooth" });
  } else {
    showPage("home");
  }
};

window.switchDtPhoto = function (src, el, adId) {
  const mainImg = document.getElementById("dt-main-photo-" + adId);
  if (mainImg) mainImg.src = src;
  document.querySelectorAll(".dt-thumb").forEach((i) => i.classList.remove("active"));
  if (el) el.classList.add("active");
};

window.showSellerContact = function (phone, tgNick) {
  const text = `Контакты продавца:\n\n📱 Телефон / WhatsApp: ${phone}\n✈️ Telegram: ${tgNick || "не указан"}`;
  alert(text);
};

window.copyProductLink = function () {
  navigator.clipboard.writeText(window.location.href);
  alert("Ссылка на объявление скопирована!");
};

window.shareProduct = function (title) {
  if (navigator.share) {
    navigator.share({ title: title, url: window.location.href });
  } else {
    copyProductLink();
  }
};

// --- 100 РЕАЛЬНЫХ ОТЗЫВОВ ПРОДАВЦОВ & 3D COVERFLOW СЛАЙДЕР ---
const ALL_SELLER_REVIEWS = [
  "Здравствуйте, можно будет объявление убрать? Цветы купили, спасибо!",
  "Да, спасибо! Быстро продала 🙌",
  "Пожалуйста, можете удалить? Продан!",
  "Можете мою удалить пожалуйста 🙏 Да, спасибо большое!",
  "Можете как можно быстрее удалить, просто продали уже!",
  "Здравствуйте, можно удалить мое объявление? Цветы продала. Спасибо!",
  "Продали, можете удалить 👍",
  "Можете удалить публикацию, пожалуйста? Продали за 2 минуты!",
  "Продана! Уберите пост, пожалуйста.",
  "У меня уже продано, можете изменить описание или удалить?",
  "Товар продан!",
  "Здравствуйте! Можете мое объявление удалить? Продали уже, спасибо!",
  "Здравствуйте, мы выложили объявление и продали уже, можете удалить?",
  "Удалить? Да! Уже забрали, спасибо большое.",
  "Здравствуйте, может удалить объявление? Продали, спасибо!",
  "Как удалить объявление цветов? Проданы за минуту буквально 😅",
  "Уберите из канала, пожалуйста, покупатель уже приехал и забрал.",
  "Цветы ушли, удалите, а то до сих пор пишут люди!",
  "Всё, букет забрали! Спасибо за оперативность, снимайте с публикации.",
  "Здравствуйте! Удалите пост, букет забронировали и уже оплатили.",
  "Спасибо вам огромнейшее! Продала букет буквально за 10 минут 🔥",
  "Можно удалить? Цветы купили, чтобы люди понапрасну не писали.",
  "Ой, у нас уже забрали роз! Удалите объявление, пожалуйста 🙏",
  "Всё продан! Спасибо за быстрый трафик!",
  "Можно снять публикацию? Нам уже перевели деньги, спасибо!",
  "Здравствуйте! Удалите, пожалуйста, букет из пионов продали.",
  "Ничего себе у вас скорость! За 5 минут забрали, удаляйте пост)))",
  "Уже не актуально, цветы проданы!",
  "Уберите номер из описания, пожалуйста, а то звонки идут без остановки 🙈",
  "Продали микс букет! Спасибо админам за работу!",
  "Здравствуйте, удалите объявление, букет уехал к клиенту.",
  "Все, продано! Спасибо, сервис просто пушка 🔥",
  "Удалите, пожалуйста, а то сообщения разрываются, уже запуталась кому отвечать!",
  "Кустовые розы забрали! Снимите с публикации, пожалуйста.",
  "Спасибо за размещение! Все продали, удаляйте)",
  "Здравствуйте! Можно убрать пост? Цветы уже забрали самовывозом.",
  "Вау, так быстро еще никогда не продавала! Удалите объявление, плиз.",
  "Тюльпаны улетели моментально! Спасибо вам, удаляйте публикацию.",
  "Продано! Можете удалять, спасибо за помощь 👍",
  "Здравствуйте, у нас всё купили, снимите пост с канала.",
  "Удалите, пожалуйста, а то люди всё пишут и пишут, а цветов уже нет)",
  "Ой, спасибо огромное! Цветы забрали, можно удалять!",
  "Всё, клиент забрал букет. Удалите карточку товара, пожалуйста.",
  "Продали за пару минут буквально! Снимите объявление 🙏",
  "Здравствуйте! Пожалуйста, удалите мое объявление, уже продано.",
  "Букет роз продан! Спасибо за площадку!",
  "Капец у вас актив! Продала букет за 3 минуты, удаляйте пост скорее 😂",
  "Уже продали! Удалите, пожалуйста, чтобы людей не обнадеживать.",
  "Здравствуйте, цветы купили! Спасибо вам огромное, снимите публикацию.",
  "Можно удалить? Забрали 51 тюльпан, спасибо!",
  "Всё продали, спасибо! Удалите, пожалуйста, наш пост.",
  "Можете убрать объявление? Покупатель уже забрал цветы.",
  "Сообщения идут шквалом, но букет уже продан! Удалите пост, пожалуйста 🙏",
  "Продано за считанные минуты! Вы лучшие, удаляйте карточку)",
  "Здравствуйте! Уберите, пожалуйста, объявление о продаже роз, их забрали.",
  "Купили! Спасибо за работу, снимите пост.",
  "Ого, сколько сообщений! Букет уже отдали, удалите публикацию, плиз.",
  "Здравствуйте, у нас товар продан, удалите, пожалуйста.",
  "Цветы забрали! Удаляйте пост, спасибо за помощь!",
  "Всё, букет улетел) Снимите с публикации, спасибо большое!",
  "Здравствуйте! Можно удалить объявление? А то звонят каждые 2 минуты 😅",
  "Розы проданы! Уберите запись, пожалуйста.",
  "Да, уже забрали! Удаляйте, спасибо за быструю продажу!",
  "Продано! Пожалуйста, снимите объявление.",
  "Здравствуйте, удалите пост, букет софий уже забрали.",
  "Всё купили! Спасибо админу, удалите карточку товара.",
  "Можете снести объявление? Цветы продали очень быстро 👍",
  "Удалите, пожалуйста, а то клиент уже забрал, а мне все еще пишут)",
  "Продано за 10 минут! Сервис супер, удаляйте пост.",
  "Здравствуйте! Можно убрать объявление? Все букеты распроданы!",
  "Огромное спасибо! Цветы продала, удалите публикацию 🙏",
  "Уберите пост, пожалуйста, забрали последний букет!",
  "Быстро забрали! Удалите, пожалуйста, объявление.",
  "Здравствуйте, мы продали гипсофилы, снимите с канала пост.",
  "Капец, не успела выложить — уже забрали! Удаляйте скорее 😂",
  "Покупатель найден! Удалите объявление, спасибо за оперативность.",
  "Продано! Можно удалять пост из группы.",
  "Здравствуйте! Цветы продали, уберите, пожалуйста, объявление.",
  "Все супер, забрали букет! Удалите публикацию.",
  "Можете удалить? Забрали за пару минут, спасибо!",
  "Здравствуйте! Букет забрали, удалите, пожалуйста, чтобы не писали больше.",
  "Купили розы, спасибо! Снимите пост с публикации.",
  "Ого, сразу 5 человек написали! Букет продан, удаляйте пост)",
  "Продано! Удалите, пожалуйста, объявление 👍",
  "Здравствуйте! Уберите пост, букет оформлен и забран.",
  "За 2 минуты ушли цветы! Удаляйте публикацию, спасибо!",
  "Уже продано, спасибо большое! Удалите объявление 🙏",
  "Можете убрать? Цветы забронировали и забрали.",
  "Здравствуйте! Снимите, пожалуйста, запись, все продано.",
  "Забрали микс букет! Спасибо, удаляйте пост.",
  "Цветы проданы! Уберите из канала, пожалуйста.",
  "Здравствуйте, удалите объявление, букет забрали 10 минут назад.",
  "Огонь! Продала моментально. Снимите публикацию, пожалуйста 🔥",
  "Покупатель приехал и забрал! Удалите пост, спасибо!",
  "Здравствуйте! Уже продали, уберите наше объявление.",
  "Все, букета нет в наличии, забрали! Удаляйте запись 👍",
  "Спасибо за сервис! Продано, можно удалять.",
  "Здравствуйте! Удалите пост, пожалуйста, а то телефон разрывается 😅",
  "Букет продан, спасибо за оперативную работу! Уберите объявление.",
  "Всё забрали! Удалите карточку товара, спасибо большое!"
];

let shuffledReviews = [];
let currentReviewIndex = 0;

function shuffleReviewsArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

window.init3DReviewsSlider = function () {
  const track = document.getElementById("reviews-track");
  if (!track) return;

  shuffledReviews = shuffleReviewsArray(ALL_SELLER_REVIEWS);
  currentReviewIndex = Math.floor(Math.random() * Math.max(1, shuffledReviews.length - 5));

  track.innerHTML = shuffledReviews
    .map((text, idx) => {
      return `
        <div class="review-3d-card" id="rev-card-${idx}" data-index="${idx}">
          <div>
            <div class="review-quote-icon">“</div>
            <div class="review-card-text">${text}</div>
          </div>
          <div class="review-author-row">
            <div class="review-author-avatar"><i class="fa-solid fa-store"></i></div>
            <div class="review-author-role">Продавец</div>
          </div>
        </div>
      `;
    })
    .join("");

  update3DReviewsPositions();

  let startX = 0;
  let isDragging = false;

  track.addEventListener("touchstart", (e) => {
    startX = e.touches[0].clientX;
    isDragging = true;
  }, { passive: true });

  track.addEventListener("touchend", (e) => {
    if (!isDragging) return;
    isDragging = false;
    const endX = e.changedTouches[0].clientX;
    const diff = startX - endX;
    if (Math.abs(diff) > 35) {
      rotateReviews(diff > 0 ? 1 : -1);
    }
  });

  track.addEventListener("mousedown", (e) => {
    startX = e.clientX;
    isDragging = true;
  });

  track.addEventListener("mouseup", (e) => {
    if (!isDragging) return;
    isDragging = false;
    const diff = startX - e.clientX;
    if (Math.abs(diff) > 35) {
      rotateReviews(diff > 0 ? 1 : -1);
    }
  });
};

function update3DReviewsPositions() {
  const total = shuffledReviews.length;
  if (!total) return;

  const isMobile = window.innerWidth < 768;
  const offsetDistance = isMobile ? 180 : 270;

  for (let i = 0; i < total; i++) {
    const card = document.getElementById(`rev-card-${i}`);
    if (!card) continue;

    let offset = i - currentReviewIndex;

    if (offset > total / 2) offset -= total;
    if (offset < -total / 2) offset += total;

    const absOffset = Math.abs(offset);

    if (absOffset > 2) {
      card.style.opacity = "0";
      card.style.pointerEvents = "none";
      card.style.transform = `translate3d(${offset * offsetDistance}px, 0, -200px) scale(0.5)`;
      card.style.zIndex = "1";
    } else {
      card.style.opacity = offset === 0 ? "1" : absOffset === 1 ? "0.75" : "0.35";
      card.style.pointerEvents = offset === 0 ? "auto" : "none";

      const scale = offset === 0 ? 1.08 : absOffset === 1 ? 0.88 : 0.72;
      const zIndex = offset === 0 ? 10 : 10 - absOffset;
      const translateX = offset * offsetDistance;

      card.style.transform = `translate3d(${translateX}px, 0, 0) scale(${scale})`;
      card.style.zIndex = zIndex;
      card.style.filter = offset === 0 ? "none" : "blur(1px)";
    }
  }
}

window.rotateReviews = function (dir) {
  const total = shuffledReviews.length;
  if (!total) return;
  currentReviewIndex = (currentReviewIndex + dir + total) % total;
  update3DReviewsPositions();
};

