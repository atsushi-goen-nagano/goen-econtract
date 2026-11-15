// ===== GOEN 電子契約書 GAS（裏方）=====
// 画面（GitHub Pages の docs/index.html）から doPost に {fn, args, session} が届く。
// ログインは Google の IDトークンを tokeninfo で検証し、許可リスト（ALLOWED_EMAILS）のGmailだけ通す。
//
// スクリプト プロパティ（プロジェクトの設定 → スクリプト プロパティ）
//   OAUTH_CLIENT_ID : Google Cloud で作ったウェブ用クライアントID（…apps.googleusercontent.com）
//   ALLOWED_EMAILS  : 使ってよいGmail（カンマ区切り）
//   ADMIN_EMAILS    : 管理者のGmail（カンマ区切り。お客様名で検索できる）
//   以下は setupAll が自動で入れる: SHARED_DRIVE_ID / CONFIG_FOLDER_ID / TEMPLATE_DOC_ID / SHEET_ID

var TZ = 'Asia/Tokyo';
// 電話番号は Logic.gs の COMPANY_TEL が正本（ファイルの読み込み順の都合で、ここでは直接書かず関数で参照）
var COMPANY = { name: '株式会社GOEN', get tel() { return COMPANY_TEL; }, email: 'info@goen-nagano.com', address: '〒381-2203 長野県長野市真島町川合777-1' };
var STAFF_LIST = ['小口（代表）'];            // 署名画面で選ぶ担当者。増やすときはここに追加
var SHARED_DRIVE_NAME_HINT = '小口社長';       // この文字を含む共有ドライブを使う
var MONTH_SUB_PREFIX = '90_';                 // 月フォルダの中の「90_その他」
var MONTH_SUB_DEFAULT = '90_その他';
var CONTRACT_FOLDER_NAME = '電子契約書';       // 90_その他 の中に作る
var CONFIG_FOLDER_NAME = '電子契約書（ひな形・一覧）'; // 共有ドライブ最上位
var SHEET_NAME = '電子契約書 契約一覧';
var SESSION_HOURS = 12;
var MAIL_FROM = 'info@goen-nagano.com';
var FOLDER_MIME = 'application/vnd.google-apps.folder';
var REMOTE_DAYS = 7;                                   // 遠隔署名リンクの有効日数
var REMOTE_PENDING_FOLDER = '遠隔署名（待ち）';
var REMOTE_DONE_FOLDER = '遠隔署名（記録）';
var DRAFT_FOLDER = '下書き';
var GENBA_API_BASE = 'https://genba.okataduke-goen.com'; // 現場写真アプリ（案件番号→お客様名・電話・現場住所）。合言葉はスクリプト プロパティ GENBA_API_KEY
var SIGN_PAGE_URL = 'https://atsushi-goen-nagano.github.io/goen-econtract/sign.html';

var SHEET_HEADER = ['契約番号', '契約日', '締結日時', '担当者', '作成者', 'お客様名', '作業内容', '作業費', '買取額', '合計', '支払方法', '送付方法', '送付先', 'PDFリンク', 'ファイルID', 'SHA-256', '作業予定日', 'メール送信', '署名方法', '遠隔記録'];

function props_() { return PropertiesService.getScriptProperties(); }
function prop_(k) { return String(props_().getProperty(k) || '').trim(); }
function listProp_(k) { return prop_(k).toLowerCase().split(/[,\s]+/).filter(String); }

// ===== 入口 =====
function doGet() {
  return HtmlService.createHtmlOutput('<meta name="viewport" content="width=device-width">' +
    '<div style="font-family:-apple-system,sans-serif;padding:40px 20px;text-align:center;font-size:18px">電子契約書アプリは専用の画面から使います。<br>iPadのホーム画面のアイコンから開いてください。</div>')
    .setTitle('電子契約書｜GOEN');
}

var API_FUNCS = { newContract: newContract, getTemplateHtml: getTemplateHtml, finalize: finalize, listContracts: listContracts, whoami: whoami,
  createRemote: createRemote, listRemote: listRemote, cancelRemote: cancelRemote, remoteSendLink: remoteSendLink,
  saveDraft: saveDraft, listDrafts: listDrafts, getDraft: getDraft, deleteDraft: deleteDraft, lookupCase: lookupCase };
// お客様側（ログインなし・リンクの合言葉だけで呼べる）
var PUBLIC_FUNCS = { remoteGet: remoteGet, remoteSign: remoteSign };

function doPost(e) {
  var out;
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var args = Array.isArray(body.args) ? body.args : [];
    if (body.fn === 'login') {
      out = { ok: true, result: login(args[0]) };
    } else if (PUBLIC_FUNCS[String(body.fn || '')]) {
      out = { ok: true, result: PUBLIC_FUNCS[body.fn].apply(null, args) };
    } else {
      var user = requireSession_(body.session);
      var fn = API_FUNCS[String(body.fn || '')];
      if (!fn) throw new Error('不明な呼び出し: ' + body.fn);
      out = { ok: true, result: fn.apply(null, [user].concat(args)) };
    }
  } catch (err) {
    out = { ok: false, error: String(err && err.message ? err.message : err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

// ===== ログイン（Google IDトークン → セッション札）=====
function login(idToken) {
  if (!idToken) throw new Error('ログイン情報がありません');
  var clientId = prop_('OAUTH_CLIENT_ID');
  if (!clientId) throw new Error('GASに OAUTH_CLIENT_ID が設定されていません');
  var res = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken), { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('Googleのログイン確認に失敗しました。もう一度ログインしてください');
  var info = JSON.parse(res.getContentText());
  if (info.aud !== clientId) throw new Error('このアプリ用のログインではありません');
  if (String(info.email_verified) !== 'true') throw new Error('メールアドレスが確認されていないGoogleアカウントです');
  var email = String(info.email || '').toLowerCase();
  if (listProp_('ALLOWED_EMAILS').indexOf(email) < 0) throw new Error('このGoogleアカウント（' + email + '）は許可されていません。管理者に登録を頼んでください');

  var token = Utilities.getUuid() + '-' + Utilities.getUuid();
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var sessions = sessions_();
    var now = Date.now();
    Object.keys(sessions).forEach(function (k) { if (sessions[k].exp < now) delete sessions[k]; });
    sessions[token] = { email: email, exp: now + SESSION_HOURS * 3600 * 1000 };
    props_().setProperty('SESSIONS', JSON.stringify(sessions));
  } finally { lock.releaseLock(); }
  return { session: token, user: userInfo_(email), staffList: STAFF_LIST, template: safeCheckTemplate_() };
}

function sessions_() { try { return JSON.parse(prop_('SESSIONS') || '{}'); } catch (e) { return {}; } }
function requireSession_(token) {
  var s = sessions_()[String(token || '')];
  if (!s || s.exp < Date.now()) throw new Error('ログインの有効期限が切れました。もう一度ログインしてください');
  return userInfo_(s.email);
}
function userInfo_(email) { return { email: email, isAdmin: listProp_('ADMIN_EMAILS').indexOf(email) >= 0 }; }
function whoami(user) { return { user: user, staffList: STAFF_LIST, template: safeCheckTemplate_() }; }
function safeCheckTemplate_() {
  try { return checkTemplate(mustProp_('TEMPLATE_DOC_ID')); }
  catch (e) { return { ok: false, missing: [], unknown: [], error: String(e.message || e) }; }
}
function mustProp_(k) { var v = prop_(k); if (!v) throw new Error('GASの初期設定（setupAll）がまだです：' + k); return v; }

// ===== 新規作成：契約日＝今日。契約番号は写真アプリの案件番号をスタッフが貼る =====
function newContract(user) {
  return { contractNo: '', contractDate: Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd') };
}

// 同じ契約番号がすでに一覧にあれば止める（再契約は末尾に -2 を付けてもらう）
function assertCaseNoUnused_(no) {
  var sh = sheet_();
  if (sh.getLastRow() < 2) return;
  var col = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < col.length; i++) {
    if (String(col[i][0]).trim() === no) throw new Error('契約番号 ' + no + ' の契約書はすでに締結済みです。同じ案件で作り直す場合は末尾に「-2」を付けてください（例 ' + no.replace(/-\d{1,2}$/, '') + '-2）');
  }
}

// ===== 確認画面用：ひな形をHTMLにして返す =====
function getTemplateHtml(user) {
  var id = mustProp_('TEMPLATE_DOC_ID');
  var cache = CacheService.getScriptCache();
  var hit = cache.get('TEMPLATE_HTML_' + id);
  if (hit) return { html: hit };
  var res = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + id + '/export?mimeType=text%2Fhtml&supportsAllDrives=true',
    { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('ひな形を読み込めませんでした（' + res.getResponseCode() + '）');
  var html = res.getContentText('UTF-8');
  var m = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html);
  html = m ? m[1] : html;
  try { cache.put('TEMPLATE_HTML_' + id, html, 600); } catch (e) {}
  return { html: html };
}

// ===== 締結：PDF作成 → 保存 → ロック → 一覧 → メール =====
function finalize(user, d) {
  d = d || {};
  precheck_(d, {});
  if (!onsiteAllowed(d.contractDate, d.dateFrom)) throw new Error('作業開始日が契約日から' + (ONSITE_MIN_DAYS - 1) + '日以内のため、その場での署名はできません。遠隔署名（お客様がご自身の端末で署名）をお使いください');
  var res = finalizeCore_(d, sigBlob_(d.sigCustomer, 'お客様'), sigBlob_(d.sigStaff, '担当者'), { by: user.email, how: '現地', note: '' });
  deleteDraftQuiet_(d.draftId);
  return res;
}

// 入力・担当者・契約番号の重複・ひな形の点検（締結前の共通チェック）
function precheck_(d, opts) {
  var errors = validateContract(d, opts);
  if (errors.length) throw new Error(errors.join('\n'));
  if (STAFF_LIST.indexOf(d.staff) < 0) throw new Error('担当者が一覧にありません：' + d.staff);
  d.contractNo = normalizeCaseNo(d.contractNo);
  assertCaseNoUnused_(d.contractNo);
  var tpl = safeCheckTemplate_();
  if (!tpl.ok) throw new Error('契約書のひな形に問題があります（' + (tpl.error || ('不足:' + tpl.missing.join(' ') + ' 不明:' + tpl.unknown.join(' '))) + '）。ひな形を直してから締結してください');
}

// PDF作成 → 保存 → ロック → 一覧 → メール（現地署名・遠隔署名の両方から使う）
function finalizeCore_(d, sigC, sigS, meta) {
  var now = new Date();
  var signedYmd = Utilities.formatDate(now, TZ, 'yyyy-MM-dd'), signedHm = Utilities.formatDate(now, TZ, 'HH:mm');
  var map = buildReplaceMap(d, signedYmd, signedHm);
  var pdfName = d.contractNo + '_' + String(d.contractDate).replace(/-/g, '') + '.pdf';

  var folder = resolveContractFolder_(d.contractDate);
  var pdf = buildPdf_(mustProp_('TEMPLATE_DOC_ID'), DriveApp.getFolderById(mustProp_('CONFIG_FOLDER_ID')), map, { customer: sigC, staff: sigS }, pdfName);
  var file = folder.createFile(pdf);
  var warnings = [];
  try { Drive.Files.update({ contentRestrictions: [{ readOnly: true, reason: '署名済みの電子契約書（原本）' }] }, file.getId(), null, { supportsAllDrives: true }); }
  catch (e) { warnings.push('PDFのロックができませんでした（' + e.message + '）'); }
  var hash = hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, pdf.getBytes()));

  var mailResult = '—';
  if (d.deliver === 'メール') {
    try { sendCopyMail_(d, pdf); mailResult = '送信 ' + Utilities.formatDate(now, TZ, 'HH:mm'); }
    catch (e) { mailResult = '失敗'; warnings.push('メールが送れませんでした（' + e.message + '）。LINEか紙でお渡しください'); }
  }
  try {
    appendRow_([d.contractNo, d.contractDate, Utilities.formatDate(now, TZ, 'yyyy-MM-dd HH:mm:ss'), d.staff, meta.by, d.custName,
      (d.works || []).join('・') + (d.works && d.works.indexOf('その他') >= 0 ? '（' + d.worksOther + '）' : ''),
      Number(d.fee), Number(d.buy), calcTotal(d.fee, d.buy), payLabel_(d),
      d.deliver, d.deliver === 'メール' ? d.custEmail : '', file.getUrl(), file.getId(), hash, d.dateFrom + '〜' + d.dateTo, mailResult, meta.how, meta.note]);
  } catch (e) { warnings.push('契約一覧への記録ができませんでした（' + e.message + '）。PDFは保存済みです'); }

  return { fileName: pdfName, url: file.getUrl(), folder: folderPath_(folder), pdfBase64: Utilities.base64Encode(pdf.getBytes()), sha256: hash, signedAt: signedYmd + ' ' + signedHm, warnings: warnings };
}

