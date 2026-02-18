const tg = window.Telegram.WebApp;
tg.expand();

// ---------------------------------------------------------
// НАСТРОЙКИ
// ---------------------------------------------------------
// Твой ключ от ImgBB
const IMGBB_KEY = "94943ea3f656b4bc95e25c86d2880b94";

const BOT_TOKEN = "8399814024:AAEla8xBVk_9deHydJV0hrc5QYDyXAFpZ8k";
const ADMIN_ID = "1615492914";

// ---------------------------------------------------------
// ДАННЫЕ
// ---------------------------------------------------------
let ads = JSON.parse(localStorage.getItem("gifts_final_v12")) || [];
let favs = JSON.parse(localStorage.getItem("favs_final_v12")) || [];
let curCat = "Все";
let currentFavTab = "ads";
let currentProfileTab = "active";

// Массив для хранения выбранных файлов (до 5 штук)
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
    const tabs = document.getElementById("home-tabs-wrapper");
    const error = document.getElementById("search-error");
    if (results.length === 0 && query !== "") {
      tabs.classList.add("hidden");
      error.classList.remove("hidden");
      renderFeed([]);
    } else {
      tabs.classList.remove("hidden");
      error.classList.add("hidden");
      renderFeed(query === "" ? ads : results);
    }
    e.target.blur();
  }
}

function renderFeed(data = ads) {
  const grid = document.getElementById("home-grid");
  if (!grid) return;
  grid.innerHTML = "";
  let filtered = curCat === "Все" ? data : data.filter((a) => a.cat === curCat);

  // Новые сверху
  filtered.sort((a, b) => b.id - a.id);

  filtered.forEach((ad) => {
    // Проверка совместимости: если старое объявление (строка) или новое (массив)
    // Берем всегда первую картинку для обложки в ленте
    let coverImg = Array.isArray(ad.img) ? ad.img[0] : ad.img;

    const card = document.createElement("div");
    card.className = "card";
    card.onclick = () => openProduct(ad);
    card.innerHTML = `
      <img src="${coverImg}" loading="lazy">
      <div class="card-body">
        <span class="card-price">${ad.price} KGS</span>
        <span class="card-title">${ad.title}</span>
        <span class="card-city">${ad.city}</span>
      </div>`;
    grid.appendChild(card);
  });
}

// ---------------------------------------------------------
// ЗАГРУЗКА ФОТО (МНОГО ФОТО)
// ---------------------------------------------------------
function handleFileSelect(input) {
  const files = Array.from(input.files);
  if (files.length > 0) {
    // Ограничение: максимум 5 фото
    selectedFiles = files.slice(0, 5);

    const previewBox = document.getElementById("preview-box");
    const gallery = document.getElementById("gallery-preview");
    const countLabel = document.getElementById("photo-count");

    gallery.innerHTML = ""; // Очищаем старые превью
    previewBox.classList.remove("hidden");
    countLabel.innerText = selectedFiles.length;
    document.getElementById(
      "file-label"
    ).innerText = `Выбрано: ${selectedFiles.length}`;

    // Генерируем превью для каждого фото
    selectedFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = document.createElement("img");
        img.src = e.target.result;
        // Стили для миниатюр заданы в CSS (.upload-gallery img)
        gallery.appendChild(img);
      };
      reader.readAsDataURL(file);
    });
  }
}

// Загрузка одного файла на ImgBB
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
    console.error(error);
    return null;
  }
}

