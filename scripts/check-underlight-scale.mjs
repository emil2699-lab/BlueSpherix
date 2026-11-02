import assert from 'node:assert/strict';
import { positionUnderlight } from '../app/glass-underlight.ts';

const balance = 10000;
assert.equal(positionUnderlight(0, balance), 0);
assert.equal(positionUnderlight(5, balance), .25);
assert.equal(positionUnderlight(10, balance), .25); // 0.1%
assert.equal(positionUnderlight(155, balance), .625);
assert.equal(positionUnderlight(300, balance), 1); // 3%
assert.equal(positionUnderlight(900, balance), 1);
for (const result of [5,10,20,100,155,300,900]) {
  assert.equal(positionUnderlight(result,balance), positionUnderlight(-result,balance));
  assert.equal(positionUnderlight(result,balance), positionUnderlight(result*2,balance*2));
}
for (const [result,saldo] of [[1,0],[1,-1],[NaN,balance],[Infinity,balance],[1,NaN],[1,Infinity]]) {
  assert.equal(positionUnderlight(result,saldo),0);
}
console.log('Underlight: signed symmetry, balance ratio, 0.1% floor, 3% ceiling, zero/invalid values passed');
