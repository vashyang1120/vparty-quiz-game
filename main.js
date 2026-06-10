/* 小V知識挑戰 quiz-v0.2.20-friendly-identity-copy
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

var QUIZ_VERSION = "quiz-v0.2.20-friendly-identity-copy";

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

var QUESTION_TIME_LIMIT = 15;
var soundEnabled = localStorage.getItem("vquiz_soundEnabled") !== "false";
var audioCtx = null;
var SFX_MASTER_GAIN = 3.0;


var HOST_ART = {
  intro: "./assets/hosts/xiaov_quiz_host_intro_v1.png",
  question: "./assets/hosts/xiaov_quiz_host_question_v1.png",
  correct: "./assets/hosts/xiaov_quiz_host_correct_v1.png",
  timewarning: "./assets/hosts/xiaov_quiz_host_timewarning_v1.png",
  wrong: "./assets/hosts/xiaov_quiz_host_wrong_v1.png",
  timeout: "./assets/hosts/xiaov_quiz_host_timeout_v2.png",
  result: "./assets/hosts/xiaov_quiz_host_result_v1.png",
  ranking: "./assets/hosts/xiaov_quiz_host_ranking_v1.png"
};
var GAME_MENU_URL = "https://balloonv.com/%e6%b0%a3%e7%90%83%e5%b0%8fv%e9%ad%94%e6%b3%95%e6%b4%be%e5%b0%8d%e9%81%8a%e6%88%b2";

// 音樂播放器：讀取節奏遊戲 songs.json，歌曲檔不複製到問答 repo
var SONG_BASE = "https://vashyang1120.github.io/vparty-rhythm-game/";
var MUSIC_EMOJIS = ["🎈","🎤","✨","💫","🌟","🎵","🎶","🎀","🎪","⭐"];
var SONGS = [];
var musicAudio = new Audio();
var musicIndex = 0;
var musicPlaying = false;
var musicLoop = "all";
var musicShuffle = false;
var musicProgressTimer = null;
var quizBgmManaged = false;
musicAudio.volume = 0.10;

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
  questionTimer: null,
  questionTimeLeft: QUESTION_TIME_LIMIT,
  questionAnswered: false,
  paused: false,
  pauseStartedAt: 0,
  wasMusicPlayingBeforePause: false,
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


function setImageSrc(id, src){
  var el = $(id);
  if (el && src) el.src = src;
}

function getHostArtByTone(tone){
  if (tone === "correct") return HOST_ART.correct;
  if (tone === "wrong") return HOST_ART.wrong || HOST_ART.question;
  if (tone === "timeout") return HOST_ART.timeout || HOST_ART.wrong || HOST_ART.question;
  if (tone === "urgent") return HOST_ART.timewarning;
  if (tone === "intro") return HOST_ART.intro;
  if (tone === "result") return HOST_ART.result || HOST_ART.correct;
  if (tone === "ranking") return HOST_ART.ranking || HOST_ART.intro;
  return HOST_ART.question;
}

function refreshBrandHostVisuals(){
  setImageSrc("home-host-image", HOST_ART.intro);
  setImageSrc("academy-host-image", HOST_ART.correct);
  setImageSrc("leaderboard-brand-image", HOST_ART.ranking || HOST_ART.intro);
  setImageSrc("result-host-image", HOST_ART.result || HOST_ART.correct);
  setImageSrc("host-image", HOST_ART.question);
  setImageSrc("mobile-host-image", HOST_ART.question);
  setImageSrc("pause-host-image", HOST_ART.timeout || HOST_ART.timewarning || HOST_ART.question);
}

function setHostMessage(msg, tone){
  var el = $("host-message");
  if (el) el.textContent = msg;
  var src = getHostArtByTone(tone);
  setImageSrc("host-image", src);
  setImageSrc("mobile-host-image", src);
  var card = $("host-card");
  if (card) {
    card.classList.remove("host-correct","host-wrong","host-urgent","host-timeout");
    if (tone) card.classList.add("host-" + tone);
  }
  var floater = $("mobile-host-sticker");
  if (floater) {
    floater.classList.remove("host-correct","host-wrong","host-urgent","host-timeout","host-reveal","pop");
    if (tone) floater.classList.add("host-" + tone);

    // 手機浮動主持人平時維持「站在旁邊」的正常狀態；
    // 只有公布結果/逾時時才放大強調，避免答題鎖定時先閃 timewarning。
    if (tone === "correct" || tone === "wrong" || tone === "timeout") {
      floater.classList.add("host-reveal");
      void floater.offsetWidth;
      floater.classList.add("pop");
    }
  }
}

function setResultHostVisual(){
  setImageSrc("result-host-image", HOST_ART.result || HOST_ART.correct || HOST_ART.intro);
}

function getQuizIntroMessage(){
  var n = quizState.currentIndex + 1;
  if (n === 1) return "第一題開始！請聽題～";
  if (n === quizState.totalQuestions) return "最後一題，穩住節奏，準備好了嗎？";
  if (n === 5) return "第 5 題來囉，集中注意力！";
  if (n >= 8) return "第 " + n + " 題，挑戰進入尾聲了！";
  return "第 " + n + " 題來囉！請聽題～";
}

function updateSoundButton(){
  var btn = $("btn-sound-toggle");
  if (!btn) return;
  btn.textContent = soundEnabled ? "🔊 音效" : "🔇 靜音";
  btn.classList.toggle("muted", !soundEnabled);
}

function ensureAudioContext(){
  if (!soundEnabled) return null;
  var Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) audioCtx = new Ctx();
  if (audioCtx.state === "suspended") audioCtx.resume().catch(function(){});
  return audioCtx;
}

function clampGain(v){ return Math.max(0.0001, Math.min(0.55, v * SFX_MASTER_GAIN)); }

function beep(freq, duration, type, gainValue, when){
  if (!soundEnabled) return;
  var ctx = ensureAudioContext();
  if (!ctx) return;
  var t0 = typeof when === "number" ? when : ctx.currentTime;
  var dur = duration || 0.12;
  var osc = ctx.createOscillator();
  var gain = ctx.createGain();
  osc.type = type || "sine";
  osc.frequency.setValueAtTime(freq || 440, t0);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(clampGain(gainValue || 0.06), t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

function playTick(secondsLeft){
  var left = Number(secondsLeft || quizState.questionTimeLeft || 5);
  var step = Math.max(1, Math.min(5, left));
  var freqMap = {5:520,4:620,3:760,2:930,1:1120};
  var gainMap = {5:0.075,4:0.09,3:0.115,2:0.14,1:0.17};
  var durMap = {5:0.08,4:0.075,3:0.065,2:0.055,1:0.048};
  beep(freqMap[step] || 720, durMap[step] || 0.055, "square", gainMap[step] || 0.065);
  if (step <= 2) {
    setTimeout(function(){ beep((freqMap[step] || 900) * 1.25, 0.04, "square", 0.09); }, 95);
  }
}
function playCorrect(){
  var ctx = ensureAudioContext();
  if (!ctx) return;
  var now = ctx.currentTime;
  beep(523.25, 0.10, "sine", 0.09, now);
  beep(659.25, 0.11, "sine", 0.105, now + 0.085);
  beep(783.99, 0.18, "triangle", 0.13, now + 0.17);
  beep(1046.5, 0.10, "sine", 0.08, now + 0.29);
}
function playWrong(){
  var ctx = ensureAudioContext();
  if (!ctx) return;
  var now = ctx.currentTime;
  beep(300, 0.10, "sawtooth", 0.095, now);
  beep(210, 0.15, "sawtooth", 0.09, now + 0.09);
  beep(130, 0.26, "triangle", 0.085, now + 0.22);
}
function playTimeout(){
  var ctx = ensureAudioContext();
  if (!ctx) return;
  var now = ctx.currentTime;
  beep(130, 0.48, "triangle", 0.17, now);
  beep(82, 0.60, "sine", 0.13, now + 0.07);
  beep(55, 0.42, "sine", 0.095, now + 0.18);
}

function musicFmt(sec){
  sec = Math.floor(sec || 0);
  return Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0");
}
function normalizeSongAudioPath(song){
  var raw = song.audioUrl || song.audio || song.file || song.src || "";
  if (!raw && song.id) raw = "songs/" + song.id + "/audio.mp3";
  if (/^https?:\/\//.test(raw)) return raw;
  return SONG_BASE + String(raw).replace(/^\.\//, "");
}
function normalizeSongList(data){
  var arr = Array.isArray(data) ? data : (data && Array.isArray(data.songs) ? data.songs : []);
  return arr.map(function(s, i){
    return {
      id: s.id || ("song" + String(i + 1).padStart(3, "0")),
      title: s.title || s.name || ("歌曲 " + (i + 1)),
      artist: s.artist || "氣球小V",
      duration: Number(s.duration || s.seconds || 120),
      audio: normalizeSongAudioPath(s),
      emoji: s.emoji || MUSIC_EMOJIS[i % MUSIC_EMOJIS.length]
    };
  }).filter(function(s){ return !!s.audio; });
}
function fallbackSongs(){
  return normalizeSongList([
    {id:"song001",title:"在小V派對裡夢想",artist:"氣球小V",duration:122,audio:"songs/song001/audio.mp3",emoji:"🎈"},
    {id:"song002",title:"V-MEN",artist:"氣球小V",duration:128,audio:"songs/song002/audio.mp3",emoji:"🎤"},
    {id:"song003",title:"掌心的初光",artist:"氣球小V",duration:123,audio:"songs/song003/audio.mp3",emoji:"✨"},
    {id:"song004",title:"一顆氣球的重量",artist:"氣球小V",duration:259,audio:"songs/song004/audio.mp3",emoji:"💫"},
    {id:"song005",title:"小V派對歌曲 5",artist:"氣球小V",duration:120,audio:"songs/song005/audio.mp3",emoji:"🌟"},
    {id:"song006",title:"小V派對歌曲 6",artist:"氣球小V",duration:120,audio:"songs/song006/audio.mp3",emoji:"🎵"}
  ]);
}
function loadSongs(){
  return fetch(SONG_BASE + "songs.json?v=" + encodeURIComponent(QUIZ_VERSION), { cache:"no-store" })
    .then(function(r){ if (!r.ok) throw new Error("songs.json " + r.status); return r.json(); })
    .then(function(data){
      SONGS = normalizeSongList(data);
      if (!SONGS.length) SONGS = fallbackSongs();
      loadSong(0, false);
      updateSongList();
      toast("🎵 已載入節奏遊戲播放清單：" + SONGS.length + " 首", 1800);
      return SONGS;
    })
    .catch(function(e){
      console.warn("[Music] songs.json load failed:", e.message);
      SONGS = fallbackSongs();
      loadSong(0, false);
      updateSongList();
      return SONGS;
    });
}
function loadSong(index, playAfter){
  if (!SONGS.length) return;
  musicIndex = ((index % SONGS.length) + SONGS.length) % SONGS.length;
  var song = SONGS[musicIndex];
  musicAudio.src = song.audio;
  musicAudio.load();
  var nt = $("mp-nt"), disc = $("mp-disc"), ar = $("mp-ar"), dur = $("mp-dur"), cur = $("mp-cur"), fill = $("mp-fill"), mini = $("mini-title");
  if (nt) nt.textContent = song.title;
  if (disc) disc.textContent = song.emoji;
  if (ar) ar.textContent = song.artist || "氣球小V";
  if (dur) dur.textContent = musicFmt(song.duration);
  if (cur) cur.textContent = "0:00";
  if (fill) fill.style.width = "0%";
  if (mini) mini.textContent = song.emoji + " " + song.title;
  updateSongList();
  if (playAfter) playSong();
}
function playSong(){
  if (!SONGS.length) return;
  if (!musicAudio.src) loadSong(musicIndex || 0, false);
  musicAudio.volume = Number(( $("mp-vol") && $("mp-vol").value ? $("mp-vol").value : 10)) / 100;
  musicAudio.play().then(function(){
    musicPlaying = true;
    updateMusicButtons();
    startMusicProgress();
    updateSongList();
    var disc = $("mp-disc"); if (disc) disc.classList.add("playing");
  }).catch(function(e){
    console.warn("[Music] play failed:", e.message);
    toast("瀏覽器需要你先點一下播放鍵才能播放音樂。", 2400);
  });
}
function pauseSong(){
  musicAudio.pause();
  musicPlaying = false;
  updateMusicButtons();
  stopMusicProgress();
  updateSongList();
  var disc = $("mp-disc"); if (disc) disc.classList.remove("playing");
}
function togglePlay(){ if (musicPlaying) pauseSong(); else playSong(); }
function updateMusicButtons(){
  var icon = musicPlaying ? "⏸" : "▶";
  if ($("mc-play")) $("mc-play").textContent = icon;
  if ($("mp-play2")) $("mp-play2").textContent = icon;
}
function startMusicProgress(){
  stopMusicProgress();
  musicProgressTimer = setInterval(function(){
    var dur = musicAudio.duration || (SONGS[musicIndex] && SONGS[musicIndex].duration) || 120;
    var cur = musicAudio.currentTime || 0;
    if ($("mp-cur")) $("mp-cur").textContent = musicFmt(cur);
    if ($("mp-fill")) $("mp-fill").style.width = dur ? ((cur / dur) * 100) + "%" : "0%";
  }, 500);
}
function stopMusicProgress(){
  if (musicProgressTimer) clearInterval(musicProgressTimer);
  musicProgressTimer = null;
}
function updateSongList(){
  var list = $("mp-list");
  if (!list) return;
  list.innerHTML = "";
  if (!SONGS.length) {
    list.innerHTML = '<div class="mp-item"><div class="mp-item-info"><div class="mp-item-name">播放清單載入中...</div></div></div>';
    return;
  }
  SONGS.forEach(function(song, i){
    var item = document.createElement("div");
    item.className = "mp-item" + (i === musicIndex ? " on" : "");
    item.innerHTML = '<div class="mp-item-num">' + (i + 1) + '</div>' +
      '<div class="mp-item-info"><div class="mp-item-name">' + escapeHtml(song.emoji + " " + song.title) + '</div>' +
      '<div class="mp-item-dur">' + escapeHtml(song.artist || "氣球小V") + ' · ' + musicFmt(song.duration) + '</div></div>' +
      '<div class="mp-eq" style="display:' + (i === musicIndex && musicPlaying ? "" : "none") + '">🎵</div>';
    item.addEventListener("click", function(){ loadSong(i, true); });
    list.appendChild(item);
  });
}
function openMusic(){ updateSongList(); if ($("music-modal")) $("music-modal").classList.add("show"); }
function closeMusic(){ if ($("music-modal")) $("music-modal").classList.remove("show"); }

function startQuizBgm(){
  quizBgmManaged = true;
  if (!SONGS.length) {
    loadSongs().then(function(){ playSong(); });
    return;
  }
  playSong();
}

function pauseQuizBgm(){
  if (!quizBgmManaged) return;
  pauseSong();
  quizBgmManaged = false;
}

function showScreen(id){
  var current = document.querySelector(".screen.active");
  var currentId = current ? current.id : "";

  // 問答 BGM 管理：開始答題後自動播放，結算畫面保持播放；離開結算或中途離開答題時暫停。
  if (quizBgmManaged) {
    var leavingResult = currentId === "screen-result" && id !== "screen-result";
    var leavingQuizBeforeResult = currentId === "screen-quiz" && id !== "screen-result" && id !== "screen-quiz";
    if (leavingResult || leavingQuizBeforeResult) pauseQuizBgm();
  }

  document.querySelectorAll(".screen").forEach(function(s){ s.classList.remove("active"); });
  var el = $(id);
  if (el) el.classList.add("active");
  var floater = $("mobile-host-sticker");
  if (floater) floater.classList.toggle("show", id === "screen-quiz");
  if (id !== "screen-quiz") { stopQuizTimer(); stopQuestionTimer(); quizState.paused = false; hidePauseOverlay(); }
  if (id === "screen-title") {
    setImageSrc("home-host-image", HOST_ART.intro);
    setImageSrc("academy-host-image", HOST_ART.correct);
  }
  if (id === "screen-leaderboard") {
    setImageSrc("leaderboard-brand-image", HOST_ART.ranking || HOST_ART.intro);
    renderLeaderboard();
  }
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

function hasUnlockedAvatar(key) {
  if (!key || !unlockedAvatars) return false;
  var u = unlockedAvatars[key];
  if (!u) return false;
  if (u === true) return true;
  return u.unlocked === true;
}

function getCatalogVisibility(cat) {
  return String((cat && (cat.visibility || cat.visible || cat.displayMode)) || "").toLowerCase();
}

function isStudentCatalogAvatar(key, cat) {
  if (!cat) return false;
  var k = String(key || cat.key || "").toLowerCase();
  var tier = String(cat.tier || "").toLowerCase();
  var type = String(cat.type || cat.category || cat.group || cat.kind || "").toLowerCase();

  return tier === "student" ||
    type === "student" ||
    k.indexOf("student_") === 0 ||
    k.indexOf("student-") === 0 ||
    cat.studentOnly === true ||
    cat.private === true ||
    !!cat.ownerPlayerKey ||
    !!cat.exclusivePlayerKey;
}

function isHiddenUntilUnlockedCatalogAvatar(key, cat) {
  if (!cat) return false;
  var visibility = getCatalogVisibility(cat);
  return cat.hiddenUntilUnlocked === true ||
    visibility === "hiddenuntilunlocked" ||
    visibility === "lockeduntilunlocked" ||
    visibility === "unlock" ||
    visibility === "locked" ||
    cat.manualUnlock === true ||
    cat.requireUnlock === true;
}

function isLockedAvatarHiddenFromPicker(key, cat) {
  // 學生 / 私人 / 指定玩家專屬頭像：未解鎖時完全不出現在選單，避免洩漏。
  return isStudentCatalogAvatar(key, cat);
}

function getAvatarUnlockText(key, cat) {
  var text = cat && (cat.unlockText || cat.unlockCondition || cat.conditionText || cat.hint || cat.description);
  if (text) return String(text);
  if (key === "xiaov_base") return "完成任一遊戲即可解鎖。";
  if (key === "balloon_brother_01") return "完成方塊遊戲指定條件解鎖。";
  if (key === "balloon_brother_02") return "節奏遊戲達成 A / A+ / S 解鎖。";
  if (key === "balloon_brother_03") return "完成指定活動或任務解鎖。";
  return "尚未解鎖，請完成指定條件。";
}

function isDisplayAvatarAllowed(key) {
  if (!key) return false;
  if (isBuiltinAvatar(key)) return true;

  // 解鎖頭像支援新舊格式：
  // 1) unlockedAvatars[key] === true
  // 2) unlockedAvatars[key].unlocked === true
  // 但不能只因為有 metadata / name / src 就視為可用。
  if (hasUnlockedAvatar(key)) return true;

  var cat = AVATAR_CATALOG[key];
  if (!cat || cat.active === false) return false;

  // hiddenUntilUnlocked / manualUnlock / 學生或私人頭像未解鎖時都不可套用。
  if (isHiddenUntilUnlockedCatalogAvatar(key, cat) || isStudentCatalogAvatar(key, cat)) return false;

  // 只有明確公開、且不需解鎖的 catalog 頭像可直接套用。
  return true;
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

  if (unlockedAvatars[key] && typeof unlockedAvatars[key] === "object") {
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

function getBaseAvatarName(key){
  var found = AVATARS.find(function(a){ return a.key === key; });
  if (found) return found.label || found.name || found.key;
  var cat = AVATAR_CATALOG[key];
  if (cat) return cat.name || cat.label || key;
  return key || "未選擇";
}

function getFriendlyIdentityLabel(id, baseAvatarKey){
  var cleanId = normalizePlayerId(id || PLAYER.id || "玩家");
  return cleanId + " + " + getBaseAvatarName(baseAvatarKey || PLAYER.baseAvatarKey || "boy1");
}

function updatePlayerUI(){
  var av = getAvatarByKey(PLAYER.displayAvatarKey);
  PLAYER.avatarSrc = av.src || av.url;
  PLAYER.avatarKey = PLAYER.displayAvatarKey;

  if ($("top-avatar")) $("top-avatar").src = PLAYER.avatarSrc;
  if ($("top-name")) $("top-name").textContent = PLAYER.name || PLAYER.id || "玩家";
  if ($("top-player-key")) $("top-player-key").textContent = PLAYER.playerKey ? ("身份：" + getFriendlyIdentityLabel(PLAYER.id, PLAYER.baseAvatarKey)) : "尚未設定身份";

  if ($("player-id-input")) $("player-id-input").value = PLAYER.id || "";
  if ($("base-avatar-preview")) $("base-avatar-preview").src = getAvatarUrl(PLAYER.baseAvatarKey);
  if ($("display-avatar-preview")) $("display-avatar-preview").src = PLAYER.avatarSrc;
  if ($("profile-player-key")) $("profile-player-key").textContent = getFriendlyIdentityLabel(normalizePlayerId($("player-id-input").value), PLAYER.baseAvatarKey);
}

function getAvailableDisplayAvatars(){
  var list = AVATARS.map(function(a){
    return { key:a.key, name:a.label || a.key, src:a.url, type:"builtin", locked:false };
  });

  function addCandidate(item){
    if (!item || !item.key) return;
    var cat = AVATAR_CATALOG[item.key] || null;
    var unlocked = hasUnlockedAvatar(item.key);
    var mustHideWhenLocked = cat ? isLockedAvatarHiddenFromPicker(item.key, cat) : false;

    // 學生 / 私人專屬頭像：未解鎖時完全不出現。
    if (!unlocked && mustHideWhenLocked) return;

    item.locked = !unlocked && !isDisplayAvatarAllowed(item.key);
    item.unlockText = item.unlockText || getAvatarUnlockText(item.key, cat);
    list.push(item);
  }

  // 固定特殊頭像：未解鎖時也可顯示成鎖住，讓玩家知道解鎖條件。
  UNLOCKABLE_AVATARS.forEach(function(a){
    addCandidate({
      key:a.key,
      name:a.name || a.key,
      src:resolveAvatarSrc(a.file || a.src || a.url),
      type:"unlock",
      unlockText:getAvatarUnlockText(a.key, AVATAR_CATALOG[a.key] || null)
    });
  });

  Object.keys(AVATAR_CATALOG).forEach(function(key){
    var cat = AVATAR_CATALOG[key];
    if (!cat || cat.active === false) return;

    var src = resolveAvatarSrc(cat.src || cat.file || cat.url || "");
    if (!src) return;

    addCandidate({
      key:key,
      name:cat.name || key,
      src:src,
      type:"catalog",
      unlockText:getAvatarUnlockText(key, cat)
    });
  });

  // 去重：同 key 同時存在於 UNLOCKABLE_AVATARS 與 avatarCatalog 時，優先保留已解鎖資料；未解鎖則保留有解鎖文案的鎖定卡。
  var byKey = {};
  list.forEach(function(a){
    var prev = byKey[a.key];
    if (!prev) {
      byKey[a.key] = a;
      return;
    }
    if (prev.locked && !a.locked) byKey[a.key] = a;
    else if (!prev.unlockText && a.unlockText) byKey[a.key] = a;
  });

  return Object.keys(byKey).map(function(key){ return byKey[key]; });
}


function getIdentityChangeWarningText(newAvatarName, newAvatarKey){
  var currentKey = PLAYER.baseAvatarKey || "boy1";
  var playerId = normalizePlayerId(PLAYER.id || "玩家");
  var currentIdentity = getFriendlyIdentityLabel(playerId, currentKey);
  var nextIdentity = getFriendlyIdentityLabel(playerId, newAvatarKey || currentKey);
  return "你正在更換「身份頭像」。\n\n" +
    "身份頭像就像遊戲身分證，會決定成績、解鎖和排行榜歸在哪一個玩家身上。\n" +
    "換成「" + (newAvatarName || newAvatarKey || "新頭像") + "」後，系統會把你當成另一個玩家身份。\n\n" +
    "目前身份：" + currentIdentity + "\n" +
    "新身份：" + nextIdentity + "\n\n" +
    "原本成績、解鎖、排行榜不會自動一起帶過來。\n" +
    "確定要更換身份頭像嗎？";
}

function confirmBaseAvatarChange(av){
  if (!av || !av.key) return false;
  if (av.key === PLAYER.baseAvatarKey) return true;
  return confirm(getIdentityChangeWarningText(av.name || av.key, av.key));
}

function buildAvatarPicker(mode){
  pickerMode = mode;
  var wrap = $("avatar-picker");
  var grid = $("avatar-grid");
  var title = $("avatar-picker-title");
  if (!wrap || !grid) return;

  title.textContent = mode === "base" ? "🔑 選擇身份頭像（遊戲身分證）" : "🎨 選擇顯示頭像（只改外觀）";
  grid.innerHTML = "";
  var oldNote = grid.parentNode.querySelector(".picker-note");
  if (oldNote) oldNote.remove();
  var note = document.createElement("div");
  note.className = "picker-note " + (mode === "base" ? "danger" : "safe");
  note.innerHTML = mode === "base"
    ? "<strong>⚠️ ID + 身份頭像 = 遊戲身分證</strong><br>會決定成績、解鎖和排行榜歸在哪一個玩家身上；只要更換 ID 或身份頭像，系統就會把你當成另一個玩家身份。"
    : "<strong>✅ 顯示頭像 = 外觀造型</strong><br>只改畫面長相，不會改變你的遊戲身份，也不會搬動成績。";
  grid.parentNode.insertBefore(note, grid);

  var list = mode === "base"
    ? AVATARS.map(function(a){ return { key:a.key, name:a.label || a.key, src:a.url }; })
    : getAvailableDisplayAvatars();

  list.forEach(function(av){
    var btn = document.createElement("button");
    btn.className = "avatar-item";
    if (av.locked) btn.classList.add("locked");
    var selected = mode === "base" ? av.key === PLAYER.baseAvatarKey : av.key === PLAYER.displayAvatarKey;
    if (selected) btn.classList.add("selected");
    btn.innerHTML = '<span class="avatar-img-wrap"><img src="' + escapeHtml(av.src) + '" alt="">' +
      (av.locked ? '<b class="avatar-lock-badge">🔒</b>' : '') +
      '</span><span>' + escapeHtml(av.name) + '</span>' +
      (av.locked ? '<em class="avatar-lock-text">未解鎖</em>' : '');
    btn.addEventListener("click", function(){
      if (mode === "base") {
        if (!confirmBaseAvatarChange(av)) {
          toast("已取消更換身份頭像。", 2200);
          return;
        }
        PLAYER.baseAvatarKey = av.key;
        PLAYER.playerKey = makePlayerKey(PLAYER.id, PLAYER.baseAvatarKey);
        // 切換身份頭像時，若目前 display 未必屬於新身份，先暫時退回 base，確認後會重新讀 unlocked。
        PLAYER.displayAvatarKey = av.key;
        PLAYER.avatarKey = av.key;
        PLAYER.avatarSrc = getAvatarUrl(av.key);
        savePlayerLocal();
        updatePlayerUI();
        buildAvatarPicker("base");
        toast("已選擇身份頭像：" + av.name + "\n這會變成新的玩家身份，請再按「確認身份」。", 3600);
      } else {
        if (av.locked || !isDisplayAvatarAllowed(av.key)) {
          toast("🔒 " + av.name + " 尚未解鎖\\n" + (av.unlockText || "請完成指定條件解鎖。"), 3600);
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
          toast("已更換顯示頭像：" + av.name + "\n遊戲身份不會改變。");
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
  quizState.questionTimeLeft = QUESTION_TIME_LIMIT;
  quizState.questionAnswered = false;
  quizState.paused = false;
  quizState.pauseStartedAt = 0;
  quizState.wasMusicPlayingBeforePause = false;
  hidePauseOverlay();
  quizState.totalQuestions = 10;
  ensureAudioContext();
  startQuizBgm();

  showScreen("screen-quiz");
  startQuizTimer();
  renderQuestion();
}

function startQuizTimer(){
  stopQuizTimer();
  quizState.timeTimer = setInterval(function(){
    if (quizState.paused) return;
    var sec = Math.floor((Date.now() - quizState.startedAt) / 1000);
    $("hud-time").textContent = sec + "s";
  }, 250);
}

function stopQuizTimer(){
  if (quizState.timeTimer) clearInterval(quizState.timeTimer);
  quizState.timeTimer = null;
}

function stopQuestionTimer(){
  if (quizState.questionTimer) clearInterval(quizState.questionTimer);
  quizState.questionTimer = null;
}

function startQuestionCountdown(reset){
  stopQuestionTimer();
  if (reset !== false) quizState.questionTimeLeft = QUESTION_TIME_LIMIT;
  updateQuestionTimerUI();
  quizState.questionTimer = setInterval(function(){
    if (!quizState.active || quizState.questionAnswered || quizState.paused) return;
    quizState.questionTimeLeft -= 1;
    if (quizState.questionTimeLeft <= 5 && quizState.questionTimeLeft > 0) {
      playTick(quizState.questionTimeLeft);
      setHostMessage("時間快到了！相信直覺，選一個答案吧！", "urgent");
    }
    updateQuestionTimerUI();
    if (quizState.questionTimeLeft <= 0) {
      handleQuestionTimeout();
    }
  }, 1000);
}

function updateQuestionTimerUI(){
  var left = Math.max(0, quizState.questionTimeLeft || 0);
  var pct = Math.max(0, Math.min(100, (left / QUESTION_TIME_LIMIT) * 100));
  var text = $("question-timer-text");
  var bar = $("question-timer-bar");
  var card = $("timer-card");
  if (text) text.textContent = left + "秒";
  if (bar) bar.style.width = pct + "%";
  if (card) card.classList.toggle("urgent", left <= 5 && left > 0 && !quizState.questionAnswered);
}

function handleQuestionTimeout(){
  stopQuestionTimer();
  if (quizState.questionAnswered) return;
  playTimeout();
  answerQuestion(-1, true);
}
function hidePauseOverlay(){
  var ov = $("quiz-pause-overlay");
  if (ov) ov.classList.add("hidden");
}

function showPauseOverlay(){
  setImageSrc("pause-host-image", HOST_ART.timeout || HOST_ART.timewarning || HOST_ART.question);
  var ov = $("quiz-pause-overlay");
  if (ov) ov.classList.remove("hidden");
}

function pauseQuiz(){
  if (!quizState.active || quizState.paused) return;
  if (quizState.questionAnswered) {
    toast("本題已作答，請先看解析或進下一題。");
    return;
  }
  quizState.paused = true;
  quizState.pauseStartedAt = Date.now();
  quizState.wasMusicPlayingBeforePause = !!musicPlaying;
  stopQuizTimer();
  stopQuestionTimer();
  if (musicPlaying) pauseSong();
  setHostMessage("挑戰暫停中。題目已遮住，準備好再繼續！", "urgent");
  showPauseOverlay();
}

function resumeQuiz(){
  if (!quizState.active || !quizState.paused) return;
  var pausedMs = Math.max(0, Date.now() - (quizState.pauseStartedAt || Date.now()));
  quizState.startedAt += pausedMs;
  quizState.questionStartedAt += pausedMs;
  quizState.paused = false;
  quizState.pauseStartedAt = 0;
  hidePauseOverlay();
  if (quizState.wasMusicPlayingBeforePause) playSong();
  setHostMessage("繼續挑戰！請看題～", "");
  startQuizTimer();
  startQuestionCountdown(false);
  updateQuestionTimerUI();
}


function renderQuestion(){
  var q = quizState.questions[quizState.currentIndex];
  if (!q) return finishQuiz();

  quizState.questionStartedAt = Date.now();
  quizState.questionAnswered = false;
  quizState.questionTimeLeft = QUESTION_TIME_LIMIT;
  setHostMessage(getQuizIntroMessage(), "");
  var qCard = document.querySelector(".question-card");
  if (qCard) qCard.classList.remove("show-correct","show-wrong","show-timeout");
  $("hud-progress").textContent = (quizState.currentIndex + 1) + " / " + quizState.totalQuestions;
  $("hud-score").textContent = quizState.score;
  $("hud-combo").textContent = quizState.combo;
  $("q-subject").textContent = q.subjectName || q.subject;
  $("q-grade").textContent = q.gradeBandName || q.gradeBand;
  $("q-difficulty").textContent = "★".repeat(Math.max(1, Math.min(3, q.difficulty || 1)));
  $("question-text").textContent = q.question;
  $("explanation-box").classList.add("hidden");
  $("btn-next-question").textContent = quizState.currentIndex === quizState.totalQuestions - 1 ? "🎓 查看成績單" : "🎤 下一題，請聽題！";

  var choices = $("choices");
  choices.innerHTML = "";
  (q.choices || []).forEach(function(choice, index){
    var btn = document.createElement("button");
    btn.className = "choice-btn";
    btn.textContent = String.fromCharCode(65 + index) + ". " + choice;
    btn.addEventListener("click", function(){ answerQuestion(index); });
    choices.appendChild(btn);
  });
  startQuestionCountdown();
}

function answerQuestion(selectedIndex, timedOut){
  var q = quizState.questions[quizState.currentIndex];
  if (!q) return;

  var buttons = Array.prototype.slice.call(document.querySelectorAll(".choice-btn"));
  if (quizState.questionAnswered || buttons.some(function(b){ return b.disabled; })) return;
  quizState.questionAnswered = true;
  stopQuestionTimer();

  buttons.forEach(function(btn){ btn.disabled = true; });
  if (!timedOut && selectedIndex >= 0 && buttons[selectedIndex]) {
    buttons[selectedIndex].classList.add("selected-pending");
  }

  var revealDelay = timedOut ? 0 : 320;
  // 選答案後已經停止倒數，等待公布時不切 timewarning；
  // 真正公布時才切 correct / wrong / timeout，讓視覺差異更明確。
  setHostMessage(timedOut ? "時間到！" : "答案鎖定！小V要公布結果囉～", timedOut ? "timeout" : "");

  setTimeout(function(){
    revealAnswerResult(q, selectedIndex, !!timedOut, buttons);
  }, revealDelay);
}

function revealAnswerResult(q, selectedIndex, timedOut, buttons){
  var answerIndex = Number(q.answerIndex);
  var correct = !timedOut && selectedIndex === answerIndex;
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
    timedOut: !!timedOut,
    timeUsed: timeUsed
  });

  buttons.forEach(function(btn, idx){
    btn.classList.remove("selected-pending");
    if (idx === answerIndex) btn.classList.add("correct");
    if (idx === selectedIndex && !correct) btn.classList.add("wrong");
  });

  $("hud-score").textContent = quizState.score;
  $("hud-combo").textContent = quizState.combo;
  var qCard = document.querySelector(".question-card");
  if (qCard) qCard.classList.add(correct ? "show-correct" : (timedOut ? "show-timeout" : "show-wrong"));
  if (correct) { playCorrect(); setHostMessage("答對！太棒了，魔法氣球升起，combo 繼續累積！", "correct"); }
  else if (timedOut) { setHostMessage("時間到！沒關係，看看解析，下題再出發。", "timeout"); }
  else { playWrong(); setHostMessage("答錯了！沒關係，看看解析，下一題再追回來！", "wrong"); }

  $("answer-result").textContent = correct ? "✅ 答對了！" : (timedOut ? "⏰ 時間到！" : "❌ 答錯了");
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
  stopQuestionTimer();
  stopQuizTimer();
  quizState.active = false;

  var totalTime = Math.max(0, Math.round((Date.now() - quizState.startedAt) / 1000));
  var accuracy = quizState.totalQuestions ? quizState.correctCount / quizState.totalQuestions : 0;

  $("result-score").textContent = quizState.score;
  $("result-correct").textContent = quizState.correctCount + " / " + quizState.totalQuestions;
  $("result-accuracy").textContent = Math.round(accuracy * 100) + "%";
  $("result-max-combo").textContent = quizState.maxCombo;
  $("result-time").textContent = totalTime + "s";

  var title = "🎉 小V宣布：挑戰完成！";
  var emoji = "🎈";
  if (quizState.correctCount === 10) { title = "🏆 V學園滿分王！"; emoji = "🏆"; }
  else if (quizState.correctCount >= 8) { title = "🌟 知識派對高手！"; emoji = "🌟"; }
  else if (quizState.correctCount >= 5) { title = "🎉 穩定挑戰者！"; emoji = "🎉"; }
  else { title = "💪 再接再厲學員！"; emoji = "💪"; }
  $("result-title").textContent = title;
  $("result-emoji").textContent = emoji;
  setResultHostVisual();
  if ($("result-unlock-banner")) $("result-unlock-banner").classList.add("hidden");

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


function ensureXiaovBaseCatalog(){
  return ensureFirebaseReady().then(function(ok){
    if (!ok || !firebaseDb) return null;

    var now = Date.now();
    var catalogRef = firebaseDb.ref("avatarCatalog/xiaov_base");

    return catalogRef.once("value").then(function(snap){
      if (snap.exists()) {
        var data = snap.val() || {};
        if (data.active !== true) {
          return catalogRef.update({
            active: true,
            allowAsBaseAvatar: false,
            manualUnlock: true,
            visibility: "hiddenUntilUnlocked",
            updatedAt: now,
            updatedBy: "quiz-game"
          });
        }
        return null;
      }

      return catalogRef.set({
        key: "xiaov_base",
        name: "氣球小V",
        type: "special",
        active: true,
        allowAsBaseAvatar: false,
        manualUnlock: true,
        visibility: "hiddenUntilUnlocked",
        unlockText: "完成任一遊戲解鎖",
        file: "assets/avatars/xiaov_base.png",
        fileName: "xiaov_base.png",
        createdAt: now,
        createdBy: "quiz-game",
        updatedAt: now,
        updatedBy: "quiz-game"
      });
    });
  });
}

function unlockXiaovBaseAfterGameComplete(){
  if (!PLAYER || !PLAYER.playerKey) return Promise.resolve(null);

  return ensureFirebaseReady().then(function(ok){
    if (!ok || !firebaseDb) return null;

    return ensureXiaovBaseCatalog().then(function(){
      var unlockRef = firebaseDb.ref(DB_PATHS.players + "/" + PLAYER.playerKey + "/unlockedAvatars/xiaov_base");
      return unlockRef.once("value").then(function(snap){
        if (snap.exists()) return null;

        var payload = {
          unlocked: true,
          type: "special",
          source: "any-game-complete",
          unlockedBy: "quiz-game",
          unlockedAt: Date.now(),
          name: "氣球小V",
          file: "assets/avatars/xiaov_base.png",
          visibility: "hiddenUntilUnlocked"
        };

        return unlockRef.set(payload).then(function(){
          // 只更新本機解鎖快取，方便玩家不重新整理也能在顯示頭像清單看到。
          // 不修改 PLAYER.baseAvatarKey / displayAvatarKey / avatarKey / playerKey，也不自動裝備。
          unlockedAvatars.xiaov_base = payload;
          return payload;
        });
      });
    });
  });
}

function showAvatarUnlockBanner(unlockPayload){
  var box = $("result-unlock-banner");
  if (!box || !unlockPayload) return;
  var title = $("unlock-title");
  var msg = $("unlock-message");
  var name = unlockPayload.name || "新顯示頭像";
  if (title) title.textContent = "🎉 新頭像解鎖：" + name;
  if (msg) msg.textContent = "完成問答挑戰成功解鎖！到「玩家設定 → 選顯示頭像」可以手動裝備；目前遊戲身份不會改變。";
  box.classList.remove("hidden");
  box.classList.remove("pop");
  void box.offsetWidth;
  box.classList.add("pop");
}

function saveQuizResult(totalTime, accuracy){
  var record = buildQuizRecord(totalTime, accuracy);
  $("save-status").textContent = "正在保存本次成績、個人進度、排行榜與 V學園成績單...";
  if ($("result-academy-progress")) $("result-academy-progress").classList.add("hidden");
  if ($("result-unlock-banner")) $("result-unlock-banner").classList.add("hidden");

  saveLocalLog(record);

  var academyBefore = null;
  return loadQuizAcademyProgressSummary().then(function(before){
      academyBefore = before;
      return saveGameLog(record);
    })
    .then(function(){
      return unlockXiaovBaseAfterGameComplete().catch(function(err){
        console.warn("[Quiz] unlock xiaov_base failed:", err);
        return null;
      });
    })
    .then(function(unlockResult){
      return updateQuizProgress(record).then(function(progressResult){
        return { unlockResult: unlockResult, progressResult: progressResult };
      });
    })
    .then(function(stage){
      var progressResult = stage.progressResult;
      return updateGradeLeaderboard(record.gradeBand).then(function(gradeRecord){
        return updateMainLeaderboardFromGrades().then(function(mainRecord){
          return updateQuizAcademyProgress().then(function(academyAfter){
            return { unlockResult:stage.unlockResult, progressResult:progressResult, gradeRecord:gradeRecord, mainRecord:mainRecord, academyAfter:academyAfter };
          });
        });
      });
    })
    .then(function(result){
      var progress = result.progressResult && result.progressResult.progress;
      var bestUpdated = result.progressResult && result.progressResult.bestUpdated;
      var gradeRecord = result.gradeRecord || {};
      var mainRecord = result.mainRecord || {};
      var academyAfter = result.academyAfter || null;
      var unlockResult = result.unlockResult || null;
      var subjectName = record.subjectName || record.subject;
      showAvatarUnlockBanner(unlockResult);
      var lines = ["✅ 本次紀錄已保存"];
      if (bestUpdated) lines.push("✅ " + subjectName + "最佳紀錄刷新！");
      else if (progress) lines.push(subjectName + "最佳仍維持 " + (progress.bestScore || 0) + " 分");
      lines.push("🌱 " + (record.gradeBandName || record.gradeBand) + "總分：" + (gradeRecord.gradeTotalScore || 0) + " 分");
      lines.push("🏆 總榜總分：" + (mainRecord.totalScore || 0) + " 分");
      if (!bestUpdated) lines.push("再挑戰其他科目，也可以提升 V學園完成度。");
      $("save-status").textContent = lines.join("\n");

      if ($("result-academy-progress") && $("result-academy-lines")) {
        $("result-academy-lines").textContent = buildAcademyResultLines(academyBefore, academyAfter);
        $("result-academy-progress").classList.remove("hidden");
      }
      renderAcademyProgress(academyAfter);
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


function getTotalSubjectSlots(){
  return GRADE_OPTIONS.length * SUBJECT_OPTIONS.length;
}

function getEmptyGradeProgress(){
  return {
    completedSubjects: 0,
    perfectSubjects: 0,
    totalSubjects: SUBJECT_OPTIONS.length
  };
}

function readQuizProgressMap(){
  return ensureFirebaseReady().then(function(ok){
    if (!ok || !firebaseDb || !PLAYER.playerKey) throw new Error("Firebase not ready");
    return firebaseDb.ref(DB_PATHS.players + "/" + PLAYER.playerKey + "/quizProgress").once("value").then(function(snap){
      return snap.val() || {};
    });
  });
}

function calculateQuizAcademyProgress(progressRoot){
  var now = Date.now();
  var totalSubjectSlots = getTotalSubjectSlots();
  var quizPower = 0;
  var completedSubjects = 0;
  var perfectSubjects = 0;
  var totalCorrect = 0;
  var totalQuestions = 0;
  var totalAttempts = 0;
  var allGradesPerfect = true;

  var gradeProgress = {};

  GRADE_OPTIONS.forEach(function(grade){
    var gradeMap = (progressRoot && progressRoot[grade.key]) || {};
    var gradeCompleted = 0;
    var gradePerfect = 0;
    var gradeCorrect = 0;
    var gradeQuestions = 0;
    var gradeAttempts = 0;

    SUBJECT_OPTIONS.forEach(function(subject){
      var p = gradeMap[subject.key];
      if (!p || typeof p !== "object" || (!p.bestScore && !p.attempts)) return;

      var bestCorrect = Number(p.bestCorrectCount || 0);
      var bestQuestions = Number(p.bestTotalQuestions || p.totalQuestions || 10);
      var bestScore = Number(p.bestScore || 0);
      var attempts = Number(p.attempts || 0);
      var isPerfect = p.perfect === true || (bestQuestions > 0 && bestCorrect >= bestQuestions);

      gradeCompleted += 1;
      completedSubjects += 1;
      totalCorrect += bestCorrect;
      totalQuestions += bestQuestions;
      totalAttempts += attempts;
      gradeCorrect += bestCorrect;
      gradeQuestions += bestQuestions;
      gradeAttempts += attempts;

      quizPower += 20;                // 已挑戰該科
      quizPower += bestCorrect * 5;   // 最佳答對題數
      if (bestScore >= 1000) quizPower += 30;
      if (isPerfect) {
        quizPower += 80;
        gradePerfect += 1;
        perfectSubjects += 1;
      }
    });

    if (gradeCompleted >= SUBJECT_OPTIONS.length) quizPower += 200;
    if (gradePerfect >= SUBJECT_OPTIONS.length) quizPower += 500;
    if (gradePerfect < SUBJECT_OPTIONS.length) allGradesPerfect = false;

    gradeProgress[grade.key] = {
      completedSubjects: gradeCompleted,
      perfectSubjects: gradePerfect,
      totalSubjects: SUBJECT_OPTIONS.length,
      totalCorrect: gradeCorrect,
      totalQuestions: gradeQuestions,
      totalAttempts: gradeAttempts
    };
  });

  if (perfectSubjects >= totalSubjectSlots && allGradesPerfect) quizPower += 1000;

  return {
    gameId: "quiz",
    version: QUIZ_VERSION,

    playerKey: PLAYER.playerKey,
    id: PLAYER.id,
    name: PLAYER.name || PLAYER.id,

    quizPower: quizPower,

    completedSubjects: completedSubjects,
    perfectSubjects: perfectSubjects,
    totalSubjectSlots: totalSubjectSlots,

    totalCorrect: totalCorrect,
    totalQuestions: totalQuestions,
    totalAttempts: totalAttempts,

    gradeProgress: gradeProgress,

    updatedAt: now,
    date: new Date(now).toISOString()
  };
}

function hasAcademyActivity(academy){
  if (!academy) return false;
  return Number(academy.completedSubjects || 0) > 0 ||
    Number(academy.quizPower || 0) > 0 ||
    Number(academy.totalCorrect || 0) > 0;
}

function readStoredQuizAcademyProgress(){
  return ensureFirebaseReady().then(function(ok){
    if (!ok || !firebaseDb || !PLAYER.playerKey) return null;
    return firebaseDb.ref(DB_PATHS.players + "/" + PLAYER.playerKey + "/quizAcademyProgress").once("value").then(function(snap){
      return snap.val() || null;
    });
  }).catch(function(e){
    console.warn("[Academy] stored summary read failed:", e.message);
    return null;
  });
}

function calculateQuizPowerFromGradeSummary(summary){
  var quizPower = 0;
  var allGradesPerfect = true;

  GRADE_OPTIONS.forEach(function(g){
    var gp = summary.gradeProgress[g.key] || getEmptyGradeProgress();
    var completed = Number(gp.completedSubjects || 0);
    var perfect = Number(gp.perfectSubjects || 0);
    var totalSubjects = Number(gp.totalSubjects || SUBJECT_OPTIONS.length);
    var correct = Number(gp.totalCorrect || 0);
    var gradeScore = Number(gp.gradeTotalScore || 0);

    quizPower += completed * 20;
    quizPower += correct * 5;

    // byGrade 只有彙總資料，無法精準知道每一科是否達 1000 分；用年級總分保守估算。
    var estimatedHighScoreSubjects = Math.min(completed, Math.floor(gradeScore / 1000));
    quizPower += estimatedHighScoreSubjects * 30;

    quizPower += perfect * 80;
    if (completed >= totalSubjects) quizPower += 200;
    if (perfect >= totalSubjects) quizPower += 500;
    if (perfect < totalSubjects) allGradesPerfect = false;
  });

  if (summary.perfectSubjects >= summary.totalSubjectSlots && allGradesPerfect) quizPower += 1000;
  return quizPower;
}

function buildAcademyProgressFromGradeLeaderboards(gradeRecords){
  var now = Date.now();
  var totalSubjectSlots = getTotalSubjectSlots();
  var summary = {
    gameId: "quiz",
    version: QUIZ_VERSION,
    playerKey: PLAYER.playerKey,
    id: PLAYER.id,
    name: PLAYER.name || PLAYER.id,
    quizPower: 0,
    completedSubjects: 0,
    perfectSubjects: 0,
    totalSubjectSlots: totalSubjectSlots,
    totalCorrect: 0,
    totalQuestions: 0,
    totalAttempts: 0,
    gradeProgress: {},
    rebuiltFrom: "leaderboardsByGrade",
    updatedAt: now,
    date: new Date(now).toISOString()
  };

  GRADE_OPTIONS.forEach(function(g){
    var rec = gradeRecords && gradeRecords[g.key] ? gradeRecords[g.key] : null;
    var gp = getEmptyGradeProgress();
    if (rec) {
      gp.completedSubjects = Number(rec.completedSubjects || 0);
      gp.perfectSubjects = Number(rec.perfectSubjects || 0);
      gp.totalSubjects = SUBJECT_OPTIONS.length;
      gp.totalCorrect = Number(rec.totalCorrect || 0);
      gp.totalQuestions = Number(rec.totalQuestions || gp.completedSubjects * 10 || 0);
      gp.totalAttempts = Number(rec.totalAttempts || 0);
      gp.gradeTotalScore = Number(rec.gradeTotalScore || 0);

      summary.completedSubjects += gp.completedSubjects;
      summary.perfectSubjects += gp.perfectSubjects;
      summary.totalCorrect += gp.totalCorrect;
      summary.totalQuestions += gp.totalQuestions;
      summary.totalAttempts += gp.totalAttempts;
    }
    summary.gradeProgress[g.key] = gp;
  });

  summary.quizPower = calculateQuizPowerFromGradeSummary(summary);
  return summary;
}

function readGradeLeaderboardSelfSummary(){
  return ensureFirebaseReady().then(function(ok){
    if (!ok || !firebaseDb || !PLAYER.playerKey) return null;
    var jobs = GRADE_OPTIONS.map(function(g){
      return firebaseDb.ref(DB_PATHS.leaderboardsByGrade + "/" + g.key + "/" + PLAYER.playerKey)
        .once("value")
        .then(function(snap){ return { key:g.key, val:snap.val() || null }; });
    });
    return Promise.all(jobs).then(function(rows){
      var records = {};
      var hasAny = false;
      rows.forEach(function(row){
        if (row.val) {
          records[row.key] = row.val;
          hasAny = true;
        }
      });
      return hasAny ? buildAcademyProgressFromGradeLeaderboards(records) : null;
    });
  }).catch(function(e){
    console.warn("[Academy] byGrade fallback read failed:", e.message);
    return null;
  });
}


function normalizeLogRecordForProgress(log){
  if (!log || typeof log !== "object") return null;
  if (log.playerKey !== PLAYER.playerKey) return null;
  if (!log.gradeBand || !log.subject) return null;

  var ts = Number(log.ts || log.updatedAt || Date.parse(log.date || "") || 0);
  return {
    gameId: "quiz",
    version: log.version || QUIZ_VERSION,
    playerKey: PLAYER.playerKey,
    gradeBand: log.gradeBand,
    gradeBandName: log.gradeBandName || getGradeName(log.gradeBand),
    subject: log.subject,
    subjectName: log.subjectName || getSubjectName(log.subject),
    score: Number(log.score || 0),
    correctCount: Number(log.correctCount || 0),
    maxCombo: Number(log.maxCombo || 0),
    timeUsedTotal: Number(log.timeUsedTotal || log.timeUsed || 0),
    totalQuestions: Number(log.totalQuestions || 10),
    ts: ts
  };
}

function buildProgressRootFromGameLogs(logMap){
  var progressRoot = {};
  var rows = [];
  Object.keys(logMap || {}).forEach(function(key){
    var rec = normalizeLogRecordForProgress(logMap[key]);
    if (rec) rows.push(rec);
  });

  // 依時間由舊到新重建，attempts 才會累加成接近真實遊玩次數。
  rows.sort(function(a,b){ return (a.ts || 0) - (b.ts || 0); });

  rows.forEach(function(rec){
    if (!progressRoot[rec.gradeBand]) progressRoot[rec.gradeBand] = {};
    var oldProgress = progressRoot[rec.gradeBand][rec.subject] || {};
    var result = makeSubjectProgressFromRecord(rec, oldProgress);
    progressRoot[rec.gradeBand][rec.subject] = result.progress;
  });

  return progressRoot;
}

function pickBetterSubjectProgress(a, b){
  if (!a) return b || null;
  if (!b) return a || null;

  var aBest = {
    score: Number(a.bestScore || 0),
    correctCount: Number(a.bestCorrectCount || 0),
    maxCombo: Number(a.bestMaxCombo || 0),
    timeUsedTotal: Number(a.bestTimeUsedTotal || 999999),
    ts: Number(a.bestUpdatedAt || a.updatedAt || 0)
  };
  var bBest = {
    score: Number(b.bestScore || 0),
    correctCount: Number(b.bestCorrectCount || 0),
    maxCombo: Number(b.bestMaxCombo || 0),
    timeUsedTotal: Number(b.bestTimeUsedTotal || 999999),
    ts: Number(b.bestUpdatedAt || b.updatedAt || 0)
  };

  var useB = shouldUpdateBestRecord(aBest, bBest);
  var picked = Object.assign({}, useB ? b : a);

  // 合併時 attempts 取較大值，避免 quizProgress 與 gameLogs 同一場重複加總。
  picked.attempts = Math.max(Number(a.attempts || 0), Number(b.attempts || 0));

  // last* 取 updatedAt 較新的來源，讓「最近一場」資訊合理。
  var aUpdated = Number(a.updatedAt || a.bestUpdatedAt || 0);
  var bUpdated = Number(b.updatedAt || b.bestUpdatedAt || 0);
  var latest = bUpdated >= aUpdated ? b : a;
  ["lastScore","lastCorrectCount","lastMaxCombo","lastTimeUsedTotal","lastTotalQuestions"].forEach(function(k){
    if (latest[k] !== undefined) picked[k] = latest[k];
  });

  picked.perfect = Number(picked.bestCorrectCount || 0) >= Number(picked.bestTotalQuestions || picked.totalQuestions || 10);
  picked.totalQuestions = Number(picked.bestTotalQuestions || picked.totalQuestions || 10);
  return picked;
}

function mergeProgressRoots(baseRoot, extraRoot){
  var merged = JSON.parse(JSON.stringify(baseRoot || {}));
  Object.keys(extraRoot || {}).forEach(function(gradeKey){
    if (!merged[gradeKey]) merged[gradeKey] = {};
    Object.keys(extraRoot[gradeKey] || {}).forEach(function(subjectKey){
      merged[gradeKey][subjectKey] = pickBetterSubjectProgress(merged[gradeKey][subjectKey], extraRoot[gradeKey][subjectKey]);
    });
  });
  return merged;
}

function filterLogsByCurrentPlayer(logs){
  var out = {};
  Object.keys(logs || {}).forEach(function(key){
    var log = logs[key];
    if (log && log.playerKey === PLAYER.playerKey) out[key] = log;
  });
  return out;
}

function readGameLogsProgressRoot(){
  return ensureFirebaseReady().then(function(ok){
    if (!ok || !firebaseDb || !PLAYER.playerKey) return null;

    return firebaseDb.ref(DB_PATHS.gameLogs)
      .orderByChild("playerKey")
      .equalTo(PLAYER.playerKey)
      .once("value")
      .then(function(snap){
        var logs = snap.val() || {};
        if (logs && Object.keys(logs).length) return buildProgressRootFromGameLogs(logs);

        // 如果舊資料未建 index 或舊規則讓 equalTo 查不到，最後改用全表讀取後本機過濾。
        return firebaseDb.ref(DB_PATHS.gameLogs).once("value").then(function(allSnap){
          var allLogs = filterLogsByCurrentPlayer(allSnap.val() || {});
          return Object.keys(allLogs).length ? buildProgressRootFromGameLogs(allLogs) : null;
        });
      });
  }).catch(function(e){
    console.warn("[Academy] gameLogs progressRoot read failed:", e.message);
    return null;
  });
}

function readGameLogsAcademyFallback(){
  return readGameLogsProgressRoot().then(function(progressRoot){
    if (!progressRoot) return null;
    var academy = calculateQuizAcademyProgress(progressRoot);
    academy.rebuiltFrom = "gameLogs";
    return hasAcademyActivity(academy) ? academy : null;
  });
}

function loadQuizAcademyProgressSummary(){
  var progressRootBase = {};

  return readQuizProgressMap()
    .then(function(progressRoot){
      progressRootBase = progressRoot || {};
      // 重要：即使 quizProgress 已有部分新資料，也要合併舊 gameLogs，避免只顯示最新一場。
      return readGameLogsProgressRoot();
    })
    .then(function(logProgressRoot){
      var mergedRoot = logProgressRoot ? mergeProgressRoots(logProgressRoot, progressRootBase) : progressRootBase;
      var mergedAcademy = calculateQuizAcademyProgress(mergedRoot);
      if (hasAcademyActivity(mergedAcademy)) {
        mergedAcademy.rebuiltFrom = logProgressRoot ? "quizProgress+gameLogs" : "quizProgress";
        return mergedAcademy;
      }
      return readStoredQuizAcademyProgress();
    })
    .then(function(stored){
      if (stored && hasAcademyActivity(stored)) return stored;
      return readGradeLeaderboardSelfSummary();
    })
    .then(function(fallback){
      if (fallback && hasAcademyActivity(fallback)) return fallback;
      return calculateQuizAcademyProgress({});
    })
    .catch(function(e){
      console.warn("[Academy] summary load failed:", e.message);
      return readStoredQuizAcademyProgress().then(function(stored){
        if (stored && hasAcademyActivity(stored)) return stored;
        return readGradeLeaderboardSelfSummary().then(function(fallback){
          if (fallback && hasAcademyActivity(fallback)) return fallback;
          return readGameLogsAcademyFallback().then(function(logFallback){
            return logFallback || calculateQuizAcademyProgress({});
          });
        });
      });
    });
}

function updateQuizAcademyProgress(){
  return loadQuizAcademyProgressSummary().then(function(academy){
    if (!firebaseDb || !PLAYER.playerKey) return academy;
    return firebaseDb.ref(DB_PATHS.players + "/" + PLAYER.playerKey + "/quizAcademyProgress")
      .set(academy)
      .then(function(){ return academy; });
  });
}


function getAcademyTitle(quizPower){
  quizPower = Number(quizPower || 0);
  if (quizPower >= 6000) return "V學園傳說挑戰者";
  if (quizPower >= 4000) return "知識派對王";
  if (quizPower >= 2500) return "V學園優等生";
  if (quizPower >= 1500) return "氣球智慧使者";
  if (quizPower >= 800) return "派對知識學徒";
  if (quizPower >= 300) return "見習知識魔法師";
  return "V學園新生";
}

function setAcademyProgressBar(gradeKey, completed, total){
  var bar = $("academy-" + gradeKey + "-bar");
  if (!bar) return;
  total = Math.max(1, Number(total || SUBJECT_OPTIONS.length));
  var pct = Math.max(0, Math.min(100, Math.round((Number(completed || 0) / total) * 100)));
  bar.style.width = pct + "%";
}

function renderAcademyProgress(academy){
  academy = academy || {
    quizPower: 0,
    completedSubjects: 0,
    perfectSubjects: 0,
    totalSubjectSlots: getTotalSubjectSlots(),
    totalCorrect: 0,
    gradeProgress: {
      low: getEmptyGradeProgress(),
      middle: getEmptyGradeProgress(),
      high: getEmptyGradeProgress()
    }
  };

  var totalSlots = academy.totalSubjectSlots || getTotalSubjectSlots();
  var quizPower = Number(academy.quizPower || 0);
  if ($("academy-power")) $("academy-power").textContent = quizPower;
  if ($("academy-title")) $("academy-title").textContent = getAcademyTitle(quizPower);
  if ($("academy-completed")) $("academy-completed").textContent = (academy.completedSubjects || 0) + " / " + totalSlots;
  if ($("academy-perfect")) $("academy-perfect").textContent = academy.perfectSubjects || 0;
  if ($("academy-correct")) $("academy-correct").textContent = academy.totalCorrect || 0;

  GRADE_OPTIONS.forEach(function(g){
    var gp = (academy.gradeProgress && academy.gradeProgress[g.key]) || getEmptyGradeProgress();
    var total = gp.totalSubjects || SUBJECT_OPTIONS.length;
    var completed = gp.completedSubjects || 0;
    var el = $("academy-" + g.key);
    if (el) el.textContent = completed + " / " + total + "｜滿分 " + (gp.perfectSubjects || 0);
    setAcademyProgressBar(g.key, completed, total);
  });

  if ($("academy-updated")) {
    $("academy-updated").textContent = academy.updatedAt ? "已更新" : "尚未開始";
  }
}

function refreshAcademyProgressCard(){
  if (!hasConfirmedQuizProfile() || !PLAYER.playerKey) {
    renderAcademyProgress(null);
    return Promise.resolve(null);
  }
  return loadQuizAcademyProgressSummary().then(function(academy){
    renderAcademyProgress(academy);
    return academy;
  }).catch(function(e){
    console.warn("[Academy] refresh failed:", e.message);
    renderAcademyProgress(null);
    return null;
  });
}

function buildAcademyResultLines(before, after){
  after = after || null;
  if (!after) return "V學園進度暫時無法更新。";
  var beforePower = before ? Number(before.quizPower || 0) : 0;
  var afterPower = Number(after.quizPower || 0);
  var delta = afterPower - beforePower;
  var gradeKey = selectedGrade;
  var grade = GRADE_OPTIONS.find(function(g){ return g.key === gradeKey; }) || {name:gradeKey};
  var gp = (after.gradeProgress && after.gradeProgress[gradeKey]) || getEmptyGradeProgress();
  var lines = [];
  lines.push("知識力：" + beforePower + " → " + afterPower + (delta > 0 ? "（+" + delta + "）" : ""));
  lines.push("稱號：" + getAcademyTitle(afterPower));
  lines.push("已挑戰科目：" + (after.completedSubjects || 0) + " / " + (after.totalSubjectSlots || getTotalSubjectSlots()));
  lines.push("滿分科目：" + (after.perfectSubjects || 0));
  lines.push(grade.name + "進度：" + (gp.completedSubjects || 0) + " / " + (gp.totalSubjects || SUBJECT_OPTIONS.length) + "｜滿分 " + (gp.perfectSubjects || 0));
  if (delta <= 0) lines.push("提示：挑戰其他科目或刷新最佳紀錄，也能推進 V學園進度！");
  return lines.join("\n");
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
  if (leaderboardMode === "main") desc.textContent = "🏆 總榜：低 / 中 / 高三個年級總分加總，代表玩家目前的 V學園整體成就。";
  else desc.textContent = "年級榜：該年級各科最佳分數加總，鼓勵挑戰不同科目。";
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
        '<span><b>總成就</b>｜' + (r.completedSubjects || 0) + '科 / 滿分' + (r.perfectSubjects || 0) + '科｜' + escapeHtml(r.gradeSummaryText || "尚未完成挑戰") + '</span></div>' +
        '<div class="lb-score"><small>總分</small>' + (r.totalScore || 0) + '</div>';
    } else {
      row.innerHTML =
        '<div class="lb-rank">' + (idx + 1) + '</div>' +
        '<img src="' + escapeHtml(src) + '" alt="">' +
        '<div class="lb-main"><strong>' + escapeHtml(r.name || r.id || "玩家") + '</strong>' +
        '<span><b>年級累積</b>｜' + (r.completedSubjects || 0) + '科 / 滿分' + (r.perfectSubjects || 0) + '科｜' + escapeHtml((r.subjectNames || []).join(" / ") || r.subjectSummaryText || "-") + '｜' + formatSeconds(r.totalTimeUsed || 0) + '</span></div>' +
        '<div class="lb-score"><small>年級分</small>' + (r.gradeTotalScore || 0) + '</div>';
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

function bindMusicEvents(){
  if (bindMusicEvents._bound) return;
  bindMusicEvents._bound = true;
  if ($("btn-music-title")) $("btn-music-title").addEventListener("click", openMusic);
  if ($("mc-prev")) $("mc-prev").addEventListener("click", function(){ if (SONGS.length) loadSong(musicIndex - 1, musicPlaying); });
  if ($("mc-next")) $("mc-next").addEventListener("click", function(){ if (SONGS.length) loadSong(musicIndex + 1, musicPlaying); });
  if ($("mc-play")) $("mc-play").addEventListener("click", togglePlay);
  if ($("mc-list")) $("mc-list").addEventListener("click", openMusic);
  if ($("mp-prev2")) $("mp-prev2").addEventListener("click", function(){ if (SONGS.length) loadSong(musicIndex - 1, musicPlaying); });
  if ($("mp-next2")) $("mp-next2").addEventListener("click", function(){ if (SONGS.length) loadSong(musicIndex + 1, musicPlaying); });
  if ($("mp-play2")) $("mp-play2").addEventListener("click", togglePlay);
  if ($("mp-close")) $("mp-close").addEventListener("click", closeMusic);
  if ($("music-modal")) $("music-modal").addEventListener("click", function(e){ if (e.target === $("music-modal")) closeMusic(); });
  if ($("mp-prog")) $("mp-prog").addEventListener("click", function(e){
    var r = $("mp-prog").getBoundingClientRect();
    var pct = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    var dur = musicAudio.duration || (SONGS[musicIndex] && SONGS[musicIndex].duration) || 120;
    musicAudio.currentTime = pct * dur;
  });
  if ($("mp-vol")) $("mp-vol").addEventListener("input", function(e){ musicAudio.volume = Number(e.target.value || 10) / 100; });
  if ($("mp-shuf")) $("mp-shuf").addEventListener("click", function(){
    musicShuffle = !musicShuffle;
    $("mp-shuf").classList.toggle("act", musicShuffle);
    toast(musicShuffle ? "🔀 隨機播放開啟" : "🔀 隨機播放關閉");
  });
  if ($("mp-loop")) $("mp-loop").addEventListener("click", function(){
    var modes = ["all", "one", "none"];
    var labels = ["全部循環", "單曲循環", "不循環"];
    var icons = ["🔁", "🔂", "➡"];
    musicLoop = modes[(modes.indexOf(musicLoop) + 1) % modes.length];
    var i = modes.indexOf(musicLoop);
    $("mp-loop").textContent = icons[i];
    $("mp-badge").textContent = labels[i];
    $("mp-loop").classList.toggle("act", musicLoop !== "none");
    toast("循環模式：" + labels[i]);
  });
  musicAudio.addEventListener("ended", function(){
    if (musicLoop === "one") {
      musicAudio.currentTime = 0;
      playSong();
    } else if (musicLoop === "all" || musicShuffle) {
      var next = musicShuffle ? Math.floor(Math.random() * Math.max(1, SONGS.length)) : musicIndex + 1;
      loadSong(next, true);
    } else {
      pauseSong();
    }
  });
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
  if ($("btn-game-menu")) $("btn-game-menu").addEventListener("click", function(){
    window.top.location.href = GAME_MENU_URL;
  });
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
  if ($("btn-sound-toggle")) {
    updateSoundButton();
    $("btn-sound-toggle").addEventListener("click", function(){
      soundEnabled = !soundEnabled;
      localStorage.setItem("vquiz_soundEnabled", soundEnabled ? "true" : "false");
      if (soundEnabled) { ensureAudioContext(); beep(660, 0.10, "sine", 0.09); }
      updateSoundButton();
    });
  }
  bindMusicEvents();
  if ($("btn-pause-quiz")) $("btn-pause-quiz").addEventListener("click", pauseQuiz);
  if ($("btn-resume-quiz")) $("btn-resume-quiz").addEventListener("click", resumeQuiz);
  if ($("btn-pause-quit")) $("btn-pause-quit").addEventListener("click", function(){
    if (confirm("確定要離開本次挑戰嗎？本局不會寫入紀錄。")) {
      quizState.paused = false;
      hidePauseOverlay();
      stopQuizTimer();
      stopQuestionTimer();
      showScreen("screen-title");
    }
  });
  document.addEventListener("keydown", function(e){
    if (e.key === "Escape" && quizState.active && document.querySelector("#screen-quiz.active")) {
      if (quizState.paused) resumeQuiz();
      else pauseQuiz();
    }
  });
  $("btn-start-quiz").addEventListener("click", startQuiz);
  $("btn-play-again").addEventListener("click", function(){ showScreen("screen-setup"); });
  $("btn-quit-quiz").addEventListener("click", function(){
    if (confirm("確定要離開本次挑戰嗎？本局不會寫入紀錄。")) {
      quizState.paused = false;
      hidePauseOverlay();
      stopQuizTimer();
      stopQuestionTimer();
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
      return refreshAcademyProgressCard();
    }).then(function(){
      toast("玩家身份已確認！\\n" + getFriendlyIdentityLabel(PLAYER.id, PLAYER.baseAvatarKey));
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
  refreshBrandHostVisuals();
  loadSongs();

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
      if (alreadyConfirmed) return ensurePlayerProfile().then(refreshAcademyProgressCard);
      renderAcademyProgress(null);
      return null;
    })
    .catch(function(e){ console.warn("[Init] Firebase/profile init skipped:", e.message); });

  loadQuestions();
}

document.addEventListener("DOMContentLoaded", init);
