const tg = window.Telegram.WebApp;
tg.expand();

// ---------------------------------------------------------
// НАСТРОЙКИ
// ---------------------------------------------------------
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

// ---------------------------------------------------------
// ДАННЫЕ
// ---------------------------------------------------------
let ads = JSON.parse(localStorage.getItem("gifts_final_v12")) || [];
let favs = JSON.parse(localStorage.getItem("favs_final_v12")) || [];
let curCat = "Все";
let currentFavTab = "ads";
let currentProfileTab = "active";
let selectedFiles = [];

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

// ---------------------------------------------------------
// ПОИСК И ЛЕНТА
// ---------------------------------------------------------
function handleSearch(e) {
  if (e.key === "Enter") {
    const query = e.target.value.toLowerCase();
    const results = ads.filter((a) => a.title.toLowerCase().includes(query));
    renderFeed(query === "" ? ads : results);
    e.target.blur();
  }
}

function renderFeed(data = ads) {
  const grid = document.getElementById("home-grid");
  if (!grid) return;
  grid.innerHTML = "";

  let filtered = curCat === "Все" ? data : data.filter((a) => a.cat === curCat);
  filtered.sort((a, b) => b.id - a.id);

  filtered.forEach((ad) => {
    const catName = catMap[ad.cat] || "Разное";
    let coverImg = Array.isArray(ad.img) ? ad.img[0] : ad.img;

    // 1. Логика ФОТО (Удалено = заглушка, Продано = фото + бейдж)
    let imageHTML = "";
    if (ad.status === "deleted") {
      imageHTML = `
        <div class="deleted-placeholder">
            <span class="deleted-text">Фото удалено<br>для конфиденциальности</span>
        </div>`;
    } else {
      const soldBadge =
        ad.status === "sold" ? `<div class="sold-badge">ПРОДАНО</div>` : "";
      imageHTML = `
            ${soldBadge}
            <img src="${coverImg}" loading="lazy" style="height:140px; object-fit:cover; width:100%;">
        `;
    }

    // 2. Логика СЕРДЕЧКА (В левом углу)
    const isFav = favs.includes(ad.id);
    const heartColor = isFav ? "var(--pink)" : "white";
    const heartClass = isFav ? "fa-solid" : "fa-regular";

    const card = document.createElement("div");
    card.className = "card";

    // Клик по карточке открывает товар (даже если удален, там просто будет заглушка)
    card.onclick = () => openProduct(ad);

    card.innerHTML = `
      <!-- Кнопка избранного (с stopPropagation чтобы не открывать товар) -->
      <button class="card-fav-btn" onclick="toggleFavCard(event, ${ad.id})">
         <i class="${heartClass} fa-heart" style="color:${heartColor}"></i>
      </button>

      ${imageHTML}
      <div class="card-body">
        <span class="card-price">${ad.price} KGS</span>
        <div class="card-cat-row">
            <span class="card-category">${catName}</span> ${ad.title}
        </div>
        <div class="card-desc-short">${ad.desc || ad.city}</div>
      </div>`;

    grid.appendChild(card);
  });
}

// Отдельная функция для клика по сердечку в карточке
function toggleFavCard(e, id) {
  e.stopPropagation(); // Останавливаем клик, чтобы не открылась модалка
  toggleFav(id);
}

