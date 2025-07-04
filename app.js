require("dotenv").config();

const express = require("express");
const RSSParser = require("rss-parser");
const axios = require("axios");
const fs = require("fs").promises;
const fsSync = require("fs");
const path = require("path");
const he = require("he");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { exec } = require("child_process");
const { promisify } = require("util");
const { createCanvas, loadImage, registerFont } = require("canvas");
const textToSpeech = require("@google-cloud/text-to-speech");
const { spawn } = require("child_process");

const app = express();
const parser = new RSSParser();
const PORT = 3002;

// View engine setup
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Static files
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Data file path
const DATA_FILE = path.join(__dirname, "data", "questions.json");
const LAST_FETCH_FILE = path.join(__dirname, "data", "last_fetched.json");

// StackOverflow API base URL
const SO_API_BASE = "https://api.stackexchange.com/2.3";

// Programlama dili renkleri, logoları ve tasarım varyasyonları
const LANGUAGE_THEMES = {
  javascript: {
    color: "#F7DF1E",
    bgColor: "#1E1E1E",
    textColor: "#FFFFFF",
    icon: "⚡",
    logoUrl: "https://raw.githubusercontent.com/devicons/devicon/master/icons/javascript/javascript-original.svg",
  },
  typescript: {
    color: "#3178C6",
    bgColor: "#FFFFFF",
    textColor: "#3178C6",
    icon: "📘",
    logoUrl: "https://raw.githubusercontent.com/devicons/devicon/master/icons/typescript/typescript-original.svg",
  },
  python: {
    color: "#3776AB",
    bgColor: "#FFD43B",
    textColor: "#3776AB",
    icon: "🐍",
    logoUrl: "https://raw.githubusercontent.com/devicons/devicon/master/icons/python/python-original.svg",
  },
  java: {
    color: "#ED8B00",
    bgColor: "#FFFFFF",
    textColor: "#ED8B00",
    icon: "☕",
    logoUrl: "https://raw.githubusercontent.com/devicons/devicon/master/icons/java/java-original.svg",
  },
  "c#": {
    color: "#239120",
    bgColor: "#FFFFFF",
    textColor: "#239120",
    icon: "#️⃣",
    logoUrl: "https://raw.githubusercontent.com/devicons/devicon/master/icons/csharp/csharp-original.svg",
  },
  "c++": {
    color: "#00599C",
    bgColor: "#FFFFFF",
    textColor: "#00599C",
    icon: "⚙️",
    logoUrl: "https://raw.githubusercontent.com/devicons/devicon/master/icons/cplusplus/cplusplus-original.svg",
  },
  php: {
    color: "#777BB4",
    bgColor: "#FFFFFF",
    textColor: "#777BB4",
    icon: "🐘",
    logoUrl: "https://raw.githubusercontent.com/devicons/devicon/master/icons/php/php-original.svg",
  },
  go: {
    color: "#00ADD8",
    bgColor: "#FFFFFF",
    textColor: "#00ADD8",
    icon: "🐹",
    logoUrl: "https://raw.githubusercontent.com/devicons/devicon/master/icons/go/go-original.svg",
  },
  rust: {
    color: "#CE422B",
    bgColor: "#FFFFFF",
    textColor: "#CE422B",
    icon: "🦀",
    logoUrl: "https://raw.githubusercontent.com/devicons/devicon/master/icons/rust/rust-plain.svg",
  },
  kotlin: {
    color: "#7F52FF",
    bgColor: "#FFFFFF",
    textColor: "#7F52FF",
    icon: "🎯",
    logoUrl: "https://raw.githubusercontent.com/devicons/devicon/master/icons/kotlin/kotlin-original.svg",
  },
  swift: {
    color: "#FA7343",
    bgColor: "#FFFFFF",
    textColor: "#FA7343",
    icon: "🍎",
    logoUrl: "https://raw.githubusercontent.com/devicons/devicon/master/icons/swift/swift-original.svg",
  },
  react: {
    color: "#61DAFB",
    bgColor: "#20232A",
    textColor: "#61DAFB",
    icon: "⚛️",
    logoUrl: "https://raw.githubusercontent.com/devicons/devicon/master/icons/react/react-original.svg",
  },
  vue: {
    color: "#4FC08D",
    bgColor: "#FFFFFF",
    textColor: "#4FC08D",
    icon: "💚",
    logoUrl: "https://raw.githubusercontent.com/devicons/devicon/master/icons/vuejs/vuejs-original.svg",
  },
  angular: {
    color: "#DD0031",
    bgColor: "#FFFFFF",
    textColor: "#DD0031",
    icon: "🅰️",
    logoUrl: "https://raw.githubusercontent.com/devicons/devicon/master/icons/angularjs/angularjs-original.svg",
  },
  nodejs: {
    color: "#339933",
    bgColor: "#FFFFFF",
    textColor: "#339933",
    icon: "🟢",
    logoUrl: "https://raw.githubusercontent.com/devicons/devicon/master/icons/nodejs/nodejs-original.svg",
  },
  flutter: {
    color: "#02569B",
    bgColor: "#FFFFFF",
    textColor: "#02569B",
    icon: "🦋",
    logoUrl: "https://raw.githubusercontent.com/devicons/devicon/master/icons/flutter/flutter-original.svg",
  },
  "react-native": {
    color: "#61DAFB",
    bgColor: "#20232A",
    textColor: "#61DAFB",
    icon: "📱",
    logoUrl: "https://raw.githubusercontent.com/devicons/devicon/master/icons/react/react-original.svg",
  },
  android: {
    color: "#3DDC84",
    bgColor: "#FFFFFF",
    textColor: "#3DDC84",
    icon: "🤖",
    logoUrl: "https://raw.githubusercontent.com/devicons/devicon/master/icons/android/android-original.svg",
  },
  html: {
    color: "#E34F26",
    bgColor: "#FFFFFF",
    textColor: "#E34F26",
    icon: "🌐",
    logoUrl: "https://raw.githubusercontent.com/devicons/devicon/master/icons/html5/html5-original.svg",
  },
  css: {
    color: "#1572B6",
    bgColor: "#FFFFFF",
    textColor: "#1572B6",
    icon: "🎨",
    logoUrl: "https://raw.githubusercontent.com/devicons/devicon/master/icons/css3/css3-original.svg",
  },
  bootstrap: {
    color: "#7952B3",
    bgColor: "#FFFFFF",
    textColor: "#7952B3",
    icon: "🅱️",
    logoUrl: "https://raw.githubusercontent.com/devicons/devicon/master/icons/bootstrap/bootstrap-original.svg",
  },
  mongodb: {
    color: "#47A248",
    bgColor: "#FFFFFF",
    textColor: "#47A248",
    icon: "🍃",
    logoUrl: "https://raw.githubusercontent.com/devicons/devicon/master/icons/mongodb/mongodb-original.svg",
  },
  mysql: {
    color: "#4479A1",
    bgColor: "#FFFFFF",
    textColor: "#4479A1",
    icon: "🐬",
    logoUrl: "https://raw.githubusercontent.com/devicons/devicon/master/icons/mysql/mysql-original.svg",
  },
  docker: {
    color: "#2496ED",
    bgColor: "#FFFFFF",
    textColor: "#2496ED",
    icon: "🐳",
    logoUrl: "https://raw.githubusercontent.com/devicons/devicon/master/icons/docker/docker-original.svg",
  },
  git: {
    color: "#F05032",
    bgColor: "#FFFFFF",
    textColor: "#F05032",
    icon: "📝",
    logoUrl: "https://raw.githubusercontent.com/devicons/devicon/master/icons/git/git-original.svg",
  },
  linux: { color: "#FCC624", bgColor: "#000000", textColor: "#FCC624", icon: "🐧" },
  bash: { color: "#4EAA25", bgColor: "#000000", textColor: "#4EAA25", icon: "💻" },
  powershell: { color: "#5391FE", bgColor: "#FFFFFF", textColor: "#5391FE", icon: "💻" },
  "machine-learning": { color: "#FF6F00", bgColor: "#FFFFFF", textColor: "#FF6F00", icon: "🤖" },
  tensorflow: { color: "#FF6F00", bgColor: "#FFFFFF", textColor: "#FF6F00", icon: "🧠" },
  pytorch: { color: "#EE4C2C", bgColor: "#FFFFFF", textColor: "#EE4C2C", icon: "🔥" },
  pandas: { color: "#150458", bgColor: "#FFFFFF", textColor: "#150458", icon: "🐼" },
  numpy: { color: "#013243", bgColor: "#FFFFFF", textColor: "#013243", icon: "🔢" },
  django: { color: "#092E20", bgColor: "#FFFFFF", textColor: "#092E20", icon: "🎸" },
  flask: { color: "#000000", bgColor: "#FFFFFF", textColor: "#000000", icon: "🌶️" },
  laravel: { color: "#FF2D20", bgColor: "#FFFFFF", textColor: "#FF2D20", icon: "🎭" },
  "spring-boot": { color: "#6DB33F", bgColor: "#FFFFFF", textColor: "#6DB33F", icon: "🍃" },
  ".net": { color: "#512BD4", bgColor: "#FFFFFF", textColor: "#512BD4", icon: "🔷" },
  unity: { color: "#000000", bgColor: "#FFFFFF", textColor: "#000000", icon: "🎮" },
  firebase: { color: "#FFCA28", bgColor: "#FFFFFF", textColor: "#FFCA28", icon: "🔥" },
  graphql: { color: "#E10098", bgColor: "#FFFFFF", textColor: "#E10098", icon: "📊" },
  webpack: { color: "#8DD6F9", bgColor: "#FFFFFF", textColor: "#8DD6F9", icon: "📦" },
  nextjs: { color: "#000000", bgColor: "#FFFFFF", textColor: "#000000", icon: "▲" },
  nuxtjs: { color: "#00DC82", bgColor: "#FFFFFF", textColor: "#00DC82", icon: "💚" },
  express: { color: "#000000", bgColor: "#FFFFFF", textColor: "#000000", icon: "🚂" },
  elasticsearch: { color: "#005571", bgColor: "#FFFFFF", textColor: "#005571", icon: "🔍" },
  rabbitmq: { color: "#FF6600", bgColor: "#FFFFFF", textColor: "#FF6600", icon: "🐰" },
  nginx: { color: "#009639", bgColor: "#FFFFFF", textColor: "#009639", icon: "🌐" },
  apache: { color: "#D22128", bgColor: "#FFFFFF", textColor: "#D22128", icon: "🪶" },
  selenium: { color: "#43B02A", bgColor: "#FFFFFF", textColor: "#43B02A", icon: "🤖" },
  jest: { color: "#C21325", bgColor: "#FFFFFF", textColor: "#C21325", icon: "🃏" },
  cypress: { color: "#17202C", bgColor: "#FFFFFF", textColor: "#17202C", icon: "🌲" },
  regex: { color: "#FF6B35", bgColor: "#FFFFFF", textColor: "#FF6B35", icon: "🔤" },
  json: { color: "#000000", bgColor: "#FFFFFF", textColor: "#000000", icon: "📄" },
  xml: { color: "#FF6600", bgColor: "#FFFFFF", textColor: "#FF6600", icon: "📋" },
  api: { color: "#FF6B35", bgColor: "#FFFFFF", textColor: "#FF6B35", icon: "🔌" },
  rest: { color: "#02569B", bgColor: "#FFFFFF", textColor: "#02569B", icon: "🌐" },
  websocket: { color: "#010101", bgColor: "#FFFFFF", textColor: "#010101", icon: "🔌" },
  oauth: { color: "#EB5424", bgColor: "#FFFFFF", textColor: "#EB5424", icon: "🔐" },
  jwt: { color: "#000000", bgColor: "#FFFFFF", textColor: "#000000", icon: "🎫" },
  blockchain: { color: "#F7931A", bgColor: "#FFFFFF", textColor: "#F7931A", icon: "⛓️" },
  solidity: { color: "#363636", bgColor: "#FFFFFF", textColor: "#363636", icon: "💎" },
  electron: { color: "#47848F", bgColor: "#FFFFFF", textColor: "#47848F", icon: "⚛️" },
  cordova: { color: "#E8E8E8", bgColor: "#000000", textColor: "#E8E8E8", icon: "📱" },
  xamarin: { color: "#3498DB", bgColor: "#FFFFFF", textColor: "#3498DB", icon: "📱" },
  ios: { color: "#000000", bgColor: "#FFFFFF", textColor: "#000000", icon: "📱" },
  default: {
    color: "#6366F1",
    bgColor: "#FFFFFF",
    textColor: "#6366F1",
    icon: "💻",
    logoUrl: null,
  },
};

// Tasarım varyasyonları
const DESIGN_VARIANTS = ["modern", "gradient", "minimal", "geometric", "neon"];

// Renk paletleri ve tasarım varyasyonları
const COLOR_PALETTES = [
  // Sunset
  { primary: "#FF6B6B", secondary: "#4ECDC4", accent: "#45B7D1", bg1: "#96CEB4", bg2: "#FFEAA7" },
  // Ocean
  { primary: "#0984e3", secondary: "#74b9ff", accent: "#00b894", bg1: "#00cec9", bg2: "#6c5ce7" },
  // Forest
  { primary: "#00b894", secondary: "#55a3ff", accent: "#fdcb6e", bg1: "#6c5ce7", bg2: "#fd79a8" },
  // Purple
  { primary: "#a29bfe", secondary: "#fd79a8", accent: "#fdcb6e", bg1: "#e17055", bg2: "#74b9ff" },
  // Fire
  { primary: "#e17055", secondary: "#fdcb6e", accent: "#fd79a8", bg1: "#ff7675", bg2: "#74b9ff" },
  // Neon
  { primary: "#00ff88", secondary: "#00d4ff", accent: "#ff0080", bg1: "#8000ff", bg2: "#ffff00" },
  // Retro
  { primary: "#ff6b9d", secondary: "#c44569", accent: "#f8b500", bg1: "#3742fa", bg2: "#2ed573" },
  // Corporate
  { primary: "#2c3e50", secondary: "#3498db", accent: "#e74c3c", bg1: "#95a5a6", bg2: "#f39c12" },
];

// Tasarım layoutları
const LAYOUT_VARIANTS = ["left-aligned", "centered", "diagonal", "corner", "split"];

// Şekil varyasyonları
const SHAPE_VARIANTS = ["circles", "triangles", "hexagons", "waves", "geometric", "organic"];

