const map = L.map("map", {
  maxZoom: 18,
  minZoom: 2, 
  maxBounds: L.latLngBounds(L.latLng(-90, -180), L.latLng(90, 180)),
  maxBoundsViscosity: 1.0,
  zoomControl: false,
  attributionControl: false,
}).setView([35.8617, 104.1954], 5);

L.control
  .zoom({
    position: "topright",
  })
  .addTo(map);

L.control
  .scale({
    position: "bottomleft",
    metric: true,
    imperial: false,
  })
  .addTo(map);

const tiandituKey = "3767d31e6dfc63797664e73af20dbbd7";
L.tileLayer(
  `https://t0.tianditu.gov.cn/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILECOL={x}&TILEROW={y}&TILEMATRIX={z}&tk=${tiandituKey}`,
  { attribution: "" }
).addTo(map);
L.tileLayer(
  `https://t0.tianditu.gov.cn/cva_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cva&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILECOL={x}&TILEROW={y}&TILEMATRIX={z}&tk=${tiandituKey}`,
  { attribution: "" }
).addTo(map);

const departmentSelect = document.getElementById("department-select");
const typeFiltersContainer = document.getElementById("type-filters");
const totalCountEl = document.getElementById("total-count");
const legendUnitEl = document.getElementById("legend-unit");
const filterTitleEl = document.getElementById("filter-title");
let dataLayer = L.layerGroup().addTo(map);

const typeColors = {
  // 电力部门
  太阳能: "#f9951cff", 
  风能: "#56a0d3", 
  煤电: "#7588e166", 
  生物质能: "#228b22", 
  油气: "#f5714cff",
  核能: "#fb74bc66",
  水力: "#f5d31066",
  // 其他部门
  粗钢: "#82A683",
  水泥: "#DEB887", 
  合成氨: "#fbbe2481",
  合成甲醇: "#f98716a2",
  "合成氨&合成甲醇":"#7775e166", 
};

const departmentUnits = {
  power: "MW",
  cement: "百万吨/年",
  steel: "千吨/年",
  chemical: "万吨/年", 
};


const dataLoaders = {
  power: () => import("./powerData.js").then((m) => m.powerData),
  steel: () => import("./steelData.js").then((m) => m.steelData),
  cement: () => import("./cementData.js").then((m) => m.cementData),
  chemical: () => import("./chemicalData.js").then((m) => m.chemicalData),
};
const loadedDataCache = {};
let currentDepartmentData = [];

