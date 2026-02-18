const tg = window.Telegram.WebApp;
tg.expand();

// ---------------------------------------------------------
// НАСТРОЙКИ
// ---------------------------------------------------------
const IMGBB_KEY = "94943ea3f656b4bc95e25c86d2880b94";
const BOT_TOKEN = "8399814024:AAEla8xBVk_9deHydJV0hrc5QYDyXAFpZ8k";
const ADMIN_ID = "1615492914";

const catMap = {
  flowers: "Цветы",
  jewelry: "Ювелирка",
  gifts: "Подарки",
  certs: "Сертификаты",
  Все: "Все",
};

// ---------------------------------------------------------
// ДАННЫЕ
// ---------------------------------------------------------
let ads = JSON.parse(localStorage.getItem("gifts_final_v12")) || [];
let favs = JSON.parse(localStorage.getItem("favs_final_v12")) || [];

// Состояние фильтров
let curCat = "Все";
let curCity = "Все";
let curMainTab = "rec";
let filterSort = "default";

let currentProfileTab = "active";
let selectedFiles = [];
let selectedReceipt = null;
let selectedTariff = "standard";

document.addEventListener("DOMContentLoaded", () => {
  initUser();
  renderFeed();
});

function initUser() {
  const user = tg.initDataUnsafe?.user || { first_name: "Пользователь", id: 0 };
  if (document.getElementById("u-name"))
    document.getElementById("u-name").innerText = user.first_name;
  if (document.getElementById("u-avatar"))
    document.getElementById("u-avatar").innerText = user.first_name[0];
}

// ---------------------------------------------------------
// ПОИСК И ЛЕНТА
// ---------------------------------------------------------
function handleSearch(e) {
  if (e.key === "Enter") {
    const query = e.target.value.toLowerCase();
    const results = ads.filter((a) => a.title.toLowerCase().includes(query));
    renderFeedInternal(results, "results-grid");
    showPage("results");
    e.target.blur();
  }
}

function switchMainTab(tab) {
  curMainTab = tab;
  document.getElementById("mtab-rec").classList.toggle("active", tab === "rec");
  document.getElementById("mtab-new").classList.toggle("active", tab === "new");
  renderFeed();
}

function renderFeed(data = ads) {
  renderFeedInternal(data, "home-grid");
}

function renderFeedInternal(data, gridId) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  grid.innerHTML = "";

  // Фильтрация (показываем только одобренные на главной)
  let filtered = data.filter((ad) => {
    if (ad.status === "pending") return false; // Скрываем на модерации
    const catMatch = curCat === "Все" || ad.cat === curCat;
    const cityMatch = curCity === "Все" || ad.city === curCity;
    return catMatch && cityMatch;
  });

  // СОРТИРОВКА
  const now = Date.now();
  filtered.sort((a, b) => {
    const getRank = (item) => {
      if (item.status === "sold" || item.status === "deleted") return 2;
      if (item.tariff === "vip" && item.vipTill > now) return 0;
      return 1;
    };
    const rankA = getRank(a);
    const rankB = getRank(b);
    if (rankA !== rankB) return rankA - rankB;

    if (filterSort === "cheap") return parseFloat(a.price) - parseFloat(b.price);
    if (filterSort === "expensive") return parseFloat(b.price) - parseFloat(a.price);
    return b.id - a.id;
  });

  filtered.forEach((ad) => {
    const card = createAdCard(ad);
    grid.appendChild(card);
  });
}

