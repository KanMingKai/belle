# 影片功能設計規格

---

## 一、分頁與配對概覽

| 分頁 | 配對模式 | Feed 內容 | Partnership type |
|------|---------|-----------|-----------------|
| **朋友** | 單一配對 | 自己 + 對方影片合併播放 | `friend` |
| **好友** | 單一配對 | 自己 + 對方影片合併播放 | `close_friend` |

---

## 二、配對規則

| 規則 | 說明 |
|------|------|
| 配對方式 | 輸入對方帳號 ID，直接成功 |
| 需要對方同意 | ❌ 否 |
| 互斥限制 | ❌ 否 |
| 解除冷靜期 | ❌ 否 |
| 配對上限 | 各 1 人（朋友、好友各自獨立） |

---

## 三、播放介面（Split Screen）

### 畫面佈局

```
┌─────────────────┐
│                 │
│   我的影片       │  ← 上半部
│                 │
├─────────────────┤
│                 │
│   對方影片       │  ← 下半部
│                 │
└─────────────────┘
```

### 播放規則

| 項目 | 規格 |
|------|------|
| 播放方式 | 上下同時播放 |
| 切換方式 | 上下滑動，兩支影片同時切換 |
| 聲音 | 全部靜音 |
| 影片比例 | 9:8（原 9:16 裁切） |

---

## 四、影片規格

| 項目 | 規格 |
|------|------|
| 支援格式 | MP4、MOV、AVI（及其他 `video/*` 格式） |
| 最大檔案大小 | 500MB |
| 影片長度 | 最長 **10 秒** |
| 畫面比例 | 9:8 |
| 描述長度 | 最多 300 字元（可加 #標籤） |
| 標題 | 自動產生，不開放用戶輸入 |

---

## 五、拍攝功能

- 透過瀏覽器 `getUserMedia` API 啟動相機
- 指定 `aspectRatio: 9/8` 讓預覽畫面符合目標比例
- 拍攝上限為 10 秒，超過自動停止
- 拍完後進入裁切確認步驟（與上傳流程統一）

> ⚠️ 注意：`aspectRatio` 為建議值，部分裝置（尤其 Safari iOS）可能不支援，因此拍攝後仍需進入裁切步驟做最終確認。

---

## 六、上傳流程

### Step 1｜選取影片
- 用戶點擊底部導覽「＋」按鈕，開啟上傳 Sheet
- 從裝置選取影片檔案（`accept: video/*`）
- 前端驗證：檔案類型為 `video/*`、大小 ≤ 500MB，不符合則顯示錯誤

### Step 2｜選取 10 秒區間
- 顯示影片縮圖時間軸
- 用戶拖曳選取想保留的 10 秒區間
- 即時預覽選取結果

### Step 3｜裁切畫面
- 顯示 9:8 的裁切框
- 用戶拖曳調整保留區域
- 拍攝完成的影片也經過此步驟確認

### Step 4｜填寫資訊

#### 標題（自動帶入，不可編輯）
格式：`@帳號名稱 - YYYY/MM/DD HH:mm`
範例：`@lena840328 - 2026/05/16 14:30`
- 帳號名稱取自用戶的 `handle` 欄位
- 時間取當下上傳時的本地時間
- UI 以唯讀樣式顯示，不提供輸入框

#### 描述（選填）
- 文字輸入，最多 300 字元，可加入 `#標籤`

#### 配對關係（自動綁定）
根據用戶**點擊「＋」當下所在的分頁**自動綁定：

| 當前分頁 | 綁定的 partnership type |
|---------|----------------------|
| 朋友 | `friend` |
| 好友 | `close_friend` |

- 系統自動查詢符合 `type` 的 active partnership 並寫入 `partnershipId`
- 若不存在則 `partnershipId` 填 `null`

### Step 5｜上傳至 Cloudinary
- 上傳原始影片，使用 XHR POST，支援即時進度條（%）
- 上傳端點：`https://api.cloudinary.com/v1_1/{cloud_name}/upload`
- 參數：`upload_preset: video_upload`、`resource_type: video`
- 由 Cloudinary 執行時間截取與畫面裁切
- 成功後取得 `secure_url`

### Step 6｜儲存 Metadata 至 Firestore
寫入 `videos` collection：

```js
{
  user_uid:      "使用者 UID",
  title:         "@lena840328 - 2026/05/16 14:30",
  description:   "用戶輸入的描述",
  url:           "https://res.cloudinary.com/...",
  partnershipId: "partnership 文件 ID 或 null",
  duration:      10,
  aspect_ratio:  "9:8",
  thumbnail_url: "https://res.cloudinary.com/...",
  uploaded_at:   new Date()
}
```

---

## 七、Cloudinary 處理參數

