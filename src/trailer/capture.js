// Trailer capture harness — DEV ONLY. Loaded from main.js only when the URL has
// `?rec`, so normal play and `vite build` never pull it in.
//
// Taps the WebGL canvas with captureStream + MediaRecorder → smooth webm straight
// off the render buffer (not screenshots). Press R (or `) to start/stop; the clip
// auto-downloads. The on-screen pill is DOM, not canvas, so it never appears in the
// recording.

// ponytail: pick the best codec Chrome offers, fall back gracefully.
function pickMime() {
  const prefs = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  return prefs.find((m) => window.MediaRecorder?.isTypeSupported(m)) || '';
}

export function initCapture(canvas, levelId = 1) {
  let rec = null;
  let chunks = [];
  let n = 0;
  let startedAt = 0;

  // Always-visible pill so you can see the control is armed. Idle = grey hint,
  // recording = red blinking timer.
  const pill = document.createElement('div');
  pill.style.cssText =
    'position:fixed;top:14px;right:16px;z-index:9999;display:flex;align-items:center;' +
    'gap:8px;font:600 14px/1 system-ui,sans-serif;color:#fff;padding:8px 14px;' +
    'background:rgba(0,0,0,0.55);border-radius:20px;pointer-events:none;';
  const style = document.createElement('style');
  style.textContent = '@keyframes caoRecBlink{50%{opacity:0.2}}';
  document.head.appendChild(style);
  document.body.appendChild(pill);

  function renderIdle() {
    pill.innerHTML =
      '<span style="width:11px;height:11px;border-radius:50%;background:#888"></span>' +
      '<span>Press <b>R</b> to record</span>';
  }
  renderIdle();

  let raf = 0;
  function tickTime() {
    if (!rec || rec.state !== 'recording') return;
    const s = ((performance.now() - startedAt) / 1000).toFixed(1);
    pill.innerHTML =
      '<span style="width:11px;height:11px;border-radius:50%;background:#ff3b3b;' +
      'box-shadow:0 0 8px #ff3b3b;animation:caoRecBlink 1s steps(2,start) infinite"></span>' +
      `<span>REC ${s}s · press <b>R</b> to stop</span>`;
    raf = requestAnimationFrame(tickTime);
  }

  function start() {
    const mime = pickMime();
    // 25 Mbps @ 1080p60 keeps combat crisp; webm is transcoded to mp4 later.
    const stream = canvas.captureStream(60);
    rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 25_000_000 } : undefined);
    chunks = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      n += 1;
      a.href = url;
      a.download = `cao-L${levelId}-${String(n).padStart(2, '0')}.webm`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      console.log(`[CAO] capture saved ${a.download} (${(blob.size / 1e6).toFixed(1)} MB)`);
    };
    rec.start();
    startedAt = performance.now();
    tickTime();
    console.log('[CAO] capture ▶ recording (press R again to stop)');
  }

  function stop() {
    if (!rec || rec.state !== 'recording') return;
    rec.stop();
    rec = null;
    cancelAnimationFrame(raf);
    renderIdle();
    console.log('[CAO] capture ■ stopped — saving…');
  }

  // R or Backquote toggles. Works under pointer lock (document-level keydown fires).
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'KeyR' && e.code !== 'Backquote') return;
    e.preventDefault();
    if (rec && rec.state === 'recording') stop(); else start();
  });

  console.log('[CAO] capture harness ready — press R (or `) to start/stop recording');
}
