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
let curMainTab = "rec"; // rec (Рекомендуемые) или new (Новые)
let filterSort = "default";

let currentProfileTab = "active";
let selectedFiles = [];
let selectedReceipt = null; // Для чека
let selectedTariff = "standard"; // standard | vip

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

  // 1. Фильтрация (для главной)
  let filtered = [...data];
  if (gridId === "home-grid") {
    filtered = data.filter((ad) => {
      const catMatch = curCat === "Все" || ad.cat === curCat;
      const cityMatch = curCity === "Все" || ad.city === curCity;
      return catMatch && cityMatch;
    });
  }

  // 2. ГЛОБАЛЬНАЯ СОРТИРОВКА (VIP -> Активные -> Проданные)
  const now = Date.now();
  filtered.sort((a, b) => {
    // Определяем приоритет: 0 - VIP, 1 - Обычный активный, 2 - Продан/Удален
    const getPriority = (ad) => {
      if (ad.status === "sold" || ad.status === "deleted") return 2;
      if (ad.tariff === "vip" && ad.vipTill > now) return 0;
      return 1;
    };

    const prioA = getPriority(a);
    const prioB = getPriority(b);

    if (prioA !== prioB) return prioA - prioB;

    // Внутри одной группы приоритета применяем выбранную сортировку
    if (filterSort === "cheap")
      return parseFloat(a.price) - parseFloat(b.price);
    if (filterSort === "expensive")
      return parseFloat(b.price) - parseFloat(a.price);

    // По умолчанию или "Новые": самые свежие ID сверху
    return b.id - a.id;
  });

  filtered.forEach((ad) => {
    const card = createAdCard(ad);
    grid.appendChild(card);
  });
}

