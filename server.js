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

    if (layout === 'grid4') segments = segments.slice(0, 4);

    const tmpDir   = fs.mkdtempSync(path.join(os.tmpdir(), 'igmerge-'));
    const tmpFiles = [];

    try {
      // ── Step 1: 下載所有影片 ──
      const vidPaths = [];
      for (let i = 0; i < segments.length; i++) {
        const dest = path.join(tmpDir, 'v' + i + '.mp4');
        console.log('下載 ' + (i + 1) + '/' + segments.length + ':', segments[i].url);
        await downloadFile(segments[i].url, dest);
        vidPaths.push(dest);
        tmpFiles.push(dest);
      }

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

          // Gradient: 5 stacked drawboxes simulating linear-gradient(to top, black@0.7 → transparent)
          // Heights cover bottom 70px; each layer slightly less opaque toward top
          const gradient = [
            'drawbox=x=0:y=ih-70:w=iw:h=14:color=black@0.56:t=9999',
            'drawbox=x=0:y=ih-56:w=iw:h=14:color=black@0.42:t=9999',
            'drawbox=x=0:y=ih-42:w=iw:h=14:color=black@0.28:t=9999',
            'drawbox=x=0:y=ih-28:w=iw:h=14:color=black@0.14:t=9999',
            'drawbox=x=0:y=ih-14:w=iw:h=14:color=black@0.07:t=9999',
          ];

          // White accent line: 2px wide × 28px tall, x=16, aligned to greeting baseline
          const accentLine = "drawbox=x=16:y=ih-50:w=2:h=28:color=white@0.9:t=9999";

          const f = [...gradient, accentLine];

          // Greeting: Playfair Italic, 18px, white@0.85, left of accent line
          if (segGm) f.push(
            "drawtext=fontfile='" + gmFont + "':text='" + escapeFfmpegText(segGm) +
            "':x=26:y=ih-48:fontsize=18:fontcolor=white@0.85"
          );

          // Title tag: Josefin Thin, 9px, white@0.55, uppercase via text (already normalized)
          if (segTitle) f.push(
            "drawtext=fontfile='" + tagFont + "':text='" + escapeFfmpegText(segTitle.toUpperCase()) +
            "':x=26:y=ih-26:fontsize=9:fontcolor=white@0.55"
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

      if (layout === 'grid4') {
        // 四格 2×2 — 不足 4 部時補用最後一部
        while (vidPaths.length < 4) vidPaths.push(vidPaths[vidPaths.length - 1]);
        await new Promise((resolve, reject) => {
          execFile(ffmpegPath, [
            '-y',
            '-i', vidPaths[0], '-i', vidPaths[1], '-i', vidPaths[2], '-i', vidPaths[3],
            '-filter_complex',
            '[0:v]scale=462:410,setsar=1[tl];' +
            '[1:v]scale=462:410,setsar=1[tr];' +
            '[2:v]scale=462:410,setsar=1[bl];' +
            '[3:v]scale=462:410,setsar=1[br];' +
            '[tl][tr]hstack=inputs=2[top];[bl][br]hstack=inputs=2[bot];' +
            '[top][bot]vstack=inputs=2[v]',
            '-map', '[v]', '-an',
            '-c:v', 'libx264', '-crf', '23', '-preset', 'ultrafast', '-shortest',
            outPath
          ], (err, _o, stderr) => { if (err) reject(new Error(stderr)); else resolve(); });
        });

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

  res.writeHead(404);
  res.end('Not found');

}).listen(PORT, () => {
  console.log('Server running on port ' + PORT);
});