// Ensure data directory exists
async function ensureDataDir() {
  const dataDir = path.join(__dirname, "data");
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

// Load existing data
async function loadQuestions() {
  try {
    const data = await fs.readFile(DATA_FILE, "utf8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

// Save questions
async function saveQuestions(questions) {
  await ensureDataDir();
  await fs.writeFile(DATA_FILE, JSON.stringify(questions, null, 2));
}

// StackOverflow RSS URLs for different categories
const RSS_FEEDS = {
  javascript: "https://stackoverflow.com/feeds/tag?tagnames=javascript&sort=newest",
  python: "https://stackoverflow.com/feeds/tag?tagnames=python&sort=newest",
  nodejs: "https://stackoverflow.com/feeds/tag?tagnames=node.js&sort=newest",
  react: "https://stackoverflow.com/feeds/tag?tagnames=reactjs&sort=newest",
  vue: "https://stackoverflow.com/feeds/tag?tagnames=vue.js&sort=newest",
  angular: "https://stackoverflow.com/feeds/tag?tagnames=angular&sort=newest",
  php: "https://stackoverflow.com/feeds/tag?tagnames=php&sort=newest",
  java: "https://stackoverflow.com/feeds/tag?tagnames=java&sort=newest",
  "c#": "https://stackoverflow.com/feeds/tag?tagnames=c%23&sort=newest",
  sql: "https://stackoverflow.com/feeds/tag?tagnames=sql&sort=newest",
  typescript: "https://stackoverflow.com/feeds/tag?tagnames=typescript&sort=newest",
  "c++": "https://stackoverflow.com/feeds/tag?tagnames=c%2B%2B&sort=newest",
  go: "https://stackoverflow.com/feeds/tag?tagnames=go&sort=newest",
  rust: "https://stackoverflow.com/feeds/tag?tagnames=rust&sort=newest",
  kotlin: "https://stackoverflow.com/feeds/tag?tagnames=kotlin&sort=newest",
  swift: "https://stackoverflow.com/feeds/tag?tagnames=swift&sort=newest",
  flutter: "https://stackoverflow.com/feeds/tag?tagnames=flutter&sort=newest",
  "react-native": "https://stackoverflow.com/feeds/tag?tagnames=react-native&sort=newest",
  android: "https://stackoverflow.com/feeds/tag?tagnames=android&sort=newest",
  ios: "https://stackoverflow.com/feeds/tag?tagnames=ios&sort=newest",
  html: "https://stackoverflow.com/feeds/tag?tagnames=html&sort=newest",
  css: "https://stackoverflow.com/feeds/tag?tagnames=css&sort=newest",
  bootstrap: "https://stackoverflow.com/feeds/tag?tagnames=bootstrap&sort=newest",
  jquery: "https://stackoverflow.com/feeds/tag?tagnames=jquery&sort=newest",
  express: "https://stackoverflow.com/feeds/tag?tagnames=express&sort=newest",
  mysql: "https://stackoverflow.com/feeds/tag?tagnames=mysql&sort=newest",
  postgresql: "https://stackoverflow.com/feeds/tag?tagnames=postgresql&sort=newest",
  redis: "https://stackoverflow.com/feeds/tag?tagnames=redis&sort=newest",
  docker: "https://stackoverflow.com/feeds/tag?tagnames=docker&sort=newest",
  kubernetes: "https://stackoverflow.com/feeds/tag?tagnames=kubernetes&sort=newest",
  aws: "https://stackoverflow.com/feeds/tag?tagnames=amazon-web-services&sort=newest",
  azure: "https://stackoverflow.com/feeds/tag?tagnames=azure&sort=newest",
  git: "https://stackoverflow.com/feeds/tag?tagnames=git&sort=newest",
  linux: "https://stackoverflow.com/feeds/tag?tagnames=linux&sort=newest",
  bash: "https://stackoverflow.com/feeds/tag?tagnames=bash&sort=newest",
  powershell: "https://stackoverflow.com/feeds/tag?tagnames=powershell&sort=newest",
  "machine-learning": "https://stackoverflow.com/feeds/tag?tagnames=machine-learning&sort=newest",
  tensorflow: "https://stackoverflow.com/feeds/tag?tagnames=tensorflow&sort=newest",
  pytorch: "https://stackoverflow.com/feeds/tag?tagnames=pytorch&sort=newest",
  pandas: "https://stackoverflow.com/feeds/tag?tagnames=pandas&sort=newest",
  numpy: "https://stackoverflow.com/feeds/tag?tagnames=numpy&sort=newest",
  django: "https://stackoverflow.com/feeds/tag?tagnames=django&sort=newest",
  flask: "https://stackoverflow.com/feeds/tag?tagnames=flask&sort=newest",
  laravel: "https://stackoverflow.com/feeds/tag?tagnames=laravel&sort=newest",
  "spring-boot": "https://stackoverflow.com/feeds/tag?tagnames=spring-boot&sort=newest",
  ".net": "https://stackoverflow.com/feeds/tag?tagnames=.net&sort=newest",
  unity: "https://stackoverflow.com/feeds/tag?tagnames=unity3d&sort=newest",
  firebase: "https://stackoverflow.com/feeds/tag?tagnames=firebase&sort=newest",
  graphql: "https://stackoverflow.com/feeds/tag?tagnames=graphql&sort=newest",
  webpack: "https://stackoverflow.com/feeds/tag?tagnames=webpack&sort=newest",
  nextjs: "https://stackoverflow.com/feeds/tag?tagnames=next.js&sort=newest",
  nuxtjs: "https://stackoverflow.com/feeds/tag?tagnames=nuxt.js&sort=newest",
  tailwind: "https://stackoverflow.com/feeds/tag?tagnames=tailwind-css&sort=newest",
  sass: "https://stackoverflow.com/feeds/tag?tagnames=sass&sort=newest",
  elasticsearch: "https://stackoverflow.com/feeds/tag?tagnames=elasticsearch&sort=newest",
  rabbitmq: "https://stackoverflow.com/feeds/tag?tagnames=rabbitmq&sort=newest",
  nginx: "https://stackoverflow.com/feeds/tag?tagnames=nginx&sort=newest",
  apache: "https://stackoverflow.com/feeds/tag?tagnames=apache&sort=newest",
  selenium: "https://stackoverflow.com/feeds/tag?tagnames=selenium&sort=newest",
  jest: "https://stackoverflow.com/feeds/tag?tagnames=jestjs&sort=newest",
  cypress: "https://stackoverflow.com/feeds/tag?tagnames=cypress&sort=newest",
  regex: "https://stackoverflow.com/feeds/tag?tagnames=regex&sort=newest",
  json: "https://stackoverflow.com/feeds/tag?tagnames=json&sort=newest",
  xml: "https://stackoverflow.com/feeds/tag?tagnames=xml&sort=newest",
  api: "https://stackoverflow.com/feeds/tag?tagnames=api&sort=newest",
  rest: "https://stackoverflow.com/feeds/tag?tagnames=rest&sort=newest",
  websocket: "https://stackoverflow.com/feeds/tag?tagnames=websocket&sort=newest",
  oauth: "https://stackoverflow.com/feeds/tag?tagnames=oauth&sort=newest",
  jwt: "https://stackoverflow.com/feeds/tag?tagnames=jwt&sort=newest",
  blockchain: "https://stackoverflow.com/feeds/tag?tagnames=blockchain&sort=newest",
  solidity: "https://stackoverflow.com/feeds/tag?tagnames=solidity&sort=newest",
  electron: "https://stackoverflow.com/feeds/tag?tagnames=electron&sort=newest",
  cordova: "https://stackoverflow.com/feeds/tag?tagnames=cordova&sort=newest",
  xamarin: "https://stackoverflow.com/feeds/tag?tagnames=xamarin&sort=newest",
  mongodb: "https://stackoverflow.com/feeds/tag?tagnames=mongodb&sort=newest",
};

// Extract question ID from StackOverflow URL
function extractQuestionId(url) {
  const match = url.match(/\/questions\/(\d+)\//);
  return match ? match[1] : null;
}

// Son çekilen sorunun id/tarihini oku (kategori+mod)
async function loadLastFetched(category, mode) {
  try {
    const data = await fs.readFile(LAST_FETCH_FILE, "utf8");
    const obj = JSON.parse(data);
    return obj[`${category}_${mode}`] || null;
  } catch {
    return null;
  }
}

// Son çekilen sorunun id/tarihini kaydet (kategori+mod)
async function saveLastFetched(category, mode, value) {
  let obj = {};
  try {
    const data = await fs.readFile(LAST_FETCH_FILE, "utf8");
    obj = JSON.parse(data);
  } catch {}
  obj[`${category}_${mode}`] = value;
  await fs.writeFile(LAST_FETCH_FILE, JSON.stringify(obj, null, 2));
}

// HTML entity'lerini çözen fonksiyon
function decodeHtmlEntities(text) {
  if (!text) return "";
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&rsquo;/g, "’")
    .replace(/&lsquo;/g, "‘")
    .replace(/&ldquo;/g, "“")
    .replace(/&rdquo;/g, "”");
}

// Fetch question details with answers from StackOverflow API (sadece çözümlü)
async function fetchQuestionDetails(questionId) {
  try {
    const response = await axios.get(`${SO_API_BASE}/questions/${questionId}`, {
      params: {
        site: "stackoverflow",
        filter: "withbody",
        sort: "votes",
      },
    });
    if (response.data.items.length === 0) return null;
    const question = response.data.items[0];
    // Sadece çözümlenmiş sorular
    if (!question.is_answered) return null;
    // Fetch answers
    const answersResponse = await axios.get(`${SO_API_BASE}/questions/${questionId}/answers`, {
      params: {
        site: "stackoverflow",
        filter: "withbody",
        sort: "votes",
        pagesize: 5,
      },
    });
    const answers = answersResponse.data.items.map((answer) => ({
      id: answer.answer_id,
      body: answer.body,
      score: answer.score,
      isAccepted: answer.is_accepted || false,
      author: answer.owner ? answer.owner.display_name : "Anonymous",
      creationDate: new Date(answer.creation_date * 1000).toISOString(),
    }));
    // En az bir kabul edilmiş cevap olmalı
    if (!answers.some((a) => a.isAccepted)) return null;
    return {
      id: question.question_id,
      title: decodeHtmlEntities(question.title),
      body: decodeHtmlEntities(question.body),
      score: question.score,
      viewCount: question.view_count,
      answerCount: question.answer_count,
      tags: question.tags,
      author: question.owner ? question.owner.display_name : "Anonymous",
      creationDate: new Date(question.creation_date * 1000).toISOString(),
      answers: answers.sort((a, b) => {
        if (a.isAccepted) return -1;
        if (b.isAccepted) return 1;
        return b.score - a.score;
      }),
    };
  } catch (error) {
    console.error(`Error fetching question details for ID ${questionId}:`, error.message);
    return null;
  }
}

// Clean HTML tags from text
function cleanHtml(html) {
  if (!html) return "";
  return html
    .replace(/<code[^>]*>([^<]*)<\/code>/g, "`$1`")
    .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/g, "\n```\n$1\n```\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .trim();
}

// Gelişmiş süre hesaplama fonksiyonu
function calculateReadingTime(text, hasCode = false, codeContent = "") {
  if (!text && !codeContent) return 2;

  // Temel okuma parametreleri
  const wordsPerMinute = 200; // Biraz daha hızlı okuma
  const wordsPerSecond = wordsPerMinute / 60;

  // Metin analizi
  const wordCount = text ? text.trim().split(/\s+/).length : 0;
  let baseReadingTime = wordCount / wordsPerSecond;

  // Kod analizi
  let codeAnalysisTime = 0;
  if (hasCode && codeContent) {
    codeAnalysisTime = analyzeCodeComplexity(codeContent);
  }

  // Toplam süre
  let totalTime = baseReadingTime + codeAnalysisTime;

  // Minimum süreler (kısaltıldı)
  if (hasCode) {
    totalTime = Math.max(4, totalTime); // Kod varsa minimum 4 saniye
  } else {
    totalTime = Math.max(2, totalTime); // Sadece metin varsa minimum 2 saniye
  }

  // Maksimum süre sınırı (kısaltıldı)
  totalTime = Math.min(20, totalTime);

  return Math.round(totalTime);
}

// Kod karmaşıklığını analiz eden fonksiyon
function analyzeCodeComplexity(code) {
  if (!code) return 0;

  const lines = code.split("\n").filter((line) => line.trim() !== "");
  let complexityScore = 0;

  // Temel süre: satır başına 0.5 saniye (kısaltıldı)
  complexityScore += lines.length * 0.5;

  // Kod yapıları analizi (puanlar daha da kısaltıldı)
  const codeStructures = {
    // Kontrol yapıları (daha fazla düşünme gerektirir)
    if: 1.2,
    else: 0.8,
    for: 1.5,
    while: 1.5,
    switch: 1.5,
    case: 0.6,
    try: 1.2,
    catch: 1.2,
    finally: 0.8,

    // Fonksiyon tanımları
    function: 1.5,
    "=>": 1.2, // Arrow functions
    return: 0.6,

    // Nesne ve dizi işlemleri
    map: 1.2,
    filter: 1.2,
    reduce: 2,
    forEach: 0.8,
    find: 0.8,
    sort: 1.2,
    splice: 1.2,
    push: 0.4,
    pop: 0.4,

    // Async işlemler
    async: 1.2,
    await: 1.2,
    Promise: 1.5,
    then: 1.2,
    catch: 1.2,

    // DOM işlemleri
    document: 0.8,
    getElementById: 0.8,
    querySelector: 0.8,
    addEventListener: 1.2,

    // Regex ve string işlemleri
    match: 1.2,
    replace: 0.8,
    split: 0.6,
    join: 0.6,
    substring: 0.8,

    // Matematiksel işlemler
    "Math.": 0.8,
    parseInt: 0.6,
    parseFloat: 0.6,

    // Konsol ve debug
    "console.log": 0.2,
    "console.error": 0.2,
  };

  // Kod yapılarını say ve puan ekle
  for (const [structure, points] of Object.entries(codeStructures)) {
    const regex = new RegExp(structure.replace(".", "\\."), "gi");
    const matches = code.match(regex);
    if (matches) {
      complexityScore += matches.length * points;
    }
  }

  // Parantez derinliği analizi (nested yapılar) - daha da kısaltıldı
  let maxDepth = 0;
  let currentDepth = 0;
  for (const char of code) {
    if (char === "{" || char === "(" || char === "[") {
      currentDepth++;
      maxDepth = Math.max(maxDepth, currentDepth);
    } else if (char === "}" || char === ")" || char === "]") {
      currentDepth--;
    }
  }
  complexityScore += maxDepth * 0.8;

  // Uzun satırlar (80+ karakter) - daha da kısaltıldı
  const longLines = lines.filter((line) => line.length > 80).length;
  complexityScore += longLines * 0.6;

  // Yorum satırları (açıklama gerektirir) - daha da kısaltıldı
  const commentLines = lines.filter((line) => line.trim().startsWith("//") || line.includes("/*")).length;
  complexityScore += commentLines * 0.2;

  // String literal'lar (regex, template strings) - daha da kısaltıldı
  const stringComplexity =
    (code.match(/`[^`]*`/g) || []).length * 0.8 + // Template strings
    (code.match(/\/.*\//g) || []).length * 1.2 + // Regex
    (code.match(/"[^"]*"/g) || []).length * 0.1; // Normal strings
  complexityScore += stringComplexity;

  return complexityScore;
}

// Kod formatını düzelten gelişmiş fonksiyon - KULLANILMIYOR, SİLİNDİ
// function formatCode(code) {
//   Bu fonksiyon orijinal indentasyonu bozduğu için kaldırıldı
// }
// fetchRSSData fonksiyonu: son çekilen id'yi kategori+mod'a göre oku/kaydet
async function fetchRSSData(category, limit = 5, sortBy = "votes") {
  try {
    const url = RSS_FEEDS[category];
    if (!url) throw new Error("Invalid category");
    const apiUrl = `${SO_API_BASE}/questions`;
    let page = 1;
    let fetched = [];
    // Mevcut soruları yükle
    const existingQuestions = await loadQuestions();
    const existingIds = new Set(existingQuestions.map((q) => q.id));
    // Son çekilen id'yi kategori+mod'a göre al
    const lastFetched = await loadLastFetched(category, sortBy);
    let stop = false;
    while (fetched.length < limit && !stop) {
      const response = await axios.get(apiUrl, {
        params: {
          site: "stackoverflow",
          tagged: category,
          sort: sortBy,
          order: sortBy === "votes" ? "desc" : "desc",
          filter: "withbody",
          pagesize: 20,
          page,
        },
      });
      for (const item of response.data.items) {
        if (!item.is_answered) continue;
        if (lastFetched && item.question_id == lastFetched) {
          stop = true;
          break;
        }
        if (existingIds.has(item.question_id.toString())) continue;
        const details = await fetchQuestionDetails(item.question_id);
        if (!details) continue;
        const question = {
          id: item.question_id.toString(),
          stackoverflowId: item.question_id.toString(),
          title: decodeHtmlEntities(item.title),
          link: item.link,
          description: decodeHtmlEntities(item.title),
          pubDate: new Date(item.creation_date * 1000).toISOString(),
          category: category,
          fetchedAt: new Date().toISOString(),
          fullBody: cleanHtml(details.body),
          score: details.score,
          viewCount: details.viewCount,
          answerCount: details.answerCount,
          tags: details.tags,
          author: details.author,
          answers: details.answers.map((answer) => ({ ...answer, body: cleanHtml(decodeHtmlEntities(answer.body)) })),
          hasAcceptedAnswer: details.answers.some((a) => a.isAccepted),
        };
        fetched.push(question);
        if (fetched.length >= limit) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (!response.data.has_more) break;
      page++;
    }
    // Son çekilen id'yi kategori+mod'a göre kaydet
    if (fetched.length > 0) {
      await saveLastFetched(category, sortBy, fetched[0].stackoverflowId);
    }
    return fetched;
  } catch (error) {
    console.error(`Error fetching RSS for ${category}:`, error);
    return [];
  }
}

// Routes
app.get("/", async (req, res) => {
  const questions = await loadQuestions();
  const categories = Object.keys(RSS_FEEDS);

  // İstatistikler
  const stats = {
    total: questions.length,
    withAnswers: questions.filter((q) => q.answers && q.answers.length > 0).length,
    withAcceptedAnswers: questions.filter((q) => q.hasAcceptedAnswer).length,
    categories: Object.keys(RSS_FEEDS).map((cat) => ({
      name: cat,
      count: questions.filter((q) => q.category === cat).length,
    })),
  };

  res.render("index", { questions, categories, stats });
});

app.post("/fetch/:category", async (req, res) => {
  const category = req.params.category;
  const limit = parseInt(req.body.limit) || 5;
  const sortBy = req.body.sortBy || "votes";

  if (!RSS_FEEDS[category]) {
    return res.status(400).json({ error: "Invalid category" });
  }

  try {
    const newQuestions = await fetchRSSData(category, limit, sortBy);
    const existingQuestions = await loadQuestions();
    const allQuestions = [...existingQuestions, ...newQuestions];
    await saveQuestions(allQuestions);
    res.json({
      success: true,
      newCount: newQuestions.length,
      totalCount: allQuestions.length,
      withAnswersCount: newQuestions.filter((q) => q.answers && q.answers.length > 0).length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/questions", async (req, res) => {
  const questions = await loadQuestions();
  const category = req.query.category;
  const hasAnswers = req.query.hasAnswers;
  const sortBy = req.query.sortBy || "fetchedAt";

  let filteredQuestions = questions;

  // Kategori filtresi
  if (category && category !== "all") {
    filteredQuestions = filteredQuestions.filter((q) => q.category === category);
  }

  // Cevap filtresi
  if (hasAnswers === "true") {
    filteredQuestions = filteredQuestions.filter((q) => q.answers && q.answers.length > 0);
  } else if (hasAnswers === "false") {
    filteredQuestions = filteredQuestions.filter((q) => !q.answers || q.answers.length === 0);
  }

  // Sıralama
  filteredQuestions.sort((a, b) => {
    switch (sortBy) {
      case "score":
        return (b.score || 0) - (a.score || 0);
      case "views":
        return (b.viewCount || 0) - (a.viewCount || 0);
      case "answers":
        return (b.answerCount || 0) - (a.answerCount || 0);
      case "date":
        return new Date(b.pubDate) - new Date(a.pubDate);
      default:
        return new Date(b.fetchedAt) - new Date(a.fetchedAt);
    }
  });

  res.render("questions", {
    questions: filteredQuestions,
    selectedCategory: category || "all",
    selectedHasAnswers: hasAnswers || "all",
    selectedSort: sortBy,
    categories: Object.keys(RSS_FEEDS),
    totalQuestions: questions.length,
  });
});

app.get("/question/:id", async (req, res) => {
  const questions = await loadQuestions();
  const question = questions.find((q) => q.id === req.params.id || q.stackoverflowId === req.params.id);

  if (!question) {
    return res.status(404).render("404");
  }

  res.render("question-detail", { question });
});

app.delete("/questions/:id", async (req, res) => {
  try {
    const questions = await loadQuestions();
    const filteredQuestions = questions.filter((q) => q.id !== req.params.id);
    await saveQuestions(filteredQuestions);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk operations
app.post("/questions/bulk-delete", async (req, res) => {
  try {
    const { ids } = req.body;
    const questions = await loadQuestions();
    const filteredQuestions = questions.filter((q) => !ids.includes(q.id));
    await saveQuestions(filteredQuestions);
    res.json({ success: true, deletedCount: ids.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export data
app.get("/export", async (req, res) => {
  try {
    const questions = await loadQuestions();
    res.setHeader("Content-Disposition", "attachment; filename=stackoverflow-questions.json");
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify(questions, null, 2));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Video içerik oluşturma sayfası
app.get("/video-generator/:id", async (req, res) => {
  const questionId = req.params.id;
  const questions = await loadQuestions();
  const question = questions.find((q) => q.id == questionId);

  if (!question) {
    return res.status(404).send("Soru bulunamadı");
  }

  res.render("video-generator", { question });
});

// Video oluşturma sayfası için POST route (video verisini alır)
app.post("/video-creator/:id", async (req, res) => {
  const questionId = req.params.id;
  const videoData = req.body;
  const questions = await loadQuestions();
  const question = questions.find((q) => q.id == questionId);

  if (!question) {
    return res.status(404).send("Soru bulunamadı");
  }

  res.render("video-creator", { question, videoData });
});

// Video oluşturma sayfası (fallback)
app.get("/video-creator/:id", async (req, res) => {
  const questionId = req.params.id;
  const questions = await loadQuestions();
  const question = questions.find((q) => q.id == questionId);

  if (!question) {
    return res.status(404).send("Soru bulunamadı");
  }

  // Eğer video verisi yoksa generator'a yönlendir
  res.redirect(`/video-generator/${questionId}`);
});

// Video içerik oluşturma API
app.post("/generate-video-content", async (req, res) => {
  try {
    const { questionId, apiKey } = req.body;

    // Sabit API key kullan
    const geminiApiKey = "AIzaSyBtVpQaOiy9mcN06qPKsLXsrUdosVjEtnU";

    const questions = await loadQuestions();
    const question = questions.find((q) => q.id == questionId);

    if (!question) {
      return res.json({ success: false, error: "Soru bulunamadı" });
    }

    // Gemini AI ile içerik oluştur
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Prompt oluştur
    const prompt = `
        Create YouTube video content for the following StackOverflow question and answer:

        QUESTION TITLE: ${question.title}
        CATEGORY: ${question.category}
        QUESTION CONTENT: ${question.fullBody || question.body || question.description}
        ACCEPTED ANSWER: ${question.answers && question.answers.length > 0 ? question.answers.find((a) => a.isAccepted)?.body || question.answers[0].body : "No answer found"}

        Please respond using the following format:

        VIDEO_TITLE: [English, SEO-friendly, searchable video title]
        DESCRIPTION: [Short SEO description including keywords from video title]
        KEYWORDS: [5 keywords of 1-3 words each, comma separated]
        STEPS:
        1. [Direct explanation as if teaching someone - explain what the problem is]
        2. [Show the solution with actual code - MUST include CODE_BLOCK with code]
        3. [Explain how the code works]
        ...

        CRITICAL TTS OPTIMIZATION RULES:
        - Write ALL explanations as if you're speaking directly to someone
        - Use simple, conversational language that sounds natural when spoken aloud
        - Avoid complex technical jargon - explain in plain English
        - Use short, clear sentences (maximum 15-20 words per sentence)
        - Replace symbols and special characters with spoken words:
          * Use "equals" instead of "="
          * Use "plus" instead of "+"
          * Use "function" instead of just mentioning function names with parentheses
          * Use "variable" or "property" instead of just naming variables
        - When mentioning code elements, speak them naturally:
          * "We create a variable called user name" instead of "We create userName"
          * "We call the get data function" instead of "We call getData()"
          * "We use the dot notation to access the length property" instead of "We use .length"
        - Avoid abbreviations - spell them out (API becomes "A P I", HTML becomes "H T M L")
        - Use transition words: "First", "Next", "Then", "Finally", "Now"
        - End sentences with natural pauses in mind

        IMPORTANT RULES:
        - Each step should be 1-2 sentences maximum
        - DO NOT give video creation tips or suggestions
        - Focus ONLY on explaining the programming concept/solution
        - ALWAYS include actual code examples using CODE_BLOCK format
        - Explain the solution step by step as if teaching directly to the viewer
        - Do not say "how to" - just explain what the code does
        - For EVERY step that involves code, include a CODE_BLOCK showing that specific part
        - Show code progression step by step - each step should have its own CODE_BLOCK if code changes
        - Break down complex solutions into multiple steps with individual code blocks

        MANDATORY:
        - Include multiple CODE_BLOCK sections showing the solution step by step
        - Each step that introduces new code or modifies existing code MUST have its own CODE_BLOCK
        - Show the complete working code at the end
        - CRITICAL: All code in CODE_BLOCK must be properly indented with spaces or tabs
        - Use consistent indentation (2 or 4 spaces) throughout the code
        - Maintain proper code structure and formatting as if written in a real IDE
        - Do NOT flatten the code - preserve nested structure with proper indentation

        Example format for TTS-optimized progressive code explanation:
        Step 1: First, we create a basic structure to hold our data.
        CODE_BLOCK:
        \`\`\`javascript
        const basicStructure = {};
        \`\`\`

        Step 2: Next, we add a main function that returns a result.
        CODE_BLOCK:
        \`\`\`javascript
        const basicStructure = {
          mainFunction: function() {
            return "result";
          }
        };
        \`\`\`

        OUTRO: [Short closing statement about the solution, ask viewers to like and subscribe - maximum 1 sentence, TTS-friendly]
        `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Yanıtı parse et
    const videoContent = parseGeminiResponse(text);

    // Kod bloklarını işle ve carbon-now-cli ile görsel oluştur
    const processedSteps = await processCodeBlocks(videoContent.steps, questionId);

    // Toplam süreyi hesapla
    const totalDuration = processedSteps.reduce((total, step) => total + (step.duration || 0), 0);

    res.json({
      success: true,
      data: {
        title: videoContent.title,
        description: videoContent.description,
        keywords: videoContent.keywords,
        steps: processedSteps,
        estimatedDuration: totalDuration,
        estimatedDurationFormatted: `${Math.floor(totalDuration / 60)}:${(totalDuration % 60).toString().padStart(2, "0")}`,
      },
    });
  } catch (error) {
    console.error("Video içerik oluşturma hatası:", error);
    res.json({ success: false, error: error.message });
  }
});

// Progress tracking için yeni endpoint
app.get("/generate-video-content-stream/:questionId", async (req, res) => {
  const questionId = req.params.questionId;
  const voiceId = req.query.voiceId || "brian"; // URL parametresinden ses ID'sini al
  const language = req.query.language || "en"; // URL parametresinden dil kodu al

  // SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  function sendProgress(step, progress, message, data = null) {
    const progressData = {
      step,
      progress,
      message,
      data,
    };
    res.write(`data: ${JSON.stringify(progressData)}\n\n`);
  }

  try {
    // Sabit API key kullan
    const geminiApiKey = "AIzaSyBtVpQaOiy9mcN06qPKsLXsrUdosVjEtnU";

    const questions = await loadQuestions();
    const question = questions.find((q) => q.id == questionId);

    if (!question) {
      sendProgress(0, 0, "Soru bulunamadı", { error: true });
      res.end();
      return;
    }

    // Dil ayarları
    const languageSettings = {
      tr: { name: "Turkish", instruction: "Write ALL content in Turkish. Use Turkish language for all explanations, steps, title, description, and keywords." },
      en: { name: "English", instruction: "Write ALL content in English." },
      de: { name: "German", instruction: "Write ALL content in German. Use German language for all explanations, steps, title, description, and keywords." },
      fr: { name: "French", instruction: "Write ALL content in French. Use French language for all explanations, steps, title, description, and keywords." },
      es: { name: "Spanish", instruction: "Write ALL content in Spanish. Use Spanish language for all explanations, steps, title, description, and keywords." },
      it: { name: "Italian", instruction: "Write ALL content in Italian. Use Italian language for all explanations, steps, title, description, and keywords." },
      pt: { name: "Portuguese", instruction: "Write ALL content in Portuguese. Use Portuguese language for all explanations, steps, title, description, and keywords." },
      ja: { name: "Japanese", instruction: "Write ALL content in Japanese. Use Japanese language for all explanations, steps, title, description, and keywords." },
      ko: { name: "Korean", instruction: "Write ALL content in Korean. Use Korean language for all explanations, steps, title, description, and keywords." },
      zh: { name: "Chinese", instruction: "Write ALL content in Chinese. Use Chinese language for all explanations, steps, title, description, and keywords." },
      ru: { name: "Russian", instruction: "Write ALL content in Russian. Use Russian language for all explanations, steps, title, description, and keywords." },
      ar: { name: "Arabic", instruction: "Write ALL content in Arabic. Use Arabic language for all explanations, steps, title, description, and keywords." },
    };

    const selectedLanguage = languageSettings[language] || languageSettings["en"];

    // Adım 1: AI ile içerik oluşturma
    sendProgress(0, 10, "AI ile içerik oluşturuluyor...");

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
        ${selectedLanguage.instruction}

        Create YouTube video content for the following StackOverflow question and answer:

        QUESTION TITLE: ${question.title}
        CATEGORY: ${question.category}
        QUESTION CONTENT: ${question.fullBody || question.body || question.description}
        ACCEPTED ANSWER: ${question.answers && question.answers.length > 0 ? question.answers.find((a) => a.isAccepted)?.body || question.answers[0].body : "No answer found"}

        Please respond using the following format:

        VIDEO_TITLE: [SEO-friendly, searchable video title in ${selectedLanguage.name}]
        DESCRIPTION: [Short SEO description including keywords from video title in ${selectedLanguage.name}]
        KEYWORDS: [5 keywords of 1-3 words each, comma separated, in ${selectedLanguage.name}]
        STEPS:
        1. [Direct explanation as if teaching someone - explain what the problem is, in ${selectedLanguage.name}]
        2. [Show the solution with actual code - MUST include CODE_BLOCK with code, in ${selectedLanguage.name}]
        3. [Explain how the code works, in ${selectedLanguage.name}]
        ...

        CRITICAL TTS OPTIMIZATION RULES:
        - Write ALL explanations as if you're speaking directly to someone in ${selectedLanguage.name}
        - Use simple, conversational language that sounds natural when spoken aloud in ${selectedLanguage.name}
        - Avoid complex technical jargon - explain in plain ${selectedLanguage.name}
        - Use short, clear sentences (maximum 15-20 words per sentence)
        - Replace symbols and special characters with spoken words in ${selectedLanguage.name}:
          * Use the ${selectedLanguage.name} equivalent of "equals" instead of "="
          * Use the ${selectedLanguage.name} equivalent of "plus" instead of "+"
          * Use the ${selectedLanguage.name} equivalent of "function" instead of just mentioning function names with parentheses
          * Use the ${selectedLanguage.name} equivalent of "variable" or "property" instead of just naming variables
        - When mentioning code elements, speak them naturally in ${selectedLanguage.name}
        - Avoid abbreviations - spell them out in ${selectedLanguage.name} (API, HTML, etc.)
        - Use transition words appropriate to ${selectedLanguage.name}: "First", "Next", "Then", "Finally", "Now"
        - End sentences with natural pauses in mind

        IMPORTANT RULES:
        - Each step should be 1-2 sentences maximum in ${selectedLanguage.name}
        - DO NOT give video creation tips or suggestions
        - Focus ONLY on explaining the programming concept/solution in ${selectedLanguage.name}
        - ALWAYS include actual code examples using CODE_BLOCK format
        - Explain the solution step by step as if teaching directly to the viewer in ${selectedLanguage.name}
        - Do not say "how to" - just explain what the code does in ${selectedLanguage.name}
        - For EVERY step that involves code, include a CODE_BLOCK showing that specific part
        - Show code progression step by step - each step should have its own CODE_BLOCK if code changes
        - Break down complex solutions into multiple steps with individual code blocks

        MANDATORY:
        - Include multiple CODE_BLOCK sections showing the solution step by step
        - Each step that introduces new code or modifies existing code MUST have its own CODE_BLOCK
        - Show the complete working code at the end
        - CRITICAL: All code in CODE_BLOCK must be properly indented with spaces or tabs
        - Use consistent indentation (2 or 4 spaces) throughout the code
        - Maintain proper code structure and formatting as if written in a real IDE
        - Do NOT flatten the code - preserve nested structure with proper indentation

        Example format for TTS-optimized progressive code explanation in ${selectedLanguage.name}:
        Step 1: [First step explanation in ${selectedLanguage.name}]
        CODE_BLOCK:
        \`\`\`javascript
        const basicStructure = {};
        \`\`\`

        Step 2: [Next step explanation in ${selectedLanguage.name}]
        CODE_BLOCK:
        \`\`\`javascript
        const basicStructure = {
          mainFunction: function() {
            return "result";
          }
        };
        \`\`\`

        OUTRO: [Short closing statement about the solution in ${selectedLanguage.name}, ask viewers to like and subscribe - maximum 1 sentence, TTS-friendly]
        `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Adım 2: Kod blokları analizi
    sendProgress(1, 30, "Kod blokları analiz ediliyor...");
    const videoContent = parseGeminiResponse(text);

    // Adım 3: Süre hesaplamaları
    sendProgress(2, 50, "Süre hesaplamaları yapılıyor...");

    // Adım 4: Video içeriği hazırlama
    sendProgress(3, 70, "Video içeriği hazırlanıyor...");

    // Adım 5: Kod resimleri oluşturma
    const processedSteps = await processCodeBlocksWithProgress(videoContent.steps, questionId, sendProgress);

    // Adım 6: TTS seslendirme oluşturma
    sendProgress(5, 85, "Seslendirme oluşturuluyor...");
    const stepsWithTTS = await processStepsWithTTS(processedSteps, questionId, voiceId, sendProgress);

    // Adım 7: Thumbnail oluşturma
    sendProgress(6, 95, "Thumbnail oluşturuluyor...");
    const thumbnailPath = await createThumbnail(videoContent.title, question.category, questionId);

    // Toplam süreyi hesapla
    const totalDuration = stepsWithTTS.reduce((total, step) => total + (step.duration || 0), 0);

    // Tamamlandı
    sendProgress(7, 100, "Tamamlandı!", {
      success: true,
      data: {
        title: videoContent.title,
        description: videoContent.description,
        keywords: videoContent.keywords,
        steps: stepsWithTTS,
        thumbnail: thumbnailPath,
        estimatedDuration: totalDuration,
        estimatedDurationFormatted: `${Math.floor(totalDuration / 60)}:${(totalDuration % 60).toString().padStart(2, "0")}`,
      },
    });

    res.end();
  } catch (error) {
    console.error("Video içerik oluşturma hatası:", error);
    sendProgress(0, 0, "Hata oluştu: " + error.message, { error: true });
    res.end();
  }
});

// Gemini yanıtını parse et
function parseGeminiResponse(text) {
  console.log("=== PARSING GEMINI RESPONSE ===");
  console.log("Raw response:", text);

  const lines = text.split("\n");
  let title = "";
  let description = "";
  let keywords = [];
  let steps = [];
  let currentSection = "";
  let currentStep = "";
  let collectingCodeBlock = false;
  let codeBlockContent = "";

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]; // trim() yapmıyoruz, orijinal satırı koruyoruz
    let trimmedLine = line.trim(); // sadece kontrol için trim'li versiyonu kullanıyoruz

    console.log(`Line ${i}: "${trimmedLine}"`);

    if (trimmedLine.startsWith("VIDEO_TITLE:")) {
      title = trimmedLine.replace("VIDEO_TITLE:", "").trim();
      console.log("Found title:", title);
    } else if (trimmedLine.startsWith("DESCRIPTION:")) {
      description = trimmedLine.replace("DESCRIPTION:", "").trim();
      console.log("Found description:", description);
    } else if (trimmedLine.startsWith("KEYWORDS:")) {
      const keywordText = trimmedLine.replace("KEYWORDS:", "").trim();
      keywords = keywordText
        .split(",")
        .map((k) => k.trim())
        .filter((k) => k);
      console.log("Found keywords:", keywords);
    } else if (trimmedLine.startsWith("STEPS:")) {
      currentSection = "steps";
      console.log("Started steps section");
    } else if (trimmedLine.startsWith("OUTRO:")) {
      // Önceki adımı kaydet
      if (currentStep) {
        const hasCode = currentStep.includes("CODE_BLOCK:");
        steps.push({ text: currentStep, hasCode: hasCode });
        console.log("Added step:", { text: currentStep, hasCode: hasCode });
        currentStep = "";
      }

      // OUTRO adımını ekle
      const outroText = trimmedLine.replace("OUTRO:", "").trim();
      if (outroText && outroText.length > 0) {
        steps.push({ text: outroText, hasCode: false, isOutro: true });
        console.log("Added outro:", outroText);
      }
    } else if (currentSection === "steps") {
      // Adım numarası ile başlıyorsa
      if (trimmedLine.match(/^\d+\./)) {
        // Önceki adımı kaydet
        if (currentStep && currentStep.trim().length > 0) {
          const hasCode = currentStep.includes("CODE_BLOCK:");
          steps.push({ text: currentStep, hasCode: hasCode });
          console.log("Added step:", { text: currentStep, hasCode: hasCode });
        }

        currentStep = trimmedLine.replace(/^\d+\./, "").trim();
        console.log("Started new step:", currentStep);
      }
      // CODE_BLOCK başlangıcı
      else if (trimmedLine.includes("CODE_BLOCK:")) {
        currentStep += "\nCODE_BLOCK:";
        collectingCodeBlock = true;
        console.log("Found CODE_BLOCK start");
      }
      // Kod bloğu içeriği - ORIJINAL SATIRI KULLAN (indentasyonu koru)
      else if (collectingCodeBlock) {
        currentStep += "\n" + line; // trim edilmemiş orijinal satır
        if (trimmedLine.includes("```") && !trimmedLine.startsWith("```")) {
          collectingCodeBlock = false;
          console.log("CODE_BLOCK ended");
        }
      }
      // Normal adım devamı
      else if (trimmedLine && !trimmedLine.startsWith("```")) {
        currentStep += " " + trimmedLine;
      }
    }
  }

  // Son adımı kaydet
  if (currentStep && currentStep.trim().length > 0) {
    const hasCode = currentStep.includes("CODE_BLOCK:");
    steps.push({ text: currentStep, hasCode: hasCode });
    console.log("Added final step:", { text: currentStep, hasCode: hasCode });
  }

  // Boş adımları filtrele
  steps = steps.filter((step) => step.text && step.text.trim().length > 0);

  console.log("=== PARSE RESULT ===");
  console.log("Title:", title);
  console.log("Description:", description);
  console.log("Keywords:", keywords);
  console.log("Steps count:", steps.length);
  steps.forEach((step, i) => {
    console.log(`Step ${i}:`, step);
  });

  return { title, description, keywords, steps };
}