function createAdCard(ad) {
  const catName = catMap[ad.cat] || "Товар";
  let coverImg = Array.isArray(ad.img) ? ad.img[0] : ad.img;
  const isSold = ad.status === "sold" || ad.status === "deleted";
  let badgeHTML = "";
  if (isSold) badgeHTML = `<div class="sold-badge">ПРОДАНО</div>`;
  else if (ad.tariff === "vip" && ad.vipTill > Date.now())
    badgeHTML = `<div class="vip-badge">VIP</div>`;

  // Расчет времени добавления (из ID или свойства createdAt)
  const createdAt = ad.createdAt || ad.id;
  const timeStr = new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  let imageHTML =
    ad.status === "deleted"
      ? `${badgeHTML}<div class="deleted-placeholder"><span class="deleted-text">Фото скрыто<br>конфиденциально</span></div>`
      : `${badgeHTML}<img src="${coverImg}" loading="lazy" style="height:140px; object-fit:cover; width:100%;">`;

  const isFav = favs.includes(ad.id);
  const heartColor = isFav ? "var(--pink)" : "white";
  const heartClass = isFav ? "fa-solid" : "fa-regular";

  let dateStr = ad.dateReceived
    ? new Date(ad.dateReceived).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "numeric",
        year: "2-digit",
      })
    : "-";

  const card = document.createElement("div");
  card.className = "card";
  card.onclick = () => openProduct(ad);
  card.innerHTML = `
      <button class="card-fav-btn" onclick="toggleFavCard(event, ${ad.id})">
         <i class="${heartClass} fa-heart" style="color:${heartColor}"></i>
      </button>
      ${imageHTML}
      <div class="card-body">
        <div class="card-price-row">
            <span class="card-price">${ad.price} KGS</span>
            <span class="card-time">${timeStr}</span>
        </div>
        <div class="card-cat-row">
            <span class="card-category">${catName}</span> ${ad.title}
        </div>
        <div class="card-date-block">
            <span class="date-label">Дата получения</span>
            <span class="date-value">${dateStr}</span>
        </div>
      </div>`;
  return card;
}

function toggleFavCard(e, id) {
  e.stopPropagation();
  toggleFav(id);
}

function filterByCat(c, el) {
  curCat = c;
  document.querySelectorAll(".category-row .cat-chip").forEach((i) => i.classList.remove("active"));
  el.classList.add("active");
  renderFeed();
}
function filterByCity(c, el) {
  curCity = c;
  document.querySelectorAll(".city-row .cat-chip").forEach((i) => i.classList.remove("active"));
  el.classList.add("active");
  renderFeed();
}

function applyExtendedFilter() {
  const eCat = document.getElementById("ext-cat").value;
  const eCity = document.getElementById("ext-city").value;
  const pFrom = parseFloat(document.getElementById("price-from").value) || 0;
  const pTo = parseFloat(document.getElementById("price-to").value) || Infinity;
  const sortRadios = document.getElementsByName("sort");
  let sortVal = "default";
  for (let r of sortRadios) { if (r.checked) sortVal = r.value; }

  curCat = eCat;
  curCity = eCity;
  filterSort = sortVal;

  const results = ads.filter((ad) => {
    const price = parseFloat(ad.price) || 0;
    return (
      (eCat === "Все" || ad.cat === eCat) &&
      (eCity === "Все" || ad.city === eCity) &&
      price >= pFrom &&
      price <= pTo
    );
  });
  renderFeedInternal(results, "results-grid");
  showPage("results");
}

function resetExtendedFilter() {
  document.getElementById("ext-cat").value = "Все";
  document.getElementById("ext-city").value = "Все";
  document.getElementById("price-from").value = "";
  document.getElementById("price-to").value = "";
  document.getElementsByName("sort")[0].checked = true;
  curCat = "Все"; curCity = "Все"; filterSort = "default";
  renderFeed();
}

function selectTariff(t) {
  selectedTariff = t;
  document.getElementById("tariff-std").classList.toggle("active", t === "standard");
  document.getElementById("tariff-vip").classList.toggle("active", t === "vip");
  const vipBlock = document.getElementById("vip-block");
  if (t === "vip") vipBlock.classList.remove("hidden");
  else vipBlock.classList.add("hidden");
}

function handleFileSelect(input) {
  const files = Array.from(input.files);
  if (files.length > 0) {
    selectedFiles = files.slice(0, 5);
    const gallery = document.getElementById("gallery-preview");
    gallery.innerHTML = "";
    document.getElementById("preview-box").classList.remove("hidden");
    document.getElementById("photo-count").innerText = selectedFiles.length;
    document.getElementById("file-label").innerText = `Выбрано: ${selectedFiles.length}`;
    selectedFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = document.createElement("img");
        img.src = e.target.result;
        gallery.appendChild(img);
      };
      reader.readAsDataURL(file);
    });
  }
}

