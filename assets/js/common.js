/**
 * 県内企業DX推進統合イベント運営システム - 共通JS
 * フォームのバリデーションやメッセージ表示など、各画面で使い回すユーティリティをまとめる。
 */
const CommonUtils = {
  /** メールアドレスの形式を簡易チェックする。 */
  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  },

  /** 送信結果メッセージ(成功/失敗)を表示する。 */
  showMessage(container, type, text) {
    if (!container) return;
    container.textContent = text;
    container.className = 'form-message form-message--' + type;
    container.hidden = false;
    container.scrollIntoView({ behavior: 'smooth', block: 'center' });
  },

  /** メッセージ表示をクリアする。 */
  clearMessage(container) {
    if (!container) return;
    container.hidden = true;
    container.textContent = '';
    container.className = 'form-message';
  },

  /** 送信ボタンの活性・文言を切り替える(二重送信防止)。 */
  setLoading(button, isLoading, loadingText, defaultText) {
    if (!button) return;
    button.disabled = isLoading;
    button.textContent = isLoading ? loadingText : defaultText;
  },

  /**
   * メールアドレス入力欄からフォーカスが外れた際に、Mailcheck(CDN経由で読み込み)を使って
   * 「gmial.com」のようなよくあるドメインの打ち間違いを検知し、警告を表示する。
   * Mailcheckが読み込まれていない環境では何もしない(必須のバリデーションではないため)。
   *
   * @param {HTMLInputElement} inputEl メールアドレス入力欄
   * @param {HTMLElement} warningEl 警告文を表示する要素
   */
  attachEmailTypoCheck(inputEl, warningEl) {
    if (!inputEl || !warningEl || typeof Mailcheck === 'undefined') return;

    function hideWarning() {
      warningEl.hidden = true;
      warningEl.innerHTML = '';
    }

    inputEl.addEventListener('blur', function () {
      const email = inputEl.value.trim();
      if (email === '') {
        hideWarning();
        return;
      }

      Mailcheck.run({
        email: email,
        suggested: function (suggestion) {
          warningEl.hidden = false;
          warningEl.innerHTML = '';
          warningEl.appendChild(document.createTextNode('もしかして ' + suggestion.full + ' ではないですか? '));

          const applyBtn = document.createElement('button');
          applyBtn.type = 'button';
          applyBtn.className = 'link-button';
          applyBtn.textContent = 'この内容を使用する';
          applyBtn.addEventListener('click', function () {
            inputEl.value = suggestion.full;
            hideWarning();
            inputEl.dispatchEvent(new Event('input', { bubbles: true }));
          });
          warningEl.appendChild(applyBtn);
        },
        empty: hideWarning
      });
    });
  }
};
