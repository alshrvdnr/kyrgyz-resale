// --- FIREBASE CONFIG ---
const firebaseConfig = {
  apiKey: "AIzaSyCxaC3C9dx6IEhXWH9eATdKZO8SCRYe33I",
  authDomain: "gifts-kg.firebaseapp.com",
  databaseURL: "https://gifts-kg-default-rtdb.firebaseio.com",
  projectId: "gifts-kg",
  storageBucket: "gifts-kg.firebasestorage.app",
  messagingSenderId: "419866659643",
  appId: "1:419866659643:web:2332c8856698705780451e",
  measurementId: "G-DH7RXQZ6Y3",
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const tg = window.Telegram.WebApp;
tg.expand();

// НАСТРОЙКИ
const IMGBB_KEY = "94943ea3f656b4bc95e25c86d2880b94";
const BOT_TOKEN = "8399814024:AAEla8xBVk_9deHydJV0hrc5QYDyXAFpZ8k";
const ADMIN_ID = 1615492914;

const catMap = {
  flowers: "Цветы",
  jewelry: "Ювелирка",
  gifts: "Подарки",
  certs: "Сертификаты",
  Все: "Все",
};

let ads = [];
let favs = JSON.parse(localStorage.getItem("favs_final_v12")) || [];
let curCat = "Все";
let curCity = "Все";
let curMainTab = "rec";
let filterSort = "default";
let currentProfileTab = "active";
let selectedFiles = [];
let selectedReceipt = null;
let selectedTariff = "standard";

// СЛУШАЕМ БАЗУ
db.ref("ads").on("value", (snapshot) => {
  const data = snapshot.val();
  ads = data ? Object.values(data) : [];
  renderFeed();
  if (!document.getElementById("page-profile").classList.contains("hidden"))
    renderProfileAds();
});

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

function handleSearch(e) {
  if (e.key === "Enter") {
    const query = e.target.value.toLowerCase();
    const res = ads.filter((a) => a.title.toLowerCase().includes(query));
    renderFeedInternal(res, "results-grid");
    showPage("results");
    e.target.blur();
  }
}

function switchMainTab(tab) {
  curMainTab = tab;
  renderFeed();
}

function renderFeed() {
  renderFeedInternal(ads, "home-grid");
}

function renderFeedInternal(data, gridId) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  grid.innerHTML = "";
  let filtered = data.filter((ad) => {
    const cMatch = curCat === "Все" || ad.cat === curCat;
    const tMatch = curCity === "Все" || ad.city === curCity;
    return cMatch && tMatch;
  });
  const now = Date.now();
  filtered.sort((a, b) => {
    const getRank = (item) => {
      if (item.status === "sold" || item.status === "deleted") return 2;
      if (item.tariff === "vip" && item.vipTill > now) return 0;
      return 1;
    };
    const rankA = getRank(a);
    const rankB = getRank(b);
    if (rankA !== rankB) return rankA - rankB;
    if (filterSort === "cheap")
      return parseFloat(a.price) - parseFloat(b.price);
    if (filterSort === "expensive")
      return parseFloat(b.price) - parseFloat(a.price);
    return b.id - a.id;
  });
  filtered.forEach((ad) => grid.appendChild(createAdCard(ad)));
}

function createAdCard(ad) {
  const catName = catMap[ad.cat] || "Товар";
  const coverImg = Array.isArray(ad.img) ? ad.img[0] : ad.img;
  const isSold = ad.status === "sold" || ad.status === "deleted";
  const isVip = ad.tariff === "vip" && ad.vipTill > Date.now();
  let badges = isSold
    ? `<div class="sold-badge">ПРОДАНО</div>`
    : isVip
    ? `<div class="vip-badge">VIP</div>`
    : "";

  let timeStr = "";
  if (ad.publishedAt) {
    const d = new Date(ad.publishedAt);
    timeStr = `<div class="pub-time-badge">${d.getHours()}:${d
      .getMinutes()
      .toString()
      .padStart(2, "0")}</div>`;
  }

  const card = document.createElement("div");
  card.className = "card";
  card.onclick = () => openProduct(ad);
  card.innerHTML = `
        <button class="card-fav-btn" onclick="toggleFavCard(event, ${
          ad.id
        })"><i class="${
    favs.includes(ad.id) ? "fa-solid" : "fa-regular"
  } fa-heart" style="color:${
    favs.includes(ad.id) ? "var(--pink)" : "white"
  }"></i></button>
        ${badges} ${timeStr}
        <img src="${coverImg}" loading="lazy" style="height:140px; width:100%; object-fit:cover;">
        <div class="card-body">
            <span class="card-price">${ad.price} KGS</span>
            <div class="card-cat-row"><span class="card-category">${catName}</span> ${
    ad.title
  }</div>
            <div class="card-date-block"><span class="date-label">Дата получения</span><span class="date-value">${
              ad.dateReceived
            }</span></div>
        </div>`;
  return card;
}

