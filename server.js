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

// ── 工具：執行 FFmpeg ──
function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    execFile(ffmpegPath, args, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve();
    });
  });
}

// ── 四格合成：4 支影片 → 2×2 grid ──
// 每格縮放至 540×960（9:16），輸出 1080×1920
async function makeGrid4Round(paths, outPath) {
  const W = 540, H = 960;
  const scaleFilters = paths.map((_, i) =>
    `[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,` +
    `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:black,setsar=1[v${i}]`
  ).join(';');
  const stackFilter =
    `[v0][v1][v2][v3]xstack=inputs=4:layout=0_0|w0_0|0_h0|w0_h0[vout]`;

  const inputArgs = [];
  paths.forEach(p => { inputArgs.push('-i', p); });

  await runFfmpeg([
    '-y',
    ...inputArgs,
    '-filter_complex', scaleFilters + ';' + stackFilter,
    '-map', '[vout]',
    '-an',
    '-shortest',
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    outPath
  ]);
}

// ── 路由：POST /merge ──
async function handleMerge(req, res) {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', async () => {
    let urls, layout;
    try {
      const parsed = JSON.parse(body);
      urls   = parsed.urls;
      layout = parsed.layout || 'concat';
      if (!Array.isArray(urls) || urls.length === 0) throw new Error();
    } catch (_) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '需要 { urls: [...] }' }));
      return;
    }

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
        // ── 四格模式 ──
        // 每 4 支合成一個 round，最後 concat 所有 rounds
        const roundPaths = [];
        for (let i = 0; i < vidPaths.length; i += 4) {
          const group    = vidPaths.slice(i, i + 4);
          const roundOut = path.join(tmpDir, 'round' + (i / 4) + '.mp4');
          console.log('四格合成 round ' + (i / 4 + 1) + '，clips:', group.length);
          await makeGrid4Round(group, roundOut);
          roundPaths.push(roundOut);
          tmpFiles.push(roundOut);
        }

        if (roundPaths.length === 1) {
          // 只有一個 round，直接用
          fs.renameSync(roundPaths[0], outPath);
          tmpFiles.pop(); // outPath 已是 roundPaths[0]，避免重複清理
        } else {
          // concat 所有 rounds（編碼一致，可直接 copy）
          const listPath = path.join(tmpDir, 'rounds.txt');
          fs.writeFileSync(listPath, roundPaths.map(p => "file '" + p.replace(/\\/g, '/') + "'").join('\n'));
          tmpFiles.push(listPath);
          await runFfmpeg([
            '-y', '-f', 'concat', '-safe', '0', '-i', listPath,
            '-c', 'copy', outPath
          ]);
        }

      } else {
        // ── 預設：順序 concat ──
        const listPath = path.join(tmpDir, 'list.txt');
        fs.writeFileSync(listPath, vidPaths.map(p => "file '" + p.replace(/\\/g, '/') + "'").join('\n'));
        tmpFiles.push(listPath);
        await runFfmpeg([
          '-y', '-f', 'concat', '-safe', '0', '-i', listPath,
          '-c', 'copy', outPath
        ]);
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
