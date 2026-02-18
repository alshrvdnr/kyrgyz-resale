const tg = window.Telegram.WebApp;
tg.expand();

const IMGBB_KEY = "94943ea3f656b4bc95e25c86d2880b94";
const BOT_TOKEN = "8399814024:AAEla8xBVk_9deHydJV0hrc5QYDyXAFpZ8k";
const ADMIN_ID = "1615492914";

const catMap = {
  flowers: "Цветы",
  jewelry: "Ювелирка",
  gifts: "Подарки",
  certs: "Сертификаты",
  Все: "Все",
};

let ads = JSON.parse(localStorage.getItem("gifts_final_v12")) || [];
let favs = JSON.parse(localStorage.getItem("favs_final_v12")) || [];

let curCat = "Все";
let curCity = "Все";
let curMainTab = "rec";
let filterSort = "default";

let currentProfileTab = "active";
let selectedFiles = [];
let selectedReceipt = null;
let selectedTariff = "standard";

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
    const results = ads.filter((a) => a.title.toLowerCase().includes(query));
    renderFeedInternal(results, "results-grid");
    showPage("results");
    e.target.blur();
  }
}

function switchMainTab(tab) {
  curMainTab = tab;
  document.getElementById("mtab-rec").classList.toggle("active", tab === "rec");
  document.getElementById("mtab-new").classList.toggle("active", tab === "new");
  renderFeed();
}

function renderFeed(data = ads) {
  renderFeedInternal(data, "home-grid");
}

function renderFeedInternal(data, gridId) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  grid.innerHTML = "";

  let filtered = [...data];

  // Если это главная лента, применяем быстрые фильтры (категория/город)
  if (gridId === "home-grid") {
    filtered = filtered.filter((ad) => {
      const catMatch = curCat === "Все" || ad.cat === curCat;
      const cityMatch = curCity === "Все" || ad.city === curCity;
      return catMatch && cityMatch;
    });
  }

  const now = Date.now();

  // ПОРЯДОК: VIP (1) -> Активные (2) -> Проданные (3)
  filtered.sort((a, b) => {
    const getRank = (item) => {
      if (item.status === "sold" || item.status === "deleted") return 3;
      if (item.tariff === "vip" && item.vipTill > now) return 1;
      return 2;
    };

    const rankA = getRank(a);
    const rankB = getRank(b);

    if (rankA !== rankB) return rankA - rankB;

    // Внутри групп сортируем по фильтру
    if (filterSort === "cheap")
      return parseFloat(a.price) - parseFloat(b.price);
    if (filterSort === "expensive")
      return parseFloat(b.price) - parseFloat(a.price);
    return b.id - a.id; // По умолчанию новые сверху
  });

  filtered.forEach((ad) => {
    grid.appendChild(createAdCard(ad));
  });
}

function createAdCard(ad) {
  const catName = catMap[ad.cat] || "Товар";
  let coverImg = Array.isArray(ad.img) ? ad.img[0] : ad.img;
  const isSold = ad.status === "sold" || ad.status === "deleted";
  const isVip = ad.tariff === "vip" && ad.vipTill > Date.now();

  let badgeHTML = "";
  if (isSold) badgeHTML = `<div class="sold-badge">ПРОДАНО</div>`;
  else if (isVip) badgeHTML = `<div class="vip-badge">VIP</div>`;

  let imageHTML =
    ad.status === "deleted"
      ? `${badgeHTML}<div class="deleted-placeholder"><span class="deleted-text">Фото скрыто<br>конфиденциально</span></div>`
      : `${badgeHTML}<img src="${coverImg}" loading="lazy" style="height:140px; object-fit:cover; width:100%;">`;

  const isFav = favs.includes(ad.id);
  const heartColor = isFav ? "var(--pink)" : "white";
  const heartClass = isFav ? "fa-solid" : "fa-regular";

  let dateStr = ad.dateReceived
    ? new Date(ad.dateReceived).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "numeric",
        year: "2-digit",
      })
    : "-";

  const card = document.createElement("div");
  card.className = "card";
  card.onclick = () => openProduct(ad);
  card.innerHTML = `
      <button class="card-fav-btn" onclick="toggleFavCard(event, ${ad.id})">
         <i class="${heartClass} fa-heart" style="color:${heartColor}"></i>
      </button>
      ${imageHTML}
      <div class="card-body">
        <span class="card-price">${ad.price} KGS</span>
        <div class="card-cat-row"><span class="card-category">${catName}</span> ${ad.title}</div>
        <div class="card-date-block">
            <span class="date-label">Дата получения</span>
            <span class="date-value">${dateStr}</span>
        </div>
      </div>`;
  return card;
}

