# Belle · 架構說明

> 最後更新：2026-05-21（含擷取 UI 統一預覽、相機最短10秒規則）

---

## 一、整體系統架構

```
┌─────────────────────────────────────────────────────────────────────┐
│                        使用者裝置（瀏覽器）                            │
│                                                                     │
│   belle-v1.html  ←── GitHub Pages (static hosting)                 │
│   index.html     ←── 登入頁                                         │
└──────────────┬──────────────────────────────────────────────────────┘
               │
       ┌───────┼─────────────────────────────────┐
       │       │                                 │
       ▼       ▼                                 ▼
┌──────────┐ ┌────────────────────┐   ┌──────────────────────────────┐
│ Firebase │ │     Cloudinary     │   │   Render.com (Node.js)       │
│          │ │                    │   │                              │
│ Auth     │ │  影片上傳 / 儲存     │   │  POST /merge  → FFmpeg 合併   │
│ Firestore│ │  URL 帶轉換參數      │   │  POST /convert→ WebM→MP4     │
└──────────┘ └────────────────────┘   └──────────────┬───────────────┘
                                                     │
                                                     ▼
                                          ┌─────────────────────┐
                                          │   Google Drive      │
                                          │   belle/ 資料夾      │
                                          │   (儲存下載成品)      │
                                          └─────────────────────┘
```

---

## 二、各平台的職責

### GitHub Pages
- **網址**：`https://kanmingkai.github.io/belle/belle-v1.html`
- 純靜態 hosting，服務 HTML / CSS / JS / 字型
- 不執行任何後端邏輯
- 免費、無頻寬限制

### Firebase Authentication
- 處理 Google 登入 / 登出
- `onAuthStateChanged` 監聽登入狀態
- 未登入 → 強制跳回 `index.html`

### Firebase Firestore（資料庫）
- 所有 metadata 在這裡，**影片本身不在這裡**

```
collections:
├── users/
│   └── {uid}/
│       ├── displayName, handle, avatar, bio, email
│       └── createdAt
│
├── partnerships/
│   └── {partnershipId}/
│       ├── user_a_uid, user_b_uid
│       └── type: 'friend' | 'close_friend'
│
├── videos/
│   └── {videoId}/
│       ├── userId, partnershipId
│       ├── title, description
│       ├── url          ← Cloudinary 轉換後的播放 URL
│       ├── thumbnail_url
│       ├── time_slot    ← "2025-05-19_08-00" 格式
│       └── duration
│
└── favorites/
    └── {favId}/
        ├── userId
        ├── time_slot
        ├── my_video_url, my_video_id, my_video_thumb
        └── partner_video_url, partner_video_thumb
```

### Cloudinary（影片 CDN）
- 接受上傳（unsigned upload preset `video_upload`）
- **不儲存原始檔**，URL 本身帶有轉換參數
- 存入 Firestore 的 URL 已包含 trim / crop 資訊：

```
原始 URL：   .../v1779068371/xxx.mp4

加轉換後：   .../eo_10.0/c_crop,x_82,y_74,w_462,h_411/q_auto:good,f_auto/v1779.../xxx.mp4
                  │              │                    │
                  │              └── 裁切座標 + 尺寸    └── 自動畫質 + 格式
                  └── 結束時間 10 秒
```

- `qualifyUrl(url)` — 播放前動態加上 `q_auto:good,f_auto`（不改 Firestore 儲存值）
- 下載前會呼叫 `.replace(/,f_auto/g,'')` 移除 `f_auto`，確保 Render server 取得確定格式

### Render.com（後端 server）
- **URL**：`https://belle-backend-4htn.onrender.com`
- 唯一需要後端的兩個功能：影片合併 + WebM 格式轉換
- 端點：

| 路由 | 方法 | 用途 |
|------|------|------|
| `/ping` | GET | 健康檢查 |
| `/merge` | POST | 下載影片 → FFmpeg 合併 → 回傳 MP4 |
| `/convert` | POST | 接收 WebM blob → FFmpeg 轉 MP4 → 回傳 MP4 |

#### `/merge` 使用的兩個 FFmpeg binary

| Binary | 來源 | 用途 |
|--------|------|------|
| `ffmpeg-static` (npm) | npm 套件 | 一般合併、grid 合成 |
| `ffmpeg-draw` | build 時從 BtbN GPL 下載 | drawtext watermark（需要 libfreetype）|

