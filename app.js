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

let ads = JSON.parse(localStorage.getItem("gifts_final_v12")) || [];
let favs = JSON.parse(localStorage.getItem("favs_final_v12")) || [];

let curCat = "flowers";
let curCity = "Бишкек";
let currentProfileTab = "active";
let selectedFiles = [],
  selectedReceipt = null,
  selectedTariff = "standard",
  editingId = null;

document.addEventListener("DOMContentLoaded", () => {
  initUser();
  renderFeed();
});

function initUser() {
  const user = tg.initDataUnsafe?.user || { first_name: "Пользователь", id: 0 };
  const initial = user.first_name[0].toUpperCase();

  if (document.getElementById("u-avatar-top"))
    document.getElementById("u-avatar-top").innerText = initial;
  if (document.getElementById("u-avatar-big"))
    document.getElementById("u-avatar-big").innerText = initial;
  if (document.getElementById("u-name"))
    document.getElementById("u-name").innerText = user.first_name;
  if (document.getElementById("current-city-label"))
    document.getElementById("current-city-label").innerText = curCity;
}

// ГОРОДА
function showCitySelector() {
  document.getElementById("city-selector-overlay").classList.remove("hidden");
}
function hideCitySelector() {
  document.getElementById("city-selector-overlay").classList.add("hidden");
}
function selectCity(city) {
  curCity = city;
  document.getElementById("current-city-label").innerText = city;
  hideCitySelector();
  renderFeed();
}

// ЛЕНТА
function filterByCat(cat, el) {
  curCat = cat;
  document
    .querySelectorAll(".cat-card")
    .forEach((i) => i.classList.remove("active"));
  el.classList.add("active");
  const titles = {
    flowers: "Свежие букеты",
    gifts: "Свежие подарки",
    jewelry: "Свежая ювелирка",
    certs: "Свежие сертификаты",
  };
  document.getElementById("dynamic-feed-title").innerText =
    titles[cat] || "Свежие предложения";
  renderFeed();
}

function handleSearch(e) {
  if (e.key === "Enter") {
    const query = e.target.value.toLowerCase();
    const results = ads.filter((a) => a.title.toLowerCase().includes(query));
    renderFeedInternal(results, "results-grid");
    showPage("results");
    e.target.blur();
  }
}

function renderFeed(data = ads) {
  renderFeedInternal(data, "home-grid");
}

function renderFeedInternal(data, gridId) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  grid.innerHTML = "";
  let filtered = data.filter(
    (ad) => (curCat === "Все" || ad.cat === curCat) && ad.city === curCity
  );
  filtered.sort((a, b) => {
    if (a.status !== b.status) return a.status === "active" ? -1 : 1;
    return b.id - a.id;
  });
  filtered.forEach((ad) => grid.appendChild(createAdCard(ad, false)));
}

function createAdCard(ad, isProfile = false) {
  const card = document.createElement("div");
  card.className = "card";
  if (ad.status === "deleted") card.classList.add("blur-img");
  card.onclick = () => openProduct(ad);

  const isVip = ad.tariff === "vip" && ad.vipTill > Date.now();
  let badge = "";
  if (ad.status === "sold" || ad.status === "deleted")
    badge = `<div class="sold-badge">ПРОДАНО</div>`;
  else if (isVip) badge = `<div class="vip-badge">VIP</div>`;

  const isFav = favs.includes(ad.id);
  const heartColor = isFav ? "var(--pink)" : "white";

  card.innerHTML = `
      ${badge}
      <button class="card-fav-btn" onclick="event.stopPropagation(); toggleFav(${
        ad.id
      })">
         <i class="${
           isFav ? "fa-solid" : "fa-regular"
         } fa-heart" style="color:${heartColor}"></i>
      </button>
      <img src="${ad.img[0]}" loading="lazy">
      <div class="card-body">
        <span class="card-cat-row">${ad.title}</span>
        <span class="card-price">${ad.price} KGS</span>
      </div>
      ${isProfile ? renderProfileControls(ad) : ""}
  `;
  return card;
}