function renderMap() {
  dataLayer.clearLayers();
  const selectedDepartment = departmentSelect.value;
  const departmentData = currentDepartmentData;
  const checkedTypes = Array.from(
    document.querySelectorAll("#type-filters .type-checkbox:checked")
  ).map((input) => input.value);

  if (!departmentData || departmentData.length === 0) {
    totalCountEl.textContent = 0;
    return;
  }

  const visibleData = departmentData.filter((point) =>
    checkedTypes.includes(point.type)
  );
  totalCountEl.textContent = visibleData.length;

  const currentUnit = departmentUnits[selectedDepartment] || "";

  visibleData.forEach((point) => {
    if (
      point.coords &&
      Array.isArray(point.coords) &&
      point.coords.length === 2
    ) {
      const color = typeColors[point.type] || "#0578e4ff";
      let radiusMultiplier = 30;

      if (selectedDepartment === "cement") {
        radiusMultiplier = 4000;
      } else if (selectedDepartment === "steel") {
        radiusMultiplier = 5;
      } else if (selectedDepartment === "chemical") {
        radiusMultiplier = 400;
      }

      const radius = point.capacity * radiusMultiplier;

      const wgsCoords = point.coords;
      const gcjCoordsArray = coordtransform.wgs84togcj02(
        wgsCoords[1],
        wgsCoords[0]
      );
      const leafletCoords = [gcjCoordsArray[1], gcjCoordsArray[0]];

      const circle = L.circle(leafletCoords, {
        radius: radius,
        color: color,
        weight: 1.5,
        fillColor: color,
        fillOpacity: 0.5,
      }).addTo(dataLayer);

      let popupContent = "";
      
      if (selectedDepartment === "chemical") {        
if (point.id === "single") {
          popupContent = `
            <div class="info-popup chemical-popup">
              <div class="popup-header">
                <div class="title-container">
                  <span class="title-dot" style="background-color: ${color};"></span>
                  <span class="title-name">${point.name}</span>
                </div>
              </div>
              <div class="popup-body-grid">
                <div class="popup-grid-item">
                  <span class="popup-label">省市:</span>
                  <span class="popup-value">${point.province} ${point.city}</span>
                </div>
                <div class="popup-grid-item">
                  <span class="popup-label">成立时间:</span>
                  <span class="popup-value">${point.established_date}</span>
                </div>
                <div class="popup-grid-item">
                  <span class="popup-label">类型:</span>
                  <span class="popup-value">${point.type}</span>
                </div>
                <div class="popup-grid-item">
                  <span class="popup-label">原料:</span>
                  <span class="popup-value">${point.product}</span>
                </div>
                <div class="popup-grid-item">
                  <span class="popup-label">产能:</span>
                  <span class="popup-value">${point.capacity} ${currentUnit}</span>
                </div>
              </div>
            </div>
          `;
        } else if (point.id === "multiple") {
          let typesContent = "";
          if (point.types && Array.isArray(point.types)) {
            typesContent = point.types
              .map(
                (typeItem) => `
                  <div class="type-section">
                    <div class="type-name">${typeItem.type_name}:</div>
                    <ul class="products-list">
                      ${typeItem.products
                        .map(
                          (product) => `
                            <li>
                              <span class="product-name">${product.name}</span> — <span class="sub-capacity">${product.sub_capacity} ${currentUnit}</span>
                            </li>
                          `
                        )
                        .join("")}
                    </ul>
                  </div>
                `
              )
              .join("<hr>"); 
          }

          popupContent = `
            <div class="info-popup chemical-popup">
              <div class="popup-header">
                <div class="title-container">
                  <span class="title-dot" style="background-color: ${color};"></span>
                  <span class="title-name">${point.name}</span>
                </div>
              </div>
              <div class="popup-body-grid">
                <div class="popup-grid-item">
                  <span class="popup-label">省市:</span>
                  <span class="popup-value">${point.province} ${point.city}</span>
                </div>
                <div class="popup-grid-item">
                  <span class="popup-label">成立时间:</span>
                  <span class="popup-value">${point.established_date}</span>
                </div>
                <div class="popup-grid-item">
                  <span class="popup-label">总产能:</span>
                  <span class="popup-value">${point.capacity} ${currentUnit}</span>
                </div>
              </div>
                <hr>
              <div class="popup-details">
                ${typesContent}
              </div>
            </div>
          `;
        }
      } else {
        
        popupContent = `
          <div class="info-popup">
            <div class="popup-header">
              <div class="title-container">
                <span class="title-dot" style="background-color: ${color};"></span>
                <span class="title-name">${point.name}</span>
              </div>
            </div>
            <div class="popup-body">
              <span class="popup-label">产能:</span>
              <span class="popup-value">${point.capacity}</span>
              <span class="popup-unit">${currentUnit}</span>
            </div>
          </div>
        `;
      }

      
      circle.bindPopup(popupContent, {
        className: "info-popup-container",
        closeButton: false,
      });

      
      circle.on("mouseover", function (e) {
        this.openPopup();
      });
      circle.on("mouseout", function (e) {
        this.closePopup();
      });
    } else {
      console.warn("跳过一个无效坐标的数据点:", point);
    }
  });
}

async function updateFiltersAndEvents() {
  const selectedDepartment = departmentSelect.value;
  let departmentData;

  
  if (loadedDataCache[selectedDepartment]) {
    departmentData = loadedDataCache[selectedDepartment];
  } else {
    
    try {
      departmentData = await dataLoaders[selectedDepartment]();
      loadedDataCache[selectedDepartment] = departmentData;
      console.log(`成功加载并缓存 ${selectedDepartment} 部门数据.`);
    } catch (error) {
      console.error(`加载 ${selectedDepartment} 部门数据失败:`, error);
      departmentData = [];
    }
  }

  currentDepartmentData = departmentData;

  typeFiltersContainer.innerHTML = "";
  if (!departmentData || departmentData.length === 0) {
    return;
  }

  filterTitleEl.textContent =
    selectedDepartment === "power" ? "燃料类型" : "类型筛选";
  const selectAllHTML = `<div class="filter-item select-all-container"><label><input type="checkbox" id="select-all" checked>全选</label></div>`;
  typeFiltersContainer.innerHTML = selectAllHTML;
  const types = [...new Set(departmentData.map((p) => p.type))];
  types.forEach((type) => {
    const color = typeColors[type] || "#0578e4ff";
    const filterItem = document.createElement("div");
    filterItem.className = "filter-item";
    filterItem.innerHTML = `<label><input type="checkbox" class="type-checkbox" value="${type}" checked><span class="color-box" style="background-color: ${color};"></span>${type}</label>`;
    typeFiltersContainer.appendChild(filterItem);
  });

  const selectAllCheckbox = document.getElementById("select-all");
  const typeCheckboxes = document.querySelectorAll(".type-checkbox");
  selectAllCheckbox.addEventListener("change", () => {
    typeCheckboxes.forEach((checkbox) => {
      checkbox.checked = selectAllCheckbox.checked;
    });
    renderMap();
  });
  typeCheckboxes.forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      selectAllCheckbox.checked = Array.from(typeCheckboxes).every(
        (cb) => cb.checked
      );
      renderMap();
    });
  });

  
  renderMap();
}

departmentSelect.addEventListener("change", () => {
  updateFiltersAndEvents();
});

function initialLoad() {
  updateFiltersAndEvents();
}
initialLoad();