// ===== 現場写真アプリから案件情報を読む（契約番号＝案件番号）=====
function lookupCase(user, caseNo) {
  var no = normalizeCaseNo(caseNo);
  var m = /^(\d{2}-\d{4})(-\d{1,2})?$/.exec(no);
  if (!m) throw new Error('契約番号は写真アプリの案件番号の形（例 26-0152）で入力してください');
  no = m[1]; // 26-0152-2（再契約）→ 26-0152 で照会
  var key = prop_('GENBA_API_KEY');
  if (!key) throw new Error('写真アプリとの合言葉（GENBA_API_KEY）が未設定です。「電子契約書の鍵を表示.command」で表示される文字列をスクリプト プロパティに入れてください');
  var res = UrlFetchApp.fetch(GENBA_API_BASE + '/api/external/cases/' + encodeURIComponent(no), { headers: { 'x-econtract-key': key }, muteHttpExceptions: true });
  var code = res.getResponseCode(), body = {};
  try { body = JSON.parse(res.getContentText()); } catch (e) {}
  if (code === 403) throw new Error('写真アプリが合言葉を受け付けませんでした（GENBA_API_KEY を確認）');
  if (code !== 200) throw new Error(body.error || ('写真アプリに接続できませんでした（' + code + '）'));
  var tel = formatTel_(String(body.client_tel || ''));
  return { caseNo: no, caseName: body.name || '', custName: body.client_name || '', custTel: tel, place: body.site_address || '', city: body.city || '', type: body.type || '', workDate: body.work_date || '', archived: !!body.archived };
}

// 数字だけの電話番号を読みやすく（090-1234-5678 / 0120-123-456 / 0800-123-4150 / 026-123-4567）
function formatTel_(d) {
  if (!/^0\d{9,10}$/.test(d)) return d;
  if (/^(0120|0800)/.test(d)) return d.length === 11 ? d.replace(/^(\d{4})(\d{3})(\d{4})$/, '$1-$2-$3') : d.replace(/^(\d{4})(\d{3})(\d{3})$/, '$1-$2-$3');
  if (d.length === 11) return d.replace(/^(\d{3})(\d{4})(\d{4})$/, '$1-$2-$3');
  if (/^0[36]/.test(d)) return d.replace(/^(\d{2})(\d{4})(\d{4})$/, '$1-$2-$3');
  return d.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1-$2-$3');
}

// ===== 下書き（どの端末からでも再開できるよう裏方にも保存）=====
// 設定フォルダ／下書き／<draftId>.json。署名画像は含めない。締結・遠隔リンク作成で消す
function draftFile_(id) {
  if (!/^[0-9a-zA-Z-]{8,80}$/.test(String(id || ''))) throw new Error('下書きの番号が正しくありません');
  var it = remoteFolder_(DRAFT_FOLDER).getFilesByName(id + '.json');
  return it.hasNext() ? it.next() : null;
}
function saveDraft(user, draft) {
  draft = draft || {};
  var id = String(draft.draftId || '');
  var d = {}; Object.keys(draft).forEach(function (k) { if (k !== 'sigCustomer' && k !== 'sigStaff') d[k] = draft[k]; });
  var rec = { id: id, updated: Date.now(), by: user.email, d: d };
  var file = draftFile_(id);
  if (file) file.setContent(JSON.stringify(rec)); else remoteFolder_(DRAFT_FOLDER).createFile(id + '.json', JSON.stringify(rec), 'application/json');
  return { ok: true, updated: fmtMs_(rec.updated) };
}
function listDrafts(user) {
  var out = [], it = remoteFolder_(DRAFT_FOLDER).getFiles();
  while (it.hasNext()) {
    try {
      var rec = JSON.parse(it.next().getBlob().getDataAsString('UTF-8'));
      out.push({ id: rec.id, updated: fmtMs_(rec.updated), updatedMs: rec.updated, by: rec.by, contractNo: rec.d.contractNo || '', custName: rec.d.custName || '', staff: rec.d.staff || '', dateFrom: rec.d.dateFrom || '' });
    } catch (e) {}
  }
  out.sort(function (a, b) { return b.updatedMs - a.updatedMs; });
  return { rows: out };
}
function getDraft(user, id) {
  var file = draftFile_(id); if (!file) throw new Error('この下書きは見つかりません（締結済みか削除済み）');
  var rec = JSON.parse(file.getBlob().getDataAsString('UTF-8'));
  return { d: rec.d, updated: fmtMs_(rec.updated), by: rec.by };
}
function deleteDraft(user, id) {
  var file = draftFile_(id); if (file) file.setTrashed(true);
  return { ok: true };
}
function deleteDraftQuiet_(id) { try { if (id) deleteDraft(null, id); } catch (e) {} }

