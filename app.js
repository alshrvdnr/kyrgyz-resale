const tg = window.Telegram.WebApp;
tg.expand();

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

// Состояние
let ads = JSON.parse(localStorage.getItem("gifts_final_v12")) || [];
let favs = JSON.parse(localStorage.getItem("favs_final_v12")) || [];
let curCat = "Все",
  curCity = "Все",
  filterSort = "default";
let currentProfileTab = "active";
let selectedFiles = [],
  selectedReceipt = null,
  selectedTariff = "standard";
let editingId = null; // ID редактируемого объявления

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

// РЕНДЕР
function renderFeed(data = ads) {
  const grid = document.getElementById("home-grid");
  if (!grid) return;
  grid.innerHTML = "";

  let filtered = data.filter((ad) => {
    return (
      (curCat === "Все" || ad.cat === curCat) &&
      (curCity === "Все" || ad.city === curCity)
    );
  });

  filtered.forEach((ad) => grid.appendChild(createAdCard(ad)));
}

function createAdCard(ad) {
  const catName = catMap[ad.cat] || "Товар";
  let coverImg = Array.isArray(ad.img) ? ad.img[0] : ad.img;
  const isSold = ad.status === "sold";
  const isDeleted = ad.status === "deleted";
  const isVip = ad.tariff === "vip" && ad.vipTill > Date.now();
  const timeStr = ad.id
    ? new Date(ad.id).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  let badgeHTML = "";
  if (isSold || isDeleted) badgeHTML = `<div class="sold-badge">ПРОДАНО</div>`;
  else if (isVip) badgeHTML = `<div class="vip-badge">VIP</div>`;

  let imageHTML = isDeleted
    ? `${badgeHTML}<div class="deleted-placeholder"><span class="deleted-text">Фото скрыто для конфиденциальности</span></div>`
    : `${badgeHTML}<img src="${coverImg}" loading="lazy" style="height:140px; object-fit:cover; width:100%;">`;

  const isFav = favs.includes(ad.id);
  const heartColor = isFav ? "var(--pink)" : "white";

  const card = document.createElement("div");
  card.className = "card";
  card.onclick = () => openProduct(ad);

  // Кнопки управления (только для владельца в профиле)
  let actionsHTML = "";
  const myId = tg.initDataUnsafe?.user?.id || 0;
  if (ad.userId === myId) {
    if (ad.status === "active") {
      actionsHTML = `
            <div class="profile-actions">
                <button class="btn-mini btn-edit" onclick="event.stopPropagation(); editAd(${ad.id})">Изменить</button>
                <button class="btn-mini btn-sold-action" onclick="event.stopPropagation(); markAsSold(${ad.id})">Продано</button>
            </div>`;
    } else if (ad.status === "sold") {
      actionsHTML = `
            <div class="profile-actions">
                <button class="btn-mini btn-edit" style="background:#ff3b30; color:white; flex:1;" onclick="event.stopPropagation(); deleteAd(${ad.id})">Удалить</button>
            </div>`;
    }
  }

  card.innerHTML = `
      <button class="card-fav-btn" onclick="event.stopPropagation(); toggleFav(${
        ad.id
      })">
         <i class="${
           isFav ? "fa-solid" : "fa-regular"
         } fa-heart" style="color:${heartColor}"></i>
      </button>
      ${imageHTML}
      <div class="card-body">
        <div class="card-price-row">
            <span class="card-price">${ad.price} KGS</span>
            <span class="card-time">${timeStr}</span>
        </div>
        <div class="card-cat-row"><span class="card-category">${catName}</span> ${
    ad.title
  }</div>
        <div class="card-date-block">
            <span class="date-label">Дата получения</span>
            <span class="date-value">${ad.dateReceived}</span>
        </div>
        ${actionsHTML}
      </div>`;
  return card;
}

// КНОПКИ УПРАВЛЕНИЯ
function markAsSold(id) {
  tg.showConfirm(
    "Вы точно уверены, что хотите нажать «Продано», потому что объявление исчезнет из активных?",
    (confirmed) => {
      if (confirmed) {
        const idx = ads.findIndex((a) => a.id === id);
        if (idx !== -1) {
          ads[idx].status = "sold";
          saveAndRefresh();
        }
      }
    }
  );
}

function deleteAd(id) {
  const idx = ads.findIndex((a) => a.id === id);
  if (idx !== -1) {
    ads[idx].status = "deleted";
    saveAndRefresh();
  }
}

