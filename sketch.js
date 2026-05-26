let rainData = null;
let cwaData = null;
let mergedData = [];
let dataMerged = false;
let dataError = false;
let rainDrops = [];
let dataTime = "";

// Mappa.js 變數
let mappa;
let myMap;
let canvas;

function setup() {
  // 採用全螢幕畫布
  canvas = createCanvas(windowWidth, windowHeight);
  
  // 初始化雨滴 (用於天氣動畫)
  for (let i = 0; i < 100; i++) {
    rainDrops.push({ x: random(-40, 40), y: random(-20, 50), speed: random(3, 6) });
  }

  // 初始化 Mappa (使用開源的 Leaflet 與 OpenStreetMap)
  mappa = new Mappa('Leaflet');
  let options = {
    lat: 25.0330,  // 預設中心點 (台北市)
    lng: 121.5654,
    zoom: 11,
    style: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
  };
  myMap = mappa.tileMap(options);
  myMap.overlay(canvas);
  
  // 設定文字對齊與大小
  textAlign(CENTER, CENTER);
  textSize(16);

  // 台北市 OpenData 雨量 API 網址
  let apiUrl = 'https://wic.gov.taipei/OpenData/API/Rain/Get?stationNo=&loginId=open_rain&dataKey=85452C1D';
  
  // 更改代理伺服器 (AllOrigins 有時不穩定，改用 corsproxy.io 解決 CORS 問題)
  let proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(apiUrl);

  // 使用 p5.js 的 loadJSON 取得雨量
  loadJSON(proxyUrl, function(data) {
    rainData = data;
  }, function(err) {
    dataError = true;
  });

  // 取得氣象署經緯度資料 (CWA API 支援 CORS，可直接呼叫)
  let cwaApiUrl = 'https://opendata.cwa.gov.tw/api/v1/rest/datastore/O-A0002-001?Authorization=rdec-key-123-45678-011121314';
  loadJSON(cwaApiUrl, function(data) {
    cwaData = data;
  }, function(err) {
    dataError = true;
  });
}