- `filmFfmpegPath` 啟動時檢查是否存在，若無則 film 版型 fallback 到 concat

### Google Drive
- 接收 Render / Canvas 輸出的 MP4
- 自動建立 `belle/` 資料夾（若不存在）
- Google OAuth token 每次下載前重新授權

---

## 三、頁面結構與導航

```
index.html
    │ Google 登入成功
    ▼
belle-v1.html
    │
    ├── screen-home          ← 朋友（friend）
    ├── screen-search        ← 好友（close_friend）
    ├── screen-my-videos     ← 我的影片
    ├── screen-favorites     ← 收藏
    ├── screen-edit-profile  (slide-up)
    ├── screen-settings      (slide-up)
    └── screen-account       (slide-up)
```

底部導覽列：
```
[ ⊞ 朋友 ]  [ ◎ 好友 ]  [ ＋ ]  [ ☆ 收藏 ]  [ ◉ 我的 ]
     │            │        │          │            │
  home        search    上傳     favorites     my-videos
```

---

## 四、各頁面邏輯

### 朋友頁（screen-home）

> 顯示你和「朋友（friend）」夥伴在同一時段拍的影片，上下分割畫面

```
initHome()
    ├── getPartnershipByType(uid, 'friend')
    │       ├── 找不到 → 顯示「尚未配對」
    │       └── 找到 → partnerUid
    │
    ├── getSlotVideosForFeed(myUid, partnerUid)
    │       └── Firestore videos，按 time_slot 配對
    │
    └── renderSplitPair()
            ├── 上半：對方影片
            ├── 下半：自己影片
            ├── 左下：slotGreeting（問候語）
            └── ★ 按鈕 → addSplitFavorite() → Firestore favorites

手勢：上滑 / 下滑換到下一對 / 上一對
```

### 好友頁（screen-search）

> 邏輯與朋友頁相同，partnership type 改為 `close_friend`

### 我的影片（screen-my-videos）

```
initMyVideos()
    ├── getUserVideos(CU.uid) ← Firestore
    └── renderGrid()
            └── 縮圖網格（3 欄），按日期分組
                    ├── 今天 / 昨天 / 前天 / YYYY-MM-DD 日期分隔線
                    └── 每個日期有「下載日期」按鈕 → openVlogSheet(dateStr)

點擊縮圖
    └── openMyVidPlayer(idx)
            ├── 全螢幕播放
            ├── 上下滑切換
            └── 長按 → 刪除選項

「下載日期」按鈕 → openVlogSheet(dateStr)
    └── 選版型後 → _downloadDateWithLayout(dateStr, layout, greeting, btn)
```

### 收藏頁（screen-favorites）

```
initFavorites()
    └── getFavorites(CU.uid) ← Firestore
            └── renderFavorites(favs)
                    ├── Featured player（上方大播放器）
                    │     ├── 上半：partner_video_url
                    │     └── 下半：my_video_url
                    │
                    └── Grid（縮圖列表）
                          ├── 左：對方縮圖
                          ├── 右：自己縮圖
                          ├── 右上：時段標籤（HH:00）
                          └── ✕ → deleteFavCard()

「下載收藏」按鈕 → openVlogSheet()
    └── 選版型後 → downloadFavVids()
```

---

## 五、上傳流程

