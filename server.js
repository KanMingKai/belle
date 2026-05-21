const http       = require('http');
const https      = require('https');
const fs         = require('fs');
const path       = require('path');
const os         = require('os');
const { execFile } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

const PORT = process.env.PORT || 5500;

// ── 工具：從 URL 下載檔案到本地路徑 ──
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const file  = fs.createWriteStream(destPath);

    function doGet(targetUrl) {
      proto.get(targetUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          file.close();
          doGet(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error('HTTP ' + res.statusCode + ' for ' + targetUrl));
          return;
        }
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
        file.on('error', reject);
      }).on('error', reject);
    }

    doGet(url);
  });
}

// ── 工具：清理暫存檔 ──
function cleanup(files) {
  files.forEach(f => { try { fs.unlinkSync(f); } catch (_) {} });
}

const FONT_PATH      = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
const PLAYFAIR_FONT  = path.join(__dirname, 'fonts', 'PlayfairDisplay-Italic.ttf');
const JOSEFIN_FONT   = path.join(__dirname, 'fonts', 'JosefinSans-Thin.ttf');

function escapeFfmpegText(str) {
  return str.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'").replace(/%/g, '%%');
}

// ── 路由：POST /merge ──
// Accepts: { segments:[{url,greeting,title}], layout?, date? }
//   or legacy: { urls:[...], layout?, date?, greeting? }
// layout: 'concat' (default) | 'film' | 'grid4'
async function handleMerge(req, res) {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', async () => {
    let segments, layout, date, filmGreeting;
    try {
      const parsed = JSON.parse(body);
      layout       = parsed.layout  || 'concat';
      date         = (parsed.date   || '').replace(/[^\x00-\x7F]/g, '').trim();
      filmGreeting = (parsed.greeting|| '').replace(/[^\x00-\x7F]/g, '').trim();
      // 支援新版 segments 格式 及舊版 urls 格式
      if (Array.isArray(parsed.segments) && parsed.segments.length) {
        segments = parsed.segments;
      } else if (Array.isArray(parsed.urls) && parsed.urls.length) {
        segments = parsed.urls.map(u => ({ url: u }));
      } else {
        throw new Error();
      }
    } catch (_) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '需要 { segments:[{url,...}] } 或 { urls:[...] }' }));
      return;
    }

    // grid 模式：補齊到 N 的倍數，從頭循環（前端通常已補，此處作為防呆）
    const gridSize = layout === 'grid4' ? 4 : (layout === 'grid9' ? 9 : 0);
    if (gridSize) {
      const orig = segments.length;
      let pi = 0;
      while (segments.length % gridSize !== 0) {
        segments.push(segments[pi % orig]);
        pi++;
      }
    }

    const tmpDir   = fs.mkdtempSync(path.join(os.tmpdir(), 'igmerge-'));
    const tmpFiles = [];

    try {
      // ── Step 1: 平行下載所有影片 ──
      const vidPaths = segments.map((_, i) => path.join(tmpDir, 'v' + i + '.mp4'));
      vidPaths.forEach(p => tmpFiles.push(p));
      console.log('平行下載 ' + segments.length + ' 部…');
      await Promise.all(segments.map((seg, i) =>
        downloadFile(seg.url, vidPaths[i]).then(() =>
          console.log('[下載完成] ' + (i + 1) + '/' + segments.length)
        )
      ));

      // ── Step 2: 每段燒入問候語 + 標題（txt.html 風格：漸層+白線+字型）──
      const canLabel = filmFfmpegPath && fs.existsSync(FONT_PATH);
      if (canLabel) {
        // 選用 Playfair/Josefin（若 build 下載成功），否則 fallback DejaVu
        const gmFont  = fs.existsSync(PLAYFAIR_FONT) ? escapeFfmpegText(PLAYFAIR_FONT)  : escapeFfmpegText(FONT_PATH);
        const tagFont = fs.existsSync(JOSEFIN_FONT)  ? escapeFfmpegText(JOSEFIN_FONT)   : escapeFfmpegText(FONT_PATH);

        for (let i = 0; i < vidPaths.length; i++) {
          const seg     = segments[i] || {};
          const segGm   = (seg.greeting || '').replace(/[^\x00-\x7F]/g, '').trim();
          const segTitle= (seg.title    || '').replace(/[^\x00-\x7F]/g, '').trim();
          if (!segGm && !segTitle) continue;

          const labelPath = path.join(tmpDir, 'v' + i + '_t.mp4');
          tmpFiles.push(labelPath);

          // drawbox with alpha triggers ffmpeg filter reinit (-22) on yuv420p streams.
          // Use drawtext+shadow for visibility instead — confirmed stable.
          const f = ['setsar=1'];

          if (segGm) f.push(
            "drawtext=fontfile='" + gmFont + "':text='" + escapeFfmpegText(segGm) +
            "':x=16:y=h-text_h-30:fontsize=18:fontcolor=white@0.9" +
            ":shadowcolor=black@0.7:shadowx=2:shadowy=2"
          );

          if (segTitle) f.push(
            "drawtext=fontfile='" + tagFont + "':text='" + escapeFfmpegText(segTitle.toUpperCase()) +
            "':x=16:y=h-text_h-8:fontsize=11:fontcolor=white@0.75" +
            ":shadowcolor=black@0.5:shadowx=1:shadowy=1"
          );

          try {
            await new Promise((resolve, reject) => {
              execFile(filmFfmpegPath, [
                '-y', '-i', vidPaths[i],
                '-vf', f.join(','),
                '-c:v', 'libx264', '-crf', '23', '-preset', 'ultrafast',
                '-c:a', 'aac', '-b:a', '128k',
                labelPath
              ], (err, _o, stderr) => { if (err) reject(new Error(stderr)); else resolve(); });
            });
            vidPaths[i] = labelPath;
            console.log('[label] segment', i, 'done');
          } catch (e) {
            const errMsg = e.message || '';
            console.warn('[label] segment', i, 'failed (tail):', errMsg.slice(-800));
            console.warn('[label] segment', i, 'filter was:', f.join(',').slice(0, 300));
          }
        }
      }

      // ── Step 3: 套用版型 ──
      const outPath = path.join(tmpDir, 'merged.mp4');
      tmpFiles.push(outPath);

      if (layout === 'grid4' || layout === 'grid9') {
        // 格子模式：cols × rows 同時播放，多輪用 concat
        const cols = layout === 'grid4' ? 2 : 3;
        const rows = layout === 'grid4' ? 2 : 3;
        // grid4 沿用既有 462×410（≈924×820 輸出），grid9 用 308×272（≈924×816 輸出）
        // libx264+yuv420p 要求寬高必須為偶數，273/819 為奇數會輸出損壞檔案
        const cellW = layout === 'grid4' ? 462 : 308;
        const cellH = layout === 'grid4' ? 410 : 272;
        const N     = cols * rows;

        const roundPaths = [];
        for (let r = 0; r < vidPaths.length; r += N) {
          const group    = vidPaths.slice(r, r + N);
          const roundOut = path.join(tmpDir, 'round' + (r / N) + '.mp4');
          tmpFiles.push(roundOut);

          // 組 filter：先 scale，再 hstack 每行，最後 vstack 全部
          const scaleParts = group.map((_, i) =>
            '[' + i + ':v]scale=' + cellW + ':' + cellH + ',setsar=1[c' + i + ']'
          );
          const rowParts = [];
          for (let rr = 0; rr < rows; rr++) {
            const refs = [];
            for (let cc = 0; cc < cols; cc++) refs.push('[c' + (rr * cols + cc) + ']');
            rowParts.push(refs.join('') + 'hstack=inputs=' + cols + '[r' + rr + ']');
          }
          const stackRefs = [];
          for (let rr = 0; rr < rows; rr++) stackRefs.push('[r' + rr + ']');
          const finalStack = stackRefs.join('') + 'vstack=inputs=' + rows + '[v]';
          const filter = scaleParts.concat(rowParts).concat([finalStack]).join(';');

          const inputArgs = [];
          group.forEach(p => { inputArgs.push('-i', p); });

          await new Promise((resolve, reject) => {
            execFile(ffmpegPath, [
              '-y',
              ...inputArgs,
              '-filter_complex', filter,
              '-map', '[v]', '-an',
              '-c:v', 'libx264', '-crf', '23', '-preset', 'ultrafast',
              '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-shortest',
              roundOut
            ], (err, _o, stderr) => { if (err) reject(new Error(stderr)); else resolve(); });
          });
          roundPaths.push(roundOut);
          console.log('[' + layout + '] round ' + (r / N + 1) + ' done');
        }

        if (roundPaths.length === 1) {
          fs.copyFileSync(roundPaths[0], outPath);
        } else {
          const listPath = path.join(tmpDir, 'rounds.txt');
          fs.writeFileSync(listPath, roundPaths.map(p => "file '" + p.replace(/\\/g, '/') + "'").join('\n'));
          tmpFiles.push(listPath);
          await new Promise((resolve, reject) => {
            execFile(ffmpegPath, [
              '-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', outPath
            ], (err, _o, stderr) => { if (err) reject(new Error(stderr)); else resolve(); });
          });
        }

      } else {
        const listPath = path.join(tmpDir, 'list.txt');
        fs.writeFileSync(listPath, vidPaths.map(p => "file '" + p.replace(/\\/g, '/') + "'").join('\n'));
        tmpFiles.push(listPath);

        if (layout === 'film' && filmFfmpegPath && (date || filmGreeting)) {
          // film: concat labeled segments → Pass 2 加日期 + belle
          const concatPath = path.join(tmpDir, 'concat.mp4');
          tmpFiles.push(concatPath);
          await new Promise((resolve, reject) => {
            execFile(ffmpegPath, [
              '-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', concatPath
            ], (err, _o, stderr) => { if (err) reject(new Error(stderr)); else resolve(); });
          });

          const font = escapeFfmpegText(FONT_PATH);
          const filters = [];
          if (date) filters.push("drawtext=fontfile='" + font + "':text='" + escapeFfmpegText(date) + "':x=(w-text_w)/2:y=30:fontsize=28:fontcolor=white@0.85:shadowcolor=black@0.5:shadowx=1:shadowy=1");
          if (filmGreeting) filters.push("drawtext=fontfile='" + font + "':text='" + escapeFfmpegText(filmGreeting) + "':x=(w-text_w)/2:y=h-64:fontsize=22:fontcolor=white@0.7:shadowcolor=black@0.4:shadowx=1:shadowy=1");
          filters.push("drawtext=fontfile='" + font + "':text='belle':x=w-text_w-20:y=h-text_h-20:fontsize=16:fontcolor=white@0.4");

          await new Promise((resolve, reject) => {
            execFile(filmFfmpegPath, [
              '-y', '-i', concatPath,
              '-vf', filters.join(','),
              '-c:v', 'libx264', '-crf', '23', '-preset', 'ultrafast',
              '-c:a', 'aac', '-b:a', '128k', outPath
            ], (err, _o, stderr) => {
              if (err) {
                const msg = stderr || '';
                if (msg.includes('No such filter') || msg.includes('Filter not found')) {
                  console.warn('[film] drawtext fallback to plain concat');
                  try { fs.copyFileSync(concatPath, outPath); resolve(); } catch (e2) { reject(e2); }
                } else { reject(new Error(msg)); }
              } else { resolve(); }
            });
          });

        } else {
          // 原版 concat（含已標記的 vidPaths）
          await new Promise((resolve, reject) => {
            execFile(ffmpegPath, [
              '-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', outPath
            ], (err, _o, stderr) => { if (err) reject(new Error(stderr)); else resolve(); });
          });
        }
      }

      // ── 回傳 ──
      const stat = fs.statSync(outPath);
      res.writeHead(200, {
        'Content-Type':        'video/mp4',
        'Content-Length':      stat.size,
        'Content-Disposition': 'attachment; filename="merged.mp4"',
      });
      fs.createReadStream(outPath).pipe(res).on('finish', () => cleanup(tmpFiles));

    } catch (err) {
      console.error('[merge error]', err.message);
      cleanup(tmpFiles);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    }
  });
}