// ===== 遠隔署名（お客様がリンクから署名）=====
// 保留中の契約は 設定フォルダ／遠隔署名（待ち）／<token>.json に置く。署名後は 遠隔署名（記録）へ移す
function remoteFolder_(name) {
  var cfg = DriveApp.getFolderById(mustProp_('CONFIG_FOLDER_ID'));
  var it = cfg.getFoldersByName(name);
  return it.hasNext() ? it.next() : cfg.createFolder(name);
}
function remoteFile_(token) {
  if (!/^[0-9a-f-]{60,80}$/.test(String(token || ''))) throw new Error('リンクが正しくありません');
  var it = remoteFolder_(REMOTE_PENDING_FOLDER).getFilesByName(token + '.json');
  return it.hasNext() ? it.next() : null;
}
function remoteRead_(file) { return JSON.parse(file.getBlob().getDataAsString('UTF-8')); }
function remoteWrite_(file, rec) { file.setContent(JSON.stringify(rec)); }
function remotePublic_(rec) {
  // お客様の画面に返す分（担当者の署名画像は返さない）
  var d = {}; Object.keys(rec.d).forEach(function (k) { if (k !== 'sigStaff') d[k] = rec.d[k]; });
  return { d: d, exp: rec.exp, status: rec.status, staff: rec.d.staff };
}

// スタッフ：担当者の署名まで済ませた契約を「待ち」に登録してリンクを作る
function createRemote(user, d) {
  d = d || {};
  precheck_(d, { skipDeliver: true });
  var sigS = sigBlob_(d.sigStaff, '担当者'); // 形式チェックだけ
  delete d.sigCustomer;
  var token = Utilities.getUuid() + '-' + Utilities.getUuid();
  var now = Date.now();
  var rec = { token: token, created: now, exp: now + REMOTE_DAYS * 86400000, staffEmail: user.email, status: '未開封', sentTo: '', opened: [], d: d };
  remoteFolder_(REMOTE_PENDING_FOLDER).createFile(token + '.json', JSON.stringify(rec), 'application/json');
  deleteDraftQuiet_(d.draftId);
  return { token: token, url: SIGN_PAGE_URL + '?t=' + token, exp: fmtMs_(rec.exp) };
}

// スタッフ：リンクをお客様のメールへ送る（LINEは画面の共有ボタンで送る）
function remoteSendLink(user, token, email) {
  var file = remoteFile_(token); if (!file) throw new Error('この契約は見つかりません（署名済みか期限切れ）');
  var rec = remoteRead_(file);
  email = String(email || rec.d.custEmail || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('メールアドレスが正しくありません');
  var url = SIGN_PAGE_URL + '?t=' + token;
  var body = rec.d.custName + ' 様\n\n' + COMPANY.name + 'です。作業契約書のご確認とご署名を、下のリンクからお願いいたします。\n\n' + url +
    '\n\n・リンクは ' + fmtMs_(rec.exp) + ' まで有効です\n・スマートフォンやタブレットで開き、内容を最後までご確認のうえ、画面に指でご署名ください\n・ご不明な点は ' + COMPANY.tel + ' までご連絡ください\n\n' +
    COMPANY.name + '\n' + COMPANY.address + '\n電話：' + COMPANY.tel + '\nメール：' + COMPANY.email + '\n';
  var opt = { name: COMPANY.name, replyTo: MAIL_FROM };
  if (GmailApp.getAliases().indexOf(MAIL_FROM) >= 0) opt.from = MAIL_FROM;
  GmailApp.sendEmail(email, '【' + COMPANY.name + '】作業契約書のご署名のお願い（' + rec.d.contractNo + '）', body, opt);
  rec.sentTo = (rec.sentTo ? rec.sentTo + '、' : '') + 'メール ' + email + ' ' + fmtMs_(Date.now());
  rec.d.custEmail = rec.d.custEmail || email;
  remoteWrite_(file, rec);
  return { ok: true };
}

// スタッフ：待ちの一覧
function listRemote(user) {
  var out = [], it = remoteFolder_(REMOTE_PENDING_FOLDER).getFiles();
  while (it.hasNext()) {
    var rec = remoteRead_(it.next());
    out.push({ token: rec.token, url: SIGN_PAGE_URL + '?t=' + rec.token, contractNo: rec.d.contractNo, custName: rec.d.custName, staff: rec.d.staff,
      created: fmtMs_(rec.created), exp: fmtMs_(rec.exp), expired: rec.exp < Date.now(), status: rec.status, opened: rec.opened.length, sentTo: rec.sentTo, custEmail: rec.d.custEmail || '' });
  }
  out.sort(function (a, b) { return a.created < b.created ? 1 : -1; });
  return { rows: out };
}
function cancelRemote(user, token) {
  var file = remoteFile_(token); if (!file) throw new Error('この契約は見つかりません');
  var rec = remoteRead_(file); rec.status = '取消'; rec.cancelledBy = user.email; rec.cancelledAt = Date.now();
  remoteWrite_(file, rec); file.moveTo(remoteFolder_(REMOTE_DONE_FOLDER));
  return { ok: true };
}

// お客様：リンクを開く（契約内容＋本文のひな形を返す。開封を記録）
function remoteGet(token, ua) {
  var file = remoteFile_(token); if (!file) throw new Error('この契約書は見つかりません。すでに署名済みか、リンクが取り消されています。' + COMPANY.name + '（' + COMPANY.tel + '）へご連絡ください');
  var rec = remoteRead_(file);
  if (rec.exp < Date.now()) throw new Error('このリンクの有効期限（' + fmtMs_(rec.exp) + '）が過ぎています。' + COMPANY.name + '（' + COMPANY.tel + '）へご連絡ください');
  rec.opened.push({ at: Date.now(), ua: String(ua || '').slice(0, 200) });
  if (rec.status === '未開封') rec.status = '開封済';
  remoteWrite_(file, rec);
  var pub = remotePublic_(rec);
  pub.html = getTemplateHtml(null).html;
  pub.company = COMPANY;
  return pub;
}

// お客様：署名して締結
function remoteSign(token, sigCustomer, deliver, custEmail, ua) {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var file = remoteFile_(token); if (!file) throw new Error('この契約書は見つかりません（すでに署名済みの可能性があります）');
    var rec = remoteRead_(file);
    if (rec.exp < Date.now()) throw new Error('このリンクの有効期限が過ぎています。' + COMPANY.name + '（' + COMPANY.tel + '）へご連絡ください');
    var d = rec.d;
    d.deliver = String(deliver || '');
    if (d.deliver === 'メール') d.custEmail = String(custEmail || d.custEmail || '').trim();
    precheck_(d, {});
    var sigC = sigBlob_(sigCustomer, 'お客様'), sigS = sigBlob_(d.sigStaff, '担当者');
    var signedAt = Date.now();
    var note = 'お客様がご自身の端末から署名（訪問先ではない） ／ 送付: ' + (rec.sentTo || '（LINE等で手渡し）') + ' ／ 開封: ' + rec.opened.map(function (o) { return fmtMs_(o.at); }).join(', ') +
      ' ／ 署名: ' + fmtMs_(signedAt) + ' ／ 端末: ' + String(ua || '').slice(0, 120);
    var res = finalizeCore_(d, sigC, sigS, { by: rec.staffEmail + '（遠隔）', how: '遠隔', note: note });
    rec.status = '署名済'; rec.signedAt = signedAt; rec.signedUa = String(ua || '').slice(0, 200); rec.result = { fileName: res.fileName, url: res.url, sha256: res.sha256 };
    delete rec.d.sigStaff;
    remoteWrite_(file, rec); file.moveTo(remoteFolder_(REMOTE_DONE_FOLDER));
    // お客様へは PDF本体（保存・印刷用）と結果だけ返す。ドライブのリンクは返さない
    return { fileName: res.fileName, pdfBase64: res.pdfBase64, signedAt: res.signedAt, deliver: d.deliver, mailed: d.deliver === 'メール' && !(res.warnings || []).some(function (w) { return w.indexOf('メール') >= 0; }) };
  } finally { lock.releaseLock(); }
}

function fmtMs_(ms) { return Utilities.formatDate(new Date(ms), TZ, 'yyyy-MM-dd HH:mm'); }

function payLabel_(d) {
  if (d.payMethod === '振込') return '振込(' + d.payDays + '日)';
  if (d.payMethod === '2回') return '2回払い(1回目 ' + yen(d.payFirstAmount) + '円 ' + d.payFirstDate + ' ' + d.payFirstHow + '／残金 ' + d.payRestDate + ' ' + d.payRestHow + ')';
  return String(d.payMethod);
}

