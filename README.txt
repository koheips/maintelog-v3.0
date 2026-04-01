適用手順
1 ZIPを展開
2 GitHub の Code タブで index.html を開く
3 Edit で全文を置換して Commit changes
4 同様に app.js / manifest.json / sw.js を全文置換して Commit changes
5 snippet_index_tail.html は index.html の末尾差し替え参考用

重要
・ localStorage の削除はしない
・ 反映確認は PCブラウザで 先に行う
・ 変更後は Safari で通常表示を確認してから ホーム画面追加アプリで確認

反映確認
・ https://koheips.github.io/maintelog-v16/?v=v17-20260401
・ 履歴カードに「編集」ボタン（青色）が表示されること
・ 作業内容マスターに ⠿ ドラッグハンドルが表示されること
・ カラーピッカーに白い円枠が表示されること（黒背景での視認性）

【重要】GitHub Pages キャッシュが残っている場合の対処
PCブラウザで反映されない場合:
  1. Ctrl+Shift+R（Mac: Cmd+Shift+R）でスーパーリロード
  2. または DevTools > Application > Storage > Clear site data

iPhoneホーム画面アプリで反映されない場合:
  1. アプリスイッチャーでアプリを完全終了
  2. Safariで ?v=v17-20260401 付きURLにアクセス
  3. 再度ホーム画面に追加し直す

v16c 追加変更内容
・ 動的CSS注入（ensureDynamicStylesV5）を完全廃止
  → 全スタイルをindex.htmlの<style>に一元統合（反映確実性を向上）
・ localStorage 超過を try-catch で捕捉しユーザーに警告
・ JSON インポート時のスキーマ検証を強化
・ 記録IDをcrypto.randomUUID()に変更
・ tasksByCat のハードコード区分を除去（区分マスター連動）
・ 推奨作業 .recoItem スタイルを正式定義
・ 履歴リストに「編集」ボタン追加（日付・泊数・作業・メモを修正可能）
・ カラーピッカーに白枠+多重シャドウを追加（黒背景での視認性向上）
・ カラーピッカー横にリアルタイムプレビューpillを追加
・ 作業内容マスターの並び替えをドラッグ＆ドロップ（PC）＋タッチ（iPhone）に変更
・ Service Workerをstale-while-revalidateに変更
・ フッタに著作権表記を追加（©Kohei Sekine (2026)）

・ 区分マスターの上下移動をドラッグ&ドロップ（PC）＋タッチ（iPhone）に変更（上へ/下へボタン廃止）

【v17 キャッシュ完全クリア手順】━━━━━━━━━━━━━━━━━━━━

★ GitHub へのアップロード後、必ず以下の手順でキャッシュをクリアしてください ★

── PCブラウザ（Chrome推奨）──
1. DevTools を開く（F12 または Cmd+Option+I）
2. Application タブ → Storage → 「Clear site data」ボタンをクリック
3. Application タブ → Service Workers → 登録済みSWの「Unregister」をクリック
4. ページを通常リロード（F5）

または：アドレスバーにURLを入力して ?nocache=1 を末尾に付けてアクセス
例: https://koheips.github.io/maintelog-v16/?nocache=1

── iPhone Safari ──
1. 設定アプリ → Safari → 「履歴とWebサイトデータを消去」
2. Safari でURLに ?v=v17-20260401 を付けてアクセス
   例: https://koheips.github.io/maintelog-v16/?v=v17-20260401
3. ホーム画面のアイコンからではなく Safari から直接アクセスすること
4. 問題が続く場合: ホーム画面のアイコンを長押し → 削除 → Safari から再度「ホームに追加」

── GitHub Pages のキャッシュ ──
・GitHub Pages 自体に10分程度のキャッシュがあります
・コミット後すぐ反映されない場合は10分待ってからリロードしてください

v17 変更内容
・区分マスターの上下移動をドラッグ&ドロップ（PC）＋タッチ（iPhone）に変更
・Service Worker を Network First 戦略に変更（キャッシュ問題を根本解決）
・旧キャッシュを activate 時に全削除するよう変更
・index.html に no-cache メタタグを追加