// Kod bloklarını işle ve carbon-now-cli ile görsel oluştur (Progress tracking ile)
async function processCodeBlocksWithProgress(steps, questionId, sendProgress) {
  const execAsync = promisify(exec);
  const processedSteps = [];

  // Code images klasörü oluştur
  const codeImagesDir = path.join(__dirname, "public", "code-images");
  if (!fsSync.existsSync(codeImagesDir)) {
    fsSync.mkdirSync(codeImagesDir, { recursive: true });
  }

  // Kod bloğu olan adımları say
  const codeSteps = steps.filter((step) => step.hasCode && step.text.includes("CODE_BLOCK:"));
  const totalCodeBlocks = codeSteps.length;

  let processedCodeBlocks = 0;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    let processedStep = { text: step.text };

    console.log(`Processing step ${i}: hasCode=${step.hasCode}, includes CODE_BLOCK=${step.text.includes("CODE_BLOCK:")}`);

    if (step.hasCode && step.text.includes("CODE_BLOCK:")) {
      try {
        processedCodeBlocks++;

        // Progress güncelle
        const baseProgress = 80; // İlk 4 adım için %80
        const codeImageProgress = (processedCodeBlocks / totalCodeBlocks) * 15; // Kod resimleri için %15
        const totalProgress = Math.min(95, baseProgress + codeImageProgress);

        sendProgress(4, totalProgress, `Kod resimleri oluşturuluyor... (${processedCodeBlocks}/${totalCodeBlocks})`);

        console.log("Found code block, processing...");

        // Kod bloğunu çıkar - daha esnek regex
        const codeMatch = step.text.match(/CODE_BLOCK:\s*\n```[\w]*\n([\s\S]*?)\n```/);
        console.log(`Code match result:`, codeMatch);

        if (codeMatch) {
          let code = codeMatch[1];

          // Sadece baştaki ve sondaki boş satırları sil, satır içi boşluklara dokunma
          let codeLines = code.split("\n");
          while (codeLines.length > 0 && codeLines[0].trim() === "") codeLines.shift();
          while (codeLines.length > 0 && codeLines[codeLines.length - 1].trim() === "") codeLines.pop();
          code = codeLines.join("\n");

          // Minimum indentasyonu bul ve normalize et (leading whitespace'i koru)
          const nonEmptyLines = codeLines.filter((line) => line.trim() !== "");
          if (nonEmptyLines.length > 0) {
            const minIndent = Math.min(
              ...nonEmptyLines.map((line) => {
                const match = line.match(/^\s*/);
                return match ? match[0].length : 0;
              })
            );

            // Minimum indentasyonu çıkar (relative indentasyonu koru)
            if (minIndent > 0) {
              code = codeLines
                .map((line) => {
                  if (line.trim() === "") return line; // Boş satırları olduğu gibi bırak
                  return line.substring(minIndent);
                })
                .join("\n");
            }
          }

          console.log(`Processed code (preserved formatting): ${code}`);

          const timestamp = Date.now();
          const fileName = `example.js`;
          const filePath = path.join(__dirname, "temp", fileName);

          // Temp klasörü oluştur
          const tempDir = path.join(__dirname, "temp");
          if (!fsSync.existsSync(tempDir)) {
            fsSync.mkdirSync(tempDir, { recursive: true });
            console.log(`Created temp directory: ${tempDir}`);
          }

          // Kodu dosyaya yaz
          fsSync.writeFileSync(filePath, code);
          console.log(`Code written to file: ${filePath}`);
          console.log("=== ACTUAL CODE CONTENT ===");
          console.log(JSON.stringify(code)); // JSON.stringify ile whitespace'leri görebiliriz
          console.log("=== END CODE CONTENT ===");

          // Carbon-now-cli ile görsel oluştur - headless mod ile
          const imageName = `code_${questionId}_${i}_${timestamp}`;

          // Headless mod için carbon-now-cli komutunu düzelt
          const carbonCommand = `npx carbon-now "${filePath}" --theme "material" --background-color "transparent" --no-window-controls --headless`;

          console.log(`Running command: ${carbonCommand}`);
          const result = await execAsync(carbonCommand);
          console.log(`Carbon command result:`, result);

          // Ana dizinde oluşan dosyayı bul ve taşı
          const files = fsSync.readdirSync(__dirname);
          const generatedFile = files.find((file) => file.startsWith("example-") && file.endsWith(".png"));

          if (generatedFile) {
            const sourcePath = path.join(__dirname, generatedFile);
            const targetPath = path.join(codeImagesDir, `${imageName}.png`);

            // Dosyayı taşı
            fsSync.renameSync(sourcePath, targetPath);
            console.log(`Image moved from ${sourcePath} to ${targetPath}`);

            // Kod bloğunu metinden tamamen çıkar ve görsel referansı ekle
            processedStep.text = step.text.replace(/CODE_BLOCK:\s*\n```[\w]*\n[\s\S]*?\n```/g, "").trim();
            processedStep.codeImage = `/code-images/${imageName}.png`;

            console.log(`Code image path set: ${processedStep.codeImage}`);
          } else {
            console.error(`Generated image file not found in directory`);
            // Hata durumunda kod bloğunu temizle
            processedStep.text = step.text.replace(/CODE_BLOCK:\s*\n```[\w]*\n[\s\S]*?\n```/g, "").trim();
          }

          // Temp dosyayı sil
          if (fsSync.existsSync(filePath)) {
            fsSync.unlinkSync(filePath);
            console.log(`Temp file deleted: ${filePath}`);
          }
        } else {
          console.log("No code match found in step text");
        }
      } catch (error) {
        console.error("Kod görseli oluşturma hatası:", error);
        console.error("Error details:", error.message);
        console.error("Stack trace:", error.stack);
        // Hata durumunda kod bloğunu tamamen temizle
        processedStep.text = step.text.replace(/CODE_BLOCK:\s*\n```[\w]*\n[\s\S]*?\n```/g, "").trim();
      }
    }

    // Süre hesaplama
    const cleanText = processedStep.text.replace(/CODE_BLOCK:\s*\n```[\w]*\n[\s\S]*?\n```/g, "").trim();
    let codeContent = "";

    // Eğer kod varsa, kod içeriğini çıkar
    if (step.hasCode && step.text.includes("CODE_BLOCK:")) {
      const codeMatch = step.text.match(/CODE_BLOCK:\s*\n```[\w]*\n([\s\S]*?)\n```/);
      if (codeMatch) {
        codeContent = codeMatch[1];
      }
    }

    const duration = calculateReadingTime(cleanText, step.hasCode, codeContent);
    processedStep.duration = duration;

    console.log(`Step ${i} duration: ${duration} seconds (hasCode: ${step.hasCode}, textLength: ${cleanText.length}, codeLength: ${codeContent.length})`);

    processedSteps.push(processedStep);
  }

  return processedSteps;
}

