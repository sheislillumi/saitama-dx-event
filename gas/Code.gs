/**
 * ==========================================================================
 * 県内企業DX推進統合イベント運営システム - GAS バックエンド (gas/Code.gs)
 * ==========================================================================
 *
 * 【このファイルの使い方】
 * このリポジトリの gas/Code.gs はソース管理用のコピーです。
 * 実際に動かすには、Google スプレッドシート側の Apps Script エディタに
 * このファイルの内容をそのまま貼り付けてください(下記セットアップ手順を参照)。
 *
 * ==========================================================================
 * 【スプレッドシートのセットアップ手順】
 * ==========================================================================
 * 1. Google スプレッドシートを新規作成する(例: 「DX展示会イベント_DB」)。
 * 2. メニューから [拡張機能] > [Apps Script] を開く。
 * 3. デフォルトの Code.gs の中身を全て削除し、このファイルの内容を貼り付ける。
 * 4. Apps Script エディタの関数選択ドロップダウンで `setupSheets` を選び、
 *    [実行] ボタンを押す(初回は権限の承認が必要)。
 *    → 以下の3シートが自動作成され、見出し行が設定される。
 *
 *   ■ シート「Exhibitors」(出展者) の列見出し(A列〜L列)
 *     ID | 申込日時 | 会社名 | 担当者名 | メールアドレス | 電話番号 |
 *     希望カテゴリ | 展示内容概要 | 電源要否 | 搬入出希望時間 | ステータス | 備考
 *
 *   ■ シート「Visitors」(来場者) の列見出し(A列〜N列)
 *     ID | QRトークン | 申込日時 | 氏名 | 会社名 | 部署役職 | メールアドレス |
 *     電話番号 | 業種 | 関心カテゴリ | 同伴者数 | チェックイン状態 |
 *     チェックイン日時 | 受付場所
 *
 *   ■ シート「Survey」(アンケート・任意) の列見出し(A列〜D列)
 *     ID | 来場者ID | 満足度 | 自由記述
 *
 *   ■ シート「ErrorLog」(QRコード生成・確認メール送信のエラー記録用) の列見出し(A列〜F列)
 *     日時 | 種別 | 来場者ID | QRトークン | メールアドレス | エラー内容
 *     (registerVisitor_ でのQRコード画像取得・メール送信失敗時に自動で1行追記される。
 *      来場者登録自体はここでのエラーでは失敗させない設計のため、運用時はこのシートを
 *      定期的に確認し、送信できなかった来場者に個別フォローすること)
 *
 *    ※ 手動でシートを作る場合は、シート名・列見出し・列の並び順を上記と
 *      完全に一致させること(本スクリプトは見出し名でセルを解決している)。
 *
 * 5. [プロジェクトの設定](歯車アイコン) > [スクリプト プロパティ] で、
 *    以下のプロパティを追加する。
 *      - ADMIN_API_KEY : 管理系API(getVisitors/getExhibitors/getStats)を
 *                        呼び出す際に必要な簡易APIキー。推測されにくい
 *                        ランダム文字列を設定すること。
 *    (このスクリプトをスプレッドシートに紐づく形(コンテナバインド)で
 *     作成している場合、SPREADSHEET_ID の設定は不要。もしスタンドアロンの
 *     Apps Script プロジェクトとして使う場合は、対象スプレッドシートの
 *     IDを SPREADSHEET_ID プロパティにも追加すること)
 *
 * ==========================================================================
 * 【Web App としてのデプロイ手順】(詳細は README.md にも記載)
 * ==========================================================================
 * 1. Apps Script エディタ右上の [デプロイ] > [新しいデプロイ] を選択。
 * 2. 種類の選択で歯車アイコン > [ウェブアプリ] を選ぶ。
 * 3. 「次のユーザーとして実行」: 自分(Me)
 *    「アクセスできるユーザー」: 全員(Anyone)
 *    ※ 個人情報を扱うため、実運用ではアクセス制限や認証強化を再検討すること。
 * 4. [デプロイ] をクリックし、発行された「ウェブアプリのURL」を控える。
 *    → このURLを assets/js/api-client.js の GAS_API_URL に設定する(フェーズ2)。
 * 5. コードを変更した場合は、[デプロイ] > [デプロイを管理] から
 *    既存デプロイを編集し、新しいバージョンを作成しないとURLに反映されない点に注意。
 * 6. QRコード生成(UrlFetchApp による外部サービス api.qrserver.com への通信)と
 *    確認メール送信(GmailApp)を追加したため、初回実行時に新たに「外部サービスへの
 *    接続」「メールの送信」の権限承認を求められる。承認しないとQRコード生成・メール
 *    送信が失敗する(その場合も来場者登録自体は失敗しない設計だが、ErrorLogシートに
 *    エラーが記録され続けるため、必ず承認しておくこと)。
 *
 * ==========================================================================
 * 【GASエディタ上でのテスト方法】
 * ==========================================================================
 * ローカル実行ができないため、下部の test_xxx() 関数を Apps Script エディタの
 * 関数選択ドロップダウンから選んで [実行] し、[実行数] ログ (Logger.log の内容)
 * を確認することで動作確認を行う。
 * また、Web App デプロイ後は以下のような curl / ブラウザURLでも動作確認できる。
 *
 *   GET (集計取得):
 *     https://script.google.com/macros/s/xxxxx/exec?action=getStats&apiKey=xxxx
 *
 *   POST (来場者登録) ※ curl 例:
 *     curl -X POST "https://script.google.com/macros/s/xxxxx/exec" ^
 *       -H "Content-Type: text/plain" ^
 *       -d "{\"action\":\"registerVisitor\",\"name\":\"埼玉太郎\",\"companyName\":\"サンプル株式会社\",\"email\":\"taro@example.com\",\"phone\":\"090-1111-2222\",\"agreement\":true}"
 *
 * ==========================================================================
 */

// ==========================================================================
// 設定・定数
// ==========================================================================

var SHEET_NAMES = {
  EXHIBITORS: 'Exhibitors',
  VISITORS: 'Visitors',
  SURVEY: 'Survey',
  ERROR_LOG: 'ErrorLog'
};

