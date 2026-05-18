const CLOUDINARY_CLOUD_NAME = "dndyiurdr";
const CLOUDINARY_UPLOAD_PRESET = "video_upload";

// 為播放 URL 動態加上畫質優化參數（不影響 Cloudinary 儲存的原始檔）
function qualifyUrl(url) {
  if (!url || !url.includes('/video/upload/') || url.includes('q_auto')) return url;
  return url.replace(/(\/v\d+\/|\/(?:[^/,?#]+\.(?:mp4|mov|webm|avi)))/i,
    '/q_auto:good,f_auto$1');
}

// 根據 trim/crop 參數產生 Cloudinary 轉換 URL
function getTransformedVideoUrl(rawUrl, startTime, endTime, cropData) {
  if (!rawUrl) return rawUrl;
  var parts = [];

  if (startTime != null && endTime != null && endTime > startTime) {
    var trimSeg = '';
    if (startTime > 0.05) trimSeg = 'so_' + startTime.toFixed(1) + ',';
    trimSeg += 'eo_' + endTime.toFixed(1);
    parts.push(trimSeg);
  }

  if (cropData && cropData.w > 0 && cropData.h > 0) {
    parts.push(
      'c_crop' +
      ',x_' + Math.round(cropData.x) +
      ',y_' + Math.round(cropData.y) +
      ',w_' + Math.round(cropData.w) +
      ',h_' + Math.round(cropData.h)
    );
    // ar_9:8,c_scale omitted — crop frame already outputs 9:8 dimensions
  }

  // 畫質優化：自動壓縮品質 + 自動選最佳格式（WebM/MP4）
  parts.push('q_auto:good,f_auto');

  var url = rawUrl.replace('/video/upload/', '/video/upload/' + parts.join('/') + '/');
  // Force MP4 output so .mov / HEVC files transform correctly
  url = url.replace(/\.[^./]+(\?|$)/, '.mp4$1');
  return url;
}

async function uploadToCloudinary(file, onProgress) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) onProgress((e.loaded / e.total) * 100);
      });
    }

    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        let msg = 'Upload failed (' + xhr.status + ')';
        try { msg += ': ' + JSON.parse(xhr.responseText).error.message; } catch (_) {}
        reject(new Error(msg));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Upload error')));

    xhr.open('POST', 'https://api.cloudinary.com/v1_1/' + CLOUDINARY_CLOUD_NAME + '/video/upload');
    xhr.send(formData);
  });
}