// СОЗДАНИЕ КАРТОЧКИ (БЕЗ ИЗМЕНЕНИЙ)
function createAdCard(ad) {
  const catName = catMap[ad.cat] || "Товар";
  let coverImg = Array.isArray(ad.img) ? ad.img[0] : ad.img;

  const showSoldBadge = ad.status === "sold" || ad.status === "deleted";
  let badgeHTML = "";
  if (showSoldBadge) {
    badgeHTML = `<div class="sold-badge">ПРОДАНО</div>`;
  } else if (ad.tariff === "vip" && ad.vipTill > Date.now()) {
    badgeHTML = `<div class="vip-badge">VIP</div>`;
  }

  let imageHTML = "";
  if (ad.status === "deleted") {
    imageHTML = `${badgeHTML}<div class="deleted-placeholder"><span class="deleted-text">Фото скрыто<br>конфиденциально</span></div>`;
  } else {
    imageHTML = `${badgeHTML}<img src="${coverImg}" loading="lazy" style="height:140px; object-fit:cover; width:100%;">`;
  }

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
        <span class="card-price">${ad.price} KGS</span>
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

// ---------------------------------------------------------
// ФИЛЬТРЫ
// ---------------------------------------------------------
function filterByCat(c, el) {
  curCat = c;
  document
    .querySelectorAll(".category-row .cat-chip")
    .forEach((i) => i.classList.remove("active"));
  el.classList.add("active");
  renderFeed();
}
function filterByCity(c, el) {
  curCity = c;
  document
    .querySelectorAll(".city-row .cat-chip")
    .forEach((i) => i.classList.remove("active"));
  el.classList.add("active");
  renderFeed();
}

function applyExtendedFilter() {
  const eCat = document.getElementById("ext-cat").value;
  const eCity = document.getElementById("ext-city").value;
  const pFrom = parseFloat(document.getElementById("price-from").value) || 0;
  const pTo = parseFloat(document.getElementById("price-to").value) || Infinity;

  const sortRadios = document.getElementsByName("sort");
  for (let r of sortRadios) {
    if (r.checked) filterSort = r.value;
  }

  // Фильтруем данные специально для страницы результатов
  const results = ads.filter((ad) => {
    const catMatch = eCat === "Все" || ad.cat === eCat;
    const cityMatch = eCity === "Все" || ad.city === eCity;
    const price = parseFloat(ad.price) || 0;
    const priceMatch = price >= pFrom && price <= pTo;
    return catMatch && cityMatch && priceMatch;
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
  curCat = "Все";
  curCity = "Все";
  filterSort = "default";
  renderFeed();
}

// ---------------------------------------------------------
// ЗАГРУЗКА И ПУБЛИКАЦИЯ
// ---------------------------------------------------------
function selectTariff(t) {
  selectedTariff = t;
  document
    .getElementById("tariff-std")
    .classList.toggle("active", t === "standard");
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
    document.getElementById(
      "file-label"
    ).innerText = `Выбрано: ${selectedFiles.length}`;
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
    const response = await fetch(
      `https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`,
      { method: "POST", body: formData }
    );
    const data = await response.json();
    return data.success ? data.data.url : null;
  } catch (error) {
    return null;
  }
}

async function publishAndSend() {
  const title = document.getElementById("in-title").value;
  const price = document.getElementById("in-price").value;
  const dateReceived = document.getElementById("in-date").value;
  const phone = document.getElementById("in-wa").value;
  const address = document.getElementById("in-address").value;
  const tgNick = document.getElementById("in-tg").value;
  const city = document.getElementById("in-city").value;
  const cat = document.getElementById("in-cat").value;
  const desc = document.getElementById("in-desc").value;

  if (!title || !price) return tg.showAlert("Заполните название и цену!");
  if (!dateReceived) return tg.showAlert("Укажите дату получения!");
  if (selectedFiles.length === 0) return tg.showAlert("Нужно хотя бы 1 фото!");
  if (selectedTariff === "vip" && !selectedReceipt)
    return tg.showAlert("Для VIP нужно прикрепить чек!");

  tg.MainButton.showProgress();
  tg.MainButton.text = "Создание записи...";
  tg.MainButton.show();

  let uploadedUrls = [];
  for (let file of selectedFiles) {
    const url = await uploadToImgBB(file);
    if (url) uploadedUrls.push(url);
  }

  let receiptUrl = "";
  if (selectedTariff === "vip" && selectedReceipt) {
    receiptUrl = await uploadToImgBB(selectedReceipt);
  }

  if (uploadedUrls.length === 0) {
    tg.MainButton.hideProgress();
    tg.MainButton.hide();
    return tg.showAlert("Ошибка загрузки фото");
  }

  const vipTill =
    selectedTariff === "vip" ? Date.now() + 3 * 24 * 60 * 60 * 1000 : 0;

  const ad = {
    id: Date.now(),
    title,
    price,
    dateReceived,
    phone,
    address,
    tgNick,
    city,
    cat,
    desc,
    img: uploadedUrls,
    status: "active",
    userId: tg.initDataUnsafe?.user?.id || 0,
    tariff: selectedTariff,
    vipTill: vipTill,
    receipt: receiptUrl,
  };

  await sendToBot(ad);
  ads.unshift(ad);
  localStorage.setItem("gifts_final_v12", JSON.stringify(ads));

  // ОЧИСТКА ВСЕХ ПОЛЕЙ
  document.getElementById("in-title").value = "";
  document.getElementById("in-price").value = "";
  document.getElementById("in-date").value = "";
  document.getElementById("in-wa").value = "";
  document.getElementById("in-address").value = "";
  document.getElementById("in-tg").value = "";
  document.getElementById("in-desc").value = "";
  document.getElementById("in-city").value = "Бишкек";
  document.getElementById("in-cat").value = "flowers";

  selectedFiles = [];
  selectedReceipt = null;
  selectTariff("standard");
  document.getElementById("gallery-preview").innerHTML = "";
  document.getElementById("preview-box").classList.add("hidden");
  document.getElementById("file-label").innerText = "Нажмите для выбора фото";
  document.getElementById("receipt-label").innerText = "Добавить чек";

  tg.MainButton.hideProgress();
  tg.MainButton.hide();
  tg.showAlert("Объявление создано!");
  showPage("home");
}

async function sendToBot(ad) {
  let text = `📦 ${ad.title}\n💰 ${ad.price} KGS\n📅 ${ad.dateReceived}\n📍 ${ad.city}`;
  if (ad.tariff === "vip") text += `\n🌟 VIP ЗАЯВКА (Чек прикреплен)`;
  const urlGroup = `https://api.telegram.org/bot${BOT_TOKEN}/sendMediaGroup`;
  try {
    let mediaGroup = ad.img.map((imgUrl, index) => ({
      type: "photo",
      media: imgUrl,
      caption: index === 0 ? text : "",
    }));
    if (ad.receipt) {
      mediaGroup.push({
        type: "photo",
        media: ad.receipt,
        caption: "🧾 ЧЕК ОПЛАТЫ",
      });
    }
    await fetch(urlGroup, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: ADMIN_ID, media: mediaGroup }),
    });
  } catch (e) {
    console.error(e);
  }
}

