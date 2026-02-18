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

let curCat = "Все",
  curCity = "Все",
  curMainTab = "rec",
  filterSort = "default";
let currentProfileTab = "active",
  selectedFiles = [],
  selectedReceipt = null,
  selectedTariff = "standard",
  editingId = null;

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

function switchMainTab(tab) {
  curMainTab = tab;
  document.getElementById("mtab-rec").classList.toggle("active", tab === "rec");
  document.getElementById("mtab-new").classList.toggle("active", tab === "new");
  renderFeed();
}

function renderFeed(data = ads) {
  const grid = document.getElementById("home-grid");
  if (!grid) return;
  grid.innerHTML = "";

  let filtered = data.filter((ad) => {
    const catMatch = curCat === "Все" || ad.cat === curCat;
    const cityMatch = curCity === "Все" || ad.city === curCity;

    if (curMainTab === "rec") {
      return (
        catMatch && cityMatch && ad.tariff === "vip" && ad.status === "active"
      );
    } else {
      return catMatch && cityMatch;
    }
  });

  if (curMainTab === "new") {
    filtered.sort((a, b) => {
      if (a.status !== b.status) return a.status === "active" ? -1 : 1;
      return b.id - a.id;
    });
  }

  filtered.forEach((ad) => grid.appendChild(createAdCard(ad, false)));
}

function createAdCard(ad, isProfile = false) {
  const catName = catMap[ad.cat] || "Товар";
  let coverImg = ad.img[0];
  const isVip = ad.tariff === "vip" && ad.vipTill > Date.now();
  const timeStr = new Date(ad.id).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  let badgeHTML = "";
  if (ad.status === "sold" || ad.status === "deleted")
    badgeHTML = `<div class="sold-badge">ПРОДАНО</div>`;
  else if (isVip) badgeHTML = `<div class="vip-badge">VIP</div>`;

  let imageClass = ad.status === "deleted" ? "blur-img" : "";
  let imageHTML = `<img src="${coverImg}" class="${imageClass}" loading="lazy" style="height:140px; object-fit:cover; width:100%;">`;

  const isFav = favs.includes(ad.id);
  const heartColor = isFav ? "var(--pink)" : "white";

  const card = document.createElement("div");
  card.className = "card";
  card.onclick = () => openProduct(ad);

  let actionsHTML = "";
  if (isProfile && ad.userId === (tg.initDataUnsafe?.user?.id || 0)) {
    if (ad.managing) {
      actionsHTML = `
            <div class="profile-actions-triple">
                <button class="btn-mini btn-edit" style="background:var(--pink); color:black;" onclick="event.stopPropagation(); setStatus(${ad.id}, 'sold')">Продано</button>
                <button class="btn-mini btn-edit" style="background:#ff3b30; color:white;" onclick="event.stopPropagation(); setStatus(${ad.id}, 'deleted')">Удалить</button>
                <button class="btn-mini btn-edit" onclick="event.stopPropagation(); cancelManage(${ad.id})">Отмена</button>
            </div>`;
    } else {
      actionsHTML = `
            <div class="profile-actions">
                <button class="btn-mini btn-edit" onclick="event.stopPropagation(); editAd(${ad.id})">Изменить</button>
                <button class="btn-mini btn-sold-action" onclick="event.stopPropagation(); startManage(${ad.id})">Продано</button>
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
      ${badgeHTML}${imageHTML}
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

function startManage(id) {
  const idx = ads.findIndex((a) => a.id === id);
  ads[idx].managing = true;
  renderProfileAds();
}

function cancelManage(id) {
  const idx = ads.findIndex((a) => a.id === id);
  ads[idx].managing = false;
  renderProfileAds();
}

function setStatus(id, status) {
  const idx = ads.findIndex((a) => a.id === id);
  ads[idx].status = status;
  ads[idx].managing = false;
  localStorage.setItem("gifts_final_v12", JSON.stringify(ads));
  renderProfileAds();
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

function openProduct(ad) {
  const modal = document.getElementById("product-modal");
  const isFav = favs.includes(ad.id);
  const images = ad.img;
  const isSold = ad.status === "sold" || ad.status === "deleted";

  document.getElementById("modal-fav-icon").innerHTML = `<i class="${
    isFav ? "fa-solid" : "fa-regular"
  } fa-heart" style="color:var(--pink); font-size:22px;" onclick="toggleFav(${
    ad.id
  })"></i>`;

  let galleryClass = ad.status === "deleted" ? "blur-img" : "";
  let galleryHTML = `<div class="product-gallery">${images
    .map((s) => `<img src="${s}" class="${galleryClass}">`)
    .join("")}</div>`;

  let contactInfo = isSold
    ? ""
    : `
        <div class="info-cell">
            <span class="info-cell-label">Адрес</span>
            <span class="info-cell-value">${ad.address || "Не указан"}</span>
        </div>
        <div class="info-cell">
            <span class="info-cell-label">Связь (Telegram / Телефон)</span>
            <span class="info-cell-value">@${ad.tgNick} <br> ${
        ad.phone || "—"
      }</span>
        </div>`;

  document.getElementById("pv-content").innerHTML = `
    ${galleryHTML}
    <div class="pd-body">
        ${
          ad.status === "sold" || ad.status === "deleted"
            ? `<span class="info-cell-red-label">Продано</span>`
            : ""
        }
        <div class="info-cell" style="background: rgba(255,143,177,0.1); border-color: var(--pink);">
            <span class="info-cell-label">Сколько будет стоить</span>
            <div class="pd-price" style="font-size: 22px;">${ad.price} KGS</div>
            <div style="font-size: 14px; margin-top: 5px;">Тип: ${
              catMap[ad.cat]
            } — ${ad.title}</div>
        </div>
        
        ${
          isSold
            ? ""
            : `<a href="https://t.me/${ad.tgNick.replace(
                "@",
                ""
              )}" target="_blank" class="pd-btn-write">Написать продавцу</a>`
        }

        <div class="pd-desc-label">Описание</div>
        <div class="info-cell">${ad.desc || "Описание отсутствует"}</div>

        <div class="info-cell">
            <span class="info-cell-label">Город</span>
            <span class="info-cell-value">${ad.city}</span>
        </div>
        <div class="info-cell">
            <span class="info-cell-label">Дата получения</span>
            <span class="info-cell-value">${ad.dateReceived}</span>
        </div>
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