// ── 路由：POST /convert ──
// Accepts raw video blob (any format), returns MP4 (libx264 + yuv420p + faststart)
async function handleConvert(req, res) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'igconv-'));
  const inPath  = path.join(tmpDir, 'input.webm');
  const outPath = path.join(tmpDir, 'output.mp4');

  const chunks = [];
  req.on('data', chunk => chunks.push(chunk));
  req.on('end', async () => {
    try {
      const inBuf = Buffer.concat(chunks);
      console.log('[convert] received', inBuf.length, 'bytes');
      fs.writeFileSync(inPath, inBuf);
      await new Promise((resolve, reject) => {
        execFile(ffmpegPath, [
          '-y',
          '-probesize', '100M', '-analyzeduration', '100M',  // fully probe codec params from MediaRecorder WebM
          '-fflags', '+genpts+igndts',
          '-i', inPath,
          '-c:v', 'libx264', '-crf', '23', '-preset', 'ultrafast',
          '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
          '-an',
          outPath
        ], { maxBuffer: 50 * 1024 * 1024 }, (err, _o, stderr) => {
          if (err) {
            console.error('[convert ffmpeg stderr tail]', stderr.slice(-1000));
            reject(new Error(stderr.slice(-800)));
          } else {
            resolve();
          }
        });
      });
      const stat = fs.statSync(outPath);
      res.writeHead(200, {
        'Content-Type':        'video/mp4',
        'Content-Length':      stat.size,
        'Content-Disposition': 'attachment; filename="converted.mp4"',
      });
      fs.createReadStream(outPath).pipe(res).on('finish', () => {
        try { fs.unlinkSync(inPath); fs.unlinkSync(outPath); fs.rmdirSync(tmpDir); } catch (_) {}
      });
    } catch (e) {
      console.error('[convert error]', e.message);
      try { fs.unlinkSync(inPath); } catch (_) {}
      try { fs.unlinkSync(outPath); } catch (_) {}
      try { fs.rmdirSync(tmpDir); } catch (_) {}
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    }
  });
}

