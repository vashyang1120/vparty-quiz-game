/* 小V知識挑戰 quiz-v0.1.4-brain-riddles
   目標：穩定可跑、沿用共用玩家身份、寫入 gameLogs/quiz、quizProgress 與年級累積排行榜。
   V幣：第一版只預留 wallet / vCoinLogs 註解，不實際發放。
*/

// Firebase compat SDK - same project as rhythm/tetris games
var FIREBASE_CONFIG = {
  apiKey:"AIzaSyAZ8WTuAHOslZSa4eqqX3dHR771mkaSNd8",
  authDomain:"vparty-rhythm-game.firebaseapp.com",
  databaseURL:"https://vparty-rhythm-game-default-rtdb.firebaseio.com",
  projectId:"vparty-rhythm-game",
  storageBucket:"vparty-rhythm-game.firebasestorage.app",
  messagingSenderId:"1043884247859",
  appId:"1:1043884247859:web:24b1c030d159d1e9374c46",
  measurementId:"G-ZB7430NTBR"
};
var FIREBASE_ENABLED = true;

var QUIZ_VERSION = "quiz-v0.1.4-brain-riddles-cachefix";

var DB_PATHS = {
  gameLogs:            "gameLogs/quiz",
  leaderboards:        "leaderboards/quiz/main",
  leaderboardsMain:    "leaderboards/quiz/main",
  leaderboardsByGrade: "leaderboards/quiz/byGrade",
  players:             "players",
  avatarCatalog:       "avatarCatalog"
  // V幣預留，不在本版寫入：
  // wallet:      "players/{playerKey}/wallet"
  // vCoinLogs:  "players/{playerKey}/vCoinLogs/{autoId}"
};

var db = null;
var firebaseDb = null;
var firebaseAuthReady = false;
var firebaseInitPromise = null;
var AVATAR_CATALOG = {};
var unlockedAvatars = {};

var AV_BASE = "https://vashyang1120.github.io/vparty-rhythm-game/assets/avatars/";
var AVATARS = [
  {key:"boy1",url:AV_BASE+"boy1.png",label:"男生1"},
  {key:"girl1",url:AV_BASE+"girl1.png",label:"女生1"},
  {key:"boy2",url:AV_BASE+"boy2.png",label:"男生2"},
  {key:"girl2",url:AV_BASE+"girl2.png",label:"女生2"},
  {key:"cat1",url:AV_BASE+"cat1.png",label:"貓咪1"},
  {key:"cat2",url:AV_BASE+"cat2.png",label:"貓咪2"},
  {key:"fat1",url:AV_BASE+"fat1.png",label:"胖胖"},
  {key:"girl3",url:AV_BASE+"girl3.png",label:"女生3"},
  {key:"curl1",url:AV_BASE+"curl1.png",label:"捲髮1"},
  {key:"boy3",url:AV_BASE+"boy3.png",label:"男生3"},
  {key:"girl4",url:AV_BASE+"girl4.png",label:"女生4"},
  {key:"girl5",url:AV_BASE+"girl5.png",label:"女生5"},
  {key:"curl2",url:AV_BASE+"curl2.png",label:"捲髮2"},
  {key:"dog1",url:AV_BASE+"dog1.png",label:"狗狗1"},
  {key:"dog2",url:AV_BASE+"dog2.png",label:"狗狗2"},
  {key:"dog3",url:AV_BASE+"dog3.png",label:"狗狗3"},
  {key:"dog4",url:AV_BASE+"dog4.png",label:"狗狗4"}
];

var UNLOCKABLE_AVATARS = [
  { key: "xiaov_base",         name: "小V",         file: AV_BASE + "xiaov_base.png" },
  { key: "dance_sister_01",    name: "唱跳姐姐",    file: AV_BASE + "dance_sister_01.png" },
  { key: "balloon_sister_01",  name: "氣球姐姐 1",  file: AV_BASE + "balloon_sister_01.png" },
  { key: "balloon_sister_02",  name: "氣球姐姐 2",  file: AV_BASE + "balloon_sister_02.png" },
  { key: "balloon_brother_01", name: "氣球哥哥 1",  file: AV_BASE + "balloon_brother_01.png" },
  { key: "balloon_brother_02", name: "氣球哥哥 2",  file: AV_BASE + "balloon_brother_02.png" },
  { key: "balloon_brother_03", name: "氣球哥哥 3",  file: AV_BASE + "balloon_brother_03.png" },
  { key: "bubble_brother_01",  name: "泡泡哥哥",    file: AV_BASE + "bubble_brother_01.png" },
  { key: "xiaov_special",      name: "小V 特別版",  file: AV_BASE + "xiaov_special.png" }
];

var PLAYER = {
  id: "玩家",
  name: "玩家",
  baseAvatarKey: "boy1",
  displayAvatarKey: "boy1",
  avatarKey: "boy1",
  avatarSrc: AV_BASE + "boy1.png",
  playerKey: ""
};

var QUESTIONS = [];
var selectedGrade = "low";
var selectedSubject = "math";
var leaderboardMode = "main";
var pickerMode = "base";

var quizState = {
  active: false,
  currentIndex: 0,
  questions: [],
  answers: [],
  score: 0,
  correctCount: 0,
  combo: 0,
  maxCombo: 0,
  startedAt: 0,
  questionStartedAt: 0,
  timeTimer: null,
  totalQuestions: 10
};

var GRADE_OPTIONS = [
  {key:"low", name:"低年級", desc:"小一～小二"},
  {key:"middle", name:"中年級", desc:"小三～小四"},
  {key:"high", name:"高年級", desc:"小五～小六"}
];

var SUBJECT_OPTIONS = [
  {key:"math", name:"數學", emoji:"➕"},
  {key:"mandarin", name:"國語", emoji:"📖"},
  {key:"science", name:"自然", emoji:"🔬"},
  {key:"social", name:"社會", emoji:"🌏"},
  {key:"english", name:"英文", emoji:"ABC"},
  {key:"balloon", name:"氣球知識", emoji:"🎈"},
  {key:"brand", name:"小V品牌", emoji:"✨"},
  {key:"brain", name:"腦筋急轉彎", emoji:"🧠"}
];

function $(id){ return document.getElementById(id); }

