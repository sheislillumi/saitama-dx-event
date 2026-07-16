# 県内企業DX推進統合イベント運営システム

イベントHP／出展申込サイト／来場者申込サイト／QRコード受付・管理ダッシュボードを構成する一式です。
詳細仕様は `DX展示会システム_ClaudeCode指示書.md` を参照してください。

## ディレクトリ構成

```
saitama-dx-event/
├── index.html                  # イベント公式HP
├── exhibitor/
│   └── index.html               # 出展申込フォーム
├── visitor/
│   └── index.html               # 来場者申込フォーム
├── checkin/
│   └── index.html               # QRコード受付画面(当日運営者用)
├── admin/
│   └── index.html               # 管理ダッシュボード(要パスワード)
├── mypage/
│   ├── visitor/
│   │   └── index.html           # 来場者向けマイページ(申込内容の閲覧・編集、QRコード再表示、チェックイン状況確認)
│   └── exhibitor/
│       └── index.html           # 出展者向けマイページ(申込内容の閲覧・編集、選考ステータス確認)
├── assets/
│   ├── css/style.css            # 全画面共通スタイル
│   └── js/
│       ├── common.js            # バリデーション・メッセージ表示等の共通処理
│       ├── api-client.js        # GAS APIとの通信をまとめる(URLを1箇所で管理)
│       └── qr-scanner.js        # html5-qrcodeのラッパー(checkin画面用)
├── gas/
│   └── Code.gs                  # GAS側のコード(Apps Scriptエディタにも反映する)
├── robots.txt                   # /admin/ を検索エンジンのクロール対象外に指定
├── .gitignore
├── README.md
└── TESTING.md                   # 通しテスト・異常系テストの手順書
```

指示書「3. ディレクトリ構成」に記載の5画面(イベントHP・出展申込フォーム・来場者申込フォーム・
QRコード受付画面・管理ダッシュボード)およびバックエンド(GAS、QRコード生成・確認メール送信含む)を
実装済みです。一連の流れを通しでテストする手順は [TESTING.md](TESTING.md) を参照してください。

## 目次

