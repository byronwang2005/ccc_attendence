import {
  AGENT_PROMPT,
  bindCopyButton,
  initStepNavigation,
  loadState,
  readPageMessage,
  saveState,
  showToast
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

  const applyIdentity = (identity) => {
    const nextIdentity = identity === 'agent' ? 'agent' : 'human';
    identityButtons.forEach((button) => {
      button.classList.toggle('active', button.dataset.identity === nextIdentity);
    });
    humanContent.hidden = nextIdentity !== 'human';
    agentContent.hidden = nextIdentity !== 'agent';
    saveState({ identity: nextIdentity });
  };

  const setNextButtonDisabled = (isDisabled) => {
    nextBtn.classList.toggle('is-disabled', isDisabled);
    nextBtn.setAttribute('aria-disabled', String(isDisabled));
  };

  const syncNextButtonState = () => {
    setNextButtonDisabled(!urlInput.value.trim());
  };

  urlInput.value = state.url;
  applyIdentity(state.identity);
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
    const url = urlInput.value.trim();
    if (!url) {
      showToast('请先完成当前步骤', 'error');
      urlInput.focus();
      return;
    }

    saveState({ url });
    window.location.href = 'time.html';
  });
});