// ---------------------------------------------------------
// ЗАГРУЗКА И ПУБЛИКАЦИЯ
// ---------------------------------------------------------
function handleFileSelect(input) {
  const files = Array.from(input.files);
  if (files.length > 0) {
    selectedFiles = files.slice(0, 5);
    const gallery = document.getElementById("gallery-preview");

    gallery.innerHTML = "";
    document.getElementById("preview-box").classList.remove("hidden");
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
}

async function uploadToImgBB(file) {
  const formData = new FormData();
  formData.append("image", file);
  try {
    const response = await fetch(
      `https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`,
      {
        method: "POST",
        body: formData,
      }
    );
    const data = await response.json();
    return data.success ? data.data.url : null;
  } catch (error) {
    return null;
  }
}

async function publishAndSend() {
  const title = document.getElementById("in-title").value;
  const price = document.getElementById("in-price").value;
  const phone = document.getElementById("in-wa").value;
  const address = document.getElementById("in-address").value;
  const tgNick = document.getElementById("in-tg").value;
  const city = document.getElementById("in-city").value;
  const cat = document.getElementById("in-cat").value;
  const desc = document.getElementById("in-desc").value;

  if (!title || !price) return tg.showAlert("Заполните название и цену!");
  if (selectedFiles.length === 0) return tg.showAlert("Нужно хотя бы 1 фото!");

  tg.MainButton.showProgress();
  tg.MainButton.text = "Публикация...";
  tg.MainButton.show();

  let uploadedUrls = [];
  for (let file of selectedFiles) {
    const url = await uploadToImgBB(file);
    if (url) uploadedUrls.push(url);
  }

  if (uploadedUrls.length === 0) {
    tg.MainButton.hideProgress();
    tg.MainButton.hide();
    return tg.showAlert("Ошибка загрузки фото");
  }

  const ad = {
    id: Date.now(),
    title,
    price,
    phone,
    address,
    tgNick,
    city,
    cat,
    desc,
    img: uploadedUrls,
    status: "active",
    userId: tg.initDataUnsafe?.user?.id || 0,
  };

  await sendToBot(ad);

  ads.unshift(ad);
  localStorage.setItem("gifts_final_v12", JSON.stringify(ads));

  document.getElementById("in-title").value = "";
  document.getElementById("in-price").value = "";
  document.getElementById("in-desc").value = "";
  selectedFiles = [];
  document.getElementById("gallery-preview").innerHTML = "";
  document.getElementById("preview-box").classList.add("hidden");
  document.getElementById("file-label").innerText = "Нажмите для выбора фото";

  tg.MainButton.hideProgress();
  tg.MainButton.hide();
  tg.showAlert("Готово!");
  showPage("home");
}

async function sendToBot(ad) {
  const text = `🚀 ЗАЯВКА\n📦: ${ad.title}\n💰: ${ad.price} KGS\n📍: ${ad.city}\n👤: @${ad.tgNick}\n📱: ${ad.phone}`;
  const urlGroup = `https://api.telegram.org/bot${BOT_TOKEN}/sendMediaGroup`;
  const urlMessage = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

  try {
    let mediaGroup = ad.img.map((imgUrl, index) => {
      return { type: "photo", media: imgUrl, caption: index === 0 ? text : "" };
    });
    await fetch(urlGroup, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: ADMIN_ID, media: mediaGroup }),
    });
    await fetch(urlMessage, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: ADMIN_ID,
        text: `Действия:`,
        reply_markup: {
          inline_keyboard: [
            [
              { text: "ОК ✅", callback_data: `ok_${ad.id}` },
              { text: "DEL ❌", callback_data: `no_${ad.id}` },
            ],
          ],
        },
      }),
    });
  } catch (e) {
    console.error(e);
  }
}

