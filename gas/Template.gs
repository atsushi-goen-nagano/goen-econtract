// ===== 契約書のひな形（指示書7章の本文）=====
// setupAll を実行すると、この内容で Googleドキュメント「電子契約書ひな形」を作る。
// 以後の文面修正は、プログラムではなくそのドキュメントを直接編集する（行政書士さんの修正もそこで）。
// 《…》が差し込みの印。壊すと checkTemplate が知らせる。

var TEMPLATE_DOC_NAME = '電子契約書ひな形';
var COPY_NOTICE = '【控】印刷した本書は電子契約書の控え（写し）です。原本は電子データにて保管しています。印刷した控えに署名・押印はしないでください。';
var SIG_PLACEHOLDERS = ['《署名_甲》', '《署名_乙》'];

// 本文の設計図。t: title/h/p/table/redbox/sig/notice
var TEMPLATE_BLOCKS = [
  { t: 'notice', text: '【控】印刷した本書は電子契約書の控え（写し）です。原本は電子データにて保管しています。' },
  { t: 'title', text: '作業契約書' },
  { t: 'p', text: '契約番号：《契約番号》　　契約日：《契約日》', align: 'right' },
  { t: 'h', text: '前文' },
  { t: 'p', text: 'お客様（以下「甲」）と株式会社GOEN（以下「乙」）は、甲が依頼する作業について、次のとおり契約を結びます。' },
  { t: 'table', rows: [
    ['甲（お客様）ご住所', '《甲住所》'],
    ['甲（お客様）お名前', '《甲氏名》'],
    ['甲（お客様）ご連絡先', '電話：《甲電話》　メール：《甲メール》'],
    ['乙', '株式会社GOEN　代表取締役　小口 敦志'],
    ['乙 所在地', '〒381-2203　長野県長野市真島町川合777-1'],
    ['乙 連絡先', '電話：《乙電話》　メール：info@goen-nagano.com'],
    ['乙 担当者', '《乙担当者》']
  ] },
  { t: 'h', text: '第1条（作業内容）' },
  { t: 'p', text: '乙は、甲の依頼により、次の作業を行います（該当するものに☑）。' },
  { t: 'p', text: '《チェック:遺品整理》遺品整理　《チェック:家財整理》家財整理　《チェック:特殊清掃》特殊清掃　《チェック:消臭・除菌》消臭・除菌　《チェック:空き家片付け》空き家片付け　《チェック:ゴミ屋敷清掃》ゴミ屋敷清掃　《チェック:その他》その他（《その他内容》）' },
  { t: 'p', text: '作業の範囲（お部屋・品物・残すもの）：《作業範囲》' },
  { t: 'p', text: '2　特殊清掃・消臭は、建物の状態により臭いや汚れを完全に取り除けない場合があります。乙は事前に見込みを説明し、できる限りの対応を行います。' },
  { t: 'h', text: '第2条（作業場所・日程）' },
  { t: 'table', rows: [
    ['作業場所', '《作業場所》'],
    ['作業予定日', '《作業開始日》　〜　《作業終了日》'],
    ['立ち会い', '《チェック:立会あり》あり　《チェック:立会なし》なし'],
    ['鍵のお預かり', '《チェック:鍵あり》あり（返却日：《鍵返却日》）　《チェック:鍵なし》なし']
  ] },
  { t: 'p', text: '天候や建物の状況などやむを得ない理由で日程を変える場合は、甲乙で相談して決めます。' },
  { t: 'h', text: '第3条（料金）' },
  { t: 'p', text: '料金は次のとおりです（金額はすべて税込）。' },
  { t: 'table', rows: [
    ['作業費', '《作業費》 円'],
    ['買取額（概算・差し引き）', '− 《買取額》 円'],
    ['合計お支払い額', '《合計》 円']
  ], boldLast: true },
  { t: 'p', text: '備考', bold: true },
  { t: 'p', text: '・買取額は概算です。確定額は第8条により決めます。\n・お見積書は、3日以内にメールまたはLINEにてお渡しいたします。郵送をご希望の場合は3日以内に発送いたしますので、1週間くらいでお手元に届く予定です。' },
  { t: 'h', text: '第4条（お支払い）' },
  { t: 'p', text: '1　お支払いは作業完了後、次のいずれかの方法で一括にてお願いします。' },
  { t: 'p', text: '《チェック:支払現金》現金（作業完了時に一括）　《チェック:支払振込》銀行振込（作業完了日から《振込期限日数》日以内に一括。振込手数料は甲の負担）' },
  { t: 'p', text: '《チェック:支払2回》2回払い：1回目 《分割1回目金額》円を《分割1回目日》までに《分割1回目方法》でお支払い、残金 《分割残金》円を《分割残金日》までに《分割残金方法》でお支払い' },
  { t: 'p', text: '2　上記以外の分割払い・クレジットカード払いはお受けしていません。クーリングオフの場合、お支払い済みの金額は全額お返しします。' },
  { t: 'h', text: '第5条（追加料金）' },
  { t: 'p', text: '1　見積もり時に確認できなかった次のような事情がわかった場合に限り、追加料金が発生することがあります。\n・押入れ・物置・床下・屋外などから、見積もり時になかった量の品物が見つかった場合\n・見積もり後に、甲から作業範囲の追加を依頼された場合\n・見積もり時に確認できなかった汚れ・臭い・害虫などで、追加の清掃や消臭が必要になった場合' },
  { t: 'p', text: '2　追加料金が発生するときは、作業を進める前に必ず甲へ内容と金額を説明し、同意をいただいてから行います。同意がない追加作業の料金はいただきません。' },
  { t: 'h', text: '第6条（キャンセル）' },
  { t: 'p', text: '1　甲の都合で契約を取り消す場合、次のキャンセル料をいただきます（第3条の合計額に対する割合）。' },
  { t: 'table', rows: [
    ['取り消しのご連絡日', 'キャンセル料'],
    ['作業予定日の8日前まで', '無料'],
    ['7日前〜3日前', '20％'],
    ['2日前〜前日', '30％'],
    ['作業当日', '50％']
  ], headerRow: true },
  { t: 'p', text: '2　日程の変更は、作業予定日の前日までにご連絡いただければ無料です。\n3　ご家族のご不幸・ご入院など、やむを得ない事情がある場合はご相談ください。\n4　クーリングオフの対象となる場合は、本条にかかわらず、キャンセル料は一切いただきません（下記「クーリングオフのお知らせ」参照）。' },
  { t: 'h', text: '第7条（貴重品・思い出の品）' },
  { t: 'p', text: '1　作業前に、残しておきたい品物・探してほしい品物（通帳、印鑑、権利書、写真、手紙など）を甲から乙へお伝えください。' },
  { t: 'p', text: '探してほしい品物：《探してほしい品物》' },
  { t: 'p', text: '2　乙は作業中に現金・貴重品・重要書類・写真・手紙など思い出の品を見つけた場合、処分せずに取り分け、甲へお渡しします。\n3　甲が処分を決めた品物のうち、ご供養を希望されるものは、乙が手配します（費用は第3条に含むか、事前にお知らせします）。' },
  { t: 'h', text: '第8条（買取品との相殺）' },
  { t: 'p', text: '1　甲が希望する場合、乙は品物を買い取り、その金額を料金から差し引くことができます。\n2　買い取る品物と金額は、別紙「買取明細書」に記載し、甲の同意を得て確定します。買取は、本人確認書類の提示をお願いします。' },
  { t: 'h', text: '第9条（損害が起きた場合）' },
  { t: 'p', text: '乙の作業によって建物や品物を傷つけた場合、乙は速やかに甲へ報告し、誠意をもって修理または弁償します。' },
  { t: 'h', text: '第10条（個人情報）' },
  { t: 'p', text: '乙は、作業で知った甲・故人・ご家族の個人情報やご事情を、本契約の目的以外に使わず、第三者に漏らしません。作業写真は記録のためにのみ使い、甲の同意なく公開しません。' },
  { t: 'h', text: '第11条（協議）' },
  { t: 'p', text: 'この契約に定めのないことや、解釈に迷うことがあるときは、甲乙が誠意をもって話し合って決めます。' },
  { t: 'redbox', title: 'クーリングオフのお知らせ', lines: [
    'この契約が特定商取引法の訪問販売にあたる場合、甲は、本書面を受け取った日から数えて8日以内であれば、書面または電子メール等により、無条件で契約を解除（クーリングオフ）できます。',
    '・クーリングオフの場合、キャンセル料・損害賠償・違約金は一切かかりません。',
    '・すでに作業が行われていても、その料金を支払う必要はありません。お支払い済みの金額は、乙が速やかに全額お返しします。',
    '・乙が事実と違うことを告げたり、威圧したりしてクーリングオフを妨げた場合は、8日を過ぎてもクーリングオフできます。',
    '・通知先：株式会社GOEN　〒381-2203 長野県長野市真島町川合777-1　メール：info@goen-nagano.com'
  ] },
  { t: 'h', text: '電子での受け取りの承諾' },
  { t: 'p', text: '甲は、本契約書の控えを紙ではなく、次の方法で受け取ることに承諾します。' },
  { t: 'p', text: '《チェック:受取LINE》LINE　《チェック:受取メール》電子メール（《承諾メール》）　《チェック:受取紙》紙での受け取りを希望する' },
  { t: 'p', text: 'PDFファイルが開けない・届かない場合は、乙へご連絡ください。紙の控えをお渡しします。' },
  { t: 'h', text: '署名' },
  { t: 'p', text: '甲乙は、上記の内容に合意し、本契約を締結します。' },
  { t: 'sig' },
  { t: 'notice', text: COPY_NOTICE }
];

