const tg = window.Telegram.WebApp;
tg.expand();

// 1. КОНФИГУРАЦИЯ FIREBASE
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

// --- 2. ЗАПУСК ---
document.addEventListener("DOMContentLoaded", () => {
  initUser();
  listenSettings();
  listenAds();
  const searchInput = document.getElementById("main-search");
  if (searchInput) {
    searchInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") startSearch(e.target.value);
    });
  }
});

function initUser() {
  const user = tg.initDataUnsafe?.user || { first_name: "Гость", id: 0 };
  const initial = user.first_name ? user.first_name[0].toUpperCase() : "?";

  if (document.getElementById("u-avatar-top"))
    document.getElementById("u-avatar-top").innerText = initial;
  if (document.getElementById("u-avatar-big"))
    document.getElementById("u-avatar-big").innerText = initial;
  if (document.getElementById("u-name"))
    document.getElementById("u-name").innerText = user.first_name || "Гость";

  if (user.id !== 0) {
    db.ref("blacklist/" + user.id).on("value", (snap) => {
      if (snap.val()) {
        window.stop();
        document.body.innerHTML = `<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; background:#000; color:#ff3b30; text-align:center; padding:30px;"><h1>🚫 Доступ заблокирован</h1></div>`;
      }
    });
  }
}

// --- 3. РАБОТА С БАЗОЙ ---
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

// --- 4. ФУНКЦИИ ЛЕНТЫ ---
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
    const aIsSold = a.status === "sold",
      bIsSold = b.status === "sold";
    if (aIsSold !== bIsSold) return aIsSold ? 1 : -1;
    if (!aIsSold && !bIsSold && a.tariff !== b.tariff)
      return a.tariff === "vip" ? -1 : 1;
    return (
      (b.approvedAt || b.createdAt || 0) - (a.approvedAt || a.createdAt || 0)
    );
  });

  filtered.forEach((ad) => grid.appendChild(createAdCard(ad)));
}

