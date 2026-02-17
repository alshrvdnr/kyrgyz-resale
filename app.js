const tg = window.Telegram.WebApp;
tg.expand();
tg.enableClosingConfirmation();

// БАЗА ДАННЫХ (LOCAL STORAGE)
let ads = JSON.parse(localStorage.getItem("gifts_full_db")) || [];
let favs = JSON.parse(localStorage.getItem("gifts_favs_db")) || [];
let currentCat = "Все";

const CITIES = {
  bishkek: "Бишкек",
  osh: "Ош",
  jalalabad: "Джалал-Абад",
  tokmok: "Токмок",
  karakol: "Каракол",
};

document.addEventListener("DOMContentLoaded", () => {
  initUser();
  renderFeed();

  // ИДЕАЛЬНЫЙ ПОИСК
  document.getElementById("main-search").addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase();
    const filtered = ads.filter(
      (a) =>
        a.title.toLowerCase().includes(query) ||
        a.address.toLowerCase().includes(query)
    );
    renderFeed(filtered);
  });
});

function initUser() {
  const user = tg.initDataUnsafe?.user || { first_name: "Пользователь", id: 0 };
  document.getElementById("u-name").innerText = user.first_name;
  document.getElementById("u-avatar").innerText = user.first_name[0];
}

function renderFeed(data = ads) {
  const grid = document.getElementById("home-grid");
  grid.innerHTML = "";

  const finalData =
    currentCat === "Все" ? data : data.filter((a) => a.cat === currentCat);

  if (finalData.length === 0) {
    grid.innerHTML = `<div style="grid-column: 1/3; text-align: center; padding: 60px 0; color: gray;">Пока ничего нет</div>`;
    return;
  }

  finalData.forEach((ad) => {
    const isFav = favs.includes(ad.id);
    const card = document.createElement("div");
    card.className = "card";
    card.onclick = () => openProduct(ad);
    card.innerHTML = `
            <img src="${
              ad.img || "https://via.placeholder.com/300?text=Нет+фото"
            }">
            <div class="card-info">
                <div class="price-row"><b>${ad.price} KGS</b></div>
                <span class="card-title">${ad.title}</span>
                <div class="card-meta"><i class="fa fa-location-dot"></i> ${
                  CITIES[ad.city] || ad.city
                }</div>
                <i class="fa-heart fav-icon ${
                  isFav ? "fa active" : "far"
                }" onclick="toggleFav(event, ${ad.id})"></i>
            </div>
        `;
    grid.appendChild(card);
  });
}

function showPage(pageId) {
  document.querySelectorAll(".page").forEach((p) => p.classList.add("hidden"));
  document.getElementById(`page-${pageId}`).classList.remove("hidden");

  document
    .querySelectorAll(".t-item")
    .forEach((i) => i.classList.remove("active"));
  const navBtn = document.getElementById(`n-${pageId}`);
  if (navBtn) navBtn.classList.add("active");

  if (pageId === "favs") renderFavs();
  if (pageId === "profile") renderMyAds();

  tg.HapticFeedback.impactOccurred("light");
}

function publishAd() {
  const title = document.getElementById("in-title").value;
  const price = document.getElementById("in-price").value;
  const city = document.getElementById("in-city").value;
  const cat = document.getElementById("in-cat").value;
  const address = document.getElementById("in-address").value;
  const time = document.getElementById("in-time").value;
  const wa = document.getElementById("in-wa").value;
  const img = document.getElementById("in-img").value;

  if (!title || !price || !wa) {
    tg.showAlert("Заполните название, цену и номер WhatsApp!");
    return;
  }

  const newAd = {
    id: Date.now(),
    userId: tg.initDataUnsafe?.user?.id || 0,
    title,
    price,
    city,
    cat,
    address,
    time,
    wa,
    img,
    date: new Date(),
  };

  ads.unshift(newAd);
  localStorage.setItem("gifts_full_db", JSON.stringify(ads));

  // Очистка
  document.getElementById("in-title").value = "";
  document.getElementById("in-price").value = "";

  tg.showAlert("Объявление опубликовано!");
  showPage("home");
  renderFeed();
}

function openProduct(ad) {
  const modal = document.getElementById("product-modal");
  const content = document.getElementById("product-content");

  content.innerHTML = `
        <img src="${
          ad.img
        }" style="width:100%; height:320px; object-fit:cover;">
        <div style="padding: 20px;">
            <h1 style="color:var(--pink); margin:0;">${ad.price} KGS</h1>
            <h2 style="margin:10px 0;">${ad.title}</h2>
            <p style="color:var(--dim); font-size:14px;"><i class="fa fa-location-dot"></i> ${
              CITIES[ad.city]
            }, ${ad.address}</p>
            <p style="color:var(--dim); font-size:14px;"><i class="fa fa-clock"></i> ${
              ad.time
            }</p>
            <div style="background:#222; padding:15px; border-radius:12px; margin:20px 0; font-size:15px;">
                ${ad.desc || "Без описания"}
            </div>
            <a href="https://wa.me/${ad.wa.replace(
              /\D/g,
              ""
            )}" class="main-pink-btn" style="display:block; text-align:center; text-decoration:none;">
                <i class="fab fa-whatsapp"></i> Написать продавцу
            </a>
        </div>
    `;
  modal.classList.remove("hidden");
}

function closeProduct() {
  document.getElementById("product-modal").classList.add("hidden");
}

function toggleFav(e, id) {
  e.stopPropagation();
  if (favs.includes(id)) {
    favs = favs.filter((f) => f !== id);
  } else {
    favs.push(id);
  }
  localStorage.setItem("gifts_favs_db", JSON.stringify(favs));
  renderFeed();
  tg.HapticFeedback.selectionChanged();
}

function renderFavs() {
  const grid = document.getElementById("favs-grid");
  const favAds = ads.filter((a) => favs.includes(a.id));
  grid.innerHTML = favAds.length
    ? ""
    : '<p style="grid-column:1/3;text-align:center;padding:50px;">Избранных товаров нет</p>';

  favAds.forEach((ad) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `<img src="${ad.img}"><div class="card-info"><b>${ad.price} KGS</b><br><small>${ad.title}</small></div>`;
    grid.appendChild(card);
  });
}

function filterByCat(cat) {
  currentCat = cat;
  document.querySelectorAll(".cat-pill").forEach((c) => {
    c.classList.toggle(
      "active",
      c.innerText.includes(cat) || (cat === "Все" && c.innerText === "Все")
    );
  });
  renderFeed();
}

function renderMyAds() {
  const container = document.getElementById("my-ads-container");
  const myId = tg.initDataUnsafe?.user?.id || 0;
  const myAds = ads.filter((a) => a.userId === myId);

  document.getElementById(
    "tab-active-count"
  ).innerText = `Активно (${myAds.length})`;
  container.innerHTML = "";

  if (myAds.length === 0) {
    container.innerHTML = `<div style="grid-column:1/3;text-align:center;padding:20px;color:gray;">У вас нет объявлений</div>`;
    return;
  }

  myAds.forEach((ad) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
            <img src="${ad.img}">
            <div class="card-info">
                <b>${ad.price} KGS</b><br>
                <button onclick="deleteAd(${ad.id})" style="color:red; background:none; border:none; padding:0; font-size:11px; margin-top:5px;">Удалить</button>
            </div>
        `;
    container.appendChild(card);
  });
}

function deleteAd(id) {
  if (confirm("Удалить это объявление?")) {
    ads = ads.filter((a) => a.id !== id);
    localStorage.setItem("gifts_full_db", JSON.stringify(ads));
    renderMyAds();
    renderFeed();
  }
}
