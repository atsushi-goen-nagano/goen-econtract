const test = require('node:test');
const assert = require('node:assert');
const L = require('../gas/Logic.gs');

const base = () => ({
  contractNo: 'GOEN-20261101-001', contractDate: '2026-11-01',
  custAddress: '長野市○○1-2-3', custName: 'テスト 太郎', custTel: '090-0000-0000', custEmail: 'taro@example.com',
  staff: '小口（代表）', works: ['遺品整理', 'その他'], worksOther: '仏壇の供養',
  scope: '2階の全部屋。写真は残す', place: '長野市○○1-2-3', dateFrom: '2026-11-05', dateTo: '2026-11-06',
  attend: 'あり', keyKeep: 'あり', keyReturn: '2026-11-07',
  fee: 250000, buy: 30000, payMethod: '振込', payDays: 7, searchItems: '通帳・印鑑', deliver: 'メール'
});

test('wareki', () => {
  assert.strictEqual(L.wareki('2026-11-01'), '令和8年11月1日');
  assert.strictEqual(L.wareki('2019-05-01'), '令和元年5月1日');
  assert.strictEqual(L.wareki(''), '');
});
test('yen', () => {
  assert.strictEqual(L.yen(250000), '250,000');
  assert.strictEqual(L.yen(0), '0');
  assert.strictEqual(L.yen(-5000), '-5,000');
});
test('calcTotal / monthPrefix / contractNo', () => {
  assert.strictEqual(L.calcTotal(250000, 30000), 220000);
  assert.strictEqual(L.monthPrefix('2026-11-01'), '2026年11月');
  assert.strictEqual(L.monthPrefix('2027-02-03'), '2027年02月');
  assert.strictEqual(L.contractNo('2026-11-01', 3), 'GOEN-20261101-003');
});
test('validate ok', () => {
  assert.deepStrictEqual(L.validateContract(base()), []);
});
test('validate required', () => {
  const d = base(); d.custName = ''; d.works = []; d.fee = ''; d.deliver = '';
  const e = L.validateContract(d);
  assert.ok(e.some(m => m.includes('お名前')));
  assert.ok(e.some(m => m.includes('作業内容')));
  assert.ok(e.some(m => m.includes('作業費')));
  assert.ok(e.some(m => m.includes('受け取り')));
});
test('validate conditional', () => {
  let d = base(); d.deliver = 'LINE'; d.custEmail = '';
  assert.deepStrictEqual(L.validateContract(d), []);
  d = base(); d.deliver = 'メール'; d.custEmail = '';
  assert.ok(L.validateContract(d).some(m => m.includes('メール')));
  d = base(); d.keyKeep = 'あり'; d.keyReturn = '';
  assert.ok(L.validateContract(d).some(m => m.includes('返却日')));
  d = base(); d.payMethod = '振込'; d.payDays = 0;
  assert.ok(L.validateContract(d).some(m => m.includes('期限')));
  d = base(); d.works = ['その他']; d.worksOther = '';
  assert.ok(L.validateContract(d).some(m => m.includes('その他')));
  d = base(); d.dateTo = '2026-11-01';
  assert.ok(L.validateContract(d).some(m => m.includes('終了日')));
});
test('replace map', () => {
  const m = L.buildReplaceMap(base(), '2026-11-01', '14:05');
  assert.strictEqual(m['《契約番号》'], 'GOEN-20261101-001');
  assert.strictEqual(m['《契約日》'], '令和8年11月1日');
  assert.strictEqual(m['《作業費》'], '250,000');
  assert.strictEqual(m['《合計》'], '220,000');
  assert.strictEqual(m['《チェック:遺品整理》'], '☑');
  assert.strictEqual(m['《チェック:生前整理》'], '☐');
  assert.strictEqual(m['《チェック:その他》'], '☑');
  assert.strictEqual(m['《チェック:立会あり》'], '☑');
  assert.strictEqual(m['《チェック:鍵なし》'], '☐');
  assert.strictEqual(m['《チェック:支払振込》'], '☑');
  assert.ok(!('《チェック:支払カード》' in m));
  assert.ok(L.validateContract(Object.assign(base(), { payMethod: 'カード' })).some(x => x.includes('お支払い方法')));
  assert.strictEqual(m['《チェック:受取メール》'], '☑');
  assert.strictEqual(m['《振込期限日数》'], '7');
  assert.strictEqual(m['《鍵返却日》'], '令和8年11月7日');
  assert.strictEqual(m['《甲署名日》'], '令和8年11月1日 14:05');
  assert.strictEqual(m['《乙電話》'], '026-405-8085');
  // every placeholder defined is present in the map
  L.PLACEHOLDERS.forEach(k => assert.ok(k in m, 'missing ' + k));
  Object.keys(m).forEach(k => assert.ok(L.PLACEHOLDERS.includes(k), 'extra ' + k));
});
test('replace map sanitizes', () => {
  const d = base(); d.scope = 'a$b'; d.keyKeep = 'なし'; d.keyReturn = '2026-11-07'; d.payMethod = '現金';
  const m = L.buildReplaceMap(d, '2026-11-01', '09:00');
  assert.strictEqual(m['《作業範囲》'], 'a＄b');
  assert.strictEqual(m['《鍵返却日》'], '—');
  assert.strictEqual(m['《振込期限日数》'], '—');
});