// スプレッドシートの列見出し(「4. データスキーマ」に準拠、この並び順でシートに書き込む)
var EXHIBITOR_HEADERS = [
  'ID', '申込日時', '会社名', '担当者名', 'メールアドレス', '電話番号',
  '希望カテゴリ', '展示内容概要', '電源要否', '搬入出希望時間', 'ステータス', '備考'
];

var VISITOR_HEADERS = [
  'ID', 'QRトークン', '申込日時', '氏名', '会社名', '部署役職', 'メールアドレス',
  '電話番号', '業種', '関心カテゴリ', '同伴者数', 'チェックイン状態',
  'チェックイン日時', '受付場所'
];

var SURVEY_HEADERS = ['ID', '来場者ID', '満足度', '自由記述'];

// QRコード生成・確認メール送信のエラーを記録するシート(registerVisitor_ 参照)
var ERROR_LOG_HEADERS = ['日時', '種別', '来場者ID', 'QRトークン', 'メールアドレス', 'エラー内容'];

var EXHIBITOR_STATUS_DEFAULT = '申請中';
var VISITOR_CHECKIN_STATUS_NONE = '未';
var VISITOR_CHECKIN_STATUS_DONE = '済';

// QRコード生成サービス(APIキー不要、Google Chart APIは廃止済みのため使用しない)
var QR_CODE_API_URL = 'https://api.qrserver.com/v1/create-qr-code/';

// 来場者向けマイページ(mypage/visitor/index.html)のベースURL。
// 確認メールには、末尾に QRトークンを ?token=xxx として付与したURLを記載する。
var VISITOR_MYPAGE_BASE_URL = 'https://sheislillumi.github.io/saitama-dx-event/mypage/visitor/';

// 確認メールに記載するイベント基本情報
var EVENT_INFO = {
  NAME: '県内企業DX推進統合イベント',
  DATE_TEXT: '令和9年(2027年)1月20日(水) 10:00〜17:00',
  VENUE: 'ソニックシティ B1F 第2〜5展示場'
};


// ==========================================================================
// エントリーポイント (doGet / doPost)
// ==========================================================================

/**
 * GET リクエストの窓口。action パラメータで分岐する。
 * 対応 action: getVisitors, getExhibitors, getStats (いずれも要APIキー)、
 *             getVisitorByToken (来場者本人向けマイページ用、APIキー不要)
 */
function doGet(e) {
  return handleRequest_(e, ['getVisitors', 'getExhibitors', 'getStats', 'getVisitorByToken']);
}

/**
 * POST リクエストの窓口。action パラメータで分岐する。
 * 対応 action: registerExhibitor, registerVisitor, checkin
 */
function doPost(e) {
  return handleRequest_(e, ['registerExhibitor', 'registerVisitor', 'checkin']);
}

/**
 * doGet/doPost 共通のディスパッチ処理。
 * @param {Object} e GASのイベントオブジェクト
 * @param {string[]} allowedActions この呼び出し元(GET/POST)で許可するaction一覧
 */
function handleRequest_(e, allowedActions) {
  var params = parseParams_(e);
  var action = params.action;

  try {
    if (!action) {
      return jsonResponse_(errorResult_('missing_action', 'action パラメータが指定されていません。'));
    }
    if (allowedActions.indexOf(action) === -1) {
      return jsonResponse_(errorResult_('unknown_action', '不明な action、またはこのHTTPメソッドでは使用できない action です: ' + action));
    }

    switch (action) {
      case 'registerExhibitor':
        return jsonResponse_(registerExhibitor_(params));
      case 'registerVisitor':
        return jsonResponse_(registerVisitor_(params));
      case 'checkin':
        return jsonResponse_(checkin_(params));
      case 'getVisitors':
        return jsonResponse_(withAdminAuth_(params, getVisitors_));
      case 'getExhibitors':
        return jsonResponse_(withAdminAuth_(params, getExhibitors_));
      case 'getStats':
        return jsonResponse_(withAdminAuth_(params, getStats_));
      case 'getVisitorByToken':
        return jsonResponse_(getVisitorByToken_(params));
      default:
        return jsonResponse_(errorResult_('unknown_action', '不明な action です: ' + action));
    }
  } catch (err) {
    return jsonResponse_(errorResult_('internal_error', err && err.message ? err.message : String(err)));
  }
}


// ==========================================================================
// action ハンドラ: 出展申込
// ==========================================================================

/**
 * 出展申込を登録する。
 * 必須パラメータ: companyName, contactName, email, phone, category
 * 任意パラメータ: description, powerNeeded, loadingTime, notes
 */
function registerExhibitor_(params) {
  var missing = requireFields_(params, ['companyName', 'contactName', 'email', 'phone', 'category']);
  if (missing.length > 0) {
    return errorResult_('validation_error', '必須項目が不足しています: ' + missing.join(', '));
  }
  if (!isValidEmail_(params.email)) {
    return errorResult_('validation_error', 'メールアドレスの形式が不正です。');
  }

  // 数値化(先頭0の欠落)を防ぐため、できるだけ早い段階で明示的に文字列化しておく。
  var phone = String(params.phone);

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = getSheet_(SHEET_NAMES.EXHIBITORS);
    var id = generateId_();
    var record = {
      'ID': id,
      '申込日時': nowString_(),
      '会社名': params.companyName,
      '担当者名': params.contactName,
      'メールアドレス': params.email,
      '電話番号': phone,
      '希望カテゴリ': params.category,
      '展示内容概要': params.description || '',
      '電源要否': params.powerNeeded || '',
      '搬入出希望時間': params.loadingTime || '',
      'ステータス': EXHIBITOR_STATUS_DEFAULT,
      '備考': params.notes || ''
    };
    appendRecord_(sheet, EXHIBITOR_HEADERS, record);

    // 出展申請受付の確認メール送信。失敗しても出展申込登録自体は失敗させない
    // (sendExhibitorConfirmationEmail_ 内部で例外を握りつぶし ErrorLog シートに記録する
    // 設計だが、念のためここでも try/catch する。sendVisitorConfirmationEmail_ と同じ方針)。
    try {
      sendExhibitorConfirmationEmail_(id, params.contactName, params.email, params.companyName, params.category);
    } catch (err) {
      logError_('出展申請確認メール送信', id, '', params.email, err && err.message ? err.message : String(err));
    }

    return successResult_({ id: id });
  } finally {
    lock.releaseLock();
  }
}