function editAd(id) {
  const ad = ads.find((a) => a.id === id);
  if (!ad) return;

  editingId = id;
  showPage("add");

  // Меняем UI под редактирование
  document.getElementById("add-title-text").innerText = "Изменение объявления";
  document.getElementById("publish-btn").innerText = "Сохранить изменения";
  document.getElementById("tariff-selection-area").style.display = "none";

  // Заполняем поля
  document.getElementById("in-title").value = ad.title;
  document.getElementById("in-price").value = ad.price;
  document.getElementById("in-date").value = ad.dateReceived;
  document.getElementById("in-wa").value = ad.phone;
  document.getElementById("in-address").value = ad.address;
  document.getElementById("in-tg").value = ad.tgNick;
  document.getElementById("in-city").value = ad.city;
  document.getElementById("in-cat").value = ad.cat;
  document.getElementById("in-desc").value = ad.desc || "";
}

function cancelAdd() {
  editingId = null;
  document.getElementById("add-title-text").innerText = "Новое объявление";
  document.getElementById("publish-btn").innerText = "Опубликовать";
  document.getElementById("tariff-selection-area").style.display = "flex";
  showPage("home");
}

function saveAndRefresh() {
  localStorage.setItem("gifts_final_v12", JSON.stringify(ads));
  renderFeed();
  renderProfileAds();
}

// МОДАЛКА (МАКЕТ ПОСТА)
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

  let galleryHTML =
    ad.status === "deleted"
      ? `<div class="deleted-placeholder" style="height:350px"><span class="deleted-text">Фото скрыто для конфиденциальности</span></div>`
      : `<div class="product-gallery">${images
          .map((s) => `<img src="${s}">`)
          .join("")}</div>`;

  document.getElementById("pv-content").innerHTML = `
    ${galleryHTML}
    <div class="pd-body">
        <!-- Раздел стоимости -->
        <div class="info-cell" style="background: rgba(255,143,177,0.1); border-color: var(--pink);">
            <span class="info-cell-label">Сколько будет стоить</span>
            <div class="pd-price" style="font-size: 22px;">${ad.price} KGS</div>
            <div style="font-size: 14px; margin-top: 5px;">Тип: ${catName} — ${
    ad.title
  }</div>
        </div>
        
        <!-- Кнопка написать -->
        <a href="https://t.me/${ad.tgNick.replace(
          "@",
          ""
        )}" target="_blank" class="pd-btn-write">Написать продавцу</a>

        <!-- Описание -->
        <div class="pd-desc-label">Описание</div>
        <div class="info-cell" style="min-height: 60px;">${
          ad.desc || "Описание отсутствует"
        }</div>

        <!-- Ячейки инфо -->
        <div class="info-cell">
            <span class="info-cell-label">Город</span>
            <span class="info-cell-value">${ad.city}</span>
        </div>
        <div class="info-cell">
            <span class="info-cell-label">Адрес</span>
            <span class="info-cell-value">${ad.address || "Не указан"}</span>
        </div>
        <div class="info-cell">
            <span class="info-cell-label">Дата получения</span>
            <span class="info-cell-value">${ad.dateReceived}</span>
        </div>
        <div class="info-cell">
            <span class="info-cell-label">Связь (Telegram / Телефон)</span>
            <span class="info-cell-value">@${ad.tgNick.replace("@", "")} <br> ${
    ad.phone || "—"
  }</span>
        </div>
    </div>`;

  modal.classList.remove("hidden");
  tg.BackButton.show();
  tg.BackButton.onClick(closeProduct);
}

function closeProduct() {
  document.getElementById("product-modal").classList.add("hidden");
  tg.BackButton.hide();
}