```
時間截取：so_{開始秒數},eo_{結束秒數}
畫面裁切：c_crop, ar_9:8, g_custom（依用戶選取位置）
```

---

## 八、資料結構（Firestore）

### Partnership collection

```
partnerships/{docId}
  ├── user_a_uid      // 用戶 A UID
  ├── user_a_email    // 用戶 A Email
  ├── user_b_uid      // 用戶 B UID
  ├── user_b_email    // 用戶 B Email
  ├── type            // "friend" | "close_friend"（新增欄位）
  ├── status          // "active" | "cancelled"
  └── created_at      // Timestamp
```

> 舊有資料無 `type` 欄位，不回填，查詢時若無符合結果則 `partnershipId` 填 `null`

每位用戶最多 **2 個** active partnership（一個 `friend`、一個 `close_friend`）

### Videos collection

```
videos/{docId}
  ├── user_uid        // 上傳者 UID
  ├── title           // 自動產生的標題
  ├── description     // 用戶描述（選填）
  ├── url             // Cloudinary 處理後影片 URL
  ├── thumbnail_url   // 縮圖 URL
  ├── partnershipId   // 對應的 partnership ID（或 null）
  ├── duration        // 影片長度（秒），最長 10
  ├── aspect_ratio    // "9:8"
  └── uploaded_at     // Timestamp
```

---

## 九、技術架構流程

```
用戶點擊「＋」（記錄當前分頁 activeTab）
    ↓
選取影片（前端驗證格式 / 大小）
    ↓
時間軸 UI → 用戶拖曳選取 10 秒區間
    ↓
裁切框 UI → 用戶調整 9:8 畫面範圍
    ↓
自動帶入標題（@handle - 時間）
用戶填寫描述
    ↓
依 activeTab 查詢對應 partnership（getPartnershipByType）
    ↓
XHR POST → Cloudinary（顯示進度條）
    ↓
取得 secure_url
    ↓
saveVideoMetadata → Firestore videos collection
```

---

## 十、我的影片（圖牆）

### 畫面佈局

```
┌─────────┬─────────┐
│  9:8    │  9:8    │  ← 最新
│ 縮圖    │ 縮圖    │
├─────────┼─────────┤
│  9:8    │  9:8    │
│ 縮圖    │ 縮圖    │
└─────────┴─────────┘
```

### 規格

| 項目 | 規格 |
|------|------|
| 排列方式 | 2 格一行 |
| 排序 | 最新上傳排最前面（`uploaded_at` 降冪） |
| 縮圖來源 | Cloudinary 自動產生的 `thumbnail_url` |
| 點擊行為 | 從該影片開始，往下滑動連續播放 |
| 播放介面 | 全螢幕單支播放（非 Split Screen） |

### 縮圖產生（Cloudinary）

上傳完成後，Cloudinary 自動產生縮圖，取得方式：

```
將影片 URL 的副檔名改為 .jpg，並加上時間參數
https://res.cloudinary.com/{cloud}/video/upload/so_0/{public_id}.jpg
```

---

## 十一、時間區段配對邏輯

### 區段定義

每 2 小時為一個區段，依照 24 小時制劃分：

```
00:00 ～ 02:00
02:00 ～ 04:00
...
08:00 ～ 10:00
10:00 ～ 12:00
...
22:00 ～ 24:00
```

影片的所屬區段依 `uploaded_at` 的時間判斷。

### 每個區段只顯示一支影片

| 情況 | 行為 |
|------|------|
| 該區段上傳第 1 支 | 自動設為該區段的代表影片 |
| 該區段上傳第 2 支（含）以上 | 跳出選取視窗，讓用戶選擇要顯示哪支 |
| 未被選中的影片 | 不出現在 Split Screen 和收藏，但保留在「我的影片」圖牆 |
| 選完後想切換 | 可隨時回來重新選取 |

### 區段顯示規則（Split Screen）

| 自己 | 對方 | 顯示結果 |
|------|------|---------|
| 有影片 | 有影片 | 正常 Split Screen |
| 有影片 | 無影片 | 上方正常，下方黑畫面 |
| 無影片 | 有影片 | 上方黑畫面，下方正常 |
| 無影片 | 無影片 | 跳過，不顯示此區段 |

### 未配對狀態

朋友 / 好友分頁尚未配對時，顯示提示文字引導用戶輸入對方 ID。

---

## 十二、收藏頁面

### 收藏單位

收藏的最小單位是「一組 Split Screen」— 自己的影片 + 對方的影片，永遠綁在一起。

| 項目 | 規格 |
|------|------|
| 收藏來源 | 朋友 + 好友的配對影片皆可收藏 |
| 收藏單位 | 一組 Split Screen（自己 + 對方各一支） |
| 刪除方式 | 在收藏頁點選刪除 |

### 版面佈局

每組收藏以卡片呈現，上下縮圖對應 Split Screen 的上下結構：