// ---------------------------------------------------------
// ПУБЛИКАЦИЯ
// ---------------------------------------------------------
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
  if (selectedFiles.length === 0)
    return tg.showAlert("Выберите хотя бы 1 фото!");

  tg.MainButton.showProgress();
  tg.MainButton.text = "Загрузка фото (ждите)...";
  tg.MainButton.show();

  // 1. Загружаем ВСЕ фото по очереди на сервер
  let uploadedUrls = [];
  for (let file of selectedFiles) {
    const url = await uploadToImgBB(file);
    if (url) uploadedUrls.push(url);
  }

  if (uploadedUrls.length === 0) {
    tg.MainButton.hideProgress();
    tg.MainButton.hide();
    return tg.showAlert("Ошибка загрузки фото. Попробуйте еще раз.");
  }

  // 2. Создаем объявление (теперь img - это МАССИВ ссылок)
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
    img: uploadedUrls, // <--- МАССИВ ['url1', 'url2']
    status: "active",
    userId: tg.initDataUnsafe?.user?.id || 0,
  };

  // 3. Отправляем боту (Альбом!)
  await sendToBot(ad);

  // 4. Сохраняем локально
  ads.unshift(ad);
  localStorage.setItem("gifts_final_v12", JSON.stringify(ads));

  // Очистка формы
  document.getElementById("in-title").value = "";
  document.getElementById("in-price").value = "";
  document.getElementById("in-desc").value = "";
  document.getElementById("in-address").value = "";
  document.getElementById("in-wa").value = "";
  // Не стираем город и ник, пользователю удобнее

  selectedFiles = [];
  document.getElementById("gallery-preview").innerHTML = "";
  document.getElementById("preview-box").classList.add("hidden");
  document.getElementById("file-label").innerText = "Нажмите для выбора фото";

  tg.MainButton.hideProgress();
  tg.MainButton.hide();
  tg.showAlert("Объявление опубликовано!");
  showPage("home");
}

// Отправка в бот (АЛЬБОМ + КНОПКИ)
async function sendToBot(ad) {
  // Формируем текст
  const text = `🚀 НОВАЯ ЗАЯВКА\n📦: ${ad.title}\n💰: ${ad.price} KGS\n📍: ${ad.city}\n🏠: ${ad.address}\n👤: @${ad.tgNick}\n📱: ${ad.phone}`;

  // URL API Телеграма
  const urlGroup = `https://api.telegram.org/bot${BOT_TOKEN}/sendMediaGroup`;
  const urlMessage = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

  try {
    // 1. Если фоток несколько, формируем АЛЬБОМ
    let mediaGroup = ad.img.map((imgUrl, index) => {
      return {
        type: "photo",
        media: imgUrl,
        // Подпись добавляем только к первому фото (ограничение Телеграма)
        caption: index === 0 ? text : "",
      };
    });

    // Отправляем альбом
    await fetch(urlGroup, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: ADMIN_ID,
        media: mediaGroup,
      }),
    });

    // 2. Отправляем кнопки отдельным сообщением (к альбому их прикрепить нельзя)
    await fetch(urlMessage, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: ADMIN_ID,
        text: `Управление объявлением "${ad.title}" 👇`,
        reply_markup: {
          inline_keyboard: [
            [
              { text: "Одобрить ✅", callback_data: `ok_${ad.id}` },
              { text: "Удалить ❌", callback_data: `no_${ad.id}` },
            ],
          ],
        },
      }),
    });
  } catch (e) {
    console.error("Ошибка отправки боту:", e);
  }
}

