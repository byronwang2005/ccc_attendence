import {
  buildTimestamp,
  clearState,
  downloadFile,
  formatDateTime,
  getIdentityLabel,
  getTimeModeLabel,
  loadState,
  parseErrorMessage,
  readPageMessage,
  redirectTo,
  showToast
} from './wizard.js';

document.addEventListener('DOMContentLoaded', () => {
  readPageMessage();

  const state = loadState();
  if (!state.url) {
    redirectTo('index.html', '请先完成前两步后再生成二维码');
    return;
  }

  const summaryIdentity = document.getElementById('summaryIdentity');
  const summaryMode = document.getElementById('summaryMode');
  const summaryUrl = document.getElementById('summaryUrl');
  const generatedTimeWrap = document.getElementById('generatedTimeWrap');
  const generatedTime = document.getElementById('generatedTime');
  const qrcodeContainer = document.getElementById('qrcode');
  const generateBtn = document.getElementById('generateBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const backBtn = document.getElementById('backBtn');
  const restartBtn = document.getElementById('restartBtn');

  let currentImageUrl = '';

  summaryIdentity.textContent = getIdentityLabel(state.identity);
  summaryMode.textContent = getTimeModeLabel(state);
  summaryUrl.textContent = state.url;

  const renderPlaceholder = (message = '二维码将在这里生成') => {
    qrcodeContainer.innerHTML = `
      <div class="qrcode-placeholder">
        <div>${message}</div>
        <small>生成成功后会自动下载到本地</small>
      </div>
    `;
  };

  const renderLoading = () => {
    qrcodeContainer.innerHTML = `
      <div class="loading-state">
        <div class="loading-spinner"></div>
        <div>正在生成二维码...</div>
      </div>
    `;
  };

  const renderImage = (src) => {
    const image = new Image();
    image.src = src;
    image.alt = 'Attendance QR Code';
    image.className = 'qrcode-image';
    qrcodeContainer.innerHTML = '';
    qrcodeContainer.appendChild(image);
  };

  const generateQRCode = async () => {
    let timestamp;
    const previousImageUrl = currentImageUrl;
    const previousGeneratedTime = generatedTime.textContent;

    try {
      timestamp = buildTimestamp(state);
    } catch (error) {
      redirectTo('time.html', error.message);
      return;
    }

    renderLoading();
    generateBtn.disabled = true;
    generateBtn.textContent = '生成中...';

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: state.url,
          timestamp
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(parseErrorMessage(errorText));
      }

      const blob = await response.blob();
      const nextImageUrl = URL.createObjectURL(blob);
      currentImageUrl = nextImageUrl;
      renderImage(currentImageUrl);

      generatedTime.textContent = formatDateTime(timestamp);
      generatedTimeWrap.hidden = false;
      downloadBtn.hidden = false;

      if (previousImageUrl) {
        URL.revokeObjectURL(previousImageUrl);
      }

      downloadFile(currentImageUrl, 'qrcode.png');
      showToast('二维码已生成并下载！如果有“答题”选项，请记得继续完成。');
    } catch (error) {
      if (previousImageUrl) {
        currentImageUrl = previousImageUrl;
        renderImage(previousImageUrl);
        generatedTime.textContent = previousGeneratedTime;
        generatedTimeWrap.hidden = false;
        downloadBtn.hidden = false;
      } else {
        renderPlaceholder('二维码生成失败，请检查链接或时间设置');
        generatedTime.textContent = '';
        generatedTimeWrap.hidden = true;
        downloadBtn.hidden = true;
      }
      showToast(`二维码生成失败：${error.message}`, 'error');
    } finally {
      generateBtn.disabled = false;
      generateBtn.textContent = currentImageUrl ? '重新生成二维码' : '生成签到二维码';
    }
  };

  downloadBtn.addEventListener('click', () => {
    if (!currentImageUrl) {
      showToast('当前还没有可下载的二维码', 'error');
      return;
    }

    downloadFile(currentImageUrl, 'qrcode.png');
  });

  backBtn.addEventListener('click', () => {
    window.location.href = 'time.html';
  });

  restartBtn.addEventListener('click', () => {
    clearState();
    window.location.href = 'index.html';
  });

  generateBtn.addEventListener('click', () => {
    generateQRCode();
  });

  window.addEventListener('beforeunload', () => {
    if (currentImageUrl) {
      URL.revokeObjectURL(currentImageUrl);
    }
  });

  renderPlaceholder();
  generateQRCode();
});
