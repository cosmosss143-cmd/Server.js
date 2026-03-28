// ============================================
// TikTok Live Trivia - Backend (server.js)
// Jalankan di Replit dengan Node.js
// ============================================
// Install dulu di Replit Shell:
// npm install tiktok-live-connector express cors socket.io

const { WebcastPushConnection } = require('tiktok-live-connector');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.static('public')); // taruh index.html di folder public

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// ============================================
// KONFIGURASI - Ganti dengan username TikTok kamu
// ============================================
const TIKTOK_USERNAME = 'username_tiktok_kamu'; // ganti ini!

// ============================================
// DATA SOAL TRIVIA (Bahasa Indonesia)
// ============================================
const soalTrivia = [
  {
    soal: "Ibu kota Indonesia adalah?",
    jawaban: ["jakarta"],
    pilihan: ["A. Jakarta", "B. Bandung", "C. Surabaya", "D. Medan"]
  },
  {
    soal: "Berapa hasil dari 8 x 7?",
    jawaban: ["56", "lima puluh enam"],
    pilihan: ["A. 54", "B. 56", "C. 58", "D. 60"]
  },
  {
    soal: "Siapa proklamator kemerdekaan Indonesia?",
    jawaban: ["soekarno", "sukarno", "soekarno hatta", "sukarno hatta"],
    pilihan: ["A. Soekarno", "B. Soeharto", "C. Habibie", "D. Megawati"]
  },
  {
    soal: "Planet terbesar di tata surya adalah?",
    jawaban: ["jupiter"],
    pilihan: ["A. Saturnus", "B. Bumi", "C. Jupiter", "D. Mars"]
  },
  {
    soal: "Bahasa resmi negara Brazil adalah?",
    jawaban: ["portugis", "bahasa portugis"],
    pilihan: ["A. Spanyol", "B. Portugis", "C. Inggris", "D. Brazil"]
  },
  {
    soal: "Berapa jumlah provinsi di Indonesia saat ini?",
    jawaban: ["38", "tiga puluh delapan"],
    pilihan: ["A. 34", "B. 36", "C. 37", "D. 38"]
  },
  {
    soal: "Gunung tertinggi di Indonesia adalah?",
    jawaban: ["puncak jaya", "carstensz", "jayawijaya"],
    pilihan: ["A. Gunung Rinjani", "B. Puncak Jaya", "C. Semeru", "D. Kerinci"]
  },
  {
    soal: "Mata uang Jepang disebut?",
    jawaban: ["yen", "yen jepang"],
    pilihan: ["A. Won", "B. Yuan", "C. Yen", "D. Baht"]
  },
  {
    soal: "Siapa penemu bola lampu?",
    jawaban: ["thomas edison", "edison"],
    pilihan: ["A. Newton", "B. Edison", "C. Einstein", "D. Tesla"]
  },
  {
    soal: "Apa warna bendera Indonesia?",
    jawaban: ["merah putih", "putih merah"],
    pilihan: ["A. Merah Putih", "B. Merah Biru", "C. Merah Kuning", "D. Putih Hijau"]
  }
];

// ============================================
// STATE GAME
// ============================================
let gameState = {
  aktif: false,
  soalIndex: -1,
  soalSekarang: null,
  leaderboard: {},
  sudahJawab: new Set(),
  timer: null,
  waktuSisa: 20,
  intervalTimer: null
};

function resetGame() {
  gameState = {
    aktif: false,
    soalIndex: -1,
    soalSekarang: null,
    leaderboard: {},
    sudahJawab: new Set(),
    timer: null,
    waktuSisa: 20,
    intervalTimer: null
  };
}

function soalBerikutnya() {
  if (gameState.intervalTimer) clearInterval(gameState.intervalTimer);
  gameState.sudahJawab = new Set();
  gameState.soalIndex++;

  if (gameState.soalIndex >= soalTrivia.length) {
    // Game selesai
    gameState.aktif = false;
    const sorted = Object.entries(gameState.leaderboard)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    io.emit('gameSelesai', { leaderboard: sorted });
    return;
  }

  gameState.soalSekarang = soalTrivia[gameState.soalIndex];
  gameState.waktuSisa = 20;

  io.emit('soalBaru', {
    nomor: gameState.soalIndex + 1,
    total: soalTrivia.length,
    soal: gameState.soalSekarang.soal,
    pilihan: gameState.soalSekarang.pilihan,
    waktu: gameState.waktuSisa
  });

  // Timer countdown
  gameState.intervalTimer = setInterval(() => {
    gameState.waktuSisa--;
    io.emit('timerUpdate', { waktu: gameState.waktuSisa });

    if (gameState.waktuSisa <= 0) {
      clearInterval(gameState.intervalTimer);
      io.emit('waktuHabis', {
        jawabanBenar: gameState.soalSekarang.jawaban[0]
      });
      setTimeout(soalBerikutnya, 3000);
    }
  }, 1000);
}

