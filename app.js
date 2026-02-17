const tg = window.Telegram.WebApp;
tg.expand();

// Состояние
let ads = JSON.parse(localStorage.getItem("ads_db")) || [];
let favs = JSON.parse(localStorage.getItem("favs_db")) || [];
let currentCat = "Все";
let searchQuery = "";

document.addEventListener("DOMContentLoaded", () => {
  initUser();
  renderHome();

  // Поиск
  document.getElementById("search-input").addEventListener("input", (e) => {
    searchQuery = e.target.value.toLowerCase();
    renderHome();
  });
});

function initUser() {
  const user = tg.initDataUnsafe?.user || { first_name: "Пользователь", id: 0 };
  document.getElementById("user-name").innerText = user.first_name;
  document.getElementById("user-avatar").innerText = user.first_name[0];
}

function showPage(pageId) {
  document.querySelectorAll(".page").forEach((p) => p.classList.add("hidden"));
  document.getElementById(`page-${pageId}`).classList.remove("hidden");

  // Активный таб
  document
    .querySelectorAll(".tab-item")
    .forEach((btn) => btn.classList.remove("active"));
  const activeNav = document.getElementById(`nav-${pageId}`);
  if (activeNav) activeNav.classList.add("active");

  if (pageId === "favs") renderFavs();
  if (pageId === "profile") renderMyAds();

  tg.HapticFeedback.impactOccurred("light");
}

function renderHome() {
  const grid = document.getElementById("main-grid");
  grid.innerHTML = "";

  let filtered = ads.filter((a) => {
    const matchesCat = currentCat === "Все" || a.cat === currentCat;
    const matchesSearch = a.title.toLowerCase().includes(searchQuery);
    return matchesCat && matchesSearch;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/3; text-align:center; padding:50px; color:gray;">Ничего не найдено</div>`;
    return;
  }

  filtered.forEach((ad) => {
    const isFav = favs.includes(ad.id);
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
            <img src="${ad.img || "https://via.placeholder.com/200"}">
            <div class="card-info">
                <span class="card-price">${ad.price} KGS</span>
                <span class="card-title">${ad.title}</span>
                <div class="card-btns">
                    <i class="fa fa-envelope"></i>
                    <i class="fa-heart ${
                      isFav ? "fa active" : "far"
                    }" onclick="toggleFav(${ad.id})"></i>
                </div>
            </div>
        `;
    grid.appendChild(card);
  });
}

function publishAd() {
  const title = document.getElementById("add-title").value;
  const price = document.getElementById("add-price").value;
  const cat = document.getElementById("add-cat").value;
  const img = document.getElementById("add-img").value;

  if (!title || !price) return tg.showAlert("Заполните поля!");

  const newAd = {
    id: Date.now(),
    userId: tg.initDataUnsafe?.user?.id || 0,
    title,
    price,
    cat,
    img,
    date: new Date(),
  };

  ads.unshift(newAd);
  localStorage.setItem("ads_db", JSON.stringify(ads));
  showPage("home");
  renderHome();
}

function toggleFav(id) {
  event.stopPropagation();
  if (favs.includes(id)) {
    favs = favs.filter((fid) => fid !== id);
  } else {
    favs.push(id);
  }
  localStorage.setItem("favs_db", JSON.stringify(favs));
  renderHome();
  tg.HapticFeedback.selectionChanged();
}

function renderFavs() {
  const grid = document.getElementById("favs-grid");
  const favAds = ads.filter((a) => favs.includes(a.id));
  grid.innerHTML = favAds.length
    ? ""
    : '<p style="grid-column:1/3; text-align:center;">В избранном пусто</p>';

  favAds.forEach((ad) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
            <img src="${ad.img}">
            <div class="card-info">
                <span class="card-price">${ad.price} KGS</span>
                <span class="card-title">${ad.title}</span>
                <i class="fa fa-heart active" style="color:#ff4d8d" onclick="toggleFav(${ad.id}); renderFavs();"></i>
            </div>
        `;
    grid.appendChild(card);
  });
}

function filterByCat(cat) {
  currentCat = cat;
  document.querySelectorAll(".cat-pill").forEach((p) => {
    p.classList.toggle("active", p.innerText === cat);
  });
  renderHome();
}

function applyFilters() {
  const sort = document.querySelector('input[name="sort"]:checked').value;
  if (sort === "cheap") ads.sort((a, b) => a.price - b.price);
  if (sort === "expensive") ads.sort((a, b) => b.price - a.price);
  if (sort === "new") ads.sort((a, b) => b.id - a.id);

  showPage("home");
  renderHome();
}

function renderMyAds() {
  const grid = document.getElementById("my-ads-grid");
  const myId = tg.initDataUnsafe?.user?.id || 0;
  const myAds = ads.filter((a) => a.userId === myId);
  grid.innerHTML = myAds.length
    ? ""
    : '<p style="grid-column:1/3;">Нет объявлений</p>';

  myAds.forEach((ad) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
            <img src="${ad.img}">
            <div class="card-info">
                <b>${ad.price} KGS</b>
                <p style="font-size:10px">${ad.title}</p>
                <button onclick="deleteAd(${ad.id})" style="color:red; background:none; border:none; padding:0; font-size:10px;">Удалить</button>
            </div>
        `;
    grid.appendChild(card);
  });
}

function deleteAd(id) {
  ads = ads.filter((a) => a.id !== id);
  localStorage.setItem("ads_db", JSON.stringify(ads));
  renderMyAds();
  renderHome();
}