function toggleFav(id) {
  favs = favs.includes(id) ? favs.filter((f) => f !== id) : [...favs, id];
  localStorage.setItem("favs_final_v12", JSON.stringify(favs));
  renderFeed();
  renderFavs();
}

function renderFavs() {
  const container = document.getElementById("favs-content-area");
  const data = ads.filter((a) => favs.includes(a.id));

  if (data.length === 0) {
    container.innerHTML = `
        <div class="empty-favs-box">
            <div class="heart-square"><i class="fa-solid fa-heart"></i></div>
            <p class="empty-text">У вас пока нет избранных объявлений</p>
            <button class="go-search-btn" onclick="showPage('home')">В поиск</button>
        </div>`;
    return;
  }

  container.innerHTML = `<div class="listings-grid"></div>`;
  const grid = container.querySelector(".listings-grid");
  data.forEach((ad) => grid.appendChild(createAdCard(ad, false)));
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

async function publishAndSend() {
  const title = document.getElementById("in-title").value;
  const price = document.getElementById("in-price").value;
  const date = document.getElementById("in-date").value;
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
  showPage("home");
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
  document.getElementById("photo-count").innerText = selectedFiles.length;
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
function handleReceiptSelect(input) {
  if (input.files[0])
    document.getElementById("receipt-label").innerText = "Чек добавлен ✅";
}