1. [バックエンド(GAS)のデプロイ手順](#バックエンドgasのデプロイ手順) — スプレッドシート作成〜Webアプリ公開まで
2. [動作確認方法(GASエディタ上でのテスト)](#動作確認方法gasエディタ上でのテスト)
3. [API仕様概要](#api仕様概要gascodegs)
4. [CORSに関する注意](#corsに関する注意)
5. [GitHub Pagesでの公開手順](#github-pagesでの公開手順) — フロントエンド(静的ファイル)の公開
6. [TESTING.md](TESTING.md) — 5画面を通した手動テスト手順・異常系テスト項目

## バックエンド(GAS)のデプロイ手順

### 1. スプレッドシートを作成する

1. Google スプレッドシートを新規作成し、わかりやすい名前を付ける(例:「DX展示会イベント_DB」)。
2. メニューの [拡張機能] > [Apps Script] を開く。

### 2. コードを貼り付ける

1. Apps Script エディタのデフォルトの `Code.gs` の中身を全て削除する。
2. このリポジトリの `gas/Code.gs` の内容をすべてコピーし、貼り付けて保存する。

### 3. シートを自動セットアップする

1. Apps Script エディタ上部の関数選択ドロップダウンから `setupSheets` を選択する。
2. [実行] ボタンを押す(初回は権限承認のダイアログが出るので許可する)。
3. 実行が成功すると、スプレッドシートに以下の5シートが作成され、見出し行が設定される。

   - **Exhibitors**(出展者): ID / 申込日時 / 会社名 / 担当者名 / メールアドレス / 電話番号 /
     希望カテゴリ / 展示内容概要 / 電源要否 / 搬入出希望時間 / ステータス / 備考 /
     アクセストークン / 公開ブースID
     - アクセストークンは出展者向けマイページ `mypage/exhibitor/` のログインに使用。
       既存データへの後付けは `backfillExhibitorTokens_` を1回だけ手動実行してバックフィルすること
     - 公開ブースIDは「気になった相手を記録する」機能(`logInterest`)で、来場者がブースを
       読み取る際に使う公開ID。アクセストークンとは別物で、これ単体からは個人情報を閲覧・
       編集できない。既存データへの後付けは `backfillPublicScanIds_` を1回だけ手動実行すること
   - **Visitors**(来場者): ID / QRトークン / 申込日時 / 氏名 / 会社名 / 部署役職 /
     メールアドレス / 電話番号 / 業種 / 関心カテゴリ / 同伴者数 / チェックイン状態 /
     チェックイン日時 / 受付場所 / 公開スキャンID
     - 公開スキャンIDは「気になった相手を記録する」機能(`logInterest`)で、出展者が来場者を
       読み取る際に使う公開ID。QRトークンとは別物で、これ単体からは個人情報を閲覧・編集
       できない。既存データへの後付けは `backfillPublicScanIds_` を1回だけ手動実行すること
   - **Survey**(アンケート・任意): ID / 来場者ID / 満足度 / 自由記述
   - **ErrorLog**(QRコード生成・確認メール送信のエラー記録用): 日時 / 種別 / 来場者ID /
     QRトークン / メールアドレス / エラー内容
   - **Interactions**(「気になった相手を記録する」機能の記録): ID / 記録日時 / スキャナー種別 /
     スキャナー公開ID / スキャナー表示名 / 対象種別 / 対象公開ID / 対象表示名 / メモ
     (QRトークン・アクセストークンのような非公開トークンは一切保存しない)

   ※ シート名・列見出し・列順は `gas/Code.gs` 内のコメント、および
     指示書「4. データスキーマ」と完全に一致させること。

### 4. スクリプトプロパティを設定する

1. Apps Script エディタ左側の歯車アイコン [プロジェクトの設定] を開く。
2. [スクリプト プロパティ] で以下を追加する。

   | プロパティ名 | 値 | 備考 |
   |---|---|---|
   | `ADMIN_API_KEY` | 推測されにくいランダムな文字列 | `getVisitors`/`getExhibitors`/`getStats`/`getInteractionStats` 呼び出し時に必須。**この値がそのまま管理ダッシュボード(`admin/index.html`)ログイン時のパスワードになる。** |
   | `SPREADSHEET_ID` | (スタンドアロンScriptプロジェクトの場合のみ) | Apps Scriptをスプレッドシートに紐づけて作成した場合(手順1〜2の方法)は不要 |

### 5. Webアプリとしてデプロイする

1. 右上の [デプロイ] > [新しいデプロイ] をクリック。
2. 種類の選択(歯車アイコン)で [ウェブアプリ] を選択。
3. 設定:
   - 説明: 任意(例: `v1 初期デプロイ`)
   - 次のユーザーとして実行: **自分(Me)**
   - アクセスできるユーザー: **全員(Anyone)**
     - 個人情報を扱うシステムのため、本番運用前にアクセス制御方針を再確認すること。
4. [デプロイ] をクリックし、表示された **ウェブアプリのURL** をコピーする。
5. このURLを `assets/js/api-client.js` の `GAS_API_CONFIG.BASE_URL` に設定する
   (この1箇所を差し替えるだけで、全画面のAPI接続先が切り替わる)。

**コードを更新した場合の注意点**: `Code.gs` を修正しただけではデプロイ済みURLには反映されません。
[デプロイ] > [デプロイを管理] から既存のウェブアプリデプロイを選び、鉛筆アイコンで編集して
「新バージョン」を作成・デプロイし直してください。

## 動作確認方法(GASエディタ上でのテスト)

ローカル環境で直接実行できないため、`gas/Code.gs` の末尾に用意したテスト関数を
Apps Script エディタから実行して確認します。

1. 関数選択ドロップダウンで以下のいずれかを選び、[実行] する。
   - `test_registerExhibitor` — 出展申込登録のテスト
   - `test_registerVisitor` — 来場者申込登録(UUID・QRトークン発行)のテスト
   - `test_checkin` — 来場者登録 → チェックイン → 重複チェックインのテスト
   - `test_getStats` — 集計取得のテスト
2. 画面下部の [実行数] タブ、またはエディタ内の [ログを表示](`Ctrl+Enter`)でログを確認する。
3. スプレッドシート側にも行が追加されていることを確認する。

### デプロイ後にHTTP経由で確認する場合

デプロイ済みのウェブアプリURLを使って、ブラウザや `curl` から直接呼び出すこともできます。

**GET(集計取得・要APIキー)**

```
https://script.google.com/macros/s/xxxxxxxxxxxx/exec?action=getStats&apiKey=<ADMIN_API_KEYの値>
```

**POST(来場者登録)** ※ Content-Type は `text/plain` を推奨(理由は後述のCORS節を参照)

```powershell
curl -X POST "https://script.google.com/macros/s/xxxxxxxxxxxx/exec" `
  -H "Content-Type: text/plain" `
  -d '{"action":"registerVisitor","name":"埼玉太郎","companyName":"サンプル株式会社","email":"taro@example.com","phone":"090-1111-2222","agreement":true}'
```

**POST(チェックイン)**

```powershell
curl -X POST "https://script.google.com/macros/s/xxxxxxxxxxxx/exec" `
  -H "Content-Type: text/plain" `
  -d '{"action":"checkin","qrToken":"<登録時に返却されたQRトークン>","location":"展示ゾーン"}'
```

## API仕様概要(`gas/Code.gs`)

すべてのレスポンスは `{ "success": true/false, ... }` 形式のJSON。

### doPost(e) — action で分岐

| action | 必須パラメータ | 概要 |
|---|---|---|
| `registerExhibitor` | companyName, contactName, email, phone, category | UUID・アクセストークンを発行しExhibitorsシートに追加。続けてGmailAppで「申請受付」の確認メール(QRコードなし。選定は委託者が行う旨、マイページ(`mypage/exhibitor/`)へのリンクを明記)を送信する。送信に失敗しても出展申込登録自体は失敗させず、ErrorLogシートにエラーを記録する |
| `registerVisitor` | name, companyName, email, phone, agreement(true) | UUID・QRトークンを発行しVisitorsシートに追加。続けてQRコード画像を生成(api.qrserver.com)し、GmailAppで確認メール(QRコードをインライン画像として埋め込み、マイページ(`mypage/visitor/`)へのリンクも記載)を送信する。QRコード生成・メール送信に失敗しても来場者登録自体は失敗させず、ErrorLogシートにエラーを記録する |
| `checkin` | qrToken | 該当来場者のチェックイン状態を更新。重複時は「受付済みです」を返す |
| `updateVisitor` | token, name, companyName, email, phone | マイページ(`mypage/visitor/`)から来場者本人が申込内容を編集。token(QRトークン)と完全一致する行のみ更新可能。ID・QRトークン・申込日時・チェックイン状態・チェックイン日時・受付場所はこのAPI経由では変更できない(パラメータに含まれていても無視される) |
| `updateExhibitor` | token, companyName, contactName, email, phone, category | マイページ(`mypage/exhibitor/`)から出展者本人が申込内容を編集。token(アクセストークン)と完全一致する行のみ更新可能。ID・申込日時・ステータス(選定結果)・アクセストークンはこのAPI経由では変更できない(パラメータに含まれていても無視される。ステータスは委託者側の選定結果のため出展者本人は変更不可) |
| `logInterest` | scannerType(exhibitor/visitor), scannerToken, targetPublicId | 「気になった相手を記録する」機能。scannerToken(QRトークン/アクセストークン、本人確認のみに使用しInteractionsシートには保存しない)で本人を特定し、targetPublicId(相手の公開スキャンID/公開ブースID)で相手を特定してInteractionsシートに記録する。対象種別はscannerTypeから自動判定(visitorがスキャン→対象はexhibitor、その逆も同様)。同一の組み合わせを再度記録した場合は新規行を追加せず記録日時・メモを上書き更新する。成功時、相手の表示名(targetName)を返す |

### doGet(e) — action で分岐

| action | 必須パラメータ | 概要 |
|---|---|---|
| `getVisitors` | apiKey | 来場者一覧を取得(管理画面用) |
| `getExhibitors` | apiKey | 出展者一覧を取得(管理画面用) |
| `getStats` | apiKey | 申込者数・チェックイン率などの集計を取得 |
| `getInteractionStats` | apiKey | 「気になった相手を記録する」機能の集計(出展者ごとの記録来場者数ランキング、来場者ごとの記録出展者数の分布(平均・最大)、総記録数・実人数)を取得(管理画面用) |
| `getVisitorByToken` | token | QRトークンが一致する来場者1件のみを取得(来場者向けマイページ用)。一覧取得は不可 |
| `getExhibitorByToken` | token | アクセストークンが一致する出展者1件のみを取得(出展者向けマイページ用)。一覧取得は不可 |
| `getMyInterests` | scannerType, scannerToken | 本人(scannerToken)がこれまで記録した相手の一覧(対象表示名・記録日時・メモ)を取得 |

`getVisitors`/`getExhibitors`/`getStats`/`getInteractionStats` は、`apiKey` がスクリプト
プロパティ `ADMIN_API_KEY` の値と一致しないと `401相当`
(`{"success":false,"error":"unauthorized"}`)が返ります。
`getVisitorByToken`/`getExhibitorByToken`/`getMyInterests`/`logInterest` は個人情報を含む
公開APIのため `apiKey` 認証は課しませんが、代わりに `token`(推測困難なランダム文字列)と
完全一致する行が1件見つかった場合のみその1件を返す・更新する設計とし、一覧・検索の類は
一切提供していません
(`updateVisitor`/`updateExhibitor` も同じ token ベースの一致方式で更新対象を1件に限定します)。

`logInterest`/`getMyInterests` の `targetPublicId`(公開スキャンID/公開ブースID)は、あくまで
「読み取った相手を特定する」ためだけの公開IDであり、この値だけでは相手の氏名・連絡先等の
個人情報を取得・編集することはできません(`getVisitorByToken`/`updateVisitor`/
`getExhibitorByToken`/`updateExhibitor` は引き続き非公開の `token` 列でのみ照合します)。

## CORSに関する注意

GAS Web AppはブラウザからのCORSプリフライト(OPTIONSリクエスト)に対応していません。
そのため、`fetch` でJSONをPOSTする際は `Content-Type: application/json` を使わず、
**`Content-Type: text/plain` でJSON文字列をそのままbodyに入れて送信**してください。
`gas/Code.gs` の `doPost` はこの形式のbody(`e.postData.contents`)をJSONとしてパースします。
(`assets/js/api-client.js` の `callGasApi`/`callGasApiGet` はこの対応込みで実装済みのため、
フロント側で個別に意識する必要はない)

## GitHub Pagesでの公開手順

このリポジトリはフロントエンドがすべて静的ファイル(Vanilla HTML/CSS/JS)のため、
GitHub Pagesでそのまま公開できます。バックエンド(GAS Web App)は別途上記の手順で
デプロイ済みであることが前提です。

### 1. GitHubにリポジトリを作成してpushする

このプロジェクトの初期化(`git init`〜`git commit`)はすでに完了しています。
GitHub上で空のリポジトリ(例: `saitama-dx-event`)を作成したら、以下のコマンドで
リモートを追加してpushしてください(`<GitHubユーザー名>` は自分のものに置き換える)。

```powershell
git remote add origin https://github.com/<GitHubユーザー名>/saitama-dx-event.git
git branch -M main
git push -u origin main
```

### 2. GitHub Pagesを有効化する

1. GitHub上のリポジトリページで [Settings] タブを開く。
2. 左側メニューの [Pages] を開く。
3. 「Build and deployment」の「Source」で **Deploy from a branch** を選択する。
4. 「Branch」で **main** ブランチと **/(root)** フォルダを選択し、[Save] をクリックする。
5. 数分後、`https://<GitHubユーザー名>.github.io/saitama-dx-event/` で公開される
   (ページ上部に公開URLが表示される)。

公開後は、各画面に以下のURLでアクセスできる。

| 画面 | URL |
|---|---|
| イベントHP | `https://<GitHubユーザー名>.github.io/saitama-dx-event/` |
| 出展申込フォーム | `https://<GitHubユーザー名>.github.io/saitama-dx-event/exhibitor/` |
| 来場者申込フォーム | `https://<GitHubユーザー名>.github.io/saitama-dx-event/visitor/` |
| QRコード受付画面 | `https://<GitHubユーザー名>.github.io/saitama-dx-event/checkin/` |
| 管理ダッシュボード | `https://<GitHubユーザー名>.github.io/saitama-dx-event/admin/` |

### 3. 公開前チェックリスト

- [ ] `assets/js/api-client.js` の `GAS_API_CONFIG.BASE_URL` が、実際にデプロイした
      GAS Web AppのURL(`.../exec`)になっていることを確認する。
- [ ] GAS Web Appのデプロイ設定が「アクセスできるユーザー: 全員」になっていることを確認する
      (GitHub Pages上のフロントから呼び出せるようにするため)。
- [ ] GAS Web Appは `Access-Control-Allow-Origin: *` を返す仕様のため、GitHub Pages側で
      追加のCORS設定は不要(前述の「CORSに関する注意」を参照)。
- [ ] 個人情報を扱う画面(来場者申込フォーム・管理ダッシュボード)のため、公開範囲・
      管理ダッシュボードのAPIキー運用について、関係者と改めて確認する。

### 4. コードを更新した場合

ローカルで変更後、コミットしてpushすれば数十秒〜数分でGitHub Pagesに反映される。

```powershell
git add .
git commit -m "変更内容の説明"
git push
```

GAS側(`gas/Code.gs`)を更新した場合は、GitHubへのpushとは別に、
Apps Scriptエディタ側でも「デプロイを管理」から新バージョンを作成する必要がある点に注意
(上記「バックエンド(GAS)のデプロイ手順」参照)。
