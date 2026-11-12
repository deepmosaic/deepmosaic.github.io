<script>
  // 問い合わせフォーム (T-254、T-332 で 2 種類に、T-516 で general を 2 項目に)。
  //
  // 1 つの島で 2 つのページを賄う。どちらの項目立てにするかは `data-kind` で決まる:
  //
  //   kind="enterprise" (既定) … /enterprise/inquiry/  会社名・会社の Web ページ (任意)・氏名・メール・電話・
  //                                                    アカウント数・ご相談内容
  //   kind="general"            … /contact/            メール・お問い合わせ内容のみ (T-516 で氏名・件名・
  //                                                    ご利用中のバージョンを廃止)
  //
  // 送信先は worker-auth0-updater の `POST /inquiry` (T-253 / T-331) で**両者とも同じ**。
  // 設定 (endpoint / Turnstile のサイトキー / support 宛先) は Jekyll が `_data/inquiry.yml`
  // から data-* 属性で渡す。検証・正規化・失敗時の文面は
  // `src/lib/inquiry-validate.js` (純関数、node --test) に置き、ここは DOM / fetch /
  // Turnstile だけを担う。
  //
  // 状態は idle → submitting → done | error。**done は「閉じる」を押すまで消えない**
  // (送信できたことを見失わせない)。閉じると空のフォームに戻る。フォーム要素自体は
  // done の間も hidden で残す — Turnstile の widget を作り直さずに済む。
  //
  // Turnstile はサイトキーが空なら一切読み込まない (Worker 側も secret 未投入なら検証を
  // スキップする縮退運用、T-253)。キーがあるときだけ api.js を動的に読んで明示レンダーする。
  // トークンは 1 回きりなので、Worker まで届いた送信のたび (成否を問わず) widget を reset する。
  import { tick, untrack } from 'svelte';
  import {
    LIMITS,
    buildPayload,
    describeFailure,
    emptyFields,
    fieldNames,
    labelsFor,
    normalizeKind,
    validateInquiry,
  } from '../lib/inquiry-validate.js';
  // T-2206 (i18n1112 I18N-708): ページの言語は <html lang> から読む (W7-site.md §0-C)。
  // 項目名は labelsFor、検証・送信の失敗の文は inquiry-validate.js に言語を渡して選ぶ。送る内容 (buildPayload) は言語に依らない。
  import { pageLang, pick } from '../lib/site-lang.js';

  // 画面の文の 3 言語の表。ja は今の文字列のまま (既存の e2e が ja の文で探す)。
  // mailJaNote は英中だけ (確認のメール・返答は日本語で届く、設計書 §10.4)。ja は null で要素を出さない。
  const TEXT = {
    ja: {
      requiredNote: 'は必須項目です。',
      optional: '（任意）',
      emailHelp: '受付確認と返答はこのアドレス宛に届きます。',
      phoneHelp: '全角で入力しても送信時に半角へ変換します。',
      seatsHelp: (n) => `Enterprise は ${n} アカウント以上`,
      generalMessagePh: '発生した操作、画面に出たメッセージ、お困りの内容などをご記入ください',
      enterpriseMessagePh: '導入時期、対象となる映像の本数や尺、請求書払いのご希望、自社システムへの導入のご相談など',
      turnstileFailed:
        '認証部品 (Cloudflare Turnstile) を読み込めませんでした。広告ブロッカー等を一時的に無効にして、ページを再読み込みしてください。',
      checkInput: '入力内容をご確認ください。',
      turnstileLoadFailed: '認証部品を読み込めませんでした。ページを再読み込みしてもう一度お試しください。',
      turnstileWait: '認証の完了をお待ちください。表示されている認証が終わってから、もう一度「送信する」を押してください。',
      sendingLive: '送信しています。',
      receivedLive: 'お問い合わせを受け付けました。',
      doneTitle: '送信完了',
      doneBody: 'お問い合わせを受け付けました。3 営業日以内に担当者よりご返答いたします。',
      doneMailSent: 'ご入力のメールアドレス宛に受付確認メールをお送りしました。届かない場合は迷惑メールフォルダをご確認ください。',
      mailJaNote: null,
      close: '閉じる',
      sending: '送信しています…',
      submit: '送信する',
      usageNote: '送信内容は担当者からの連絡と返答のためにのみ使用します。',
      turnstileLanguage: 'ja',
    },
    en: {
      requiredNote: 'indicates a required field.',
      optional: '(optional)',
      emailHelp: 'We send the confirmation and our reply to this address.',
      phoneHelp: 'Full-width digits are converted automatically.',
      seatsHelp: (n) => `Enterprise requires ${n} or more accounts`,
      generalMessagePh: 'Describe what you did, any message shown on the screen, and the problem you are having',
      enterpriseMessagePh:
        'For example: when you plan to start, the number and length of the videos, whether you want to pay by invoice, or integrating it into your own system',
      turnstileFailed:
        "Couldn't load the verification widget (Cloudflare Turnstile). Turn off ad blockers or similar extensions for now, and reload the page.",
      checkInput: 'Check your entries.',
      turnstileLoadFailed: "Couldn't load the verification widget. Reload the page and try again.",
      turnstileWait: 'Wait for verification to finish. After the verification shown here is complete, select "Submit" again.',
      sendingLive: 'Submitting your inquiry.',
      receivedLive: "We've received your inquiry.",
      doneTitle: 'Submitted',
      doneBody: "We've received your inquiry. Our staff will reply within 3 business days (Japan).",
      doneMailSent: "We've sent a confirmation email to the address you entered. If it doesn't arrive, check your spam folder.",
      mailJaNote: 'The confirmation email is in Japanese.',
      close: 'Close',
      sending: 'Submitting…',
      submit: 'Submit',
      usageNote: 'We use the information you submit only to contact you and reply to your inquiry.',
      turnstileLanguage: 'en',
    },
    'zh-tw': {
      requiredNote: '為必填欄位。',
      optional: '（選填）',
      emailHelp: '受理確認與回覆將寄送至此地址。',
      phoneHelp: '全形數字會自動轉換為半形。',
      seatsHelp: (n) => `Enterprise 需 ${n} 個以上的帳號`,
      generalMessagePh: '請描述您進行的操作、畫面上顯示的訊息，以及遇到的問題',
      enterpriseMessagePh: '例如：預計導入的時間、目標影片的數量與長度、是否希望以請款單付款、導入自家系統的諮詢等',
      turnstileFailed: '無法載入驗證元件（Cloudflare Turnstile）。請暫時停用廣告封鎖程式等擴充功能，然後重新載入頁面。',
      checkInput: '請確認輸入的內容。',
      turnstileLoadFailed: '無法載入驗證元件。請重新載入頁面後再試一次。',
      turnstileWait: '請等待驗證完成。畫面上的驗證完成後，請再按一次「送出」。',
      sendingLive: '正在送出。',
      receivedLive: '已收到您的詢問。',
      doneTitle: '已送出',
      doneBody: '已收到您的詢問。負責人員將於 3 個工作天內（以日本的工作天計算）回覆您。',
      doneMailSent: '我們已寄送受理確認信至您輸入的電子郵件地址。若未收到，請檢查垃圾郵件資料夾。',
      mailJaNote: '確認電子郵件為日文。',
      close: '關閉',
      sending: '送出中…',
      submit: '送出',
      usageNote: '您送出的內容僅用於負責人員與您聯絡及回覆。',
      turnstileLanguage: 'zh-tw',
    },
  };
  const lang = pageLang();
  const T = pick(TEXT, lang);

  let { endpoint = '', turnstileSiteKey = '', supportEmail = '', kind = 'enterprise' } = $props();

  /** `data-kind` の書き間違いは enterprise に倒す (純関数側と同じ規則)。 */
  const formKind = $derived(normalizeKind(kind));
  const isGeneral = $derived(formKind === 'general');
  /** 画面の項目名 (言語 × kind)。ja は inquiry-validate.js の FIELD_LABELS / GENERAL_LABELS (今の文字列) */
  const L = $derived(labelsFor(formKind, lang));
  /**
   * 英中だけ本文の placeholder を上書きする (後に書いた spread が勝つ)。ja の placeholder は既存のテスト (site-copy-t1941) が
   * 属性の literal を読むので、textarea に literal のまま残す。
   */
  const messagePlaceholder = $derived(
    lang === 'ja' ? {} : { placeholder: isGeneral ? T.generalMessagePh : T.enterpriseMessagePh },
  );
  /** 誤りがあったときに最初の項目へフォーカスする順 (= 画面の上から下)。 */
  const keys = $derived(fieldNames(formKind));

  const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com';
  const TURNSTILE_SRC = `${TURNSTILE_ORIGIN}/turnstile/v0/api.js?render=explicit`;

  // 島は data-* から **1 度だけ** マウントされ props は後から変わらないので、初期値を作る
  // ときに `kind` を読むのは意図どおり。`untrack` で包んでいるのは Svelte の
  // `state_referenced_locally` 警告を消すため — ビルドログに警告を残すと、本物の
  // 取りこぼしが埋もれる。
  let fields = $state(emptyFields(untrack(() => kind)));
  /** @type {'idle' | 'submitting' | 'done' | 'error'} */
  let status = $state('idle');
  let errorMessage = $state('');
  /** @type {Record<string, string>} */
  let fieldErrors = $state({});
  /** Worker がお礼メールを送れたか (`mail: true`)。送信完了パネルの文面に使う */
  let mailSent = $state(false);
  /** スクリーンリーダー向けの進捗 (role=status)。エラーは role=alert 側が読むので入れない */
  let liveText = $state('');

  let turnstileToken = $state('');
  /** widget の状態。サイトキーが空のときは参照されない (widget を描画しない) */
  /** @type {'loading' | 'ready' | 'failed'} */
  let turnstileState = $state('loading');
  /** @type {HTMLElement | null} */
  let turnstileEl = $state(null);
  /** @type {string | null} */
  let widgetId = null;

  /** @type {HTMLFormElement | null} */
  let formEl = $state(null);
  /** @type {HTMLElement | null} */
  let doneEl = $state(null);

  // 見た目は Tailwind ユーティリティ + src/app.css のトークンだけ (生ヘックス禁止)
  const LABEL = 'mb-1.5 block text-[13.5px] font-bold text-ink-body';
  const INPUT =
    'w-full rounded-lg border bg-surface px-3.5 py-2.5 text-[14.5px] text-ink placeholder:text-ink-4 transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30';
  const HELP = 'mt-1.5 text-[12.5px] leading-[1.8] text-ink-4';
  const ERROR = 'mt-1.5 text-[12.5px] leading-[1.8] text-danger';

  const inputClass = (key) => `${INPUT} ${fieldErrors[key] ? 'border-danger' : 'border-edge'}`;
  const describedBy = (key, hasHelp) =>
    [hasHelp ? `inq-${key}-help` : null, fieldErrors[key] ? `inq-${key}-error` : null]
      .filter(Boolean)
      .join(' ') || undefined;
  const invalid = (key) => (fieldErrors[key] ? 'true' : undefined);

  function focusField(key) {
    formEl?.querySelector(`#inq-${key}`)?.focus();
  }

  // ── Turnstile ─────────────────────────────────────────────────────────────

  /** api.js を 1 度だけ読み込む。既に読み込み済み / 読み込み中なら相乗りする。 */
  function loadTurnstile() {
    return new Promise((resolve, reject) => {
      if (window.turnstile) {
        resolve(window.turnstile);
        return;
      }
      let script = document.querySelector(`script[src^="${TURNSTILE_ORIGIN}/turnstile/"]`);
      if (!script) {
        script = document.createElement('script');
        script.src = TURNSTILE_SRC;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
      script.addEventListener(
        'load',
        () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile missing'))),
        { once: true },
      );
      script.addEventListener('error', () => reject(new Error('turnstile script failed')), { once: true });
    });
  }

  $effect(() => {
    const el = turnstileEl;
    if (!turnstileSiteKey || !el) return;
    let cancelled = false;
    loadTurnstile()
      .then((turnstile) => {
        if (cancelled) return;
        widgetId = turnstile.render(el, {
          sitekey: turnstileSiteKey,
          theme: 'auto',
          language: T.turnstileLanguage,
          callback: (token) => {
            turnstileToken = token;
            turnstileState = 'ready';
          },
          'expired-callback': () => {
            turnstileToken = '';
          },
          'error-callback': () => {
            turnstileToken = '';
            turnstileState = 'failed';
          },
        });
        turnstileState = 'ready';
      })
      .catch(() => {
        if (!cancelled) turnstileState = 'failed';
      });
    return () => {
      cancelled = true;
      if (widgetId !== null) {
        try {
          window.turnstile?.remove(widgetId);
        } catch {
          /* 既に消えている */
        }
        widgetId = null;
      }
    };
  });

  /** トークンは 1 回きり。送信が Worker まで届いたら成否を問わず取り直す。 */
  function resetTurnstile() {
    turnstileToken = '';
    if (widgetId === null) return;
    try {
      window.turnstile?.reset(widgetId);
    } catch {
      /* widget が壊れていても送信結果の表示は続ける */
    }
  }

  // ── 送信 ──────────────────────────────────────────────────────────────────

  function showError(message, errors = {}) {
    errorMessage = message;
    fieldErrors = errors;
    status = 'error';
  }

  async function submit(event) {
    event.preventDefault();
    if (status === 'submitting') return;

    const result = validateInquiry(fields, formKind, lang);
    if (!result.ok) {
      showError(T.checkInput, result.errors);
      const first = keys.find((key) => result.errors[key]);
      if (first) focusField(first);
      return;
    }
    if (turnstileSiteKey && turnstileToken === '') {
      showError(
        turnstileState === 'failed' ? T.turnstileLoadFailed : T.turnstileWait,
      );
      return;
    }

    errorMessage = '';
    fieldErrors = {};
    status = 'submitting';
    liveText = T.sendingLive;

    const payload = buildPayload(result.fields, turnstileToken, formKind);
    let outcome;
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      outcome = { status: res.status, data };
    } catch {
      outcome = { status: 0, data: null };
    }
    if (outcome.status !== 0) resetTurnstile();

    if (outcome.status === 200 && outcome.data?.ok === true) {
      mailSent = outcome.data.mail === true;
      status = 'done';
      liveText = T.receivedLive;
      await tick();
      doneEl?.focus();
      return;
    }

    liveText = '';
    const failure = describeFailure(outcome, { supportEmail, lang });
    // `describeFailure` が返す項目名は**全 kind の和集合**。この kind で描画していない項目
    // (例: Worker を T-331 より前に巻き戻すと、general の送信にも「会社名を入力して…」が
    // 返る。T-516 の Worker 側が本番に出る前にこのサイトを出すと「氏名を入力して…」が返る)
    // を fieldErrors に入れると、どこにも表示されないまま汎用の一文だけが出て
    // 手詰まりになる。描画していない項目のときは Worker の文面をそのまま警告に出す。
    // 英中の invalid の文は欄の汎用の文 (Worker の日本語の文面は出さない) なので、欄に紐づかないときは全体の案内にする (T-2206)。
    if (failure.kind === 'invalid' && failure.field && keys.includes(failure.field)) {
      showError(T.checkInput, { [failure.field]: failure.message });
      focusField(failure.field);
    } else {
      showError(failure.kind === 'invalid' && lang !== 'ja' ? T.checkInput : failure.message);
    }
  }

  /** 送信完了パネルを閉じて空のフォームに戻す。ここでしか完了表示は消えない。 */
  async function closeDone() {
    fields = emptyFields(formKind);
    fieldErrors = {};
    errorMessage = '';
    mailSent = false;
    liveText = '';
    status = 'idle';
    resetTurnstile();
    await tick();
    focusField(keys[0]);
  }
