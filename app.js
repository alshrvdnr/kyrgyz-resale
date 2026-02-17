const tg = window.Telegram.WebApp;
tg.expand();

const BOT_TOKEN = "8399814024:AAEla8xBVk_9deHydJV0hrc5QYDyXAFpZ8k";
const ADMIN_ID = "1615492914";

let ads = JSON.parse(localStorage.getItem("gifts_final_v12")) || [];
let favs = JSON.parse(localStorage.getItem("favs_final_v12")) || [];
let curCat = "Все";
let currentFavTab = "ads";
let uploadedBase64 = "";
let currentProfileTab = "active";

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

// ГЛАВНЫЙ ФИД (Название под ценой)
function renderFeed(data = ads) {
  const grid = document.getElementById("home-grid");
  if (!grid) return;
  grid.innerHTML = "";
  let filtered = curCat === "Все" ? data : data.filter((a) => a.cat === curCat);
  filtered.forEach((ad) => {
    // Если продано - убираем лишнее в карточке
    const isSold = ad.status === "sold";
    const card = document.createElement("div");
    card.className = "card";
    card.onclick = () => openProduct(ad);
    card.innerHTML = `
        <img src="${ad.img}">
        <div class="card-body">
            <span class="card-price">${ad.price} KGS</span>
            <span class="card-title">${ad.title}</span>
            ${
              isSold
                ? '<b style="color:gray; font-size:10px;">ПРОДАНО</b>'
                : `<span class="card-city">${ad.city}</span>`
            }
        </div>`;
    grid.appendChild(card);
  });
}

// ПРОФИЛЬ (Управление)
function renderProfileAds() {
  const grid = document.getElementById("my-ads-grid");
  const myId = tg.initDataUnsafe?.user?.id || 0;
  const myAds = ads.filter(
    (a) =>
      a.userId === myId &&
      (currentProfileTab === "active"
        ? a.status !== "deleted"
        : a.status === "sold")
  );

  grid.innerHTML = myAds.length
    ? ""
    : '<p style="text-align:center; padding:50px; color:gray;">У вас нет объявлений</p>';

  myAds.forEach((ad) => {
    const isSold = ad.status === "sold";
    const card = document.createElement("div");
    card.className = "manage-card";
    card.innerHTML = `
        <div class="manage-info">
            <img src="${ad.img}">
            <div class="manage-text">
                <div class="card-price">${ad.price} KGS</div>
                <div class="card-title">${ad.title}</div>
                ${
                  !isSold
                    ? `<div style="font-size:10px; color:gray; margin-top:5px;">${ad.desc.substring(
                        0,
                        30
                      )}...</div>`
                    : '<b style="color:var(--pink)">ПРОДАНО</b>'
                }
            </div>
        </div>
        <div class="manage-btns">
            <button class="btn-edit-main" onclick="openEditAd(${
              ad.id
            })">Изменить</button>
            <div class="btn-row">
                <button class="btn-sold" onclick="markAsSold(${ad.id})">${
      isSold ? "В активные" : "Продано"
    }</button>
                <button class="btn-del" onclick="deleteAd(${
                  ad.id
                })">Удалить</button>
            </div>
        </div>
    `;
    grid.appendChild(card);
  });
}

// ФУНКЦИИ УПРАВЛЕНИЯ
function openEditAd(id) {
  const ad = ads.find((a) => a.id === id);
  if (!ad) return;
  document.getElementById("edit-id").value = ad.id;
  document.getElementById("edit-title").value = ad.title;
  document.getElementById("edit-price").value = ad.price;
  document.getElementById("edit-address").value = ad.address || "";
  showPage("edit-ad");
}

function saveAdEdit() {
  const id = parseInt(document.getElementById("edit-id").value);
  const ad = ads.find((a) => a.id === id);
  if (ad) {
    ad.title = document.getElementById("edit-title").value;
    ad.price = document.getElementById("edit-price").value;
    ad.address = document.getElementById("edit-address").value;
    localStorage.setItem("gifts_final_v12", JSON.stringify(ads));
    tg.showAlert("Изменения сохранены!");
    showPage("profile");
  }
}

function markAsSold(id) {
  const ad = ads.find((a) => a.id === id);
  if (ad) {
    ad.status = ad.status === "sold" ? "active" : "sold";
    localStorage.setItem("gifts_final_v12", JSON.stringify(ads));
    renderProfileAds();
  }
}

function deleteAd(id) {
  if (confirm("Удалить объявление навсегда?")) {
    ads = ads.filter((a) => a.id !== id);
    localStorage.setItem("gifts_final_v12", JSON.stringify(ads));
    renderProfileAds();
  }
}

// ОСНОВНАЯ ЛОГИКА
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

function publishAndSend() {
  const title = document.getElementById("in-title").value;
  const price = document.getElementById("in-price").value;
  const phone = document.getElementById("in-wa").value;
  const address = document.getElementById("in-address").value;
  const tgNick = document.getElementById("in-tg").value;
  const city = document.getElementById("in-city").value;
  const cat = document.getElementById("in-cat").value;
  const desc = document.getElementById("in-desc").value;

  if (!title || !price || !uploadedBase64)
    return tg.showAlert("Заполните поля и фото!");

  const ad = {
    id: Date.now(),
    title,
    price,
    phone,
    address,
    tgNick,
    city,
    cat,
    desc,
    img: uploadedBase64,
    status: "active",
    userId: tg.initDataUnsafe?.user?.id || 0,
  };

  ads.unshift(ad);
  localStorage.setItem("gifts_final_v12", JSON.stringify(ads));
  tg.showAlert("Опубликовано!");
  showPage("home");
}

function openProduct(ad) {
  const modal = document.getElementById("product-modal");
  document.getElementById("pv-content").innerHTML = `
        <img src="${ad.img}" style="width:100%;">
        <div class="pd-body">
            <div class="pd-price">${ad.price} KGS</div>
            <div class="pd-title">${ad.title}</div>
            <a href="https://t.me/${ad.tgNick.replace(
              "@",
              ""
            )}" target="_blank" class="pd-btn-write">Написать</a>
            <p style="color:#eee; line-height:1.6;">${ad.desc}</p>
            <div style="background:#1c1c1e; padding:15px; border-radius:12px; margin-top:10px;">
                <small style="color:gray;">📍 АДРЕС</small>
                <div>${ad.city}, ${ad.address || "Уточняйте"}</div>
                <small style="color:gray; display:block; margin-top:10px;">📱 ТЕЛЕФОН</small>
                <div>${ad.phone}</div>
            </div>
        </div>`;
  modal.classList.remove("hidden");
}

function handleFileSelect(input) {
  const file = input.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      uploadedBase64 = e.target.result;
      document.getElementById("img-preview").src = uploadedBase64;
      document.getElementById("preview-box").classList.remove("hidden");
    };
    reader.readAsDataURL(file);
  }
}

function switchFavTab(tab) {
  currentFavTab = tab;
  renderFavs();
}
function switchProfileTab(tab) {
  currentProfileTab = tab;
  renderProfileAds();
}
function closeProduct() {
  document.getElementById("product-modal").classList.add("hidden");
}
function clearFavs() {
  favs = [];
  renderFavs();
}
function filterByCat(c, el) {
  curCat = c;
  renderFeed();
}