```
openUploadSheet()
    ├── 拍攝 → openCamera()
    │     ├── getUserMedia({ video: { facingMode } })
    │     ├── MediaRecorder 錄製最多 10 秒
    │     │     candidates: ['video/mp4', 'video/webm;codecs=vp9', ...]
    │     │     無 videoBitsPerSecond（瀏覽器自決）
    │     ├── 錄完後判斷（camElapsed）：
    │     │     < 10000ms → 丟棄，留在相機待機，顯示 toast「不足 10 秒，請重新拍攝」
    │     │     ≥ 10000ms → cameraDirectUpload()（直接上傳，不走 uploadForm）
    │     └── 輸出 File（.mp4 或 .webm 視瀏覽器而定）
    │
    └── 相簿 → 選取檔案
                    │
                    ▼
            openUploadForm(file)
                    │
                    ├── initTrimUI(fileURL)
                    │     ├── trimPreviewVid.src = fileURL
                    │     ├── onloadedmetadata：
                    │     │     ├── 顯示 trimWrap
                    │     │     ├── renderTrimWindow()   ← 固定 10s 滑動視窗
                    │     │     ├── setupTrimWindow()    ← 拖動整個視窗
                    │     │     ├── generateTrimThumbs() ← 非同步生成 8 幀縮略圖
                    │     │     └── positionCropFrame()  ← 裁切框疊加在同一預覽框
                    │     │
                    │     └── 統一預覽框（trimPreviewWrap）：
                    │           ┌─────────────────────────────┐
                    │           │  trimPreviewVid（影片預覽）   │
                    │           │  ┌──────────┐               │
                    │           │  │ cropFrame│（9:8，可拖）   │
                    │           │  └──────────┘            ▶  │
                    │           └─────────────────────────────┘
                    │           [■■|═══ 10s window ═══|■■]  ← 時間軸
                    │           拖動視窗 → 即時更新預覽幀
                    │           ▶ 播放 → 從 trimStart 播到 trimEnd 自動停
                    │
                    └── submitUpload()
                            ├── uploadToCloudinary(file)     → secure_url（原始）
                            ├── 讀 trimPreviewVid 尺寸 + cropX/Y/W/H → scaleX/Y
                            ├── getTransformedVideoUrl(url, trim, crop)
                            │     └── 組合帶 eo_/c_crop/q_auto 的 URL
                            ├── saveVideoMetadata(url) → Firestore
                            └── checkAndShowSlotPicker()
                                    └── 詢問是否指定時段
```

---

## 六、下載成品流程（Vlog 版型）

### 版型選擇器（Vlog Sheet）

```
openVlogSheet(dateStr?)
    └── 選擇版型：
        ├── 原版（concat）
        ├── 電影膠卷（film）
        ├── 四格（grid4）
        └── 九格（grid9）
```

---

### concat（原版）

```
→ POST /merge { segments, layout:'concat' }
→ FFmpeg: -f concat -c copy
→ 保留 watermark、保留音訊
→ uploadToGDrive(blob, 'belle-YYYY-MM-DD.mp4')
```

---

### film（電影膠卷）

```
→ POST /merge { segments, layout:'film', date, greeting }
→ FFmpeg Step 1: concat 所有段落
→ FFmpeg Step 2 (filmFfmpegPath): drawtext 燒入
      頂部中央：日期（2025.05.19）
      底部中央：問候語（Good morning）
      右下角：belle 浮水印
→ 保留音訊
→ uploadToGDrive(blob, 'belle-YYYY-MM-DD.mp4')
```

---

### grid4 / grid9（四格 / 九格）

**架構設計重點：**

> grid4 / grid9 不走 `/merge`，改走「瀏覽器 Canvas 錄製 → `/convert` 轉檔」混合方案。
> 原因：Canvas 錄製即時，比 server 下載 N 支影片再合成更快。

```
_doGridCanvas(token, segments, filename, btn, origLabel, cols, rows, slotH)
    │
    ├── 參數：
    │     cols=2, rows=2, slotH=410  → grid4（canvas 924×820）
    │     cols=3, rows=3, slotH=274  → grid9（canvas 924×822）
    │
    ├── 每輪（每 N = cols×rows 支影片）：
    │
    │   Step 1：同時預載全部 N 支影片
    │           Promise.all(vids.map(v => v.oncanplaythrough))
    │
    │   Step 2：建立單一 canvas（CANVAS_W × CANVAS_H）
    │           + MediaRecorder(canvas.captureStream(30), {
    │               mimeType: 'video/webm;codecs=vp9',
    │               videoBitsPerSecond: 8_000_000
    │             })
    │
    │   Step 3：Promise.all(vids.map(v => v.play()))  ← 同一 tick 同步播放
    │           setTimeout 100ms 等第一幀穩定
    │           rec.start(100)
    │
    │   Step 4：setInterval(1000/30) 繪製迴圈
    │           ctx.fillStyle = '#000'  ← 黑色背景（格線）
    │           for i in vids:
    │               col = i % cols, row = floor(i / cols)
    │               ctx.drawImage(vids[i],
    │                   col*SLOT_W+1, row*SLOT_H+1,  ← 1px 黑框 inset
    │                   CELL_W, CELL_H)
    │           結束條件：所有影片 ended / paused
    │
    │   Step 5：rec.stop() → roundBlob (WebM)
    │
    ├── 多輪：concat 所有 roundBlob（canvas 依序播放合併）
    │
    ├── POST blob → /convert
    │       server FFmpeg:
    │         -probesize 100M -analyzeduration 100M
    │         -fflags +genpts+igndts
    │         -c:v libx264 -crf 23 -preset ultrafast
    │         -pix_fmt yuv420p -movflags +faststart
    │         -vf fps=30 -an
    │       → 回傳真正的 H.264 MP4
    │
    └── uploadToGDrive(mp4Blob, 'belle-grid4-YYYY-MM-DD.mp4')
```

