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
  document.getElementById("dynamic-feed-title").innerText =
    catTitles[cat] || "Свежие предложения";
  renderFeed();
}

function renderFeed(data = ads) {
  const grid = document.getElementById("home-grid");
  if (!grid) return;
  grid.innerHTML = "";
  let filtered = data.filter(
    (ad) => (curCat === "Все" || ad.cat === curCat) && ad.city === curCity
  );

  filtered.sort(
    (a, b) => (a.status === "sold" ? 1 : -1) - (b.status === "sold" ? 1 : -1)
  );
  filtered.forEach((ad) => grid.appendChild(createAdCard(ad)));
}

function createAdCard(ad, isProfile = false) {
  const card = document.createElement("div");
  card.className = "card";
  card.onclick = () => openProduct(ad);
  const isSold = ad.status === "sold";
  card.innerHTML = `
    ${isSold ? '<div class="sold-tag">ПРОДАНО</div>' : ""}
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
  const isSold = ad.status === "sold";

  document.getElementById("modal-fav-icon").innerHTML = `
    <button class="fav-btn-circle ${
      isFav ? "active" : ""
    }" onclick="event.stopPropagation(); toggleFav(${ad.id}, true)">
      <i class="fa-solid fa-heart"></i>
    </button>`;

  let dots = ad.img
    .map(
      (_, i) =>
        `<div class="dot ${i === 0 ? "active" : ""}" id="dot-${i}"></div>`
    )
    .join("");

  document.getElementById("pv-content").innerHTML = `
    <div class="modal-carousel-container">
      <div class="product-gallery-slider" id="main-slider">
        ${ad.img.map((src) => `<img src="${src}">`).join("")}
      </div>
      <div class="carousel-dots">${dots}</div>
    </div>
    
    <div class="pd-main-info">
      <div class="pd-price-row">
        <div class="pd-price">${ad.price} KGS</div>
        <div class="pd-sub-header">
          <span>${catMap[ad.cat]} — ${ad.title}</span>
          ${
            isSold
              ? '<span style="color:#ff3b30; font-weight:bold;">ПРОДАНО</span>'
              : ""
          }
        </div>
      </div>

      <div class="info-block">
        <span class="info-label">Описание</span>
        <div class="info-value">${ad.desc || "Нет описания"}</div>
      </div>

      <div class="info-block">
        <span class="info-label">Локация</span>
        <div class="info-value">${ad.city}, ${
    ad.address || "Адрес не указан"
  }</div>
      </div>

      <div class="info-block">
        <span class="info-label">Контакты</span>
        <div class="info-value">
          <i class="fa-brands fa-telegram" style="color:#0088cc"></i> ${
            ad.tgNick || "—"
          }<br>
          <i class="fa-solid fa-phone" style="color:#34c759"></i> ${
            ad.phone || "—"
          }
        </div>
      </div>

      ${
        !isSold
          ? `<a href="https://t.me/${ad.tgNick?.replace(
              "@",
              ""
            )}" class="yellow-btn-full" style="display:block; text-align:center; text-decoration:none;">Написать продавцу</a>`
          : ""
      }
      <div style="height:40px;"></div>
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

function toggleFav(id, fromModal = false) {
  favs = favs.includes(id) ? favs.filter((f) => f !== id) : [...favs, id];
  localStorage.setItem("favs_final_v12", JSON.stringify(favs));
  if (fromModal) {
    document.querySelector(".fav-btn-circle").classList.toggle("active");
  }
  renderFeed();
}

function selectTariff(t) {
  selectedTariff = t;
  document
    .getElementById("tariff-std")
    .classList.toggle("active", t === "standard");
  document.getElementById("tariff-vip").classList.toggle("active", t === "vip");
  document.getElementById("vip-block").classList.toggle("hidden", t !== "vip");
}

function showPage(p) {
  document.querySelectorAll(".page").forEach((s) => s.classList.add("hidden"));
  document.getElementById(`page-${p}`).classList.remove("hidden");
  document
    .querySelectorAll(".nav-item")
    .forEach((i) => i.classList.remove("active"));
  if (document.getElementById(`n-${p}`))
    document.getElementById(`n-${p}`).classList.add("active");
  document.querySelector(".bottom-nav").style.display =
    p === "add" ? "none" : "flex";
}

async function publishAndSend() {
  const title = document.getElementById("in-title").value;
  const price = document.getElementById("in-price").value;
  if (!title || !price) return tg.showAlert("Заполните название и цену!");

  tg.MainButton.showProgress();
  let imgs = [];
  for (let f of selectedFiles) {
    const url = await uploadToImgBB(f);
    if (url) imgs.push(url);
  }

  const ad = {
    id: Date.now(),
    title,
    price,
    cat: document.getElementById("in-cat").value,
    city: document.getElementById("in-city").value,
    address: document.getElementById("in-address").value,
    phone: document.getElementById("in-wa").value,
    tgNick: document.getElementById("in-tg").value,
    desc: document.getElementById("in-desc").value,
    dateReceived: document.getElementById("in-date").value,
    img: imgs,
    status: "active",
    userId: tg.initDataUnsafe?.user?.id || 0,
    tariff: selectedTariff,
  };

  ads.unshift(ad);
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
  document.getElementById("preview-box").classList.remove("hidden");
  selectedFiles.forEach((f) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = document.createElement("img");
      img.src = e.target.result;
      prev.appendChild(img);
    };
    reader.readAsDataURL(f);
  });
}

function handleReceiptSelect(input) {
  if (input.files[0])
    document.getElementById("receipt-label").innerText = "Чек добавлен ✅";
}

function cancelAdd() {
  showPage("home");
}
