import {
  AGENT_PROMPT,
  bindCopyButton,
  initStepNavigation,
  loadState,
  readPageMessage,
  saveState,
  showToast,
  validateCourseUrl
} from './wizard.js';

document.addEventListener('DOMContentLoaded', () => {
  readPageMessage();

  const state = loadState();
  const identityButtons = Array.from(document.querySelectorAll('.identity-btn'));
  const humanContent = document.getElementById('humanContent');
  const agentContent = document.getElementById('agentContent');
  const urlInput = document.getElementById('urlInput');
  const nextBtn = document.getElementById('nextBtn');
  initStepNavigation(1);
  let selectedIdentity = '';

  const applyIdentity = (identity, { persist = true } = {}) => {
    const nextIdentity = identity === 'agent' || identity === 'human' ? identity : '';
    selectedIdentity = nextIdentity;
    identityButtons.forEach((button) => {
      button.classList.toggle('active', button.dataset.identity === nextIdentity);
    });
    humanContent.hidden = nextIdentity !== 'human';
    agentContent.hidden = nextIdentity !== 'agent';
    if (persist) {
      saveState({ identity: nextIdentity });
    }
  };

  const setNextButtonDisabled = (isDisabled) => {
    nextBtn.classList.toggle('is-disabled', isDisabled);
    nextBtn.setAttribute('aria-disabled', String(isDisabled));
  };

  const syncNextButtonState = () => {
    setNextButtonDisabled(!urlInput.value.trim());
  };

  urlInput.value = state.url;
  applyIdentity(state.identity, { persist: false });
  syncNextButtonState();

  identityButtons.forEach((button) => {
    button.addEventListener('click', () => applyIdentity(button.dataset.identity));
  });

  document.querySelectorAll('.agent-link').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      applyIdentity('agent');
    });
  });

  bindCopyButton(document.getElementById('copyAgentText'), AGENT_PROMPT);

  urlInput.addEventListener('input', () => {
    saveState({ url: urlInput.value.trim() });
    syncNextButtonState();
  });

  nextBtn.addEventListener('click', () => {
    if (!selectedIdentity) {
      showToast('请先选择身份（人类或AI代理）', 'error');
      return;
    }

    const url = urlInput.value.trim();
    const validation = validateCourseUrl(url);
    if (!validation.valid) {
      showToast(validation.message, 'error');
      urlInput.focus();
      return;
    }

    saveState({ url, identity: selectedIdentity });
    window.location.href = 'time.html';
  });
});