// ============================================
// SOCKET.IO - Komunikasi dengan Frontend
// ============================================
io.on('connection', (socket) => {
  console.log('Frontend terhubung');

  // Kirim state saat ini ke frontend baru
  socket.emit('stateAwal', {
    leaderboard: Object.entries(gameState.leaderboard)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
  });

  // Host mulai game
  socket.on('mulaiGame', () => {
    resetGame();
    gameState.aktif = true;
    io.emit('gameDimulai');
    setTimeout(soalBerikutnya, 2000);
  });

  // Host skip soal
  socket.on('skipSoal', () => {
    if (gameState.intervalTimer) clearInterval(gameState.intervalTimer);
    io.emit('waktuHabis', { jawabanBenar: gameState.soalSekarang?.jawaban[0] || '' });
    setTimeout(soalBerikutnya, 2000);
  });

  // Host reset game
  socket.on('resetGame', () => {
    if (gameState.intervalTimer) clearInterval(gameState.intervalTimer);
    resetGame();
    io.emit('gameReset');
  });
});

// ============================================
// TIKTOK LIVE CONNECTION
// ============================================
let tiktokConnection = null;

function connectTikTok() {
  tiktokConnection = new WebcastPushConnection(TIKTOK_USERNAME);

  tiktokConnection.connect().then(state => {
    console.log(`✅ Terhubung ke TikTok Live: ${TIKTOK_USERNAME}`);
    io.emit('tiktokStatus', { status: 'connected', username: TIKTOK_USERNAME });
  }).catch(err => {
    console.error('❌ Gagal connect TikTok:', err.message);
    io.emit('tiktokStatus', { status: 'error', pesan: err.message });
    // Coba reconnect setelah 10 detik
    setTimeout(connectTikTok, 10000);
  });

  // Baca komentar dari penonton
  tiktokConnection.on('chat', data => {
    const nama = data.uniqueId || data.nickname || 'Anonim';
    const komentar = (data.comment || '').toLowerCase().trim();

    io.emit('komentarMasuk', { nama, komentar });

    // Cek jawaban jika game aktif
    if (!gameState.aktif || !gameState.soalSekarang) return;
    if (gameState.sudahJawab.has(nama)) return;

    const jawabanBenar = gameState.soalSekarang.jawaban;
    const benar = jawabanBenar.some(j => komentar.includes(j.toLowerCase()));

    if (benar) {
      gameState.sudahJawab.add(nama);

      // Hitung poin berdasarkan waktu sisa
      const poin = Math.max(10, gameState.waktuSisa * 5);

      if (!gameState.leaderboard[nama]) gameState.leaderboard[nama] = 0;
      gameState.leaderboard[nama] += poin;

      const sorted = Object.entries(gameState.leaderboard)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      io.emit('jawabanBenar', { nama, poin, leaderboard: sorted });
    }
  });

  // Deteksi gift
  tiktokConnection.on('gift', data => {
    const nama = data.uniqueId || 'Anonim';
    const giftNama = data.giftName || 'Gift';
    const jumlah = data.repeatCount || 1;
    io.emit('giftMasuk', { nama, giftNama, jumlah });
  });

  // Deteksi like
  tiktokConnection.on('like', data => {
    io.emit('likeMasuk', { nama: data.uniqueId, jumlah: data.likeCount });
  });

  tiktokConnection.on('disconnected', () => {
    console.log('⚠️ TikTok disconnected, mencoba reconnect...');
    io.emit('tiktokStatus', { status: 'disconnected' });
    setTimeout(connectTikTok, 5000);
  });
}

connectTikTok();

// ============================================
// JALANKAN SERVER
// ============================================
const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server jalan di port ${PORT}`);
});