// Static dosyalar için route
app.use("/code-images", express.static(path.join(__dirname, "public", "code-images")));
app.use("/thumbnails", express.static(path.join(__dirname, "public", "thumbnails")));
app.use("/audio", express.static(path.join(__dirname, "public", "audio")));
app.use("/musics", express.static(path.join(__dirname, "public", "musics")));

// Thumbnail oluşturma fonksiyonu
async function createThumbnail(title, category, questionId, variant = null) {
  try {
    // HTML entity'leri decode et
    const decodedTitle = decodeHtmlEntities(title);

    const width = 1280;
    const height = 720;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // Tema seç
    const theme = LANGUAGE_THEMES[category] || LANGUAGE_THEMES.default;

    // Random seçimler
    const selectedVariant = variant || DESIGN_VARIANTS[Math.floor(Math.random() * DESIGN_VARIANTS.length)];
    const colorPalette = COLOR_PALETTES[Math.floor(Math.random() * COLOR_PALETTES.length)];
    const layout = LAYOUT_VARIANTS[Math.floor(Math.random() * LAYOUT_VARIANTS.length)];
    const shapeVariant = SHAPE_VARIANTS[Math.floor(Math.random() * SHAPE_VARIANTS.length)];

    // Variant'a göre tasarım uygula
    switch (selectedVariant) {
      case "modern":
        await createModernDesign(ctx, width, height, theme, decodedTitle, category, colorPalette, layout, shapeVariant);
        break;
      case "gradient":
        await createGradientDesign(ctx, width, height, theme, decodedTitle, category, colorPalette, layout, shapeVariant);
        break;
      case "minimal":
        await createMinimalDesign(ctx, width, height, theme, decodedTitle, category, colorPalette, layout, shapeVariant);
        break;
      case "geometric":
        await createGeometricDesign(ctx, width, height, theme, decodedTitle, category, colorPalette, layout, shapeVariant);
        break;
      case "neon":
        await createNeonDesign(ctx, width, height, theme, decodedTitle, category, colorPalette, layout, shapeVariant);
        break;
      default:
        await createModernDesign(ctx, width, height, theme, decodedTitle, category, colorPalette, layout, shapeVariant);
    }

    // Icon ekle - Logo yükleme tamamen devre dışı bırakıldı (Canvas sorunları nedeniyle)
    addIconToCanvas(ctx, theme.icon, width, height, colorPalette.primary, selectedVariant, layout);

    // Dosyayı kaydet
    const thumbnailsDir = path.join(__dirname, "public", "thumbnails");
    if (!fsSync.existsSync(thumbnailsDir)) {
      fsSync.mkdirSync(thumbnailsDir, { recursive: true });
    }

    const fileName = `thumbnail_${questionId}_${selectedVariant}_${Date.now()}.png`;
    const filePath = path.join(thumbnailsDir, fileName);

    const buffer = canvas.toBuffer("image/png");
    fsSync.writeFileSync(filePath, buffer);

    return `/thumbnails/${fileName}`;
  } catch (error) {
    console.error("Thumbnail oluşturma hatası:", error);
    return null;
  }
}