function renderProfileControls(ad) {
  if (ad.status !== "active" && !ad.managing) return ""; // Скрываем кнопки для архива

  if (ad.managing) {
    return `<div class="profile-actions-triple">
            <button class="btn-mini btn-sold-action" onclick="event.stopPropagation(); setStatus(${ad.id}, 'sold')">Продано</button>
            <button class="btn-mini" style="background:#ff3b30; color:white;" onclick="event.stopPropagation(); setStatus(${ad.id}, 'deleted')">Удалить</button>
            <button class="btn-mini btn-cancel" onclick="event.stopPropagation(); cancelManage(${ad.id})">Отмена</button>
        </div>`;
  }
  return `<div class="profile-actions"><button class="btn-mini btn-edit" onclick="event.stopPropagation(); editAd(${ad.id})">Изменить</button>
    <button class="btn-mini btn-sold-action" onclick="event.stopPropagation(); startManage(${ad.id})">Управление</button></div>`;
}

function startManage(id) {
  ads.find((a) => a.id === id).managing = true;
  renderProfileAds();
}
function cancelManage(id) {
  ads.find((a) => a.id === id).managing = false;
  renderProfileAds();
}
function setStatus(id, s) {
  const ad = ads.find((a) => a.id === id);
  ad.status = s;
  ad.managing = false;
  localStorage.setItem("gifts_final_v12", JSON.stringify(ads));
  renderProfileAds();
  renderFeed();
}

// МОДАЛКА
function openProduct(ad) {
  const modal = document.getElementById("product-modal");
  const isSold = ad.status === "sold" || ad.status === "deleted";
  const isFav = favs.includes(ad.id);
  document.getElementById("modal-fav-icon").innerHTML = `<i class="${
    isFav ? "fa-solid" : "fa-regular"
  } fa-heart" style="color:var(--pink); font-size:22px;" onclick="toggleFav(${
    ad.id
  })"></i>`;
  let imgClass = ad.status === "deleted" ? "blur-img" : "";
  let contactInfo = isSold
    ? ""
    : `
    <div class="info-cell"><span class="info-cell-label">Связь</span><span class="info-cell-value">@${
      ad.tgNick
    } <br> ${ad.phone}</span></div>
    <a href="https://t.me/${ad.tgNick.replace(
      "@",
      ""
    )}" target="_blank" class="pd-btn-write">Написать продавцу</a>`;

  document.getElementById("pv-content").innerHTML = `
    <div class="product-gallery">${ad.img
      .map((i) => `<img src="${i}" class="${imgClass}">`)
      .join("")}</div>
    <div class="pd-body">
        ${
          isSold
            ? `<span style="color:red; font-weight:bold; font-size:20px; display:block; margin-bottom:15px;">ПРОДАНО</span>`
            : ""
        }
        <div class="info-cell" style="background: rgba(255, 77, 141, 0.1); border-color: var(--pink);"><span class="info-cell-label">Стоимость</span><div class="pd-price">${
          ad.price
        } KGS</div><div style="font-size: 14px; margin-top: 5px;">${
    catMap[ad.cat]
  } — ${ad.title}</div></div>
        <div class="pd-desc-label">Описание</div><div class="info-cell">${
          ad.desc || "Описание отсутствует"
        }</div>
        <div class="info-cell"><span class="info-cell-label">Город</span>${
          ad.city
        }</div>
        <div class="info-cell"><span class="info-cell-label">Дата получения</span>${
          ad.dateReceived
        }</div>
        ${contactInfo}
    </div>`;
  modal.classList.remove("hidden");
  tg.BackButton.show();
  tg.BackButton.onClick(closeProduct);
}
function closeProduct() {
  document.getElementById("product-modal").classList.add("hidden");
  tg.BackButton.hide();
}

