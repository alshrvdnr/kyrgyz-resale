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

let ads = JSON.parse(localStorage.getItem("gifts_final_v12")) || [];
let favs = JSON.parse(localStorage.getItem("favs_final_v12")) || [];
let curCat = "Все",
  curCity = "Бишкек",
  selectedTariff = "standard",
  editingId = null,
  selectedFiles = [],
  profTab = "active";

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

// 1. ГОРОДА
function toggleCitySelector() {
  document.getElementById("city-selector").classList.toggle("hidden");
}
function selectCity(city) {
  curCity = city;
  document.getElementById("current-city-label").innerText = city;
  toggleCitySelector();
  renderFeed();
}

// 2. КАТЕГОРИИ
function filterByCat(cat, el) {
  curCat = cat;
  document
    .querySelectorAll(".cat-card")
    .forEach((i) => i.classList.remove("active"));
  el.classList.add("active");
  renderFeed();
}

// 5. СЕРДЕЧКИ В ЛЕНТЕ
function toggleFav(id, event) {
  if (event) event.stopPropagation();
  favs = favs.includes(id) ? favs.filter((f) => f !== id) : [...favs, id];
  localStorage.setItem("favs_final_v12", JSON.stringify(favs));
  renderFeed();
  if (!document.getElementById("product-modal").classList.contains("hidden")) {
    const ad = ads.find((a) => a.id === id);
    openProduct(ad);
  }
}