// Modern tasarım
async function createModernDesign(ctx, width, height, theme, title, category, colorPalette, layout, shapeVariant) {
  // Dinamik gradient arkaplan
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, colorPalette.primary + "40");
  gradient.addColorStop(0.5, colorPalette.secondary + "30");
  gradient.addColorStop(1, colorPalette.accent + "20");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Şekil varyasyonlarına göre dekoratif elementler
  drawShapes(ctx, width, height, colorPalette, shapeVariant);

  addTitleAndBadge(ctx, title, category, theme, width, height, null, layout, colorPalette);
}

// Gradient tasarım
async function createGradientDesign(ctx, width, height, theme, title, category, colorPalette, layout, shapeVariant) {
  // Çok renkli gradient arkaplan
  const gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) / 2);
  gradient.addColorStop(0, colorPalette.bg1 + "60");
  gradient.addColorStop(0.3, colorPalette.primary + "40");
  gradient.addColorStop(0.7, colorPalette.secondary + "30");
  gradient.addColorStop(1, colorPalette.bg2 + "20");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Dalga efekti - random parametreler
  const waveHeight = 30 + Math.random() * 40;
  const waveFreq = 0.005 + Math.random() * 0.01;

  ctx.fillStyle = colorPalette.accent + "40";
  ctx.beginPath();
  for (let x = 0; x <= width; x += 5) {
    const y = height - 100 + Math.sin(x * waveFreq) * waveHeight;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.fill();

  addTitleAndBadge(ctx, title, category, theme, width, height, null, layout, colorPalette);
}

// Minimal tasarım
async function createMinimalDesign(ctx, width, height, theme, title, category, colorPalette, layout, shapeVariant) {
  // Temiz arkaplan - random açık renkler
  const bgColors = ["#FFFFFF", "#F8F9FA", "#F1F3F4", colorPalette.bg1 + "10"];
  ctx.fillStyle = bgColors[Math.floor(Math.random() * bgColors.length)];
  ctx.fillRect(0, 0, width, height);

  // Random border style
  const borderStyles = ["solid", "dashed", "dotted"];
  const borderStyle = borderStyles[Math.floor(Math.random() * borderStyles.length)];

  ctx.strokeStyle = colorPalette.primary + "50";
  ctx.lineWidth = 6;

  if (borderStyle === "dashed") {
    ctx.setLineDash([20, 10]);
  } else if (borderStyle === "dotted") {
    ctx.setLineDash([5, 15]);
  }

  ctx.strokeRect(40, 40, width - 80, height - 80);
  ctx.setLineDash([]); // Reset

  // Random köşe aksentleri
  const accentSize = 80 + Math.random() * 40;
  ctx.fillStyle = colorPalette.accent;

  // Sol üst
  ctx.fillRect(40, 40, accentSize, 8);
  ctx.fillRect(40, 40, 8, accentSize);

  // Sağ alt
  ctx.fillRect(width - 40 - accentSize, height - 48, accentSize, 8);
  ctx.fillRect(width - 48, height - 40 - accentSize, 8, accentSize);

  addTitleAndBadge(ctx, title, category, theme, width, height, null, layout, colorPalette);
}

// Geometric tasarım
async function createGeometricDesign(ctx, width, height, theme, title, category, colorPalette, layout, shapeVariant) {
  // Koyu arkaplan
  ctx.fillStyle = "#1A1A1A";
  ctx.fillRect(0, 0, width, height);

  // Random geometric şekiller
  drawRandomGeometricShapes(ctx, width, height, colorPalette);

  addTitleAndBadge(ctx, title, category, theme, width, height, null, layout, colorPalette);
}

// Neon tasarım
async function createNeonDesign(ctx, width, height, theme, title, category, colorPalette, layout, shapeVariant) {
  // Siyah arkaplan
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, width, height);

  // Random neon grid
  const gridSize = 30 + Math.random() * 40;
  ctx.strokeStyle = colorPalette.primary + "60";
  ctx.lineWidth = 1;

  // Vertical lines
  for (let x = 0; x < width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  // Horizontal lines
  for (let y = 0; y < height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Neon glow effect - random renk
  const glowColors = [colorPalette.primary, colorPalette.secondary, colorPalette.accent];
  const glowColor = glowColors[Math.floor(Math.random() * glowColors.length)];

  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 20;
  ctx.strokeStyle = glowColor;
  ctx.lineWidth = 3;
  ctx.strokeRect(60, 60, width - 120, height - 120);
  ctx.shadowBlur = 0;

  addTitleAndBadge(ctx, title, category, theme, width, height, null, layout, colorPalette);
}

// Başlık ve badge ekleme fonksiyonu
function addTitleAndBadge(ctx, title, category, theme, width, height, defaultTextColor, layout, colorPalette) {
  // Başlığı temizle
  let cleanTitle = title
    .replace(/\[.*?\]/g, "")
    .replace(/\(.*?\)/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // Layout'a göre pozisyon hesapla
  let titleX, titleY, badgeX, badgeY;

  switch (layout) {
    case "centered":
      titleX = width / 2;
      titleY = height / 2 - 50;
      badgeX = width / 2;
      badgeY = height / 2 + 100;
      break;
    case "diagonal":
      titleX = 100;
      titleY = 150;
      badgeX = width - 200;
      badgeY = height - 100;
      break;
    case "corner":
      titleX = width - 600;
      titleY = height - 200;
      badgeX = width - 200;
      badgeY = 60;
      break;
    case "split":
      titleX = 60;
      titleY = height / 2 - 50;
      badgeX = width - 200;
      badgeY = height / 2 + 50;
      break;
    default: // left-aligned
      titleX = 60;
      titleY = 80;
      badgeX = 60;
      badgeY = height - 100;
  }

  // Arkaplan rengine göre metin rengini belirle
  const textColor = getTextColorForBackground(colorPalette.primary);

  // Başlık
  ctx.fillStyle = textColor;
  ctx.font = "bold 64px Arial, sans-serif";
  ctx.textAlign = layout === "centered" ? "center" : "left";
  ctx.textBaseline = "top";

  const maxWidth = layout === "centered" ? width - 200 : width - titleX - 120;
  const words = cleanTitle.split(" ");
  let lines = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine + (currentLine ? " " : "") + word;
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);

  if (lines.length > 3) {
    lines = lines.slice(0, 2);
    lines.push("...");
  }

  const lineHeight = 75;

  lines.forEach((line, index) => {
    ctx.fillText(line, titleX, titleY + index * lineHeight);
  });

  // Badge
  const badgeHeight = 50;
  const badgeText = category.toUpperCase();

  ctx.font = "bold 20px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const textMetrics = ctx.measureText(badgeText);
  const badgeWidth = textMetrics.width + 40;

  // Layout'a göre badge pozisyonu ayarla
  if (layout === "centered") {
    badgeX = badgeX - badgeWidth / 2;
  }

  const badgeGradient = ctx.createLinearGradient(badgeX, badgeY, badgeX + badgeWidth, badgeY + badgeHeight);
  badgeGradient.addColorStop(0, colorPalette.primary);
  badgeGradient.addColorStop(1, colorPalette.primary + "CC");
  ctx.fillStyle = badgeGradient;
  ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 25);
  ctx.fill();

  // Badge metni için uygun renk seç
  const badgeTextColor = getTextColorForBackground(colorPalette.primary);
  ctx.fillStyle = badgeTextColor;
  ctx.fillText(badgeText, badgeX + badgeWidth / 2, badgeY + badgeHeight / 2);
}

// Logo ekleme fonksiyonu - Tamamen devre dışı bırakıldı
async function addLogoToCanvas(ctx, logoUrl, width, height, variant, layout) {
  // Canvas image loading sorunları nedeniyle logo yükleme devre dışı
  // Direkt icon fallback kullanılacak
  throw new Error("Logo loading disabled to avoid Canvas issues - using icon fallback");
}

// Renk parlaklığını hesaplayan fonksiyon
function getColorBrightness(hexColor) {
  try {
    // Hex rengi temizle ve normalize et
    let hex = hexColor
      .toString()
      .replace("#", "")
      .replace(/[^0-9A-Fa-f]/g, "");

    // Eğer 3 karakterse 6 karaktere çevir (örn: "abc" -> "aabbcc")
    if (hex.length === 3) {
      hex = hex
        .split("")
        .map((char) => char + char)
        .join("");
    }

    // Eğer geçerli hex değilse varsayılan değer döndür
    if (hex.length !== 6) {
      return 128; // Orta parlaklık
    }

    const r = parseInt(hex.substr(0, 2), 16) || 0;
    const g = parseInt(hex.substr(2, 2), 16) || 0;
    const b = parseInt(hex.substr(4, 2), 16) || 0;

    // Parlaklık hesapla (0-255 arası)
    return (r * 299 + g * 587 + b * 114) / 1000;
  } catch (error) {
    console.log("Renk parlaklığı hesaplama hatası:", error.message);
    return 128; // Hata durumunda orta parlaklık döndür
  }
}

// Arkaplan rengine göre metin rengi belirle
function getTextColorForBackground(backgroundColor) {
  try {
    const brightness = getColorBrightness(backgroundColor);
    // Eğer arkaplan açıksa (>128) koyu metin, koyuysa açık metin
    return brightness > 128 ? "#2D3748" : "#FFFFFF";
  } catch (error) {
    console.log("Metin rengi belirleme hatası:", error.message);
    return "#FFFFFF"; // Hata durumunda beyaz döndür
  }
}

// Gelişmiş icon ekleme fonksiyonu
function addIconToCanvas(ctx, icon, width, height, color, variant, layout) {
  try {
    let iconSize, iconX, iconY;

    switch (layout) {
      case "centered":
        iconSize = "80px";
        iconX = width - 120;
        iconY = 120;
        break;
      case "diagonal":
        iconSize = "100px";
        iconX = width - 120;
        iconY = height - 60;
        break;
      case "corner":
        iconSize = "120px";
        iconX = 120;
        iconY = height - 60;
        break;
      case "split":
        iconSize = "90px";
        iconX = width - 120;
        iconY = height / 2;
        break;
      default:
        iconSize = "100px";
        iconX = width - 160;
        iconY = 250;
    }

    // Icon'u güvenli şekilde çiz
    ctx.save();

    // Gölge efekti ekle
    ctx.shadowColor = color + "40";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    ctx.font = iconSize + " Arial, sans-serif";
    ctx.fillStyle = color + "80"; // Biraz şeffaflık
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(icon, iconX, iconY);

    ctx.restore();

    console.log(`Icon başarıyla eklendi: ${icon} at (${iconX}, ${iconY})`);
  } catch (error) {
    console.log("Icon ekleme hatası:", error.message);
    // Hata durumunda basit bir kare çiz
    try {
      ctx.save();
      ctx.fillStyle = color + "60";
      ctx.fillRect(width - 150, 200, 80, 80);
      ctx.restore();
    } catch (fallbackError) {
      console.log("Fallback icon da başarısız:", fallbackError.message);
    }
  }
}

// Hexagon çizme fonksiyonu
function drawHexagon(ctx, x, y, size) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3;
    const px = x + size * Math.cos(angle);
    const py = y + size * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();
}

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