// ===== ひな形ドキュメントを作る（setupAll から1回だけ呼ばれる） =====
function createTemplateDoc_(folder) {
  var doc = DocumentApp.create(TEMPLATE_DOC_NAME);
  var body = doc.getBody();
  body.setPageWidth(595.3).setPageHeight(841.9); // A4縦
  body.setMarginTop(50).setMarginBottom(50).setMarginLeft(56).setMarginRight(56);
  body.setAttributes(baseAttrs_(9));

  // 右上の「控」枠（ヘッダー・画像）
  var header = doc.addHeader();
  var hp = header.getParagraphs()[0] || header.appendParagraph('');
  hp.setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
  var img = hp.appendInlineImage(Utilities.newBlob(Utilities.base64Decode(KAE_PNG_BASE64), 'image/png', 'kae.png'));
  img.setWidth(44).setHeight(44);

  // 全ページ下部の控え文言（フッター・8pt）
  var footer = doc.addFooter();
  var fp = footer.getParagraphs()[0] || footer.appendParagraph('');
  fp.setText(COPY_NOTICE);
  fp.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  fp.editAsText().setFontSize(8);

  var first = true;
  TEMPLATE_BLOCKS.forEach(function (b) {
    var p;
    var para = function (text) {
      if (first) { p = body.getParagraphs()[0]; p.setText(text); first = false; }
      else p = body.appendParagraph(text);
      p.setAttributes(baseAttrs_(9));
      return p;
    };
    if (b.t === 'notice') { p = para(b.text); p.editAsText().setBold(true).setFontSize(8); }
    else if (b.t === 'title') { p = para(b.text); p.setAlignment(DocumentApp.HorizontalAlignment.CENTER); p.editAsText().setFontSize(16).setBold(true); p.setSpacingBefore(6).setSpacingAfter(6); }
    else if (b.t === 'h') { p = para(b.text); p.editAsText().setBold(true).setFontSize(10); p.setSpacingBefore(8).setSpacingAfter(2); }
    else if (b.t === 'p') { p = para(b.text); if (b.align === 'right') p.setAlignment(DocumentApp.HorizontalAlignment.RIGHT); if (b.bold) p.editAsText().setBold(true); }
    else if (b.t === 'table') {
      var tbl = body.appendTable(b.rows);
      tbl.setBorderColor('#999999').setBorderWidth(0.75);
      tbl.setColumnWidth(0, 150);
      for (var r = 0; r < tbl.getNumRows(); r++) {
        for (var c = 0; c < tbl.getRow(r).getNumCells(); c++) {
          var cell = tbl.getCell(r, c);
          cell.setPaddingTop(3).setPaddingBottom(3).setPaddingLeft(5).setPaddingRight(5);
          cell.editAsText().setFontSize(9).setBold(false);
          if (c === 0 || (b.headerRow && r === 0)) { cell.setBackgroundColor('#f1f1f1'); cell.editAsText().setBold(true); }
          if (b.boldLast && r === tbl.getNumRows() - 1) cell.editAsText().setBold(true);
        }
      }
    }
    else if (b.t === 'redbox') {
      var rt = body.appendTable([[b.title + '\n' + b.lines.join('\n')]]);
      rt.setBorderColor('#cc0000').setBorderWidth(2);
      var rc = rt.getCell(0, 0);
      rc.setPaddingTop(6).setPaddingBottom(6).setPaddingLeft(8).setPaddingRight(8);
      var txt = rc.editAsText();
      txt.setFontSize(9).setForegroundColor('#cc0000');
      txt.setBold(0, b.title.length - 1, true);
      txt.setBold(b.title.length + 1, b.title.length + b.lines[0].length, true);
    }
    else if (b.t === 'sig') {
      var st = body.appendTable([
        ['区分', '署名', '日付'],
        ['甲（お客様）', '《署名_甲》', '《甲署名日》'],
        ['乙（株式会社GOEN 担当者）', '《署名_乙》', '《乙署名日》']
      ]);
      st.setBorderColor('#999999').setBorderWidth(0.75);
      st.setColumnWidth(0, 130).setColumnWidth(1, 220).setColumnWidth(2, 130);
      for (var rr = 0; rr < 3; rr++) for (var cc = 0; cc < 3; cc++) {
        var sc = st.getCell(rr, cc);
        sc.setPaddingTop(6).setPaddingBottom(6).setPaddingLeft(5).setPaddingRight(5);
        sc.editAsText().setFontSize(9).setBold(rr === 0 || cc === 0);
        if (rr === 0 || cc === 0) sc.setBackgroundColor('#f1f1f1');
        if (rr > 0 && cc === 1) st.getRow(rr).setMinimumHeight(70);
      }
    }
  });
  doc.saveAndClose();
  var file = DriveApp.getFileById(doc.getId());
  file.moveTo(folder);
  return file.getId();
}

