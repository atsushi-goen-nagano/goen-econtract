const test = require('node:test');
const assert = require('node:assert');
const L = require('../gas/Logic.gs');

const base = () => ({
  contractNo: '26-0152', contractDate: '2026-11-01',
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
test('calcTotal / monthPrefix / caseNo', () => {
  assert.strictEqual(L.calcTotal(250000, 30000), 220000);
  assert.strictEqual(L.monthPrefix('2026-11-01'), '2026年11月');
  assert.strictEqual(L.monthPrefix('2027-02-03'), '2027年02月');
  assert.strictEqual(L.normalizeCaseNo(' ２６－０１５２ '), '26-0152');
  assert.strictEqual(L.normalizeCaseNo('26-0152-2'), '26-0152-2');
  assert.ok(L.CASE_NO_RE.test('26-0152') && L.CASE_NO_RE.test('26-0152-2'));
  assert.ok(!L.CASE_NO_RE.test('GOEN-20261101-001') && !L.CASE_NO_RE.test('260152'));
  assert.ok(L.validateContract(Object.assign(base(), { contractNo: '' })).some(x => x.includes('案件番号')));
  assert.ok(L.validateContract(Object.assign(base(), { contractNo: 'abc' })).some(x => x.includes('26-0152')));
  assert.strictEqual(L.validateContract(Object.assign(base(), { contractNo: '２６-０１５２' })).length, 0);
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
test('validate skipDeliver (remote)', () => {
  const d = base(); d.deliver = ''; d.custEmail = '';
  assert.deepStrictEqual(L.validateContract(d, { skipDeliver: true }), []);
  assert.ok(L.validateContract(d).some(m => m.includes('受け取り')));
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
  assert.strictEqual(m['《契約番号》'], '26-0152');
  assert.strictEqual(m['《契約日》'], '令和8年11月1日');
  assert.strictEqual(m['《作業費》'], '250,000');
  assert.strictEqual(m['《合計》'], '220,000');
  assert.strictEqual(m['《チェック:遺品整理》'], '☑');
  assert.strictEqual(m['《チェック:家財整理》'], '☐');
  assert.strictEqual(m['《チェック:ゴミ屋敷清掃》'], '☐');
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
test('split payment', () => {
  const d = Object.assign(base(), { payMethod: '2回', payFirstAmount: 10000, payFirstDate: '2026-11-16', payFirstHow: '現金', payRestDate: '2026-12-10', payRestHow: '現金', payDays: '' });
  assert.deepStrictEqual(L.validateContract(d), []);
  const m = L.buildReplaceMap(d, '2026-11-14', '10:00');
  assert.strictEqual(m['《チェック:支払2回》'], '☑');
  assert.strictEqual(m['《チェック:支払現金》'], '☐');
  assert.strictEqual(m['《分割1回目金額》'], '10,000');
  assert.strictEqual(m['《分割1回目日》'], '令和8年11月16日');
  assert.strictEqual(m['《分割1回目方法》'], '現金');
  assert.strictEqual(m['《分割残金》'], '210,000');
  assert.strictEqual(m['《分割残金日》'], '令和8年12月10日');
  assert.strictEqual(m['《分割残金方法》'], '現金');
  assert.strictEqual(m['《振込期限日数》'], '—');
  const v = Object.assign({}, d, { payRestHow: '振込' });
  assert.strictEqual(L.buildReplaceMap(v, '2026-11-14', '10:00')['《分割残金方法》'], '銀行振込（振込手数料は甲の負担）');
  assert.deepStrictEqual(L.validateContract(v), []);
  assert.ok(L.validateContract(Object.assign({}, d, { payRestDate: '' })).some(x => x.includes('残金のお支払い期日')));
  assert.ok(L.validateContract(Object.assign({}, d, { payRestDate: '2026-11-16' })).some(x => x.includes('後の日')));
  assert.ok(L.validateContract(Object.assign({}, d, { payFirstAmount: 220000 })).some(x => x.includes('少なく')));
  assert.ok(L.validateContract(Object.assign({}, d, { payFirstDate: '' })).some(x => x.includes('期日')));
  assert.ok(L.validateContract(Object.assign({}, d, { payFirstHow: '' })).some(x => x.includes('1回目のお支払い方法')));
  const one = L.buildReplaceMap(base(), '2026-11-14', '10:00');
  assert.strictEqual(one['《分割残金》'], '—');
});
test('replace map sanitizes', () => {
  const d = base(); d.scope = 'a$b'; d.keyKeep = 'なし'; d.keyReturn = '2026-11-07'; d.payMethod = '現金';
  const m = L.buildReplaceMap(d, '2026-11-01', '09:00');
  assert.strictEqual(m['《作業範囲》'], 'a＄b');
  assert.strictEqual(m['《鍵返却日》'], '—');
  assert.strictEqual(m['《振込期限日数》'], '—');
});