function toggleFavCard(e, id) {
  e.stopPropagation();
  toggleFav(id);
}

function applyExtendedFilter() {
  const eCat = document.getElementById("ext-cat").value;
  const eCity = document.getElementById("ext-city").value;
  const pFrom = parseFloat(document.getElementById("price-from").value) || 0;
  const pTo = parseFloat(document.getElementById("price-to").value) || Infinity;

  const sortRadios = document.getElementsByName("sort");
  for (let r of sortRadios) {
    if (r.checked) filterSort = r.value;
  }

  const results = ads.filter((ad) => {
    const catMatch = eCat === "Все" || ad.cat === eCat;
    const cityMatch = eCity === "Все" || ad.city === eCity;
    const priceMatch =
      parseFloat(ad.price) >= pFrom && parseFloat(ad.price) <= pTo;
    return catMatch && cityMatch && priceMatch;
  });

  renderFeedInternal(results, "results-grid");
  showPage("results");
}

function resetExtendedFilter() {
  document.getElementById("ext-cat").value = "Все";
  document.getElementById("ext-city").value = "Все";
  document.getElementById("price-from").value = "";
  document.getElementById("price-to").value = "";
  document.getElementsByName("sort")[0].checked = true;
  filterSort = "default";
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

function handleFileSelect(input) {
  selectedFiles = Array.from(input.files).slice(0, 5);
  const gallery = document.getElementById("gallery-preview");
  gallery.innerHTML = "";
  document
    .getElementById("preview-box")
    .classList.toggle("hidden", selectedFiles.length === 0);
  document.getElementById("photo-count").innerText = selectedFiles.length;
  document.getElementById(
    "file-label"
  ).innerText = `Выбрано: ${selectedFiles.length}`;
  selectedFiles.forEach((file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = document.createElement("img");
      img.src = e.target.result;
      gallery.appendChild(img);
    };
    reader.readAsDataURL(file);
  });
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
  try {
    const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    return data.success ? data.data.url : null;
  } catch (e) {
    return null;
  }
}

async function publishAndSend() {
  const fields = {
    title: document.getElementById("in-title"),
    price: document.getElementById("in-price"),
    date: document.getElementById("in-date"),
    phone: document.getElementById("in-wa"),
    addr: document.getElementById("in-address"),
    tg: document.getElementById("in-tg"),
    city: document.getElementById("in-city"),
    cat: document.getElementById("in-cat"),
    desc: document.getElementById("in-desc"),
  };

  if (!fields.title.value || !fields.price.value || !fields.date.value)
    return tg.showAlert("Заполните основные поля!");
  if (selectedFiles.length === 0) return tg.showAlert("Нужно фото!");
  if (selectedTariff === "vip" && !selectedReceipt)
    return tg.showAlert("Нужен чек для VIP!");

  tg.MainButton.showProgress();
  tg.MainButton.show();

  let uploadedUrls = [];
  for (let f of selectedFiles) {
    const url = await uploadToImgBB(f);
    if (url) uploadedUrls.push(url);
  }

  let receiptUrl =
    selectedTariff === "vip" ? await uploadToImgBB(selectedReceipt) : "";

  const ad = {
    id: Date.now(),
    title: fields.title.value,
    price: fields.price.value,
    dateReceived: fields.date.value,
    phone: fields.phone.value,
    address: fields.addr.value,
    tgNick: fields.tg.value,
    city: fields.city.value,
    cat: fields.cat.value,
    desc: fields.desc.value,
    img: uploadedUrls,
    status: "active",
    userId: tg.initDataUnsafe?.user?.id || 0,
    tariff: selectedTariff,
    vipTill:
      selectedTariff === "vip" ? Date.now() + 3 * 24 * 60 * 60 * 1000 : 0,
    receipt: receiptUrl,
  };

  await sendToBot(ad);
  ads.unshift(ad);
  localStorage.setItem("gifts_final_v12", JSON.stringify(ads));

  // ОЧИСТКА ВСЕХ ПОЛЕЙ
  Object.values(fields).forEach((f) => (f.value = ""));
  selectedFiles = [];
  selectedReceipt = null;
  document.getElementById("gallery-preview").innerHTML = "";
  document.getElementById("preview-box").classList.add("hidden");
  document.getElementById("file-label").innerText = "Нажмите для выбора фото";
  document.getElementById("receipt-label").innerText = "Добавить чек";
  selectTariff("standard");

  tg.MainButton.hideProgress();
  tg.MainButton.hide();
  tg.showAlert("Опубликовано!");
  showPage("home");
}

