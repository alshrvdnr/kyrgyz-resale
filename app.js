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

// Поиск
function handleSearch(e) {
  if (e.key === "Enter") {
    const query = e.target.value.toLowerCase();
    const results = ads.filter((a) => a.title.toLowerCase().includes(query));
    const tabs = document.getElementById("home-tabs-wrapper");
    const error = document.getElementById("search-error");
    if (results.length === 0 && query !== "") {
      tabs.classList.add("hidden");
      error.classList.remove("hidden");
      renderFeed([]);
    } else {
      tabs.classList.remove("hidden");
      error.classList.add("hidden");
      renderFeed(query === "" ? ads : results);
    }
    e.target.blur();
  }
}

// Главный фид
function renderFeed(data = ads) {
  const grid = document.getElementById("home-grid");
  if (!grid) return;
  grid.innerHTML = "";
  let filtered = curCat === "Все" ? data : data.filter((a) => a.cat === curCat);
  filtered.forEach((ad) => {
    const card = document.createElement("div");
    card.className = "card";
    card.onclick = () => openProduct(ad);
    card.innerHTML = `<img src="${ad.img}"><div class="card-body"><span class="card-price">${ad.price} KGS</span><span class="card-title">${ad.title}</span><span class="card-city">${ad.city}</span></div>`;
    grid.appendChild(card);
  });
}

function handleFileSelect(input) {
  const file = input.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      uploadedBase64 = e.target.result;
      document.getElementById("img-preview").src = uploadedBase64;
      document.getElementById("preview-box").classList.remove("hidden");
      document.getElementById("file-label").innerText = "Фото выбрано ✅";
    };
    reader.readAsDataURL(file);
  }
}

async function sendToBot(ad) {
  const text = `🚀 НОВАЯ ЗАЯВКА\n📦: ${ad.title}\n💰: ${ad.price} KGS\n📍: ${ad.city}\n🏠 Адрес: ${ad.address}\n👤: @${ad.tgNick}\n📱: ${ad.phone}`;
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
  } catch (e) {
    console.error(e);
  }
}

function publishAndSend() {
  const title = document.getElementById("in-title").value;
  const price = document.getElementById("in-price").value;
  const phone = document.getElementById("in-wa").value;
  const address = document.getElementById("in-address").value; // Адрес
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

  sendToBot(ad);
  ads.unshift(ad);
  localStorage.setItem("gifts_final_v12", JSON.stringify(ads));

  // Чистка
  document.getElementById("in-title").value = "";
  document.getElementById("in-price").value = "";
  document.getElementById("in-wa").value = "";
  document.getElementById("in-address").value = "";
  document.getElementById("in-tg").value = "";
  document.getElementById("in-desc").value = "";
  uploadedBase64 = "";
  document.getElementById("preview-box").classList.add("hidden");

  tg.showAlert("Отправлено на модерацию!");
  showPage("home");
}

// ОТКРЫТИЕ ОБЪЯВЛЕНИЯ
function openProduct(ad) {
  const modal = document.getElementById("product-modal");
  const favIconArea = document.getElementById("modal-fav-icon");
  const isFav = favs.includes(ad.id);

  // Ставим сердечко
  favIconArea.innerHTML = `<i class="${
    isFav ? "fa-solid" : "fa-regular"
  } fa-heart" style="color:var(--pink)" onclick="toggleFav(${ad.id})"></i>`;

  document.getElementById("pv-content").innerHTML = `
        <img src="${ad.img}" style="width:100%; height:auto; display:block;">
        <div class="pd-body">
            <div class="pd-price">${ad.price} KGS</div>
            <div class="pd-title">${ad.title}</div>
            
            <a href="https://t.me/${ad.tgNick.replace(
              "@",
              ""
            )}" target="_blank" class="pd-btn-write">Написать продавцу</a>

            <p style="color:#eee; font-size:16px; line-height:1.6; margin-bottom:20px;">${
              ad.desc
            }</p>
            
            <div class="contact-info-block">
                <div class="contact-label">📍 ГОРОД</div>
                <div class="contact-value">${ad.city}</div>
            </div>
            
            <div class="contact-info-block">
                <div class="contact-label">🏠 АДРЕС</div>
                <div class="contact-value">${ad.address || "Не указан"}</div>
            </div>

            <div class="contact-info-block">
                <div class="contact-label">📱 НОМЕР ТЕЛЕФОНА</div>
                <div class="contact-value">${ad.phone}</div>
            </div>
        </div>
    `;
  modal.classList.remove("hidden");
  tg.BackButton.show();
  tg.BackButton.onClick(closeProduct);
}

