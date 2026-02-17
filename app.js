const tg = window.Telegram.WebApp;
tg.expand();

const BOT_TOKEN = "8399814024:AAEla8xBVk_9deHydJV0hrc5QYDyXAFpZ8k";
const ADMIN_ID = "1615492914";

let ads = JSON.parse(localStorage.getItem("gifts_final_v12")) || [];
let favs = JSON.parse(localStorage.getItem("favs_final_v12")) || [];
let curCat = "Все";
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

function handleSearch(e) {
  if (e.key === "Enter") {
    const query = e.target.value.toLowerCase();
    const results = ads.filter((a) => a.title.toLowerCase().includes(query));
    renderFeed(query === "" ? ads : results);
    e.target.blur();
  }
}

// ГЛАВНЫЙ ЭКРАН
function renderFeed(data = ads) {
  const grid = document.getElementById("home-grid");
  if (!grid) return;
  grid.innerHTML = "";
  let filtered = curCat === "Все" ? data : data.filter((a) => a.cat === curCat);

  filtered.forEach((ad) => {
    const isSold = ad.status === "sold";
    const card = document.createElement("div");
    card.className = "card";
    card.onclick = () => openProduct(ad);

    // В ленте: если продано, убираем город и описание (оно и так в модалке)
    card.innerHTML = `
        <img src="${ad.img}">
        <div class="card-body">
            <span class="card-price">${ad.price} KGS</span>
            <span class="card-title">${ad.title}</span>
            ${
              isSold
                ? '<span style="color:var(--pink); font-size:10px; font-weight:bold;">ПРОДАНО</span>'
                : `<span class="card-city">${ad.city}</span>`
            }
        </div>`;
    grid.appendChild(card);
  });
}

// ПРОФИЛЬ: УПРАВЛЕНИЕ
function renderProfileAds() {
  const grid = document.getElementById("my-ads-grid");
  const myId = tg.initDataUnsafe?.user?.id || 0;

  // Показываем: активные во вкладке "Активно", проданные во вкладке "Проданные"
  const myAds = ads.filter(
    (a) =>
      a.userId === myId &&
      (currentProfileTab === "active"
        ? a.status !== "sold"
        : a.status === "sold")
  );

  grid.innerHTML = myAds.length
    ? ""
    : '<p style="text-align:center; padding:50px; color:gray;">Ничего не найдено</p>';

  myAds.forEach((ad) => {
    const isSold = ad.status === "sold";
    const card = document.createElement("div");
    card.className = "m-card";

    card.innerHTML = `
        <div class="m-top">
            <img src="${ad.img}">
            <div class="m-info">
                <div class="card-price">${ad.price} KGS</div>
                <div class="card-title">${ad.title}</div>
                ${
                  !isSold
                    ? `<div style="color:gray; font-size:10px; margin-top:5px;">${ad.desc.substring(
                        0,
                        30
                      )}...</div>`
                    : '<b style="color:var(--pink)">ПРОДАНО</b>'
                }
            </div>
        </div>
        <div class="manage-btns">
            <button class="btn-edit-big" onclick="openEdit(${
              ad.id
            })">Изменить</button>
            <div class="btn-small-row">
                <button class="btn-s-action" onclick="toggleSold(${ad.id})">${
      isSold ? "В активные" : "Продано"
    }</button>
                <button class="btn-s-del" onclick="deleteAd(${
                  ad.id
                })">Удалить</button>
            </div>
        </div>
    `;
    grid.appendChild(card);
  });
}

// ЛОГИКА ИЗМЕНЕНИЙ (Твоя просьба)
function openEdit(id) {
  const ad = ads.find((a) => a.id === id);
  if (!ad) return;
  document.getElementById("edit-id").value = ad.id;
  document.getElementById("edit-title").value = ad.title;
  document.getElementById("edit-price").value = ad.price;
  document.getElementById("edit-address").value = ad.address || "";
  showPage("edit-ad");
}

function saveMyEdit() {
  const id = parseInt(document.getElementById("edit-id").value);
  const ad = ads.find((a) => a.id === id);
  if (ad) {
    ad.title = document.getElementById("edit-title").value;
    ad.price = document.getElementById("edit-price").value;
    ad.address = document.getElementById("edit-address").value;
    localStorage.setItem("gifts_final_v12", JSON.stringify(ads));
    tg.showAlert("Обновлено!");
    showPage("profile");
  }
}

function toggleSold(id) {
  const ad = ads.find((a) => a.id === id);
  if (ad) {
    ad.status = ad.status === "sold" ? "active" : "sold";
    localStorage.setItem("gifts_final_v12", JSON.stringify(ads));
    renderProfileAds();
  }
}

function deleteAd(id) {
  if (confirm("Удалить объявление?")) {
    ads = ads.filter((a) => a.id !== id);
    localStorage.setItem("gifts_final_v12", JSON.stringify(ads));
    renderProfileAds();
  }
}

// ОРИГИНАЛЬНАЯ ЛОГИКА ПОДАЧИ
async function sendToBot(ad) {
  const text = `🚀 НОВАЯ ЗАЯВКА\n📦: ${ad.title}\n💰: ${ad.price} KGS\n📍: ${ad.city}\n👤: @${ad.tgNick}\n📱: ${ad.phone}`;
  try {
    const blob = await (await fetch(ad.img)).blob();
    const formData = new FormData();
    formData.append("chat_id", ADMIN_ID);
    formData.append("photo", blob, "photo.jpg");
    formData.append("caption", text);
    formData.append(
      "reply_markup",
      JSON.stringify({
        inline_keyboard: [
          [
            { text: "Одобрить ✅", callback_data: `ok_${ad.id}` },
            { text: "Удалить ❌", callback_data: `no_${ad.id}` },
          ],
        ],
      })
    );
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
      method: "POST",
      body: formData,
    });
  } catch (e) {}
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
    return tg.showAlert("Заполните поля!");

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

  sendToBot(ad);
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
        )}" class="pd-btn-write">Написать</a>
        <p style="color:#eee; line-height:1.4;">${ad.desc}</p>
        <div style="background:#1c1c1e; padding:15px; border-radius:10px; margin-top:10px;">
            <div style="color:gray; font-size:12px;">📍 АДРЕС</div>
            <div>${ad.city}, ${ad.address || ""}</div>
            <div style="color:gray; font-size:12px; margin-top:10px;">📱 ТЕЛЕФОН</div>
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

function showPage(p) {
  document.querySelectorAll(".page").forEach((s) => s.classList.add("hidden"));
  document.getElementById(`page-${p}`).classList.remove("hidden");
  document
    .querySelectorAll(".nav-item")
    .forEach((i) => i.classList.remove("active"));
  const navBtn = document.getElementById(`n-${p}`);
  if (navBtn) navBtn.classList.add("active");
  if (p === "home") renderFeed();
  if (p === "profile") renderProfileAds();
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
  localStorage.setItem("favs_final_v12", JSON.stringify(favs));
  renderFavs();
}
function filterByCat(c, el) {
  curCat = c;
  document
    .querySelectorAll(".cat-chip")
    .forEach((i) => i.classList.remove("active"));
  el.classList.add("active");
  renderFeed();
}