// ── 啟動診斷：偵測 build 時下載的 ffmpeg-draw binary ──
const DRAW_FFMPEG_PATH = path.join(__dirname, 'ffmpeg-draw');
const filmFfmpegPath = fs.existsSync(DRAW_FFMPEG_PATH) ? DRAW_FFMPEG_PATH : null;
console.log('[startup] ffmpeg-draw:', filmFfmpegPath ? 'found ✓' : 'NOT found ✗ (film will fallback to concat)');
console.log('[startup] font DejaVu:', fs.existsSync(FONT_PATH)     ? 'found ✓' : 'NOT found ✗');
console.log('[startup] font Playfair:', fs.existsSync(PLAYFAIR_FONT) ? 'found ✓' : 'NOT found ✗ (will use DejaVu)');
console.log('[startup] font Josefin:', fs.existsSync(JOSEFIN_FONT)  ? 'found ✓' : 'NOT found ✗ (will use DejaVu)');

// ── 主伺服器 ──
http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.url === '/ping') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method === 'POST' && req.url === '/merge') {
    handleMerge(req, res);
    return;
  }

  if (req.method === 'POST' && req.url === '/convert') {
    handleConvert(req, res);
    return;
  }

  res.writeHead(404);
  res.end('Not found');

}).listen(PORT, () => {
  console.log('Server running on port ' + PORT);
});