// Thumbnail yeniden oluşturma endpoint'i
app.post("/regenerate-thumbnail", async (req, res) => {
  try {
    // Request body kontrolü
    if (!req.body) {
      return res.status(400).json({
        success: false,
        error: "Request body is missing",
      });
    }

    const { questionId, title, category } = req.body;

    // Gerekli parametreleri kontrol et
    if (!questionId || !title || !category) {
      return res.status(400).json({
        success: false,
        error: "Missing required parameters: questionId, title, category",
      });
    }

    console.log("Thumbnail yeniden oluşturuluyor:", { questionId, title, category });

    // Yeni thumbnail oluştur (random variant ile)
    const thumbnailPath = await createThumbnail(title, category, questionId);

    if (thumbnailPath) {
      console.log("Thumbnail başarıyla oluşturuldu:", thumbnailPath);
      res.json({
        success: true,
        thumbnail: thumbnailPath,
      });
    } else {
      console.error("Thumbnail oluşturulamadı");
      res.status(500).json({
        success: false,
        error: "Thumbnail oluşturulamadı",
      });
    }
  } catch (error) {
    console.error("Thumbnail yeniden oluşturma hatası:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
});

// Şekil çizme fonksiyonu
function drawShapes(ctx, width, height, colorPalette, shapeVariant) {
  switch (shapeVariant) {
    case "circles":
      drawRandomCircles(ctx, width, height, colorPalette);
      break;
    case "triangles":
      drawRandomTriangles(ctx, width, height, colorPalette);
      break;
    case "hexagons":
      drawRandomHexagons(ctx, width, height, colorPalette);
      break;
    case "waves":
      drawRandomWaves(ctx, width, height, colorPalette);
      break;
    case "geometric":
      drawRandomGeometricShapes(ctx, width, height, colorPalette);
      break;
    case "organic":
      drawOrganicShapes(ctx, width, height, colorPalette);
      break;
  }
}

// Random daireler
function drawRandomCircles(ctx, width, height, colorPalette) {
  const colors = [colorPalette.primary, colorPalette.secondary, colorPalette.accent];

  for (let i = 0; i < 5; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const radius = 50 + Math.random() * 150;
    const color = colors[Math.floor(Math.random() * colors.length)];
    const opacity = "20";

    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, color + "40");
    gradient.addColorStop(1, color + opacity);

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Random üçgenler
function drawRandomTriangles(ctx, width, height, colorPalette) {
  const colors = [colorPalette.primary, colorPalette.secondary, colorPalette.accent];

  for (let i = 0; i < 6; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const size = 60 + Math.random() * 120;
    const color = colors[Math.floor(Math.random() * colors.length)];

    ctx.fillStyle = color + "25";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + size, y);
    ctx.lineTo(x + size / 2, y + size * 0.866);
    ctx.closePath();
    ctx.fill();
  }
}

// Random hexagonlar
function drawRandomHexagons(ctx, width, height, colorPalette) {
  const colors = [colorPalette.primary, colorPalette.secondary, colorPalette.accent];

  for (let i = 0; i < 4; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const size = 40 + Math.random() * 80;
    const color = colors[Math.floor(Math.random() * colors.length)];

    ctx.strokeStyle = color + "40";
    ctx.lineWidth = 3;
    drawHexagon(ctx, x, y, size);
  }
}

// Random dalgalar
function drawRandomWaves(ctx, width, height, colorPalette) {
  const colors = [colorPalette.bg1, colorPalette.bg2, colorPalette.accent];

  for (let i = 0; i < 3; i++) {
    const startY = (height / 4) * (i + 1);
    const amplitude = 20 + Math.random() * 40;
    const frequency = 0.01 + Math.random() * 0.02;
    const color = colors[i % colors.length];

    ctx.fillStyle = color + "30";
    ctx.beginPath();
    ctx.moveTo(0, startY);

    for (let x = 0; x <= width; x += 5) {
      const y = startY + Math.sin(x * frequency) * amplitude;
      ctx.lineTo(x, y);
    }

    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.fill();
  }
}

// Random geometric şekiller
function drawRandomGeometricShapes(ctx, width, height, colorPalette) {
  const colors = [colorPalette.primary, colorPalette.secondary, colorPalette.accent];

  // Üçgenler
  for (let i = 0; i < 4; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const size = 50 + Math.random() * 100;
    const color = colors[Math.floor(Math.random() * colors.length)];

    ctx.fillStyle = color + "25";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + size, y);
    ctx.lineTo(x + size / 2, y + size);
    ctx.closePath();
    ctx.fill();
  }

  // Dikdörtgenler
  for (let i = 0; i < 3; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const w = 80 + Math.random() * 120;
    const h = 40 + Math.random() * 80;
    const color = colors[Math.floor(Math.random() * colors.length)];

    ctx.fillStyle = color + "20";
    ctx.fillRect(x, y, w, h);
  }
}

// Organik şekiller
function drawOrganicShapes(ctx, width, height, colorPalette) {
  const colors = [colorPalette.primary, colorPalette.secondary, colorPalette.accent];

  for (let i = 0; i < 4; i++) {
    const centerX = Math.random() * width;
    const centerY = Math.random() * height;
    const color = colors[Math.floor(Math.random() * colors.length)];

    ctx.fillStyle = color + "25";
    ctx.beginPath();

    const points = 8;
    for (let j = 0; j < points; j++) {
      const angle = (j / points) * Math.PI * 2;
      const radius = 40 + Math.random() * 60;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;

      if (j === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    ctx.closePath();
    ctx.fill();
  }
}

// ElevenLabs TTS entegrasyonu
const ELEVENLABS_API_KEY = "sk_eb003409e135b985acb687a3c21b8eb891a490f9ae97084f";
const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1";

// Kaliteli ses karakterleri (ElevenLabs'dan seçilmiş sesler)
const VOICE_CHARACTERS = {
  brian: "nPczCjzI2devNBz1zQrb", // Erkek, Brian (özel)
  voice1: "eyuCA3LWMylRajljTeOo", // Ses 1
  voice2: "dMyQqiVXTU80dDl2eNK8", // Ses 2
  voice3: "YCkxryRNUmfOIgIS2y61", // Ses 3
  voice4: "h061KGyOtpLYDxcoi8E3", // Ses 4
  voice5: "kpiE5HkOcaC7zMRavpg1", // Ses 5
};

// ElevenLabs API key dosya yolları
const ELEVENLABS_APIS_FILE = path.join(__dirname, "data", "elevenlabs_apis.json");

// ElevenLabs API key'lerini yükle
async function loadElevenLabsAPIs() {
  try {
    const data = await fs.readFile(ELEVENLABS_APIS_FILE, "utf8");
    let apis = JSON.parse(data);

    // Eğer hiç aktif API yoksa ilk API'yı aktif yap
    const hasActiveAPI = apis.some((api) => api.active === true);
    if (!hasActiveAPI && apis.length > 0) {
      apis[0].active = true;
      await saveElevenLabsAPIs(apis);
      console.log(`Hiç aktif API bulunamadı, ${apis[0].name} otomatik aktif yapıldı`);
    }

    return apis;
  } catch {
    return [];
  }
}

// ElevenLabs API key'lerini kaydet
async function saveElevenLabsAPIs(apis) {
  await ensureDataDir();
  await fs.writeFile(ELEVENLABS_APIS_FILE, JSON.stringify(apis, null, 2));
}

// ElevenLabs TTS için ses karakterleri
const ELEVENLABS_VOICES = {
  thomas: {
    id: "GBv7mTt0atIp3Br8iCZE", // Thomas
    name: "Thomas (American Male)",
    language: "en",
    type: "elevenlabs",
    gender: "male",
    description: "American English, clear voice male",
  },
  freya: {
    id: "jsCqWAovK2LkecY7zXl4", // Freya
    name: "Freya (American Female)",
    language: "en",
    type: "elevenlabs",
    gender: "female",
    description: "American English, clear voice female",
  },
  domi: {
    id: "AZnzlk1XvdvUeBnXmlld", // Domi
    name: "Domi (American Female)",
    language: "en",
    type: "elevenlabs",
    gender: "female",
    description: "American English, warm voice female",
  },
  rachel: {
    id: "21m00Tcm4TlvDq8ikWAM", // Rachel - Default
    name: "Rachel (American Female)",
    language: "en",
    type: "elevenlabs",
    gender: "female",
    description: "American English, young adult female",
  },
  drew: {
    id: "29vD33N1CtxCmqQRPOHJ", // Drew - Default
    name: "Drew (American Male)",
    language: "en",
    type: "elevenlabs",
    gender: "male",
    description: "American English, middle-aged male",
  },
  clyde: {
    id: "2EiwWnXFnvU5JabPnv8n", // Clyde - Default
    name: "Clyde (American Male)",
    language: "en",
    type: "elevenlabs",
    gender: "male",
    description: "American English, middle-aged male",
  },
  antoni: {
    id: "ErXwobaYiN019PkySvjV", // Antoni - Default
    name: "Antoni (American Male)",
    language: "en",
    type: "elevenlabs",
    gender: "male",
    description: "American English, young adult male",
  },
};

// TTS için metin temizleme fonksiyonu
function cleanTextForTTS(text) {
  const originalText = text;

  const cleanedText = text
    .replace(/CODE_BLOCK:[\s\S]*?```[\s\S]*?```/g, "") // Kod bloklarını kaldır
    .replace(/```[\s\S]*?```/g, "") // Markdown kod bloklarını kaldır
    .replace(/`([^`]+)`/g, (match, content) => {
      // Tek tırnak içindeki içeriği koru, sadece tırnakları kaldır
      return content;
    })
    // HTML tag'larını kaldır (açılış ve kapanış tag'ları)
    .replace(/<\/?[^>]+(>|$)/g, "") // Tüm HTML tag'larını kaldır
    .replace(/&lt;/g, "") // HTML entity'leri kaldır
    .replace(/&gt;/g, "")
    .replace(/&amp;/g, "and")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    // Markdown temizleme
    .replace(/\*\*(.*?)\*\*/g, "$1") // Bold markdown
    .replace(/\*(.*?)\*/g, "$1") // Italic markdown
    .replace(/\[.*?\]/g, "") // Köşeli parantezleri kaldır
    .replace(/[#*_]/g, "") // Markdown karakterleri
    // Boşluk ve satır temizleme
    .replace(/\s+/g, " ") // Çoklu boşlukları tek boşluğa çevir
    .replace(/\n+/g, ". ") // Satır sonlarını nokta ile değiştir
    .trim();

  console.log("TTS Metin Temizleme:");
  console.log("Orijinal:", originalText.substring(0, 150) + "...");
  console.log("Temizlenmiş:", cleanedText.substring(0, 150) + "...");

  return cleanedText;
}

// Google Cloud TTS için kaliteli İngilizce ses karakterleri
const GOOGLE_TTS_VOICES = {
  "en-US-Chirp3-HD-Aoede": { name: "en-US-Chirp3-HD-Aoede", label: "Chirp3 HD - Aoede (Female)", gender: "FEMALE" },
  "en-US-Chirp3-HD-Puck": { name: "en-US-Chirp3-HD-Puck", label: "Chirp3 HD - Puck (Male)", gender: "MALE" },
  "en-US-Chirp3-HD-Charon": { name: "en-US-Chirp3-HD-Charon", label: "Chirp3 HD - Charon (Male)", gender: "MALE" },
  "en-US-Chirp3-HD-Kore": { name: "en-US-Chirp3-HD-Kore", label: "Chirp3 HD - Kore (Female)", gender: "FEMALE" },
  "en-US-Chirp3-HD-Fenrir": { name: "en-US-Chirp3-HD-Fenrir", label: "Chirp3 HD - Fenrir (Male)", gender: "MALE" },
  "en-US-Chirp3-HD-Leda": { name: "en-US-Chirp3-HD-Leda", label: "Chirp3 HD - Leda (Female)", gender: "FEMALE" },
  "en-US-Chirp3-HD-Orus": { name: "en-US-Chirp3-HD-Orus", label: "Chirp3 HD - Orus (Male)", gender: "MALE" },
  "en-US-Chirp3-HD-Zephyr": { name: "en-US-Chirp3-HD-Zephyr", label: "Chirp3 HD - Zephyr (Female)", gender: "FEMALE" },
  "en-US-Neural2-J": { name: "en-US-Neural2-J", label: "English (US) - Neural2 J (Male)", gender: "MALE" },
  "en-US-Neural2-I": { name: "en-US-Neural2-I", label: "English (US) - Neural2 I (Female)", gender: "FEMALE" },
  "en-US-Wavenet-D": { name: "en-US-Wavenet-D", label: "English (US) - WaveNet D (Male)", gender: "MALE" },
  "en-US-Wavenet-F": { name: "en-US-Wavenet-F", label: "English (US) - WaveNet F (Female)", gender: "FEMALE" },
  "en-GB-Neural2-A": { name: "en-GB-Neural2-A", label: "English (UK) - Neural2 A (Male)", gender: "MALE" },
  "en-GB-Neural2-B": { name: "en-GB-Neural2-B", label: "English (UK) - Neural2 B (Female)", gender: "FEMALE" },
  "en-AU-Neural2-A": { name: "en-AU-Neural2-A", label: "English (AU) - Neural2 A (Male)", gender: "MALE" },
  "en-AU-Neural2-B": { name: "en-AU-Neural2-B", label: "English (AU) - Neural2 B (Female)", gender: "FEMALE" },
};

// Coqui TTS için ses karakterleri - xtts_v2 modeli ile voice cloning yapılacak
const COQUI_TTS_VOICES = {
  brian: { name: "brian", label: "Brian (Male - Tech Narrator)", type: "coqui", model: "tts_models/multilingual/multi-dataset/xtts_v2" },
  sarah: { name: "sarah", label: "Sarah (Female - Clear Voice)", type: "coqui", model: "tts_models/multilingual/multi-dataset/xtts_v2" },
  alex: { name: "alex", label: "Alex (Male - Deep Voice)", type: "coqui", model: "tts_models/multilingual/multi-dataset/xtts_v2" },
  emma: { name: "emma", label: "Emma (Female - Warm Voice)", type: "coqui", model: "tts_models/multilingual/multi-dataset/xtts_v2" },
  david: { name: "david", label: "David (Male - Professional)", type: "coqui", model: "tts_models/multilingual/multi-dataset/xtts_v2" },
  lisa: { name: "lisa", label: "Lisa (Female - Friendly)", type: "coqui", model: "tts_models/multilingual/multi-dataset/xtts_v2" },
};

// Tüm TTS sesleri birleştir
const ALL_TTS_VOICES = {
  ...GOOGLE_TTS_VOICES,
  ...COQUI_TTS_VOICES,
  ...ELEVENLABS_VOICES,
};

// Coqui TTS fonksiyonu - xtts_v2 modeli ile
async function generateCoquiTTS(text, voiceId, questionId, stepIndex) {
  try {
    const cleanText = cleanTextForTTS(text);
    if (!cleanText || cleanText.length < 3) {
      console.log("Metin çok kısa, Coqui TTS atlanıyor:", cleanText);
      return null;
    }

    const voice = COQUI_TTS_VOICES[voiceId];
    if (!voice) {
      console.error("Geçersiz Coqui TTS ses ID:", voiceId);
      return null;
    }

    // Audio klasörü oluştur
    const audioDir = path.join(__dirname, "public", "audio");
    if (!fsSync.existsSync(audioDir)) {
      fsSync.mkdirSync(audioDir, { recursive: true });
    }

    const fileName = `coqui_audio_${questionId}_step_${stepIndex}_${Date.now()}.wav`;
    const outputPath = path.join(audioDir, fileName);

    // Ses örneği dosyaları klasörü
    const voiceSamplesDir = path.join(__dirname, "voice-samples");
    const speakerWavPath = path.join(voiceSamplesDir, `${voiceId}.wav`);

    // Python script ile Coqui TTS çalıştır
    const pythonScript = `
import sys
import os

try:
    # PyTorch güvenlik ayarını devre dışı bırak (weights_only=False)
    import torch

    # torch.load'ı monkey patch ile değiştir
    original_load = torch.load
    def patched_load(*args, **kwargs):
        kwargs['weights_only'] = False
        return original_load(*args, **kwargs)
    torch.load = patched_load

    from TTS.api import TTS

    # Model yükle
    print("Model yükleniyor: ${voice.model}")
    tts = TTS("${voice.model}")
    print("Model başarıyla yüklendi")

    # TTS oluştur
    text = """${cleanText.replace(/"/g, '\\"')}"""
    output_path = "${outputPath.replace(/\\/g, "/")}"

    print("TTS oluşturuluyor...")

    # Speaker wav dosyası varsa kullan (voice cloning)
    speaker_wav = "${speakerWavPath.replace(/\\/g, "/")}"
    if os.path.exists(speaker_wav):
        print(f"Voice cloning ile TTS oluşturuluyor: {speaker_wav}")
        tts.tts_to_file(text=text, speaker_wav=speaker_wav, language="en", file_path=output_path)
    else:
        print("Speaker wav dosyası bulunamadı, varsayılan model ile deneniyor...")
        try:
            # XTTS v2 modeli için speaker gerekli
            tts.tts_to_file(text=text, language="en", file_path=output_path)
        except ValueError as e:
            if "speaker" in str(e):
                print("Speaker gerekli, alternatif model kullanılıyor...")
                # Alternatif model kullan
                tts2 = TTS("tts_models/en/ljspeech/tacotron2-DDC")
                tts2.tts_to_file(text=text, file_path=output_path)
            else:
                raise

    print(f"TTS başarıyla oluşturuldu: {output_path}")
    print("SUCCESS")

except Exception as e:
    import traceback
    print(f"Hata: {e}")
    print("Traceback:")
    traceback.print_exc()
    print("ERROR")
`;

    // Python script'i geçici dosyaya yaz
    const scriptPath = path.join(__dirname, "temp_tts_script.py");
    fsSync.writeFileSync(scriptPath, pythonScript);

    return new Promise((resolve, reject) => {
      console.log("Python script ile Coqui TTS çalıştırılıyor...");

      // Python script'i çalıştır - python3.10 yerine python dene
      const pythonProcess = spawn("python", [scriptPath], {
        stdio: ["pipe", "pipe", "pipe"],
        shell: true, // Windows için shell kullan
      });

      let stdout = "";
      let stderr = "";
      let isTimedOut = false;

      pythonProcess.stdout.on("data", (data) => {
        stdout += data.toString();
        console.log("Python stdout:", data.toString().trim());
      });

      pythonProcess.stderr.on("data", (data) => {
        stderr += data.toString();
        console.log("Python stderr:", data.toString().trim());
      });

      pythonProcess.on("close", (code) => {
        // Geçici script dosyasını sil
        try {
          fsSync.unlinkSync(scriptPath);
        } catch (e) {}

        if (isTimedOut) {
          console.log("Process was killed due to timeout");
          return;
        }

        console.log("Python process tamamlandı, exit code:", code);
        console.log("Stdout:", stdout);
        console.log("Stderr:", stderr);

        if (code === 0 && stdout.includes("SUCCESS") && fsSync.existsSync(outputPath)) {
          console.log(`Coqui TTS başarıyla oluşturuldu: ${fileName}`);
          resolve(`/audio/${fileName}`);
        } else {
          console.error("Coqui TTS hatası:");
          console.error("Exit code:", code);
          console.error("Stdout:", stdout);
          console.error("Stderr:", stderr);
          resolve(null);
        }
      });

      pythonProcess.on("error", (error) => {
        console.error("Python process hatası:", error);
        try {
          fsSync.unlinkSync(scriptPath);
        } catch (e) {}
        resolve(null);
      });

      // 120 saniye timeout (2 dakika)
      const timeoutHandle = setTimeout(() => {
        isTimedOut = true;
        console.error("Coqui TTS timeout (120s)");
        pythonProcess.kill("SIGTERM");

        // 5 saniye sonra force kill
        setTimeout(() => {
          pythonProcess.kill("SIGKILL");
        }, 5000);

        try {
          fsSync.unlinkSync(scriptPath);
        } catch (e) {}
        resolve(null);
      }, 120000);
    });
  } catch (error) {
    console.error("Coqui TTS oluşturma hatası:", error.message);
    return null;
  }
}

// Google Cloud TTS fonksiyonu (İngilizce, en iyi sesler)
async function generateGoogleTTS(text, voiceId, questionId, stepIndex) {
  try {
    const cleanText = cleanTextForTTS(text);
    if (!cleanText || cleanText.length < 3) {
      console.log("Metin çok kısa, Google TTS atlanıyor:", cleanText);
      return null;
    }

    // Voice seçimi
    const voice = GOOGLE_TTS_VOICES[voiceId] || GOOGLE_TTS_VOICES["en-US-Chirp3-HD-Aoede"];
    const languageCode = voice.name.split("-").slice(0, 2).join("-");
    let ssmlGender = voice.gender || "MALE";

    // Google Cloud TTS REST API endpoint
    const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_TTS_API_KEY}`;
    const requestBody = {
      input: { text: cleanText },
      voice: {
        languageCode: languageCode,
        name: voice.name,
        ssmlGender: ssmlGender,
      },
      audioConfig: {
        audioEncoding: "MP3",
      },
    };

    const response = await axios.post(url, requestBody);
    const audioContent = response.data.audioContent;
    if (!audioContent) {
      console.error("Google TTS: audioContent yok");
      return null;
    }

    // Audio dosyasını kaydet
    const audioDir = path.join(__dirname, "public", "audio");
    if (!fsSync.existsSync(audioDir)) {
      fsSync.mkdirSync(audioDir, { recursive: true });
    }
    const fileName = `google_audio_${questionId}_step_${stepIndex}_${Date.now()}.mp3`;
    const filePath = path.join(audioDir, fileName);
    fsSync.writeFileSync(filePath, Buffer.from(audioContent, "base64"));
    console.log(`Google TTS başarıyla oluşturuldu: ${fileName}`);
    return `/audio/${fileName}`;
  } catch (error) {
    console.error("Google TTS oluşturma hatası:", error.message);
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", error.response.data);
    }
    return null;
  }
}

