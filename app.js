// --- FIREBASE CONFIG ---
const firebaseConfig = {
  apiKey: "AIzaSyCxaC3C9dx6IEhXWH9eATdKZO8SCRYe33I",
  authDomain: "gifts-kg.firebaseapp.com",
  databaseURL: "https://gifts-kg-default-rtdb.firebaseio.com",
  projectId: "gifts-kg",
  storageBucket: "gifts-kg.firebasestorage.app",
  messagingSenderId: "419866659643",
  appId: "1:419866659643:web:2332c8856698705780451e",
  measurementId: "G-DH7RXQZ6Y3"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

const tg = window.Telegram.WebApp;
tg.expand();

// НАСТРОЙКИ
const IMGBB_KEY = "94943ea3f656b4bc95e25c86d2880b94";
const BOT_TOKEN = "8399814024:AAEla8xBVk_9deHydJV0hrc5QYDyXAFpZ8k";
const ADMIN_ID = 1615492914;

const catMap = { flowers: "Цветы", jewelry: "Ювелирка", gifts: "Подарки", certs: "Сертификаты", Все: "Все" };

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

// СИНХРОНИЗАЦИЯ С ОБЛАКОМ
db.ref('ads').on('value', (snapshot) => {
    const data = snapshot.val();
    ads = data ? Object.values(data) : [];
    renderFeed(); 
    if (!document.getElementById("page-profile").classList.contains("hidden")) {
        renderProfileAds();
    }
});

document.addEventListener("DOMContentLoaded", () => {
    initUser();
    renderFeed();
});

function initUser() {
    const user = tg.initDataUnsafe?.user || { first_name: "Пользователь", id: 0 };
    if (document.getElementById("u-name")) document.getElementById("u-name").innerText = user.first_name;
    if (document.getElementById("u-avatar")) document.getElementById("u-avatar").innerText = user.first_name[0];
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

function renderFeed() {
    renderFeedInternal(ads, "home-grid");
}

function renderFeedInternal(data, gridId) {
    const grid = document.getElementById(gridId);
    if (!grid) return;
    grid.innerHTML = "";

    let filtered = data.filter((ad) => {
        const catMatch = curCat === "Все" || ad.cat === curCat;
        const cityMatch = curCity === "Все" || ad.city === curCity;
        return catMatch && cityMatch;
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
        if (filterSort === "cheap") return parseFloat(a.price) - parseFloat(b.price);
        if (filterSort === "expensive") return parseFloat(b.price) - parseFloat(a.price);
        return b.id - a.id; 
    });

    filtered.forEach((ad) => {
        grid.appendChild(createAdCard(ad));
    });
}

function createAdCard(ad) {
    const catName = catMap[ad.cat] || "Товар";
    let coverImg = Array.isArray(ad.img) ? ad.img[0] : ad.img;
    const isSold = ad.status === "sold" || ad.status === "deleted";
    let badgeHTML = isSold ? `<div class="sold-badge">ПРОДАНО</div>` : (ad.tariff === "vip" && ad.vipTill > Date.now() ? `<div class="vip-badge">VIP</div>` : "");

    // ВРЕМЯ ПУБЛИКАЦИИ
    let timeBadgeHTML = "";
    if (ad.publishedAt) {
        const pubDate = new Date(ad.publishedAt);
        const hours = pubDate.getHours().toString().padStart(2, '0');
        const mins = pubDate.getMinutes().toString().padStart(2, '0');
        timeBadgeHTML = `<div class="pub-time-badge">${hours}:${mins}</div>`;
    }

    const isFav = favs.includes(ad.id);
    let dateStr = ad.dateReceived ? new Date(ad.dateReceived).toLocaleDateString("ru-RU", { day: "numeric", month: "numeric", year: "2-digit" }) : "-";

    const card = document.createElement("div");
    card.className = "card";
    card.onclick = () => openProduct(ad);
    card.innerHTML = `
        <button class="card-fav-btn" onclick="toggleFavCard(event, ${ad.id})">
           <i class="${isFav ? 'fa-solid' : 'fa-regular'} fa-heart" style="color:${isFav ? 'var(--pink)' : 'white'}"></i>
        </button>
        ${badgeHTML}
        ${timeBadgeHTML}
        <img src="${coverImg}" loading="lazy" style="height:140px; object-fit:cover; width:100%;">
        <div class="card-body">
          <span class="card-price">${ad.price} KGS</span>
          <div class="card-cat-row"><span class="card-category">${catName}</span> ${ad.title}</div>
          <div class="card-date-block"><span class="date-label">Дата получения</span><span class="date-value">${dateStr}</span></div>
        </div>`;
    return card;
}

function toggleFavCard(e, id) {
    e.stopPropagation();
    toggleFav(id);
}

function filterByCat(c, el) {
    curCat = c;
    document.querySelectorAll(".category-row .cat-chip").forEach(i => i.classList.remove("active"));
    el.classList.add("active"); renderFeed();
}

function filterByCity(c, el) {
    curCity = c;
    document.querySelectorAll(".city-row .cat-chip").forEach(i => i.classList.remove("active"));
    el.classList.add("active"); renderFeed();
}

function applyExtendedFilter() {
    const eCat = document.getElementById("ext-cat").value;
    const eCity = document.getElementById("ext-city").value;
    const pFrom = parseFloat(document.getElementById("price-from").value) || 0;
    const pTo = parseFloat(document.getElementById("price-to").value) || Infinity;
    const sortRadios = document.getElementsByName("sort");
    for (let r of sortRadios) { if (r.checked) filterSort = r.value; }
    const results = ads.filter(ad => {
        const price = parseFloat(ad.price) || 0;
        return (eCat === "Все" || ad.cat === eCat) && (eCity === "Все" || ad.city === eCity) && (price >= pFrom && price <= pTo);
    });
    renderFeedInternal(results, "results-grid"); showPage("results");
}

function resetExtendedFilter() {
    document.getElementById("ext-cat").value = "Все"; document.getElementById("ext-city").value = "Все";
    document.getElementById("price-from").value = ""; document.getElementById("price-to").value = "";
    curCat = "Все"; curCity = "Все"; filterSort = "default"; renderFeed();
}

function selectTariff(t) {
    selectedTariff = t;
    document.getElementById("tariff-std").classList.toggle("active", t === "standard");
    document.getElementById("tariff-vip").classList.toggle("active", t === "vip");
    const vipBlock = document.getElementById("vip-block");
    if (t === "vip") {
        vipBlock.classList.remove("hidden");
    } else {
        vipBlock.classList.add("hidden");
    }
}

function handleFileSelect(input) {
    selectedFiles = Array.from(input.files).slice(0, 5);
    const gallery = document.getElementById("gallery-preview");
    gallery.innerHTML = "";
    if (selectedFiles.length > 0) {
        document.getElementById("preview-box").classList.remove("hidden");
        document.getElementById("photo-count").innerText = selectedFiles.length;
        document.getElementById("file-label").innerText = `Выбрано: ${selectedFiles.length}`;
        selectedFiles.forEach(file => {
            const reader = new FileReader();
            reader.onload = e => {
                const img = document.createElement("img");
                img.src = e.target.result;
                gallery.appendChild(img);
            };
            reader.readAsDataURL(file);
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
    const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, { method: "POST", body: formData });
    const data = await res.json();
    return data.success ? data.data.url : null;
}

async function publishAndSend() {
    const titleInput = document.getElementById("in-title");
    const priceInput = document.getElementById("in-price");
    if (!titleInput.value || !priceInput.value || selectedFiles.length === 0) return tg.showAlert("Заполните фото, название и цену!");

    tg.MainButton.showProgress();
    tg.MainButton.show();

    let uploadedUrls = [];
    for (let file of selectedFiles) {
        const url = await uploadToImgBB(file);
        if (url) uploadedUrls.push(url);
    }
    let receiptUrl = (selectedTariff === "vip" && selectedReceipt) ? await uploadToImgBB(selectedReceipt) : "";

    const adId = Date.now();
    const userId = tg.initDataUnsafe?.user?.id || 0;
    const ad = {
        id: adId,
        title: titleInput.value,
        price: priceInput.value,
        dateReceived: document.getElementById("in-date").value,
        phone: document.getElementById("in-wa").value,
        address: document.getElementById("in-address").value,
        tgNick: document.getElementById("in-tg").value,
        city: document.getElementById("in-city").value,
        cat: document.getElementById("in-cat").value,
        desc: document.getElementById("in-desc").value,
        img: uploadedUrls,
        status: "pending",
        userId: userId,
        tariff: selectedTariff,
        vipTill: selectedTariff === "vip" ? Date.now() + 259200000 : 0,
        receipt: receiptUrl
    };

    db.ref('moderation/' + adId).set(ad).then(() => {
        ["in-title", "in-price", "in-date", "in-wa", "in-address", "in-tg", "in-desc"].forEach(id => document.getElementById(id).value = "");
        document.getElementById("in-city").selectedIndex = 0; document.getElementById("in-cat").selectedIndex = 0;
        selectedFiles = []; selectedReceipt = null;
        document.getElementById("gallery-preview").innerHTML = ""; document.getElementById("preview-box").classList.add("hidden");
        tg.MainButton.hide(); showPage("home");
        tg.showAlert("Объявление отправлено на модерацию!");
    });
}

// ФУНКЦИИ РЕДАКТИРОВАНИЯ В ПРОФИЛЕ
function openEditModal(adId) {
    const ad = ads.find(a => a.id == adId);
    if (!ad) return;

    document.getElementById("edit-in-title").value = ad.title;
    document.getElementById("edit-in-price").value = ad.price;
    document.getElementById("edit-in-wa").value = ad.phone;
    document.getElementById("edit-in-desc").value = ad.desc;

    document.getElementById("edit-modal").classList.remove("hidden");
    document.getElementById("save-edit-btn").onclick = () => saveEdit(adId);
}

function closeEditModal() {
    document.getElementById("edit-modal").classList.add("hidden");
}

function saveEdit(adId) {
    const newTitle = document.getElementById("edit-in-title").value;
    const newPrice = document.getElementById("edit-in-price").value;
    const newWa = document.getElementById("edit-in-wa").value;
    const newDesc = document.getElementById("edit-in-desc").value;

    db.ref('ads/' + adId).update({
        title: newTitle,
        price: newPrice,
        phone: newWa,
        desc: newDesc
    }).then(() => {
        tg.showAlert("Обновлено!");
        closeEditModal();
    });
}

function openProduct(ad) {
    const modal = document.getElementById("product-modal");
    modal.classList.remove("hidden");
    const favArea = document.getElementById("modal-fav-icon");
    favArea.innerHTML = `<i class="${favs.includes(ad.id) ? 'fa-solid' : 'fa-regular'} fa-heart" onclick="toggleFav(${ad.id})" style="color:var(--pink); font-size:22px;"></i>`;
    const images = Array.isArray(ad.img) ? ad.img : [ad.img];
    document.getElementById("pv-content").innerHTML = `
        <div class="product-gallery">${images.map(s => `<img src="${s}">`).join("")}</div>
        <div class="pd-body">
            <div class="pd-price">${ad.price} KGS</div>
            <div class="pd-title">${catMap[ad.cat]} - ${ad.title}</div>
            <p style="color:#eee; font-size:15px; margin-top:15px;">${ad.desc || "Нет описания"}</p>
            ${ad.status === 'active' ? `<a href="https://t.me/${ad.tgNick}" target="_blank" class="pd-btn-write">Написать продавцу</a>` : ''}
        </div>`;
    tg.BackButton.show();
    tg.BackButton.onClick(closeProduct);
}

function closeProduct() {
    document.getElementById("product-modal").classList.add("hidden");
    tg.BackButton.hide();
}

function toggleFav(id) {
    favs = favs.includes(id) ? favs.filter(f => f !== id) : [...favs, id];
    localStorage.setItem("favs_final_v12", JSON.stringify(favs));
    renderFeed(); renderFavs();
}

function showPage(p) {
    document.querySelectorAll(".page").forEach(s => s.classList.add("hidden"));
    document.getElementById(`page-${p}`).classList.remove("hidden");
    const nav = document.querySelector(".bottom-nav");
    nav.style.display = (p === "filter" || p === "add") ? "none" : "flex";
    if (p === "profile") renderProfileAds();
    if (p === "favs") renderFavs();
}

function switchProfileTab(tab) {
    currentProfileTab = tab;
    document.getElementById("p-tab-active").classList.toggle("active", tab === "active");
    document.getElementById("p-tab-sold").classList.toggle("active", tab === "sold");
    renderProfileAds();
}

function renderProfileAds() {
    const grid = document.getElementById("my-ads-grid");
    const myId = tg.initDataUnsafe?.user?.id || 0;
    const myAds = ads.filter(a => a.userId === myId && (currentProfileTab === "active" ? a.status === "active" : a.status === "sold"));
    
    grid.innerHTML = myAds.length ? "" : '<p style="text-align:center; padding:50px; color:gray;">Пусто</p>';
    
    myAds.forEach(ad => {
        const wrap = document.createElement("div");
        wrap.className = "card";
        let cover = Array.isArray(ad.img) ? ad.img[0] : ad.img;
        let buttonsHTML = (ad.status === "active") 
            ? `<div class="profile-actions">
                <button class="btn-mini btn-edit" onclick="openEditModal(${ad.id})">Изменить</button>
                <button class="btn-mini btn-sold-action" onclick="showActionPopup(${ad.id})">Продано</button>
               </div>` 
            : `<div style="text-align:center; font-size:12px; color:gray; margin-top:10px; font-weight:bold;">ПРОДАНО</div>`;

        wrap.innerHTML = `<img src="${cover}" style="height:140px; width:100%; object-fit:cover;"><div class="card-body"><span class="card-price">${ad.price} KGS</span><div class="card-cat-row">${ad.title}</div>${buttonsHTML}</div>`;
        grid.appendChild(wrap);
    });
}

function showActionPopup(id) {
    tg.showPopup({ title: "Завершение", message: "Что сделать?", buttons: [{ id: "sold", type: "default", text: "Продано" }, { id: "delete", type: "destructive", text: "Удалить" }, { id: "cancel", type: "cancel" }] }, (btnId) => {
        if (btnId === "sold") db.ref('ads/' + id).update({ status: "sold" });
        if (btnId === "delete") db.ref('ads/' + id).remove();
    });
}

function renderFavs() {
    const area = document.getElementById("favs-content-area");
    const data = ads.filter(a => favs.includes(a.id));
    area.innerHTML = data.length ? '<div class="listings-grid"></div>' : '<p style="text-align:center; padding:50px; color:gray;">Пусто</p>';
    if (data.length) {
        const grid = area.querySelector(".listings-grid");
        data.forEach(ad => grid.appendChild(createAdCard(ad)));
    }
}

function clearFavs() { favs = []; localStorage.setItem("favs_final_v12", JSON.stringify(favs)); renderFavs(); }