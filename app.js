(function() {
      "use strict";

      // ---------- DOM refs ----------
      const boardContainer = document.getElementById('boardContainer');
      const statusEl = document.getElementById('statusMessage');
      const scoreXEl = document.getElementById('scoreX');
      const scoreOEl = document.getElementById('scoreO');
      const scoreDrawsEl = document.getElementById('scoreDraws');
      const resetBtn = document.getElementById('resetButton');
      const themeToggle = document.getElementById('themeToggle');
      const body = document.body;

      // ---------- state ----------
      let board = Array(9).fill(null);
      let currentPlayer = 'X';
      let gameActive = true;
      let winnerInfo = null;
      let scoreX = 0, scoreO = 0, scoreDraws = 0;

      // ---------- audio (Web Audio synth) ----------
      let audioCtx = null;
      function initAudio() {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      function playTone(freq, duration, type = 'sine', vol = 0.15) {
        try {
          initAudio();
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = type;
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(vol, audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start();
          osc.stop(audioCtx.currentTime + duration);
        } catch (_) { /* silent fallback */ }
      }
      function soundMove() { playTone(600, 0.12, 'sine', 0.12); }
      function soundWin() { 
        playTone(523, 0.15, 'sine', 0.13);
        setTimeout(() => playTone(659, 0.15, 'sine', 0.13), 120);
        setTimeout(() => playTone(784, 0.25, 'sine', 0.14), 240);
      }
      function soundDraw() { playTone(400, 0.2, 'triangle', 0.08); }

      // ---------- confetti (canvas) ----------
      const canvas = document.getElementById('confettiCanvas');
      const ctx = canvas.getContext('2d');
      let confettiPieces = [];
      let confettiRunning = false;

      function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
      window.addEventListener('resize', resizeCanvas);
      resizeCanvas();

      class ConfettiPiece {
        constructor() {
          this.x = Math.random() * canvas.width;
          this.y = Math.random() * canvas.height - canvas.height;
          this.w = 6 + Math.random() * 8;
          this.h = 4 + Math.random() * 6;
          this.color = `hsl(${Math.random() * 360}, 80%, 60%)`;
          this.vy = 2 + Math.random() * 3;
          this.vx = (Math.random() - 0.5) * 2;
          this.rotation = Math.random() * 360;
          this.rv = (Math.random() - 0.5) * 8;
          this.life = 1;
        }
        update() {
          this.y += this.vy;
          this.x += this.vx + Math.sin(this.y * 0.01) * 0.3;
          this.rotation += this.rv;
          this.vy += 0.04;
          if (this.y > canvas.height + 20) this.life = 0;
        }
        draw(ctx) {
          ctx.save();
          ctx.translate(this.x, this.y);
          ctx.rotate(this.rotation * Math.PI / 180);
          ctx.fillStyle = this.color;
          ctx.shadowColor = 'rgba(0,0,0,0.1)';
          ctx.shadowBlur = 4;
          ctx.fillRect(-this.w/2, -this.h/2, this.w, this.h);
          ctx.restore();
        }
      }

      function launchConfetti(count = 160) {
        for (let i = 0; i < count; i++) {
          confettiPieces.push(new ConfettiPiece());
        }
        if (!confettiRunning) {
          confettiRunning = true;
          animateConfetti();
        }
      }
      function animateConfetti() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let alive = false;
        for (let p of confettiPieces) {
          p.update();
          if (p.life > 0) { p.draw(ctx); alive = true; }
        }
        confettiPieces = confettiPieces.filter(p => p.life > 0);
        if (alive || confettiPieces.length > 0) {
          requestAnimationFrame(animateConfetti);
        } else {
          confettiRunning = false;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }

      // ---------- particle burst (on win) ----------
      function spawnParticles(cellElement, count = 18) {
        if (!cellElement) return;
        const rect = cellElement.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const container = document.createElement('div');
        container.className = 'particle-container';
        container.style.position = 'fixed';
        container.style.left = '0'; container.style.top = '0';
        container.style.width = '100%'; container.style.height = '100%';
        container.style.pointerEvents = 'none';
        container.style.zIndex = '9998';
        document.body.appendChild(container);

        const colors = ['#f87171','#fbbf24','#34d399','#60a5fa','#a78bfa','#f472b6','#fb923c'];
        for (let i = 0; i < count; i++) {
          const p = document.createElement('div');
          p.className = 'particle';
          const size = 6 + Math.random() * 14;
          const angle = Math.random() * 2 * Math.PI;
          const dist = 60 + Math.random() * 140;
          const tx = Math.cos(angle) * dist;
          const ty = Math.sin(angle) * dist - 30;
          p.style.width = size + 'px';
          p.style.height = size + 'px';
          p.style.background = colors[Math.floor(Math.random() * colors.length)];
          p.style.left = (cx - size/2) + 'px';
          p.style.top = (cy - size/2) + 'px';
          p.style.setProperty('--tx', tx + 'px');
          p.style.setProperty('--ty', ty + 'px');
          p.style.animationDuration = (0.4 + Math.random() * 0.4) + 's';
          p.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
          container.appendChild(p);
        }
        setTimeout(() => container.remove(), 900);
      }

      // ---------- game logic ----------
      function updateScoreDisplay() {
        scoreXEl.textContent = scoreX;
        scoreOEl.textContent = scoreO;
        scoreDrawsEl.textContent = scoreDraws;
      }

      function fullReset() {
        board = Array(9).fill(null);
        currentPlayer = 'X';
        gameActive = true;
        winnerInfo = null;
        scoreX = 0; scoreO = 0; scoreDraws = 0;
        updateScoreDisplay();
        renderBoard();
        updateStatusMessage();
        document.querySelectorAll('.cell').forEach(c => c.classList.remove('win-highlight'));
        // clear confetti
        confettiPieces = [];
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }

      function resetGameKeepScore() {
        board = Array(9).fill(null);
        currentPlayer = 'X';
        gameActive = true;
        winnerInfo = null;
        renderBoard();
        updateStatusMessage();
        document.querySelectorAll('.cell').forEach(c => c.classList.remove('win-highlight'));
        confettiPieces = [];
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }

      function checkWinner() {
        const patterns = [
          [0,1,2],[3,4,5],[6,7,8],
          [0,3,6],[1,4,7],[2,5,8],
          [0,4,8],[2,4,6]
        ];
        for (let p of patterns) {
          const [a,b,c] = p;
          if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return { winner: board[a], winCombo: p };
          }
        }
        if (board.every(cell => cell !== null)) return { winner: 'draw', winCombo: null };
        return null;
      }

      function handleCellClick(index) {
        if (!gameActive) return;
        if (board[index] !== null) return;
        if (winnerInfo && winnerInfo.winner !== 'draw') return;

        board[index] = currentPlayer;
        soundMove();
        renderBoard();

        const result = checkWinner();
        if (result) {
          winnerInfo = result;
          if (result.winner === 'X') {
            scoreX++; updateScoreDisplay(); gameActive = false;
            highlightWinCombo(result.winCombo);
            statusEl.textContent = '🏆 X wins!';
            soundWin();
            launchConfetti(150);
            // particle burst on each winning cell
            result.winCombo.forEach(idx => {
              const cells = document.querySelectorAll('.cell');
              if (cells[idx]) spawnParticles(cells[idx], 14);
            });
          } else if (result.winner === 'O') {
            scoreO++; updateScoreDisplay(); gameActive = false;
            highlightWinCombo(result.winCombo);
            statusEl.textContent = '🏆 O wins!';
            soundWin();
            launchConfetti(150);
            result.winCombo.forEach(idx => {
              const cells = document.querySelectorAll('.cell');
              if (cells[idx]) spawnParticles(cells[idx], 14);
            });
          } else if (result.winner === 'draw') {
            scoreDraws++; updateScoreDisplay(); gameActive = false;
            statusEl.textContent = '🤝 Draw!';
            soundDraw();
          }
          return;
        }

        currentPlayer = (currentPlayer === 'X' ? 'O' : 'X');
        updateStatusMessage();
      }

      function highlightWinCombo(combo) {
        if (!combo) return;
        const cells = document.querySelectorAll('.cell');
        combo.forEach(idx => { if (cells[idx]) cells[idx].classList.add('win-highlight'); });
      }

      function renderBoard() {
        boardContainer.innerHTML = '';
        for (let i = 0; i < 9; i++) {
          const cell = document.createElement('div');
          cell.className = 'cell';
          cell.dataset.index = i;

          const val = board[i];
          if (val === 'X') {
            cell.textContent = '✕';
            cell.classList.add('x-move', 'symbol-pop');
          } else if (val === 'O') {
            cell.textContent = '◯';
            cell.classList.add('o-move', 'symbol-pop');
          }
          cell.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.dataset.index, 10);
            handleCellClick(idx);
          });
          boardContainer.appendChild(cell);
        }
        if (winnerInfo && winnerInfo.winCombo) {
          highlightWinCombo(winnerInfo.winCombo);
        }
      }

      function updateStatusMessage() {
        if (!gameActive) return;
        statusEl.textContent = currentPlayer === 'X' ? '✕ Your turn' : '◯ Your turn';
      }

      // ---------- theme toggle ----------
      themeToggle.addEventListener('click', () => {
        body.classList.toggle('light');
        body.classList.toggle('dark');
        themeToggle.textContent = body.classList.contains('dark') ? '☀️' : '🌓';
      });

      // ---------- reset ----------
      resetBtn.addEventListener('click', () => {
        resetGameKeepScore();
        statusEl.textContent = '✨ New round';
        setTimeout(() => updateStatusMessage(), 250);
        document.querySelectorAll('.cell').forEach(c => c.classList.remove('win-highlight'));
        confettiPieces = [];
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      });

      // ---------- init ----------
      function init() {
        fullReset();
      }
      init();
    })();
