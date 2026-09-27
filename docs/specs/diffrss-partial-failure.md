# diffRss: フィード取得失敗時の部分継続 仕様

- Date: 2026-09-26
- 対象バージョン: 0.22.0
- 状態: 実装済み

## 1. 背景と問題

`src/lib/rss-watcher.js` は、登録された複数の URL から順番にフィードを取得している。
このうち 1 つでも HTTP エラー・タイムアウト・パースエラーになると例外が外に投げられ、
その回の RSS 通知が全部止まる。

さらに今の既読状態は、全フィードのリンクをまとめた 1 本の配列として、1 つのキー `previous` に保存されている。
そのため「失敗したフィードを飛ばす」だけの修正では、失敗したフィードの既読状態が上書きで消える。
その結果、次に取得できたとき全記事が再送される。

## 2. 目的

- 一部の URL で取得に失敗しても、成功した URL の新着はいつも通り通知する
- 既読状態をフィードごとに別のエンティティキーで持つ
  - 失敗したフィードの状態には触れないようにする
- 失敗があったことを、管理者の LINE にすぐ知らせる
- 不要になったエンティティのキーを消せるようにする

## 3. 変更後の仕様

### 3.1 `urls` エンティティの形式

変更前（URL 文字列の配列）:

```json
["https://jvn.jp/rss/jvn.rdf", "https://gihyo.jp/feed/atom"]
```

変更後（`key` と `url` の組の配列）:

```json
[
  { "key": "ipa-alert", "url": "https://www.ipa.go.jp/security/alert-rss.rdf" },
  { "key": "jvn", "url": "https://jvn.jp/rss/jvn.rdf" },
  { "key": "gihyo", "url": "https://gihyo.jp/feed/atom" }
]
```

登録方法は今と同じ:

```bash
./scripts/maintain.mjs -k -X POST --json @secrets/urls.json 'maintain:?code=&key=urls'
```

#### 各要素のルール

| 項目 | ルール |
| --- | --- |
| `key` | 正規表現 `^[A-Za-z0-9_-]{1,84}$` に合うこと |
| `key` | 配列の中で重複しないこと |
| `url` | `http:` か `https:` の絶対 URL であること（`new URL()` で解釈できること） |
| `url` | 重複は許す（ただし 3.6 のとおり警告を出す） |

`key` をこう決める理由:

- エンティティのキーは `previous:${key}` になり、インスタンス ID は `@saver@previous:${key}` になる
- Durable Functions のインスタンス ID には次の決まりがある
  （[Durable Orchestrations Overview](https://learn.microsoft.com/en-us/azure/durable-task/common/durable-task-orchestrations)）
  - 長さは 1〜100 文字
  - `/ \ # ?` と制御文字は使えない
- durable-functions 3.4.0 のクライアントは、キーをエンコードせずに HTTP パス
  `entities/saver/<key>` に埋め込む
  - `%hh` 形式でエンコードしても、ホストがデコードして元の文字に戻してしまう
- 以上から、`key` は 84 文字以内（100 − `@saver@previous:` の 16 文字）とし、
  URL のパスにそのまま置いても安全な文字だけにする
- URL をそのままキーにする方式や、URL のハッシュをキーにする方式は採らなかった
  - 前者はこの制約に反する
  - 後者はキーを見てもどのフィードか分からない

### 3.2 `urls` の検証

- `maintain` API で `key=urls` を POST したときは、3.1 のルールで検証する
  - 違反があれば 400 を返し、保存しない
  - レスポンス本文は、違反 1 件につき 1 行の `#<位置> <理由>`（英語）
- diffRss の実行時も検証する（エンティティを直接書き換えた場合に備えるため）
  - `urls` が未登録か空配列なら、今まで通り何もしない
  - ルール違反の要素は警告ログ（3.10）を出して飛ばす
    - 旧形式の文字列要素もここで飛ばされる
    - 飛ばした要素は管理者にも通知する（3.8）
  - `key` が重複したときは最初の要素を使い、残りは同じように飛ばす
  - 有効な要素が 1 つも無ければ、エラーログを出し、管理者に通知して終わる（例外にはしない）

#### 理由の文言（レスポンス、ログ、管理者通知で共通）

| 違反 | 文言 |
| --- | --- |
| `urls` が配列でない | `"urls" is not an array`（位置は付けない） |
| 要素がオブジェクトでない | `entry is not an object` |
| `key` が無い、または文字列でない | `key is missing or not a string` |
| `key` の文字種・長さが不正 | `key "a/b" must match ^[A-Za-z0-9_-]{1,84}$` |
| `key` の重複 | `key "jvn" is duplicated` |
| `url` が無い、または文字列でない | `url is missing or not a string` |
| `url` が絶対 URL でない | `url "foo" is not an absolute URL` |
| `url` が `http:` / `https:` 以外 | `url "ftp://..." must use http or https` |

### 3.3 フィード取得

- 有効な要素すべての `url` を `Promise.allSettled` で並列に取得する
- 各要素の結果は「成功」か「失敗」のどちらかになる。失敗は次の 3 種類
  - HTTP エラー
  - タイムアウト
  - パースエラー
- 1 件ごとの取得にタイムアウトを設ける
  - 環境変数 `DIFFRSS_FETCH_TIMEOUT_MILLI_SEC` で指定する
  - 未設定、または正の数でなければ 30000
  - rss-parser の `timeout` オプションに渡す

#### 失敗の分類

rss-parser はエラーの型を区別しないので、メッセージで分類する。

| rss-parser のエラー | 分類 |
| --- | --- |
| `Status code <N>` | HTTP エラー |
| `Request timed out after <N>ms` | タイムアウト |
| `code` プロパティを持つもの（`ENOTFOUND` などのシステムエラー）、`Too many redirects` | その他 |
| 上記以外 | パースエラー |

### 3.4 既読状態の保存

#### キー

`previous:${key}`（例: `previous:jvn`）

#### 値

```json
{
  "url": "https://jvn.jp/rss/jvn.rdf",
  "links": ["https://jvn.jp/vu/JVNVU00000001/", "https://jvn.jp/vu/JVNVU00000002/"]
}
```

- `url` は取得した時点のフィード URL で、人が確認するための記録として入れる
- `links` には、フィードの項目のうち `link` が文字列のものを重複なしで入れる
- 保存されている `url` が今の `urls` の `url` と違っていても、`links` はそのまま差分に使う
  - このときは情報ログ（3.10）を出す
  - 差分はリンクが集合に含まれるかどうかだけで判定するので、次のどちらでも正しく動く
    - フィードが移転しただけなら、記事リンクは同じなので再送は出ない
    - 別のフィードに差し替えたなら、リンクが重ならないので全件が新着になる
- 保存されている値の形式が不正なら、警告ログ（3.10）を出し、初回（3.5）として扱う

#### `src/lib/entity.js` の変更

- 固定キー `previous` を `keys` から消す
- `previousKey(key)` を追加する。`previous:${key}` を返す
- `newEntityId(key)` の許可チェックを変える
  - 固定キー（`urls`, `schedule`, `lastRateError`）に加えて、
    `/^previous:[A-Za-z0-9_-]{1,84}$/` に合うキーも通す
- `newDeletableEntityId(key)` を追加する
  - `newEntityId` と同じだが、旧キー `previous` も通す
- `deleteEntity(entityId, client)` を追加する。`signalEntity(entityId, 'delete')` を呼ぶ

### 3.5 差分と通知

1. 取得に成功した要素ごとに `previous:${key}` を読む（読み込みは並列）
2. キーがある要素は、保存済みの `links` と比べて新着を出す
3. キーが無い要素（初回）は、新着を出さない
   - 今回取得したリンクを既読として保存するだけにする
   - 対象になるのは、切り替え直後の 1 回目と、フィードを新しく追加したとき
   - 次の回から新着だけが通知される
4. 新着を `urls` の順に並べて、今まで通り `LINE_ID` 宛てに送る（`リンク タイトル` の形式）
5. 失敗した要素は、キーを読むことも、新着を出すこともしない

### 3.6 既読状態の更新規則

| 要素の状態 | `previous:${key}` の扱い |
| --- | --- |
| 取得成功・キーが無い（初回） | `{ url, links }` で作る（通知はしない） |
| 取得成功・保存済みのリンク集合または `url` と違う | `{ url, links }` で上書きする |
| 取得成功・保存済みのリンク集合と `url` が同じ | 書き込まない |
| 取得失敗 | 触らない |
| `urls` から消された | 触らない（3.9 の DELETE で手で消す） |

- 書き込みは要素ごとに `signalEntity(..., 'post', value)` で行う
- 書き込みは LINE への送信より前に行う（6 章の未決事項を参照）
- 新着が 0 件でも、リンク集合が変わっていれば保存する
  - フィードから記事が消えた場合など
- 同じ `url` が別の `key` で登録されていたら警告ログ（3.10）を出す
  - 動作はそれぞれ独立して行う（同じ記事が 2 回通知されうる）

### 3.7 全件失敗のとき

- 「有効な要素が 1 つ以上あり、そのすべての取得に失敗した」場合を指す
- どのキーにも書き込まない。`LINE_ID` 宛てにも送らない
- 管理者に通知する（3.8）
- そのあと例外（`AggregateError`、メッセージは `All feeds failed to fetch`）を投げて、
  関数の実行を「失敗」として記録する
  - Application Insights で異常に気づけるようにするため

### 3.8 管理者への通知

#### 環境変数

| 名前 | 内容 |
| --- | --- |
| `LINE_ADMIN_ID` | 管理者宛ての送信先 ID（新設）。`LINE_ID` とは別に管理する |

- 未設定または空なら、管理者への通知はせずにログだけ出す
- `LINE_ID` と同じ値でも動く

#### 通知する条件

1 回の実行の中で、次のどれかが 1 件でもあれば、その回に 1 通送る。
回数を数えたり間隔を空けたりはしない。

- フィードの取得失敗（3.3）
- `urls` の検証で飛ばした要素（3.2）
- 有効な要素が 0 件（3.2）

#### 本文

米国英語で書く。例:

```
[AzFunBot] diffRss: 2 failed, 1 skipped
Failed: jvn https://jvn.jp/rss/jvn.rdf HTTP 503
Failed: gihyo https://gihyo.jp/feed/atom timed out after 30000 ms
Skipped: #4 key "a/b" must match ^[A-Za-z0-9_-]{1,84}$
```

有効な要素が 0 件のとき:

```
[AzFunBot] diffRss: no valid feeds in "urls"
Skipped: #1 entry is not an object
```

- 1 行目は要約。2 行目から 1 件につき 1 行
  - 失敗は `Failed: <key> <url> <reason>` の形
  - 飛ばした要素は `Skipped: #<1 から数えた位置> <reason>` の形
- 失敗の理由（`<reason>`）の書き方
  - HTTP エラー: `HTTP <status>`
  - タイムアウト: `timed out after <ms> ms`
  - パースエラー: `parse error: <message>`
  - その他: `<error.message>`
- 飛ばした理由は 3.2 の文言を使う
- 文字数の上限は `DIFFRSS_MAX_CHAR_LIMIT` に従い、超えた行は切り捨てる（`send-line.js` と同じ）

#### 送る順番と、送信失敗の扱い

1. まず新着を `LINE_ID` 宛てに送る
2. そのあとで管理者宛てに送る
- `LINE_ID` 宛ての送信が例外を投げても、管理者宛ての送信は行う。そのあと元の例外を投げ直す
- 管理者宛ての送信に失敗しても、エラーログ（3.10）を出すだけにする
  - 例外は投げない。本来の通知と既読状態の保存に影響させないため

#### `src/lib/send-line.js` の変更

- 送信先を引数で受け取れるようにする: `send(lines, context, to = process.env.LINE_ID)`
- 管理者宛ては `send(lines, context, process.env.LINE_ADMIN_ID)` で送る

### 3.9 エンティティの削除

#### `saver` エンティティ（`src/functions/saver.js`）

- `delete` 操作を追加する。`context.df.destructOnExit()` を呼んで、そのエンティティを消す

#### `maintain` API（`src/functions/maintain.js`）

- 受け付けるメソッドに `DELETE` を加える
- `DELETE ?key=...` は `deleteEntity` を呼び、`accept` を返す（処理は非同期）
- 消せるキー
  - `newEntityId` のチェックを通るキー（`previous:${key}` など）
  - 旧キー `previous`（DELETE のときだけ特別に許す）
- 許可されていないキーは、どのメソッドでも 400 を返す（今までは 500）
- POST の本文が JSON として読めなければ 400 を返す

使用例:

```bash
./scripts/maintain.mjs -k -X DELETE 'maintain:?code=&key=previous:jvn'
./scripts/maintain.mjs -k -X DELETE 'maintain:?code=&key=previous'
```

注意: `urls` や `schedule` も消せる。消すとその機能は、次に POST するまで何もしなくなる。

### 3.10 ログ

今回追加・変更するログは、すべて米国英語で出す（既存のログ `context.log({ ... })` はそのまま）。

| 場面 | レベル | メッセージ |
| --- | --- | --- |
| `urls` の要素を飛ばした | `warn` | `Skipped urls entry #<n>: <reason>` |
| `urls` が配列でない | `warn` | `Skipped urls: "urls" is not an array` |
| 有効な要素が 0 件 | `error` | `No valid feeds in "urls"` |
| 同じ `url` が別の `key` にある | `warn` | `Duplicate url <url> for keys <key1>, <key2>` |
| 取得失敗 | `warn` | `Failed to fetch <key> <url>: <reason>` |
| 初回（キーが無い） | `log` | `First fetch for <key>; saved <n> links without notifying` |
| 保存済みの `url` と違う | `log` | `Feed url for <key> changed from <old> to <new>` |
| 保存済みの値の形式が不正 | `warn` | `Invalid state for previous:<key>; treating as first fetch` |
| `LINE_ADMIN_ID` が未設定 | `log` | `LINE_ADMIN_ID is not set; skipped admin notification` |
| 管理者宛ての送信に失敗 | `error` | `Failed to notify admin: <error.message>` |
| 実行のまとめ | `log` | `diffRss summary: <n> succeeded, <m> failed, <s> skipped, <f> first-time, <k> new items, <w> writes` |

- `<reason>` は 3.2 の文言、または 3.8 の失敗理由の書き方に従う
- 有効な要素が 0 件のときは、実行のまとめは出さない

### 3.11 データ移行

- 移行はしない
- `secrets/urls.json` を新しい形式に手で書き直し、`maintain` で登録し直す
- 旧キー `previous` は使わなくなり、コードからも参照しない
  - 3.9 の DELETE で消す
- 切り替え直後の 1 回目は全フィードが初回になる（3.5）
  - 通知は出ず、既読状態が作られるだけ

### 3.12 ドキュメント

- README に次を書き足す
  - `urls` の形式と 3.1 のルール
  - `maintain.mjs` での登録例と削除例
  - 環境変数 `LINE_ADMIN_ID` と `DIFFRSS_FETCH_TIMEOUT_MILLI_SEC`（「Define them」の節）

## 4. 変わらない点

- 実行スケジュール（`DIFFRSS_SCHEDULE`）
- `LINE_ID` 宛ての通知の形式と文字数制限（`DIFFRSS_MAX_CHAR_LIMIT`）
- `saver` エンティティの `get` / `post` 操作
- `schedule` エンティティと `tell` 関数

## 5. テスト観点（vitest）

- `urls` の検証（`test/feed-list.test.js`）
  - 正しい要素だけを通す
  - `key` の文字種と長さ（84 文字は通り、85 文字は落ちる）
  - `key` の重複
  - `url` が絶対 URL でないとき、`http:` / `https:` 以外のとき
  - 旧形式の文字列要素
  - 各違反の理由の文言が 3.2 の表と一致する
- エンティティのキー（`test/entity.test.js`）
  - `previous:jvn` は通る
  - `previous:` / `previous:a/b` / `previous` は拒否する
  - DELETE 用の ID では `previous` も通る
- フィードの監視（`test/rss-watcher.test.js`）
  - 全要素成功: 新着が `LINE_ID` 宛てに出る。変化のあった要素のキーだけに書き込む。管理者には送らない
  - 一部失敗
    - 成功した分だけ通知される
    - 失敗した要素のキーには読み書きしない
    - 管理者に失敗の一覧が 1 通届く
  - 失敗していた要素が復旧: 本当の新着だけが通知される（再送が大量に出ない）
  - 全件失敗: 管理者に通知したあと例外になる。書き込みは 0 件
  - 有効な要素が 0 件: 管理者に通知し、例外にならない。取得もしない
  - キーが無い要素: 新着を出さずにキーが作られる
  - 保存済みの `url` と違う: `links` で差分を取り、新しい `url` で保存される
  - 管理者通知の本文: 3.8 の例と同じ形式になる
  - `LINE_ADMIN_ID` が未設定: 管理者への送信を呼ばない
  - 管理者宛ての送信が例外を投げる: 本来の処理は正常に終わる
  - `LINE_ID` 宛ての送信が例外を投げる: 管理者には送られ、例外が伝わる
  - `DIFFRSS_FETCH_TIMEOUT_MILLI_SEC` が未設定なら 30000 が rss-parser に渡る
  - 失敗の分類（3.3）
- `maintain` API（`test/maintain-handler.test.js`）
  - 不正な `urls` の POST で 400 が返る
  - DELETE で `delete` が送られる
  - DELETE では旧キー `previous` が通る
  - GET / POST では旧キー `previous` が拒否される

`parser.parseURL`、エンティティアクセス、LINE 送信は引数で差し替えられるようにし、
検証・差分・更新規則・管理者通知の本文作りは純粋関数に分けている。

## 6. 未決事項

1. **送信失敗時の扱い（今回の範囲外）**
   - 今は既読状態を保存してから LINE に送っている
   - `LINE_ID` 宛ての送信に失敗すると、その回の新着は二度と通知されない
   - 保存の順番を「送信成功のあと」に変えるかは、別に決める

## 7. 運用上の注意

- 取得失敗が続くフィードがあると、実行のたびに管理者へ 1 通届く
  - LINE 公式アカウントの無料メッセージ数（月ごとの上限）を使う
  - 長く失敗が続くフィードは、`urls` から外すかキーごと消して対応する

## 8. 実装の所在

| ファイル | 内容 |
| --- | --- |
| `src/lib/feed-list.js` | `urls` の検証（3.1, 3.2） |
| `src/lib/entity.js` | キーの組み立てと許可チェック、削除（3.4, 3.9） |
| `src/lib/rss-watcher.js` | 取得・差分・保存・通知（3.3〜3.8, 3.10） |
| `src/lib/send-line.js` | 送信先の引数化（3.8） |
| `src/lib/maintain-handler.js` | `maintain` API の処理本体（3.2, 3.9） |
| `src/functions/maintain.js` | `maintain` API の登録（DELETE を追加） |
| `src/functions/saver.js` | `delete` 操作（3.9） |
| `src/functions/diffRss.js` | 新しい `watch` の呼び出し |