function sigBlob_(dataUrl, label) {
  var m = /^data:image\/png;base64,(.+)$/.exec(String(dataUrl || ''));
  if (!m) throw new Error(label + 'の署名が読み取れませんでした');
  return Utilities.newBlob(Utilities.base64Decode(m[1]), 'image/png', 'sig.png');
}
function hex_(bytes) { return bytes.map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join(''); }

function sendCopyMail_(d, pdf) {
  var subject = '【' + COMPANY.name + '】作業契約書の控え（契約番号 ' + d.contractNo + '）';
  var body = d.custName + ' 様\n\nこのたびはご契約ありがとうございます。\n本日ご署名いただいた作業契約書の控え（PDF）をお送りします。\n\n契約番号：' + d.contractNo + '\n契約日：' + wareki(d.contractDate) + '\n担当者：' + d.staff +
    '\n\nこの控えは電子契約書の写しです。原本は電子データにて保管しています。\n印刷した控えに署名・押印はしないでください。\nPDFが開けない場合は、お手数ですがご連絡ください。紙の控えをお渡しします。\n\n' +
    COMPANY.name + '\n' + COMPANY.address + '\n電話：' + COMPANY.tel + '\nメール：' + COMPANY.email + '\n';
  var opt = { name: COMPANY.name, attachments: [pdf], replyTo: MAIL_FROM };
  if (GmailApp.getAliases().indexOf(MAIL_FROM) >= 0) opt.from = MAIL_FROM;
  GmailApp.sendEmail(d.custEmail, subject, body, opt);
}

// ===== 一覧 =====
function listContracts(user, q) {
  q = q || {};
  var sh = sheet_();
  var vals = sh.getDataRange().getValues();
  var rows = [];
  var name = String(q.name || '').trim();
  if (name && !user.isAdmin) throw new Error('お客様名での検索は管理者のみです');
  for (var i = vals.length - 1; i >= 1; i--) {
    var r = vals[i];
    var no = String(r[0]), date = fmtCell_(r[1]), staff = String(r[3]), cust = String(r[5]);
    if (q.no && no.indexOf(String(q.no).trim()) < 0) continue;
    if (q.from && date < q.from) continue;
    if (q.to && date > q.to) continue;
    if (q.staff && staff !== q.staff) continue;
    if (name && cust.indexOf(name) < 0) continue;
    rows.push({ contractNo: no, contractDate: date, signedAt: fmtCell_(r[2]), staff: staff, custName: user.isAdmin ? cust : '', works: String(r[6]),
      total: Number(r[9]) || 0, deliver: String(r[11]), url: String(r[13]) });
    if (rows.length >= 200) break;
  }
  return { rows: rows, isAdmin: user.isAdmin };
}
function fmtCell_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, v.getHours() || v.getMinutes() ? 'yyyy-MM-dd HH:mm' : 'yyyy-MM-dd');
  return String(v);
}

// ===== スプレッドシート =====
function sheet_() {
  var ss = SpreadsheetApp.openById(mustProp_('SHEET_ID'));
  var sh = ss.getSheetByName('契約一覧') || ss.getSheets()[0];
  if (sh.getLastRow() === 0) { sh.appendRow(SHEET_HEADER); sh.setFrozenRows(1); }
  else if (sh.getLastColumn() < SHEET_HEADER.length) sh.getRange(1, 1, 1, SHEET_HEADER.length).setValues([SHEET_HEADER]);
  return sh;
}
function appendRow_(row) {
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try { sheet_().appendRow(row); } finally { lock.releaseLock(); }
}

// ===== 共有ドライブのフォルダ =====
function getSharedDriveId_() {
  var id = prop_('SHARED_DRIVE_ID');
  if (id) return id;
  var drives = (Drive.Drives.list({ pageSize: 100 }).drives || []).filter(function (d) { return d.name.indexOf(SHARED_DRIVE_NAME_HINT) >= 0; });
  if (drives.length !== 1) throw new Error('「' + SHARED_DRIVE_NAME_HINT + '」を含む共有ドライブが ' + drives.length + ' 件見つかりました。listSharedDrives を実行してIDを SHARED_DRIVE_ID に設定してください');
  props_().setProperty('SHARED_DRIVE_ID', drives[0].id);
  return drives[0].id;
}
function listChildFolders_(parentId) {
  var out = [], token = null;
  do {
    var res = Drive.Files.list({ q: "'" + parentId + "' in parents and mimeType='" + FOLDER_MIME + "' and trashed=false", supportsAllDrives: true, includeItemsFromAllDrives: true, corpora: 'allDrives', fields: 'nextPageToken,files(id,name)', pageSize: 200, pageToken: token });
    out = out.concat(res.files || []); token = res.nextPageToken;
  } while (token);
  return out;
}
function findOrCreateFolder_(parentId, match, createName) {
  var hit = listChildFolders_(parentId).filter(function (f) { return match(f.name); }).sort(function (a, b) { return a.name < b.name ? -1 : 1; })[0];
  if (hit) return hit;
  return Drive.Files.create({ name: createName, mimeType: FOLDER_MIME, parents: [parentId] }, null, { supportsAllDrives: true, fields: 'id,name' });
}
// 共有ドライブ → 2026年11月… → 90_その他 → 電子契約書
function resolveContractFolder_(ymd) {
  var prefix = monthPrefix(ymd);
  var month = findOrCreateFolder_(getSharedDriveId_(), function (n) { return n.indexOf(prefix) === 0; }, prefix);
  var sub = findOrCreateFolder_(month.id, function (n) { return n.indexOf(MONTH_SUB_PREFIX) === 0; }, MONTH_SUB_DEFAULT);
  var c = findOrCreateFolder_(sub.id, function (n) { return n === CONTRACT_FOLDER_NAME; }, CONTRACT_FOLDER_NAME);
  return DriveApp.getFolderById(c.id);
}
function folderPath_(folder) {
  var names = [folder.getName()], f = folder, n = 0;
  while (n++ < 4) { var ps = f.getParents(); if (!ps.hasNext()) break; f = ps.next(); names.unshift(f.getName()); }
  return names.join(' / ');
}
function moveToFolder_(fileId, folderId) {
  var cur = Drive.Files.get(fileId, { fields: 'parents', supportsAllDrives: true });
  Drive.Files.update({}, fileId, null, { addParents: folderId, removeParents: (cur.parents || []).join(','), supportsAllDrives: true });
}

// ===== 初回セットアップ（GASエディタで本人が実行）=====
// 0) setupProps：スクリプト プロパティの初期値（空のときだけ入れる。クライアントIDは秘密ではない）
var INIT_PROPS = {
  OAUTH_CLIENT_ID: '1018313183986-0govtqeenqmlgcbb17sg2jrd3kfhvuhf.apps.googleusercontent.com',
  ALLOWED_EMAILS: 'goen3378@gmail.com',
  ADMIN_EMAILS: 'goen3378@gmail.com'
};
function setupProps() {
  Object.keys(INIT_PROPS).forEach(function (k) { if (!prop_(k)) props_().setProperty(k, INIT_PROPS[k]); });
  Logger.log('設定済み: ' + JSON.stringify(props_().getProperties(), null, 1));
}

// 1) setupAll：共有ドライブ・ひな形Doc・契約一覧を用意
function setupAll() {
  setupProps();
  var driveId = getSharedDriveId_();
  var cfg = findOrCreateFolder_(driveId, function (n) { return n === CONFIG_FOLDER_NAME; }, CONFIG_FOLDER_NAME);
  props_().setProperty('CONFIG_FOLDER_ID', cfg.id);
  var tplId = prop_('TEMPLATE_DOC_ID');
  if (!tplId) {
    // 前回途中で失敗して残った作りかけのひな形（マイドライブ直下）はゴミ箱へ
    var stray = DriveApp.getRootFolder().getFilesByName(TEMPLATE_DOC_NAME);
    while (stray.hasNext()) stray.next().setTrashed(true);
    tplId = createTemplateDoc_(DriveApp.getFolderById(cfg.id));
    props_().setProperty('TEMPLATE_DOC_ID', tplId);
  }
  var sheetId = prop_('SHEET_ID');
  if (!sheetId) {
    var ss = SpreadsheetApp.create(SHEET_NAME);
    ss.getSheets()[0].setName('契約一覧');
    moveToFolder_(ss.getId(), cfg.id);
    sheetId = ss.getId();
    props_().setProperty('SHEET_ID', sheetId);
    sheet_();
  }
  var chk = checkTemplate(tplId);
  var alias = GmailApp.getAliases().indexOf(MAIL_FROM) >= 0;
  Logger.log('OK\n共有ドライブID: ' + driveId + '\n設定フォルダ: ' + cfg.name + '\nひな形Doc: https://docs.google.com/document/d/' + tplId + '/edit\n契約一覧: https://docs.google.com/spreadsheets/d/' + sheetId + '/edit\nひな形点検: ' + JSON.stringify(chk) +
    '\ninfo@ から送信: ' + (alias ? 'できます' : 'まだ（Gmailで「別のアドレスとして送信」を設定するまで、このアカウントから送ります）') +
    '\n許可Gmail: ' + prop_('ALLOWED_EMAILS') + '\nクライアントID: ' + (prop_('OAUTH_CLIENT_ID') ? '設定済み' : '未設定'));
}

