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

// ГОРОДА
function toggleCitySelector() {
  document.getElementById("city-selector").classList.toggle("hidden");
}
function selectCity(city) {
  curCity = city;
  document.getElementById("current-city-label").innerText = city;
  toggleCitySelector();
  renderFeed();
}

// КАТЕГОРИИ И ЗАГОЛОВКИ
function filterByCat(cat, el) {
  curCat = cat;
  document
    .querySelectorAll(".cat-card")
    .forEach((i) => i.classList.remove("active"));
  el.classList.add("active");
  document.getElementById("dynamic-feed-title").innerText =
    catTitles[cat] || "Свежие предложения";
  renderFeed();
}

// ЛЕНТА
function renderFeed() {
  const grid = document.getElementById("home-grid");
  grid.innerHTML = "";
  const filtered = ads.filter(
    (ad) => (curCat === "Все" || ad.cat === curCat) && ad.city === curCity
  );
  filtered.forEach((ad) => grid.appendChild(createAdCard(ad)));
}

function createAdCard(ad) {
  const isFav = favs.includes(ad.id);
  const card = document.createElement("div");
  card.className = "card";
  card.onclick = () => openProduct(ad);
  card.innerHTML = `
    <div class="fav-heart-btn ${isFav ? "active" : ""}" onclick="toggleFav(${
    ad.id
  }, event)">
        <i class="fa-solid fa-heart"></i>
    </div>
    <img src="${ad.img[0]}" loading="lazy">
    <div style="padding:10px;">
      <div style="color:var(--yellow-main); font-weight:bold;">${
        ad.price
      } KGS</div>
      <div style="font-size:12px; color:#ccc; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${
        ad.title
      }</div>
    </div>
  `;
  return card;
}