function createAdCard(ad, isProfile = false) {
  const isFav = favs.includes(ad.id),
    isSold = ad.status === "sold",
    isVip = ad.tariff === "vip" && !isSold;
  const timeLabel = formatRelativeDate(ad.approvedAt || ad.createdAt);
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
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
        <div style="color:var(--yellow-main); font-weight:bold; font-size:15px;">${
          ad.price
        } KGS</div>
        <div style="color:var(--gray); font-size:10px;">${timeLabel}</div>
      </div>
      <div style="font-size:12px; color:#ccc; white-space:nowrap; overflow:hidden;">${
        ad.title
      }</div>
      ${
        isProfile && ad.status === "active"
          ? `<button onclick="event.stopPropagation(); openManageModal('${ad.id}')" style="width:100%; background:var(--yellow-main); color:#000; border:none; padding:8px; border-radius:8px; font-weight:bold; margin-top:8px;">Управление</button>`
          : ""
      }
    </div>`;
  return card;
}

// --- 5. ФУНКЦИИ КАТЕГОРИЙ И НАВИГАЦИИ ---
function filterByCat(c, el) {
  curCat = c;
  document
    .querySelectorAll(".cat-card")
    .forEach((i) => i.classList.remove("active"));
  if (el) el.classList.add("active");
  const title = document.getElementById("dynamic-feed-title");
  if (title) title.innerText = catTitles[c] || "Свежие предложения";
  renderFeed();
}

function selectCity(c) {
  curCity = c;
  const label = document.getElementById("current-city-label");
  if (label) label.innerText = c;
  toggleCitySelector();
  renderFeed();
}

function toggleCitySelector() {
  const el = document.getElementById("city-selector");
  if (el) el.classList.toggle("hidden");
}

function showPage(p) {
  document.querySelectorAll(".page").forEach((s) => s.classList.add("hidden"));
  const target = document.getElementById(`page-${p}`);
  if (target) target.classList.remove("hidden");

  document
    .querySelectorAll(".nav-item")
    .forEach((i) => i.classList.remove("active"));
  if (p === "home") document.getElementById("n-home")?.classList.add("active");
  if (p === "favs") {
    document.getElementById("n-favs")?.classList.add("active");
    renderFavs();
  }

  if (p === "add" && !editingId) resetAddForm();
  if (p === "profile") renderProfile();
}

// --- 6. МОДАЛКА ТОВАРА ---
function openProduct(ad) {
  const modal = document.getElementById("product-modal");
  const isSold = ad.status === "sold",
    isFav = favs.includes(ad.id);
  const timeLabel = formatRelativeDate(ad.approvedAt || ad.createdAt);

  let contactLink = ad.tgNick
    ? `https://t.me/${ad.tgNick.replace("@", "")}`
    : `https://wa.me/${ad.phone?.replace(/[^0-9]/g, "")}`;

  document.getElementById("pv-content").innerHTML = `
    <div class="modal-carousel-container">
      <i class="fa fa-arrow-left" onclick="closeProduct()" style="position:absolute; top:20px; left:20px; z-index:100; background:rgba(0,0,0,0.5); padding:10px; border-radius:50%;"></i>
      <i class="fa-solid fa-heart" onclick="toggleFav('${
        ad.id
      }')" style="position:absolute; top:20px; right:20px; z-index:100; font-size:24px; color:${
    isFav ? "var(--yellow-main)" : "#fff"
  }"></i>
      <div class="product-gallery-slider">${
        ad.img ? ad.img.map((src) => `<img src="${src}">`).join("") : ""
      }</div>
    </div>
    <div style="padding:20px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:15px;">
        <div style="font-size:28px; font-weight:800; color:var(--yellow-main);">${
          ad.price
        } KGS</div>
        <div style="text-align:right;">
          <div style="color:var(--gray); font-size:11px;">${timeLabel}</div>
          <div style="font-size:11px; color:#4cd964; font-weight:bold; background:rgba(76,217,100,0.1); padding:4px 8px; border-radius:6px; margin-top:5px;">Поступление: ${
            ad.receiveDate || "—"
          }</div>
        </div>
      </div>
      <div style="margin-bottom:20px; font-size:16px;"><b>${
        catMap[ad.cat] || ""
      }</b> — ${ad.title} ${ad.verified ? "🔵" : ""}</div>
      ${
        isSold
          ? '<div class="sold-badge-big">ПРОДАНО</div>'
          : `<a href="${contactLink}" class="btn-premium-unity" style="text-decoration:none;">Написать продавцу</a>`
      }
      <div style="background:#2c2c2e; padding:15px; border-radius:12px; margin:20px 0; white-space: pre-wrap;">${
        ad.desc || "Нет описания"
      }</div>
      <div style="background:#1c1c1e; padding:18px; border-radius:15px; border:1px solid #333; display:flex; flex-direction:column; gap:12px;">
         <div>📍 ${ad.city}, ${ad.address || "—"}</div>
         <div>📞 ${ad.phone || "—"}</div>
         ${ad.tgNick ? `<div>✈️ ${ad.tgNick}</div>` : ""}
      </div>
      <div onclick="reportAd('${ad.id}', '${
    ad.userId
  }')" style="margin-top:25px; color:var(--yellow-main); text-align:center; border:1px solid var(--yellow-main); padding:12px; border-radius:12px; cursor:pointer;">Пожаловаться на мошенника</div>
    </div>`;
  modal.classList.remove("hidden");
  tg.BackButton.show();
  tg.BackButton.onClick(closeProduct);
}

// --- 7. ПОДАЧА И ФОТО ---
async function uploadFile(file) {
  if (!file) return null;
  const ref = storage.ref("ads/" + Date.now() + "_" + file.name);
  await ref.put(file);
  return await ref.getDownloadURL();
}

