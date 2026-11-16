import test from 'node:test';
import assert from 'node:assert/strict';
import { asMoney, asDate, daysLate, calculateMetrics, subscriptionLabel, paymentLabel } from '../public/logic.js';

test('formata valores monetários corretamente', () => {assert.match(asMoney(19700), /197,00/);assert.match(asMoney(0), /0,00/);});
test('datas são interpretadas sem fuso de timezone',()=>{assert.equal(asDate('2026-11-10'), '10/11/2026');assert.equal(asDate(null), '—');});
test('dias de atraso não contam antes do vencimento',()=>{const today=new Date(2026,10,15,12,0,0);assert.equal(daysLate('2026-11-10',today),5);assert.equal(daysLate('2026-11-16',today),0);});
test('indicadores são calculados com dados reais',()=>{const result=calculateMetrics({tenants:[{id:1},{id:2}],subscriptions:[{status:'trial'},{status:'active'}],invoices:[{status:'open',amount_cents:19700},{status:'paid',amount_cents:2500}],payments:[{state:'approved',amount_cents:19700},{state:'submitted',amount_cents:19700}]});assert.deepEqual(result,{tenants:2,active:1,trials:1,outstanding:19700,received:19700,overdue:0});});
test('situações financeiras têm legenda estável',()=>{assert.equal(subscriptionLabel('suspended'),'Suspensa');assert.equal(paymentLabel('submitted'),'Em análise');});