// ---------------------------------------------------------
// ПРОДУКТ (ПОЛНЫЙ ПРОСМОТР)
// ---------------------------------------------------------
function openProduct(ad) {
  const modal = document.getElementById("product-modal");
  const favIconArea = document.getElementById("modal-fav-icon");
  const isFav = favs.includes(ad.id);
  const catName = catMap[ad.cat] || "Товар";

  const images = Array.isArray(ad.img) ? ad.img : [ad.img];

  // Сердечко справа сверху
  favIconArea.innerHTML = `<i class="${
    isFav ? "fa-solid" : "fa-regular"
  } fa-heart" style="color:var(--pink); font-size:22px;" onclick="toggleFav(${
    ad.id
  })"></i>`;

  // Галерея (Слайдер) или Заглушка
  let galleryHTML = "";
  if (ad.status === "deleted") {
    galleryHTML = `<div class="deleted-placeholder" style="height:250px;"><span class="deleted-text" style="font-size:14px;">Фотография удалена<br>для конфиденциальности</span></div>`;
  } else {
    let imagesHtml = images.map((src) => `<img src="${src}">`).join("");
    let dotsHtml =
      images.length > 1
        ? images
            .map((_, i) => `<div class="dot ${i === 0 ? "active" : ""}"></div>`)
            .join("")
        : "";
    galleryHTML = `<div class="product-gallery">${imagesHtml}</div>${
      images.length > 1 ? `<div class="gallery-dots">${dotsHtml}</div>` : ""
    }`;
  }

  // Логика контактов (Скрываем, если не активен)
  let contactInfoHTML = "";
  if (ad.status === "active") {
    // Показываем всё
    contactInfoHTML = `
        <a href="https://t.me/${ad.tgNick.replace(
          "@",
          ""
        )}" target="_blank" class="pd-btn-write">Написать продавцу</a>
        <div class="contact-info-block"><div class="contact-label">📍 ГОРОД</div><div class="contact-value">${
          ad.city
        }</div></div>
        <div class="contact-info-block"><div class="contact-label">🏠 АДРЕС</div><div class="contact-value">${
          ad.address || "Не указан"
        }</div></div>
        <div class="contact-info-block"><div class="contact-label">📱 ТЕЛЕФОН</div><div class="contact-value">${
          ad.phone
        }</div></div>
      `;
  } else {
    // Скрываем всё
    contactInfoHTML = `
        <div class="hidden-contacts-msg">
            <i class="fa fa-lock" style="margin-bottom:5px;"></i><br>
            Контактные данные и адрес скрыты,<br>так как товар ${
              ad.status === "sold" ? "продан" : "удален"
            }.
        </div>
      `;
  }

  document.getElementById("pv-content").innerHTML = `
        ${galleryHTML}

        <div class="pd-body">
            <div class="pd-price">${ad.price} KGS</div>
            <div class="pd-title" style="font-size:18px; color:#aaa; margin-bottom:5px;">
                ${catName} - <span style="color:white;">${ad.title}</span>
            </div>
            
            <p style="color:#eee; font-size:15px; margin-bottom:20px; line-height:1.5;">${ad.desc}</p>
            
            ${contactInfoHTML}
        </div>
    `;
  modal.classList.remove("hidden");

  // Инициализация слайдера (если он есть)
  const galleryDiv = document.querySelector(".product-gallery");
  if (galleryDiv && images.length > 1) {
    galleryDiv.addEventListener("scroll", () => {
      const index = Math.round(galleryDiv.scrollLeft / galleryDiv.offsetWidth);
      document
        .querySelectorAll(".dot")
        .forEach((d, i) => d.classList.toggle("active", i === index));
    });
  }
  tg.BackButton.show();
  tg.BackButton.onClick(closeProduct);
}

function closeProduct() {
  document.getElementById("product-modal").classList.add("hidden");
  tg.BackButton.hide();
}

function toggleFav(id) {
  if (favs.includes(id)) {
    favs = favs.filter((f) => f !== id);
  } else {
    favs.push(id);
  }
  localStorage.setItem("favs_final_v12", JSON.stringify(favs));

  // Обновляем сердечки везде
  renderFeed(); // Обновит ленту
  renderFavs(); // Обновит экран избранного

  // Если открыта модалка, обновляем сердечко в ней
  const modalIcon = document.querySelector("#modal-fav-icon i");
  if (modalIcon) {
    if (favs.includes(id)) {
      modalIcon.classList.remove("fa-regular");
      modalIcon.classList.add("fa-solid");
      modalIcon.style.color = "var(--pink)";
    } else {
      modalIcon.classList.remove("fa-solid");
      modalIcon.classList.add("fa-regular");
      modalIcon.style.color = "var(--pink)"; // Или белый, как решишь
    }
  }
}

// ---------------------------------------------------------
// ПРОФИЛЬ
// ---------------------------------------------------------
function switchProfileTab(tab) {
  currentProfileTab = tab;
  document
    .getElementById("p-tab-active")
    .classList.toggle("active", tab === "active");
  document
    .getElementById("p-tab-sold")
    .classList.toggle("active", tab === "sold");
  renderProfileAds();
}