// ==========================================================================
// 出展申込確認メール送信(registerExhibitor_ から呼び出される)
// ==========================================================================

/**
 * 出展者へ「申請受付」の確認メールを送信する。
 * 来場者向け(sendVisitorConfirmationEmail_)と同じ設計方針を踏襲するが、出展者は
 * まだ選定前のためQRコードは付与しない。送信に失敗しても例外を投げず、ErrorLogシートに
 * 記録するのみに留める(呼び出し元の出展申込登録処理を失敗させないための設計)。
 */
function sendExhibitorConfirmationEmail_(exhibitorId, contactName, email, companyName, category) {
  try {
    var subject = '【' + EVENT_INFO.NAME + '】出展申請を受け付けました';
    GmailApp.sendEmail(email, subject, buildExhibitorConfirmationEmailPlainText_(contactName, companyName, category), {
      htmlBody: buildExhibitorConfirmationEmailHtml_(contactName, companyName, category),
      name: EVENT_INFO.NAME + ' 事務局'
    });
  } catch (err) {
    // ErrorLogシートの「来場者ID」列は、出展者IDの記録にも流用している(出展者専用の列は
    // 用意していないため。QRトークン列は該当がないため空文字とする)。
    logError_('出展申請確認メール送信', exhibitorId, '', email, err && err.message ? err.message : String(err));
  }
}

/**
 * 出展申請確認メールのHTML本文を組み立てる。
 * 「申請受付」であり選定確定ではないことを明記し、選定は委託者が行う旨を記載する。
 */
function buildExhibitorConfirmationEmailHtml_(contactName, companyName, category) {
  return (
    '<div style="font-family: sans-serif; line-height: 1.7; color: #1f2933;">' +
    '<p>' + escapeHtml_(companyName) + ' ' + escapeHtml_(contactName) + ' 様</p>' +
    '<p>' + EVENT_INFO.NAME + ' への出展申請をいただき、誠にありがとうございます。<br />' +
    '以下の内容で申請を受け付けました。</p>' +
    '<table style="border-collapse: collapse; margin: 1em 0;">' +
    '<tr><td style="padding: 4px 12px 4px 0; color: #5c6b7a;">会社名</td><td>' + escapeHtml_(companyName) + '</td></tr>' +
    '<tr><td style="padding: 4px 12px 4px 0; color: #5c6b7a;">担当者名</td><td>' + escapeHtml_(contactName) + '</td></tr>' +
    '<tr><td style="padding: 4px 12px 4px 0; color: #5c6b7a;">希望カテゴリ</td><td>' + escapeHtml_(category) + '</td></tr>' +
    '<tr><td style="padding: 4px 12px 4px 0; color: #5c6b7a;">開催日時</td><td>' + EVENT_INFO.DATE_TEXT + '</td></tr>' +
    '<tr><td style="padding: 4px 12px 4px 0; color: #5c6b7a;">会場</td><td>' + EVENT_INFO.VENUE + '</td></tr>' +
    '</table>' +
    '<p><strong>本メールは出展申請の受付のご連絡であり、出展の可否が確定したものではありません。</strong><br />' +
    '出展者の選定は委託者(公益財団法人埼玉県産業振興公社)が行い、選定結果は後日改めてご連絡いたします。' +
    'あらかじめご了承ください。</p>' +
    '<p>ご不明な点がございましたら、本メールへ返信のうえお問い合わせください。</p>' +
    '</div>'
  );
}

/** 出展申請確認メールのプレーンテキスト本文(HTMLメール非対応の環境向け)を組み立てる。 */
function buildExhibitorConfirmationEmailPlainText_(contactName, companyName, category) {
  return [
    companyName + ' ' + contactName + ' 様',
    '',
    EVENT_INFO.NAME + ' への出展申請を受け付けました。',
    '',
    '■ お申し込み内容',
    '会社名: ' + companyName,
    '担当者名: ' + contactName,
    '希望カテゴリ: ' + category,
    '',
    '■ 開催概要',
    '開催日時: ' + EVENT_INFO.DATE_TEXT,
    '会場: ' + EVENT_INFO.VENUE,
    '',
    '本メールは出展申請の受付のご連絡であり、出展の可否が確定したものではありません。',
    '出展者の選定は委託者(公益財団法人埼玉県産業振興公社)が行い、',
    '選定結果は後日改めてご連絡いたします。あらかじめご了承ください。'
  ].join('\n');
}


// ==========================================================================
// action ハンドラ: 来場者申込
// ==========================================================================

/**
 * 来場者申込を登録する。UUID・QRトークンを発行してスプレッドシートに書き込む。
 * 必須パラメータ: name, companyName, email, phone, agreement(true必須)
 * 任意パラメータ: department, industry, interests(配列 or カンマ区切り文字列), companions
 *
 * 登録後、QRコード画像を生成し、GmailAppで「申込完了+QRコード」の確認メールを送信する。
 * QRコード生成・メール送信はいずれも外部サービス/送信APIに依存するため、失敗しても
 * 例外を投げず ErrorLog シートに記録するのみに留める(来場者登録自体は失敗させない)。
 */
