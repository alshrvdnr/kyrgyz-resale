const tg = window.Telegram.WebApp;
tg.expand();

const IMGBB_KEY = "94943ea3f656b4bc95e25c86d2880b94";
const catMap = {
  flowers: "Цветы",
  jewelry: "Ювелирка",
  gifts: "Подарки",
  certs: "Сертификаты",
  Все: "Все",
};
const catTitles = {
  Все: "Свежие предложения",
  flowers: "Свежие цветы",
  gifts: "Свежие подарки",
  jewelry: "Свежая ювелирка",
  certs: "Свежие сертификаты",
};

let ads = JSON.parse(localStorage.getItem("gifts_final_v12")) || [];
let favs = JSON.parse(localStorage.getItem("favs_final_v12")) || [];
let curCat = "Все",
  curCity = "Бишкек",
  selectedTariff = "standard",
  selectedFiles = [];

document.addEventListener("DOMContentLoaded", () => {
  initUser();
  renderFeed();
});

function initUser() {
  const user = tg.initDataUnsafe?.user || { first_name: "Гость", id: 0 };
  const initial = user.first_name[0].toUpperCase();
  document.getElementById("u-avatar-top").innerText = initial;
  document.getElementById("u-avatar-big").innerText = initial;
  document.getElementById("u-name").innerText = user.first_name;
}

function filterByCat(cat, el) {
  curCat = cat;
  document
    .querySelectorAll(".cat-card")
    .forEach((i) => i.classList.remove("active"));
  el.classList.add("active");
  document.getElementById("dynamic-feed-title").innerText = catTitles[cat];
  renderFeed();
}

function renderFeed() {
  const grid = document.getElementById("home-grid");
  if (!grid) return;
  grid.innerHTML = "";
  let filtered = ads.filter(
    (ad) => (curCat === "Все" || ad.cat === curCat) && ad.city === curCity
  );
  filtered.forEach((ad) => grid.appendChild(createAdCard(ad)));
}

function createAdCard(ad) {
  const card = document.createElement("div");
  card.className = "card";
  card.onclick = () => openProduct(ad);
  card.innerHTML = `
    <img src="${ad.img[0] || ""}" loading="lazy">
    <div class="card-body">
      <div class="card-price">${ad.price} KGS</div>
      <div class="card-title-text">${ad.title}</div>
    </div>
  `;
  return card;
}

function openProduct(ad) {
  const modal = document.getElementById("product-modal");
  const isFav = favs.includes(ad.id);

  document.getElementById("modal-fav-icon").innerHTML = `
    <button class="close-circle-btn-new ${
      isFav ? "active-fav" : ""
    }" style="background: rgba(0,0,0,0.5); color: ${
    isFav ? "#ffcc00" : "#fff"
  }" onclick="event.stopPropagation(); toggleFav(${ad.id})">
      <i class="fa-solid fa-heart"></i>
    </button>`;

  document.getElementById("pv-content").innerHTML = `
    <div style="width:100%; height:350px; background:#000;">
      <img src="${
        ad.img[0]
      }" style="width:100%; height:100%; object-fit:contain;">
    </div>
    <div class="pd-main-info">
      <!-- Кнопка сверху -->
      <a href="https://t.me/${ad.tgNick?.replace(
        "@",
        ""
      )}" class="yellow-btn-full" style="display:block; text-align:center; text-decoration:none; margin-bottom:20px;">
        Написать продавцу
      </a>

      <div class="pd-price">${ad.price} KGS</div>
      <div style="color:var(--gray); margin-bottom:20px; border-bottom:1px solid #333; padding-bottom:10px;">
        ${catMap[ad.cat]} — ${ad.title}
      </div>

      <div class="info-block">
        <span style="font-size:12px; color:var(--gray);">Описание</span>
        <div style="margin-top:5px;">${ad.desc || "Без описания"}</div>
      </div>

      <div class="info-block">
        <span style="font-size:12px; color:var(--gray);">Локация</span>
        <div>${ad.city}, ${ad.address || "Центр"}</div>
      </div>
    </div>
  `;
  modal.classList.remove("hidden");
}

function closeProduct() {
  document.getElementById("product-modal").classList.add("hidden");
}

function toggleFav(id) {
  favs = favs.includes(id) ? favs.filter((f) => f !== id) : [...favs, id];
  localStorage.setItem("favs_final_v12", JSON.stringify(favs));
  renderFavs();
}

function renderFavs() {
  const container = document.getElementById("favs-content-area");
  const filtered = ads.filter((ad) => favs.includes(ad.id));
  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-favs-container">
        <div class="fav-icon-box-empty"><i class="fa-solid fa-heart"></i></div>
        <h3>У вас нет избранных</h3>
        <p style="color:var(--gray);">Добавляйте товары, чтобы не потерять их</p>
        <button class="yellow-btn-full" onclick="showPage('home')" style="width:auto; padding: 10px 30px; margin-top:20px;">В каталог</button>
      </div>`;
  } else {
    container.innerHTML = '<div class="listings-grid" id="favs-grid"></div>';
    const grid = document.getElementById("favs-grid");
    filtered.forEach((ad) => grid.appendChild(createAdCard(ad)));
  }
}

function showPage(p) {
  document.querySelectorAll(".page").forEach((s) => s.classList.add("hidden"));
  document.getElementById(`page-${p}`).classList.remove("hidden");
  document
    .querySelectorAll(".nav-item")
    .forEach((i) => i.classList.remove("active"));
  if (document.getElementById(`n-${p}`))
    document.getElementById(`n-${p}`).classList.add("active");
  if (p === "favs") renderFavs();
}

function selectCity(c) {
  curCity = c;
  document.getElementById("current-city-label").innerText = c;
  hideCitySelector();
  renderFeed();
}

function showCitySelector() {
  document.getElementById("city-selector-overlay").classList.remove("hidden");
}
function hideCitySelector() {
  document.getElementById("city-selector-overlay").classList.add("hidden");
}

async function publishAndSend() {
  const title = document.getElementById("in-title").value;
  const price = document.getElementById("in-price").value;
  if (!title || !price) return alert("Заполните поля!");

  const ad = {
    id: Date.now(),
    title,
    price,
    cat: document.getElementById("in-cat").value,
    city: document.getElementById("in-city").value,
    tgNick: document.getElementById("in-tg").value,
    desc: document.getElementById("in-desc").value,
    img: selectedFiles.length
      ? [URL.createObjectURL(selectedFiles[0])]
      : ["https://via.placeholder.com/300"],
    status: "active",
  };

  ads.unshift(ad);
  localStorage.setItem("gifts_final_v12", JSON.stringify(ads));
  showPage("home");
  renderFeed();
}

function handleFileSelect(input) {
  selectedFiles = Array.from(input.files);
  const prev = document.getElementById("gallery-preview");
  prev.innerHTML = "";
  selectedFiles.forEach((f) => {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(f);
    img.style.width = "60px";
    img.style.height = "60px";
    img.style.borderRadius = "8px";
    prev.appendChild(img);
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
  showPage("home");
}
function clearFavs() {
  favs = [];
  localStorage.setItem("favs_final_v12", "[]");
  renderFavs();
}
