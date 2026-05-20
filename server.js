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

// ── 通用格子合成：cols × rows 支影片 → 1080×1920 ──
// 每格尺寸 = 1080/cols × 1920/rows
async function makeGridRound(paths, cols, rows, outPath) {
  const N = cols * rows;
  if (paths.length !== N) {
    throw new Error('需要 ' + N + ' 支影片，實際 ' + paths.length);
  }
  const W = Math.floor(1080 / cols);
  const H = Math.floor(1920 / rows);

  const scaleFilters = paths.map((_, i) =>
    `[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,` +
    `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:black,setsar=1[v${i}]`
  ).join(';');

  // xstack layout: 每格的左上角座標，用 w0/h0 表示（每格等寬等高）
  const layoutCells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c === 0 ? '0' : (c === 1 ? 'w0' : c + '*w0');
      const y = r === 0 ? '0' : (r === 1 ? 'h0' : r + '*h0');
      layoutCells.push(x + '_' + y);
    }
  }
  const inputRefs = paths.map((_, i) => '[v' + i + ']').join('');
  const stackFilter =
    inputRefs + 'xstack=inputs=' + N + ':layout=' + layoutCells.join('|') + '[vout]';

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

      const gridMatch = layout && layout.match(/^grid(\d+)$/);
      if (gridMatch) {
        // ── 格子模式（grid4 = 2×2、grid9 = 3×3） ──
        const N = parseInt(gridMatch[1], 10);
        let cols, rows;
        if (N === 4) { cols = 2; rows = 2; }
        else if (N === 9) { cols = 3; rows = 3; }
        else throw new Error('不支援的 grid 大小：' + N);

        // 每 N 支合成一個 round，最後 concat 所有 rounds
        const roundPaths = [];
        for (let i = 0; i < vidPaths.length; i += N) {
          const group    = vidPaths.slice(i, i + N);
          const roundOut = path.join(tmpDir, 'round' + (i / N) + '.mp4');
          console.log(N + '格合成 round ' + (i / N + 1) + '，clips:', group.length);
          await makeGridRound(group, cols, rows, roundOut);
          roundPaths.push(roundOut);
          tmpFiles.push(roundOut);
        }

        if (roundPaths.length === 1) {
          fs.renameSync(roundPaths[0], outPath);
          tmpFiles.pop();
        } else {
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