function registerVisitor_(params) {
  var missing = requireFields_(params, ['name', 'companyName', 'email', 'phone']);
  if (missing.length > 0) {
    return errorResult_('validation_error', '必須項目が不足しています: ' + missing.join(', '));
  }
  if (!isValidEmail_(params.email)) {
    return errorResult_('validation_error', 'メールアドレスの形式が不正です。');
  }
  // 個人情報取り扱いへの同意はフロント側で必須チェックボックスにするが、
  // バックエンド側でも念のため検証する(フロントを経由しない不正な呼び出し対策)。
  if (params.agreement !== true && params.agreement !== 'true') {
    return errorResult_('validation_error', '個人情報の取り扱いへの同意が必要です。');
  }

  // 数値化(先頭0の欠落)を防ぐため、できるだけ早い段階で明示的に文字列化しておく。
  var phone = String(params.phone);

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = getSheet_(SHEET_NAMES.VISITORS);
    var id = generateId_();
    var qrToken = generateQrToken_();
    var interests = Array.isArray(params.interests)
      ? params.interests.join(', ')
      : (params.interests || '');

    var record = {
      'ID': id,
      'QRトークン': qrToken,
      '申込日時': nowString_(),
      '氏名': params.name,
      '会社名': params.companyName,
      '部署役職': params.department || '',
      'メールアドレス': params.email,
      '電話番号': phone,
      '業種': params.industry || '',
      '関心カテゴリ': interests,
      '同伴者数': params.companions || 0,
      'チェックイン状態': VISITOR_CHECKIN_STATUS_NONE,
      'チェックイン日時': '',
      '受付場所': ''
    };
    appendRecord_(sheet, VISITOR_HEADERS, record);

    // QRコード画像生成 + 確認メール送信。
    // sendVisitorConfirmationEmail_ 内部で例外を握りつぶし ErrorLog シートに記録する
    // 設計だが、念のためここでも try/catch し、来場者登録自体は絶対に失敗させない。
    try {
      sendVisitorConfirmationEmail_(id, qrToken, params.name, params.email);
    } catch (err) {
      logError_('QRコード生成/確認メール送信', id, qrToken, params.email, err && err.message ? err.message : String(err));
    }

    return successResult_({ id: id, qrToken: qrToken });
  } finally {
    lock.releaseLock();
  }
}


// ==========================================================================
// QRコード生成・確認メール送信(registerVisitor_ から呼び出される)
// ==========================================================================

/**
 * 来場者へ「申込完了+QRコード」の確認メールを送信する。
 * QRコード画像はメール送信時に一時的に使うだけで、Google Driveなどへの保存は行わない。
 * QRコード取得・メール送信のいずれに失敗しても例外を投げず、ErrorLogシートに記録する
 * のみに留める(呼び出し元の来場者登録処理を失敗させないための設計)。
 */
function sendVisitorConfirmationEmail_(visitorId, qrToken, name, email) {
  var qrBlob = fetchQrCodeImage_(qrToken, visitorId, email);
  if (!qrBlob) {
    // QRコード画像が取得できない場合は、QRコードなしのメールを送るのではなく送信自体を
    // 見送る(エラーは fetchQrCodeImage_ 内で既に ErrorLog へ記録済み)。
    return;
  }

  try {
    var subject = '【' + EVENT_INFO.NAME + '】お申し込みを受け付けました';
    GmailApp.sendEmail(email, subject, buildVisitorConfirmationEmailPlainText_(name, qrToken), {
      htmlBody: buildVisitorConfirmationEmailHtml_(name, qrToken),
      inlineImages: { qrCodeImage: qrBlob },
      name: EVENT_INFO.NAME + ' 事務局'
    });
  } catch (err) {
    logError_('確認メール送信', visitorId, qrToken, email, err && err.message ? err.message : String(err));
  }
}

/**
 * QRトークンからQRコード画像(Blob)を取得する。
 * APIキー不要の外部サービス api.qrserver.com を使用する(Google Chart APIは廃止済みのため
 * 使用しない)。dataパラメータには、個人情報を含まないQRトークンのみを渡す。
 *
 * 外部サービスのため失敗する可能性を考慮し、1回だけリトライする(合計2回試行)。
 * 2回とも失敗した場合は ErrorLog シートにエラーを記録したうえで null を返す。
 */
function fetchQrCodeImage_(qrToken, visitorId, email) {
  var url = QR_CODE_API_URL + '?size=300x300&data=' + encodeURIComponent(qrToken);
  var lastErrorMessage = '';

  for (var attempt = 1; attempt <= 2; attempt++) {
    try {
      var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      if (response.getResponseCode() === 200) {
        return response.getBlob();
      }
      lastErrorMessage = 'HTTPステータス ' + response.getResponseCode();
    } catch (err) {
      lastErrorMessage = err && err.message ? err.message : String(err);
    }
  }

  logError_('QRコード生成', visitorId, qrToken, email, lastErrorMessage || '不明なエラー(2回試行して失敗)');
  return null;
}

/** 確認メールのHTML本文を組み立てる。QRコード画像は inlineImages の cid 参照で埋め込む。 */
function buildVisitorConfirmationEmailHtml_(name, qrToken) {
  var mypageUrl = VISITOR_MYPAGE_BASE_URL + '?token=' + encodeURIComponent(qrToken);
  return (
    '<div style="font-family: sans-serif; line-height: 1.7; color: #1f2933;">' +
    '<p>' + escapeHtml_(name) + ' 様</p>' +
    '<p>' + EVENT_INFO.NAME + ' へのお申し込みをいただき、誠にありがとうございます。<br />' +
    '以下の内容でお申し込みを受け付けました。</p>' +
    '<table style="border-collapse: collapse; margin: 1em 0;">' +
    '<tr><td style="padding: 4px 12px 4px 0; color: #5c6b7a;">開催日時</td><td>' + EVENT_INFO.DATE_TEXT + '</td></tr>' +
    '<tr><td style="padding: 4px 12px 4px 0; color: #5c6b7a;">会場</td><td>' + EVENT_INFO.VENUE + '</td></tr>' +
    '</table>' +
    '<p><strong>当日は、以下のQRコードを受付にてご提示ください。</strong></p>' +
    '<p><img src="cid:qrCodeImage" alt="受付用QRコード" width="220" height="220" /></p>' +
    '<p>QRコードが表示されない場合は、受付スタッフに本メールの件名またはお名前をお伝えください。</p>' +
    '<p>お申し込み内容の確認や、QRコードの再表示は、以下のマイページからいつでも行えます。<br />' +
    '<a href="' + mypageUrl + '">' + mypageUrl + '</a></p>' +
    '<p style="color: #b3261e;"><strong>※ このリンクは第三者に転送しないでください。</strong></p>' +
    '<p>当日のご来場を心よりお待ちしております。</p>' +
    '</div>'
  );
}