function renderProfileAds() {
  const grid = document.getElementById("my-ads-grid");
  const myId = tg.initDataUnsafe?.user?.id || 0;

  let myAds;
  if (currentProfileTab === "active") {
    myAds = ads.filter((a) => a.userId === myId && a.status === "active");
  } else {
    myAds = ads.filter(
      (a) =>
        a.userId === myId && (a.status === "sold" || a.status === "deleted")
    );
  }

  grid.innerHTML = myAds.length
    ? ""
    : '<p style="text-align:center; padding:50px; color:gray;">Тут пока пусто</p>';

  myAds.forEach((ad) => {
    let cover = Array.isArray(ad.img) ? ad.img[0] : ad.img;
    const catName = catMap[ad.cat] || "Товар";

    let imgBlock = "";
    if (ad.status === "deleted") {
      imgBlock = `<div class="deleted-placeholder" style="height:100px; font-size:10px; padding:10px;">Удалено (Фото скрыто)</div>`;
    } else {
      const badge =
        ad.status === "sold" ? `<div class="sold-badge">ПРОДАНО</div>` : "";
      imgBlock = `${badge}<img src="${cover}" style="height:140px; width:100%; object-fit:cover;">`;
    }

    let buttonsHTML = "";
    if (ad.status === "active") {
      buttonsHTML = `
        <div class="profile-actions">
            <button class="btn-mini btn-edit" onclick="tg.showAlert('Редактирование пока недоступно')">Изменить</button>
            <button class="btn-mini btn-sold-action" onclick="showActionPopup(${ad.id})">Продано</button>
        </div>`;
    } else {
      const statusText = ad.status === "sold" ? "Продано" : "Удалено";
      const color = ad.status === "sold" ? "var(--pink)" : "gray";
      buttonsHTML = `<div style="text-align:center; font-size:12px; color:${color}; margin-top:10px; font-weight:bold;">Статус: ${statusText}</div>`;
    }

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
        ${imgBlock}
        <div class="card-body">
            <span class="card-price">${ad.price} KGS</span>
            <div class="card-cat-row">
                <span class="card-category">${catName}</span> ${ad.title}
            </div>
            ${buttonsHTML}
        </div>`;
    grid.appendChild(card);
  });
}

function showActionPopup(id) {
  tg.showPopup(
    {
      title: "Завершение сделки",
      message: "Выберите действие:",
      buttons: [
        { id: "sold", type: "default", text: "Продано (Сохранить фото)" },
        { id: "delete", type: "destructive", text: "Удалить (Скрыть фото)" },
        { id: "cancel", type: "cancel" },
      ],
    },
    (btnId) => {
      if (btnId === "sold") changeStatus(id, "sold");
      if (btnId === "delete") changeStatus(id, "deleted");
    }
  );
}

function changeStatus(id, newStatus) {
  const ad = ads.find((a) => a.id === id);
  if (ad) {
    ad.status = newStatus;
    localStorage.setItem("gifts_final_v12", JSON.stringify(ads));

    if (newStatus === "sold") tg.showAlert("Товар продан. Контакты скрыты.");
    if (newStatus === "deleted")
      tg.showAlert("Удалено. Фото и контакты скрыты.");

    renderProfileAds();
    renderFeed();
  }
}

// ---------------------------------------------------------
// НАВИГАЦИЯ
// ---------------------------------------------------------
function showPage(p) {
  document.querySelectorAll(".page").forEach((s) => s.classList.add("hidden"));
  document.getElementById(`page-${p}`).classList.remove("hidden");
  document
    .querySelectorAll(".nav-item")
    .forEach((i) => i.classList.remove("active"));
  const navBtn = document.getElementById(`n-${p}`);
  if (navBtn) navBtn.classList.add("active");
  if (p === "home") renderFeed();
  if (p === "favs") renderFavs();
  if (p === "profile") renderProfileAds();
}

function switchFavTab(tab) {
  currentFavTab = tab;
  document
    .getElementById("f-tab-ads")
    .classList.toggle("active", tab === "ads");
  document
    .getElementById("f-tab-searches")
    .classList.toggle("active", tab === "searches");
  renderFavs();
}

function renderFavs() {
  const container = document.getElementById("favs-content-area");
  if (currentFavTab === "searches")
    return (container.innerHTML = `<div class="empty-searches-view"><h3>Нет подписок</h3></div>`);

  const data = ads.filter((a) => favs.includes(a.id));
  if (data.length === 0)
    return (container.innerHTML = `<div style="text-align:center; padding:50px;">Пусто</div>`);

  container.innerHTML =
    `<div class="listings-grid">` +
    data
      .map((a) => {
        let cover = Array.isArray(a.img) ? a.img[0] : a.img;
        let imgHTML =
          a.status === "deleted"
            ? `<div class="deleted-placeholder" style="height:130px;"><span class="deleted-text">Удалено</span></div>`
            : `<img src="${cover}">`;

        return `<div class="card" onclick='openProduct(${JSON.stringify(a)})'>
              ${imgHTML}
              <div class="card-body">
                <span class="card-price">${a.price} KGS</span>
              </div>
            </div>`;
      })
      .join("") +
    `</div>`;
}

function clearFavs() {
  favs = [];
  localStorage.setItem("favs_final_v12", JSON.stringify(favs));
  renderFavs();
}
function filterByCat(c, el) {
  curCat = c;
  document
    .querySelectorAll(".cat-chip")
    .forEach((i) => i.classList.remove("active"));
  el.classList.add("active");
  renderFeed();
}