function listSharedDrives() {
  (Drive.Drives.list({ pageSize: 100 }).drives || []).forEach(function (d) { Logger.log(d.name + ' : ' + d.id); });
}

function checkMailAlias() {
  Logger.log('送信できるアドレス: ' + GmailApp.getAliases().join(', ') + '\ninfo@ ' + (GmailApp.getAliases().indexOf(MAIL_FROM) >= 0 ? '使えます' : 'まだ使えません'));
}

// ひな形を作り直したいとき（既存のひな形は残る。新しいIDに切り替わる）
function recreateTemplate() {
  var old = prop_('TEMPLATE_DOC_ID');
  if (old) { try { DriveApp.getFileById(old).setName(TEMPLATE_DOC_NAME + '（旧 ' + Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HHmm') + '）'); } catch (e) {} }
  props_().deleteProperty('TEMPLATE_DOC_ID');
  CacheService.getScriptCache().removeAll(['x']);
  setupAll();
}

// テスト用のPDF（テスト 太郎）を「電子契約書（ひな形・一覧）」フォルダに作る。一覧には書かない・メールも送らない
function testSamplePdf() {
  var d = { contractNo: '00-0000', contractDate: Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'),
    custAddress: '長野県長野市○○町1-2-3', custName: 'テスト 太郎', custTel: '090-0000-0000', custEmail: 'test@example.com',
    staff: STAFF_LIST[0], works: ['遺品整理', 'その他'], worksOther: '仏壇のご供養', scope: '2階の全部屋。写真と手紙は残す',
    place: '長野県長野市○○町1-2-3', dateFrom: '2026-11-10', dateTo: '2026-11-11', attend: 'あり', keyKeep: 'あり', keyReturn: '2026-11-12',
    fee: 250000, buy: 30000, payMethod: '振込', payDays: 7, searchItems: '通帳・印鑑・権利書', deliver: 'メール' };
  var sig = Utilities.newBlob(Utilities.base64Decode(SAMPLE_SIG_PNG_BASE64), 'image/png', 'sig.png');
  var map = buildReplaceMap(d, d.contractDate, Utilities.formatDate(new Date(), TZ, 'HH:mm'));
  var cfg = DriveApp.getFolderById(mustProp_('CONFIG_FOLDER_ID'));
  var pdf = buildPdf_(mustProp_('TEMPLATE_DOC_ID'), cfg, map, { customer: sig, staff: sig }, 'テスト_' + Utilities.formatDate(new Date(), TZ, 'yyyyMMdd_HHmm') + '.pdf');
  var f = cfg.createFile(pdf);
  Logger.log('テストPDF: ' + f.getUrl());
}

var SAMPLE_SIG_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAlgAAADICAYAAAA0n5+2AAAnLElEQVR42u3dd5icVfnG8W8SqjQpD0qRFpBepAniQUVFFCkK0psUUYqgQBDkJ11EkCoiSpcmECIIqGhohyIdBAmIQGiB8ECogRAC+f1xzprZYd7Zmd2Z2dmZ+3NdeyXsbHaXM/Oeud9TnjNs+vTpiIiIiEjjDFcTiIiIiChgiYiIiChgiYiIiChgiYiIiIgCloiIiIgCloiIiIgCloiIiIgoYImIiIgoYImIiIgoYImIiIiIApaIiIiIApaIiIiIApaIiIiIApaIiIiIKGCJiIiIKGCJiIiIKGCJiIiIiAKWiIiIiAKWiIiIiAKWiIiIiChgiYiIiChgiYiIiChgiYiIiIgCloiIiIgCloiIiIgCloiIiIgCloiIiIgoYImIiIgoYImIiIgoYImIiIiIApaIiIiIApaIiIiIApaIiIiIKGCJiIiIKGCJiIiIKGCJiIiIiAKWiIiIiAKWiIiIiAKWiIiIiAKWiIiIiChgiYiIiChgiYiIiChgiYiIiIgCloiIiIgCloiIiIgCloiIiIgoYImIiIgoYImIiIgoYImIiIjITGoCEREZCLPwIDAdeBGYmP98CZiQ//48MME9vq/Wqth+CwIPAuPzx3PAC/nPZ4An3ONbaqmhZdj06dPVCiIiMpCAcBuwXh9f9gHwKHCKezxXrdar/WYGplb5kunAv4HLgOPc44dqNTRFKCIiHe/ZGr5mBLAycI5ZWEpNNkMe2XunypcMA1YCjgGWaHC4W9UsLK5nQQFLRETaz8Q6vvYvNQaybtPXFOBDwHfc41MN/rnLA4+ZhV+Yhblo3ijdumbhdrMwEq3BEhG6d8piKWAPYFHSGprxwFPAHe7xTbWQ1BkOPgRuIk0PXqvmqmhKwedHAwe7xyeb9HPfBGYDDgZ2NAs/do9/bHB/shxwLTAfcJ9Z2Nk9Xq2AJSLdaA1gc2C5ss+/bxYicAlwpXt8Q00lwLQqjz0JfMk9PqdmqqpoA8DDTQxX5eF4YeAys7A9sKd7fLEB4Woh4G85XAHMA4wxCycAh7rHD9AUoYjQPWtCrgBWBHag9/TPzMAGwNnABLPwa62nEdIi7CLPKlzVZLAWrlcakd4EeMQsfGeA4WoO0sjVYnx0Tdko4O95ByUawRKRbgpZHwIX5x1i1+XAVepjwN7A983CecABmj5EJX8+SqOc7R2wJhd8fj7gcrPQzJ/9JeABs/Ad93gHGsESmrv2ZX6zsKxZmE2tIW0StJ4hbcF/gOLdYbvnO9611WIKWN0YsMzCCrncwmD+DqvkUaN6vDvITbcwaSRrHQWszrww5jIL55mFnQfp589qFnY3C/cDrwCPAZPMwvl5/lpksEPWG8Cefdxlfwq43ix8Wi3WdUZUeez1LmmD7YBxZmHbQXofWRK4MY8IrdmggHU2sM4APx6v4Xf4GHCApgg70xLAtsAuZmEZ4P/c4/QWXBALA7sC+wCfKHt4dmBn4Ftm4WD3+Fs9TTLIIeses3AuabSqyPzAocAuajE0gkVXTRG+AYwELjEL+wJ7u8cHWhSu5gSuydff/MDt+X3jlBr++XtVHnvePd41wDVYtazR/AfwEzSC1ZFvHA+TFtwB/JQ077xAky6EhczCd83CdaRaMEdXCFel5gbONAuH6pmSNnBhDV+jacLuM5sCVq+RunWBe8zC8c1e7mEWhgEXkwqR9pgFONksXFlDbav3mvjrfZ60MabIFcAa7vGrTd4pqYA1yCHrNGBM/s8tgf+YhR+YheEDfPHPZBbWMwvH5CnAF4BzgW9QfVi93LGDNYUpUuIu+l6z8S81U9eZvcpjr3VJG0yuMG06CniwyeuLjgI2LXhsixz0lq3y3jeNdIxRM3yxymMvAzu5x/vRLsKusANwC7AmMC/wG2B/s3A5MKbaCyHfRcyf7yJWBVbJf67Yx91dPQ4FLqAz1r0t6R6fbtPfbViuAwVwXyumi4fQjchUs3AnqVRDkQvUUgpYdN8arKLdeMsCdw5gN94RZuGIAfxeywI3m4XV3OPEKnXMRtDagHW6e5yCCo12zZvHO2bhm8DYki3pnwYOAw4zC2+TToifmC+meUhbWefNHyOa/CuO76DmHm0W9mm3rblm4QvACcBa+VP3m4Xvu8d7dIX8z2NVAtbrwN/VRApYCljtdd9IqkU1sUqR01mbsC6saLH9O8CZqJJ714WsiWZhfVLdn/Jh3TmBpfNHKz0OnA+cSmeMXg0jje6daRbWco9TB/n3mZ00xL478JWyh1cHbjMLP3KPv9EVAqSjc4rcmaccRAGrxyS6+6gbgL2A65v0c3cFfkb1af0D+7hJnNak9VdFGeNc9/iqAlZ3hqxJeSTjSOAgmj8yRdmW2YdJB3veCdzkHsd3WPtONwuTSNOox+Y2bmlZjnxntR5pJOZzfdy9zQKckbc+754LcHb1JVLlsfvVg3SlORWwCo+6AXg515NrRn82qcoROJu6x5sZ2FFHDKCIKAUFVU9Bhz1391oT4BCzcDFwCLB1A4PWFGYcnvt0/vNxYBwwvkvewG8HNgMONAuPusfzmtT5LErvNXGrkaZ9h/Xj2303P3d7dfnlUW1X2H/Ue3SlajvVXkUBa1Cu0xrDFTRnkfs3Cj5/VSfuGFTA6l/QegTYPtc1+Rpp0d6nSfVO5iYVSBsBTCXNK7+eP14mTaX0fLwETMjB6kUtnObKHLAAzjELiwAn9mfRo1mYiVTL7NMlHysCK5PWxjXSD8yCu8fDFbAqekq9hgJWiXfd4zsM7hKA4cBOwB+afLDwUJ4a/6DBbf4pepeNKPVLVBxOyqcNgUvzhwzcFcCvgAVJo0lHA/uahdOAm4HnczAdloPsAqR6YYsAi+ZAtUQOuksO4LX8YQ7DL+QA/BWqryeBtOHhT60qItiG3qry2At6aStg1Tid3CrHkGYhdjML2zXx4GkFrBk2Lvj8X7ppw5AClgxWYH3PLBwNnF7y6QVzZ9gsrwH3kOo0PZz/HOce38t3XauRTpGnhvpxG1J8Nh9dvFvqJb26u9Lc7RiwzMK3mVEh/POkmlQ7usfru2CKcDAPmt64Ss0uFLBEmu8s4AfACk36/k8DtwIRuAN4rI+p2X2pfYrsmi5+3oqmcd9xj+/qZU23neU6K2kjSFsFrHwm5nn0Xm85H3CtWTgKOKrB612nKWBBrlxfqYzLDe7xnwpYIrRkFOt9s7AbacF7I04VeJ5Uw+xG0u7L5+roFBYgHdbal3HA1u5xnAIW3VqxW3qbj/6V9Gh26ZXRVB5ZGwYcDqxuFrZ1j5M1gsX0BhcX/RhdPnqlgCXtELL+aRZOAX7cj3/+JnAT6aDQv7vHxwfwq+xH3xX3/wJsoVGawrPLFLAUsNoiYJGWHqzUx9dsAkSzsIl7fKHNQgpDeIqw0vTgWPd4uwKWSOuNIhVv3bSGDuw+UsG+G4C7GlHU0ix8nL6nB+8FvtWzXqvLFY1gva2moSWFettsF3JbBSyzsBWwW41f/hnSMTYbucdHu/hlNb2BRaQr9eNHdGOjKmAJbTCK9YFZ2Bo4h8rTdPcAfwCucI/NWET9Q9KxR1QJDtsoXP3P1CF4VEgnOdosbE4qRvwo8F/gmbzeaRKpWPHUFtbTa5uAlcsDnFXnP/sU6bSGTd3jbXp5DchnSUfylLq6W9tVAUvaJWRNIdUbuyDfAS1E2uk3xj0+1MQOeUHggD6+7IBuKYzHwKYTtMC9NcYBP2XGealFr+12+F2vbJPfoy/zAjeYhSXc48toBKu/tuKj5R8O6dYLVQFL2i1o3ZCn/1rlSIq3mJN3vvxOz0xNNXMUsFrjYTUBzTpPcQ3SWkvp3/Tgd8o+fXY3bwhSwOqMF/a8pKHZEcBjwNM6L6+mdlsB2IPqBTX3UEtR6wjW+2qalniMtLnjRVJh15dIxXJfJ01nv59DcKvWaZ0MrFsQxEeTRjVGkUqmtLMJTSxCOtIsrNGk770Y7TGCtS6pCDQlSwaO6OYLVQFr6N4pLA98lTSdtn7Zc/mWWbgE+J171OG7xc7o43zJA93js2qmmkewpqppaNU5qRu0UX+0SJUgeF0OWOYe7+rip+34Lvh/LJ8ePLFJa2YVsKRhndc8+Q5lGdLZemvkO4UFqH5sxZ7AnmbhFuCH7vFfas1e7boLqV5LkRuB36ulKr7Bf1iwrkYjWN05el40gvIAadcvpCOopH0Na8BN/5Yln5oInNjtjaqANbijUJ8g7WBZhBln7JX/fY4B/qgvAPebhSPc4zFqeTAL8wMnUH3X4G46kLvqa5cWnGcm7W+1Ko89QBrFmgysZhYWcI+vdGk7bekeRzfpetwPOGWQ//9Cfr/q8RP3+LYCVmd1/Ju5x6vb5HeZJd/ZLQEsXvKxWA5Vn6L4eIlGG0Ha2r2ke9wNOZnqI4Cj3ON4NRPdVGhR+mfVagErl2B5EFiPNK15uZqsZYa3agQL2LXk73cDF6j5OyhgmYXhwGVmYSf3eEWLfubcpKm7ZYCRJR9L5jQ/vM2aaVezcId7PKeLR1++CexY5Uv+DvxWXUO/OmNtrEAjWCUeZEYdu/VI04QKWENk2q+OPnUuZuwenA7sq9H/zhvBGp4/zjMLr7rHGxu8zmDlfLe2AmmB+XKkKb6hZidSQc9uXS9SrQjha8B31Tn0u+NezixsSCp8+WwjquzLkA1YT7vH10rWM+4PbGwWhmuHc8uMaFEY25YZZw+e5x7vVtN3WMByj9PMwljg66SCcaOAk+t5szQLMwPL5jDVE6hWJk3nMcCpk1eACaSt1RNK/v4qaY3C2/nPKaS1LNNK1rTMTlqLNUd+IZf+fU7gk6QRs4Xz77polQumm4+DOCW3UZG9G3QmWbcGrC/nD4BpZuFp4EnSOpy7gbtVsLWjblhmyTecFKy/6nEzaQPEwqSdz39T67XdFOFA9Cw7mQQcrGbv3EXuv8oBa0T++95m4SxSzZjn8lESM5EKSy5COv9uudxJrJT/PvMAf4d3cyCi5EW3m3v8Uws7vjlK/r8+Q1r79T7wT+DMLn0z2Jg0elfkEvd4qbqEht3tzsSM6fONSp6HST1hC7gTuNU9vqMmHZJWqNJfPlBy8/uWWbiTVE7muwpYdMwIlllYCVg7/+chXbyJofMDlnscaxauBjbLn1qK5tUfeb9kG/IDpOrKT5CK/Z0K7M2Mc7rGmIU/Avu5x4ktaIfJ+fe6j3SGX7ffaX8cqFaN/SngB+oOBtwZn0QaId2OVAJjeMG5dRuVhK73zELMb7p/dY+PqHmHjC9RfQdhqRtywNrcLMxbMn0oDOlF7ruVrLc7W03e+WUafpw793maEKjuBm4hDXnfkYNMJfuYhUVLgh7A1sDnzcIm7vEBvfRa6lSKpwankg5yflPNNODO+K28geIcs7AwsE0OW9UqWM9KWvz8FeAEszABuAb4I2l0S+t12temFG92uKtCwDomP9/b0KUj6XTeGqxl8p8rA0eZhaNyIVxpw11uNGD05ilSwbNGLLCdQKr2vSHwcff4eff4U/f49yrhqsdRFT63CBDNwgZ66dGq0autqD41eLB7vEct1ZCANaLkOpzgHk9yj2uSpqvPBN6r4XsvDHyfNK3/vFk4ziwsrSZvyw0jny94+N4KU0X35f4U0jShdEbA2hK4Kv+snwJ3m4Xl1PQdGrBy5/6P3En3ZzfYk7kI5brAou5xnxyo3qnzd7ifyoffzgFcbBYW0Muv6W8CS1B9avBq93iKWqphHfeIgmvhcfe4F6l8yUmkzRy1WAj4CfAfs3Bpfj6lPXyD4hmQv1Sq/s+MEg1rmYV11IRDP2C5xymkEg2nlNRFu9csbK/m79CAlZ/4c4Dta7xrfpO0fX8t97i0exzlHv/ZgO36kwo+/0ngh3r5NTVczQRcQvFU8XhgF7VUQ/uNEX1cky+6xwNIxXePBd6oo/PfBnjMLBxrFkboKRh0m1V57C8Fn7+s5O+HqQk7o0yDe/zQPf6IVMC5ZxDhIrNwqDpKOvrMtEtJ28afKPiSF4ADgEXc4/fd470N/hVmrfKY7uCa6wjSKCQF6662co+vq5ka2m8Mr/G6fMU9HkYa0Tq7zuvpUNKmkdn1NAxqeYaNCh5+lVRYtNLzfle+sYFUE2t1tWbHVHLHPf6Y3jUWjzULp1Q5WktPQAeErNuBFYH9gLHAM6TCd7sCS+V1Is06M2nubm77QXwD+CJwSJUvOUjrrlo3RVjl2nzNPe5BOkLlv3X8003Q7tjB9EXSgfKVjO5jY4JGsVpnWD7hpJVV378H3Fry3/uRRrOGaxdh54as94HT8ker3uQXpPpZgy/q+m/aQc4XVQmwo93jaWqppgSs4f28Pm8yCysDhwMH1tgvbWEW1nWPd+rpoF12D0Kalq/mYtK6OkglG1Z2jw93QZuNNAtrNOl7L9bHjfyHrQpY7vFDs7AD8BAwb/70dsCzfdz0KmBJXZbo4/GH1URNOY/yQnqf6l7qdWAPtVTT+o2BrOOYAhyS68VdTHGFcMpq8ChgtX5t47cKHn6+bPSi0vP8SK57FvLr5TBSCZtOdzyDdzM0rZXnFrrH58zCPvk67vETs3B/q84JRlOEHW+VPh6/V03UcEeSdjcV+Thwa67qLo0fwWrEOo4HSWvnrq/hy1W+ofW2pLim3KU1bgw6o+Tv3zELn1WzDvpC92ENnjW6hI/WQjsvj1RrBEsGrNoCzneA29VEDb2z3oxUh6XII6TjkFYCrjULtwKj8sJbqc/MNHdK/02zsEm+6z+wypcuqqei5far8tgFNX6Pq4CXSLuphwFnmIW1O7yo7JbucXST+r79mFEmob8BqxmDLQcCkd4lis43C2t1SwFhjWA1z2eqPHaLe3xPTdSwDmZZ0tTgsCrD86uR6pv1WB/4p1m40iyMVCu2T8Aq2fp9EKkoZVFl6Df0VLT0Olub4t3PY93jv+tYE1tan24NNHVPJ41g5ef5Nj5asmN1Zhyvo4Al/eqIRpAKrhW5Qa3UsLaeC/gTxTs2rwYOdY8fuMdRpKJ4pbtGtwAeNQsn5jMLpf8Bqxmd9PmkM+8qHSL7tJ6Kltqf6sdR1eOssuD887xBRepXNC07GZgyWAEr+1WFz/28W/paBSyadsr87ApYTQ9Xw0gjV0VHMzwEbF86HO0erySd/v54ydfNQqqH9l+zsG9eyCvFZqG1u4DvIB3L8kzZQ3/SU9Gya21h0vorCg5Lv67O53QCcD69DwH/uVq6X24k7dLr8UHu+3bOm0cGLWC5x7Gkg6BLLUDaMayAJf3y5SqPPe4eH1UT0ahF7ZtTvKNp40pnRrrHccBawJiyh+YnlfJ4INfSkjYIWD3H7QCfBa4l7Qb9Hb13KUlz7U3xyOWp/VxTcxy9d7jtbhbWVFPXfW084h4XB2YD5gRmdo+r1bnmq5lZoFJZnO+ZhfnQInfphw2rPKYCiY25o94J+D+KyzF83T2+UKVTegv4tln4CXAMvdcqrATclEsGHOgen1eLD27Ays/ZRFKRUWnttTZbLiBJwWkYv+vn8zneLFxIKvrc8ybfswj6XbV83e35HrUdDUcLpwgBriGNqpX2sR8jrbs7Ho1gSZ3HSKxP8Vz5JWqlhlRq/33Bw+8B33KPj9TYKf0i1/Wp1DFtDYwzC/t1ayVi6j8CSjrPHqRpnUqOrWMaqpKf03sUa8VWFoSW5mcB9/gqcFuFh/bu9HNF9abReOuRtqNWcpt71MLcgYWrVUhrbyqNokwDtnWPN9fZAfyZVD9rcoWH5yRtgb7LLKymZ+B/d5/SPScjHFnw8DP0PnuuP2++T5JOXqBsqnBbtX3Y3yyclEcQh3oWuKbC5z4FfE4BS+rx1SqPXaTmGVCHsyTwV2CeCg9/kMPVmH529Dfm567oAOg1gXvMwhFaBI8OWu4exzDjyJNyh7vHqQ34GYdVuLk5yyx0eyHZ9YEfAfc38ZgdWjBFSNEB4BSfCqCAJXW9YN4BLlfz9DtcLQr8HVioIFztkHcIDuRu+k7SQbYvU7xm8XDgTrOwPBrBks6+5lajeO3VHaQdvDRgCukFProWZy7gsrzkolvtDPwbWD73OYc1calCs7NAUY20zRWwpJ7pq6KSAee7x9fVSv1q108BNwOVCoJ+COziHi9rUGf/UL5zrLawfU3gXrOwMxrBks51esF7xAfAXjUei1OrE/loGY418u9Aly5af4t0sPYk0g7Oo4G/mIUFGGIjWO5xEql6f7klzcInFbCkFttQvLhdCzebE652dY8XNaEkQACepPoozvlm4WyzMKsClnTYdbctqfZYJb/ONyKNvObeBUZReTv/UV0csp4CtsqhFtIO9fvNwjpDMAs8VfD51RSwpBZbFXz++vymLfV18ovlcLVUQbjawz1eQHM6tvGk6cLn+vjS3YCxXVaFei69Ojv6upuD3sdKlXoW+FmTrrnL8/Ve7v/Mwv5dHLLGkgohU7I4/NYGj6C3Igu8Sf3HyilgCZiFtag8ygLFB3FKcXsuXiVcTQY2d4/nNrljez7fMb5K3ztH78iBsBvoSKHOdhiwSMFNzU7u8c2edZFN2Ga/O2m9armTcu27bg1Zp9L7MO2ZSSPoRwyhLPAWXXZouwJW4+xQ8PlH3OM/1Dz9CldLVnj4JeALubRCKzq2xygu4VDq08CN+UiRTjePXqUde+2tAxxY8PAv3eMt+evmAe4GHjMLOzdqZ20u23AoldcInWMWNqW7q+n/t+xzh5uFC83CzEM4YM2rgCV9HTi8S8HDR6mF6mrLVUk7lJao8PCjwDru8b4W3z3eTVpf19dxICOBv+UpFjSCJUOwH7uYyid83E/J1KB7fIO0rnRp0pmCj5uFXRq0y+10KhemnAn4o1nYiO4cxZqcb+SnlT20IzBmgGtBh7Xgf2FYt/UnClg0bDvt3BU+/zBwpZqn5g5+QyACCxccaLqee3xmkDq3awvurMutBJytgCUMzV2DlabkXwW2co/vVzgFYd/8n0sB5wH3mYUvDfBa+5B0fE6l43JmA/5sFnbv0pB1F6k2WbmNgWvNwsf60e8OH+TyLtNRwJKCF+ewkk6m3BEN3srcye24K3AdlRdQnwtsNNhlLtzj8TUeMLyNWdixg5+uBfWK7bjrb8d8o1huKvDtPHVX6Zr4ddmNx2p5qnxMnurv77X2BL0XdlM2kvV7s3BMlz5dPwf+VeHzXwH+mkci2zEHWMHnJypgSZGNSOtvyj0AjFHz1NS5H0k6cmOmCsVZv+sedyu/ex5Euxd0blRYG9GpFd8/of6ko66/NSg+sPn77vHWPsLQcRXOBt0c+JdZ2GEAIetM4NIqX/JTs3BRtxUjzX3hbswo3VAqANfUOV3Yquu2aBOYK2BJkR8WfP7HGr3qs2Of2SxcQOVt348Aa7rH89usc5tCWo/1Tg2dyTad+JwB8xU8PEKv6iH3fFq+EZytYFH7eTV+q32AO8s+NzfwB7NwmVno70Lm7wHjqjy+PWndY7dNWz8F3FLw2BdJVfBHtEsOMAuLAEUjmvcrYEmlF81ywNcqPDSm3gOHu/QQ2b8ClbZenwOs7R7Htekd5Dhgvxq+dOMOfOoWonix6kx6ZQ+pa3BWYDSprlK5q4FD6rgmpgJbk6qOl9uaNJr1pX5ca28DW1J9F+8XSScrrNPp7zdm4SCzcAvpOK8Nqnz55sBv2igH7FRl/dXYTn3O1CEOzNEV3mymAgepaap2FGuSFv+X39G8DezpHi+h/YfpzzYLG/dxltYGZmFYh41kLlPlsZn16h4y1+AI0vRboPKGku3yYvN6ronn8lrKP1G51tFYs/Ar4Kf1HBLtHh81C3sAl/QxYhzzuqxj3eO0DniOZgG+kG/Uvllhim0ccCuwZ8G3+J5ZuKOGYszDa/hddgDWJhULnZw/Xsv//Ubuu98l7XAcRhrNnoVUgmEtUm21Su5yj68oYEn5C27tfGdV7hdFC0IFzML3SNu7y9cI3E06sPkJhlZdmg2ovIMU0mLw+YFXuiRgzaJX+JBxFpUPpv9bLuI7pZ83HlebhdOpvPFnGKnG1gZmYWP3+FId3/dSs7As6bD1au9nRwAbmYUd3eN/h2D/uDTw1by298tApZIvNwAn5+cK0pFGKxZ8y9+Yhdv6eE8aXuMC9e0pXh7QX8ejw56lgl9S+cTwY9U0FTuO2c3Cebljn7VsxO8w4HNDLFzhHicAB/fxZZ12hM4KaARrqF+LvyQtki73Z2Cz/oarEgdRfSPI6sBt+ZzReq63I4ALa/jSdYAHzMJuQ+C5WNIs7GQWzjUL44En8tTepmXhagqp/MtK7vFr7vGv7nF6Hh0/kuqlEUYNNAe4x5Pd4/ykumfbAWeS1skOxIOkqWg0giWlF8XGpKFbyo6R2K2eoe8uaq+RpLUeq5Y99BDp6I1/MbRHAnbOnXol83XY07lelcdm1au97UvKnErl0aXRwLaN2K3rHt8zC9sD91E8qjkSuMIshDp/5h7AYqR1V9XMCZxtFr4N7JsPTW6HadmVSSNO65GmZxfp45+9lAPXmVWm0q7MYWelgsd3Mgt7uccPBjrQkkfCniTv7szHg21J2uxVT1mOycDOnb4RTCNY/SvK9gsqTw3epRb6SHttCtxbFq6mkHYOrjXEwxW5g/hRHx1JJ1X6XhWNYA3VfuvsgnB1CbBNI0uhuMdH+hhZAfgsadqJOhfTf4vqOwtLfQP4t1k43CzMNohPwTGkNUsPkAq6btNHuHqQdDrI4u7x6GrrlHIfVO3EkNlyKG14DnCPz7rHk0hLB86s8Z9N74AbawUsmlcHqfxO4dZmnTA/lN+MzcLvSUPApVuorwNWyJ3G+3RGXZp/VlmA+3IHPa3rU70Ug9Zgtee1OFsecdi1whvdz0hrH6c1aRlFX9NI2/bjens9B6dna/wns5HWZj1mFnZtYn26agU+l+vjcUizIH8GNnCPn3GPF9QxI3JVH+0xop+P1VOba2+KS0f0eC+H+au64drTFGF9HdViwAkViqRtW2X4tRvb6UukYzNKh4yfBA5wj506534wad3EnKX/z/Us5GVoL3AHTRG247X4CdKuvvIp7DdysLq2iTce08zCflTfhr9UP7/3eLOwPnATlQ+Fr2RxUgmYQ8zC0cBl9S7pyCOBC5BGn5bKwWkV0rqykf1sqsmk8xxP7e86VPf4gVn4LanKeyXPN3ugxT1ONwun8NHlMz3uBPZzj/d0y/WnEaz61i+cS+8dY++QdtxMUAuBWfiYWTg1d6g94epFYC9g+Q4OV7jH50m1XkqD9u867H9zugLWkLoeVwbuqhCuHiPVmbu2BdfFjTTpRIt8Lun6QL27BZcGLgCeNQtHmoWF6vi3e5GOdrmftPbpGGCr/D3rPTD5MeDHwKLucZ8GbPI5h7RpqNyLfWxcaGQO+AdpJK50AOJc4Ovu8XPdFK4UsOqzF2nbLGVndN2hpgGzsC5p3cAPc0fzKmlUZ6R7PLNTpgP76PDHAJuRpkEP56OjnUPduBqmYqQ9rsetgNsrLDy+Ooer/9Da0d33q4SMgd7YfKGf3+cTpCnSZ8zCaLPwzRqmD68oOKKmVlOAi4D13ePyeXfe6w3qf17Ov1+56/v4pyMa2Ae+nUPjFqQR70/mo87+2o3XoaYIa+uslqJ3vY4PScPrf1PrgFnYMF/EI4DxwEnAOe7xHbrvtPvrcsDqRDeRKnXPp0XubV2d/aR8Q0jZNNShwOmt3rnlHp8wC2eRjtOpN7TXVC7FLHwx90Gr9+NbzAx8O3+4WbictGnp+Qo/a6JZuIl0sHI9HiWNaP/BPU5qYnP/mo9uHBjdyoEW93iqrkSNYNUz534+vWuS7Oker1Dr/M/t+c13e2Bp93h6N4arLjlk9hdVvmSYWmnQi1TeWSFc3Qys4h5PG8Rt8UeSqn5TYQdjI16bE0nlDy4baDOSFmtX27BR6+/8Bmnn5ufd44ru8dQmh6ueDTe3l3zqHmYUJKUfI1i6ptEIVjMdT+/jJEa5x7PVLL0u6smk6sPS+U7NR3OMVFO0VbjagzRyNWfZ0VMHk2ooTR/kPuIVs3A8vQsx3+QeH2zgz3gX2NYs/Iu0Nmp4nYcnn0UaUXuij7pZV+WSBJXWHE7LgeZC4JoGFG2lnydMxJLBgA8HMNCiA9wVsJrWae1AOtqhx6Hu8QS1jHRxmJ5qFvYnbScv975aqOV91CKkUZKNyh4aC+zuHse30a97ErADsDxpHdMRTXqNHmcWHgYupvgYq9LX7I+As2otVeEe3zAL15GmFCmpW3U+cGleCzWY1+hDeTRzWB7ZQyNYaIqwzTqutYDfl1yEO7nH49QyopAVryUddF7uRbVOy28AHykLV/8FtnSPX2mzcEUezdmUNAq6iXu8tcmv0XVIx5dVs717PKMfdcDKj+zZLE8Bvtwmbf1yjeGqrxygjIBGsBrdcS1Eqh0zG2kefQv3OFYtI/K/DvxnZuED0i6s4SU7rKQF59eRpqi+VvLpSaRq3r9p5x27+QDm/Vv0s8blG+WTSdPa5c4YwFra60lFhBckjcZNHMIvqaYWIUUjWFK2C2cMsHC++1lL4Uqk4hvYkaTjTo4BtnKPZ6lVmto3zWQWRuV+qSdcvUVaJzoyj6BomrZsXZZ7/D7pvLxX6T3aeugAN3z01Lm71z2+16E5QAELjWA10tykSr1XAt/NdT1EpPIbzb35rElpbrhahrTdfuX8qVeA04Bfu8fX1EJ9vk5Hm4XbScU4vwEc7h7fHOC3PZE0gnXeEG8ejWApYLXsQnSz8Fn3+KpaQ0TapWtixqj6aaR6Su+qWerq218CNjYL29KA6Wz3+AaVpx7RCJYoYBVfOApXItJOfdLrZmG1SsUvpe62vFStoKVCalgRESk9Fkak0Z4kbeYq9xzpHEHpp2HTp09XK4iIiNC1a/w+TqpPNoJ0XqIDzw52gVoFLBERERFBU4QiIiIiClgiIiIiClgiIiIiClgiIiIiooAlIiIiooAlIiIiooAlIiIiIgpYIiIiIgpYIiIiIgpYIiIiIqKAJSIiIqKAJSIiIqKAJSIiIiIKWCIiIiIKWCIiIiIKWCIiIiIKWCIiIiKigCUiIiKigCUiIiKigCUiIiIiClgiIiIiClgiIiIiClgiIiIiooAlIiIiooAlIiIiooAlIiIiIgpYIiIiIgpYIiIiIgpYIiIiIgpYIiIiIqKAJSIiIqKAJSIiIqKAJSIiIiIKWCIiIiIKWCIiIiIKWCIiIiKigCUiIiKigCUiIiKigCUiIiKigCUiIiIiClgiIiIiClgiIiIiClgiIiIiooAlIiIiooAlIiIiooAlIiIiIgpYIiIiIgpYIiIiIgpYIiIiIqKAJSIiIqKAJSIiIqKAJSIiIqKAJSIiIiIKWCIiIiIKWCIiIiIKWCIiIiKigCUiIiKigCUiIiKigCUiIiIiClgiIiIirfT/d8lc+7qnlIsAAAAASUVORK5CYII=';
