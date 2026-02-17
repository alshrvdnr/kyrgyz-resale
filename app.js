const tg = window.Telegram.WebApp;
tg.expand();

const BOT_TOKEN = "8399814024:AAEla8xBVk_9deHydJV0hrc5QYDyXAFpZ8k";
const ADMIN_ID = "1615492914";

let ads = JSON.parse(localStorage.getItem("gifts_final_v12")) || [];
let favs = JSON.parse(localStorage.getItem("favs_final_v12")) || [];
let curCat = "Все";
let currentFavTab = "ads";
let uploadedBase64 = "";

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

// Переключение вкладок в Избранном
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
    // Вкладка ПОИСКИ (по скриншоту)
    container.innerHTML = `
      <div class="empty-search-box">
        <div class="mockup-phone">
          <div class="mockup-search"></div>
          <div class="mockup-btn"><i class="fa fa-heart"></i></div>
        </div>
        <h3>Подписок на поиск нет</h3>
        <p>Подписывайтесь на обновления по вашему поиску</p>
        <button class="pink-action-btn" onclick="showPage('home')">На поиски!</button>
      </div>
    `;
    return;
  }

  // Вкладка ОБЪЯВЛЕНИЯ
  const data = ads.filter((a) => favs.includes(a.id));
  if (data.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:60px 20px; color:gray;">
        <i class="fa fa-heart" style="font-size:40px; margin-bottom:15px; opacity:0.3;"></i>
        <p>Здесь будут ваши избранные товары</p>
      </div>`;
  } else {
    container.innerHTML =
      `<div class="listings-grid">` +
      data
        .map(
          (a) => `
        <div class="card" onclick='openProduct(${JSON.stringify(a)})'>
          <img src="${a.img}">
          <div class="card-body">
            <span class="card-price">${a.price} KGS</span>
            <div style="font-size:12px; margin-top:4px; color:#ddd;">${
              a.title
            }</div>
          </div>
        </div>`
        )
        .join("") +
      `</div>`;
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

// --- Остальные функции без изменений объема ---

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

function renderFeed(data = ads) {
  const grid = document.getElementById("home-grid");
  if (!grid) return;
  grid.innerHTML = "";
  let filtered = curCat === "Все" ? data : data.filter((a) => a.cat === curCat);
  filtered.forEach((ad) => {
    const card = document.createElement("div");
    card.className = "card";
    card.onclick = () => openProduct(ad);
    card.innerHTML = `<img src="${ad.img}"><div class="card-body"><span class="card-price">${ad.price} KGS</span><span class="card-title">${ad.title}</span><span class="card-city" style="display:block; font-size:10px; color:gray; margin-top:4px;">${ad.city}</span></div>`;
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
  } catch (e) {
    console.error(e);
  }
}

function publishAndSend() {
  const title = document.getElementById("in-title").value;
  const price = document.getElementById("in-price").value;
  const phone = document.getElementById("in-wa").value;
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
  tg.showAlert("Отправлено на модерацию!");
  showPage("home");
}

function openProduct(ad) {
  const modal = document.getElementById("product-modal");
  document.getElementById("pv-content").innerHTML = `
    <img src="${ad.img}" style="width:100%; height:400px; object-fit:cover;">
    <div class="pd-body">
        <div class="pd-price" style="font-size:24px; color:var(--pink); font-weight:bold;">${
          ad.price
        } KGS</div>
        <div class="pd-title" style="font-size:20px; margin:10px 0;">${
          ad.title
        }</div>
        <div style="display:flex; gap:10px; margin-bottom:20px;">
            <a href="https://t.me/${ad.tgNick.replace(
              "@",
              ""
            )}" class="pink-btn-full" style="text-align:center; text-decoration:none; background:none; border:1px solid var(--pink); color:var(--pink);">Написать</a>
            <a href="tel:${
              ad.phone
            }" class="pink-btn-full" style="text-align:center; text-decoration:none;">Позвонить</a>
        </div>
        <p style="color:gray;">📍 ${ad.city}</p>
        <p style="color:#eee; line-height:1.4;">${ad.desc}</p>
    </div>`;
  modal.classList.remove("hidden");
}

function filterByCat(c, el) {
  curCat = c;
  document
    .querySelectorAll(".cat-chip")
    .forEach((i) => i.classList.remove("active"));
  el.classList.add("active");
  renderFeed();
}

function closeProduct() {
  document.getElementById("product-modal").classList.add("hidden");
}
function clearFavs() {
  favs = [];
  localStorage.setItem("favs_final_v12", JSON.stringify(favs));
  renderFavs();
}