function draw() {
  clear(); // 清除畫布背景，讓底部的地圖可以顯示出來
  
  // 為了在地圖上維持文字可讀性，加上黑色邊框與白色字體
  stroke(0);
  strokeWeight(3);
  fill(255);
  
  if (dataError) {
    text("載入資料失敗，請確認網路或代理伺服器狀態。", width / 2, height / 2);
    return;
  }
  
  if (!rainData || !cwaData) {
    text("即時雨量與圖資載入中...", width / 2, height / 2);
    return;
  }
  
  // 若尚未合併資料，先進行資料比對
  if (!dataMerged) {
    mergeData();
  }

  let panelWidth = 280;

  // 顯示標題
  textAlign(CENTER, CENTER);
  textSize(24);
  fill(100, 200, 255);
  stroke(0);
  strokeWeight(3);
  // 將標題推移到面板右側的畫面正中央
  text("台北市即時雨量地圖", panelWidth + (width - panelWidth) / 2, 50);

  // 繪製左側面板 (站名列表)
  fill(0, 180);
  noStroke();
  rectMode(CORNER);
  rect(0, 0, panelWidth, height);

  fill(255);
  textAlign(LEFT, TOP);
  textSize(18);
  text("測站雨量列表", 20, 20);

  // 顯示資料更新時間
  if (dataTime !== "") {
    textSize(14);
    fill(200); // 稍微暗一點的文字顏色區分標題
    text(`更新時間: ${dataTime}`, 20, 45);
  }

  let hoveredPanelStation = null;
  let yPos = 70; // 稍微往下推移，讓出空間給時間文字
  let xPos = 15;
  textSize(14);
  
  for (let i = 0; i < mergedData.length; i++) {
    let st = mergedData[i];
    let rainVal = parseFloat(st.rain);

    // 如果超出畫面高度，則換行顯示
    if (yPos > height - 30) {
      yPos = 70;
      xPos += 130;
    }

    // 檢查滑鼠是否懸停在文字上方
    let isHover = mouseX > xPos && mouseX < xPos + 120 && mouseY > yPos && mouseY < yPos + 18;
    if (isHover) {
      hoveredPanelStation = st;
      fill(255, 255, 0); // 滑鼠移過面板文字時顯示黃色
    } else {
      // 依據雨量大小顯示不同顏色
      fill(getRainColor(rainVal));
    }

    text(`${st.name}: ${st.rain}mm`, xPos, yPos);
    yPos += 20;
  }
  
  let hoveredStation = null;
  
  // 繪製地圖上的標記點
  for (let st of mergedData) {
    // 將經緯度轉換為畫布上的像素座標
    let pos = myMap.latLngToPixel(st.lat, st.lon);
    let rainVal = parseFloat(st.rain);
    
    let baseRadius = 8;
    let isHovered = (hoveredPanelStation === st);
    
    // 計算滑鼠與圓點的距離，檢查是否懸停
    let d = dist(mouseX, mouseY, pos.x, pos.y);
    if (d < baseRadius) {
      isHovered = true;
      hoveredStation = { st: st, pos: pos };
    }

    // 被指到時加大直徑
    let radius = isHovered ? 16 : baseRadius;
    
    // 依據雨量大小設定圓點顏色
    fill(getRainColor(rainVal));

    stroke(255);
    strokeWeight(1.5);
    ellipse(pos.x, pos.y, radius * 2, radius * 2);
  }
  
  let currentHover = hoveredStation ? hoveredStation.st : hoveredPanelStation;

  // 如果有滑鼠碰觸到的測站，顯示資料框 (最後畫才不會被其他圓點蓋住)
  if (currentHover) {
    let st = currentHover;
    let p = hoveredStation ? hoveredStation.pos : myMap.latLngToPixel(st.lat, st.lon);
    let infoText = `${st.name} : ${st.rain} mm`;

    textSize(16);
    let tw = textWidth(infoText);
    let th = 26;

    fill(0, 200); // 黑色半透明底框
    noStroke();
    rectMode(CENTER);
    rect(p.x, p.y - 30, tw + 20, th, 5); // 5 為邊框圓角

    fill(255);
    textAlign(CENTER, CENTER);
    text(infoText, p.x, p.y - 30);
  }

  // 繪製右上角天氣效果
  drawWeatherEffect(currentHover);

  // 繪製降雨量圖示面板 (Legend)
  drawLegend();
}

function drawWeatherEffect(hoveredSt) {
  let isRaining = false;
  let rainAmount = 0;
  
  if (hoveredSt) {
    rainAmount = parseFloat(hoveredSt.rain);
    isRaining = rainAmount > 0;
  } else {
    // 若沒有懸停特定測站，判斷全市是否下雨
    isRaining = mergedData.some(st => parseFloat(st.rain) > 0);
    rainAmount = 2; // 預設雨量大小
  }

  push();
  translate(width - 80, 80);

  if (isRaining) {
    // 畫雲
    fill(150);
    noStroke();
    ellipse(0, 0, 60, 40);
    ellipse(-20, 10, 50, 30);
    ellipse(20, 10, 50, 30);

    // 依據雨量調整雨滴數量與速度
    let dropCount = min(rainDrops.length, map(rainAmount, 0, 50, 10, rainDrops.length));
    
    // 畫雨滴
    stroke(150, 200, 255);
    strokeWeight(2);
    for(let i = 0; i < dropCount; i++) {
      let drop = rainDrops[i];
      line(drop.x, drop.y, drop.x, drop.y + 10);
      drop.y += drop.speed + map(rainAmount, 0, 50, 0, 10);
      if (drop.y > 60) drop.y = random(-20, 10);
    }
  } else {
    // 畫太陽
    fill(255, 204, 0);
    noStroke();
    push();
    rotate(frameCount * 0.01);
    for(let i = 0; i < 8; i++) {
      rotate(TWO_PI / 8);
      triangle(-5, 25, 5, 25, 0, 45);
    }
    pop();
    ellipse(0, 0, 50, 50);
  }
  pop();
}