function toast(msg, dur){
  var el = $("toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(function(){ el.classList.remove("show"); }, dur || 2400);
}

function showScreen(id){
  document.querySelectorAll(".screen").forEach(function(s){ s.classList.remove("active"); });
  var el = $(id);
  if (el) el.classList.add("active");
  if (id !== "screen-quiz") stopQuizTimer();
  if (id === "screen-leaderboard") renderLeaderboard();
}

function normalizePlayerId(id) {
  return (id || "").trim() || "玩家";
}

function encodeFirebaseKeyPart(s) {
  return encodeURIComponent(normalizePlayerId(s))
    .replace(/\./g, "%2E")
    .replace(/#/g, "%23")
    .replace(/\$/g, "%24")
    .replace(/\[/g, "%5B")
    .replace(/\]/g, "%5D");
}

function makePlayerKey(id, baseAvatarKey) {
  return encodeFirebaseKeyPart(id) + "__" + (baseAvatarKey || "boy1");
}

// resolveAvatarSrc：所有 catalog/unlocked 相對路徑轉完整 GitHub Pages URL
// 確保 iframe 嵌入 balloonv.com 時不破圖
function resolveAvatarSrc(src) {
  if (!src) return "";
  var s = String(src);
  if (/^https?:\/\//.test(s)) return s;
  var base = "https://vashyang1120.github.io/vparty-rhythm-game/";
  if (s.indexOf("../assets/avatars/") === 0) return base + s.slice(3);
  if (s.indexOf("./assets/avatars/") === 0)  return base + s.slice(2);
  if (s.indexOf("assets/avatars/") === 0)    return base + s;
  return s;
}

function isBuiltinAvatar(key) {
  return AVATARS.some(function(a){ return a.key === key; });
}

function isDisplayAvatarAllowed(key) {
  if (!key) return false;
  if (isBuiltinAvatar(key)) return true;
  if (unlockedAvatars[key] && unlockedAvatars[key].unlocked) return true;
  if (unlockedAvatars[key] && (unlockedAvatars[key].src || unlockedAvatars[key].file || unlockedAvatars[key].name)) return true;
  return false;
}

function getAvatarByKey(key) {
  if (!key) return { key: AVATARS[0].key, src: AVATARS[0].url, url: AVATARS[0].url, name: AVATARS[0].label };

  var builtin = AVATARS.find(function(a){ return a.key === key; });
  if (builtin) return { key: builtin.key, src: builtin.url, url: builtin.url, name: builtin.label || builtin.key };

  var unlock = UNLOCKABLE_AVATARS.find(function(a){ return a.key === key; });
  if (unlock) {
    var uSrc = resolveAvatarSrc(unlock.src || unlock.file || unlock.url);
    return { key: unlock.key, src: uSrc, url: uSrc, name: unlock.name || unlock.key };
  }

  if (AVATAR_CATALOG[key]) {
    var cat = AVATAR_CATALOG[key];
    var cSrc = resolveAvatarSrc(cat.src || cat.file || cat.url || "");
    return { key: key, src: cSrc, url: cSrc, name: cat.name || key };
  }

  if (unlockedAvatars[key]) {
    var meta = unlockedAvatars[key];
    var mSrc = resolveAvatarSrc(meta.src || meta.file || meta.url || "");
    if (mSrc) return { key: key, src: mSrc, url: mSrc, name: meta.name || key };
  }

  return { key: AVATARS[0].key, src: AVATARS[0].url, url: AVATARS[0].url, name: AVATARS[0].label };
}

function getAvatarUrl(key) {
  var av = getAvatarByKey(key);
  return av.src || av.url || AVATARS[0].url;
}

function validateDisplayAvatarForCurrentIdentity() {
  var currentDisplay = PLAYER.displayAvatarKey || PLAYER.avatarKey || PLAYER.baseAvatarKey || "boy1";
  if (!isDisplayAvatarAllowed(currentDisplay)) {
    currentDisplay = PLAYER.baseAvatarKey || "boy1";
  }
  PLAYER.displayAvatarKey = currentDisplay;
  PLAYER.avatarKey = currentDisplay;
  PLAYER.avatarSrc = getAvatarUrl(currentDisplay);
  return currentDisplay;
}

function ensureFirebaseReady() {
  if (!FIREBASE_ENABLED) return Promise.resolve(false);
  if (firebaseAuthReady && db) return Promise.resolve(true);
  if (firebaseInitPromise) return firebaseInitPromise;

  firebaseInitPromise = new Promise(function(resolve) {
    function start() {
      try {
        if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
        firebase.auth().signInAnonymously()
          .then(function() {
            db = firebase.database();
            firebaseDb = db;
            firebaseAuthReady = true;
            console.log("[Firebase] Auth + DB ready ✓");
            resolve(true);
          })
          .catch(function(err) {
            console.warn("[Firebase] 匿名登入失敗", err);
            db = null;
            firebaseAuthReady = false;
            resolve(false);
          });
      } catch(e) {
        console.warn("[Firebase] Init failed:", e.message);
        db = null;
        firebaseAuthReady = false;
        resolve(false);
      }
    }

    if (typeof firebase === "undefined") {
      var attempts = 0;
      var retry = setInterval(function() {
        attempts++;
        if (typeof firebase !== "undefined") {
          clearInterval(retry);
          start();
        } else if (attempts >= 20) {
          clearInterval(retry);
          console.warn("[Firebase] SDK never loaded");
          resolve(false);
        }
      }, 250);
    } else {
      start();
    }
  });

  return firebaseInitPromise;
}

function loadAvatarCatalog() {
  if (!FIREBASE_ENABLED) return Promise.resolve({});
  return ensureFirebaseReady().then(function(ok) {
    if (!ok || !firebaseDb) return {};
    return firebaseDb.ref(DB_PATHS.avatarCatalog).once("value").then(function(snap) {
      AVATAR_CATALOG = {};
      if (snap.exists()) {
        snap.forEach(function(child) {
          var v = child.val();
          if (!v) return;
          if (v.active === false) return;
          var key = v.key || child.key;
          AVATAR_CATALOG[key] = v;
        });
      }
      console.log("[AvatarCatalog] Loaded", Object.keys(AVATAR_CATALOG).length, "entries");
      return AVATAR_CATALOG;
    });
  }).catch(function(e) {
    console.warn("[AvatarCatalog] Load failed:", e.message);
    return {};
  });
}

function loadUnlockedAvatars() {
  if (!FIREBASE_ENABLED) return Promise.resolve({});
  return ensureFirebaseReady().then(function(ok) {
    if (!ok || !firebaseDb || !PLAYER.playerKey) return {};
    return firebaseDb.ref(DB_PATHS.players + "/" + PLAYER.playerKey + "/unlockedAvatars").once("value").then(function(snap) {
      unlockedAvatars = {};
      snap.forEach(function(child) {
        unlockedAvatars[child.key] = child.val();
      });
      return unlockedAvatars;
    });
  }).catch(function(e) {
    console.warn("[UnlockedAvatars] Load failed:", e.message);
    return {};
  });
}

function ensurePlayerProfile() {
  if (!FIREBASE_ENABLED) return Promise.resolve();
  return ensureFirebaseReady().then(function(ok) {
    if (!ok || !firebaseDb || !PLAYER.playerKey) return;

    return firebaseDb.ref(DB_PATHS.players + "/" + PLAYER.playerKey + "/profile").once("value").then(function(snap) {
      var profile = snap.val();

      if (profile) {
        var cloudDisplay = profile.displayAvatarKey || profile.avatarKey;
        if (cloudDisplay && isDisplayAvatarAllowed(cloudDisplay)) {
          PLAYER.displayAvatarKey = cloudDisplay;
          PLAYER.avatarKey = cloudDisplay;
        } else {
          validateDisplayAvatarForCurrentIdentity();
        }

        PLAYER.id = normalizePlayerId(profile.id || profile.name || PLAYER.id);
        PLAYER.name = PLAYER.id;
        PLAYER.baseAvatarKey = profile.baseAvatarKey || PLAYER.baseAvatarKey || "boy1";
        PLAYER.playerKey = makePlayerKey(PLAYER.id, PLAYER.baseAvatarKey);
        validateDisplayAvatarForCurrentIdentity();
        savePlayerLocal();
        updatePlayerUI();

        return firebaseDb.ref(DB_PATHS.players + "/" + PLAYER.playerKey + "/profile").update({
          id: PLAYER.id,
          name: PLAYER.name,
          playerKey: PLAYER.playerKey,
          baseAvatarKey: PLAYER.baseAvatarKey,
          displayAvatarKey: PLAYER.displayAvatarKey,
          avatarKey: PLAYER.avatarKey,
          updatedAt: Date.now()
        });
      }

      validateDisplayAvatarForCurrentIdentity();
      var newProfile = {
        id: PLAYER.id,
        name: PLAYER.name,
        playerKey: PLAYER.playerKey,
        baseAvatarKey: PLAYER.baseAvatarKey,
        displayAvatarKey: PLAYER.displayAvatarKey,
        avatarKey: PLAYER.avatarKey,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      return firebaseDb.ref(DB_PATHS.players + "/" + PLAYER.playerKey + "/profile").set(newProfile);
    });
  }).catch(function(e) {
    console.warn("[Profile] ensure failed:", e.message);
  });
}

function loadPlayerLocal(){
  var id = localStorage.getItem("vquiz_playerId")
        || localStorage.getItem("vtetris_playerId")
        || localStorage.getItem("vtetris_name")
        || localStorage.getItem("vrhythm_name")
        || "";

  var baseAvatarKey = localStorage.getItem("vquiz_baseAvatarKey")
                   || localStorage.getItem("vtetris_baseAvatarKey")
                   || localStorage.getItem("vtetris_avKey")
                   || localStorage.getItem("vrhythm_avKey")
                   || "boy1";

  var displayAvatarKey = localStorage.getItem("vquiz_displayAvatarKey")
                      || localStorage.getItem("vtetris_displayAvatarKey")
                      || baseAvatarKey;

  PLAYER.id = normalizePlayerId(id);
  PLAYER.name = PLAYER.id;
  PLAYER.baseAvatarKey = baseAvatarKey;
  PLAYER.displayAvatarKey = displayAvatarKey;
  PLAYER.avatarKey = displayAvatarKey;
  PLAYER.playerKey = makePlayerKey(PLAYER.id, PLAYER.baseAvatarKey);
  PLAYER.avatarSrc = getAvatarUrl(PLAYER.displayAvatarKey);
}

function savePlayerLocal(){
  PLAYER.id = normalizePlayerId(PLAYER.id || PLAYER.name);
  PLAYER.name = PLAYER.id;
  PLAYER.baseAvatarKey = PLAYER.baseAvatarKey || "boy1";
  PLAYER.playerKey = makePlayerKey(PLAYER.id, PLAYER.baseAvatarKey);
  validateDisplayAvatarForCurrentIdentity();

  localStorage.setItem("vquiz_playerId", PLAYER.id);
  localStorage.setItem("vquiz_baseAvatarKey", PLAYER.baseAvatarKey);
  localStorage.setItem("vquiz_displayAvatarKey", PLAYER.displayAvatarKey);
  localStorage.setItem("vquiz_playerKey", PLAYER.playerKey);
  localStorage.setItem("vquiz_profileConfirmed", "1");

  // 寫入一份共用感較高的 profile，方便未來入口頁銜接。
  localStorage.setItem("vPartyPlayerProfile", JSON.stringify({
    id: PLAYER.id,
    name: PLAYER.name,
    playerKey: PLAYER.playerKey,
    baseAvatarKey: PLAYER.baseAvatarKey,
    displayAvatarKey: PLAYER.displayAvatarKey,
    avatarKey: PLAYER.avatarKey,
    avatarSrc: PLAYER.avatarSrc,
    updatedAt: Date.now()
  }));
}

function hasConfirmedQuizProfile(){
  return localStorage.getItem("vquiz_profileConfirmed") === "1"
    && !!localStorage.getItem("vquiz_playerId")
    && !!localStorage.getItem("vquiz_baseAvatarKey")
    && !!localStorage.getItem("vquiz_playerKey");
}

function buildCurrentProfilePayload(isCreate){
  validateDisplayAvatarForCurrentIdentity();
  var payload = {
    id: PLAYER.id,
    name: PLAYER.name || PLAYER.id,
    playerKey: PLAYER.playerKey,
    baseAvatarKey: PLAYER.baseAvatarKey,
    displayAvatarKey: PLAYER.displayAvatarKey,
    avatarKey: PLAYER.displayAvatarKey,
    avatarSrc: PLAYER.avatarSrc,
    updatedAt: Date.now()
  };
  if (isCreate) payload.createdAt = Date.now();
  return payload;
}

// v0.1.1：使用「目前畫面選擇」直接寫回 profile。
// 這個函式不會先讀 Firebase 舊 displayAvatarKey，因此不會把剛選的新顯示頭像蓋回舊值。
function writePlayerProfileCurrent(){
  if (!FIREBASE_ENABLED) return Promise.resolve(false);
  return ensureFirebaseReady().then(function(ok){
    if (!ok || !firebaseDb || !PLAYER.playerKey) return false;
    var ref = firebaseDb.ref(DB_PATHS.players + "/" + PLAYER.playerKey + "/profile");
    return ref.once("value").then(function(snap){
      var payload = buildCurrentProfilePayload(!snap.exists());
      return ref.update(payload).then(function(){ return true; });
    });
  }).catch(function(e){
    console.warn("[Profile] write current failed:", e.message);
    return false;
  });
}

function savePlayer(){
  savePlayerLocal();
  updatePlayerUI();
  return loadUnlockedAvatars().then(function(){
    validateDisplayAvatarForCurrentIdentity();
    savePlayerLocal();
    updatePlayerUI();
    return writePlayerProfileCurrent();
  });
}

function updatePlayerUI(){
  var av = getAvatarByKey(PLAYER.displayAvatarKey);
  PLAYER.avatarSrc = av.src || av.url;
  PLAYER.avatarKey = PLAYER.displayAvatarKey;

  if ($("top-avatar")) $("top-avatar").src = PLAYER.avatarSrc;
  if ($("top-name")) $("top-name").textContent = PLAYER.name || PLAYER.id || "玩家";
  if ($("top-player-key")) $("top-player-key").textContent = PLAYER.playerKey || "尚未設定身份";

  if ($("player-id-input")) $("player-id-input").value = PLAYER.id || "";
  if ($("base-avatar-preview")) $("base-avatar-preview").src = getAvatarUrl(PLAYER.baseAvatarKey);
  if ($("display-avatar-preview")) $("display-avatar-preview").src = PLAYER.avatarSrc;
  if ($("profile-player-key")) $("profile-player-key").textContent = makePlayerKey(normalizePlayerId($("player-id-input").value), PLAYER.baseAvatarKey);
}

function getAvailableDisplayAvatars(){
  var list = AVATARS.map(function(a){
    return { key:a.key, name:a.label || a.key, src:a.url, type:"builtin" };
  });

  UNLOCKABLE_AVATARS.forEach(function(a){
    if (unlockedAvatars[a.key] && unlockedAvatars[a.key].unlocked) {
      list.push({ key:a.key, name:a.name || a.key, src:resolveAvatarSrc(a.file || a.src || a.url), type:"unlock" });
    }
  });

  Object.keys(AVATAR_CATALOG).forEach(function(key){
    var cat = AVATAR_CATALOG[key];
    if (!cat || cat.active === false) return;
    var hidden = cat.hiddenUntilUnlocked === true || cat.tier === "student";
    var isUnlocked = unlockedAvatars[key] && unlockedAvatars[key].unlocked;
    if (hidden && !isUnlocked) return;
    if (!isUnlocked && hidden) return;
    if (isUnlocked || !hidden) {
      var src = resolveAvatarSrc(cat.src || cat.file || cat.url || "");
      if (src) list.push({ key:key, name:cat.name || key, src:src, type:"catalog" });
    }
  });

  // 去重
  var seen = {};
  return list.filter(function(a){
    if (seen[a.key]) return false;
    seen[a.key] = true;
    return true;
  });
}

function buildAvatarPicker(mode){
  pickerMode = mode;
  var wrap = $("avatar-picker");
  var grid = $("avatar-grid");
  var title = $("avatar-picker-title");
  if (!wrap || !grid) return;

  title.textContent = mode === "base" ? "🔑 選擇身份頭像（只限內建頭像）" : "🎨 選擇顯示頭像";
  grid.innerHTML = "";

  var list = mode === "base"
    ? AVATARS.map(function(a){ return { key:a.key, name:a.label || a.key, src:a.url }; })
    : getAvailableDisplayAvatars();

  list.forEach(function(av){
    var btn = document.createElement("button");
    btn.className = "avatar-item";
    var selected = mode === "base" ? av.key === PLAYER.baseAvatarKey : av.key === PLAYER.displayAvatarKey;
    if (selected) btn.classList.add("selected");
    btn.innerHTML = '<img src="' + escapeHtml(av.src) + '" alt=""><span>' + escapeHtml(av.name) + '</span>';
    btn.addEventListener("click", function(){
      if (mode === "base") {
        PLAYER.baseAvatarKey = av.key;
        PLAYER.playerKey = makePlayerKey(PLAYER.id, PLAYER.baseAvatarKey);
        // 切換身份頭像時，若目前 display 未必屬於新身份，先暫時退回 base，確認後會重新讀 unlocked。
        PLAYER.displayAvatarKey = av.key;
        PLAYER.avatarKey = av.key;
        PLAYER.avatarSrc = getAvatarUrl(av.key);
        savePlayerLocal();
        updatePlayerUI();
        buildAvatarPicker("base");
        toast("已選擇身份頭像：" + av.name + "\\nplayerKey 會跟著身份切換。");
      } else {
        if (!isDisplayAvatarAllowed(av.key)) {
          toast("這個顯示頭像尚未解鎖，不能套用。");
          return;
        }

        var oldPlayerKey = PLAYER.playerKey;
        var oldBaseAvatarKey = PLAYER.baseAvatarKey;

        PLAYER.displayAvatarKey = av.key;
        PLAYER.avatarKey = av.key;
        PLAYER.avatarSrc = getAvatarUrl(av.key);

        // 防呆：顯示頭像不可改變身份
        PLAYER.baseAvatarKey = oldBaseAvatarKey;
        PLAYER.playerKey = oldPlayerKey;

        savePlayerLocal();
        updatePlayerUI();
        buildAvatarPicker("display");

        writePlayerProfileCurrent().then(function(){
          toast("已更換顯示頭像：" + av.name + "\nplayerKey 不會改變。");
        });
      }
    });
    grid.appendChild(btn);
  });

  wrap.classList.remove("hidden");
}

function escapeHtml(s){
  return String(s == null ? "" : s).replace(/[&<>"']/g, function(ch){
    return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch];
  });
}

function loadQuestions(){
  return fetch("./quiz_questions.json?v=" + encodeURIComponent(QUIZ_VERSION), { cache:"no-store" })
    .then(function(res){
      if (!res.ok) throw new Error("題庫讀取失敗");
      return res.json();
    })
    .then(function(data){
      QUESTIONS = Array.isArray(data) ? data : [];
      updateQuestionCountHint();
      return QUESTIONS;
    })
    .catch(function(e){
      console.warn("[Questions] load failed:", e);
      QUESTIONS = [];
      updateQuestionCountHint();
      toast("題庫讀取失敗，請確認 quiz_questions.json 是否同資料夾。", 4000);
      return [];
    });
}

function buildSetupOptions(){
  var gradeWrap = $("grade-options");
  var subjectWrap = $("subject-options");
  gradeWrap.innerHTML = "";
  subjectWrap.innerHTML = "";

  GRADE_OPTIONS.forEach(function(g){
    var btn = document.createElement("button");
    btn.className = "option-card" + (g.key === selectedGrade ? " selected" : "");
    btn.innerHTML = escapeHtml(g.name) + "<small>" + escapeHtml(g.desc) + "</small>";
    btn.addEventListener("click", function(){
      selectedGrade = g.key;
      buildSetupOptions();
      updateQuestionCountHint();
    });
    gradeWrap.appendChild(btn);
  });

  SUBJECT_OPTIONS.forEach(function(s){
    var btn = document.createElement("button");
    btn.className = "option-card" + (s.key === selectedSubject ? " selected" : "");
    btn.innerHTML = "<div>" + escapeHtml(s.emoji) + "</div>" + escapeHtml(s.name);
    btn.addEventListener("click", function(){
      selectedSubject = s.key;
      buildSetupOptions();
      updateQuestionCountHint();
    });
    subjectWrap.appendChild(btn);
  });
}

function updateQuestionCountHint(){
  var list = getQuestionPool();
  var subject = SUBJECT_OPTIONS.find(function(s){ return s.key === selectedSubject; });
  var grade = GRADE_OPTIONS.find(function(g){ return g.key === selectedGrade; });
  var text = (grade ? grade.name : selectedGrade) + " / " + (subject ? subject.name : selectedSubject) + "：目前有 " + list.length + " 題";
  if (list.length < 10) text += "，不足 10 題，請補題後再開始。";
  $("question-count-hint").textContent = text;
  var startBtn = $("btn-start-quiz");
  if (startBtn) startBtn.disabled = list.length < 10;
}

function getQuestionPool(){
  return QUESTIONS.filter(function(q){
    return q.gradeBand === selectedGrade && q.subject === selectedSubject;
  });
}

function shuffle(arr){
  var a = arr.slice();
  for (var i=a.length-1;i>0;i--) {
    var j = Math.floor(Math.random() * (i+1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function startQuiz(){
  var pool = getQuestionPool();
  if (pool.length < 10) {
    toast("這個年級與科目的題目不足 10 題，請先補題。");
    return;
  }

  quizState.active = true;
  quizState.currentIndex = 0;
  quizState.questions = shuffle(pool).slice(0, 10);
  quizState.answers = [];
  quizState.score = 0;
  quizState.correctCount = 0;
  quizState.combo = 0;
  quizState.maxCombo = 0;
  quizState.startedAt = Date.now();
  quizState.questionStartedAt = Date.now();
  quizState.totalQuestions = 10;

  showScreen("screen-quiz");
  startQuizTimer();
  renderQuestion();
}

function startQuizTimer(){
  stopQuizTimer();
  quizState.timeTimer = setInterval(function(){
    var sec = Math.floor((Date.now() - quizState.startedAt) / 1000);
    $("hud-time").textContent = sec + "s";
  }, 250);
}

function stopQuizTimer(){
  if (quizState.timeTimer) clearInterval(quizState.timeTimer);
  quizState.timeTimer = null;
}

function renderQuestion(){
  var q = quizState.questions[quizState.currentIndex];
  if (!q) return finishQuiz();

  quizState.questionStartedAt = Date.now();
  $("hud-progress").textContent = (quizState.currentIndex + 1) + " / " + quizState.totalQuestions;
  $("hud-score").textContent = quizState.score;
  $("hud-combo").textContent = quizState.combo;
  $("q-subject").textContent = q.subjectName || q.subject;
  $("q-grade").textContent = q.gradeBandName || q.gradeBand;
  $("q-difficulty").textContent = "★".repeat(Math.max(1, Math.min(3, q.difficulty || 1)));
  $("question-text").textContent = q.question;
  $("explanation-box").classList.add("hidden");
  $("btn-next-question").textContent = quizState.currentIndex === quizState.totalQuestions - 1 ? "查看結算" : "下一題";

  var choices = $("choices");
  choices.innerHTML = "";
  (q.choices || []).forEach(function(choice, index){
    var btn = document.createElement("button");
    btn.className = "choice-btn";
    btn.textContent = String.fromCharCode(65 + index) + ". " + choice;
    btn.addEventListener("click", function(){ answerQuestion(index); });
    choices.appendChild(btn);
  });
}

function answerQuestion(selectedIndex){
  var q = quizState.questions[quizState.currentIndex];
  if (!q) return;

  var buttons = Array.prototype.slice.call(document.querySelectorAll(".choice-btn"));
  if (buttons.some(function(b){ return b.disabled; })) return;

  var answerIndex = Number(q.answerIndex);
  var correct = selectedIndex === answerIndex;
  var timeUsed = Math.max(0, Math.round((Date.now() - quizState.questionStartedAt) / 1000));

  if (correct) {
    quizState.combo += 1;
    quizState.maxCombo = Math.max(quizState.maxCombo, quizState.combo);
    quizState.correctCount += 1;
    var bonus = Math.min(Math.max(quizState.combo - 1, 0) * 10, 50);
    quizState.score += 100 + bonus;
  } else {
    quizState.combo = 0;
  }

  quizState.answers.push({
    questionId: q.id,
    selectedIndex: selectedIndex,
    answerIndex: answerIndex,
    correct: correct,
    timeUsed: timeUsed
  });

  buttons.forEach(function(btn, idx){
    btn.disabled = true;
    if (idx === answerIndex) btn.classList.add("correct");
    if (idx === selectedIndex && !correct) btn.classList.add("wrong");
  });

  $("hud-score").textContent = quizState.score;
  $("hud-combo").textContent = quizState.combo;

  $("answer-result").textContent = correct ? "✅ 答對了！" : "❌ 答錯了";
  $("answer-result").style.color = correct ? "#158657" : "#b23838";
  $("explanation-text").textContent = q.explanation || "這題目前沒有解析。";
  $("explanation-box").classList.remove("hidden");
}

function nextQuestion(){
  quizState.currentIndex += 1;
  if (quizState.currentIndex >= quizState.totalQuestions) finishQuiz();
  else renderQuestion();
}

function finishQuiz(){
  stopQuizTimer();
  quizState.active = false;

  var totalTime = Math.max(0, Math.round((Date.now() - quizState.startedAt) / 1000));
  var accuracy = quizState.totalQuestions ? quizState.correctCount / quizState.totalQuestions : 0;

  $("result-score").textContent = quizState.score;
  $("result-correct").textContent = quizState.correctCount + " / " + quizState.totalQuestions;
  $("result-accuracy").textContent = Math.round(accuracy * 100) + "%";
  $("result-max-combo").textContent = quizState.maxCombo;
  $("result-time").textContent = totalTime + "s";

  var title = "挑戰完成！";
  var emoji = "🎈";
  if (quizState.correctCount === 10) { title = "知識派對王！"; emoji = "🏆"; }
  else if (quizState.correctCount >= 8) { title = "魔法小學霸！"; emoji = "🌟"; }
  else if (quizState.correctCount >= 5) { title = "派對挑戰成功！"; emoji = "🎉"; }
  else { title = "再挑戰一次！"; emoji = "💪"; }
  $("result-title").textContent = title;
  $("result-emoji").textContent = emoji;

  showScreen("screen-result");
  saveQuizResult(totalTime, accuracy);
}

function buildQuizRecord(totalTime, accuracy){
  var subject = SUBJECT_OPTIONS.find(function(s){ return s.key === selectedSubject; }) || {};
  var grade = GRADE_OPTIONS.find(function(g){ return g.key === selectedGrade; }) || {};
  var now = Date.now();

  validateDisplayAvatarForCurrentIdentity();
  var av = getAvatarByKey(PLAYER.displayAvatarKey);

  return {
    gameId: "quiz",
    version: QUIZ_VERSION,
    mode: "mvp",

    id: PLAYER.id,
    name: PLAYER.name || PLAYER.id,
    playerKey: PLAYER.playerKey,
    baseAvatarKey: PLAYER.baseAvatarKey,
    displayAvatarKey: PLAYER.displayAvatarKey,
    avatarKey: PLAYER.displayAvatarKey,
    avatarSrc: resolveAvatarSrc(av.src || av.url || ""),

    gradeBand: selectedGrade,
    gradeBandName: grade.name || selectedGrade,
    subject: selectedSubject,
    subjectName: subject.name || selectedSubject,
    difficulty: null,

    score: quizState.score,
    correctCount: quizState.correctCount,
    totalQuestions: quizState.totalQuestions,
    maxCombo: quizState.maxCombo,
    accuracy: Number(accuracy.toFixed(4)),
    timeUsedTotal: totalTime,

    usedQuestionIds: quizState.questions.map(function(q){ return q.id; }),
    answers: quizState.answers.slice(),

    rewardsPreview: {
      vCoins: 0,
      note: "V幣系統預留，第一版不發放"
    },

    ts: now,
    date: new Date(now).toISOString()
  };
}

function saveLocalLog(record){
  try {
    var logs = JSON.parse(localStorage.getItem("vquiz_localLogs") || "[]");
    logs.push(record);
    if (logs.length > 50) logs = logs.slice(logs.length - 50);
    localStorage.setItem("vquiz_localLogs", JSON.stringify(logs));
  } catch(e) {}
}

function saveGameLog(record){
  return ensureFirebaseReady().then(function(ok){
    if (!ok || !firebaseDb) throw new Error("Firebase not ready");
    return firebaseDb.ref(DB_PATHS.gameLogs).push(record);
  });
}

function saveQuizResult(totalTime, accuracy){
  var record = buildQuizRecord(totalTime, accuracy);
  $("save-status").textContent = "正在寫入 gameLogs/quiz、個人進度與排行榜...";

  saveLocalLog(record);

  return saveGameLog(record)
    .then(function(){
      return updateQuizProgress(record);
    })
    .then(function(progressResult){
      return updateGradeLeaderboard(record.gradeBand).then(function(gradeRecord){
        return updateMainLeaderboardFromGrades().then(function(mainRecord){
          return { progressResult:progressResult, gradeRecord:gradeRecord, mainRecord:mainRecord };
        });
      });
    })
    .then(function(result){
      var progress = result.progressResult && result.progressResult.progress;
      var bestUpdated = result.progressResult && result.progressResult.bestUpdated;
      var gradeRecord = result.gradeRecord || {};
      var mainRecord = result.mainRecord || {};
      var subjectName = record.subjectName || record.subject;
      var lines = ["✅ 本次紀錄已保存"];
      if (bestUpdated) lines.push("✅ " + subjectName + "最佳紀錄刷新！");
      else if (progress) lines.push(subjectName + "最佳仍維持 " + (progress.bestScore || 0) + " 分");
      lines.push((record.gradeBandName || record.gradeBand) + "總分：" + (gradeRecord.gradeTotalScore || 0) + " 分");
      lines.push("🏆 總榜總分：" + (mainRecord.totalScore || 0) + " 分");
      $("save-status").textContent = lines.join("\n");
    })
    .catch(function(e){
      console.warn("[SaveResult] failed:", e);
      $("save-status").textContent = "⚠️ Firebase 寫入可能失敗，已保留本機測試紀錄。";
    });
}

function makeSubjectProgressFromRecord(record, oldProgress){
  var attempts = (oldProgress && Number(oldProgress.attempts || 0) || 0) + 1;
  var oldBest = oldProgress ? {
    score: oldProgress.bestScore || 0,
    correctCount: oldProgress.bestCorrectCount || 0,
    maxCombo: oldProgress.bestMaxCombo || 0,
    timeUsedTotal: oldProgress.bestTimeUsedTotal || 999999,
    ts: oldProgress.bestUpdatedAt || oldProgress.updatedAt || 0
  } : null;
  var bestUpdated = shouldUpdateBestRecord(oldBest, record);

  var progress = {
    gameId: "quiz",
    version: QUIZ_VERSION,
    playerKey: PLAYER.playerKey,
    gradeBand: record.gradeBand,
    gradeBandName: record.gradeBandName,
    subject: record.subject,
    subjectName: record.subjectName,

    bestScore: bestUpdated ? record.score : (oldProgress.bestScore || 0),
    bestCorrectCount: bestUpdated ? record.correctCount : (oldProgress.bestCorrectCount || 0),
    bestMaxCombo: bestUpdated ? record.maxCombo : (oldProgress.bestMaxCombo || 0),
    bestTimeUsedTotal: bestUpdated ? record.timeUsedTotal : (oldProgress.bestTimeUsedTotal || 0),
    bestTotalQuestions: bestUpdated ? record.totalQuestions : (oldProgress.bestTotalQuestions || oldProgress.totalQuestions || record.totalQuestions || 10),
    bestUpdatedAt: bestUpdated ? record.ts : (oldProgress.bestUpdatedAt || oldProgress.updatedAt || record.ts),

    attempts: attempts,
    perfect: false,

    lastScore: record.score,
    lastCorrectCount: record.correctCount,
    lastMaxCombo: record.maxCombo,
    lastTimeUsedTotal: record.timeUsedTotal,
    lastTotalQuestions: record.totalQuestions,

    updatedAt: Date.now()
  };
  progress.totalQuestions = progress.bestTotalQuestions;
  progress.perfect = (progress.bestCorrectCount || 0) >= (progress.bestTotalQuestions || record.totalQuestions || 10);
  return { progress:progress, bestUpdated:bestUpdated };
}

function updateQuizProgress(record){
  return ensureFirebaseReady().then(function(ok){
    if (!ok || !firebaseDb) throw new Error("Firebase not ready");
    var path = DB_PATHS.players + "/" + PLAYER.playerKey + "/quizProgress/" + record.gradeBand + "/" + record.subject;
    var ref = firebaseDb.ref(path);
    return ref.once("value").then(function(snap){
      var oldProgress = snap.val() || {};
      var result = makeSubjectProgressFromRecord(record, oldProgress);
      return ref.set(result.progress).then(function(){ return result; });
    });
  });
}

function shouldUpdateBestRecord(oldRecord, newRecord){
  if (!oldRecord) return true;
  if ((newRecord.score || 0) !== (oldRecord.score || 0)) return (newRecord.score || 0) > (oldRecord.score || 0);
  if ((newRecord.correctCount || 0) !== (oldRecord.correctCount || 0)) return (newRecord.correctCount || 0) > (oldRecord.correctCount || 0);
  if ((newRecord.maxCombo || 0) !== (oldRecord.maxCombo || 0)) return (newRecord.maxCombo || 0) > (oldRecord.maxCombo || 0);
  if ((newRecord.timeUsedTotal || 999999) !== (oldRecord.timeUsedTotal || 999999)) return (newRecord.timeUsedTotal || 999999) < (oldRecord.timeUsedTotal || 999999);
  return (newRecord.ts || 0) > (oldRecord.ts || 0);
}

function getGradeName(gradeKey){
  var g = GRADE_OPTIONS.find(function(item){ return item.key === gradeKey; });
  return g ? g.name : gradeKey;
}

function getSubjectName(subjectKey){
  var s = SUBJECT_OPTIONS.find(function(item){ return item.key === subjectKey; });
  return s ? s.name : subjectKey;
}

function subjectSortIndex(key){
  var idx = SUBJECT_OPTIONS.findIndex(function(s){ return s.key === key; });
  return idx < 0 ? 999 : idx;
}

function buildGradeRecordFromProgress(gradeBand, progressMap){
  var now = Date.now();
  var entries = [];
  Object.keys(progressMap || {}).forEach(function(subjectKey){
    var p = progressMap[subjectKey];
    if (!p || typeof p !== "object") return;
    if (!p.bestScore && !p.attempts) return;
    entries.push({ key:subjectKey, progress:p });
  });
  entries.sort(function(a,b){ return subjectSortIndex(a.key) - subjectSortIndex(b.key); });

  var subjectKeys = [];
  var subjectNames = [];
  var gradeTotalScore = 0;
  var perfectSubjects = 0;
  var totalCorrect = 0;
  var totalQuestions = 0;
  var totalMaxCombo = 0;
  var totalTimeUsed = 0;
  var totalAttempts = 0;

  entries.forEach(function(item){
    var p = item.progress;
    subjectKeys.push(p.subject || item.key);
    subjectNames.push(p.subjectName || getSubjectName(item.key));
    gradeTotalScore += Number(p.bestScore || 0);
    if (p.perfect === true) perfectSubjects += 1;
    totalCorrect += Number(p.bestCorrectCount || 0);
    totalQuestions += Number(p.bestTotalQuestions || p.totalQuestions || 10);
    totalMaxCombo += Number(p.bestMaxCombo || 0);
    totalTimeUsed += Number(p.bestTimeUsedTotal || 0);
    totalAttempts += Number(p.attempts || 0);
  });

  var av = getAvatarByKey(PLAYER.displayAvatarKey);
  return {
    gameId: "quiz",
    version: QUIZ_VERSION,

    id: PLAYER.id,
    name: PLAYER.name || PLAYER.id,
    playerKey: PLAYER.playerKey,
    baseAvatarKey: PLAYER.baseAvatarKey,
    displayAvatarKey: PLAYER.displayAvatarKey,
    avatarKey: PLAYER.displayAvatarKey,
    avatarSrc: resolveAvatarSrc(av.src || av.url || PLAYER.avatarSrc || ""),

    gradeBand: gradeBand,
    gradeBandName: getGradeName(gradeBand),

    gradeTotalScore: gradeTotalScore,
    completedSubjects: entries.length,
    perfectSubjects: perfectSubjects,

    subjectKeys: subjectKeys,
    subjectNames: subjectNames,
    subjectSummaryText: entries.length + "科：" + subjectNames.join(" / "),

    totalCorrect: totalCorrect,
    totalQuestions: totalQuestions,
    totalMaxCombo: totalMaxCombo,
    totalTimeUsed: totalTimeUsed,
    totalAttempts: totalAttempts,

    updatedAt: now,
    date: new Date(now).toISOString()
  };
}

function updateGradeLeaderboard(gradeBand){
  return ensureFirebaseReady().then(function(ok){
    if (!ok || !firebaseDb) throw new Error("Firebase not ready");
    var progressRef = firebaseDb.ref(DB_PATHS.players + "/" + PLAYER.playerKey + "/quizProgress/" + gradeBand);
    return progressRef.once("value").then(function(snap){
      var progressMap = snap.val() || {};
      var gradeRecord = buildGradeRecordFromProgress(gradeBand, progressMap);
      return firebaseDb.ref(DB_PATHS.leaderboardsByGrade + "/" + gradeBand + "/" + PLAYER.playerKey)
        .set(gradeRecord)
        .then(function(){ return gradeRecord; });
    });
  });
}

function buildMainRecordFromGradeRecords(gradeRecords){
  var now = Date.now();
  var gradeSummary = {};
  var summaryParts = [];
  var totalScore = 0;
  var completedGrades = 0;
  var completedSubjects = 0;
  var perfectSubjects = 0;
  var totalCorrect = 0;
  var totalQuestions = 0;
  var totalMaxCombo = 0;
  var totalTimeUsed = 0;
  var totalAttempts = 0;

  GRADE_OPTIONS.forEach(function(g){
    var r = gradeRecords[g.key];
    var score = r ? Number(r.gradeTotalScore || 0) : 0;
    gradeSummary[g.key] = score;
    if (r && Number(r.completedSubjects || 0) > 0) {
      completedGrades += 1;
      completedSubjects += Number(r.completedSubjects || 0);
      perfectSubjects += Number(r.perfectSubjects || 0);
      totalCorrect += Number(r.totalCorrect || 0);
      totalQuestions += Number(r.totalQuestions || 0);
      totalMaxCombo += Number(r.totalMaxCombo || 0);
      totalTimeUsed += Number(r.totalTimeUsed || 0);
      totalAttempts += Number(r.totalAttempts || 0);
      summaryParts.push(g.name + Number(r.completedSubjects || 0) + "科");
      totalScore += score;
    }
  });

  var av = getAvatarByKey(PLAYER.displayAvatarKey);
  return {
    gameId: "quiz",
    version: QUIZ_VERSION,

    id: PLAYER.id,
    name: PLAYER.name || PLAYER.id,
    playerKey: PLAYER.playerKey,
    baseAvatarKey: PLAYER.baseAvatarKey,
    displayAvatarKey: PLAYER.displayAvatarKey,
    avatarKey: PLAYER.displayAvatarKey,
    avatarSrc: resolveAvatarSrc(av.src || av.url || PLAYER.avatarSrc || ""),

    totalScore: totalScore,
    completedGrades: completedGrades,
    completedSubjects: completedSubjects,
    perfectSubjects: perfectSubjects,

    gradeSummary: gradeSummary,
    gradeSummaryText: summaryParts.join(" / ") || "尚未完成挑戰",

    totalCorrect: totalCorrect,
    totalQuestions: totalQuestions,
    totalMaxCombo: totalMaxCombo,
    totalTimeUsed: totalTimeUsed,
    totalAttempts: totalAttempts,

    updatedAt: now,
    date: new Date(now).toISOString()
  };
}

function updateMainLeaderboardFromGrades(){
  return ensureFirebaseReady().then(function(ok){
    if (!ok || !firebaseDb) throw new Error("Firebase not ready");
    var reads = GRADE_OPTIONS.map(function(g){
      return firebaseDb.ref(DB_PATHS.leaderboardsByGrade + "/" + g.key + "/" + PLAYER.playerKey).once("value").then(function(snap){
        return { key:g.key, val:snap.val() };
      });
    });
    return Promise.all(reads).then(function(results){
      var gradeRecords = {};
      results.forEach(function(item){ if (item.val) gradeRecords[item.key] = item.val; });
      var mainRecord = buildMainRecordFromGradeRecords(gradeRecords);
      return firebaseDb.ref(DB_PATHS.leaderboardsMain + "/" + PLAYER.playerKey)
        .set(mainRecord)
        .then(function(){ return mainRecord; });
    });
  });
}

function compareMainRows(a,b){
  if ((b.totalScore || 0) !== (a.totalScore || 0)) return (b.totalScore || 0) - (a.totalScore || 0);
  if ((b.perfectSubjects || 0) !== (a.perfectSubjects || 0)) return (b.perfectSubjects || 0) - (a.perfectSubjects || 0);
  if ((b.completedSubjects || 0) !== (a.completedSubjects || 0)) return (b.completedSubjects || 0) - (a.completedSubjects || 0);
  if ((b.totalCorrect || 0) !== (a.totalCorrect || 0)) return (b.totalCorrect || 0) - (a.totalCorrect || 0);
  if ((a.totalTimeUsed || 999999) !== (b.totalTimeUsed || 999999)) return (a.totalTimeUsed || 999999) - (b.totalTimeUsed || 999999);
  if ((b.totalMaxCombo || 0) !== (a.totalMaxCombo || 0)) return (b.totalMaxCombo || 0) - (a.totalMaxCombo || 0);
  if ((a.totalAttempts || 999999) !== (b.totalAttempts || 999999)) return (a.totalAttempts || 999999) - (b.totalAttempts || 999999);
  return (b.updatedAt || 0) - (a.updatedAt || 0);
}

function compareGradeRows(a,b){
  if ((b.gradeTotalScore || 0) !== (a.gradeTotalScore || 0)) return (b.gradeTotalScore || 0) - (a.gradeTotalScore || 0);
  if ((b.perfectSubjects || 0) !== (a.perfectSubjects || 0)) return (b.perfectSubjects || 0) - (a.perfectSubjects || 0);
  if ((b.totalCorrect || 0) !== (a.totalCorrect || 0)) return (b.totalCorrect || 0) - (a.totalCorrect || 0);
  if ((a.totalTimeUsed || 999999) !== (b.totalTimeUsed || 999999)) return (a.totalTimeUsed || 999999) - (b.totalTimeUsed || 999999);
  if ((b.totalMaxCombo || 0) !== (a.totalMaxCombo || 0)) return (b.totalMaxCombo || 0) - (a.totalMaxCombo || 0);
  if ((a.totalAttempts || 999999) !== (b.totalAttempts || 999999)) return (a.totalAttempts || 999999) - (b.totalAttempts || 999999);
  return (b.updatedAt || 0) - (a.updatedAt || 0);
}

function renderLeaderboard(){
  var listEl = $("leaderboard-list");
  listEl.textContent = "載入中...";
  updateLeaderboardTabs();

  var path = leaderboardMode === "main"
    ? DB_PATHS.leaderboardsMain
    : DB_PATHS.leaderboardsByGrade + "/" + leaderboardMode;

  return ensureFirebaseReady().then(function(ok){
    if (!ok || !firebaseDb) throw new Error("Firebase not ready");
    return firebaseDb.ref(path).once("value").then(function(snap){
      var rows = [];
      snap.forEach(function(child){
        var v = child.val();
        if (v) rows.push(v);
      });
      renderLeaderboardRows(rows, false);
    });
  }).catch(function(e){
    console.warn("[Leaderboard] load failed:", e.message);
    listEl.innerHTML = '<div class="muted">排行榜載入失敗，請稍後再試。</div>';
  });
}

function updateLeaderboardTabs(){
  document.querySelectorAll("[data-lb-mode]").forEach(function(btn){
    btn.classList.toggle("active", btn.getAttribute("data-lb-mode") === leaderboardMode);
  });
  var desc = $("leaderboard-desc");
  if (!desc) return;
  if (leaderboardMode === "main") desc.textContent = "leaderboards/quiz/main/{playerKey}：三個年級總分加總的綜合榜。";
  else desc.textContent = "leaderboards/quiz/byGrade/" + leaderboardMode + "/{playerKey}：該年級各科最佳分數加總。";
}

function renderLeaderboardRows(rows){
  var listEl = $("leaderboard-list");
  rows = (rows || []).sort(leaderboardMode === "main" ? compareMainRows : compareGradeRows).slice(0, 30);

  if (!rows.length) {
    listEl.innerHTML = '<div class="muted">目前還沒有排行榜紀錄。</div>';
    return;
  }

  listEl.innerHTML = "";
  rows.forEach(function(r, idx){
    var row = document.createElement("div");
    row.className = "lb-row" + (r.playerKey === PLAYER.playerKey ? " mine" : "");
    var src = resolveAvatarSrc(r.avatarSrc || getAvatarUrl(r.displayAvatarKey || r.avatarKey || r.baseAvatarKey));

    if (leaderboardMode === "main") {
      row.innerHTML =
        '<div class="lb-rank">' + (idx + 1) + '</div>' +
        '<img src="' + escapeHtml(src) + '" alt="">' +
        '<div class="lb-main"><strong>' + escapeHtml(r.name || r.id || "玩家") + '</strong>' +
        '<span>' + (r.completedSubjects || 0) + '科 / 滿分' + (r.perfectSubjects || 0) + '科｜' + escapeHtml(r.gradeSummaryText || "尚未完成挑戰") + '</span></div>' +
        '<div class="lb-score">' + (r.totalScore || 0) + '</div>';
    } else {
      row.innerHTML =
        '<div class="lb-rank">' + (idx + 1) + '</div>' +
        '<img src="' + escapeHtml(src) + '" alt="">' +
        '<div class="lb-main"><strong>' + escapeHtml(r.name || r.id || "玩家") + '</strong>' +
        '<span>' + (r.completedSubjects || 0) + '科 / 滿分' + (r.perfectSubjects || 0) + '科｜' + escapeHtml((r.subjectNames || []).join(" / ") || r.subjectSummaryText || "-") + '｜' + formatSeconds(r.totalTimeUsed || 0) + '</span></div>' +
        '<div class="lb-score">' + (r.gradeTotalScore || 0) + '</div>';
    }
    listEl.appendChild(row);
  });
}

function formatSeconds(sec){
  sec = Math.max(0, Number(sec || 0));
  var m = Math.floor(sec / 60);
  var s = sec % 60;
  if (!m) return s + "秒";
  return m + "分" + String(s).padStart(2, "0") + "秒";
}

function bindEvents(){
  $("btn-go-profile").addEventListener("click", function(){ showScreen("screen-profile"); });
  $("btn-go-setup").addEventListener("click", function(){
    if (!hasConfirmedQuizProfile()) {
      toast("首次遊玩請先確認玩家身份。");
      showScreen("screen-profile");
      return;
    }
    showScreen("screen-setup");
  });
  $("btn-go-leaderboard").addEventListener("click", function(){ showScreen("screen-leaderboard"); });
  $("btn-profile-back").addEventListener("click", function(){ showScreen("screen-title"); });
  $("btn-setup-back").addEventListener("click", function(){ showScreen("screen-title"); });
  $("btn-leaderboard-back").addEventListener("click", function(){ showScreen("screen-title"); });
  $("btn-result-home").addEventListener("click", function(){ showScreen("screen-title"); });
  $("btn-result-leaderboard").addEventListener("click", function(){ showScreen("screen-leaderboard"); });
  $("btn-refresh-leaderboard").addEventListener("click", renderLeaderboard);
  document.querySelectorAll("[data-lb-mode]").forEach(function(btn){
    btn.addEventListener("click", function(){
      leaderboardMode = btn.getAttribute("data-lb-mode") || "main";
      renderLeaderboard();
    });
  });
  $("btn-start-quiz").addEventListener("click", startQuiz);
  $("btn-play-again").addEventListener("click", function(){ showScreen("screen-setup"); });
  $("btn-quit-quiz").addEventListener("click", function(){
    if (confirm("確定要離開本次挑戰嗎？本局不會寫入紀錄。")) {
      stopQuizTimer();
      showScreen("screen-title");
    }
  });

  $("btn-next-question").addEventListener("click", nextQuestion);

  $("btn-pick-base").addEventListener("click", function(){ buildAvatarPicker("base"); });
  $("btn-pick-display").addEventListener("click", function(){
    if (!PLAYER.playerKey) {
      toast("請先確認玩家身份。");
      return;
    }
    loadUnlockedAvatars().then(function(){
      validateDisplayAvatarForCurrentIdentity();
      buildAvatarPicker("display");
    });
  });
  $("btn-close-picker").addEventListener("click", function(){ $("avatar-picker").classList.add("hidden"); });

  $("player-id-input").addEventListener("input", function(){
    PLAYER.id = normalizePlayerId(this.value);
    PLAYER.name = PLAYER.id;
    PLAYER.playerKey = makePlayerKey(PLAYER.id, PLAYER.baseAvatarKey);
    updatePlayerUI();
  });

  $("btn-save-profile").addEventListener("click", function(){
    PLAYER.id = normalizePlayerId($("player-id-input").value);
    PLAYER.name = PLAYER.id;
    PLAYER.playerKey = makePlayerKey(PLAYER.id, PLAYER.baseAvatarKey);
    savePlayerLocal();
    $("avatar-picker").classList.add("hidden");
    loadAvatarCatalog().then(loadUnlockedAvatars).then(function(){
      validateDisplayAvatarForCurrentIdentity();
      savePlayerLocal();
      updatePlayerUI();
      return ensurePlayerProfile();
    }).then(function(){
      toast("玩家身份已確認！\\n" + PLAYER.playerKey);
      showScreen("screen-setup");
    });
  });
}

function init(){
  bindEvents();
  var alreadyConfirmed = hasConfirmedQuizProfile();
  loadPlayerLocal();
  buildSetupOptions();
  updatePlayerUI();

  // v0.1.1：獨立測試頁首次進入時，強制先確認玩家身份。
  // 未來統一遊戲入口完成後，可以改由入口傳入已確認的 profile。
  showScreen(alreadyConfirmed ? "screen-title" : "screen-profile");
  if (!alreadyConfirmed) {
    toast("首次遊玩請先確認玩家身份。", 3200);
  }

  ensureFirebaseReady()
    .then(loadAvatarCatalog)
    .then(loadUnlockedAvatars)
    .then(function(){
      validateDisplayAvatarForCurrentIdentity();
      updatePlayerUI();
      if (alreadyConfirmed) return ensurePlayerProfile();
      return null;
    })
    .catch(function(e){ console.warn("[Init] Firebase/profile init skipped:", e.message); });

  loadQuestions();
}

document.addEventListener("DOMContentLoaded", init);