async function sendToBot(ad) {
  let text = `📦 ${ad.title}\n💰 ${ad.price} KGS\n📍 ${ad.city}`;
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMediaGroup`;
  try {
    let media = ad.img.map((url, i) => ({
      type: "photo",
      media: url,
      caption: i === 0 ? text : "",
    }));
    if (ad.receipt)
      media.push({ type: "photo", media: ad.receipt, caption: "🧾 ЧЕК" });
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: ADMIN_ID, media }),
    });
  } catch (e) {}
}

function openProduct(ad) {
  const modal = document.getElementById("product-modal");
  const isFav = favs.includes(ad.id);
  const images = Array.isArray(ad.img) ? ad.img : [ad.img];

  document.getElementById("modal-fav-icon").innerHTML = `<i class="${
    isFav ? "fa-solid" : "fa-regular"
  } fa-heart" style="color:var(--pink); font-size:22px;" onclick="toggleFav(${
    ad.id
  })"></i>`;

  let galleryHTML =
    ad.status === "deleted"
      ? `<div class="deleted-placeholder" style="height:250px;"><span class="deleted-text">Фото скрыто</span></div>`
      : `<div class="product-gallery">${images
          .map((src) => `<img src="${src}">`)
          .join("")}</div>`;

  document.getElementById("pv-content").innerHTML = `
    ${galleryHTML}
    <div class="pd-body">
        <div class="pd-price">${ad.price} KGS</div>
        <div class="pd-title">${catMap[ad.cat]} - ${ad.title}</div>
        <p style="color:#eee; margin-bottom:20px;">${
          ad.desc || "Без описания"
        }</p>
        ${
          ad.status === "active"
            ? `
          <a href="https://t.me/${ad.tgNick}" target="_blank" class="pd-btn-write">Написать продавцу</a>
          <div class="contact-info-block">📍 ${ad.city}, ${ad.address}</div>
          <div class="contact-info-block">📱 ${ad.phone}</div>
        `
            : `<div class="hidden-contacts-msg">Товар продан</div>`
        }
    </div>`;
  modal.classList.remove("hidden");
  tg.BackButton.show();
  tg.BackButton.onClick(closeProduct);
}

function closeProduct() {
  document.getElementById("product-modal").classList.add("hidden");
  tg.BackButton.hide();
}

function toggleFav(id) {
  if (favs.includes(id)) favs = favs.filter((f) => f !== id);
  else favs.push(id);
  localStorage.setItem("favs_final_v12", JSON.stringify(favs));
  renderFeed();
  renderFavs();
}

function showPage(p) {
  document.querySelectorAll(".page").forEach((s) => s.classList.add("hidden"));
  document.getElementById(`page-${p}`).classList.remove("hidden");
  document
    .querySelectorAll(".nav-item")
    .forEach((i) => i.classList.remove("active"));
  if (document.getElementById(`n-${p}`))
    document.getElementById(`n-${p}`).classList.add("active");
  if (p === "home") renderFeed();
  if (p === "profile") renderProfileAds();
  if (p === "favs") renderFavs();
}

function switchProfileTab(t) {
  currentProfileTab = t;
  document
    .getElementById("p-tab-active")
    .classList.toggle("active", t === "active");
  document
    .getElementById("p-tab-sold")
    .classList.toggle("active", t === "sold");
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
        : a.status !== "active")
  );
  grid.innerHTML = myAds.length
    ? ""
    : '<p style="text-align:center; padding:50px; color:gray;">Пусто</p>';
  myAds.forEach((ad) => grid.appendChild(createAdCard(ad)));
}

function renderFavs() {
  const area = document.getElementById("favs-content-area");
  const data = ads.filter((a) => favs.includes(a.id));
  area.innerHTML = data.length
    ? '<div class="listings-grid"></div>'
    : '<p style="text-align:center; padding:50px; color:gray;">Пусто</p>';
  if (data.length)
    data.forEach((ad) =>
      area.querySelector(".listings-grid").appendChild(createAdCard(ad))
    );
}

function clearFavs() {
  favs = [];
  localStorage.setItem("favs_final_v12", JSON.stringify(favs));
  renderFavs();
}