function drawLegend() {
  let panelW = 180;
  let panelH = 190;
  let startX = width - panelW - 20; 
  let startY = height - panelH - 20;

  fill(0, 180);
  noStroke();
  rectMode(CORNER);
  rect(startX, startY, panelW, panelH, 8);

  fill(255);
  textAlign(LEFT, TOP);
  textSize(16);
  noStroke();
  text("10分鐘降雨量標示", startX + 15, startY + 15);

  // 定義六個雨量級距說明與對應數值(用於取得顏色)
  let categories = [
    { label: "0 mm (無雨)", val: 0 },
    { label: "0.1 - 2.0 mm", val: 1 },
    { label: "2.1 - 5.0 mm", val: 3 },
    { label: "5.1 - 10.0 mm", val: 6 },
    { label: "10.1 - 15.0 mm", val: 11 },
    { label: "> 15.0 mm", val: 20 }
  ];

  textSize(14);
  for (let i = 0; i < categories.length; i++) {
    let y = startY + 45 + i * 22;
    fill(getRainColor(categories[i].val));
    stroke(0);
    strokeWeight(1);
    ellipse(startX + 25, y + 6, 12, 12);

    fill(255);
    noStroke();
    text(categories[i].label, startX + 40, y);
  }
}

// 新增：雨量顏色對映邏輯 (6個分類)
function getRainColor(rainVal) {
  if (rainVal === 0) return color(135, 206, 235); // 天空藍 (0mm)
  if (rainVal <= 2) return color(144, 238, 144);  // 淺綠色
  if (rainVal <= 5) return color(255, 255, 0);    // 黃色
  if (rainVal <= 10) return color(255, 165, 0);   // 橘色
  if (rainVal <= 15) return color(255, 50, 50);   // 紅色
  return color(150, 50, 200);                     // 紫色 (>15mm)
}

// 將台北市雨量資料與氣象署的經緯度資料進行比對合併
function mergeData() {
  let taipeiStations = rainData.data || rainData;
  let cwaStations = (cwaData && cwaData.records) ? (cwaData.records.Station || cwaData.records.location || []) : [];

  if (Array.isArray(taipeiStations)) {
    // 嘗試抓取資料的第一筆時間，作為全市的更新時間顯示
    if (taipeiStations.length > 0) {
      let first = taipeiStations[0];
      dataTime = first.recTime || first.ObsTime || first.time || first.datetime || "未知時間";
    }

    for (let ts of taipeiStations) {
      let name = ts.stationName || ts.StationName || ts.name || "";
      let rainVal = ts.rain10mins || ts.Rain10mins || ts.rain || ts.rainfall || "0";
      
      // 尋找站名相符且位於臺北市的氣象署測站資料
      let match = cwaStations.find(cs => {
        let cname = cs.StationName || cs.locationName || cs.name || "";
        // 取得縣市名稱 (相容不同 API 版本的 JSON 結構)
        let county = (cs.GeoInfo && cs.GeoInfo.CountyName) || cs.CountyName || cs.countyName || "";
        let isTaipei = county.includes("臺北市") || county.includes("台北市");
        return isTaipei && (cname === name || cname.includes(name) || name.includes(cname));
      });

      if (match) {
        let lat, lon;
        // 處理不同版本的氣象署 JSON 結構
        if (match.GeoInfo && match.GeoInfo.Coordinates) {
          let coords = match.GeoInfo.Coordinates.find(c => c.CoordinateName === 'WGS84') || match.GeoInfo.Coordinates[0];
          lat = coords ? coords.StationLatitude : null;
          lon = coords ? coords.StationLongitude : null;
        } else {
          lat = match.lat || match.latitude || match.StationLatitude;
          lon = match.lon || match.longitude || match.StationLongitude;
        }

        if (lat && lon) {
          mergedData.push({
            name: name,
            rain: rainVal,
            lat: parseFloat(lat),
            lon: parseFloat(lon)
          });
        }
      }
    }
  }
  dataMerged = true;
}

// 當瀏覽器視窗大小改變時，重新調整畫布大小，維持全螢幕
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
