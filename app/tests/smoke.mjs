import { parseSeq } from '../src/core/parser.js';
import { Evaluator } from '../src/core/eval.js';
import { tok } from '../src/core/expr.js';
const T = (s) => {
  const out = []; const re = /sin\(|cos\(|tan\(|log\(|ln\(|√\(|Abs\(|GCD\(|LCM\(|\(-\)|nCr|nPr|[0-9.]|[+−×÷()²!%,πA-Fxyz]/gu;
  let m; while ((m = re.exec(s))) out.push(tok(m[0])); return out;
};
const ctx = { angle: 'deg', vars: {}, ans: undefined };
for (const s of ['7×8−4×5', '2+3×4', '(5²)²', 'sin(30)', 'sin(45)', '1÷3+1÷6', '6÷2(1+2)', 'GCD(28,35)', 'LCM(9,15)', '10nPr4', '10nCr4', '(5+3)!', 'log(1000)', 'ln(90)', '150×20%', '(-)2²', '√(8)', 'tan(15)', 'cos(150)']) {
  try {
    const ev = new Evaluator(ctx); const v = ev.ev(parseSeq(T(s)));
    console.log(s, '=>', v.dec.toSignificantDigits(12).toString(), v.ex ? JSON.stringify(v.ex.map(t => [t.n.toString(), t.d.toString(), t.r.toString(), t.p])) : '');
  } catch (e) { console.log(s, 'ERR', e.kind || e.message); }
}
import { formatValue, seqText, DEFAULT_SETTINGS, recurringSeq, primeFactorSeq, sexagesimalSeq, standardFormSeq } from '../src/core/format.js';
const S = DEFAULT_SETTINGS;
for (const s of ['2÷3+3÷2', '1÷200', '123456', '√(8)', 'tan(15)', 'cos(150)', 'ln(90)', '1÷3', '15625', '2+(-)3', '1÷6']) {
  const v = new Evaluator(ctx).ev(parseSeq(T(s)));
  console.log(s, ' => ', seqText(formatValue(v, S)), ' | dec:', seqText(formatValue(v, S, 'dec')));
}
const v = new Evaluator(ctx).ev(parseSeq(T('10÷3')));
console.log(seqText(recurringSeq(v)), seqText(primeFactorSeq(new Evaluator(ctx).ev(parseSeq(T('2036162'))))), seqText(primeFactorSeq(new Evaluator(ctx).ev(parseSeq(T('1014'))))), seqText(sexagesimalSeq(new Evaluator(ctx).ev(parseSeq(T('1.25'))))), seqText(standardFormSeq(new Evaluator(ctx).ev(parseSeq(T('123456'))))));
