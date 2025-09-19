window.onload = function () {
  const loader = document.getElementById("loader");
  const dataSelect = document.getElementById("data-select");

  function showLoader() {
    loader.style.display = "block";
  }

  function hideLoader() {
    loader.style.display = "none";
  }

  const map = L.map("map", {
    maxBounds: L.latLngBounds(L.latLng(-90, -180), L.latLng(90, 180)),
    maxBoundsViscosity: 1.0,
    minZoom: 2,
    attributionControl: false,
  }).setView([20, 0], 2);

  map.zoomControl.setPosition("topright");

  let gridLayer;
  let geojsonData;
  let isDetailedView = false;
  let legend = L.control({ position: "bottomleft" });
  let currentDatasetKey = "nitrogen";
  const loadedDataCache = {};

  const datasets = {
    nitrogen: {
      filePath: "simplified_global_data.geojson",
      property: "nitrogen_current",
      legendTitle: "氮肥施用量 (t/year)",
      popupTemplate: (val) => `<b>氮肥施用量:</b> ${val.toFixed(2)} t/year`,
      grades: [50, 100, 200, 500, 1000],
      legendGrades: [0, 50, 100, 200, 500, 1000],
      colorPalette: {
        c1: "#045275",
        c2: "#08519c",
        c3: "#2171b5",
        c4: "#6baed6",
        c5: "#bdd7e7",
        c6: "#eff3ff",
      },
    },
    biomass: {
      filePath: "./implified_bio_data.geojson",
      property: "capacity",
      legendTitle: "潜在生物质资源 (kt/year)",
      popupTemplate: (val) => `<b>潜在生物质资源:</b> ${val.toFixed(2)} kt/year`,
      grades: [100, 200, 500, 1000, 2000],
      legendGrades: [0, 100, 200, 500, 1000, 2000],
      colorPalette: {
        c1: "#005a32",
        c2: "#238b45",
        c3: "#41ab5d",
        c4: "#74c476",
        c5: "#a1d99b",
        c6: "#edf8e9",
      },
    },
  };

  // 确保 nitrogenInfo 定义在 switchDataset 函数的外部
  const nitrogenInfo = {
    baseName: "simplified_氮肥施用量",
    count: 20,
  };

  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  }).addTo(map);

  function getColor(d, datasetKey) {
    const { grades, colorPalette } = datasets[datasetKey];
    return d > grades[4]
      ? colorPalette.c1
      : d > grades[3]
      ? colorPalette.c2
      : d > grades[2]
      ? colorPalette.c3
      : d > grades[1]
      ? colorPalette.c4
      : d > grades[0]
      ? colorPalette.c5
      : colorPalette.c6;
  }

  function updateLegend(datasetKey) {
    if (legend && map) {
      map.removeControl(legend);
    }

    const config = datasets[datasetKey];
    legend.onAdd = function (map) {
      const div = L.DomUtil.create("div", "info legend");
      div.innerHTML += `<b>${config.legendTitle}</b>`;
      for (let i = 0; i < config.legendGrades.length; i++) {
        const from = config.legendGrades[i];
        const to = config.legendGrades[i + 1];
        div.innerHTML += `<br><i style="background:${getColor(
          from + 1,
          datasetKey
        )}"></i> ${from}${to ? `&ndash;${to}` : "+"}`;
      }
      return div;
    };
    legend.addTo(map);
  }

  function createGridLayer(isDetailed, datasetKey) {
    if (gridLayer) {
      gridLayer.remove();
      gridLayer = null;
    }

    const config = datasets[datasetKey];

    gridLayer = L.glify.shapes({
      map: map,
      data: geojsonData,
      color: (index, feature) => {
        const value = feature.properties[config.property] || 0;
        const hex = getColor(value, datasetKey);
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result
          ? {
              r: parseInt(result[1], 16) / 255,
              g: parseInt(result[2], 16) / 255,
              b: parseInt(result[3], 16) / 255,
              a: 1.0,
            }
          : { r: 0, g: 0, b: 0, a: 1 };
      },
      click: (e, feature) => {
        const val = feature.properties[config.property] || 0;
        L.popup()
          .setLatLng(e.latlng)
          .setContent(config.popupTemplate(val))
          .openOn(map);
      },

      border: false,
      borderColor: null,
      borderOpacity: 0,
    });
  }

  function switchDataset(newDatasetKey) {
    currentDatasetKey = newDatasetKey;
    const datasetConfig = datasets[currentDatasetKey];

    const renderNewData = () => {
      requestAnimationFrame(() => {
        isDetailedView = map.getZoom() >= 5;
        createGridLayer(isDetailedView, currentDatasetKey);
        updateLegend(currentDatasetKey);
        hideLoader();
      });
    };

    if (loadedDataCache[currentDatasetKey]) {
      geojsonData = loadedDataCache[currentDatasetKey];
      renderNewData();
      return;
    }

    showLoader();

    if (newDatasetKey === 'nitrogen') {
      const filePaths = [];
      for (let i = 1; i <= nitrogenInfo.count; i++) {
        filePaths.push(`./${nitrogenInfo.baseName}_part_${i}.geojson`);
      }
      
      Promise.all(filePaths.map(path => fetch(path).then(res => res.json())))
        .then(datasets => {
          const combinedData = {
            type: "FeatureCollection",
            name: datasets[0].name,
            crs: datasets[0].crs,
            features: []
          };
          datasets.forEach(ds => {
            combinedData.features = combinedData.features.concat(ds.features);
          });
          loadedDataCache[currentDatasetKey] = combinedData;
          geojsonData = combinedData;
          renderNewData();
        })
        .catch(error => {
          console.error("氮肥数据加载或合并时出错:", error);
          alert("氮肥数据加载或合并失败！请检查控制台中的错误信息。");
        })
        .finally(() => {
          hideLoader();
        });
    } else if (newDatasetKey === 'biomass') {
      // 生物质：加载单个文件
      fetch(datasetConfig.filePath)
        .then((response) => {
          if (!response.ok)
            throw new Error(`HTTP error! status: ${response.status}`);
          return response.json();
        })
        .then((data) => {
          if (!data || !data.features || !Array.isArray(data.features)) {
            console.error("无效的 GeoJSON 格式: 未找到 'features' 数组。");
            alert("数据处理失败！请检查控制台中的错误信息。");
            hideLoader();
            return;
          }
          loadedDataCache[currentDatasetKey] = data;
          geojsonData = data;
          renderNewData();
        })
        .catch((error) => {
          console.error(`加载或处理 ${datasetConfig.filePath} 时出错:`, error);
          alert("数据加载或处理失败！请检查控制台中的错误信息。");
          hideLoader();
        });
    }
  }

  dataSelect.addEventListener("change", (e) => switchDataset(e.target.value));

  switchDataset("nitrogen");
};