</script>

<p class="sr-only" role="status" aria-live="polite">{liveText}</p>

{#if status === 'done'}
  <div class="card-hi p-6 sm:p-8" bind:this={doneEl} tabindex="-1">
    <h2 class="text-[18px] font-bold text-hi-ink">{T.doneTitle}</h2>
    <p class="mt-2 text-[14.5px] leading-[1.9] text-hi-ink-2">
      {T.doneBody}
    </p>
    {#if mailSent}
      <p class="mt-2 text-[13px] leading-[1.9] text-hi-ink-3">
        {T.doneMailSent}
      </p>
    {/if}
    {#if T.mailJaNote}
      <p class="mt-2 text-[13px] leading-[1.9] text-hi-ink-3">{T.mailJaNote}</p>
    {/if}
    <button type="button" class="btn-secondary mt-5" onclick={closeDone}>{T.close}</button>
  </div>
{/if}

<form
  bind:this={formEl}
  class="card relative p-6 sm:p-8"
  novalidate
  hidden={status === 'done'}
  aria-busy={status === 'submitting'}
  onsubmit={submit}
>
  <p class="text-[13px] text-ink-4"><span class="text-danger" aria-hidden="true">*</span> {T.requiredNote}</p>

  <div class="mt-5 grid gap-5 sm:grid-cols-2">
    {#if !isGeneral}
      <div class="sm:col-span-2">
        <label for="inq-company" class={LABEL}>{L.company}<span class="ml-1 text-danger" aria-hidden="true">*</span></label>
        <input
          id="inq-company"
          name="company"
          type="text"
          class={inputClass('company')}
          bind:value={fields.company}
          required
          autocomplete="organization"
          maxlength={LIMITS.company}
          aria-invalid={invalid('company')}
          aria-describedby={describedBy('company', false)}
        />
        {#if fieldErrors.company}<p id="inq-company-error" class={ERROR}>{fieldErrors.company}</p>{/if}
      </div>

      <!-- 会社の Web ページ (T-1958、任意)。欄の名前は companyUrl (`website` はハニーポット)。
           フォームは novalidate なので、形式の検査は inquiry-validate.js の自前の規則 (Worker の写し) -->
      <div class="sm:col-span-2">
        <label for="inq-companyUrl" class={LABEL}>
          {L.companyUrl}<span class="ml-1 text-[12px] font-normal text-ink-4">{T.optional}</span>
        </label>
        <input
          id="inq-companyUrl"
          name="companyUrl"
          type="url"
          class={inputClass('companyUrl')}
          bind:value={fields.companyUrl}
          autocomplete="url"
          inputmode="url"
          maxlength={LIMITS.companyUrl}
          placeholder="https://example.co.jp"
          aria-invalid={invalid('companyUrl')}
          aria-describedby={describedBy('companyUrl', false)}
        />
        {#if fieldErrors.companyUrl}<p id="inq-companyUrl-error" class={ERROR}>{fieldErrors.companyUrl}</p>{/if}
      </div>

      <div>
        <label for="inq-name" class={LABEL}>{L.name}<span class="ml-1 text-danger" aria-hidden="true">*</span></label>
        <input
          id="inq-name"
          name="name"
          type="text"
          class={inputClass('name')}
          bind:value={fields.name}
          required
          autocomplete="name"
          maxlength={LIMITS.name}
          aria-invalid={invalid('name')}
          aria-describedby={describedBy('name', false)}
        />
        {#if fieldErrors.name}<p id="inq-name-error" class={ERROR}>{fieldErrors.name}</p>{/if}
      </div>
    {/if}

    <!-- general は氏名の隣が空くので (T-516)、メールアドレスを 1 行ぶん使う -->
    <div class={isGeneral ? 'sm:col-span-2' : undefined}>
      <label for="inq-email" class={LABEL}>{L.email}<span class="ml-1 text-danger" aria-hidden="true">*</span></label>
      <input
        id="inq-email"
        name="email"
        type="email"
        class={inputClass('email')}
        bind:value={fields.email}
        required
        autocomplete="email"
        inputmode="email"
        maxlength={LIMITS.email}
        aria-invalid={invalid('email')}
        aria-describedby={describedBy('email', true)}
      />
      <p id="inq-email-help" class={HELP}>{T.emailHelp}</p>
      {#if fieldErrors.email}<p id="inq-email-error" class={ERROR}>{fieldErrors.email}</p>{/if}
    </div>

    {#if !isGeneral}
      <div>
        <label for="inq-phone" class={LABEL}>{L.phone}<span class="ml-1 text-danger" aria-hidden="true">*</span></label>
        <input
          id="inq-phone"
          name="phone"
          type="tel"
          class={inputClass('phone')}
          bind:value={fields.phone}
          required
          autocomplete="tel"
          inputmode="tel"
          maxlength={LIMITS.phoneMax}
          placeholder="03-1234-5678"
          aria-invalid={invalid('phone')}
          aria-describedby={describedBy('phone', true)}
        />
        <p id="inq-phone-help" class={HELP}>{T.phoneHelp}</p>
        {#if fieldErrors.phone}<p id="inq-phone-error" class={ERROR}>{fieldErrors.phone}</p>{/if}
      </div>

      <div>
        <label for="inq-seats" class={LABEL}>{L.seats}<span class="ml-1 text-danger" aria-hidden="true">*</span></label>
        <input
          id="inq-seats"
          name="seats"
          type="number"
          class={inputClass('seats')}
          bind:value={fields.seats}
          required
          min={LIMITS.seatsMin}
          max={LIMITS.seatsMax}
          step="1"
          inputmode="numeric"
          aria-invalid={invalid('seats')}
          aria-describedby={describedBy('seats', true)}
        />
        <p id="inq-seats-help" class={HELP}>{T.seatsHelp(LIMITS.seatsMin)}</p>
        {#if fieldErrors.seats}<p id="inq-seats-error" class={ERROR}>{fieldErrors.seats}</p>{/if}
      </div>
    {/if}

    <div class="sm:col-span-2">
      <label for="inq-message" class={LABEL}>
        {L.message}
        {#if isGeneral}
          <span class="ml-1 text-danger" aria-hidden="true">*</span>
        {:else}
          <span class="ml-1 text-[12px] font-normal text-ink-4">{T.optional}</span>
        {/if}
      </label>
      <textarea
        id="inq-message"
        name="message"
        rows="6"
        class={inputClass('message')}
        bind:value={fields.message}
        maxlength={LIMITS.message}
        placeholder={isGeneral
          ? '発生した操作、画面に出たメッセージ、お困りの内容などをご記入ください'
          : '導入時期、対象となる映像の本数や尺、請求書払いのご希望、自社システムへの導入のご相談など'}
        {...messagePlaceholder}
        aria-invalid={invalid('message')}
        aria-describedby={describedBy('message', false)}
      ></textarea>
      {#if fieldErrors.message}<p id="inq-message-error" class={ERROR}>{fieldErrors.message}</p>{/if}
    </div>

    {#if turnstileSiteKey}
      <div class="sm:col-span-2">
        <div bind:this={turnstileEl}></div>
        {#if turnstileState === 'failed'}
          <p class={ERROR}>
            {T.turnstileFailed}
          </p>
        {/if}
      </div>
    {/if}
  </div>

  <!-- ハニーポット (T-253)。人には見えず、フォーカスも当たらない。埋まっていれば Worker が
       副作用なしの 200 を返す。`sr-only` はスクリーンリーダーが読むので使わない -->
  <div class="absolute -left-[9999px] top-0 h-px w-px overflow-hidden" aria-hidden="true">
    <label for="inq-website">Website</label>
    <input id="inq-website" name="website" type="text" tabindex="-1" autocomplete="off" bind:value={fields.website} />
  </div>

  {#if status === 'error' && errorMessage}
    <div role="alert" class="mt-5 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-[13.5px] leading-[1.8] text-ink">
      {errorMessage}
    </div>
  {/if}

  <div class="mt-6 flex flex-wrap items-center gap-4">
    <button type="submit" class="btn-primary btn-lg" disabled={status === 'submitting'}>
      {status === 'submitting' ? T.sending : T.submit}
    </button>
    <p class="text-[12.5px] leading-[1.8] text-ink-4">{T.usageNote}</p>
  </div>
</form>