function renderFeed() {
  const grid = document.getElementById("home-grid");
  const favGrid = document.getElementById("favs-grid");
  grid.innerHTML = "";
  favGrid.innerHTML = "";

  ads.forEach((ad) => {
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
      <img src="${ad.img[0]}" class="${
      ad.status === "deleted" ? "blur-img" : ""
    }">
      <div style="padding:10px;">
        <div style="color:var(--yellow-main); font-weight:bold;">${
          ad.price
        } KGS</div>
        <div style="font-size:12px; color:#ccc; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${
          ad.title
        }</div>
      </div>
    `;

    if (
      ad.status === "active" &&
      ad.city === curCity &&
      (curCat === "Все" || ad.cat === curCat)
    ) {
      grid.appendChild(card);
    }
    if (isFav) {
      favGrid.appendChild(card.cloneNode(true)); // Для страницы избранного
    }
  });
}

// 4. СТРАНИЦА ОБЪЯВЛЕНИЯ (Новая структура)
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
      <div class="pd-price">${ad.price} KGS</div>
      
      <div style="margin-bottom:15px; font-size:18px; font-weight:600;">
        <span class="pd-cat-tag">${catMap[ad.cat]}</span> — ${ad.title}
      </div>

      <a href="https://t.me/${ad.tgNick?.replace(
        "@",
        ""
      )}" class="yellow-btn-small">Написать продавцу</a>

      <div style="color:var(--gray); font-size:12px; margin-top:5px;">Опубликовано: ${dateStr}</div>

      <div class="pd-desc-block">
        <div style="color:var(--gray); font-size:11px; margin-bottom:5px; text-transform:uppercase;">Описание</div>
        <div style="line-height:1.5;">${ad.desc || "Нет описания"}</div>
      </div>

      <div style="margin-bottom:10px;"><i class="fa fa-location-dot" style="color:var(--yellow-main)"></i> ${
        ad.city
      }, ${ad.address || "Адрес не указан"}</div>
      <div style="margin-bottom:10px;"><i class="fa-brands fa-telegram" style="color:#0088cc"></i> ${
        ad.tgNick || "—"
      }</div>
      <div style="margin-bottom:10px;"><i class="fa-solid fa-phone" style="color:#34c759"></i> ${
        ad.phone || "—"
      }</div>
    </div>
  `;

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

// 3. ПРОФИЛЬ: УПРАВЛЕНИЕ И РЕДАКТИРОВАНИЕ
function switchProfileTab(tab) {
  profTab = tab;
  document
    .getElementById("tab-active")
    .classList.toggle("active", tab === "active");
  document
    .getElementById("tab-sold")
    .classList.toggle("active", tab === "archive");
  renderProfile();
}

function renderProfile() {
  const grid = document.getElementById("my-ads-grid");
  grid.innerHTML = "";
  const myId = tg.initDataUnsafe?.user?.id || 0;

  const filtered = ads.filter((ad) => {
    const isMine = ad.userId === myId;
    if (!isMine) return false;
    return profTab === "active"
      ? ad.status === "active"
      : ad.status === "sold" || ad.status === "deleted";
  });

  filtered.forEach((ad) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <img src="${ad.img[0]}" class="${
      ad.status === "deleted" ? "blur-img" : ""
    }">
      <div style="padding:10px;">
        <div style="color:var(--yellow-main); font-weight:bold;">${
          ad.price
        } KGS</div>
        <div style="font-size:12px; margin-bottom:10px;">${ad.title}</div>
        ${
          ad.status === "active"
            ? `
          <div class="ad-actions">
            <button class="btn-edit" onclick="editAd(${ad.id})">Изменить</button>
            <button class="btn-manage" onclick="manageAd(${ad.id})">Управление</button>
          </div>
        `
            : `<div style="font-size:10px; color:var(--yellow-main); font-weight:bold;">${ad.status.toUpperCase()}</div>`
        }
      </div>
    `;
    grid.appendChild(card);
  });
}

function manageAd(id) {
  const action = prompt(
    "Выберите действие:\n1. Продано\n2. Удалить\n3. Отмена"
  );
  const ad = ads.find((a) => a.id === id);
  if (action === "1") ad.status = "sold";
  else if (action === "2") ad.status = "deleted";
  localStorage.setItem("gifts_final_v12", JSON.stringify(ads));
  renderProfile();
  renderFeed();
}

function editAd(id) {
  const ad = ads.find((a) => a.id === id);
  editingId = id;
  document.getElementById("add-title-text").innerText = "Редактирование";
  document.getElementById("in-title").value = ad.title;
  document.getElementById("in-price").value = ad.price;
  document.getElementById("in-wa").value = ad.phone;
  document.getElementById("in-desc").value = ad.desc;
  document.getElementById("in-cat").value = ad.cat;
  showPage("add");
}

function openAddPage() {
  editingId = null;
  document.getElementById("add-title-text").innerText = "Новое объявление";
  document.getElementById("in-title").value = "";
  document.getElementById("in-price").value = "";
  showPage("add");
}

async function publishAndSend() {
  const title = document.getElementById("in-title").value;
  const price = document.getElementById("in-price").value;
  if (!title || !price) return alert("Заполните название и цену!");

  if (editingId) {
    const ad = ads.find((a) => a.id === editingId);
    ad.title = title;
    ad.price = price;
    ad.phone = document.getElementById("in-wa").value;
    ad.desc = document.getElementById("in-desc").value;
    ad.cat = document.getElementById("in-cat").value;
  } else {
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
      city: curCity,
      phone: document.getElementById("in-wa").value,
      tgNick: document.getElementById("in-tg").value,
      desc: document.getElementById("in-desc").value,
      img: imgs.length ? imgs : ["https://via.placeholder.com/300"],
      status: "active",
      userId: tg.initDataUnsafe?.user?.id || 0,
    };
    ads.unshift(newAd);
  }

  localStorage.setItem("gifts_final_v12", JSON.stringify(ads));
  showPage("home");
  renderFeed();
}

// Загрузка фото ImgBB
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
      img.style.width = "50px";
      img.style.height = "50px";
      img.style.objectFit = "cover";
      img.style.borderRadius = "8px";
      prev.appendChild(img);
    };
    reader.readAsDataURL(f);
  });
}

function selectTariff(t) {
  selectedTariff = t;
  document
    .getElementById("tariff-std")
    .classList.toggle("active", t === "standard");
  document.getElementById("tariff-vip").classList.toggle("active", t === "vip");
}

function showPage(p) {
  document.querySelectorAll(".page").forEach((s) => s.classList.add("hidden"));
  document.getElementById(`page-${p}`).classList.remove("hidden");
  document
    .querySelectorAll(".nav-item")
    .forEach((i) => i.classList.remove("active"));
  if (document.getElementById(`n-${p}`))
    document.getElementById(`n-${p}`).classList.add("active");
  if (p === "profile") renderProfile();
}