function handleReceiptSelect(input) {
  const file = input.files[0];
  if (file) {
    selectedReceipt = file;
    document.getElementById("receipt-label").innerText = "Чек добавлен ✅";
  }
}

async function uploadToImgBB(file) {
  const formData = new FormData();
  formData.append("image", file);
  try {
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, { method: "POST", body: formData });
    const data = await response.json();
    return data.success ? data.data.url : null;
  } catch (error) { return null; }
}

async function publishAndSend() {
  const titleInput = document.getElementById("in-title");
  const priceInput = document.getElementById("in-price");
  const dateInput = document.getElementById("in-date");
  const waInput = document.getElementById("in-wa");
  const addrInput = document.getElementById("in-address");
  const tgInput = document.getElementById("in-tg");
  const cityInput = document.getElementById("in-city");
  const catInput = document.getElementById("in-cat");
  const descInput = document.getElementById("in-desc");

  if (!titleInput.value || !priceInput.value) return tg.showAlert("Заполните название и цену!");
  if (!dateInput.value) return tg.showAlert("Укажите дату получения!");
  if (selectedFiles.length === 0) return tg.showAlert("Нужно хотя бы 1 фото!");

  tg.MainButton.showProgress();
  tg.MainButton.show();

  let uploadedUrls = [];
  for (let file of selectedFiles) {
    const url = await uploadToImgBB(file);
    if (url) uploadedUrls.push(url);
  }

  let receiptUrl = selectedTariff === "vip" && selectedReceipt ? await uploadToImgBB(selectedReceipt) : "";

  const ad = {
    id: Date.now(),
    createdAt: Date.now(), // Время создания
    title: titleInput.value,
    price: priceInput.value,
    dateReceived: dateInput.value,
    phone: waInput.value,
    address: addrInput.value,
    tgNick: tgInput.value,
    city: cityInput.value,
    cat: catInput.value,
    desc: descInput.value,
    img: uploadedUrls,
    status: "pending", // Отправляем в статус ожидания
    userId: tg.initDataUnsafe?.user?.id || 0,
    tariff: selectedTariff,
    vipTill: selectedTariff === "vip" ? Date.now() + 259200000 : 0,
    receipt: receiptUrl,
  };

  await sendToBot(ad);
  ads.unshift(ad);
  localStorage.setItem("gifts_final_v12", JSON.stringify(ads));

  // Очистка
  titleInput.value = ""; priceInput.value = ""; dateInput.value = "";
  waInput.value = ""; addrInput.value = ""; tgInput.value = "";
  descInput.value = ""; cityInput.selectedIndex = 0; catInput.selectedIndex = 0;
  selectedFiles = []; selectedReceipt = null;
  document.getElementById("gallery-preview").innerHTML = "";
  document.getElementById("preview-box").classList.add("hidden");
  document.getElementById("file-label").innerText = "Нажмите для выбора фото";
  document.getElementById("receipt-label").innerText = "Добавить чек";
  selectTariff("standard");

  tg.MainButton.hide();
  tg.showAlert("Отправлено на модерацию!");
  showPage("home");
}

async function sendToBot(ad) {
  let text = `📦 ${ad.title}\n💰 ${ad.price} KGS\n📅 Получение: ${ad.dateReceived}\n📍 ${ad.city}\n👤 Юзер: @${ad.tgNick || '—'}`;
  const urlMedia = `https://api.telegram.org/bot${BOT_TOKEN}/sendMediaGroup`;
  const urlMsg = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

  try {
    // 1. Отправка медиа
    let media = ad.img.map((url, i) => ({ type: 'photo', media: url, caption: i === 0 ? text : '' }));
    if (ad.receipt) media.push({ type: 'photo', media: ad.receipt, caption: '🧾 ЧЕК' });
    
    await fetch(urlMedia, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: ADMIN_ID, media: media })
    });

    // 2. Кнопки модерации
    const keyboard = {
      inline_keyboard: [
        [
          { text: "✅ Одобрить", callback_data: `approve_${ad.id}` },
          { text: "❌ Отклонить", callback_data: `reject_${ad.id}` }
        ],
        [
          { text: "⚙️ Параметры (Раздел)", callback_data: `params_${ad.id}` }
        ]
      ]
    };

    await fetch(urlMsg, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: ADMIN_ID,
        text: `Управление объявлением #${ad.id}:`,
        reply_markup: keyboard
      }),
    });
  } catch (e) { console.error(e); }
}

