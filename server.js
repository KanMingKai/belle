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

const FONT_PATH = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';

function escapeFfmpegText(str) {
  return str.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'").replace(/%/g, '%%');
}

// ── 路由：POST /merge ──
// Accepts: { urls, layout?, date?, greeting? }
// layout: 'concat' (default) | 'film' | 'grid4'
async function handleMerge(req, res) {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', async () => {
    let urls, layout, date, greeting;
    try {
      const parsed = JSON.parse(body);
      urls     = parsed.urls;
      layout   = parsed.layout   || 'concat';
      date     = (parsed.date    || '').replace(/[^\x00-\x7F]/g, '').trim();
      greeting = (parsed.greeting|| '').replace(/[^\x00-\x7F]/g, '').trim();
      if (!Array.isArray(urls) || urls.length === 0) throw new Error();
    } catch (_) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '需要 { urls: [...] }' }));
      return;
    }

    if (layout === 'grid4') urls = urls.slice(0, 4);

    const tmpDir   = fs.mkdtempSync(path.join(os.tmpdir(), 'igmerge-'));
    const tmpFiles = [];

    try {
      // 1. 下載每部影片
      const vidPaths = [];
      for (let i = 0; i < urls.length; i++) {
        const dest = path.join(tmpDir, 'v' + i + '.mp4');
        console.log('下載 ' + (i + 1) + '/' + urls.length + ':', urls[i]);
        await downloadFile(urls[i], dest);
        vidPaths.push(dest);
        tmpFiles.push(dest);
      }

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
            '[0:v]scale=480:270[tl];[1:v]scale=480:270[tr];' +
            '[2:v]scale=480:270[bl];[3:v]scale=480:270[br];' +
            '[tl][tr]hstack=inputs=2[top];[bl][br]hstack=inputs=2[bot];' +
            '[top][bot]vstack=inputs=2[v]',
            '-map', '[v]',
            '-an',
            '-c:v', 'libx264', '-crf', '23', '-preset', 'ultrafast',
            '-shortest',
            outPath
          ], (err, _out, stderr) => {
            if (err) reject(new Error(stderr)); else resolve();
          });
        });

      } else {
        // 建立 concat 清單
        const listPath = path.join(tmpDir, 'list.txt');
        fs.writeFileSync(listPath, vidPaths.map(p => "file '" + p.replace(/\\/g, '/') + "'").join('\n'));
        tmpFiles.push(listPath);

        const hasFont = fs.existsSync(FONT_PATH);
        if (layout === 'film' && filmFfmpegPath && hasFont && (date || greeting)) {
          // Pass 1: fast concat
          const concatPath = path.join(tmpDir, 'concat.mp4');
          tmpFiles.push(concatPath);
          await new Promise((resolve, reject) => {
            execFile(ffmpegPath, [
              '-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', concatPath
            ], (err, _out, stderr) => {
              if (err) reject(new Error(stderr)); else resolve();
            });
          });

          // Build drawtext filter
          const font = escapeFfmpegText(FONT_PATH);
          const filters = [];
          if (date) {
            filters.push(
              "drawtext=fontfile='" + font + "':text='" + escapeFfmpegText(date) + "'" +
              ':x=(w-text_w)/2:y=30:fontsize=28:fontcolor=white@0.85' +
              ':shadowcolor=black@0.5:shadowx=1:shadowy=1'
            );
          }
          if (greeting) {
            filters.push(
              "drawtext=fontfile='" + font + "':text='" + escapeFfmpegText(greeting) + "'" +
              ':x=(w-text_w)/2:y=h-64:fontsize=22:fontcolor=white@0.7' +
              ':shadowcolor=black@0.4:shadowx=1:shadowy=1'
            );
          }
          filters.push(
            "drawtext=fontfile='" + font + "':text='belle'" +
            ':x=w-text_w-20:y=h-text_h-20:fontsize=16:fontcolor=white@0.4'
          );

          // Pass 2: encode with text overlay (fallback to plain concat if drawtext unavailable)
          await new Promise((resolve, reject) => {
            execFile(filmFfmpegPath, [
              '-y', '-i', concatPath,
              '-vf', filters.join(','),
              '-c:v', 'libx264', '-crf', '23', '-preset', 'ultrafast',
              '-c:a', 'aac', '-b:a', '128k',
              outPath
            ], (err, _out, stderr) => {
              if (err) {
                const msg = stderr || '';
                if (msg.includes('No such filter') || msg.includes('Filter not found')) {
                  console.warn('[film] drawtext not available, falling back to plain concat');
                  try { fs.copyFileSync(concatPath, outPath); resolve(); }
                  catch (e2) { reject(e2); }
                } else {
                  reject(new Error(msg));
                }
              } else {
                resolve();
              }
            });
          });

        } else {
          // 原版 concat（layout='concat' 或字型不存在時 fallback）
          await new Promise((resolve, reject) => {
            execFile(ffmpegPath, [
              '-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', outPath
            ], (err, _out, stderr) => {
              if (err) reject(new Error(stderr)); else resolve();
            });
          });
        }
      }

      // 回傳合併後的影片
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
console.log('[startup] font file:', fs.existsSync(FONT_PATH) ? 'found ✓' : 'NOT found ✗');

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