#### Canvas 尺寸計算

| 版型 | cols×rows | SLOT_W | SLOT_H | CELL_W | CELL_H | 總畫布 |
|------|-----------|--------|--------|--------|--------|--------|
| grid4 | 2×2 | 462 | 410 | 460 | 408 | 924×820 |
| grid9 | 3×3 | 308 | 274 | 306 | 272 | 924×822 |

- SLOT = cell + 2px（每格 1px 黑框）
- 總畫布寬高均為偶數（libx264 + yuv420p 要求）
- 格之間：2px 黑線（左格右框 + 右格左框各 1px）

---

## 七、Watermark 燒入（concat / film 版型）

```
每段影片（canLabel = filmFfmpegPath 存在 && DejaVu 字型存在）：

┌────────────────────────────────────────┐
│              影片畫面                   │
│                                        │
│                                        │
│  drawtext（Playfair Italic, 18px）      │
│  Good morning                          │  ← y = h - text_h - 30
│  drawtext（Josefin Thin, 11px）         │
│  MORNING WALK                          │  ← y = h - text_h - 8
└────────────────────────────────────────┘

字型優先順序：
  問候語 → PlayfairDisplay-Italic.ttf（build 下載）→ DejaVuSans fallback
  標題   → JosefinSans-Thin.ttf（build 下載）→ DejaVuSans fallback

注意：使用 drawtext+shadow，不用 drawbox（drawbox alpha 在 yuv420p
      上觸發 FFmpeg filter reinit -22 錯誤，已驗證放棄）
```

---

## 八、Render server 詳細端點

### POST /merge

**Request：**
```json
{
  "segments": [
    { "url": "https://res.cloudinary.com/...", "greeting": "Good morning", "title": "@handle · 08:00" }
  ],
  "layout": "concat | film | grid4 | grid9",
  "date": "2025.05.19",
  "greeting": "Good morning"
}
```
（舊版相容：`urls: [...]` 也接受）

**處理流程：**
```
Step 1  平行下載所有影片 → /tmp/igmerge-xxx/v0.mp4, v1.mp4 ...
Step 2  每段燒入 watermark（greeting + title，需 filmFfmpegPath）
Step 3  依 layout 合併：
          concat → ffmpeg -f concat -c copy
          film   → concat + drawtext 日期/問候/belle
          grid4/grid9 → filter_complex hstack+vstack，
                        -pix_fmt yuv420p -movflags +faststart
Step 4  回傳 video/mp4 binary stream
```

**Response：** `Content-Type: video/mp4`，直接串流 binary

---

### POST /convert

**Request：** raw binary body（WebM from MediaRecorder）

**用途：** 把瀏覽器 Canvas 錄製的 WebM 轉成可在 iOS / Android 播放的真正 H.264 MP4

**FFmpeg 指令重點：**
```
-probesize 100M -analyzeduration 100M   ← MediaRecorder WebM 缺 codec header，需多 probe
-fflags +genpts+igndts                  ← 修復不規則時間戳
-c:v libx264 -crf 23 -preset ultrafast
-pix_fmt yuv420p                        ← 手機相容性
-movflags +faststart                    ← moov atom 前置，下載後立即可播
-vf fps=30                              ← 固定 30fps，消除 MediaRecorder 時間戳抖動
-an                                     ← Canvas 錄製無音訊
```

**Response：** `Content-Type: video/mp4`

---

### GET /ping

```json
{ "ok": true }
```

---

## 九、相機錄製（上傳用）

```javascript
candidates = ['video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
// Chrome: 選到 video/webm;codecs=vp9
// Safari: 選到 video/mp4（真正 H.264）
// iOS Safari: 選到 video/mp4

new MediaRecorder(camStream, { mimeType })
// 無 videoBitsPerSecond，瀏覽器自決
// 計時器 camTimerInterval 每 100ms 更新 camElapsed
// 滿 10000ms 自動停（CAM_MAX_MS = 10000）

onstop 回呼判斷：
  camElapsed < 10000  → 丟棄 chunks，
                        重置 UI（按鈕、計時器），
                        toast「不足 10 秒，請重新拍攝」，
                        留在相機畫面（不關閉）
  camElapsed ≥ 10000  → cameraDirectUpload()
                          ├── 建立 tempVid 讀取 videoWidth/Height
                          ├── 自動計算中央 9:8 cropData
                          └── uploadToCloudinary → saveVideoMetadata

→ 輸出副檔名：mp4（mimeType 含 'mp4'）或 webm
→ Cloudinary 負責轉檔、裁切、壓縮
```