// ФУНКЦИИ ПОДАЧИ
async function publishAndSend() {
  const title = document.getElementById("in-title").value;
  const price = document.getElementById("in-price").value;
  const date = document.getElementById("in-date").value;
  const wa = document.getElementById("in-wa").value;
  const addr = document.getElementById("in-address").value;
  const tgNick = document.getElementById("in-tg").value;
  const city = document.getElementById("in-city").value;
  const cat = document.getElementById("in-cat").value;
  const desc = document.getElementById("in-desc").value;

  if (!title || !price || !date)
    return tg.showAlert("Заполните основные поля!");

  tg.MainButton.showProgress();
  tg.MainButton.show();

  let finalImg = [];
  if (editingId) {
    finalImg = ads.find((a) => a.id === editingId).img;
  }

  // Если добавлены новые фото
  if (selectedFiles.length > 0) {
    finalImg = [];
    for (let file of selectedFiles) {
      const url = await uploadToImgBB(file);
      if (url) finalImg.push(url);
    }
  }

  if (finalImg.length === 0) {
    tg.MainButton.hide();
    return tg.showAlert("Нужно фото!");
  }

  if (editingId) {
    const idx = ads.findIndex((a) => a.id === editingId);
    ads[idx] = {
      ...ads[idx],
      title,
      price,
      dateReceived: date,
      phone: wa,
      address: addr,
      tgNick,
      city,
      cat,
      desc,
      img: finalImg,
    };
    editingId = null;
  } else {
    const ad = {
      id: Date.now(),
      title,
      price,
      dateReceived: date,
      phone: wa,
      address: addr,
      tgNick,
      city,
      cat,
      desc,
      img: finalImg,
      status: "active",
      userId: tg.initDataUnsafe?.user?.id || 0,
      tariff: selectedTariff,
      vipTill: selectedTariff === "vip" ? Date.now() + 259200000 : 0,
    };
    ads.unshift(ad);
    await sendToBot(ad);
  }

  saveAndRefresh();
  resetAddForm();
  tg.MainButton.hide();
  showPage("home");
}

function resetAddForm() {
  document.querySelectorAll(".main-input").forEach((i) => (i.value = ""));
  selectedFiles = [];
  document.getElementById("gallery-preview").innerHTML = "";
  document.getElementById("preview-box").classList.add("hidden");
  editingId = null;
  document.getElementById("add-title-text").innerText = "Новое объявление";
  document.getElementById("publish-btn").innerText = "Опубликовать";
}

// ВСПОМОГАТЕЛЬНЫЕ (ОСТАВЛЕНЫ БЕЗ ИЗМЕНЕНИЙ)
function toggleFav(id) {
  favs = favs.includes(id) ? favs.filter((f) => f !== id) : [...favs, id];
  localStorage.setItem("favs_final_v12", JSON.stringify(favs));
  renderFeed();
}
function handleFileSelect(input) {
  selectedFiles = Array.from(input.files).slice(0, 5);
  const gallery = document.getElementById("gallery-preview");
  gallery.innerHTML = "";
  document.getElementById("preview-box").classList.remove("hidden");
  document.getElementById("photo-count").innerText = selectedFiles.length;
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
function selectTariff(t) {
  selectedTariff = t;
  document
    .getElementById("tariff-std")
    .classList.toggle("active", t === "standard");
  document.getElementById("tariff-vip").classList.toggle("active", t === "vip");
  document.getElementById("vip-block").classList.toggle("hidden", t !== "vip");
}
async function uploadToImgBB(file) {
  const formData = new FormData();
  formData.append("image", file);
  try {
    const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    return data.success ? data.data.url : null;
  } catch (e) {
    return null;
  }
}
async function sendToBot(ad) {
  let text = `📦 ${ad.title}\n💰 ${ad.price} KGS\n📍 ${ad.city}`;
  try {
    let media = ad.img.map((url, i) => ({
      type: "photo",
      media: url,
      caption: i === 0 ? text : "",
    }));
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMediaGroup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: ADMIN_ID, media: media }),
    });
  } catch (e) {}
}
function showPage(p) {
  document.querySelectorAll(".page").forEach((s) => s.classList.add("hidden"));
  document.getElementById(`page-${p}`).classList.remove("hidden");
  document
    .querySelectorAll(".nav-item")
    .forEach((i) => i.classList.remove("active"));
  if (document.getElementById(`n-${p}`))
    document.getElementById(`n-${p}`).classList.add("active");
  document.querySelector(".bottom-nav").style.display =
    p === "add" || p === "filter" ? "none" : "flex";
  if (p === "home") renderFeed();
  if (p === "profile") renderProfileAds();
}
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
  const myAds = ads.filter(
    (a) =>
      a.userId === myId &&
      (currentProfileTab === "active"
        ? a.status === "active"
        : a.status === "sold" || a.status === "deleted")
  );
  grid.innerHTML = myAds.length
    ? ""
    : '<p style="text-align:center; padding:50px; color:gray;">Пусто</p>';
  myAds.forEach((ad) => grid.appendChild(createAdCard(ad)));
}
function handleReceiptSelect(input) {
  if (input.files[0])
    document.getElementById("receipt-label").innerText = "Чек добавлен ✅";
}
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