// Adımları TTS ile işleme fonksiyonu
async function processStepsWithTTS(steps, questionId, voiceId, sendProgress) {
  const processedSteps = [];
  let ttsEnabled = true; // TTS durumunu takip et

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];

    // Progress güncelle
    const ttsProgress = 85 + (i / steps.length) * 10; // %85-95 arası TTS için

    if (ttsEnabled) {
      sendProgress(5, ttsProgress, `Seslendirme oluşturuluyor... (${i + 1}/${steps.length})`);
    } else {
      sendProgress(5, ttsProgress, `İçerik hazırlanıyor... (${i + 1}/${steps.length})`);
    }

    let audioPath = null;

    // TTS oluştur (sadece etkinse)
    if (ttsEnabled) {
      audioPath = await generateTTS(step.text, voiceId, questionId, i);

      // İlk TTS hatası durumunda TTS'i devre dışı bırak
      if (audioPath === null && i === 0) {
        console.log("TTS devre dışı bırakılıyor - API limiti aşılmış olabilir");
        ttsEnabled = false;
      }
    }

    processedSteps.push({
      ...step,
      audioPath: audioPath,
    });

    // API rate limit için kısa bekleme (sadece TTS etkinse)
    if (ttsEnabled) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return processedSteps;
}

const GOOGLE_TTS_API_KEY = "AIzaSyBehe_uZ7eJPJcKk9cUaDCm6lT8UlbJwCw";