function toggleFav(id) {
  if (favs.includes(id)) {
    favs = favs.filter((f) => f !== id);
  } else {
    favs.push(id);
  }
  localStorage.setItem("favs_final_v12", JSON.stringify(favs));

  // Обновляем иконку в открытой модалке
  const icon = document.querySelector("#modal-fav-icon i");
  if (icon) {
    icon.classList.toggle("fa-solid");
    icon.classList.toggle("fa-regular");
  }
}

function closeProduct() {
  document.getElementById("product-modal").classList.add("hidden");
  tg.BackButton.hide();
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

function switchFavTab(tab) {
  currentFavTab = tab;
  document
    .getElementById("f-tab-ads")
    .classList.toggle("active", tab === "ads");
  document
    .getElementById("f-tab-searches")
    .classList.toggle("active", tab === "searches");
  renderFavs();
}

function renderFavs() {
  const container = document.getElementById("favs-content-area");
  if (currentFavTab === "searches") {
    container.innerHTML = `<div class="empty-searches-view"><div class="mockup-container"><div class="mockup-line"></div><div class="mockup-btn"><i class="fa fa-heart"></i></div></div><h3>Подписок на поиск нет</h3><p>Подписывайтесь на обновления по вашему поиску</p><button class="fav-action-btn" onclick="showPage('home')">На поиски!</button></div>`;
    return;
  }
  const data = ads.filter((a) => favs.includes(a.id));
  if (data.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:100px 20px; color:gray;"><i class="fa fa-heart" style="font-size:40px; margin-bottom:15px; opacity:0.3;"></i><p>Здесь будут ваши избранные объявления</p></div>`;
  } else {
    container.innerHTML =
      `<div class="listings-grid">` +
      data
        .map(
          (a) =>
            `<div class="card" onclick='openProduct(${JSON.stringify(
              a
            )})'><img src="${a.img}"><div class="card-body"><b>${
              a.price
            } KGS</b></div></div>`
        )
        .join("") +
      `</div>`;
  }
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
        : a.status === "sold")
  );
  grid.innerHTML = myAds.length
    ? ""
    : '<p style="text-align:center; padding:50px; color:gray;">Ничего не найдено</p>';
  myAds.forEach((ad) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `<img src="${ad.img}"><div class="card-body"><b>${
      ad.price
    } KGS</b><br><button onclick="moveStatus(${
      ad.id
    })" style="color:var(--pink); background:none; border:none; padding:5px 0;">${
      currentProfileTab === "active" ? "В архив" : "Удалить"
    }</button></div>`;
    grid.appendChild(card);
  });
}

function moveStatus(id) {
  const ad = ads.find((a) => a.id === id);
  if (currentProfileTab === "active") ad.status = "sold";
  else ads = ads.filter((a) => a.id !== id);
  localStorage.setItem("gifts_final_v12", JSON.stringify(ads));
  renderProfileAds();
}

function filterByCat(c, el) {
  curCat = c;
  document
    .querySelectorAll(".cat-chip")
    .forEach((i) => i.classList.remove("active"));
  el.classList.add("active");
  renderFeed();
}

function clearFavs() {
  favs = [];
  localStorage.setItem("favs_final_v12", JSON.stringify(favs));
  renderFavs();
}