function toggleFavCard(e, id) {
  e.stopPropagation();
  toggleFav(id);
}

function selectTariff(t) {
  selectedTariff = t;
  document
    .getElementById("tariff-std")
    .classList.toggle("active", t === "standard");
  document.getElementById("tariff-vip").classList.toggle("active", t === "vip");
  const vb = document.getElementById("vip-block");
  if (t === "vip") vb.classList.remove("hidden");
  else vb.classList.add("hidden");
}

function handleFileSelect(input) {
  selectedFiles = Array.from(input.files).slice(0, 5);
  const gallery = document.getElementById("gallery-preview");
  gallery.innerHTML = "";
  if (selectedFiles.length) {
    document.getElementById("preview-box").classList.remove("hidden");
    document.getElementById("photo-count").innerText = selectedFiles.length;
    selectedFiles.forEach((f) => {
      const r = new FileReader();
      r.onload = (e) => {
        const img = document.createElement("img");
        img.src = e.target.result;
        gallery.appendChild(img);
      };
      r.readAsDataURL(f);
    });
  }
}

function handleReceiptSelect(input) {
  if (input.files[0]) {
    selectedReceipt = input.files[0];
    document.getElementById("receipt-label").innerText = "Чек добавлен ✅";
  }
}

async function uploadToImgBB(file) {
  const formData = new FormData();
  formData.append("image", file);
  const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, {
    method: "POST",
    body: formData,
  });
  const data = await res.json();
  return data.success ? data.data.url : null;
}

async function publishAndSend() {
  const title = document.getElementById("in-title").value;
  const price = document.getElementById("in-price").value;
  if (!title || !price || !selectedFiles.length)
    return tg.showAlert("Заполните поля!");
  tg.MainButton.showProgress();
  tg.MainButton.show();
  let urls = [];
  for (let f of selectedFiles) {
    const u = await uploadToImgBB(f);
    if (u) urls.push(u);
  }
  let rUrl =
    selectedTariff === "vip" ? await uploadToImgBB(selectedReceipt) : "";
  const adId = Date.now();
  const ad = {
    id: adId,
    title,
    price,
    dateReceived: document.getElementById("in-date").value,
    phone: document.getElementById("in-wa").value,
    address: document.getElementById("in-address").value,
    tgNick: document.getElementById("in-tg").value,
    city: document.getElementById("in-city").value,
    cat: document.getElementById("in-cat").value,
    desc: document.getElementById("in-desc").value,
    img: urls,
    status: "pending",
    userId: tg.initDataUnsafe?.user?.id || 0,
    tariff: selectedTariff,
    vipTill: selectedTariff === "vip" ? Date.now() + 259200000 : 0,
    receipt: rUrl,
  };
  db.ref("moderation/" + adId)
    .set(ad)
    .then(() => {
      [
        "in-title",
        "in-price",
        "in-date",
        "in-wa",
        "in-address",
        "in-tg",
        "in-desc",
      ].forEach((i) => (document.getElementById(i).value = ""));
      selectedFiles = [];
      tg.MainButton.hide();
      showPage("home");
      tg.showAlert("На модерации!");
    });
}

function openEditModal(adId) {
  const ad = ads.find((a) => a.id == adId);
  if (!ad) return;
  document.getElementById("edit-in-title").value = ad.title;
  document.getElementById("edit-in-price").value = ad.price;
  document.getElementById("edit-in-wa").value = ad.phone;
  document.getElementById("edit-in-desc").value = ad.desc;
  document.getElementById("edit-modal").classList.remove("hidden");
  document.getElementById("save-edit-btn").onclick = () => {
    db.ref("ads/" + adId)
      .update({
        title: document.getElementById("edit-in-title").value,
        price: document.getElementById("edit-in-price").value,
        phone: document.getElementById("edit-in-wa").value,
        desc: document.getElementById("edit-in-desc").value,
      })
      .then(() => {
        tg.showAlert("Обновлено!");
        closeEditModal();
      });
  };
}
function closeEditModal() {
  document.getElementById("edit-modal").classList.add("hidden");
}

