// App registry.
import { makeCalculate } from './calculate.js';
import { makeStatistics } from './statistics.js';
import { makeTable } from './table.js';
import { makeEquation } from './equation.js';
import { makeInequality, makeRatio, makeComplex, makeDistribution } from './misc1.js';
import { makeMatrix, makeVector } from './matrix.js';
import { makeBaseN } from './basen.js';
import { makeSpreadsheet } from './spreadsheet.js';
import { makeMathBox } from './mathbox.js';

export function placeholder(name) {
  return (calc) => ({
    key(k) { if (k === 'AC' || k === 'BACK') return; },
    render(lcd) { lcd.bigText(name, 3, 11); lcd.bigText('(not built yet)', 3, 27); },
    status() { return { mathI: calc.math, angle: calc.settings.angle }; },
  });
}

export const APP_FACTORIES = {
  Calculate: makeCalculate,
  Statistics: makeStatistics, Table: makeTable, Equation: makeEquation,
  Inequality: makeInequality, Distribution: makeDistribution, Complex: makeComplex,
  Matrix: makeMatrix, Vector: makeVector, Spreadsheet: makeSpreadsheet,
  Ratio: makeRatio, MathBox: makeMathBox, BaseN: makeBaseN,
};
