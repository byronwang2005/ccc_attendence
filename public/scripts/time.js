import {
  buildTimestamp,
  collectManualTime,
  fillManualTimeInputs,
  getIdentityLabel,
  loadState,
  readPageMessage,
  redirectTo,
  saveState,
  showToast
} from './wizard.js';

document.addEventListener('DOMContentLoaded', () => {
  readPageMessage();

  const state = loadState();
  if (!state.url) {
    redirectTo('index.html', '请先完成第一步并粘贴课程链接');
    return;
  }

  const linkPreview = document.getElementById('linkPreview');
  const identityPreview = document.getElementById('identityPreview');
  const manualTime = document.getElementById('manualTime');
  const modeInputs = Array.from(document.querySelectorAll('input[name="mode"]'));
  const backBtn = document.getElementById('backBtn');
  const nextBtn = document.getElementById('nextBtn');

  linkPreview.textContent = state.url;
  identityPreview.textContent = getIdentityLabel(state.identity);
  fillManualTimeInputs(state.manualTime);

  const applyMode = (mode) => {
    const nextMode = mode === 'manual' ? 'manual' : 'auto';
    manualTime.hidden = nextMode !== 'manual';
  };

  const collectState = () => ({
    timeMode: document.querySelector('input[name="mode"]:checked').value,
    manualTime: collectManualTime()
  });

  modeInputs.forEach((input) => {
    input.checked = input.value === state.timeMode;
    input.addEventListener('change', () => {
      applyMode(input.value);
      saveState(collectState());
    });
  });

  applyMode(state.timeMode);

  ['year', 'month', 'day', 'hour', 'minute'].forEach((id) => {
    const element = document.getElementById(id);
    element.addEventListener('input', () => {
      saveState(collectState());
    });
  });

  backBtn.addEventListener('click', () => {
    saveState(collectState());
    window.location.href = 'index.html';
  });

  nextBtn.addEventListener('click', () => {
    const nextState = saveState(collectState());

    try {
      buildTimestamp(nextState);
    } catch (error) {
      showToast(error.message, 'error');
      if (nextState.timeMode === 'manual') {
        const firstManualInput = document.getElementById('year');
        if (firstManualInput) {
          firstManualInput.focus();
        }
      }
      return;
    }

    window.location.href = 'qrcode.html';
  });
});
