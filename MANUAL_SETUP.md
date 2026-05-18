# 手動設定清單

需要在網站後台手動操作的項目，Claude Code 無法代為設定。

---

## 一、Firebase Console
網址：https://console.firebase.google.com → 選擇專案 `lynnweb-833dc`

### 1. 更新 Security Rules
路徑：Firestore Database → Rules

將以下規則完整貼上並發布：

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /users/{userId} {
      allow read: if request.auth != null;
      allow create, update, delete: if request.auth.uid == userId;
    }

    match /partnerships/{partnershipId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null &&
                       request.resource.data.type in ['friend', 'close_friend'] &&
                       request.resource.data.status == 'active' &&
                       request.resource.data.user_a_uid == request.auth.uid;
      allow update: if request.auth.uid == resource.data.user_a_uid ||
                       request.auth.uid == resource.data.user_b_uid;
      allow delete: if request.auth.uid == resource.data.user_a_uid ||
                       request.auth.uid == resource.data.user_b_uid;
    }

    match /videos/{videoId} {
      allow read: if request.auth != null &&
                     resource.data.user_uid == request.auth.uid;
      allow create: if request.auth != null &&
                       request.resource.data.user_uid == request.auth.uid;
      allow update: if request.auth.uid == resource.data.user_uid;
      allow delete: if request.auth.uid == resource.data.user_uid;
    }

    match /favorites/{favoriteId} {
      allow read: if request.auth != null &&
                     resource.data.user_uid == request.auth.uid;
      allow create: if request.auth != null &&
                       request.resource.data.user_uid == request.auth.uid;
      allow delete: if request.auth.uid == resource.data.user_uid;
    }

  }
}
```

---

### 2. 建立複合索引
路徑：Firestore Database → Indexes → 複合索引 → 新增索引

依序建立以下 5 個索引：

#### 索引 1
| 設定 | 值 |
|------|---|
| Collection | `videos` |
| 欄位 1 | `user_uid`（遞增） |
| 欄位 2 | `time_slot`（遞增） |
| 欄位 3 | `is_active_slot`（遞增） |

#### 索引 2
| 設定 | 值 |
|------|---|
| Collection | `videos` |
| 欄位 1 | `user_uid`（遞增） |
| 欄位 2 | `uploaded_at`（**遞減**） |

#### 索引 3
| 設定 | 值 |
|------|---|
| Collection | `partnerships` |
| 欄位 1 | `user_a_uid`（遞增） |
| 欄位 2 | `type`（遞增） |
| 欄位 3 | `status`（遞增） |

#### 索引 4
| 設定 | 值 |
|------|---|
| Collection | `partnerships` |
| 欄位 1 | `user_b_uid`（遞增） |
| 欄位 2 | `type`（遞增） |
| 欄位 3 | `status`（遞增） |

#### 索引 5
| 設定 | 值 |
|------|---|
| Collection | `favorites` |
| 欄位 1 | `user_uid`（遞增） |
| 欄位 2 | `saved_at`（**遞減**） |

> ⚠️ 索引建立需要幾分鐘，狀態顯示「已啟用」後才能正常查詢。

---

## 二、Cloudinary Dashboard
網址：https://cloudinary.com/console → Media Library → Settings → Upload

### 確認 Upload Preset 設定
路徑：Settings → Upload → Upload presets → 找到 `video_upload`

確認以下設定：

| 項目 | 應設定為 |
|------|---------|
| Preset name | `video_upload` |
| Signing Mode | `Unsigned` |
| Resource type | `Video` |
| Max file size | `500MB`（500000KB） |
| Eager transformations | 新增縮圖轉換（見下方） |

### 新增縮圖 Eager Transformation
在 `video_upload` preset 的「Eager transformations」欄位加入：

```
so_0,f_jpg,w_400
```

說明：上傳影片時自動產生第 0 秒的 jpg 縮圖，寬度 400px。

---

## 完成確認

- [ ] Firebase Security Rules 更新並發布
- [ ] Firestore 複合索引全部建立完成（狀態為「已啟用」）
- [ ] Cloudinary `video_upload` preset 確認設定
- [ ] Cloudinary Eager Transformation 加入縮圖參數