/** 確認メールのプレーンテキスト本文(HTMLメール非対応の環境向け)を組み立てる。 */
function buildVisitorConfirmationEmailPlainText_(name, qrToken) {
  var mypageUrl = VISITOR_MYPAGE_BASE_URL + '?token=' + encodeURIComponent(qrToken);
  return [
    name + ' 様',
    '',
    EVENT_INFO.NAME + ' へのお申し込みを受け付けました。',
    '開催日時: ' + EVENT_INFO.DATE_TEXT,
    '会場: ' + EVENT_INFO.VENUE,
    '',
    '当日は受付用QRコードをご提示ください。',
    '(このメールがHTML形式で表示されない場合は、受付スタッフにお名前をお伝えください)',
    '',
    'お申し込み内容の確認・QRコードの再表示は、以下のマイページから行えます。',
    mypageUrl,
    '※ このリンクは第三者に転送しないでください。',
    '',
    '当日のご来場を心よりお待ちしております。'
  ].join('\n');
}

/** HTMLメール本文に差し込む文字列をエスケープする(氏名等にHTML特殊文字が含まれる場合の保険)。 */
function escapeHtml_(text) {
  return String(text === undefined || text === null ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * QRコード生成・確認メール送信のエラーを ErrorLog シートに記録する。
 * この関数自体の失敗(シート未作成など)で処理全体を止めないよう、内部でtry/catchする。
 */
function logError_(type, visitorId, qrToken, email, message) {
  try {
    var sheet = getSheet_(SHEET_NAMES.ERROR_LOG);
    appendRecord_(sheet, ERROR_LOG_HEADERS, {
      '日時': nowString_(),
      '種別': type,
      '来場者ID': visitorId || '',
      'QRトークン': qrToken || '',
      'メールアドレス': email || '',
      'エラー内容': message || ''
    });
  } catch (err) {
    Logger.log('[ERROR] ErrorLogシートへの記録に失敗しました: ' + (err && err.message ? err.message : String(err)));
  }
}


// ==========================================================================
// action ハンドラ: QRコード受付(チェックイン)
// ==========================================================================

/**
 * QRトークンを受け取り、該当来場者のチェックイン状態を更新する。
 * 必須パラメータ: qrToken
 * 任意パラメータ: location (受付場所: 展示ゾーン / 講演会場)
 */
function checkin_(params) {
  var missing = requireFields_(params, ['qrToken']);
  if (missing.length > 0) {
    return errorResult_('validation_error', '必須項目が不足しています: ' + missing.join(', '));
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = getSheet_(SHEET_NAMES.VISITORS);
    var rowIndex = findRowByColumnValue_(sheet, VISITOR_HEADERS, 'QRトークン', params.qrToken);

    if (rowIndex === -1) {
      return errorResult_('not_found', '未登録のQRトークンです。手動登録をご案内してください。');
    }

    var colIndex = buildColumnIndexMap_(VISITOR_HEADERS);
    var rowValues = sheet.getRange(rowIndex, 1, 1, VISITOR_HEADERS.length).getValues()[0];
    var name = rowValues[colIndex['氏名']];
    var currentStatus = rowValues[colIndex['チェックイン状態']];

    if (currentStatus === VISITOR_CHECKIN_STATUS_DONE) {
      return successResult_({
        alreadyCheckedIn: true,
        message: '受付済みです',
        name: name,
        checkinTime: formatCheckinTime_(rowValues[colIndex['チェックイン日時']]),
        location: rowValues[colIndex['受付場所']]
      });
    }

    var checkinTime = nowString_();
    var location = params.location || '';
    sheet.getRange(rowIndex, colIndex['チェックイン状態'] + 1).setValue(VISITOR_CHECKIN_STATUS_DONE);
    sheet.getRange(rowIndex, colIndex['チェックイン日時'] + 1).setValue(checkinTime);
    if (location) {
      sheet.getRange(rowIndex, colIndex['受付場所'] + 1).setValue(location);
    }

    return successResult_({
      alreadyCheckedIn: false,
      message: name + ' 様 受付完了',
      name: name,
      checkinTime: checkinTime,
      location: location
    });
  } finally {
    lock.releaseLock();
  }
}


// ==========================================================================
// action ハンドラ: 管理系API(要APIキー)
// ==========================================================================

/**
 * 管理系APIの共通認証ラッパー。
 * apiKey パラメータがスクリプトプロパティ ADMIN_API_KEY と一致しない場合は拒否する。
 */
function withAdminAuth_(params, handlerFn) {
  if (!isValidAdminApiKey_(params.apiKey)) {
    return errorResult_('unauthorized', 'APIキーが不正です。');
  }
  return handlerFn(params);
}

/** 来場者一覧を取得する(管理画面用)。 */
function getVisitors_() {
  var sheet = getSheet_(SHEET_NAMES.VISITORS);
  return successResult_({ visitors: sheetToObjects_(sheet, VISITOR_HEADERS) });
}

/**
 * QRトークンから来場者本人の申込内容を1件だけ取得する(来場者向けマイページ用)。
 * 個人情報を含む公開APIだが、getVisitors_ のような一覧取得ではなく、
 * 「渡された token と完全一致する行が1件見つかった場合のみ、その1件だけ」を返す設計と
 * することで、token(推測困難なランダム文字列)を知らない第三者が他人の情報を
 * 取得できないようにしている(そのため apiKey によるAPIキー認証は課さない)。
 * 必須パラメータ: token
 */
function getVisitorByToken_(params) {
  var missing = requireFields_(params, ['token']);
  if (missing.length > 0) {
    return errorResult_('validation_error', '必須項目が不足しています: ' + missing.join(', '));
  }

  var sheet = getSheet_(SHEET_NAMES.VISITORS);
  var rowIndex = findRowByColumnValue_(sheet, VISITOR_HEADERS, 'QRトークン', params.token);
  if (rowIndex === -1) {
    return errorResult_('not_found', '指定されたトークンに該当する申込情報が見つかりません。');
  }

  var rowValues = sheet.getRange(rowIndex, 1, 1, VISITOR_HEADERS.length).getValues()[0];
  return successResult_({ visitor: rowValuesToObject_(VISITOR_HEADERS, rowValues) });
}

/** 出展者一覧を取得する(管理画面用)。 */
function getExhibitors_() {
  var sheet = getSheet_(SHEET_NAMES.EXHIBITORS);
  return successResult_({ exhibitors: sheetToObjects_(sheet, EXHIBITOR_HEADERS) });
}

/** 集計データを取得する(申込者数・チェックイン率など)。 */
function getStats_() {
  var exhibitors = sheetToObjects_(getSheet_(SHEET_NAMES.EXHIBITORS), EXHIBITOR_HEADERS);
  var visitors = sheetToObjects_(getSheet_(SHEET_NAMES.VISITORS), VISITOR_HEADERS);

  var exhibitorsByStatus = {};
  exhibitors.forEach(function (row) {
    var status = row['ステータス'] || '(未設定)';
    exhibitorsByStatus[status] = (exhibitorsByStatus[status] || 0) + 1;
  });

  var checkedInCount = 0;
  var visitorsByLocation = {};
  visitors.forEach(function (row) {
    if (row['チェックイン状態'] === VISITOR_CHECKIN_STATUS_DONE) {
      checkedInCount++;
      var location = row['受付場所'] || '(未設定)';
      visitorsByLocation[location] = (visitorsByLocation[location] || 0) + 1;
    }
  });

  var visitorTotal = visitors.length;
  var checkinRate = visitorTotal > 0 ? Math.round((checkedInCount / visitorTotal) * 1000) / 10 : 0;

  return successResult_({
    exhibitors: {
      total: exhibitors.length,
      byStatus: exhibitorsByStatus
    },
    visitors: {
      total: visitorTotal,
      checkedIn: checkedInCount,
      checkinRate: checkinRate, // %
      byLocation: visitorsByLocation
    },
    generatedAt: nowString_()
  });
}


// ==========================================================================
// スプレッドシート セットアップ用ユーティリティ(初回に手動実行する)
// ==========================================================================

/**
 * シートと見出し行を自動作成する。Apps Scriptエディタから手動実行すること。
 * 既にシートが存在する場合は見出し行のみ確認・補正する(データは消さない)。
 */
function setupSheets() {
  var ss = getSpreadsheet_();
  ensureSheetWithHeaders_(ss, SHEET_NAMES.EXHIBITORS, EXHIBITOR_HEADERS);
  ensureSheetWithHeaders_(ss, SHEET_NAMES.VISITORS, VISITOR_HEADERS);
  ensureSheetWithHeaders_(ss, SHEET_NAMES.SURVEY, SURVEY_HEADERS);
  ensureSheetWithHeaders_(ss, SHEET_NAMES.ERROR_LOG, ERROR_LOG_HEADERS);
  Logger.log('セットアップ完了: Exhibitors / Visitors / Survey / ErrorLog シートを作成・確認しました。');
}

function ensureSheetWithHeaders_(ss, sheetName, headers) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);

  // 電話番号列はプレインテキスト形式に固定する(先頭の0が数値化で消えるのを防ぐ)。
  var phoneColIndex = headers.indexOf('電話番号');
  if (phoneColIndex !== -1) {
    sheet.getRange(1, phoneColIndex + 1, sheet.getMaxRows(), 1).setNumberFormat('@');
  }
}