// ---------------------------------------------------------
// ПРОДУКТ (СЛАЙДЕР ГАЛЕРЕИ)
// ---------------------------------------------------------
function openProduct(ad) {
  const modal = document.getElementById("product-modal");
  const favIconArea = document.getElementById("modal-fav-icon");
  const isFav = favs.includes(ad.id);

  // Совместимость: если ad.img это строка (старое), превращаем в массив
  const images = Array.isArray(ad.img) ? ad.img : [ad.img];

  favIconArea.innerHTML = `<i class="${
    isFav ? "fa-solid" : "fa-regular"
  } fa-heart" style="color:var(--pink)" onclick="toggleFav(${ad.id})"></i>`;

  // Генерируем HTML слайдера
  let imagesHtml = images.map((src) => `<img src="${src}">`).join("");
  // Точки рисуем только если фото больше 1
  let dotsHtml =
    images.length > 1
      ? images
          .map((_, i) => `<div class="dot ${i === 0 ? "active" : ""}"></div>`)
          .join("")
      : "";

  document.getElementById("pv-content").innerHTML = `
        <div class="product-gallery">
            ${imagesHtml}
        </div>
        ${
          images.length > 1 ? `<div class="gallery-dots">${dotsHtml}</div>` : ""
        }

        <div class="pd-body">
            <div class="pd-price">${ad.price} KGS</div>
            <div class="pd-title">${ad.title}</div>
            
            <a href="https://t.me/${ad.tgNick.replace(
              "@",
              ""
            )}" target="_blank" class="pd-btn-write">Написать продавцу</a>

            <p style="color:#eee; font-size:16px; line-height:1.6; margin-bottom:20px;">${
              ad.desc
            }</p>
            
            <div class="contact-info-block">
                <div class="contact-label">📍 ГОРОД</div>
                <div class="contact-value">${ad.city}</div>
            </div>
             <div class="contact-info-block">
                <div class="contact-label">🏠 АДРЕС</div>
                <div class="contact-value">${ad.address || "Не указан"}</div>
            </div>
            <div class="contact-info-block">
                <div class="contact-label">📱 НОМЕР ТЕЛЕФОНА</div>
                <div class="contact-value">${ad.phone}</div>
            </div>
        </div>
    `;
  modal.classList.remove("hidden");

  // Добавляем логику для скролла слайдера (чтобы обновлять точки)
  const galleryDiv = document.querySelector(".product-gallery");
  if (galleryDiv && images.length > 1) {
    galleryDiv.addEventListener("scroll", () => {
      const scrollLeft = galleryDiv.scrollLeft;
      const width = galleryDiv.offsetWidth;
      const index = Math.round(scrollLeft / width);
      document.querySelectorAll(".dot").forEach((d, i) => {
        d.classList.toggle("active", i === index);
      });
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
  const icon = document.querySelector("#modal-fav-icon i");
  if (icon) {
    icon.classList.toggle("fa-solid");
    icon.classList.toggle("fa-regular");
  }
}

// ---------------------------------------------------------
// НАВИГАЦИЯ И ОСТАЛЬНОЕ
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
  if (currentFavTab === "searches") {
    container.innerHTML = `<div class="empty-searches-view"><h3>Пусто</h3></div>`;
    return;
  }
  const data = ads.filter((a) => favs.includes(a.id));
  container.innerHTML =
    `<div class="listings-grid">` +
    data
      .map((a) => {
        let cover = Array.isArray(a.img) ? a.img[0] : a.img;
        return `<div class="card" onclick='openProduct(${JSON.stringify(
          a
        )})'><img src="${cover}"><div class="card-body"><b>${
          a.price
        } KGS</b></div></div>`;
      })
      .join("") +
    `</div>`;
}

function clearFavs() {
  favs = [];
  localStorage.setItem("favs_final_v12", JSON.stringify(favs));
  renderFavs();
}

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
  const myAds = ads.filter(
    (a) =>
      a.userId === myId &&
      (currentProfileTab === "active"
        ? a.status === "active"
        : a.status === "sold")
  );
  grid.innerHTML = myAds.length
    ? ""
    : '<p style="text-align:center; padding:50px; color:gray;">Ничего не найдено</p>';
  myAds.forEach((ad) => {
    let cover = Array.isArray(ad.img) ? ad.img[0] : ad.img;
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `<img src="${cover}"><div class="card-body"><b>${
      ad.price
    } KGS</b><br><button onclick="moveStatus(${
      ad.id
    })" style="color:var(--pink); background:none; border:none; padding:5px 0;">${
      currentProfileTab === "active" ? "В архив" : "Удалить"
    }</button></div>`;
    grid.appendChild(card);
  });
}

function moveStatus(id) {
  const ad = ads.find((a) => a.id === id);
  if (currentProfileTab === "active") ad.status = "sold";
  else ads = ads.filter((a) => a.id !== id);
  localStorage.setItem("gifts_final_v12", JSON.stringify(ads));
  renderProfileAds();
}

function filterByCat(c, el) {
  curCat = c;
  document
    .querySelectorAll(".cat-chip")
    .forEach((i) => i.classList.remove("active"));
  el.classList.add("active");
  renderFeed();
}
