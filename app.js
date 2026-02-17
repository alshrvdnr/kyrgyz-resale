const tg = window.Telegram.WebApp;
tg.expand();
tg.enableClosingConfirmation();

// База данных
let ads = JSON.parse(localStorage.getItem("ads_storage")) || [];
let favorites = JSON.parse(localStorage.getItem("favs_storage")) || [];
let currentCategory = "Все";

document.addEventListener("DOMContentLoaded", () => {
  initUser();
  renderFeed();

  // РАБОЧИЙ ПОИСК
  document.getElementById("main-search").addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase();
    const filtered = ads.filter(
      (a) =>
        a.title.toLowerCase().includes(query) ||
        a.desc.toLowerCase().includes(query)
    );
    renderFeed(filtered);
  });
});

function initUser() {
  const user = tg.initDataUnsafe?.user || { first_name: "Пользователь", id: 0 };
  const avatar = document.getElementById("p-avatar");
  const name = document.getElementById("p-name");
  if (avatar) avatar.innerText = user.first_name[0];
  if (name) name.innerText = user.first_name;
}

// ГЛАВНАЯ ОТРИСОВКА
function renderFeed(data = ads) {
  const grid = document.getElementById("home-grid");
  grid.innerHTML = "";

  const finalData =
    currentCategory === "Все"
      ? data
      : data.filter((a) => a.cat === currentCategory);

  if (finalData.length === 0) {
    grid.innerHTML = `<div style="grid-column: 1/3; text-align: center; padding: 50px; color: gray;">Объявлений пока нет</div>`;
    return;
  }

  finalData.forEach((ad) => {
    const isFav = favorites.includes(ad.id);
    const card = document.createElement("div");
    card.className = "ad-card";
    card.innerHTML = `
            <img src="${
              ad.img || "https://via.placeholder.com/300?text=Нет+фото"
            }">
            <div class="ad-body">
                <span class="ad-price">${ad.price} KGS</span>
                <span class="ad-title">${ad.title}</span>
                <i class="fa-heart ad-fav-btn ${
                  isFav ? "fa active" : "far"
                }" onclick="toggleFav(${ad.id})"></i>
            </div>
        `;
    grid.appendChild(card);
  });
}

// НАВИГАЦИЯ
function showPage(pageId) {
  document.querySelectorAll(".page").forEach((p) => p.classList.add("hidden"));
  document.getElementById(`page-${pageId}`).classList.remove("hidden");

  document
    .querySelectorAll(".nav-item")
    .forEach((i) => i.classList.remove("active"));
  const navBtn = document.getElementById(`n-${pageId}`);
  if (navBtn) navBtn.classList.add("active");

  if (pageId === "favs") renderFavorites();
  if (pageId === "profile") renderMyAds();

  tg.HapticFeedback.impactOccurred("light");
}

// ДОБАВЛЕНИЕ ТОВАРА
function addNewAd() {
  const title = document.getElementById("in-title").value;
  const price = document.getElementById("in-price").value;
  const cat = document.getElementById("in-cat").value;
  const desc = document.getElementById("in-desc").value;
  const img = document.getElementById("in-img").value;

  if (!title || !price) {
    tg.showAlert("Укажите название и цену!");
    return;
  }

  const newAd = {
    id: Date.now(),
    userId: tg.initDataUnsafe?.user?.id || 0,
    title,
    price,
    cat,
    desc,
    img,
    date: new Date(),
  };

  ads.unshift(newAd);
  localStorage.setItem("ads_storage", JSON.stringify(ads));

  // Сброс формы
  document.getElementById("in-title").value = "";
  document.getElementById("in-price").value = "";

  showPage("home");
  renderFeed();
}

// ИЗБРАННОЕ
function toggleFav(id) {
  event.stopPropagation();
  if (favorites.includes(id)) {
    favorites = favorites.filter((f) => f !== id);
  } else {
    favorites.push(id);
  }
  localStorage.setItem("favs_storage", JSON.stringify(favorites));
  renderFeed();
  tg.HapticFeedback.selectionChanged();
}

function renderFavorites() {
  const grid = document.getElementById("favs-grid");
  const favAds = ads.filter((a) => favorites.includes(a.id));
  grid.innerHTML = "";

  if (favAds.length === 0) {
    grid.innerHTML = `<p style="grid-column:1/3; text-align:center; padding:40px;">В избранном пусто</p>`;
    return;
  }

  favAds.forEach((ad) => {
    const card = document.createElement("div");
    card.className = "ad-card";
    card.innerHTML = `
            <img src="${ad.img}">
            <div class="ad-body">
                <b>${ad.price} KGS</b><br>
                <small>${ad.title}</small>
            </div>
        `;
    grid.appendChild(card);
  });
}

// КАТЕГОРИИ
function filterByCat(cat) {
  currentCategory = cat;
  document.querySelectorAll(".cat-chip").forEach((c) => {
    c.classList.toggle("active", c.innerText === cat);
  });
  renderFeed();
}

// ПРОФИЛЬ (МОИ ОБЪЯВЛЕНИЯ)
function renderMyAds() {
  const container = document.getElementById("my-listings-container");
  const myId = tg.initDataUnsafe?.user?.id || 0;
  const myAds = ads.filter((a) => a.userId === myId);

  const tab = document.querySelector(".p-tab.active");
  tab.innerText = `Активно (${myAds.length})`;

  if (myAds.length === 0) return;

  container.innerHTML = "";
  myAds.forEach((ad) => {
    const card = document.createElement("div");
    card.className = "ad-card";
    card.innerHTML = `
            <img src="${ad.img}">
            <div class="ad-body">
                <b>${ad.price} KGS</b><br>
                <button onclick="deleteAd(${ad.id})" style="color:red; background:none; border:none; padding:0; font-size:11px; margin-top:5px;">Удалить</button>
            </div>
        `;
    container.appendChild(card);
  });
}

function deleteAd(id) {
  if (confirm("Удалить объявление?")) {
    ads = ads.filter((a) => a.id !== id);
    localStorage.setItem("ads_storage", JSON.stringify(ads));
    renderMyAds();
    renderFeed();
  }
}