// ---------------------------------------------------------
// ПРОДУКТ (БЕЗ ИЗМЕНЕНИЙ)
// ---------------------------------------------------------
function openProduct(ad) {
  const modal = document.getElementById("product-modal");
  const favIconArea = document.getElementById("modal-fav-icon");
  const isFav = favs.includes(ad.id);
  const catName = catMap[ad.cat] || "Товар";
  const images = Array.isArray(ad.img) ? ad.img : [ad.img];

  favIconArea.innerHTML = `<i class="${
    isFav ? "fa-solid" : "fa-regular"
  } fa-heart" style="color:var(--pink); font-size:22px;" onclick="toggleFav(${
    ad.id
  })"></i>`;

  let galleryHTML = "";
  if (ad.status === "deleted") {
    galleryHTML = `<div class="deleted-placeholder" style="height:250px;"><span class="deleted-text" style="font-size:14px;">Фото скрыто<br>для конфиденциальности</span></div>`;
  } else {
    let imagesHtml = images.map((src) => `<img src="${src}">`).join("");
    let dotsHtml =
      images.length > 1
        ? images
            .map((_, i) => `<div class="dot ${i === 0 ? "active" : ""}"></div>`)
            .join("")
        : "";
    galleryHTML = `<div class="product-gallery">${imagesHtml}</div>${
      images.length > 1 ? `<div class="gallery-dots">${dotsHtml}</div>` : ""
    }`;
  }

  let contactInfoHTML = "";
  if (ad.status === "active") {
    contactInfoHTML = `
        <a href="https://t.me/${ad.tgNick.replace(
          "@",
          ""
        )}" target="_blank" class="pd-btn-write">Написать продавцу</a>
        <div class="contact-info-block"><div class="contact-label">📍 ГОРОД</div><div class="contact-value">${
          ad.city
        }</div></div>
        <div class="contact-info-block"><div class="contact-label">🏠 АДРЕС</div><div class="contact-value">${
          ad.address || "Не указан"
        }</div></div>
        <div class="contact-info-block"><div class="contact-label">📅 ДАТА ПОЛУЧЕНИЯ</div><div class="contact-value">${
          ad.dateReceived || "-"
        }</div></div>
        <div class="contact-info-block"><div class="contact-label">📱 ТЕЛЕФОН</div><div class="contact-value">${
          ad.phone
        }</div></div>
      `;
  } else {
    contactInfoHTML = `<div class="hidden-contacts-msg"><i class="fa fa-lock" style="margin-bottom:5px;"></i><br>Контактные данные скрыты,<br>так как товар продан.</div>`;
  }

  document.getElementById(
    "pv-content"
  ).innerHTML = `${galleryHTML}<div class="pd-body"><div class="pd-price">${
    ad.price
  } KGS</div><div class="pd-title" style="font-size:18px; color:#aaa; margin-bottom:5px;">${catName} - <span style="color:white;">${
    ad.title
  }</span></div><p style="color:#eee; font-size:15px; margin-bottom:20px; line-height:1.5;">${
    ad.desc || "Без описания"
  }</p>${contactInfoHTML}</div>`;
  modal.classList.remove("hidden");
  tg.BackButton.show();
  tg.BackButton.onClick(closeProduct);
}

function closeProduct() {
  document.getElementById("product-modal").classList.add("hidden");
  tg.BackButton.hide();
}

function toggleFav(id) {
  if (favs.includes(id)) favs = favs.filter((f) => f !== id);
  else favs.push(id);
  localStorage.setItem("favs_final_v12", JSON.stringify(favs));
  renderFeed();
  renderFavs();
}

