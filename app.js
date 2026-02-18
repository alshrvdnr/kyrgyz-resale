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
  editingId = null,
  selectedFiles = [],
  profTab = "active";

document.addEventListener("DOMContentLoaded", () => {
  initUser();
  renderFeed();
});

function initUser() {
  const user = tg.initDataUnsafe?.user || { first_name: "Гость", id: 0 };
  const initial = user.first_name ? user.first_name[0].toUpperCase() : "?";
  document.getElementById("u-avatar-top").innerText = initial;
  document.getElementById("u-avatar-big").innerText = initial;
  document.getElementById("u-name").innerText = user.first_name || "Гость";
}

function toggleCitySelector() {
  document.getElementById("city-selector").classList.toggle("hidden");
}
function selectCity(city) {
  curCity = city;
  document.getElementById("current-city-label").innerText = city;
  toggleCitySelector();
  renderFeed();
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
  const filtered = ads.filter(
    (ad) =>
      (curCat === "Все" || ad.cat === curCat) &&
      ad.city === curCity &&
      ad.status === "active"
  );
  filtered.forEach((ad) => grid.appendChild(createAdCard(ad)));
}

function createAdCard(ad, isProfile = false) {
  const isFav = favs.includes(ad.id);
  const isSold = ad.status === "sold";
  const isVip = ad.tariff === "vip";
  const card = document.createElement("div");
  card.className = `card ${isVip ? "card-vip" : ""}`;
  card.onclick = () => openProduct(ad);
  card.innerHTML = `
    ${isSold ? '<div class="sold-badge">ПРОДАНО</div>' : ""}
    ${
      !isProfile
        ? `<div class="fav-heart-btn ${
            isFav ? "active" : ""
          }" onclick="toggleFav(${
            ad.id
          }, event)"><i class="fa-solid fa-heart"></i></div>`
        : ""
    }
    <img src="${ad.img[0] || ""}" loading="lazy" class="${
    ad.status === "deleted" ? "blur-img" : ""
  }">
    <div style="padding:10px;">
      <div style="color:var(--yellow-main); font-weight:bold; font-size:16px;">${
        ad.price
      } KGS</div>
      <div style="font-size:12px; color:#ccc; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${
        ad.title
      }</div>
      ${
        isProfile && ad.status === "active"
          ? `
        <div style="display:flex; gap:5px; margin-top:8px;">
          <button onclick="event.stopPropagation(); editAd(${ad.id})" style="flex:1; background:#444; color:#fff; border:none; padding:6px; border-radius:6px; font-size:11px; font-weight:bold;">Изменить</button>
          <button onclick="event.stopPropagation(); manageAd(${ad.id})" style="flex:1; background:var(--yellow-main); color:#000; border:none; padding:6px; border-radius:6px; font-size:11px; font-weight:bold;">Управление</button>
        </div>`
          : ""
      }
    </div>
  `;
  return card;
}

function toggleFav(id, event) {
  if (event) event.stopPropagation();
  favs = favs.includes(id) ? favs.filter((f) => f !== id) : [...favs, id];
  localStorage.setItem("favs_final_v12", JSON.stringify(favs));
  renderFeed();
  if (!document.getElementById("product-modal").classList.contains("hidden")) {
    const ad = ads.find((a) => a.id === id);
    if (ad) openProduct(ad);
  }
}

function renderFavs() {
  const container = document.getElementById("favs-content-area");
  if (!container) return;
  const filtered = ads.filter((ad) => favs.includes(ad.id));
  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-favs-center">
        <div style="width:80px; height:80px; background:#2c2c2e; border-radius:20px; display:flex; align-items:center; justify-content:center; margin-bottom:20px; color:var(--yellow-main); font-size:32px;">
          <i class="fa-solid fa-heart"></i>
        </div>
        <h3 style="margin:0 0 10px 0;">У вас пока нет избранных</h3>
        <button class="btn-premium-unity" style="width:auto; padding:12px 40px;" onclick="showPage('home')">Поиск подарков</button>
      </div>`;
  } else {
    container.innerHTML = '<div class="listings-grid" id="fav-grid"></div>';
    const grid = document.getElementById("fav-grid");
    filtered.forEach((ad) => grid.appendChild(createAdCard(ad)));
  }
}

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
      )}" class="btn-premium-unity" style="text-decoration:none;">Написать продавцу</a>
      <div style="color:var(--gray); font-size:12px; margin-top:10px;">Дата публикации: ${dateStr}</div>
      ${
        ad.receiveDate
          ? `<div style="color:var(--gray); font-size:12px;">Дата получения: ${ad.receiveDate}</div>`
          : ""
      }
      <div style="background:#2c2c2e; padding:15px; border-radius:12px; margin:20px 0;">
        <div style="text-transform:uppercase; font-size:11px; color:var(--gray); margin-bottom:5px;">Описание</div>
        <div style="line-height:1.5; font-size:15px;">${
          ad.desc || "Нет описания"
        }</div>
      </div>
      <div style="margin-bottom:12px;"><i class="fa fa-location-dot" style="color:var(--yellow-main)"></i> ${
        ad.city
      }, ${ad.address || "Центр"}</div>
      <div style="margin-bottom:12px;"><i class="fa-brands fa-telegram" style="color:#0088cc"></i> ${
        ad.tgNick || "—"
      }</div>
      <div style="margin-bottom:12px;"><i class="fa-solid fa-phone" style="color:#34c759"></i> ${
        ad.phone || "—"
      }</div>
    </div>`;

  const slider = document.getElementById("main-slider");
  if (slider) {
    slider.onscroll = () => {
      let idx = Math.round(slider.scrollLeft / slider.offsetWidth);
      document
        .querySelectorAll(".dot")
        .forEach((d, i) => d.classList.toggle("active", i === idx));
    };
  }
  modal.classList.remove("hidden");
  tg.BackButton.show();
  tg.BackButton.onClick(() => closeProduct());
}

function closeProduct() {
  document.getElementById("product-modal").classList.add("hidden");
  tg.BackButton.hide();
}

function switchProfileTab(tab) {
  profTab = tab;
  document
    .getElementById("tab-active")
    .classList.toggle("active", tab === "active");
  document
    .getElementById("tab-archive")
    .classList.toggle("active", tab === "archive");
  renderProfile();
}

function renderProfile() {
  const grid = document.getElementById("my-ads-grid");
  if (!grid) return;
  grid.innerHTML = "";
  const myId = tg.initDataUnsafe?.user?.id || 0;
  const filtered = ads.filter((ad) => {
    const isMine = ad.userId === myId;
    if (!isMine) return false;
    return profTab === "active"
      ? ad.status === "active"
      : ad.status === "sold" || ad.status === "deleted";
  });
  filtered.forEach((ad) => grid.appendChild(createAdCard(ad, true)));
}

function manageAd(id) {
  const res = prompt("Управление:\n1 - Продано\n2 - Удалить\n3 - Отмена");
  const ad = ads.find((a) => a.id === id);
  if (!ad) return;
  if (res === "1") ad.status = "sold";
  else if (res === "2") ad.status = "deleted";
  else return;
  localStorage.setItem("gifts_final_v12", JSON.stringify(ads));
  renderProfile();
  renderFeed();
}

function editAd(id) {
  const ad = ads.find((a) => a.id === id);
  if (!ad) return;
  editingId = id;
  showPage("add");
  document.getElementById("add-title-text").innerText = "Изменить объявление";
  document.getElementById("in-title").value = ad.title || "";
  document.getElementById("in-price").value = ad.price || "";
  document.getElementById("in-wa").value = ad.phone || "";
  document.getElementById("in-tg").value = ad.tgNick || "";
  document.getElementById("in-desc").value = ad.desc || "";
  document.getElementById("in-cat").value = ad.cat;
  document.getElementById("in-city").value = ad.city;
}

function selectTariff(t) {
  selectedTariff = t;
  document.getElementById("tariff-std").className =
    "tariff-card-box" + (t === "standard" ? " active-std" : "");
  document.getElementById("tariff-vip").className =
    "tariff-card-box" + (t === "vip" ? " active-vip" : "");
  document.getElementById("vip-block").classList.toggle("hidden", t !== "vip");
}

function handleReceiptSelect(input) {
  if (input.files[0])
    document.getElementById("receipt-label").innerText = "Чек добавлен ✅";
}

async function publishAndSend() {
  const title = document.getElementById("in-title").value;
  const price = document.getElementById("in-price").value;
  if (!title || !price) return alert("Заполни поля!");

  if (editingId) {
    const ad = ads.find((a) => a.id === editingId);
    if (ad) {
      ad.title = title;
      ad.price = price;
      ad.cat = document.getElementById("in-cat").value;
      ad.city = document.getElementById("in-city").value;
      ad.phone = document.getElementById("in-wa").value;
      ad.tgNick = document.getElementById("in-tg").value;
      ad.desc = document.getElementById("in-desc").value;
      ad.receiveDate = document.getElementById("in-receive-date").value;
    }
    editingId = null;
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
      city: document.getElementById("in-city").value,
      phone: document.getElementById("in-wa").value,
      tgNick: document.getElementById("in-tg").value,
      desc: document.getElementById("in-desc").value,
      receiveDate: document.getElementById("in-receive-date").value,
      img: imgs.length ? imgs : ["https://via.placeholder.com/300"],
      status: "active",
      userId: tg.initDataUnsafe?.user?.id || 0,
      tariff: selectedTariff,
    };
    ads.unshift(newAd);
  }
  localStorage.setItem("gifts_final_v12", JSON.stringify(ads));
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
  } catch (e) {
    return null;
  }
}

function handleFileSelect(input) {
  selectedFiles = Array.from(input.files).slice(0, 5);
  const prev = document.getElementById("gallery-preview");
  if (!prev) return;
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
  const target = document.getElementById(`page-${p}`);
  if (target) target.classList.remove("hidden");

  document
    .querySelectorAll(".nav-item")
    .forEach((i) => i.classList.remove("active"));
  const navItem = document.getElementById(`n-${p}`);
  if (navItem) navItem.classList.add("active");

  if (p === "favs") renderFavs();
  if (p === "profile") renderProfile();
}

function cancelAdd() {
  editingId = null;
  document.getElementById("add-title-text").innerText = "Новое объявление";
  showPage("home");
}

function clearFavs() {
  favs = [];
  localStorage.setItem("favs_final_v12", "[]");
  renderFavs();
  renderFeed();
}
