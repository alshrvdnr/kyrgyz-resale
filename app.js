const tg = window.Telegram.WebApp;
tg.expand();
tg.headerColor = "#000000";

const mockData = [
  {
    id: 1,
    title: "iPhone 15 Pro Max",
    price: "95 000",
    cat: "Электроника",
    city: "Бишкек",
    isVip: true,
    img: "https://picsum.photos/seed/iphone/300/300",
  },
  {
    id: 2,
    title: "Горный велосипед",
    price: "15 500",
    cat: "Спорт",
    city: "Ош",
    isVip: false,
    img: "https://picsum.photos/seed/bike/300/300",
  },
  {
    id: 3,
    title: "Золотое кольцо 585",
    price: "22 000",
    cat: "Ювелирка",
    city: "Бишкек",
    isVip: true,
    img: "https://picsum.photos/seed/ring/300/300",
  },
  {
    id: 4,
    title: "Букет 101 роза",
    price: "5 000",
    cat: "Цветы",
    city: "Токмок",
    isVip: false,
    img: "https://picsum.photos/seed/flowers/300/300",
  },
];

const categories = [
  { name: "Цветы", icon: "🌹", count: 120 },
  { name: "Ювелирка", icon: "💎", count: 85 },
  { name: "Подарки", icon: "🎁", count: 240 },
  { name: "Сертификаты", icon: "🎟️", count: 45 },
];

document.addEventListener("DOMContentLoaded", () => {
  renderCategories();
  renderListings(mockData);
});

function renderCategories() {
  const list = document.getElementById("categories-list");
  list.innerHTML = categories
    .map(
      (c) => `
        <div class="cat-card">
            <div class="cat-img" style="font-size: 30px;">${c.icon}</div>
            <span class="cat-name">${c.name}</span>
            <span class="cat-count">${c.count}</span>
        </div>
    `
    )
    .join("");
}

function renderListings(data) {
  const grid = document.getElementById("listings-grid");
  grid.innerHTML = data
    .map(
      (item) => `
        <div class="card" onclick="openProduct(${item.id})">
            <div class="card-img-container">
                ${
                  item.isVip
                    ? '<div class="badge-vip"><i class="fa fa-crown"></i> VIP</div>'
                    : ""
                }
                <img src="${item.img}" class="card-img">
            </div>
            <div class="card-content">
                <span class="price">${item.price} KGS</span>
                <span class="title">${item.title}</span>
                <span class="cat-desc">${item.cat}</span>
                <div class="card-actions">
                    <i class="fa fa-paper-plane"></i>
                    <i class="far fa-heart"></i>
                </div>
            </div>
        </div>
    `
    )
    .join("");
}

function switchTab(type, el) {
  document
    .querySelectorAll(".tab-item")
    .forEach((t) => t.classList.remove("active"));
  el.classList.add("active");
  // Логика фильтрации
  const filtered = type === "rec" ? mockData.filter((i) => i.isVip) : mockData;
  renderListings(filtered);
}

function showPage(page) {
  tg.HapticFeedback.impactOccurred("light");
  console.log("Navigating to:", page);
  // Здесь будет логика переключения страниц
}

function openFilter() {
  document.getElementById("filter-sheet").classList.remove("hidden");
}

function closeFilter() {
  document.getElementById("filter-sheet").classList.add("hidden");
}