function openProduct(ad) {
  const modal = document.getElementById("product-modal");
  const favIconArea = document.getElementById("modal-fav-icon");
  const isFav = favs.includes(ad.id);
  const catName = catMap[ad.cat] || "Товар";
  const images = Array.isArray(ad.img) ? ad.img : [ad.img];

  favIconArea.innerHTML = `<i class="${isFav ? "fa-solid" : "fa-regular"} fa-heart" style="color:var(--pink); font-size:22px;" onclick="toggleFav(${ad.id})"></i>`;

  let galleryHTML = ad.status === "deleted"
      ? `<div class="deleted-placeholder">Фото скрыто</div>`
      : `<div class="product-gallery">${images.map((s) => `<img src="${s}">`).join("")}</div>`;

  document.getElementById("pv-content").innerHTML = `${galleryHTML}<div class="pd-body">
    <div class="pd-price">${ad.price} KGS</div>
    <div class="pd-title">${catName} - ${ad.title}</div>
    <p>${ad.desc || ""}</p>
  </div>`;
  modal.classList.remove("hidden");
  tg.BackButton.show();
  tg.BackButton.onClick(closeProduct);
}
function closeProduct() {
  document.getElementById("product-modal").classList.add("hidden");
  tg.BackButton.hide();
}

function toggleFav(id) {
  favs = favs.includes(id) ? favs.filter((f) => f !== id) : [...favs, id];
  localStorage.setItem("favs_final_v12", JSON.stringify(favs));
  renderFeed();
  renderFavs();
}

function switchProfileTab(tab) {
  currentProfileTab = tab;
  document.getElementById("p-tab-active").classList.toggle("active", tab === "active");
  document.getElementById("p-tab-sold").classList.toggle("active", tab === "sold");
  renderProfileAds();
}

function renderProfileAds() {
  const grid = document.getElementById("my-ads-grid");
  const myId = tg.initDataUnsafe?.user?.id || 0;
  const myAds = ads.filter((a) => a.userId === myId && (currentProfileTab === "active" ? (a.status === "active" || a.status === "pending") : a.status !== "active" && a.status !== "pending"));
  grid.innerHTML = myAds.length ? "" : '<p style="text-align:center; padding:50px; color:gray;">Пусто</p>';
  myAds.forEach((ad) => grid.appendChild(createAdCard(ad)));
}

function showPage(p) {
  document.querySelectorAll(".page").forEach((s) => s.classList.add("hidden"));
  document.getElementById(`page-${p}`).classList.remove("hidden");
  document.querySelectorAll(".nav-item").forEach((i) => i.classList.remove("active"));
  if (document.getElementById(`n-${p}`)) document.getElementById(`n-${p}`).classList.add("active");

  const navBar = document.querySelector(".bottom-nav");
  if (p === "filter" || p === "add") navBar.style.display = "none";
  else navBar.style.display = "flex";

  if (p === "home") renderFeed();
  if (p === "favs") renderFavs();
  if (p === "profile") renderProfileAds();
}

function renderFavs() {
  const container = document.getElementById("favs-content-area");
  const data = ads.filter((a) => favs.includes(a.id));
  container.innerHTML = data.length ? `<div class="listings-grid"></div>` : `<p style="text-align:center; padding:50px; color:gray;">Пусто</p>`;
  if (data.length) {
    const grid = container.querySelector(".listings-grid");
    data.forEach((ad) => grid.appendChild(createAdCard(ad)));
  }
}

function clearFavs() {
  favs = [];
  localStorage.setItem("favs_final_v12", JSON.stringify(favs));
  renderFavs();
}