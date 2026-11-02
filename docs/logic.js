// ===== 純粋な関数だけ（GASでもNodeでも動く。外部サービスは呼ばない） =====
// 契約書に差し込む値の作り方・入力チェック・和暦・金額表示をここに集める。

var COMPANY_TEL = '026-405-8085';

var WORK_KEYS = ['遺品整理', '生前整理', '特殊清掃', '消臭・除菌', '空き家片付け', 'その他'];
var PAY_KEYS = { '現金': '支払現金', '振込': '支払振込', 'カード': '支払カード' };
var DELIVER_KEYS = { 'LINE': '受取LINE', 'メール': '受取メール', '紙': '受取紙' };

// ひな形ドキュメントに書く「差し込みの印」の一覧。ひな形の点検（checkTemplate）もこれを使う。
var PLACEHOLDERS = [
  '《契約番号》', '《契約日》',
  '《甲住所》', '《甲氏名》', '《甲電話》', '《甲メール》', '《乙電話》', '《乙担当者》',
  '《その他内容》', '《作業範囲》', '《作業場所》', '《作業開始日》', '《作業終了日》', '《鍵返却日》',
  '《作業費》', '《買取額》', '《合計》', '《振込期限日数》', '《探してほしい品物》', '《承諾メール》',
  '《甲署名日》', '《乙署名日》',
  '《チェック:立会あり》', '《チェック:立会なし》', '《チェック:鍵あり》', '《チェック:鍵なし》',
  '《チェック:支払現金》', '《チェック:支払振込》', '《チェック:支払カード》',
  '《チェック:受取LINE》', '《チェック:受取メール》', '《チェック:受取紙》'
].concat(WORK_KEYS.map(function (k) { return '《チェック:' + k + '》'; }));

// "2026-11-01" → {y,m,d}（読めなければ null）
function parseYmd(s) {
  var m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(s || '').trim());
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

// "2026-11-01" → "令和8年11月1日"（令和元年＝2019年）
function wareki(s) {
  var p = parseYmd(s);
  if (!p) return '';
  var yr = p.y - 2018;
  return '令和' + (yr === 1 ? '元' : yr) + '年' + p.m + '月' + p.d + '日';
}

// 250000 → "250,000"
function yen(n) {
  n = Math.floor(Number(n) || 0);
  var s = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (n < 0 ? '-' : '') + s;
}

function calcTotal(fee, buy) {
  return (Math.floor(Number(fee) || 0)) - (Math.floor(Number(buy) || 0));
}

// 月フォルダ名の先頭部分 "2026年11月"（税理士のフォルダは月が2桁）
function monthPrefix(s) {
  var p = parseYmd(s);
  if (!p) return '';
  return p.y + '年' + ('0' + p.m).slice(-2) + '月';
}

// 契約番号 GOEN-YYYYMMDD-NNN
function contractNo(s, seq) {
  var p = parseYmd(s);
  return 'GOEN-' + p.y + ('0' + p.m).slice(-2) + ('0' + p.d).slice(-2) + '-' + ('00' + seq).slice(-3);
}

function isInt_(v) { return /^-?\d+$/.test(String(v).trim()); }

// 入力チェック。問題がなければ []、あれば日本語のメッセージの配列
function validateContract(d) {
  d = d || {};
  var e = [];
  var need = function (key, label) { if (!String(d[key] || '').trim()) e.push(label + 'を入力してください'); };
  need('contractNo', '契約番号');
  if (!parseYmd(d.contractDate)) e.push('契約日を入力してください');
  need('custAddress', 'お客様のご住所');
  need('custName', 'お客様のお名前');
  need('custTel', 'お客様の電話番号');
  need('staff', 'GOEN担当者');
  var works = Array.isArray(d.works) ? d.works : [];
  if (!works.length) e.push('作業内容を1つ以上選んでください');
  if (works.indexOf('その他') >= 0 && !String(d.worksOther || '').trim()) e.push('作業内容「その他」の内容を入力してください');
  need('scope', '作業の範囲');
  need('place', '作業場所');
  var f = parseYmd(d.dateFrom), t = parseYmd(d.dateTo);
  if (!f) e.push('作業予定日（開始日）を入力してください');
  if (!t) e.push('作業予定日（終了日）を入力してください');
  if (f && t && (t.y * 10000 + t.m * 100 + t.d) < (f.y * 10000 + f.m * 100 + f.d)) e.push('作業の終了日が開始日より前になっています');
  if (d.attend !== 'あり' && d.attend !== 'なし') e.push('立ち会いの有無を選んでください');
  if (d.keyKeep !== 'あり' && d.keyKeep !== 'なし') e.push('鍵のお預かりの有無を選んでください');
  if (d.keyKeep === 'あり' && !parseYmd(d.keyReturn)) e.push('鍵の返却日を入力してください');
  if (!isInt_(d.fee) || Number(d.fee) < 0) e.push('作業費を数字で入力してください');
  if (!isInt_(d.buy) || Number(d.buy) < 0) e.push('買取額を数字で入力してください（なければ0）');
  if (!PAY_KEYS[d.payMethod]) e.push('お支払い方法を選んでください');
  if (d.payMethod === '振込' && !(isInt_(d.payDays) && Number(d.payDays) > 0)) e.push('振込の期限（日数）を入力してください');
  if (!DELIVER_KEYS[d.deliver]) e.push('控えの受け取り方法を選んでください');
  if (d.deliver === 'メール' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(d.custEmail || '').trim())) e.push('メールで送るにはお客様のメールアドレスが必要です');
  return e;
}

