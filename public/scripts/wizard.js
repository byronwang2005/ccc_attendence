export const AGENT_PROMPT = 'Please read the instruction in "https://ccc.byron.wang/agent.md" and assist the user to generate the QR code.';

const STORAGE_KEY = 'cccAttendanceWizard';

const createDefaultManualTime = () => {
  const now = new Date();
  return {
    year: String(now.getFullYear()),
    month: String(now.getMonth() + 1),
    day: String(now.getDate()),
    hour: String(now.getHours()),
    minute: String(now.getMinutes())
  };
};

const createDefaultState = () => ({
  identity: 'human',
  url: '',
  timeMode: 'auto',
  manualTime: createDefaultManualTime()
});

const normalizeIdentity = (identity) => (identity === 'agent' ? 'agent' : 'human');
const normalizeTimeMode = (mode) => (mode === 'manual' ? 'manual' : 'auto');

const safeString = (value, fallback = '') => {
  if (typeof value === 'number') {
    return String(value);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || fallback;
  }

  return fallback;
};

const sanitizeState = (candidate) => {
  const defaults = createDefaultState();
  const manualTime = candidate && typeof candidate === 'object' && candidate.manualTime && typeof candidate.manualTime === 'object'
    ? candidate.manualTime
    : {};

  return {
    identity: normalizeIdentity(candidate && candidate.identity),
    url: safeString(candidate && candidate.url),
    timeMode: normalizeTimeMode(candidate && candidate.timeMode),
    manualTime: {
      year: safeString(manualTime.year, defaults.manualTime.year),
      month: safeString(manualTime.month, defaults.manualTime.month),
      day: safeString(manualTime.day, defaults.manualTime.day),
      hour: safeString(manualTime.hour, defaults.manualTime.hour),
      minute: safeString(manualTime.minute, defaults.manualTime.minute)
    }
  };
};

export const loadState = () => {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createDefaultState();
    }

    return sanitizeState(JSON.parse(raw));
  } catch {
    return createDefaultState();
  }
};

export const saveState = (patch = {}) => {
  const current = loadState();
  const next = sanitizeState({
    ...current,
    ...patch,
    manualTime: patch.manualTime ? { ...current.manualTime, ...patch.manualTime } : current.manualTime
  });

  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    return next;
  }

  return next;
};

export const clearState = () => {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage errors and continue to redirect.
  }
};

export const showToast = (message, type = 'success') => {
  const toast = document.getElementById('toast');
  if (!toast) {
    return;
  }

  toast.textContent = message;
  toast.className = `toast ${type} show`;

  if (toast.dataset.timerId) {
    window.clearTimeout(Number(toast.dataset.timerId));
  }

  const timerId = window.setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);

  toast.dataset.timerId = String(timerId);
};

export const readPageMessage = () => {
  const params = new URLSearchParams(window.location.search);
  const message = params.get('message');
  if (!message) {
    return;
  }

  const type = params.get('type') || 'error';
  showToast(message, type);
  params.delete('message');
  params.delete('type');

  const search = params.toString();
  const nextUrl = `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`;
  window.history.replaceState({}, document.title, nextUrl);
};

export const redirectTo = (path, message, type = 'error') => {
  const url = new URL(path, window.location.href);
  if (message) {
    url.searchParams.set('message', message);
    url.searchParams.set('type', type);
  }
  window.location.replace(url.toString());
};

const STEP_PATHS = {
  1: 'index.html',
  2: 'time.html',
  3: 'qrcode.html'
};

export const initStepNavigation = (currentStep) => {
  const cards = Array.from(document.querySelectorAll('.step-card[data-step]'));
  if (!cards.length) {
    return;
  }

  const handleStepClick = (targetStep) => {
    if (targetStep < currentStep) {
      window.location.href = STEP_PATHS[targetStep];
      return;
    }

    if (targetStep > currentStep) {
      showToast('请先完成当前步骤', 'error');
    }
  };

  cards.forEach((card) => {
    const targetStep = Number.parseInt(card.dataset.step || '', 10);
    if (![1, 2, 3].includes(targetStep)) {
      return;
    }

    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `跳转到第 ${targetStep} 步`);

    if (targetStep < currentStep) {
      card.classList.add('is-clickable-back');
    } else if (targetStep > currentStep) {
      card.classList.add('is-locked-step');
    }

    card.addEventListener('click', () => handleStepClick(targetStep));
    card.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }
      event.preventDefault();
      handleStepClick(targetStep);
    });
  });
};

export const getIdentityLabel = (identity) => (
  identity === 'agent' ? 'AI代理（Agent）' : '人类（Human）'
);

const parseInteger = (value) => {
  if (value === '' || value === null || value === undefined) {
    return Number.NaN;
  }
  return Number.parseInt(String(value), 10);
};

export const buildTimestamp = (state) => {
  if (state.timeMode !== 'manual') {
    return Date.now() + 60 * 1000;
  }

  const year = parseInteger(state.manualTime.year);
  const month = parseInteger(state.manualTime.month);
  const day = parseInteger(state.manualTime.day);
  const hour = parseInteger(state.manualTime.hour);
  const minute = parseInteger(state.manualTime.minute);

  if ([year, month, day, hour, minute].some(Number.isNaN)) {
    throw new Error('请完整填写手动时间');
  }

  const date = new Date(year, month - 1, day, hour, minute);
  const isValid = date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day
    && date.getHours() === hour
    && date.getMinutes() === minute;

  if (!isValid) {
    throw new Error('手动时间格式错误（月1-12，日1-31，时0-23）');
  }

  return date.getTime();
};

export const formatDateTime = (timestamp) => {
  const date = new Date(timestamp);
  const pad = (value) => String(value).padStart(2, '0');

  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  ].join(' ');
};

export const getTimeModeLabel = (state) => {
  if (state.timeMode !== 'manual') {
    return '自动模式（生成时取当前时间 + 1 分钟）';
  }

  try {
    return `手动模式（${formatDateTime(buildTimestamp(state))}）`;
  } catch {
    return '手动模式';
  }
};

export const collectManualTime = () => ({
  year: safeString(document.getElementById('year') && document.getElementById('year').value),
  month: safeString(document.getElementById('month') && document.getElementById('month').value),
  day: safeString(document.getElementById('day') && document.getElementById('day').value),
  hour: safeString(document.getElementById('hour') && document.getElementById('hour').value),
  minute: safeString(document.getElementById('minute') && document.getElementById('minute').value)
});

export const fillManualTimeInputs = (manualTime) => {
  ['year', 'month', 'day', 'hour', 'minute'].forEach((id) => {
    const element = document.getElementById(id);
    if (element) {
      element.value = safeString(manualTime[id]);
    }
  });
};

export const bindCopyButton = (button, text = AGENT_PROMPT) => {
  if (!button) {
    return;
  }

  button.addEventListener('click', async () => {
    const originalText = button.textContent;

    try {
      await navigator.clipboard.writeText(text);
      button.textContent = '已复制!';
      button.disabled = true;
      showToast('复制成功！');

      window.setTimeout(() => {
        button.textContent = originalText;
        button.disabled = false;
      }, 1800);
    } catch {
      showToast('复制失败，请手动复制', 'error');
    }
  });
};

export const downloadFile = (href, filename) => {
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
};

export const parseErrorMessage = (rawText) => {
  if (!rawText) {
    return '生成失败';
  }

  try {
    const parsed = JSON.parse(rawText);
    if (parsed && typeof parsed.error === 'string' && parsed.error.trim()) {
      return parsed.error.trim();
    }
  } catch {
    // Ignore JSON parse failures and fall back to raw text.
  }

  return rawText.trim();
};