// ---------------------------------------------------------
// ПРОФИЛЬ (БЕЗ ИЗМЕНЕНИЙ)
// ---------------------------------------------------------
function switchProfileTab(tab) {
  currentProfileTab = tab;
  document
    .getElementById("p-tab-active")
    .classList.toggle("active", tab === "active");
  document
    .getElementById("p-tab-sold")
    .classList.toggle("active", tab === "sold");
  renderProfileAds();
}

function renderProfileAds() {
  const grid = document.getElementById("my-ads-grid");
  const myId = tg.initDataUnsafe?.user?.id || 0;
  let myAds =
    currentProfileTab === "active"
      ? ads.filter((a) => a.userId === myId && a.status === "active")
      : ads.filter(
          (a) =>
            a.userId === myId && (a.status === "sold" || a.status === "deleted")
        );

  grid.innerHTML = myAds.length
    ? ""
    : '<p style="text-align:center; padding:50px; color:gray;">Пусто</p>';
  myAds.forEach((ad) => {
    const cardWrapper = document.createElement("div");
    cardWrapper.className = "card";
    const catName = catMap[ad.cat] || "Товар";
    let cover = Array.isArray(ad.img) ? ad.img[0] : ad.img;
    let imgBlock =
      ad.status === "deleted"
        ? `<div class="deleted-placeholder" style="height:140px; font-size:10px; padding:10px;">Фото скрыто</div>`
        : `${
            ad.status === "sold" ? `<div class="sold-badge">ПРОДАНО</div>` : ""
          }<img src="${cover}" style="height:140px; width:100%; object-fit:cover;">`;
    let buttonsHTML =
      ad.status === "active"
        ? `<div class="profile-actions"><button class="btn-mini btn-edit" onclick="tg.showAlert('Скоро')">Изменить</button><button class="btn-mini btn-sold-action" onclick="showActionPopup(${ad.id})">Продано</button></div>`
        : `<div style="text-align:center; font-size:12px; color:gray; margin-top:10px; font-weight:bold;">Статус: Продано</div>`;

    cardWrapper.innerHTML = `${imgBlock}<div class="card-body"><span class="card-price">${ad.price} KGS</span><div class="card-cat-row"><span class="card-category">${catName}</span> ${ad.title}</div>${buttonsHTML}</div>`;
    grid.appendChild(cardWrapper);
  });
}

function showActionPopup(id) {
  tg.showPopup(
    {
      title: "Завершение сделки",
      message: "Выберите действие:",
      buttons: [
        { id: "sold", type: "default", text: "Продано" },
        { id: "delete", type: "destructive", text: "Удалить" },
        { id: "cancel", type: "cancel" },
      ],
    },
    (btnId) => {
      if (btnId === "sold") changeStatus(id, "sold");
      if (btnId === "delete") changeStatus(id, "deleted");
    }
  );
}

function changeStatus(id, newStatus) {
  const ad = ads.find((a) => a.id === id);
  if (ad) {
    ad.status = newStatus;
    localStorage.setItem("gifts_final_v12", JSON.stringify(ads));
    renderProfileAds();
    renderFeed();
    renderFavs();
  }
}

function showPage(p) {
  document.querySelectorAll(".page").forEach((s) => s.classList.add("hidden"));
  document.getElementById(`page-${p}`).classList.remove("hidden");
  document
    .querySelectorAll(".nav-item")
    .forEach((i) => i.classList.remove("active"));
  const navBtn = document.getElementById(`n-${p}`);
  if (navBtn) navBtn.classList.add("active");
  if (p === "home") renderFeed();
  if (p === "favs") renderFavs();
  if (p === "profile") renderProfileAds();
}

function renderFavs() {
  const container = document.getElementById("favs-content-area");
  const data = ads.filter((a) => favs.includes(a.id));
  if (data.length === 0)
    return (container.innerHTML = `<div style="text-align:center; padding:50px; color:gray;">Пусто</div>`);
  container.innerHTML = `<div class="listings-grid"></div>`;
  const grid = container.querySelector(".listings-grid");
  data.forEach((ad) => grid.appendChild(createAdCard(ad)));
}

function clearFavs() {
  favs = [];
  localStorage.setItem("favs_final_v12", JSON.stringify(favs));
  renderFavs();
}