function baseAttrs_(size) {
  var a = {};
  a[DocumentApp.Attribute.FONT_SIZE] = size;
  a[DocumentApp.Attribute.LINE_SPACING] = 1.3;
  a[DocumentApp.Attribute.SPACING_AFTER] = 2;
  return a;
}

// ===== ひな形の点検：印の過不足を返す =====
function checkTemplate(docId) {
  var doc = DocumentApp.openById(docId);
  var text = doc.getBody().getText();
  var found = {}, m, re = /《[^》]*》/g;
  while ((m = re.exec(text))) found[m[0]] = true;
  var expected = PLACEHOLDERS.concat(SIG_PLACEHOLDERS);
  var missing = expected.filter(function (k) { return !found[k]; });
  var unknown = Object.keys(found).filter(function (k) { return expected.indexOf(k) < 0; });
  var footerOk = /印刷した控えに署名・押印はしないでください/.test(doc.getFooter() ? doc.getFooter().getText() : '');
  return { ok: !missing.length && !unknown.length && footerOk, missing: missing, unknown: unknown, footerOk: footerOk };
}

// ===== ひな形から署名入りPDFを作る =====
// map: 《印》→値、sigs: {customer: Blob, staff: Blob}
function buildPdf_(templateId, workFolder, map, sigs, pdfName) {
  var copy = DriveApp.getFileById(templateId).makeCopy('一時_' + pdfName, workFolder);
  var pdf;
  try {
    var doc = DocumentApp.openById(copy.getId());
    var body = doc.getBody();
    Object.keys(map).forEach(function (k) {
      body.replaceText(escapeRe_(k), String(map[k]));
    });
    insertSignature_(body, '《署名_甲》', sigs.customer);
    insertSignature_(body, '《署名_乙》', sigs.staff);
    doc.saveAndClose();
    pdf = DriveApp.getFileById(copy.getId()).getAs('application/pdf').setName(pdfName);
  } finally {
    try { Drive.Files.remove(copy.getId(), { supportsAllDrives: true }); } catch (e) { copy.setTrashed(true); }
  }
  return pdf;
}