function openProduct(ad) {
  const modal = document.getElementById("product-modal");
  modal.classList.remove("hidden");
  const favArea = document.getElementById("modal-fav-icon");
  favArea.innerHTML = `<i class="${
    favs.includes(ad.id) ? "fa-solid" : "fa-regular"
  } fa-heart" onclick="toggleFav(${
    ad.id
  })" style="color:var(--pink); font-size:22px;"></i>`;
  const images = Array.isArray(ad.img) ? ad.img : [ad.img];
  document.getElementById(
    "pv-content"
  ).innerHTML = `<div class="product-gallery">${images
    .map((s) => `<img src="${s}">`)
    .join("")}</div><div class="pd-body"><div class="pd-price">${
    ad.price
  } KGS</div><div class="pd-title">${catMap[ad.cat]} - ${
    ad.title
  }</div><p style="color:#eee; font-size:15px; margin-top:15px;">${
    ad.desc || ""
  }</p>${
    ad.status === "active"
      ? '<a href="https://t.me/' +
        ad.tgNick +
        '" target="_blank" class="pd-btn-write">Написать продавцу</a>'
      : ""
  }</div>`;
  tg.BackButton.show();
  tg.BackButton.onClick(closeProduct);
}
function closeProduct() {
  document.getElementById("product-modal").classList.add("hidden");
  tg.BackButton.hide();
}

function toggleFav(id) {
  favs = favs.includes(id) ? favs.filter((f) => f !== id) : [...favs, id];
  localStorage.setItem("favs_final_v12", JSON.stringify(favs));
  renderFeed();
  renderFavs();
}

function showPage(p) {
  document.querySelectorAll(".page").forEach((s) => s.classList.add("hidden"));
  document.getElementById(`page-${p}`).classList.remove("hidden");
  const nav = document.querySelector(".bottom-nav");
  nav.style.display = p === "filter" || p === "add" ? "none" : "flex";
  if (p === "profile") renderProfileAds();
  if (p === "favs") renderFavs();
}

function switchProfileTab(t) {
  currentProfileTab = t;
  renderProfileAds();
}

function renderProfileAds() {
  const grid = document.getElementById("my-ads-grid");
  const myId = tg.initDataUnsafe?.user?.id || 0;
  const myAds = ads.filter(
    (a) =>
      a.userId === myId &&
      (currentProfileTab === "active"
        ? a.status === "active"
        : a.status === "sold")
  );
  grid.innerHTML = myAds.length
    ? ""
    : '<p style="text-align:center; padding:50px; color:gray;">Пусто</p>';
  myAds.forEach((ad) => {
    const wrap = document.createElement("div");
    wrap.className = "card";
    wrap.innerHTML = `<img src="${
      ad.img[0]
    }" style="height:140px; width:100%; object-fit:cover;"><div class="card-body"><span class="card-price">${
      ad.price
    } KGS</span><div class="card-cat-row">${ad.title}</div>${
      ad.status === "active"
        ? '<div class="profile-actions"><button class="btn-mini btn-edit" onclick="openEditModal(' +
          ad.id +
          ')">Изменить</button><button class="btn-mini btn-sold-action" onclick="showActionPopup(' +
          ad.id +
          ')">Продано</button></div>'
        : ""
    }</div>`;
    grid.appendChild(wrap);
  });
}

function showActionPopup(id) {
  tg.showPopup(
    {
      title: "Завершение",
      message: "Что сделать?",
      buttons: [
        { id: "sold", type: "default", text: "Продано" },
        { id: "delete", type: "destructive", text: "Удалить" },
        { id: "cancel", type: "cancel" },
      ],
    },
    (btnId) => {
      if (btnId === "sold") db.ref("ads/" + id).update({ status: "sold" });
      if (btnId === "delete") db.ref("ads/" + id).remove();
    }
  );
}

function filterByCat(c, el) {
  curCat = c;
  document
    .querySelectorAll(".category-row .cat-chip")
    .forEach((i) => i.classList.remove("active"));
  el.classList.add("active");
  renderFeed();
}
function filterByCity(c, el) {
  curCity = c;
  document
    .querySelectorAll(".city-row .cat-chip")
    .forEach((i) => i.classList.remove("active"));
  el.classList.add("active");
  renderFeed();
}
function renderFavs() {
  const area = document.getElementById("favs-content-area");
  const data = ads.filter((a) => favs.includes(a.id));
  area.innerHTML = data.length
    ? '<div class="listings-grid"></div>'
    : '<p style="text-align:center; padding:50px; color:gray;">Пусто</p>';
  if (data.length) {
    const g = area.querySelector(".listings-grid");
    data.forEach((ad) => g.appendChild(createAdCard(ad)));
  }
}
function clearFavs() {
  favs = [];
  localStorage.setItem("favs_final_v12", JSON.stringify(favs));
  renderFavs();
}