---

## 十、Google OAuth 流程

```
Mobile（無法開 popup）             Desktop（可開 popup）
        │                                │
        ▼                                ▼
redirect 到 Google                  開 popup 視窗
用戶授權後帶 token 導回             postMessage 回傳 token
        │                                │
        └─────────────┬──────────────────┘
                      ▼
           getOrCreateBelleFolder(token)
                      ├── 搜尋 Drive 根目錄是否有 "belle" 資料夾
                      ├── 有 → 取得 folderId
                      └── 無 → 建立 → folderId
                                  │
                      uploadToGDrive(blob, filename, token)
                          metadata: { name, mimeType:'video/mp4', parents:[folderId] }
                          multipart form upload
```

---

## 十一、關鍵資料格式

### time_slot
```
"2025-05-19_08-00"
         │      └── 小時-分鐘（固定 00）
         └── 日期

slotGreeting 對應表：
  00:00 → Mid-night       08:00 → Good morning
  02:00 → Deep sleep      10:00 → Brunch time
  04:00 → Before dawn     12:00 → Good afternoon
  06:00 → Sunrise time    14:00 → Teatime
                          16:00 → Late afternoon
                          18:00 → Good evening
                          20:00 → Relaxing time
                          22:00 → Good night
```

### Cloudinary 轉換 URL 完整結構
```
https://res.cloudinary.com/dndyiurdr/video/upload/
    so_2.0,eo_10.0/        ← 開始/結束時間（so_ 可省略）
    c_crop,x_82,y_74,      ← 裁切 x, y 座標（像素）
    w_462,h_411/           ← 裁切輸出尺寸
    q_auto:good,f_auto/    ← 自動畫質 + 自動格式（f_auto 下載前移除）
    v{timestamp}/{public_id}.mp4
```

### 下載檔案命名規則
```
belle-{YYYY-MM-DD}.mp4          ← concat / film（日期下載）
belle-grid4-{YYYY-MM-DD}.mp4   ← grid4（日期下載）
belle-grid9-{YYYY-MM-DD}.mp4   ← grid9（日期下載）
belle-favs-{YYYY-MM-DD}.mp4    ← concat / film（收藏下載）
belle-grid4-favs-{YYYY-MM-DD}.mp4 ← grid4（收藏下載）
belle-grid9-favs-{YYYY-MM-DD}.mp4 ← grid9（收藏下載）
```

---

## 十二、四種 Vlog 版型對比

```
concat（原版）    film（電影膠卷）     grid4（四格）        grid9（九格）
┌────────────┐   ┌────────────┐   ┌──────┬──────┐   ┌────┬────┬────┐
│  影片 1     │   │  影片 1     │   │ 影片1 │ 影片2 │   │ v1 │ v2 │ v3 │
│  watermark │   │  watermark │   │      │      │   │    │    │    │
├────────────┤   ├────────────┤   ├──────┼──────┤   ├────┼────┼────┤
│  影片 2     │   │  影片 2     │   │ 影片3 │ 影片4 │   │ v4 │ v5 │ v6 │
│  watermark │   │  watermark │   │      │      │   │    │    │    │
└────────────┘   ├────────────┤   └──────┴──────┘   ├────┼────┼────┤
                 │ ← date →   │                      │ v7 │ v8 │ v9 │
                 │ greeting   │                      └────┴────┴────┘
                 │       belle│

處理路徑   /merge concat      /merge film         Canvas→/convert
輸出尺寸   影片原尺寸           影片原尺寸           924×820（grid4）
                                                  924×822（grid9）
音訊       保留               保留                無（Canvas muted）
同步性     N/A（序列）         N/A（序列）         9格同一 tick 同步 play
```

---

## 十三、檔案清單

