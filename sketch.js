let rainData = null;
let cwaData = null;
let mergedData = [];
let dataMerged = false;
let dataError = false;

// Mappa.js 變數
let mappa;
let myMap;
let canvas;

function setup() {
  // 採用全螢幕畫布
  canvas = createCanvas(windowWidth, windowHeight);
  
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

  // 顯示標題
  textSize(24);
  fill(100, 200, 255);
  text("台北市即時雨量地圖", width / 2, 50);
  
  let hoveredStation = null;
  
  // 繪製地圖上的標記點
  for (let st of mergedData) {
    // 將經緯度轉換為畫布上的像素座標
    let pos = myMap.latLngToPixel(st.lat, st.lon);
    let radius = 8;
    
    // 畫出紅色圓點
    fill(255, 0, 0);
    stroke(255);
    strokeWeight(1.5);
    ellipse(pos.x, pos.y, radius * 2, radius * 2);
    
    // 計算滑鼠與圓點的距離，檢查是否懸停
    let d = dist(mouseX, mouseY, pos.x, pos.y);
    if (d < radius) {
      hoveredStation = { st: st, pos: pos };
    }
  }
  
  // 如果有滑鼠碰觸到的測站，顯示資料框 (最後畫才不會被其他圓點蓋住)
  if (hoveredStation) {
    let st = hoveredStation.st;
    let p = hoveredStation.pos;
    let infoText = `${st.name} : ${st.rain} mm`;

    textSize(16);
    let tw = textWidth(infoText);
    let th = 26;

    fill(0, 200); // 黑色半透明底框
    noStroke();
    rectMode(CENTER);
    rect(p.x, p.y - 25, tw + 20, th, 5); // 5 為邊框圓角

    fill(255);
    textAlign(CENTER, CENTER);
    text(infoText, p.x, p.y - 25);
  }
}

// 將台北市雨量資料與氣象署的經緯度資料進行比對合併
function mergeData() {
  let taipeiStations = rainData.data || rainData;
  let cwaStations = (cwaData && cwaData.records) ? (cwaData.records.Station || cwaData.records.location || []) : [];

  if (Array.isArray(taipeiStations)) {
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
