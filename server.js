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

// ── 路由：POST /merge ──
async function handleMerge(req, res) {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', async () => {
    let urls;
    try {
      urls = JSON.parse(body).urls;
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

      // 2. 建立 concat 清單
      const listPath = path.join(tmpDir, 'list.txt');
      fs.writeFileSync(listPath, vidPaths.map(p => "file '" + p.replace(/\\/g, '/') + "'").join('\n'));
      tmpFiles.push(listPath);

      // 3. 執行 FFmpeg 合併
      const outPath = path.join(tmpDir, 'merged.mp4');
      tmpFiles.push(outPath);

      await new Promise((resolve, reject) => {
        execFile(ffmpegPath, [
          '-y',
          '-f', 'concat',
          '-safe', '0',
          '-i', listPath,
          '-c', 'copy',
          outPath
        ], (err, stdout, stderr) => {
          if (err) reject(new Error(stderr));
          else resolve();
        });
      });

      // 4. 回傳合併後的影片
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