```
d:\Instangram\
├── belle-v1.html                 ← 整個 app（單一 HTML 檔）
├── index.html                    ← 登入頁
├── server.js                     ← Render 後端（/merge + /convert）
├── build.sh                      ← Render build script（下載字型 + ffmpeg-draw）
├── render.yaml                   ← Render 服務設定
├── netlify.toml                  ← 靜態 hosting CORS headers（已不用於部署）
├── package.json                  ← { "ffmpeg-static": "^5.2.0" }
├── fonts/
│   ├── PlayfairDisplay-Italic.ttf   ← 問候語字型（build 時下載）
│   └── JosefinSans-Thin.ttf         ← 標題字型（build 時下載）
└── js/
    ├── firebase-config.js   ← Firebase 初始化（apiKey 等）
    ├── auth.js              ← Google 登入 / 登出
    ├── profile.js           ← 個人資料 CRUD
    ├── avatar.js            ← 頭像上傳
    ├── video.js             ← getFavorites / saveVideoMetadata 等
    ├── search.js            ← 使用者搜尋 / 配對
    ├── partnership.js       ← getPartnershipByType 等
    └── cloudinary.js        ← qualifyUrl / getTransformedVideoUrl / uploadToCloudinary
```

---

## 十四、已知注意事項 / 設計決策紀錄

### libx264 必須偶數維度
`-pix_fmt yuv420p` 要求寬高均為偶數。Canvas grid 尺寸：
- grid4：SLOT_H=410（偶數）× 2 rows = 820 ✓
- grid9：SLOT_H=274（偶數）× 3 rows = 822 ✓

### drawbox alpha 問題
FFmpeg `drawbox` 使用 alpha 值在 yuv420p 串流上會觸發 filter reinit 錯誤 `-22`。
已改用 `drawtext + shadow` 代替，確認穩定。

### Canvas MediaRecorder 輸出 WebM，非 MP4
Chrome 的 `MediaRecorder` 不支援真正的 H.264 MP4 輸出（只有少數裝置支援 `video/mp4`）。
Canvas 錄製一律輸出 WebM/VP9，透過 `/convert` endpoint 讓 server FFmpeg 轉為真正的 H.264 MP4，否則 iOS 無法播放。

### Firestore QUIC_NETWORK_IDLE_TIMEOUT
Firestore 長連線閒置自動斷、自動重連，為正常行為，不是 bug。

### Cloudinary 416 Range Not Satisfiable
瀏覽器 seek 時送 Range request，Cloudinary 動態轉換的 derived asset 尚未生成完畢時會回 416。
影片通常仍可播放，屬 Cloudinary 端快取延遲，非 app bug。

### /convert 的 MediaRecorder WebM codec 問題
MediaRecorder 輸出的 WebM 缺少正式的 codec parameters header（live streaming 格式）。
需加 `-probesize 100M -analyzeduration 100M` 讓 FFmpeg 深度讀取後才能正確解碼。

### 相機錄影最短 10 秒規則
`onstop` 回呼在 `camElapsed < 10000` 時丟棄 chunks、重置 UI，留在相機畫面讓使用者重拍。
滿 10 秒（`CAM_MAX_MS = 10000`）自動停時才觸發上傳。
設計原因：App 規格是 10 秒固定長度；不足 10 秒的片段在 Cloudinary 轉換後
會導致 trim/duration 不符，影響九宮格 / 四格並排的時間對齊。

### 擷取 UI：裁切框與時間軸統一預覽
舊版：`trimWrap`（時間軸）和 `cropWrap`（裁切框）是兩個獨立的 section，各用一個 `<video>` 元素。
新版：`cropWrap` 移除，`cropFrame` 直接絕對定位疊加在 `trimPreviewWrap` 的 `trimPreviewVid` 上。
- 同一個影片元素同時服務「時間選取預覽」和「裁切框定位」
- `positionCropFrame` 以 `trimPreviewWrap` 為容器，`video { width:100%; display:block }` 確保無 letterbox，CSS 座標與影片像素 1:1 線性縮放
- `submitUpload` 改從 `trimPreviewVid.videoWidth/offsetWidth` 計算 scaleX/Y

### 擷取 UI：固定視窗取代雙 Handle
舊版：兩個獨立的左右 handle 分別拖動，容易誤選超過 10 秒。
新版：固定寬度的 `trimWindow` div（寬度 = 10 / totalDur × 時間軸寬），
整個視窗拖動，`trimStart = clamp(0, newPos, totalDur - 10)`，`trimEnd = trimStart + 10`。
拖動時即時更新 `trimPreviewVid.currentTime = trimStart`。
