const tg = window.Telegram.WebApp;
tg.expand();

// ДАННЫЕ БОТА (Вставь свои)
const BOT_TOKEN = "8399814024:AAEla8xBVk_9deHydJV0hrc5QYDyXAFpZ8k";
const ADMIN_ID = "1615492914";

let ads = JSON.parse(localStorage.getItem("kg_resale_v5")) || [];
let favorites = JSON.parse(localStorage.getItem("favs_v5")) || [];
let uploadedPhoto = "";

const cats_list = [
  { name: "Транспорт", count: "335 946", icon: "🚗" },
  { name: "Недвижимость", count: "68 515", icon: "🏠" },
  { name: "Услуги", count: "129 146", icon: "🛠" },
  { name: "Техника и электроника", count: "117 467", icon: "📱" },
  { name: "Дом и сад", count: "152 715", icon: "🌱" },
  { name: "Работа", count: "15 243", icon: "💼" },
];

document.addEventListener("DOMContentLoaded", () => {
  initUser();
  renderFeed();
  renderCategories();
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

    const homeContent = document.getElementById("home-content");
    const error = document.getElementById("search-error");

    if (results.length === 0 && query !== "") {
      homeContent.classList.add("hidden");
      error.classList.remove("hidden");
    } else {
      homeContent.classList.remove("hidden");
      error.classList.add("hidden");
      renderFeed(query === "" ? ads : results);
    }
    e.target.blur();
  }
}

function renderFeed(data = ads) {
  const grid = document.getElementById("home-grid");
  grid.innerHTML = data.length
    ? ""
    : '<p style="grid-column:1/3;text-align:center;padding:50px;color:gray;">Ничего не найдено</p>';
  data.forEach((ad) => {
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

// Категории как на скрине
function renderCategories() {
  const container = document.getElementById("cat-list-items");
  container.innerHTML = cats_list
    .map(
      (c) => `
        <div class="cat-item" onclick="filterByCat('${c.name}')">
            <div style="font-size:24px; padding:10px; background:#222; border-radius:8px;">${c.icon}</div>
            <div class="cat-name">${c.name}</div>
            <div class="cat-count">${c.count}</div>
            <i class="fa fa-chevron-right" style="color:#444; font-size:12px;"></i>
        </div>
    `
    )
    .join("");
}

function handleFile(input) {
  const file = input.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      uploadedPhoto = e.target.result;
      document.getElementById("img-preview").src = uploadedPhoto;
      document.getElementById("img-preview-wrap").classList.remove("hidden");
      document.getElementById("file-label").innerText = "Фото загружено ✅";
    };
    reader.readAsDataURL(file);
  }
}

async function publishWithModeration() {
  const title = document.getElementById("in-title").value;
  const price = document.getElementById("in-price").value;
  const phone = document.getElementById("in-phone").value;
  const tgNick = document.getElementById("in-tg").value;
  const cat = document.getElementById("in-cat").value;
  const desc = document.getElementById("in-desc").value;

  if (!title || !price || !uploadedPhoto)
    return tg.showAlert("Заполните поля и фото!");

  const ad = {
    id: Date.now(),
    title,
    price,
    phone,
    tgNick,
    cat,
    desc,
    img: uploadedPhoto,
    userId: tg.initDataUnsafe?.user?.id || 0,
  };

  // ОЧИСТКА ФОРМЫ
  document.getElementById("in-title").value = "";
  document.getElementById("in-price").value = "";
  document.getElementById("in-phone").value = "";
  document.getElementById("in-tg").value = "";
  document.getElementById("in-desc").value = "";
  uploadedPhoto = "";
  document.getElementById("img-preview-wrap").classList.add("hidden");
  document.getElementById("file-label").innerText = "Загрузить фото";

  // ОТПРАВКА В БОТ
  const text = `🔔 НОВАЯ ЗАЯВКА\n👤: ${ad.tgNick}\n📦: ${ad.title}\n💰: ${ad.price} KGS`;
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: ADMIN_ID, text: text }),
  });

  ads.unshift(ad);
  localStorage.setItem("kg_resale_v5", JSON.stringify(ads));
  tg.showAlert("Объявление отправлено!");
  showPage("home");
}

function openProduct(ad) {
  const modal = document.getElementById("product-modal");
  document.getElementById("pv-content").innerHTML = `
        <img src="${ad.img}" style="width:100%; height:350px; object-fit:cover;">
        <div class="pd-price-row">
            <div class="pd-price">${ad.price} KGS</div>
            <div class="pd-title">${ad.title}</div>
            <p style="color:gray; font-size:14px; margin-top:10px;">${ad.desc}</p>
        </div>
    `;
  document.getElementById("pv-footer").innerHTML = `
        <div class="pd-footer-btns">
            <a href="https://t.me/${ad.tgNick.replace(
              "@",
              ""
            )}" target="_blank" class="btn-write">Написать</a>
            <a href="tel:${ad.phone}" class="btn-call">Позвонить</a>
        </div>
    `;
  modal.classList.remove("hidden");
}

function renderFavs() {
  const container = document.getElementById("favs-content");
  const favData = ads.filter((a) => favorites.includes(a.id));

  if (favData.length === 0) {
    container.innerHTML = `
            <div class="fav-empty-card">
                <i class="fa fa-heart"></i>
                <h3>У вас пока нет избранных объявлений</h3>
                <p>Выберите категорию, чтобы начать поиск объявлений. Нажмите на сердечко, и понравившееся объявление появится здесь.</p>
                <button class="fav-select-btn" onclick="openCategories()">Выберите категорию</button>
            </div>
        `;
  } else {
    container.innerHTML =
      `<div class="listings-grid">` +
      favData
        .map(
          (ad) =>
            `<div class="card"><img src="${ad.img}"><div class="card-body"><b>${ad.price} KGS</b></div></div>`
        )
        .join("") +
      `</div>`;
  }
}

function showPage(pageId) {
  document.querySelectorAll(".page").forEach((p) => p.classList.add("hidden"));
  document.getElementById(`page-${pageId}`).classList.remove("hidden");
  document
    .querySelectorAll(".nav-item")
    .forEach((n) => n.classList.remove("active"));
  if (pageId !== "add")
    document.getElementById(`n-${pageId}`).classList.add("active");
  if (pageId === "home") renderFeed();
  if (pageId === "favs") renderFavs();
  tg.HapticFeedback.impactOccurred("light");
}

function openCategories() {
  document.getElementById("cat-modal").classList.remove("hidden");
}
function closeCategories() {
  document.getElementById("cat-modal").classList.add("hidden");
}
function closeProduct() {
  document.getElementById("product-modal").classList.add("hidden");
}

function switchMainTab(type, el) {
  document
    .querySelectorAll(".c-tab")
    .forEach((t) => t.classList.remove("active"));
  el.classList.add("active");
}