/**
 * 【一時的な修正関数】既存データの電話番号列をプレインテキスト形式に直す。
 *
 * setupSheets()・appendRecord_() の対策を入れる前に登録された行は、電話番号が
 * 数値として保存され、先頭の0が失われている可能性がある。この関数は
 * Exhibitors/Visitors 両シートの電話番号列を再度プレインテキスト形式
 * (setNumberFormat('@'))に固定したうえで、既存の値を文字列として書き直す。
 *
 * 【使い方】Apps Script エディタの関数選択ドロップダウンで
 * `fixPhoneNumberFormat_` を選び、[実行] ボタンを押して手動で1回だけ実行する。
 *
 * 【注意】この関数は書式の再設定と再書き込みを行うのみで、既に数値化されて
 * 先頭の0が失われてしまった値そのものを復元することはできない(元の入力値を
 * 保持していないため)。0落ちしている行が見つかった場合は、該当の申込者に
 * 個別に確認するか、手動で修正すること。今後の新規登録分は appendRecord_ の
 * 対策により0落ちが発生しなくなる。
 */
function fixPhoneNumberFormat_() {
  fixPhoneNumberFormatForSheet_(getSheet_(SHEET_NAMES.EXHIBITORS), EXHIBITOR_HEADERS);
  fixPhoneNumberFormatForSheet_(getSheet_(SHEET_NAMES.VISITORS), VISITOR_HEADERS);
  Logger.log('電話番号列のプレインテキスト形式への修正が完了しました。0落ちしていないか、念のためシートを目視確認してください。');
}

function fixPhoneNumberFormatForSheet_(sheet, headers) {
  var phoneColIndex = headers.indexOf('電話番号');
  if (phoneColIndex === -1) return;

  // 列全体(見出し含む)をプレインテキスト形式に固定する。
  sheet.getRange(1, phoneColIndex + 1, sheet.getMaxRows(), 1).setNumberFormat('@');

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  var range = sheet.getRange(2, phoneColIndex + 1, lastRow - 1, 1);
  var values = range.getValues();
  var fixedValues = values.map(function (row) {
    var value = row[0];
    if (value === '' || value === null) return [''];
    // 既に数値化されて先頭の0が失われている値そのものは復元できない点に注意
    // (このタイミングでは元の入力文字列を保持していないため)。
    return [forcePlainTextPhoneValue_(value)];
  });
  range.setValues(fixedValues);
}


// ==========================================================================
// 共通ユーティリティ
// ==========================================================================

/** 実行中のスプレッドシートを取得する(コンテナバインド優先、なければIDから取得)。 */
function getSpreadsheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) return ss;

  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) {
    throw new Error('スプレッドシートに紐付いていないスクリプトです。スクリプトプロパティ SPREADSHEET_ID を設定してください。');
  }
  return SpreadsheetApp.openById(id);
}

/** 指定シート名のシートオブジェクトを取得する。存在しなければエラー。 */
function getSheet_(sheetName) {
  var sheet = getSpreadsheet_().getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('シート「' + sheetName + '」が見つかりません。先に setupSheets() を実行してください。');
  }
  return sheet;
}