// ИЗБРАННОЕ
function toggleFav(id) {
  favs = favs.includes(id) ? favs.filter((f) => f !== id) : [...favs, id];
  localStorage.setItem("favs_final_v12", JSON.stringify(favs));
  renderFeed();
  renderFavs();
}
function clearFavs() {
  favs = [];
  localStorage.setItem("favs_final_v12", JSON.stringify(favs));
  renderFavs();
}
function renderFavs() {
  const container = document.getElementById("favs-content-area");
  const data = ads.filter((a) => favs.includes(a.id));
  if (data.length === 0) {
    container.innerHTML = `<div class="empty-favs-box"><div class="heart-square"><i class="fa-solid fa-heart"></i></div><p class="empty-text">У вас пока нет избранных объявлений</p><button class="go-search-btn" onclick="showPage('home')">В поиск</button></div>`;
    return;
  }
  container.innerHTML = `<div class="listings-grid"></div>`;
  data.forEach((ad) =>
    container
      .querySelector(".listings-grid")
      .appendChild(createAdCard(ad, false))
  );
}

// ПРОФИЛЬ
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
        : a.status !== "active")
  );
  grid.innerHTML = myAds.length
    ? ""
    : '<p style="text-align:center; padding:50px; color:gray;">Пусто</p>';
  myAds.forEach((ad) => grid.appendChild(createAdCard(ad, true)));
}

// ПОДАЧА
async function publishAndSend() {
  const title = document.getElementById("in-title").value,
    price = document.getElementById("in-price").value,
    date = document.getElementById("in-date").value;
  if (!title || !price || !date) return tg.showAlert("Заполните поля!");
  tg.MainButton.showProgress();
  tg.MainButton.show();
  let finalImg = editingId ? ads.find((a) => a.id === editingId).img : [];
  if (selectedFiles.length > 0) {
    finalImg = [];
    for (let f of selectedFiles) {
      const url = await uploadToImgBB(f);
      if (url) finalImg.push(url);
    }
  }
  if (editingId) {
    const idx = ads.findIndex((a) => a.id === editingId);
    ads[idx] = {
      ...ads[idx],
      title,
      price,
      dateReceived: date,
      phone: document.getElementById("in-wa").value,
      address: document.getElementById("in-address").value,
      tgNick: document.getElementById("in-tg").value,
      city: document.getElementById("in-city").value,
      cat: document.getElementById("in-cat").value,
      desc: document.getElementById("in-desc").value,
      img: finalImg,
    };
  } else {
    const ad = {
      id: Date.now(),
      title,
      price,
      dateReceived: date,
      phone: document.getElementById("in-wa").value,
      address: document.getElementById("in-address").value,
      tgNick: document.getElementById("in-tg").value,
      city: document.getElementById("in-city").value,
      cat: document.getElementById("in-cat").value,
      desc: document.getElementById("in-desc").value,
      img: finalImg,
      status: "active",
      userId: tg.initDataUnsafe?.user?.id || 0,
      tariff: selectedTariff,
      vipTill: selectedTariff === "vip" ? Date.now() + 259200000 : 0,
    };
    ads.unshift(ad);
    await sendToBot(ad);
  }
  localStorage.setItem("gifts_final_v12", JSON.stringify(ads));
  tg.MainButton.hide();
  cancelAdd();
  showPage("home");
}

function editAd(id) {
  const ad = ads.find((a) => a.id === id);
  editingId = id;
  showPage("add");
  document.getElementById("add-title-text").innerText = "Изменение";
  document.getElementById("publish-btn").innerText = "Сохранить";
  document.getElementById("tariff-selection-area").style.display = "none";
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

function handleFileSelect(input) {
  selectedFiles = Array.from(input.files).slice(0, 5);
  const gallery = document.getElementById("gallery-preview");
  gallery.innerHTML = "";
  document.getElementById("preview-box").classList.remove("hidden");
  selectedFiles.forEach((f) => {
    const r = new FileReader();
    r.onload = (e) => {
      const img = document.createElement("img");
      img.src = e.target.result;
      gallery.appendChild(img);
    };
    r.readAsDataURL(f);
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
function cancelAdd() {
  editingId = null;
  showPage("home");
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
  if (p === "favs") renderFavs();
}
function handleReceiptSelect(input) {
  if (input.files[0])
    document.getElementById("receipt-label").innerText = "Чек добавлен ✅";
}
function applyExtendedFilter() {
  showPage("home");
}
function resetExtendedFilter() {
  renderFeed();
}