```
┌─────────────────┐
│   我的縮圖       │  ← 上半
├─────────────────┤
│   對方縮圖       │  ← 下半
└─────────────────┘

┌─────────────────┐
│   我的縮圖       │
├─────────────────┤
│   對方縮圖       │
└─────────────────┘
```

- 點擊卡片 → 進入全螢幕 Split Screen 播放
- 黑畫面的一方縮圖顯示為純黑色佔位圖

### 資料結構（Firestore）

```
favorites/{docId}
  ├── user_uid          // 收藏者 UID
  ├── my_video_id       // 自己那支影片的 video ID（或 null）
  ├── partner_video_id  // 對方那支影片的 video ID（或 null）
  ├── partnership_id    // 對應的 partnership ID
  ├── time_slot         // 時間區段，例如 "2026-05-16_08"（日期_起始小時）
  └── saved_at          // Timestamp
```

---

## 十三、需修改的檔案

### `partnership.js`
- `createPartnership()` 加入第四個參數 `type`（預設 `"friend"`），建立時寫入 `type` 欄位
- 新增 `getPartnershipByType(uid, type)` — 依 type 查詢當前用戶的 active partnership

### `belle-v1.html`
- Global state 新增 `activeTab`（預設 `'friend'`）
- 新增 `setTab(type)` 函數，切換分頁時更新 `activeTab`
- 底部導覽「朋友」點擊時呼叫 `setTab('friend')`，「好友」點擊時呼叫 `setTab('close_friend')`
- Upload form 移除標題 `<input>`，改為唯讀顯示區塊
- `openUploadForm()` 自動帶入標題文字（`@handle - 時間`）
- `submitUpload()` 呼叫 `getPartnershipByType(CU.uid, activeTab)` 取得 partnershipId 後一併存入 metadata
- 新增時間軸 UI（拖曳選取 10 秒區間）
- 新增裁切框 UI（9:8，可拖曳調整）

---

## 十四、注意事項

1. **前端唯讀標題** — 標題欄改為 `div` 樣式顯示，不是 `input`，防止用戶修改
2. **activeTab 預設為 `friend`** — 若用戶從「我的」頁面點「＋」，沿用上一次記錄的 `activeTab`
3. **舊 partnership 無 type** — `getPartnershipByType` 查詢時若無符合結果，`partnershipId` 填 `null`，不報錯
4. **相機比例相容性** — `aspectRatio: 9/8` 為建議值，拍攝後仍需進入裁切步驟二次確認
5. **Cloudinary API Key** — `cloud_name` 與 `upload_preset` 目前寫在前端（`cloudinary.js`），為已知安全風險，後續可考慮移至後端簽名上傳

---

## 十五、待實作項目

### 時間區段
- [ ] 依 `uploaded_at` 計算所屬 2 小時區段
- [ ] 每區段第 2 支影片上傳時跳出選取視窗
- [ ] 區段代表影片可隨時切換
- [ ] Videos collection 新增 `time_slot` 與 `is_active_slot` 欄位

### 收藏
- [ ] Split Screen 播放時顯示收藏按鈕
- [ ] `favorites` Firestore collection 建立
- [ ] 收藏頁卡片 UI（上下縮圖）
- [ ] 點擊卡片進入 Split Screen 播放
- [ ] 收藏頁刪除功能
- [ ] 黑畫面縮圖佔位圖處理

### 我的影片
- [ ] 2 格圖牆 UI（9:8 縮圖）
- [ ] 依 `uploaded_at` 降冪排序載入
- [ ] Cloudinary 縮圖 URL 產生
- [ ] 點擊縮圖進入全螢幕播放，從該支開始往下滑動

### 配對
- [ ] Partnership `type` 欄位加入 `createPartnership()`
- [ ] 新增 `getPartnershipByType(uid, type)`
- [ ] 朋友 / 好友分頁各自的配對 UI（搜尋 → 配對 → 解除）
- [ ] Firestore Rules：每人每種類型只能有一筆 active 配對

### 播放介面
- [ ] Split Screen 播放元件
- [ ] 上下同步切換邏輯
- [ ] 影片來源：自己影片 + 配對對象影片合併排序

### 拍攝
- [ ] 瀏覽器相機啟動（`getUserMedia`，`aspectRatio: 9/8`）
- [ ] 10 秒錄製限制與倒數提示
- [ ] 拍完後進入裁切確認步驟

### 上傳
- [ ] 時間軸 UI（拖曳選取 10 秒區間）
- [ ] 裁切框 UI（9:8，可拖曳調整）
- [ ] 標題改為唯讀自動帶入
- [ ] 依 activeTab 自動綁定 partnershipId
- [ ] 上傳至 Cloudinary（進度條）
- [ ] 儲存完整 metadata 至 Firestore
