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
function checkBanStatus(userId) {
  if (!userId) return;
  // Используем .once чтобы быстро проверить при входе
  db.ref("blacklist/" + userId)
    .once("value")
    .then((snap) => {
      if (snap.val()) {
        // Полностью очищаем страницу и останавливаем выполнение скриптов
        window.stop();
        document.documentElement.innerHTML = ""; // Стираем всё
        document.body.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; background:#000; color:#ff3b30; font-family:sans-serif; text-align:center; padding:30px;">
          <h1 style="font-size:80px;">🚫</h1>
          <h2 style="text-transform:uppercase; letter-spacing:2px;">Доступ заблокирован</h2>
          <p style="color:#888; max-width:300px;">Ваш аккаунт внесен в черный список. По всем вопросам пишите в поддержку.</p>
        </div>
      `;
        throw new Error("User is banned"); // Останавливаем JS
      }
    });
}

// В функции initUser добавь вызов:
function initUser() {
  const user = tg.initDataUnsafe?.user || { first_name: "Гость", id: 0 };
  if (user.id !== 0) checkBanStatus(user.id); // Проверяем бан
  // ... остальной код
}

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
  const vBlock = document.getElementById("vip-block");
  const qrImg = document.getElementById("qr-display");
  const promoText = document.getElementById("vip-promo-text");

  // Элементы цен и названий
  const priceStd = document.getElementById("price-std");
  const priceVip = document.getElementById("price-vip");
  const labelStd = document.getElementById("label-std");

  if (qrImg && currentQrUrl) qrImg.src = currentQrUrl;

  if (holidayMode) {
    // ПРАЗДНИЧНЫЙ РЕЖИМ
    labelStd.innerText = "Стандарт + ТОП";
    priceStd.innerText = "100 сом";
    priceVip.innerText = "200 сом";

    // В праздники блок оплаты (чек) виден ВСЕГДА для обоих тарифов
    vBlock.classList.remove("hidden");
    promoText.innerText =
      "В праздничные дни все объявления платные. Стандарт идет в ТОП, VIP — выше всех.";
  } else {
    // ОБЫЧНЫЙ РЕЖИМ
    labelStd.innerText = "Стандарт";
    priceStd.innerText = "Бесплатно";
    priceVip.innerText = "100 сом";

    // Блок оплаты виден только если выбран VIP
    if (selectedTariff === "vip") {
      vBlock.classList.remove("hidden");
      promoText.innerText = "VIP-объявление будет в ТОПе 3 дня.";
    } else {
      vBlock.classList.add("hidden");
    }
  }
}

// Обновим также проверку при публикации
async function publishAndSend() {
  const title = document.getElementById("in-title").value;
  const price = document.getElementById("in-price").value;
  const btn = document.querySelector(".btn-premium-unity");
  if (!title || !price) return alert("Заполни поля!");

  // РЕДАКТИРОВАНИЕ
  if (editingId) {
    await db.ref("ads/" + editingId).update({
      title: title,
      price: price,
      address: document.getElementById("in-address").value,
      phone: document.getElementById("in-wa").value,
      desc: document.getElementById("in-desc").value,
    });
    resetAddForm();
    showPage("home");
    return;
  }

  // ПРОВЕРКА ОПЛАТЫ
  // Теперь оплата нужна если: (Праздник ВКЛ) ИЛИ (Выбран VIP)
  const isPaid = holidayMode || selectedTariff === "vip";
  if (isPaid && !receiptAttached) {
    return alert("В праздничные дни или для VIP нужно прикрепить чек!");
  }

  btn.disabled = true;
  btn.innerText = "ЗАГРУЗКА...";

  try {
    let receiptUrl = isPaid
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
      holiday_active: holidayMode, // Пометка для админа, что подано в праздник
      userId: tg.initDataUnsafe?.user?.id || 0,
      createdAt: Math.floor(Date.now() / 1000),
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
  const isVerified = ad.verified === true;

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
          <div style="color:var(--gray); font-size:11px;">${dateStr}</div>
          <div style="font-size:11px; color:#4cd964; font-weight:bold; background:rgba(76,217,100,0.1); padding:4px 8px; border-radius:6px; border:1px solid rgba(76,217,100,0.2);">
            Поступление: ${ad.receiveDate || "—"}
          </div>
        </div>
      </div>

      <div style="margin-bottom:20px; font-size:16px; line-height:1.4; display:flex; align-items:center; gap:8px;">
        <b style="color:#fff;">${catMap[ad.cat] || "Товар"}</b> — ${ad.title}
        ${
          isVerified
            ? `<i class="fa-solid fa-circle-check" style="color:#0088cc; font-size:18px;"></i>`
            : ""
        }
      </div>
      
      ${
        isSold
          ? `<div style="background:#333; padding:15px; border-radius:12px; color:#ff3b30; text-align:center; font-weight:bold;">Продано</div>`
          : `
          <a href="${contactLink}" class="btn-premium-unity" style="text-decoration:none; margin-bottom:20px;">Написать продавцу</a>

          <div style="background:#2c2c2e; padding:15px; border-radius:12px; margin:20px 0; white-space: pre-wrap; line-height:1.5; color:#efeff4; font-size:15px;">${
            ad.desc || "Нет описания"
          }</div>

          <div style="background:#1c1c1e; padding:18px; border-radius:15px; border:1px solid #333; display:flex; flex-direction:column; gap:15px; margin-bottom:25px;">
             <div style="display:flex; align-items:center; gap:12px;">
                <i class="fa-solid fa-location-dot" style="color:#ff3b30; font-size:18px; width:20px; text-align:center;"></i>
                <div style="font-size:14px; color:#ccc;">${ad.city}, ${
              ad.address || "—"
            }</div>
             </div>
             <div style="display:flex; align-items:center; gap:12px;">
                <i class="fa-solid fa-phone" style="color:var(--yellow-main); font-size:16px; width:20px; text-align:center;"></i>
                <div style="font-size:15px; font-weight:bold; color:#fff;">${
                  ad.phone || "—"
                }</div>
             </div>
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

          <!-- ЖЕЛТАЯ КНОПКА ЖАЛОБЫ -->
          <div onclick="reportAd('${ad.id}', '${ad.userId}')" 
               style="background:rgba(255,204,0,0.1); color:var(--yellow-main); border:1px solid var(--yellow-main); padding:12px; border-radius:12px; text-align:center; font-size:14px; font-weight:bold; cursor:pointer;">
             <i class="fa-solid fa-triangle-exclamation" style="margin-right:8px;"></i> Пожаловаться на мошенника
          </div>
        `
      }
    </div>`;

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
  const btn = document.getElementById("pub-btn"); // Убедись, что у кнопки есть этот ID

  if (!title || !price) return alert("Заполни поля!");

  if (editingId) {
    await db.ref("ads/" + editingId).update({
      title,
      price,
      address: document.getElementById("in-address").value,
      phone: document.getElementById("in-wa").value,
      desc: document.getElementById("in-desc").value,
    });
    resetAddForm();
    showPage("home");
    return;
  }

  // ПРОВЕРКА: Нужен ли чек?
  const isPaid = holidayMode || selectedTariff === "vip";

  if (isPaid && !receiptAttached) {
    return alert(
      "Ошибка: Вы выбрали платный тариф, но не прикрепили чек об оплате!"
    );
  }

  btn.disabled = true;
  btn.innerText = "ПОДОЖДИТЕ, ЗАГРУЗКА...";

  try {
    // 1. Сначала грузим чек
    let receiptUrl = null;
    if (isPaid) {
      const receiptFile = document.getElementById("receipt-input").files[0];
      receiptUrl = await uploadToImgBB(receiptFile);
      if (!receiptUrl) throw new Error("Не удалось загрузить чек");
    }

    // 2. Грузим основные фото
    const imgs = await Promise.all(
      selectedFiles.map((file) => uploadToImgBB(file))
    );

    // 3. Формируем объект
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
      receipt_url: receiptUrl, // Ссылка на чек
      status: "pending",
      tariff: selectedTariff,
      is_holiday: holidayMode,
      userId: tg.initDataUnsafe?.user?.id || 0,
      createdAt: Math.floor(Date.now() / 1000),
    };

    await db.ref("ads").push(newAd);
    alert("Успешно! Объявление и чек отправлены на проверку.");
    resetAddForm();
    showPage("home");
  } catch (e) {
    alert("Ошибка при отправке: " + e.message);
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
  // 1. Скрываем все страницы
  document.querySelectorAll(".page").forEach((s) => s.classList.add("hidden"));

  // 2. Показываем нужную страницу
  const targetPage = document.getElementById(`page-${p}`);
  if (targetPage) targetPage.classList.remove("hidden");

  // 3. ОБНОВЛЯЕМ ЦВЕТ КНОПОК НАВИГАЦИИ
  // Сначала убираем желтый цвет (класс active) у всех кнопок
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.remove("active");
  });

  // Теперь добавляем желтый цвет нужной кнопке
  if (p === "home") {
    document.getElementById("n-home").classList.add("active");
  } else if (p === "favs") {
    document.getElementById("n-favs").classList.add("active");
  }
  // При переходе на страницу 'add' или 'profile' кнопки 'Главное' и 'Избранное'
  // останутся серыми, так как они не активны.

  // 4. Дополнительная логика разделов
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

  // Текст для пользователя
  const actionText = type === "sold" ? "в архив (продано)" : "на удаление";
  document.getElementById(
    "confirm-text"
  ).innerText = `Объявление будет отправлено ${actionText}.`;

  document.getElementById("confirm-btn-final").onclick = () => {
    const user = tg.initDataUnsafe?.user || { id: 0 };

    // Вместо прямого изменения, создаем "Запрос на управление"
    db.ref("management_requests").push({
      adId: currentManageId,
      action: type, // "sold" или "delete"
      userId: user.id,
      timestamp: Math.floor(Date.now() / 1000),
      processed: false, // Бот увидит, что запрос еще не обработан
    });

    alert(
      "Запрос отправлен! Объявление будет обновлено в течение нескольких секунд."
    );
    closeConfirmModal();
  };

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

function reportAd(adId, sellerId) {
  // 1. Проверяем, не жаловался ли он уже в этот раз (сохраним в памяти телефона)
  let myReports = JSON.parse(localStorage.getItem("my_reports") || "[]");
  if (myReports.includes(adId)) {
    alert(
      "Вы уже отправили жалобу на это объявление. Модератор скоро его проверит."
    );
    return;
  }

  // 2. Спрашиваем подтверждение (защита от случайного нажатия)
  const confirmText =
    "Вы уверены? Жалоба будет передана модератору.\n\nВнимание: ложные жалобы могут привести к блокировке вашего аккаунта.";
  if (!confirm(confirmText)) return;

  const user = tg.initDataUnsafe?.user || { id: 0, username: "Guest" };

  // 3. Отправляем в Firebase
  db.ref("reports").push({
    adId: adId,
    sellerId: sellerId,
    reporterId: user.id,
    reporterName: user.username || user.first_name,
    timestamp: Math.floor(Date.now() / 1000),
  });

  // 4. Запоминаем, что он пожаловался, чтобы кнопка больше не работала для него
  myReports.push(adId);
  localStorage.setItem("my_reports", JSON.stringify(myReports));

  alert("Жалоба отправлена. Спасибо за помощь!");
}

function reportAd(adId, sellerId) {
  let myReports = JSON.parse(localStorage.getItem("my_reports") || "[]");
  if (myReports.includes(adId)) {
    alert("Вы уже отправили жалобу. Модератор скоро проверит это объявление.");
    return;
  }

  if (
    !confirm(
      "Вы уверены, что это мошенник? Жалоба будет немедленно передана администратору."
    )
  )
    return;

  const user = tg.initDataUnsafe?.user || { id: 0, username: "Guest" };

  db.ref("reports").push({
    adId: adId,
    sellerId: sellerId,
    reporterId: user.id,
    reporterName: user.username || user.first_name,
    timestamp: Math.floor(Date.now() / 1000),
  });

  myReports.push(adId);
  localStorage.setItem("my_reports", JSON.stringify(myReports));

  alert("Жалоба отправлена модератору. Спасибо!");
}