// ИЗБРАННОЕ
function renderFavs() {
  const container = document.getElementById("favs-content-area");
  const filtered = ads.filter((ad) => favs.includes(ad.id));

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-favs-block">
        <div class="fav-big-heart"><i class="fa-solid fa-heart"></i></div>
        <h3 style="margin-bottom:8px;">У вас пока нет объявлений</h3>
        <p style="color:var(--gray); font-size:14px; margin-bottom:25px;">Сохраняйте то, что понравилось</p>
        <button class="premium-btn" style="width:auto; padding:12px 30px;" onclick="showPage('home')">Поиск</button>
      </div>`;
  } else {
    const grid = document.createElement("div");
    grid.className = "listings-grid";
    filtered.forEach((ad) => grid.appendChild(createAdCard(ad)));
    container.innerHTML = "";
    container.appendChild(grid);
  }
}

function toggleFav(id, event) {
  if (event) event.stopPropagation();
  favs = favs.includes(id) ? favs.filter((f) => f !== id) : [...favs, id];
  localStorage.setItem("favs_final_v12", JSON.stringify(favs));
  renderFeed();
  if (!document.getElementById("page-favs").classList.contains("hidden"))
    renderFavs();
}

function clearFavs() {
  favs = [];
  localStorage.setItem("favs_final_v12", "[]");
  renderFavs();
  renderFeed();
}

// СТРАНИЦА ТОВАРА
function openProduct(ad) {
  const modal = document.getElementById("product-modal");
  const isFav = favs.includes(ad.id);
  const dateStr = new Date(ad.id).toLocaleDateString();

  let dots = ad.img
    .map(
      (_, i) =>
        `<div class="dot ${i === 0 ? "active" : ""}" id="dot-${i}"></div>`
    )
    .join("");

  document.getElementById("pv-content").innerHTML = `
    <div class="modal-carousel-container">
      <i class="fa fa-arrow-left" onclick="closeProduct()" style="position:absolute; top:20px; left:20px; z-index:100; background:rgba(0,0,0,0.5); padding:10px; border-radius:50%;"></i>
      <i class="fa-solid fa-heart" onclick="toggleFav(${
        ad.id
      })" style="position:absolute; top:20px; right:20px; z-index:100; font-size:24px; color:${
    isFav ? "var(--yellow-main)" : "#fff"
  }"></i>
      <div class="product-gallery-slider" id="main-slider">
        ${ad.img.map((src) => `<img src="${src}">`).join("")}
      </div>
      <div class="carousel-dots">${dots}</div>
    </div>
    <div style="padding:20px;">
      <div style="font-size:28px; font-weight:800; color:var(--yellow-main);">${
        ad.price
      } KGS</div>
      <div style="margin:10px 0; font-size:16px;">
        <span style="background:#333; padding:4px 8px; border-radius:6px; color:var(--gray); font-size:12px;">${
          catMap[ad.cat]
        }</span> — ${ad.title}
      </div>
      <a href="https://t.me/${ad.tgNick?.replace(
        "@",
        ""
      )}" class="premium-btn" style="display:block; text-align:center; text-decoration:none;">Написать продавцу</a>
      <div style="color:var(--gray); font-size:12px; margin-top:15px;">Дата публикации: ${dateStr}</div>
      ${
        ad.receiveDate
          ? `<div style="color:var(--gray); font-size:12px;">Дата получения товара: ${ad.receiveDate}</div>`
          : ""
      }
      <div style="background:#2c2c2e; padding:15px; border-radius:12px; margin:20px 0;">
        <div style="text-transform:uppercase; font-size:11px; color:var(--gray); margin-bottom:5px;">Описание</div>
        <div style="line-height:1.5;">${ad.desc || "Нет описания"}</div>
      </div>
      <div style="margin-bottom:10px;"><i class="fa fa-location-dot" style="color:var(--yellow-main)"></i> ${
        ad.city
      }, ${ad.address || "Центр"}</div>
      <div style="margin-bottom:10px;"><i class="fa-brands fa-telegram" style="color:#0088cc"></i> ${
        ad.tgNick || "—"
      }</div>
      <div style="margin-bottom:10px;"><i class="fa-solid fa-phone" style="color:#34c759"></i> ${
        ad.phone || "—"
      }</div>
    </div>`;

  const slider = document.getElementById("main-slider");
  slider.onscroll = () => {
    let idx = Math.round(slider.scrollLeft / slider.offsetWidth);
    document
      .querySelectorAll(".dot")
      .forEach((d, i) => d.classList.toggle("active", i === idx));
  };
  modal.classList.remove("hidden");
  tg.BackButton.show();
  tg.BackButton.onClick(() => closeProduct());
}

function closeProduct() {
  document.getElementById("product-modal").classList.add("hidden");
  tg.BackButton.hide();
}

// ПОДАЧА
function selectTariff(t) {
  selectedTariff = t;
  document
    .getElementById("tariff-std")
    .classList.toggle("active", t === "standard");
  document.getElementById("tariff-vip").classList.toggle("active", t === "vip");
  document.getElementById("vip-block").classList.toggle("hidden", t !== "vip");
}

function handleReceiptSelect(input) {
  if (input.files[0])
    document.getElementById("receipt-label").innerText = "Чек добавлен ✅";
}

async function publishAndSend() {
  const title = document.getElementById("in-title").value;
  const price = document.getElementById("in-price").value;
  if (!title || !price) return alert("Заполните поля!");

  tg.MainButton.showProgress();
  let imgs = [];
  for (let f of selectedFiles) {
    const url = await uploadToImgBB(f);
    if (url) imgs.push(url);
  }

  const newAd = {
    id: Date.now(),
    title,
    price,
    cat: document.getElementById("in-cat").value,
    city: document.getElementById("in-city").value,
    phone: document.getElementById("in-wa").value,
    tgNick: document.getElementById("in-tg").value,
    desc: document.getElementById("in-desc").value,
    receiveDate: document.getElementById("in-receive-date").value,
    img: imgs.length ? imgs : ["https://via.placeholder.com/300"],
    status: "active",
    userId: tg.initDataUnsafe?.user?.id || 0,
  };

  ads.unshift(newAd);
  localStorage.setItem("gifts_final_v12", JSON.stringify(ads));
  tg.MainButton.hide();
  showPage("home");
  renderFeed();
}

async function uploadToImgBB(file) {
  const fd = new FormData();
  fd.append("image", file);
  try {
    const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, {
      method: "POST",
      body: fd,
    });
    const data = await res.json();
    return data.success ? data.data.url : null;
  } catch {
    return null;
  }
}

function handleFileSelect(input) {
  selectedFiles = Array.from(input.files).slice(0, 5);
  const prev = document.getElementById("gallery-preview");
  prev.innerHTML = "";
  selectedFiles.forEach((f) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = document.createElement("img");
      img.src = e.target.result;
      img.style.width = "60px";
      img.style.height = "60px";
      img.style.objectFit = "cover";
      img.style.borderRadius = "8px";
      prev.appendChild(img);
    };
    reader.readAsDataURL(f);
  });
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