function insertSignature_(body, key, blob) {
  var hit = body.findText(escapeRe_(key));
  if (!hit) throw new Error('ひな形に ' + key + ' がありません');
  var textEl = hit.getElement().asText();
  var para = textEl.getParent();
  textEl.setText('');
  var img = para.asParagraph().insertInlineImage(0, blob);
  var w = 200;
  img.setWidth(w).setHeight(Math.round(sigRatio_(blob) * w));
}

// 署名PNGの縦横比（画面からは3:1で送られてくる）。読み取れなければ 1/3
function sigRatio_(blob) {
  try {
    var b = blob.getBytes();
    var w = ((b[16] & 255) << 24) | ((b[17] & 255) << 16) | ((b[18] & 255) << 8) | (b[19] & 255);
    var h = ((b[20] & 255) << 24) | ((b[21] & 255) << 16) | ((b[22] & 255) << 8) | (b[23] & 255);
    if (w > 0 && h > 0) return h / w;
  } catch (e) {}
  return 1 / 3;
}

function escapeRe_(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

var KAE_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAALQAAAC0CAYAAAA9zQYyAAAKVUlEQVR42u2de4wdVR3HP2dbu2wftNsH0FQQ0MQiPiKnIb6lCbFqjRJRRBRBIjW+Sip/aBDtH4aH0WD/AKOFKOAfGtIQQK0QAj6qDRSmpbSNLQSsfWzt+0Xbbbe7P/84p+lm3e7euXfm3pm5308yadLMzJ2d+dxzz/x+5/yOMzOEqAodugVCQgshoYWQ0EJIaNG+jM3iJIlzCpWIhvFmrtFzuHrDdpJYFFHuDsksiki9jqVqoSWyKHpr3SGZRZVa6w7JLKoktcJ2graKQ6t1FmVqpTsks6iS1OpyCJQpJJ8sj1DLm1sfOs0HSGbRzAZxJDc71DKLKo3lUB9aoOGjQkhoISS0EBJaSGghJLQQEloICS2EhBYSWggJLYSEFkJCCyGhhYQWQkILIaGFkNBCSGiByhhQuqnwq4AZaQ7xZp8rwHV/Gbgh5WGLvdlKKVxhoeMvzoUp9l9TkOvuAq5MecyPpG/1uxxbU+7/34Jc97Y6jtkhfasv9LY2Enqn9FULXVQp9qfc/6Q3OyZ9qy/03pT7HyrIdR9Nuf8JqdseQvem3P94Qa77SEmvW0LnzLEyiuHNjgMDKQ7pk7rtIXTaB32yQNc+kNO+ErrE9KfcXysUSOhCYzm2igJlCosutI2Skv4UsBjoAfYBB+MLXG/sf/fHL4Vl0NqnaVwmJM7dkuF9c3HriE50xm0iMBmYBswCFnizFyV0cYWu5aVxTgH/zknAkhK8dKvLUTD26xaU635IaAktoduIo7oFp7tzZUi3S2hl5Cp1LyQ0mca1q0yfhJbQVWJAcWganpo0jRAP3eHNrAJhQIVE2zwOfRXwAHA8cW4zYUD+4SFJjcHMTHn+2xPnFsT70AV0A+cCG73ZJ+UwyhTmRCfw9rhlyRVn+P//SA0J3c781ZvNHaX7tBM4p5Zogjc7a5jjJwMHaryeG73ZQzV06eYBT6LBSYL6ZnbXwkHdKgldBsZLaAlNRQrgTALGUO70spPQ4hTTU+y7R65I6KLfnwsof72NcRK6/Lwpo/NcWAGhOxPnnIQuN1m1Sm9Jse/mAt+PsyW0Wui0LfQrBb4f01BipSGeA24kpLx3ArsJ8/l6CQmIkw0mCuYBK2Imsoswh276oC/6xIz+jjQZzo0Ffh5TgdclNHUXYNkAbMjxI/rjoPVjnM7CvTrkAdJgyG4KcHmNu/d4s2ZWFU2Aj6fYv9AyK/VdW4vUKB9LcZ9faHKDsQd4Co3laBu2Anc32HLNT/F5T7Yw+XM1sM6bvSKhK4o3ewl4qQFJxgGfSHHI8hb+udcBn02cWw08Ajzhzf4locVgvk7ta7687M220PrKrZfF7e7EudeBZ4HngVXABm/Wr7AdbTl+YwJwe4pD/lhAFy4GvgbcD6wFDiXO3SCh25NF1Db++RR/KsGv9Xiyi81L6BK1zu8EvpfikO2EmHsrmUwFis1I6OxlPid2H9IkZX7mzVo9q3oWFVisSEJnK/NZwOOkG7uxB1hKC8egJM7NBC6pcfceCd0eMncCvwfel/LQJd4s65Jj70o5+eABahvAb0UXWmG7Gh64NztcQ3r7ceAjpF+F674cLvtb8ZpWxj5v/6AGbByhHO804FLCeJbuGs+71Zv1SujySdxBqAnyXeAvwA9H2HcO8Ftgdh0ftcSbHSCfX97r45YlG1FipVQinw3cBCwELor//Y8z7NsF3AZ8v877uBq4o2y3SEKXQ+RLgW8CXxkmOjFumL7yzVHmmdRfpvc6b3aiZCt2PSOhi82nE+cWAx8eLWKQONdNyJotBN7c4Ocu8mabSDeu5EjiXB+tS2zsBf4moYvNwhr2mZ049xvgC9ReLGYkHvNm9YbpekgXEsySR4dOqEBhu1LyIcKsmSxkfrbBF7Wnad0KvXeiWd+VYBnw9wzOsxyY783eaOAc99KawuM/9mabJXRzX+zmAF8in4pBnwe2NfiluKrRGK43Wxu7SX1NLPh+qze7C5UCyz9WnDj3gcS5nybO/Zswfen6HD5qnDfbBVxNfeuMLAWu9WZ9GU06+CXwQeAPOUY++oE/Ax/1ZvegAf65Dvy5gjCxcz7phmfSSCkDb7YqcW4h8KsUUYEF3uxRsp9J8wIhQjMjyv0e4B3xfkyPW1e89rGDIiMDUdY+QujwCGFy8C5gB7AJWAes8GYHNQUrW3lnEGZLXwK8G3g/8DaavwzDxkEiLU2cuxaYO8pxTwFfzXsGtzfbDTwWN1HwFnoeIaXcKp4AFsd5hYP5BvDyGUa0HQJu82b3SS31oRkmNUwLVnpaBrzXm31mGJmJCZFf8P9ZvHuBt0pmtdBnYlPs541vwmcdAR4Efu7NXqth/zsIYz66gIeBu2o8TrSr0N6sP3Fubew758WW2LLen2bUmzfbkzj3RWB9i2dqi5JFOVbnLPRN3uyZOr9wy6WPhC5DP5oRIi8XA7fGln07oXjkXsK6KEfj1ksIjfUDAy1aMPRM1+8IS2N0DFqbcTwwAZhCGPQ/AzgfON+bLZDQ2bKmYNfTTRhmmkaisjZ2J4EFinJkywbgBEJUQeg4AH59iqjI7/RIJTQl7kdvAe4BLvdms4GH9Ej1Ulg2obcSkh+PAM8X6aVLSOhahe6N3YlfA/+UxKLMQq8BLogDcYQot9DxxVAyC03BEhJaCHU52pBjsRt0gJD2Phz/79iQ1Hc/YUjqaC+xEwjFa0hRqGZpHXMjXWzEOggp8M5B29mE9Hc3obTuWAldfdYBU7KenpQ4d25KoQ95s0XkO+5jqoSm8qtinaBNUvHebJ/60EJIaCEktBASWkhoISS0EBJaCAkthIQWEloICS2EhBZCQguBRtsxwtDJhcB5hDIJO4F9cXuD0+Oej3O63Fd/if/WMUPGRw8uD9YNTCWUB5tFWJ/x20Ve77tqQk/M6DxzCWt9F7Xc13mJc62a+X6LuhzN4yL9vqjLUeSfwysJhcW3Ddp6gD3AfkKh8hPxZ/Iy4Dt6pBK6yKwFron9uzxQIUgU5aCJ04B2E5YTzosDUkBCN5s8lyw7KAUkdLPJa8H2Q4Qq/EJCN7Xb8Sqh4mjWrCxz/FiUO2z3Yg7nXKbHL6FpYbSDjNdAfFCPH4XtWsT6DM+1C7imju5GPyH1fZwQ7hu69TN6ya+iMYawsP24YbaJDL/8s4TOgM0ZnWcFcHNc3ngkfkJYkHM/YQzH/lh+y9psTMt4wniOU2M6uuMXWkLT+Iqv9dJDiGU/7M2ervFF9Dn9eIM3O7X24na10BknWBLnfkCojjmJMBqsM/5kDsRWozf+ezB+AbYAr8UoiVAfunBS36nHJTTAX0hoISS0EBJaCAkthIQWEloICS2EhBZCQgshoYWEFkJCCyGhhZDQQkhoIaGFkNBCSGghJLQQmQjdwqURBJWrA2K5Ce3NnKQWRZR5JDfHFunbJYT60ELUKnSabocQNKfgkGuohZbUoiwyq8sh2rMPrVZalKF1TtVCS2pRdJkBXD01vBWiE0UTuaE+tFprUUSZ626h1WKLIkmcudBCoEyhEBJaCAktJLQQElqIVvM/77gRbdhlKvwAAAAASUVORK5CYII=';