async function publishAndSend() {
  const btn = document.getElementById("pub-btn");
  const title = document.getElementById("in-title").value;
  if (!title) return alert("Заполни название!");

  if (editingId) {
    btn.disabled = true;
    try {
      await db.ref("ads/" + editingId).update({
        title: title,
        price: document.getElementById("in-price").value,
        address: document.getElementById("in-address").value,
        phone: document.getElementById("in-wa").value,
        desc: document.getElementById("in-desc").value,
        needs_sync_tg: true,
      });
      alert("Сохранено!");
      resetAddForm();
      showPage("home");
    } catch (e) {
      alert("Ошибка!");
    } finally {
      btn.disabled = false;
    }
    return;
  }

  const isPaid = holidayMode || selectedTariff === "vip";
  if (isPaid && !receiptAttached) return alert("Прикрепите чек!");

  btn.disabled = true;
  btn.innerText = "ЗАГРУЗКА...";
  try {
    let receiptUrl = isPaid
      ? await uploadFile(document.getElementById("receipt-input").files[0])
      : null;
    const imgs = await Promise.all(selectedFiles.map((f) => uploadFile(f)));

    const newAd = {
      title,
      price: document.getElementById("in-price").value,
      cat: document.getElementById("in-cat").value,
      city: document.getElementById("in-city").value,
      address: document.getElementById("in-address").value,
      phone: document.getElementById("in-wa").value,
      tgNick: document.getElementById("in-tg").value,
      desc: document.getElementById("in-desc").value,
      receiveDate: document.getElementById("in-receive-date").value,
      img: imgs.filter((i) => i),
      receipt_url: receiptUrl,
      status: "pending",
      bot_notified: false,
      tariff: selectedTariff,
      is_holiday: holidayMode,
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

// --- 8. ПРОФИЛЬ, ИЗБРАННОЕ, ПОИСК ---
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
  if (filtered.length === 0)
    grid.innerHTML =
      "<p style='text-align:center; color:gray; grid-column:1/3;'>Пусто</p>";
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

function toggleFav(id, event) {
  if (event) event.stopPropagation();
  favs = favs.includes(id) ? favs.filter((f) => f !== id) : [...favs, id];
  localStorage.setItem("favs_v15", JSON.stringify(favs));
  renderFeed();
  if (!document.getElementById("page-favs").classList.contains("hidden"))
    renderFavs();
}

function renderFavs() {
  const container = document.getElementById("favs-content-area");
  if (!container) return;
  const filtered = ads.filter((ad) => favs.includes(ad.id));
  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-favs-center"><h3>Пусто</h3><button class="btn-premium-unity" onclick="showPage('home')">Найти подарки</button></div>`;
  } else {
    container.innerHTML = '<div class="listings-grid" id="fav-grid"></div>';
    filtered.forEach((ad) =>
      document.getElementById("fav-grid").appendChild(createAdCard(ad))
    );
  }
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

// --- 9. ВСПОМОГАТЕЛЬНЫЕ ---
function formatRelativeDate(ts) {
  if (!ts) return "Сегодня";
  const date = new Date(ts * 1000),
    now = new Date();
  if (date.toDateString() === now.toDateString()) return "Сегодня";
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Вчера";
  return date.toLocaleDateString("ru-RU");
}

function reportAd(adId, sellerId) {
  if (!confirm("Пожаловаться модератору?")) return;
  db.ref("reports").push({
    adId,
    sellerId,
    reporterName: tg.initDataUnsafe?.user?.first_name || "Guest",
    timestamp: Math.floor(Date.now() / 1000),
  });
  alert("Отправлено!");
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
          "width:60px; height:60px; object-fit:cover; border-radius:8px;";
        p.appendChild(img);
      };
      r.readAsDataURL(f);
    });
  }
}

function selectTariff(t) {
  selectedTariff = t;
  const s = document.getElementById("tariff-std"),
    v = document.getElementById("tariff-vip");
  if (s)
    s.className = "tariff-card-box" + (t === "standard" ? " active-std" : "");
  if (v) v.className = "tariff-card-box" + (t === "vip" ? " active-vip" : "");
  applyHolidayUI();
}

function handleReceiptSelect(i) {
  if (i.files[0]) {
    receiptAttached = true;
    const l = document.getElementById("receipt-label");
    if (l) l.innerText = "Чек добавлен ✅";
  }
}
function openManageModal(id) {
  currentManageId = id;
  document.getElementById("manage-modal").classList.remove("hidden");
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
function confirmAction(type) {
  db.ref("management_requests").push({
    adId: currentManageId,
    action: type,
    userId: tg.initDataUnsafe?.user?.id || 0,
    processed: false,
  });
  alert("Запрос отправлен!");
  closeManageModal();
}
function startAdEdit() {
  /* Редактирование */
}
