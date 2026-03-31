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
・ https://koheips.github.io/maintelog-v16/?v=v16b-2026-03-30
・ 履歴カードに「編集」ボタン（青色）が表示されること
・ 作業内容マスターに ⠿ ドラッグハンドルが表示されること
・ カラーピッカーに白い円枠が表示されること（黒背景での視認性）

【重要】GitHub Pages キャッシュが残っている場合の対処
PCブラウザで反映されない場合:
  1. Ctrl+Shift+R（Mac: Cmd+Shift+R）でスーパーリロード
  2. または DevTools > Application > Storage > Clear site data

iPhoneホーム画面アプリで反映されない場合:
  1. アプリスイッチャーでアプリを完全終了
  2. Safariで ?v=v16b-2026-03-30 付きURLにアクセス
  3. 再度ホーム画面に追加し直す

v16b 変更内容
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