// 差し込みの印 → 実際の文字。signedYmd="2026-11-01", signedHm="14:05"（サーバー時刻）
function buildReplaceMap(d, signedYmd, signedHm) {
  var clean = function (v) { return String(v == null ? '' : v).trim().replace(/\$/g, '＄'); };
  var or = function (v) { v = clean(v); return v ? v : '—'; };
  var works = Array.isArray(d.works) ? d.works : [];
  var check = function (on) { return on ? '☑' : '☐'; };
  var signed = wareki(signedYmd) + ' ' + clean(signedHm);
  var m = {
    '《契約番号》': clean(d.contractNo),
    '《契約日》': wareki(d.contractDate),
    '《甲住所》': clean(d.custAddress),
    '《甲氏名》': clean(d.custName),
    '《甲電話》': clean(d.custTel),
    '《甲メール》': or(d.custEmail),
    '《乙電話》': COMPANY_TEL,
    '《乙担当者》': clean(d.staff),
    '《その他内容》': works.indexOf('その他') >= 0 ? or(d.worksOther) : '—',
    '《作業範囲》': clean(d.scope),
    '《作業場所》': clean(d.place),
    '《作業開始日》': wareki(d.dateFrom),
    '《作業終了日》': wareki(d.dateTo),
    '《鍵返却日》': d.keyKeep === 'あり' ? wareki(d.keyReturn) : '—',
    '《作業費》': yen(d.fee),
    '《買取額》': yen(d.buy),
    '《合計》': yen(calcTotal(d.fee, d.buy)),
    '《振込期限日数》': d.payMethod === '振込' ? clean(d.payDays) : '—',
    '《探してほしい品物》': or(d.searchItems),
    '《承諾メール》': d.deliver === 'メール' ? clean(d.custEmail) : '—',
    '《甲署名日》': signed,
    '《乙署名日》': signed,
    '《チェック:立会あり》': check(d.attend === 'あり'),
    '《チェック:立会なし》': check(d.attend === 'なし'),
    '《チェック:鍵あり》': check(d.keyKeep === 'あり'),
    '《チェック:鍵なし》': check(d.keyKeep === 'なし')
  };
  Object.keys(PAY_KEYS).forEach(function (k) { m['《チェック:' + PAY_KEYS[k] + '》'] = check(d.payMethod === k); });
  Object.keys(DELIVER_KEYS).forEach(function (k) { m['《チェック:' + DELIVER_KEYS[k] + '》'] = check(d.deliver === k); });
  WORK_KEYS.forEach(function (k) { m['《チェック:' + k + '》'] = check(works.indexOf(k) >= 0); });
  return m;
}

// Nodeのテストから読めるようにする（GASではこの行は何もしない）
if (typeof module !== 'undefined') {
  module.exports = { COMPANY_TEL: COMPANY_TEL, WORK_KEYS: WORK_KEYS, PLACEHOLDERS: PLACEHOLDERS, parseYmd: parseYmd, wareki: wareki, yen: yen, calcTotal: calcTotal, monthPrefix: monthPrefix, contractNo: contractNo, validateContract: validateContract, buildReplaceMap: buildReplaceMap };
}