/**
 * headers の並び順に従って record オブジェクトを1行としてシート末尾に追加する。
 * headers に '電話番号' が含まれる場合、書き込む直前に
 *   1) 該当セルをプレインテキスト形式(setNumberFormat('@'))に固定する
 *   2) 値を明示的に String() 化する
 *   3) 数字のみの値には forcePlainTextPhoneValue_() で先頭にアポストロフィを付与する
 * という3段構えの対策を行う(先頭の0が数値化で消えるのを防ぐ)。
 *
 * 【背景】setNumberFormat('@') は「文字列として渡された値の表示形式」を整えるだけで、
 * Apps Script の Range#setValues() はユーザーがセルに直接入力した場合と同様に値の型を
 * 自動判定するため、"07050240886" のような数字のみの文字列は事前に '@' 形式を設定して
 * いても数値として保存されてしまうことがある(ハイフンを含む文字列は数値と解釈されない
 * ため、この問題は起きない)。これを確実に防ぐには、Google スプレッドシートの仕様
 * (先頭にアポストロフィを付けると常に文字列として扱われる)を利用する必要がある。
 */
function appendRecord_(sheet, headers, record) {
  var row = headers.map(function (header) {
    var value = record[header] !== undefined ? record[header] : '';
    if (header === '電話番号') {
      value = forcePlainTextPhoneValue_(value);
    }
    return value;
  });

  var newRow = sheet.getLastRow() + 1;
  var phoneColIndex = headers.indexOf('電話番号');
  if (phoneColIndex !== -1) {
    sheet.getRange(newRow, phoneColIndex + 1).setNumberFormat('@');
  }
  sheet.getRange(newRow, 1, 1, headers.length).setValues([row]);
}

/**
 * 電話番号の値を、数値化されずに確実にプレインテキストとして保存されるように加工する。
 * - 明示的に String() で文字列化する
 * - 数字のみで構成される文字列("07050240886"など)は、先頭にアポストロフィ(')を
 *   付与する。Google スプレッドシートはこの先頭アポストロフィを「常に文字列として扱う」
 *   指示として解釈し、保存後はアポストロフィ自体は値にもセル表示にも残らない。
 * - ハイフンなどを含む文字列("090-1234-5678")はもともと数値と解釈されないため、
 *   アポストロフィは付与しない(不要な文字が残るのを避ける)。
 */
function forcePlainTextPhoneValue_(phone) {
  var text = String(phone === undefined || phone === null ? '' : phone);
  if (/^\d+$/.test(text)) {
    return "'" + text;
  }
  return text;
}

/** headers 配列から { 見出し名: 0始まりの列インデックス } のマップを作る。 */
function buildColumnIndexMap_(headers) {
  var map = {};
  headers.forEach(function (header, index) {
    map[header] = index;
  });
  return map;
}

/**
 * シートの全データ行を、見出し名をキーとするオブジェクトの配列に変換する。
 * ID列(1列目)が空の行はスキップする。
 */
function sheetToObjects_(sheet, headers) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  var results = [];
  values.forEach(function (row) {
    if (row[0] === '' || row[0] === null) return; // ID空行はスキップ
    results.push(rowValuesToObject_(headers, row));
  });
  return results;
}

/** headers の並び順に従って、1行分の値配列を { 見出し名: 値 } のオブジェクトに変換する。 */
function rowValuesToObject_(headers, rowValues) {
  var obj = {};
  headers.forEach(function (header, index) {
    var value = rowValues[index];
    obj[header] = (value instanceof Date) ? Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss') : value;
  });
  return obj;
}

/**
 * 指定した見出し列の値が一致する最初の行番号(1始まり、シート上の実行番号)を返す。
 * 見つからない場合は -1。
 */
function findRowByColumnValue_(sheet, headers, headerName, value) {
  var colIndex = buildColumnIndexMap_(headers)[headerName];
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;

  var values = sheet.getRange(2, colIndex + 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    if (values[i][0] === value) {
      return i + 2; // ヘッダー行(1行目)分のオフセット
    }
  }
  return -1;
}

/** UUIDを発行する(Exhibitors/VisitorsのID用)。 */
function generateId_() {
  return Utilities.getUuid();
}

/**
 * QRトークンを発行する。個人情報を含まないランダム文字列(32桁の16進数)。
 */
function generateQrToken_() {
  return Utilities.getUuid().replace(/-/g, '');
}

function nowString_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
}

/**
 * チェックイン日時の値を nowString_() と同じ書式("yyyy-MM-dd HH:mm:ss"、
 * Session.getScriptTimeZone() 基準)の文字列に統一する。
 *
 * 【背景】Googleスプレッドシートは日付らしき文字列を書き込むと自動でDate型の
 * セルに変換することがある(電話番号の数値化と同種の自動判定)。checkin_ の
 * 「受付済みです」判定時はシートから直接読み直した値をそのまま返していたため、
 * Date型に変換されていた場合はJSON化時にISO/UTC形式の文字列("...T...Z")に
 * なってしまい、新規チェックイン成功時(nowString_() をそのまま返す)と
 * 書式が食い違っていた。この関数で値の型によらず同じ書式に揃える。
 */
function formatCheckinTime_(value) {
  if (value === '' || value === null || value === undefined) return '';
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  }
  return String(value);
}

/** 必須パラメータのうち、未指定・空文字のものの一覧を返す。 */
function requireFields_(params, fieldNames) {
  return fieldNames.filter(function (field) {
    var value = params[field];
    return value === undefined || value === null || value === '';
  });
}

function isValidEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidAdminApiKey_(apiKey) {
  var expected = PropertiesService.getScriptProperties().getProperty('ADMIN_API_KEY');
  return !!expected && apiKey === expected;
}

function successResult_(data) {
  var result = { success: true };
  for (var key in data) {
    if (data.hasOwnProperty(key)) result[key] = data[key];
  }
  return result;
}

function errorResult_(code, message) {
  return { success: false, error: code, message: message };
}

