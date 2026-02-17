const tg = window.Telegram.WebApp;
tg.expand();

// ДАННЫЕ БОТА (Вставь свои!)
const BOT_TOKEN = "8399814024:AAEla8xBVk_9deHydJV0hrc5QYDyXAFpZ8k";
const ADMIN_ID = "1615492914";

let ads = JSON.parse(localStorage.getItem("gifts_final_v11")) || [];
let favorites = JSON.parse(localStorage.getItem("favs_final_v11")) || [];
let curCat = "Все";
let uploadedBase64 = "";

document.addEventListener("DOMContentLoaded", () => {
  initUser();
  renderFeed();
});

function initUser() {
  const user = tg.initDataUnsafe?.user || { first_name: "Пользователь" };
  document.getElementById("u-name").innerText = user.first_name;
  document.getElementById("u-avatar").innerText = user.first_name[0];
}

// ПОИСК (Enter)
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
  grid.innerHTML = "";
  let filtered = curCat === "Все" ? data : data.filter((a) => a.cat === curCat);
  filtered.forEach((ad) => {
    const isFav = favorites.includes(ad.id);
    const card = document.createElement("div");
    card.className = "card";
    card.onclick = () => openProduct(ad);
    card.innerHTML = `<img src="${
      ad.img || "https://via.placeholder.com/300"
    }"><div class="card-body"><span class="card-price">${
      ad.price
    } KGS</span><span class="card-title">${ad.title}</span></div>`;
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

// ПУБЛИКАЦИЯ + ОЧИСТКА + ОТПРАВКА В БОТ
async function publishAndSend() {
  const title = document.getElementById("in-title").value;
  const price = document.getElementById("in-price").value;
  const phone = document.getElementById("in-phone").value;
  const tgNick = document.getElementById("in-tg").value;
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
    cat,
    desc,
    img: uploadedBase64,
    views: Math.floor(Math.random() * 500),
    userId: tg.initDataUnsafe?.user?.id || 0,
  };

  // ОЧИСТКА
  document.getElementById("in-title").value = "";
  document.getElementById("in-price").value = "";
  document.getElementById("in-phone").value = "";
  document.getElementById("in-tg").value = "";
  document.getElementById("in-desc").value = "";
  document.getElementById("file-input").value = "";
  uploadedBase64 = "";
  document.getElementById("preview-box").classList.add("hidden");
  document.getElementById("file-label").innerText = "Загрузить фото";

  // ОТПРАВКА БОТУ
  const botText = `🚀 НОВАЯ ЗАЯВКА\n👤: @${ad.tgNick}\n📦: ${ad.title}\n💰: ${ad.price} KGS\n📱: ${ad.phone}`;
  fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: ADMIN_ID,
      text: botText,
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Одобрить ✅", callback_data: `approve_${ad.id}` },
            { text: "Удалить ❌", callback_data: `reject_${ad.id}` },
          ],
        ],
      },
    }),
  });

  ads.unshift(ad);
  localStorage.setItem("gifts_final_v11", JSON.stringify(ads));
  tg.showAlert("Отправлено на модерацию!");
  showPage("home");
}

function openProduct(ad) {
  const modal = document.getElementById("product-modal");
  document.getElementById("pv-content").innerHTML = `
        <img src="${ad.img}" class="pd-img">
        <div class="pd-body">
            <div class="pd-stats"><span>Показы: 81 511</span><div><i class="fa fa-eye"></i> ${
              ad.views
            } <i class="fa fa-heart" style="margin-left:10px"></i> 12</div></div>
            <div class="pd-price">${ad.price} KGS</div>
            <div class="pd-title">${ad.title}</div>
            <div class="pd-actions">
                <a href="https://t.me/${ad.tgNick.replace(
                  "@",
                  ""
                )}" target="_blank" class="pd-btn-write">Написать</a>
                <a href="tel:${ad.phone}" class="pd-btn-call">Позвонить</a>
            </div>
            <p style="color:gray; font-size:14px;">Доставка: Платная по городу</p>
            <div style="color:#eee; line-height:1.6; margin-top:20px;">${
              ad.desc
            }</div>
        </div>
    `;
  modal.classList.remove("hidden");
}

function renderFavs() {
  const container = document.getElementById("favs-content-area");
  const data = ads.filter((a) => favorites.includes(a.id));
  if (data.length === 0) {
    container.innerHTML = `
            <div class="empty-fav-card">
                <i class="fa fa-heart"></i>
                <h3>У вас пока нет избранных объявлений</h3>
                <p>Нажмите на сердечко, и понравившееся вам объявление появится здесь.</p>
                <button class="empty-fav-btn" onclick="showPage('home')">Выберите категорию</button>
            </div>`;
  } else {
    container.innerHTML =
      `<div class="listings-grid">` +
      data
        .map(
          (a) =>
            `<div class="card"><img src="${a.img}"><div class="card-body"><b>${a.price} KGS</b></div></div>`
        )
        .join("") +
      `</div>`;
  }
}

function clearFavs() {
  favorites = [];
  localStorage.setItem("favs_final_v11", JSON.stringify(favorites));
  renderFavs();
}

function showPage(p) {
  document.querySelectorAll(".page").forEach((s) => s.classList.add("hidden"));
  document.getElementById(`page-${p}`).classList.remove("hidden");
  document
    .querySelectorAll(".nav-item")
    .forEach((i) => i.classList.remove("active"));
  if (p !== "add" && p !== "filter")
    document.getElementById(`n-${p}`).classList.add("active");
  if (p === "home") renderFeed();
  if (p === "favs") renderFavs();
  tg.HapticFeedback.impactOccurred("light");
}

function filterByCat(c, el) {
  curCat = c;
  document
    .querySelectorAll(".cat-chip")
    .forEach((i) => i.classList.remove("active"));
  el.classList.add("active");
  renderFeed();
}

function switchMainTab(t, el) {
  document
    .querySelectorAll(".cap-tab")
    .forEach((i) => i.classList.remove("active"));
  el.classList.add("active");
}

function closeProduct() {
  document.getElementById("product-modal").classList.add("hidden");
}