// TTS ses listesi API endpoint'i
app.get("/api/tts-voices", (req, res) => {
  try {
    // Sesleri kategorize et
    const googleVoices = Object.entries(GOOGLE_TTS_VOICES).map(([id, voice]) => ({
      id,
      ...voice,
      type: "google",
      provider: "Google Cloud TTS",
    }));

    const coquiVoices = Object.entries(COQUI_TTS_VOICES).map(([id, voice]) => ({
      id,
      ...voice,
      provider: "Coqui AI TTS",
    }));

    const elevenlabsVoices = Object.entries(ELEVENLABS_VOICES).map(([key, voice]) => ({
      id: voice.id, // h061KGyOtpLYDxcoi8E3 (gerçek voice ID - frontend için)
      backendKey: key, // ravi (backend için)
      label: voice.name, // Frontend için label ekle
      ...voice,
      provider: "ElevenLabs TTS",
    }));

    res.json({
      success: true,
      voices: {
        google: googleVoices,
        coqui: coquiVoices,
        elevenlabs: elevenlabsVoices,
        all: [...googleVoices, ...coquiVoices, ...elevenlabsVoices],
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Coqui TTS test endpoint'i
app.post("/api/test-coqui-tts", async (req, res) => {
  try {
    const { text = "Hello, this is a test", voiceId = "brian" } = req.body;

    if (!text || text.trim().length < 3) {
      return res.status(400).json({
        success: false,
        error: "Metin çok kısa",
      });
    }

    const audioPath = await generateCoquiTTS(text, voiceId, "test", 0);

    if (audioPath) {
      res.json({
        success: true,
        audioPath: audioPath,
        message: "Coqui TTS başarıyla çalıştı",
      });
    } else {
      res.status(500).json({
        success: false,
        error: "Coqui TTS oluşturulamadı",
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ElevenLabs TTS fonksiyonu
async function generateElevenLabsTTS(text, voiceId, questionId, stepIndex) {
  try {
    const cleanText = cleanTextForTTS(text);
    if (!cleanText || cleanText.length < 3) {
      console.log("Metin çok kısa, ElevenLabs TTS atlanıyor:", cleanText);
      return null;
    }

    const voice = ELEVENLABS_VOICES[voiceId];
    if (!voice) {
      console.error("Geçersiz ElevenLabs ses ID:", voiceId);
      return null;
    }

    // API key'leri yükle
    let apis = await loadElevenLabsAPIs();
    if (apis.length === 0) {
      console.error("ElevenLabs API key bulunamadı");
      return null;
    }

    // Aktif API'ları filtrele
    let activeAPIs = apis.filter((api) => api.active !== false);
    if (activeAPIs.length === 0) {
      console.error("Aktif ElevenLabs API key bulunamadı");
      return null;
    }

    // ElevenLabs TTS API çağrısı
    const url = `${ELEVENLABS_API_URL}/text-to-speech/${voice.id}`;

    const requestBody = {
      text: cleanText,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.5,
        style: 0.0,
        use_speaker_boost: true,
      },
    };

    // Tüm aktif API'ları sırayla dene
    for (let i = 0; i < activeAPIs.length; i++) {
      const currentAPI = activeAPIs[i];
      console.log(`Deneniyor: ${currentAPI.name} (${i + 1}/${activeAPIs.length})`);

      try {
        const response = await axios.post(url, requestBody, {
          headers: {
            Accept: "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": currentAPI.key,
          },
          responseType: "arraybuffer",
        });

        if (response.status === 200) {
          // Başarılı! Audio dosyasını kaydet
          const audioDir = path.join(__dirname, "public", "audio");
          if (!fsSync.existsSync(audioDir)) {
            fsSync.mkdirSync(audioDir, { recursive: true });
          }

          const fileName = `elevenlabs_audio_${questionId}_step_${stepIndex}_${Date.now()}.mp3`;
          const filePath = path.join(audioDir, fileName);

          fsSync.writeFileSync(filePath, Buffer.from(response.data));
          console.log(`ElevenLabs TTS başarıyla oluşturuldu: ${fileName} (API: ${currentAPI.name})`);

          // Bu API'yı aktif olarak işaretle ve diğerlerini pasif yap
          apis = apis.map((api, index) => ({
            ...api,
            active: api.key === currentAPI.key, // Sadece bu API aktif
          }));
          await saveElevenLabsAPIs(apis);
          console.log(`Aktif API güncellendi: ${currentAPI.name}`);

          return `/audio/${fileName}`;
        }
      } catch (error) {
        console.error(`API ${currentAPI.name} hatası:`, error.message);

        if (error.response) {
          console.error("Status:", error.response.status);

          // Hata verilerini decode et
          let isLimitError = false;
          if (error.response.data) {
            try {
              const errorData = Buffer.isBuffer(error.response.data) ? JSON.parse(error.response.data.toString()) : error.response.data;

              if (errorData.detail?.status === "voice_limit_reached" || errorData.detail?.status === "quota_exceeded" || error.response.status === 429) {
                console.error(`${currentAPI.name} limit doldu:`, errorData.detail?.message || "Quota exceeded");
                isLimitError = true;

                // Bu API'yı pasif yap
                apis = apis.map((api) => (api.key === currentAPI.key ? { ...api, active: false } : api));
                await saveElevenLabsAPIs(apis);
                console.log(`${currentAPI.name} pasif olarak işaretlendi`);
              }
            } catch (parseError) {
              console.error("Error parsing ElevenLabs response:", parseError);
            }
          }

          // Eğer limit hatası değilse ve son API ise, hata döndür
          if (!isLimitError && i === activeAPIs.length - 1) {
            console.error(`Tüm API'lar başarısız. Son hata: ${error.message}`);
            return null;
          }

          // Limit hatası ise bir sonraki API'ya geç
          if (isLimitError) {
            console.log(`API ${currentAPI.name} limit doldu, diğer API deneniyor...`);
            continue;
          }
        }
      }
    }

    console.error("Tüm ElevenLabs API'lar limit doldu veya başarısız");
    return null;
  } catch (error) {
    console.error("ElevenLabs TTS genel hatası:", error.message);
    return null;
  }
}

// ElevenLabs TTS test endpoint'i
app.post("/api/test-elevenlabs-tts", async (req, res) => {
  try {
    const { text = "This is a test", voiceId = "rachel" } = req.body;

    if (!text || text.trim().length < 3) {
      return res.status(400).json({
        success: false,
        error: "Metin çok kısa",
      });
    }

    // VoiceId mapping - frontend'ten gelen ID'yi backend key'ine çevir
    let actualVoiceId = voiceId;

    // Eğer gerçek voice ID gelirse (h061KGyOtpLYDxcoi8E3), backend key'ini bul
    const elevenlabsVoiceEntry = Object.entries(ELEVENLABS_VOICES).find(([key, voiceData]) => voiceData.id === voiceId);
    if (elevenlabsVoiceEntry) {
      actualVoiceId = elevenlabsVoiceEntry[0]; // backend key'ini kullan (ravi)
    }

    console.log(`ElevenLabs test: frontend voiceId=${voiceId}, backend actualVoiceId=${actualVoiceId}`);

    const audioPath = await generateElevenLabsTTS(text, actualVoiceId, "test", 0);

    if (audioPath) {
      res.json({
        success: true,
        audioPath: audioPath,
        message: "ElevenLabs TTS başarıyla çalıştı",
      });
    } else {
      res.status(500).json({
        success: false,
        error: "ElevenLabs TTS oluşturulamadı - Voice limit dolmuş olabilir veya API key kontrol edin",
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ElevenLabs API key'lerini listeleme
app.get("/api/elevenlabs-apis", async (req, res) => {
  try {
    const apis = await loadElevenLabsAPIs();
    // Güvenlik için API key'leri maskeleyerek döndür
    const maskedAPIs = apis.map((api, index) => ({
      id: index,
      name: api.name || `API ${index + 1}`,
      keyPreview: api.key ? `${api.key.substring(0, 8)}...` : "Yok",
      active: api.active !== false,
      addedAt: api.addedAt || new Date().toISOString(),
    }));

    res.json({
      success: true,
      apis: maskedAPIs,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ElevenLabs API key ekleme
app.post("/api/elevenlabs-apis", async (req, res) => {
  try {
    const { name, key } = req.body;

    if (!name || !key) {
      return res.status(400).json({
        success: false,
        error: "İsim ve API key gerekli",
      });
    }

    // API key formatını kontrol et
    if (!key.startsWith("sk_")) {
      return res.status(400).json({
        success: false,
        error: "Geçersiz ElevenLabs API key formatı",
      });
    }

    const apis = await loadElevenLabsAPIs();

    // Yeni API ekle
    const newAPI = {
      name: name.trim(),
      key: key.trim(),
      active: true,
      addedAt: new Date().toISOString(),
    };

    apis.push(newAPI);
    await saveElevenLabsAPIs(apis);

    res.json({
      success: true,
      message: "API key başarıyla eklendi",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ElevenLabs API key silme
app.delete("/api/elevenlabs-apis/:id", async (req, res) => {
  try {
    const apiId = parseInt(req.params.id);
    const apis = await loadElevenLabsAPIs();

    if (apiId < 0 || apiId >= apis.length) {
      return res.status(404).json({
        success: false,
        error: "API bulunamadı",
      });
    }

    apis.splice(apiId, 1);
    await saveElevenLabsAPIs(apis);

    res.json({
      success: true,
      message: "API key başarıyla silindi",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ElevenLabs API key aktif/pasif durumu değiştirme
app.patch("/api/elevenlabs-apis/:id", async (req, res) => {
  try {
    const apiId = parseInt(req.params.id);
    let apis = await loadElevenLabsAPIs();

    if (apiId < 0 || apiId >= apis.length) {
      return res.status(404).json({
        success: false,
        error: "API bulunamadı",
      });
    }

    // Toggle yapısı - mevcut durumun tersini al
    const currentStatus = apis[apiId].active !== false; // undefined veya true ise true
    apis[apiId].active = !currentStatus;

    await saveElevenLabsAPIs(apis);

    res.json({
      success: true,
      message: `API ${apis[apiId].active ? "aktif" : "pasif"} duruma getirildi`,
      newStatus: apis[apiId].active,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

async function generateTTS(text, voiceId = "en-US-Neural2-J", questionId, stepIndex) {
  let voice = ALL_TTS_VOICES[voiceId];
  let actualVoiceId = voiceId;

  // ElevenLabs gerçek voice ID'si geldiğinde backend key'ini bul
  if (!voice) {
    // ElevenLabs voice ID'si için backend key'ini ara
    const elevenlabsVoiceEntry = Object.entries(ELEVENLABS_VOICES).find(([key, voiceData]) => voiceData.id === voiceId);
    if (elevenlabsVoiceEntry) {
      const [backendKey, voiceData] = elevenlabsVoiceEntry;
      voice = voiceData;
      actualVoiceId = backendKey; // ravi gibi backend key'ini kullan
    }
  }

  if (!voice) {
    console.error("Geçersiz ses ID:", voiceId);
    return null;
  }

  // Ses tipine göre uygun TTS fonksiyonunu çağır
  if (voice.type === "coqui") {
    return await generateCoquiTTS(text, actualVoiceId, questionId, stepIndex);
  } else if (voice.type === "elevenlabs") {
    return await generateElevenLabsTTS(text, actualVoiceId, questionId, stepIndex);
  } else {
    return await generateGoogleTTS(text, actualVoiceId, questionId, stepIndex);
  }
}

// ElevenLabs kullanıcı bilgileri ve limit sorgulama
app.get("/api/elevenlabs-user-info", async (req, res) => {
  try {
    const apis = await loadElevenLabsAPIs();
    const activeAPIs = apis.filter((api) => api.active !== false);

    if (activeAPIs.length === 0) {
      return res.json({
        success: false,
        error: "Aktif API key bulunamadı",
      });
    }

    const results = [];

    for (const api of activeAPIs) {
      try {
        const userResponse = await axios.get("https://api.elevenlabs.io/v1/user", {
          headers: {
            "xi-api-key": api.key,
            "Content-Type": "application/json",
          },
        });

        const subscriptionResponse = await axios.get("https://api.elevenlabs.io/v1/user/subscription", {
          headers: {
            "xi-api-key": api.key,
            "Content-Type": "application/json",
          },
        });

        results.push({
          name: api.name,
          keyPreview: `${api.key.substring(0, 8)}...`,
          user: userResponse.data,
          subscription: subscriptionResponse.data,
          status: "active",
        });
      } catch (error) {
        results.push({
          name: api.name,
          keyPreview: `${api.key.substring(0, 8)}...`,
          error: error.response?.status === 401 ? "Invalid API Key" : error.message,
          status: "error",
        });
      }
    }

    res.json({
      success: true,
      apis: results,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// YouTube API configuration
const { google } = require("googleapis");

// YouTube OAuth konfigürasyonu
const YOUTUBE_CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const YOUTUBE_CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
const YOUTUBE_REDIRECT_URI = process.env.YOUTUBE_REDIRECT_URI;

const oauth2Client = new google.auth.OAuth2(YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REDIRECT_URI);

// YouTube scopes
const SCOPES = ["https://www.googleapis.com/auth/youtube.upload"];

// Video dosyaları için multer konfigürasyonu
const videoStorage = {
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, "temp", "videos");
    if (!fsSync.existsSync(dir)) {
      fsSync.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, `video_${req.body.questionId}_${Date.now()}${ext}`);
  },
};

// Multer için gerekli modül
const multer = require("multer");

const videoUpload = multer({
  storage: multer.diskStorage(videoStorage),
  limits: {
    fileSize: 50 * 1024 * 1024 * 1024, // 50GB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      cb(new Error("Sadece video dosyaları kabul edilir"));
    }
  },
});

// YouTube yetkilendirme durumu kontrol
app.get("/api/youtube/auth-status", (req, res) => {
  try {
    const credentials = oauth2Client.credentials;
    const isAuthenticated = !!(credentials && credentials.access_token);

    res.json({
      authenticated: isAuthenticated,
      user: isAuthenticated ? { name: "YouTube User" } : null,
    });
  } catch (error) {
    res.json({
      authenticated: false,
      error: error.message,
    });
  }
});

// YouTube yetkilendirme başlatma
app.get("/api/youtube/auth", (req, res) => {
  try {
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
      prompt: "consent",
    });

    res.redirect(authUrl);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// YouTube yetkilendirme callback
app.get("/api/youtube/callback", async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      throw new Error("Authorization code not received");
    }

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Token'ları kalıcı olarak sakla (production'da database kullanın)
    const tokenPath = path.join(__dirname, "temp", "youtube_tokens.json");
    fsSync.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2));

    res.send(`
      <html>
        <body>
          <h2>YouTube Authorization Successful!</h2>
          <p>You can now close this window.</p>
          <script>
            window.close();
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("YouTube auth error:", error);
    res.status(500).send(`
      <html>
        <body>
          <h2>Authorization Failed</h2>
          <p>Error: ${error.message}</p>
        </body>
      </html>
    `);
  }
});

// Video kaydetme endpoint'i
app.post("/api/save-video-for-youtube", videoUpload.single("video"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "Video dosyası gerekli",
      });
    }

    res.json({
      success: true,
      videoFile: req.file.filename,
      filePath: req.file.path,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// YouTube upload sayfası route
app.get("/youtube-upload/:id", async (req, res) => {
  try {
    const questionId = req.params.id;
    const videoFile = req.query.videoFile;

    const questions = await loadQuestions();
    const question = questions.find((q) => q.id == questionId);

    if (!question) {
      return res.status(404).send("Soru bulunamadı");
    }

    // Video verilerini session'dan veya temp dosyadan al
    const tempDataPath = path.join(__dirname, "temp", `video_data_${questionId}.json`);
    let videoData = {};

    if (fsSync.existsSync(tempDataPath)) {
      videoData = JSON.parse(fsSync.readFileSync(tempDataPath, "utf8"));
    } else {
      // Fallback: Basic video data
      videoData = {
        title: question.title,
        description: `${question.title}\n\nStackOverflow Question: ${question.question}`,
        keywords: [question.category, "programming", "coding", "tutorial"],
        thumbnail: null,
      };
    }

    res.render("youtube-upload", {
      question,
      videoData,
      videoFile,
    });
  } catch (error) {
    console.error("YouTube upload page error:", error);
    res.status(500).send("Sayfa yüklenirken hata oluştu");
  }
});

// Token'ları yükle (uygulama başlangıcında)
function loadYouTubeTokens() {
  try {
    const tokenPath = path.join(__dirname, "temp", "youtube_tokens.json");
    if (fsSync.existsSync(tokenPath)) {
      const tokens = JSON.parse(fsSync.readFileSync(tokenPath, "utf8"));
      oauth2Client.setCredentials(tokens);
      console.log("YouTube tokens loaded successfully");
    }
  } catch (error) {
    console.error("Error loading YouTube tokens:", error);
  }
}

// YouTube video yükleme
app.post(
  "/api/youtube/upload",
  videoUpload.fields([
    { name: "videoFile", maxCount: 1 },
    { name: "thumbnailFile", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      console.log("Upload request body:", req.body); // Debug için

      const { questionId, customTitle, customDescription, privacy, category, uploadType, scheduledTime } = req.body;

      // Tags ve videoData'yı güvenli şekilde parse et
      let tags = [];
      let videoData = {};

      try {
        tags = req.body.tags ? JSON.parse(req.body.tags) : [];
      } catch (e) {
        console.log("Tags parse error:", e);
        tags = [];
      }

      try {
        videoData = req.body.videoData ? JSON.parse(req.body.videoData) : {};
      } catch (e) {
        console.log("VideoData parse error:", e);
        videoData = {};
      }

      // Check authentication
      const credentials = oauth2Client.credentials;
      if (!credentials || !credentials.access_token) {
        return res.status(401).json({
          success: false,
          error: "YouTube authentication required",
        });
      }

      // Video dosyasını kontrol et
      if (!req.files || !req.files.videoFile || req.files.videoFile.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Video dosyası gerekli",
        });
      }
      const videoPath = req.files.videoFile[0].path;

      // YouTube API setup
      const youtube = google.youtube({ version: "v3", auth: oauth2Client });

      // Video metadata - formdan gelen özel değerler öncelikli
      const finalTitle = customTitle || videoData.title || "Yüklenen Video";
      const finalDescription = customDescription || videoData.description || "Açıklama yok";
      const finalTags = tags.length > 0 ? tags : videoData.keywords || [];

      const videoMetadata = {
        snippet: {
          title: finalTitle,
          description: finalDescription,
          tags: finalTags,
          categoryId: category || "27", // Education
          defaultLanguage: "tr",
        },
        status: {
          privacyStatus: privacy || "private",
          publishAt: uploadType === "scheduled" && scheduledTime ? new Date(scheduledTime).toISOString() : undefined,
        },
      };

      console.log("Final video metadata:", videoMetadata); // Debug için

      // Upload video
      const uploadResponse = await youtube.videos.insert({
        part: ["snippet", "status"],
        resource: videoMetadata,
        media: {
          body: require("fs").createReadStream(videoPath),
        },
      });

      const videoId = uploadResponse.data.id;
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

      console.log("Upload successful, video ID:", videoId); // Debug için

      // Thumbnail yükleme (eğer dosya seçildiyse)
      if (req.files && req.files.thumbnailFile) {
        try {
          const thumbnailPath = req.files.thumbnailFile[0].path;
          await youtube.thumbnails.set({
            videoId: videoId,
            media: {
              body: require("fs").createReadStream(thumbnailPath),
            },
          });
          console.log("Custom thumbnail uploaded successfully");

          // Thumbnail dosyasını temizle
          fsSync.unlinkSync(thumbnailPath);
        } catch (thumbnailError) {
          console.error("Thumbnail upload error:", thumbnailError);
          // Thumbnail hatası video yüklemeyi engellemez
        }
      }

      // Video dosyasını temizle
      try {
        fsSync.unlinkSync(videoPath);
      } catch (cleanupError) {
        console.error("Video cleanup error:", cleanupError);
      }

      res.json({
        success: true,
        videoId: videoId,
        videoUrl: videoUrl,
        title: finalTitle,
        description: finalDescription,
        tags: finalTags,
        message: uploadType === "scheduled" ? "Video zamanlandı" : "Video başarıyla yüklendi",
      });
    } catch (error) {
      console.error("YouTube upload error:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// Token yenileme middleware
setInterval(async () => {
  try {
    if (oauth2Client.credentials && oauth2Client.credentials.refresh_token) {
      const { credentials } = await oauth2Client.refreshAccessToken();
      oauth2Client.setCredentials(credentials);

      // Güncellenmiş token'ları kaydet
      const tokenPath = path.join(__dirname, "temp", "youtube_tokens.json");
      fsSync.writeFileSync(tokenPath, JSON.stringify(credentials, null, 2));
    }
  } catch (error) {
    console.error("Token refresh error:", error);
  }
}, 30 * 60 * 1000); // Her 30 dakikada bir kontrol et

// Uygulama başlangıcında token'ları yükle
loadYouTubeTokens();

// Video verilerini kaydetme endpoint'i (YouTube upload için)
app.post("/api/save-video-data", async (req, res) => {
  try {
    const { questionId, videoData } = req.body;

    if (!questionId || !videoData) {
      return res.status(400).json({
        success: false,
        error: "Question ID ve video verileri gerekli",
      });
    }

    // Video verilerini temp dosyaya kaydet
    const tempDataPath = path.join(__dirname, "temp", `video_data_${questionId}.json`);
    fsSync.writeFileSync(tempDataPath, JSON.stringify(videoData, null, 2));

    res.json({
      success: true,
      message: "Video verileri kaydedildi",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});