/** GASの標準レスポンス(JSON)を生成する。 */
function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * doGet/doPost の e オブジェクトから、GET/POST両対応でパラメータを取り出す。
 * - GET / フォームPOST: e.parameter (クエリ文字列 or application/x-www-form-urlencoded)
 * - JSON POST: e.postData.contents をJSONとしてパースする
 *   (フロント側は preflight を避けるため Content-Type: text/plain で
 *    JSON文字列をPOSTすることを推奨。詳細はREADME.md参照)
 * 両方に値がある場合はJSON側を優先してマージする。
 */
function parseParams_(e) {
  var params = {};
  if (e && e.parameter) {
    for (var key in e.parameter) {
      params[key] = e.parameter[key];
    }
  }
  if (e && e.postData && e.postData.contents) {
    try {
      var body = JSON.parse(e.postData.contents);
      for (var bKey in body) {
        params[bKey] = body[bKey];
      }
    } catch (err) {
      // JSONでなければ(例: 通常のフォームPOST) e.parameter のみを使う。無視してよい。
    }
  }
  return params;
}


// ==========================================================================
// テスト用関数(Apps Scriptエディタから直接実行して動作確認する)
// ==========================================================================

/**
 * 出展申込登録のテスト。
 * 実際に確認メール送信まで確認したい場合は、Apps Scriptエディタで
 * 引数に自分が受信できるメールアドレスを渡して実行する(例:
 * test_registerExhibitor('your-address@gmail.com'))。
 * 引数を省略した場合はダミーのメールアドレス(実在しない)で登録される。
 *
 * @param {string} [testEmail] 確認メールを実際に受信して確認したい場合の宛先アドレス
 */
function test_registerExhibitor(testEmail) {
  var result = registerExhibitor_({
    companyName: 'テスト株式会社',
    contactName: '埼玉太郎',
    email: testEmail || 'exhibitor-test@example.com',
    phone: '048-000-0000',
    category: '汎用ツール',
    description: 'クラウド勤怠管理システムのデモ展示',
    powerNeeded: '要',
    loadingTime: '9:00-9:30',
    notes: 'テストデータ'
  });
  Logger.log(JSON.stringify(result, null, 2));
}

/**
 * 来場者登録のテスト。
 * 実際にQRコード生成・確認メール送信まで確認したい場合は、Apps Scriptエディタで
 * 引数に自分が受信できるメールアドレスを渡して実行する(例:
 * test_registerVisitor('your-address@gmail.com'))。
 * 引数を省略した場合はダミーのメールアドレス(実在しない)で登録される。
 *
 * @param {string} [testEmail] 確認メールを実際に受信して確認したい場合の宛先アドレス
 */
function test_registerVisitor(testEmail) {
  var result = registerVisitor_({
    name: '浦和花子',
    companyName: 'サンプル商事',
    department: '営業部 課長',
    email: testEmail || 'visitor-test@example.com',
    phone: '090-1234-5678',
    industry: '製造業',
    interests: ['業種特化ソリューション', 'DX大賞'],
    companions: 1,
    agreement: true
  });
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function test_checkin() {
  // 事前に test_registerVisitor() を実行し、発行された qrToken を貼り付けて実行する。
  var registerResult = test_registerVisitor();
  var result = checkin_({ qrToken: registerResult.qrToken, location: '展示ゾーン' });
  Logger.log(JSON.stringify(result, null, 2));

  // 2回目は「受付済みです」になることを確認
  var secondResult = checkin_({ qrToken: registerResult.qrToken, location: '展示ゾーン' });
  Logger.log(JSON.stringify(secondResult, null, 2));

  // 回帰テスト: 1回目(成功)と2回目(重複)で checkinTime の書式が一致することを確認する。
  // ("yyyy-MM-dd HH:mm:ss" 形式であること。ISO/UTC形式("...T...Z")になっていないか)
  var timeFormatPattern = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
  var firstFormatOk = timeFormatPattern.test(result.checkinTime);
  var secondFormatOk = timeFormatPattern.test(secondResult.checkinTime);

  Logger.log('1回目(成功)checkinTime: ' + result.checkinTime + ' (書式一致: ' + firstFormatOk + ')');
  Logger.log('2回目(重複)checkinTime: ' + secondResult.checkinTime + ' (書式一致: ' + secondFormatOk + ')');

  if (firstFormatOk && secondFormatOk) {
    Logger.log('[OK] 成功時・重複時の checkinTime の書式が一致しました。');
  } else {
    Logger.log('[NG] checkinTime の書式が一致していません。期待する書式: yyyy-MM-dd HH:mm:ss');
  }
}

function test_getStats() {
  Logger.log(JSON.stringify(getStats_(), null, 2));
}

/**
 * 電話番号の先頭0が失われないことを確認する回帰テスト。
 * ハイフンなしの数字のみの電話番号("07050240886")で登録し、
 * シートに書き込まれた実際の値を再取得して "07050240886" のままか確認する。
 * 実行後、[実行数]/ログに結果が出力される。問題がなければ
 * '[OK] 電話番号は先頭の0を含めて正しく保存されました' が表示される。
 */
function test_phoneNumberLeadingZero_() {
  var result = registerExhibitor_({
    companyName: '【テスト】電話番号0落ち確認株式会社',
    contactName: 'テスト次郎',
    email: 'phone-format-test@example.com',
    phone: '07050240886',
    category: '汎用ツール'
  });
  Logger.log('registerExhibitor_ result: ' + JSON.stringify(result));

  var sheet = getSheet_(SHEET_NAMES.EXHIBITORS);
  var rowIndex = findRowByColumnValue_(sheet, EXHIBITOR_HEADERS, 'ID', result.id);
  var colIndex = buildColumnIndexMap_(EXHIBITOR_HEADERS)['電話番号'];
  var savedValue = sheet.getRange(rowIndex, colIndex + 1).getValue();

  Logger.log('シートに保存された電話番号: typeof=' + (typeof savedValue) + ', value=' + savedValue);

  if (String(savedValue) === '07050240886') {
    Logger.log('[OK] 電話番号は先頭の0を含めて正しく保存されました。');
  } else {
    Logger.log('[NG] 電話番号が破損しています。期待値="07050240886" 実際="' + savedValue + '"');
  }
}
