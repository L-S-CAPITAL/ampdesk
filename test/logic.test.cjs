/* AmpDesk logic tests — node:test, no dependencies. Run: npm test */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const L = require('../src/logic.js');
const D = require('../src/data.js');

const today = '2026-11-23';

function baseTargets() { return { ...L.DEFAULT_TARGETS }; }

function tech(id, costRate, extra = {}) {
  return {
    id, name: 'Tech ' + id, level: 'Electrician',
    costRate, chargeRate: costRate * 2,
    availableHrsPerWeek: 38, billableHrsThisWeek: 34, downtimeHrsThisWeek: 4,
    notesAuditedPct: 100, ...extra
  };
}

test('date helpers handle month and year boundaries', () => {
  assert.equal(L.daysBetween('2026-11-20', '2026-11-23'), 3);
  assert.equal(L.daysBetween('2026-11-23', '2026-11-20'), -3);
  assert.equal(L.daysBetween('2026-11-23', '2026-12-02'), 9);
  assert.equal(L.addDaysISO('2026-11-23', 9), '2026-12-02');
  assert.equal(L.addDaysISO('2026-12-28', 7), '2027-01-04');
  assert.equal(L.addDaysISO('2026-11-23', -30), '2026-10-24');
});

test('avgCostRate averages crew rates and rejects unknown ids', () => {
  const techs = [tech('a', 58), tech('b', 30)];
  assert.equal(L.avgCostRate(['a'], techs), 58);
  assert.equal(L.avgCostRate(['a', 'b'], techs), 44);
  assert.equal(L.avgCostRate(['a', 'b', 'a'], techs), (58 + 30 + 58) / 3);
  assert.throws(() => L.avgCostRate([], techs), /no assigned technicians/i);
  assert.throws(() => L.avgCostRate(['a', 'zz'], techs), /Unknown technician id: zz/);
});

test('computeJobCost: labour at blended rate plus materials', () => {
  const techs = [tech('a', 58), tech('b', 30)];
  const job = { techIds: ['a', 'b'], actualHrs: 50, materialsCost: 950 };
  const c = L.computeJobCost(job, techs);
  assert.equal(c.blendedCostRate, 44);
  assert.equal(c.labourCost, 2200);
  assert.equal(c.materialsCost, 950);
  assert.equal(c.costToDate, 3150);
});

test('jobMarginView: invoiced job uses realised cost', () => {
  const techs = [tech('a', 58), tech('b', 30)];
  const job = {
    id: 'J-1', status: 'invoiced', quoted: 4950, invoiceAmount: 4950,
    budgetHrs: 48, actualHrs: 50, materialsCost: 950, techIds: ['a', 'b'],
    whs: { swms: true, jsa: true, testResults: true }, notesAudited: true
  };
  const v = L.jobMarginView(job, techs, baseTargets(), today);
  assert.equal(v.sell, 4950);
  assert.equal(v.costToDate, 3150);
  assert.ok(Math.abs(v.effectiveMarginPct - (4950 - 3150) / 4950 * 100) < 0.01);
  assert.equal(v.status, 'on-target');
  assert.ok(Math.abs(v.hrsUsedPct - 50 / 48 * 100) < 0.01);
  assert.deepEqual(v.flags, []);
});

test('jobMarginView: in-progress job projects final margin via estimate-to-complete', () => {
  const techs = [tech('c', 52), tech('d', 38)]; // avg 45
  const job = {
    id: 'J-2', status: 'in-progress', quoted: 9900,
    budgetHrs: 64, actualHrs: 71, estToComplete: { hrs: 12, materials: 0 },
    materialsCost: 3900, techIds: ['c', 'd']
  };
  const v = L.jobMarginView(job, techs, baseTargets(), today);
  assert.equal(v.costToDate, 7095);
  assert.equal(v.projectedCost, 7635);
  assert.ok(Math.abs(v.effectiveMarginPct - (9900 - 7635) / 9900 * 100) < 0.01);
  assert.equal(v.status, 'eroded');
  assert.ok(Math.abs(v.marginToDatePct - (9900 - 7095) / 9900 * 100) < 0.01);
  assert.ok(v.flags.includes('hrs-over-budget'));
});

test('margin status bands: on-target / watch / eroded', () => {
  const techs = [tech('a', 100)]; // cost = 10 hrs x $100 = $1000
  const targets = baseTargets(); // 32% target, 5pt band -> floor 27%
  const mk = (quoted) => ({
    id: 'J', status: 'in-progress', quoted, budgetHrs: 10, actualHrs: 10,
    estToComplete: { hrs: 0, materials: 0 }, materialsCost: 0, techIds: ['a']
  });
  assert.equal(L.jobMarginView(mk(1471), techs, targets, today).status, 'on-target'); // 32.0%
  assert.equal(L.jobMarginView(mk(1370), techs, targets, today).status, 'watch');    // 27.0%
  assert.equal(L.jobMarginView(mk(1250), techs, targets, today).status, 'eroded');   // 20.0%
});

test('job flags: WHS docs, close-out, notes audit, unscheduled', () => {
  const techs = [tech('a', 58)];
  const targets = baseTargets();
  const lateCompleted = {
    id: 'J-3', status: 'completed', quoted: 2550, budgetHrs: 14, actualHrs: 15,
    estToComplete: { hrs: 0, materials: 0 }, materialsCost: 680, techIds: ['a'],
    completedDate: '2026-11-12', // 11 days before `today`
    whs: { swms: true, jsa: true, testResults: false }, notesAudited: false
  };
  const v = L.jobMarginView(lateCompleted, techs, targets, today);
  assert.ok(v.flags.includes('close-out-overdue'));
  assert.ok(v.flags.includes('notes-not-audited'));
  assert.ok(v.flags.includes('whs-incomplete'));

  const freshCompleted = { ...lateCompleted, id: 'J-4', completedDate: '2026-11-21', whs: { swms: true, jsa: true, testResults: true } };
  const vf = L.jobMarginView(freshCompleted, techs, targets, today);
  assert.ok(vf.flags.includes('notes-not-audited'));
  assert.ok(!vf.flags.includes('close-out-overdue'));
  assert.ok(!vf.flags.includes('whs-incomplete'));

  const approvedLate = {
    id: 'J-5', status: 'approved', quoted: 2600, budgetHrs: 20, actualHrs: 0,
    estToComplete: { hrs: 20, materials: 0 }, materialsCost: 0, techIds: ['a'],
    approvedDate: '2026-11-14', scheduledDate: null, whs: { swms: true, jsa: true, testResults: false }
  };
  assert.ok(L.jobMarginView(approvedLate, techs, targets, today).flags.includes('unscheduled'));

  const scheduledNoSwms = { ...approvedLate, id: 'J-6', status: 'scheduled', scheduledDate: '2026-11-26', whs: { swms: false, jsa: false, testResults: false } };
  assert.ok(L.jobMarginView(scheduledNoSwms, techs, targets, today).flags.includes('whs-incomplete'));
});

test('technician utilisation: percentages, idle share and flags', () => {
  const targets = baseTargets();
  const t = tech('x', 50, { availableHrsPerWeek: 38, billableHrsThisWeek: 22, downtimeHrsThisWeek: 12, notesAuditedPct: 70 });
  const u = L.technicianUtilisation(t, targets);
  assert.ok(Math.abs(u.billablePct - 22 / 38 * 100) < 0.01);
  assert.ok(Math.abs(u.downtimePct - 12 / 38 * 100) < 0.01);
  assert.ok(Math.abs(u.idlePct - (100 - 22 / 38 * 100 - 12 / 38 * 100)) < 0.01);
  assert.ok(u.flags.includes('downtime-critical'));
  assert.ok(u.flags.includes('notes-audit-gap'));

  const over = L.technicianUtilisation(tech('y', 50, { billableHrsThisWeek: 40, downtimeHrsThisWeek: 2 }), targets);
  assert.ok(over.billablePct > 100); // overtime allowed, documented behaviour
  assert.equal(over.idlePct, 0);
  assert.ok(!over.flags.includes('downtime-critical'));
});

test('quote aging, buckets and weighted follow-up queue', () => {
  const targets = baseTargets();
  const quotes = [
    { id: 'q1', clientId: 'c', title: 'A', value: 2000, sentDate: '2026-11-20', status: 'sent' },     // 3d fresh
    { id: 'q2', clientId: 'c', title: 'B', value: 5000, sentDate: '2026-11-17', status: 'viewed' },   // 6d due
    { id: 'q3', clientId: 'c', title: 'C', value: 1000, sentDate: '2026-11-11', status: 'sent' },     // 12d stale
    { id: 'q4', clientId: 'c', title: 'D', value: 9000, sentDate: '2026-11-05', closedDate: '2026-11-13', status: 'won' },
    { id: 'q5', clientId: 'c', title: 'E', value: 4000, sentDate: '2026-11-01', closedDate: '2026-11-08', status: 'lost' }
  ];
  assert.equal(L.quoteBucket(quotes[0], targets, today), 'fresh');
  assert.equal(L.quoteBucket(quotes[1], targets, today), 'due');
  assert.equal(L.quoteBucket(quotes[2], targets, today), 'stale');
  assert.equal(L.quoteBucket(quotes[3], targets, today), 'closed');

  const q = L.followUpQueue(quotes, targets, today);
  assert.deepEqual(q.map(x => x.id), ['q2', 'q3']); // value x age weighting puts q2 first
  assert.equal(q[0].priority, 5000 * 6 / 5);

  const stats = L.quoteStats(quotes, targets, today);
  assert.equal(stats.open, 3);
  assert.equal(stats.openValue, 8000);
  assert.equal(stats.overdueCount, 2);
  assert.equal(stats.overdueValue, 6000);
  assert.deepEqual(stats.buckets, { fresh: 1, due: 1, stale: 1 });
  assert.equal(stats.won, 1);
  assert.equal(stats.lost, 1);
  assert.equal(stats.conversionPct, 50);
});

test('quoteStats: conversion is 0 (not NaN) with no closed quotes', () => {
  const stats = L.quoteStats([{ id: 'q', clientId: 'c', title: 'x', value: 100, sentDate: '2026-11-20', status: 'sent' }], baseTargets(), today);
  assert.equal(stats.conversionPct, 0);
});

test('realised and active margin aggregates', () => {
  const techs = [tech('a', 58)];
  const jobs = [
    { id: 'J', status: 'invoiced', quoted: 1000, budgetHrs: 10, actualHrs: 10, estToComplete: { hrs: 0, materials: 0 }, materialsCost: 0, techIds: ['a'] },
    { id: 'K', status: 'in-progress', quoted: 2000, budgetHrs: 20, actualHrs: 5, estToComplete: { hrs: 15, materials: 100 }, materialsCost: 0, techIds: ['a'] },
    { id: 'M', status: 'completed', quoted: 3000, budgetHrs: 10, actualHrs: 10, estToComplete: { hrs: 0, materials: 0 }, materialsCost: 0, techIds: ['a'] }
  ];
  const rm = L.realisedMargin(jobs, techs);
  assert.equal(rm.sell, 1000);
  assert.equal(rm.cost, 580);
  assert.equal(rm.pct, 42);

  const am = L.activeMargin(jobs, techs);
  assert.equal(am.quoted, 2000); // only approved/scheduled/in-progress count as WIP
  assert.equal(am.projectedCost, 1260);
  assert.equal(am.pct, 37);
});

test('fleetUtilisation: weighted across crew, safe on empty input', () => {
  const targets = baseTargets();
  const crew = [
    tech('a', 50, { availableHrsPerWeek: 38, billableHrsThisWeek: 34, downtimeHrsThisWeek: 4 }),
    tech('b', 50, { availableHrsPerWeek: 38, billableHrsThisWeek: 22, downtimeHrsThisWeek: 12 })
  ];
  const f = L.fleetUtilisation(crew);
  assert.equal(f.availableHrs, 76);
  assert.equal(f.billableHrs, 56);
  assert.equal(f.downtimeHrs, 16);
  assert.ok(Math.abs(f.billablePct - 56 / 76 * 100) < 0.01);
  assert.ok(Math.abs(f.downtimePct - 16 / 76 * 100) < 0.01);

  const empty = L.fleetUtilisation([]);
  assert.equal(empty.billablePct, 0);
  assert.equal(empty.downtimePct, 0);
});

test('clientSummary: open values exclude closed quotes, cadence flags overdue', () => {
  const targets = baseTargets();
  const client = { id: 'c1', name: 'Client', sector: 's', health: 'stable', revenueYtd: 50000, lastContact: '2026-10-16', opportunities: [{ title: 'o1', value: 10000 }, { title: 'o2', value: 5000 }] };
  const jobs = [{ id: 'J', clientId: 'c1', status: 'in-progress', quoted: 4000, budgetHrs: 10, actualHrs: 0, estToComplete: { hrs: 10, materials: 0 }, materialsCost: 0, techIds: ['a'] }];
  const quotes = [
    { id: 'q1', clientId: 'c1', title: 'x', value: 3000, sentDate: '2026-11-20', status: 'sent' },
    { id: 'q2', clientId: 'c1', title: 'y', value: 2000, sentDate: '2026-11-10', closedDate: '2026-11-15', status: 'won' }
  ];
  const s = L.clientSummary(client, jobs, quotes, targets, today);
  assert.equal(s.openJobs, 1);
  assert.equal(s.openJobValue, 4000);
  assert.equal(s.openQuoteCount, 1);
  assert.equal(s.openQuoteValue, 3000); // won quote excluded
  assert.equal(s.opportunityValue, 15000);
  assert.equal(s.contactDays, 38);
  assert.equal(s.contactOverdue, true);
  assert.equal(s.nextContactDue, '2026-11-15');
});

test('kpiSummary: aggregates agree with component functions', () => {
  const techs = [tech('a', 58, { billableHrsThisWeek: 30, downtimeHrsThisWeek: 6 })];
  const jobs = [
    { id: 'J', status: 'invoiced', quoted: 1000, budgetHrs: 10, actualHrs: 10, estToComplete: { hrs: 0, materials: 0 }, materialsCost: 0, techIds: ['a'] },
    { id: 'K', status: 'approved', quoted: 2000, budgetHrs: 20, actualHrs: 0, estToComplete: { hrs: 20, materials: 0 }, materialsCost: 0, techIds: ['a'] }
  ];
  const quotes = [
    { id: 'q1', clientId: 'c1', title: 'x', value: 3000, sentDate: '2026-11-20', status: 'sent' },
    { id: 'q2', clientId: 'c1', title: 'y', value: 2000, sentDate: '2026-11-10', closedDate: '2026-11-15', status: 'won' }
  ];
  const targets = baseTargets();
  const k = L.kpiSummary({ jobs, quotes, technicians: techs }, targets, today);
  assert.deepEqual(k.realisedMargin, L.realisedMargin(jobs, techs));
  assert.deepEqual(k.openMargin, L.activeMargin(jobs, techs));
  assert.deepEqual(k.utilisation, L.fleetUtilisation(techs));
  assert.deepEqual(k.quotes, L.quoteStats(quotes, targets, today));
  assert.equal(k.wipValue, 2000);
});

test('buildAlerts: coverage, severity ranking and deterministic order', () => {
  const techs = [
    tech('a', 58),
    tech('d', 40, { availableHrsPerWeek: 38, billableHrsThisWeek: 22, downtimeHrsThisWeek: 12, notesAuditedPct: 70 })
  ];
  const jobs = [
    { id: 'J-WHS', clientId: 'c1', title: 'whs job', status: 'scheduled', quoted: 1000, budgetHrs: 40, actualHrs: 0, estToComplete: { hrs: 40, materials: 0 }, materialsCost: 0, techIds: ['a'], approvedDate: '2026-11-20', scheduledDate: '2026-11-26', whs: { swms: false, jsa: false, testResults: false } },
    { id: 'J-ERODE', clientId: 'c1', title: 'eroding job', status: 'in-progress', quoted: 9900, budgetHrs: 64, actualHrs: 71, estToComplete: { hrs: 12, materials: 0 }, materialsCost: 3900, techIds: ['a'], whs: { swms: true, jsa: true, testResults: false } },
    { id: 'J-CLOSE', clientId: 'c1', title: 'close-out job', status: 'completed', quoted: 2550, budgetHrs: 14, actualHrs: 15, estToComplete: { hrs: 0, materials: 0 }, materialsCost: 680, techIds: ['a'], completedDate: '2026-11-12', whs: { swms: true, jsa: true, testResults: true }, notesAudited: false },
    { id: 'J-NOTES', clientId: 'c1', title: 'notes job', status: 'completed', quoted: 1250, budgetHrs: 12, actualHrs: 11, estToComplete: { hrs: 0, materials: 0 }, materialsCost: 150, techIds: ['a'], completedDate: '2026-11-21', whs: { swms: true, jsa: true, testResults: true }, notesAudited: false },
    { id: 'J-OK', clientId: 'c1', title: 'healthy invoiced job', status: 'invoiced', quoted: 5000, budgetHrs: 10, actualHrs: 10, estToComplete: { hrs: 0, materials: 0 }, materialsCost: 0, techIds: ['a'], completedDate: '2026-10-01', whs: { swms: true, jsa: true, testResults: true }, notesAudited: true }
  ];
  const quotes = [
    { id: 'Q-STALE', clientId: 'c1', title: 'stale high-value', value: 14800, sentDate: '2026-11-11', status: 'sent' },
    { id: 'Q-OK', clientId: 'c1', title: 'fresh', value: 1000, sentDate: '2026-11-20', status: 'sent' }
  ];
  const clients = [{ id: 'c1', name: 'Kedron', sector: 's', health: 'stable', revenueYtd: 1000, lastContact: '2026-10-16' }];

  const alerts = L.buildAlerts({ jobs, quotes, technicians: techs, clients }, baseTargets(), today);
  const rank = { critical: 0, warning: 1, info: 2 };

  // severity sorted, no NaN
  for (let i = 1; i < alerts.length; i++) assert.ok(rank[alerts[i].severity] >= rank[alerts[i - 1].severity]);

  const byArea = {};
  alerts.forEach(a => { (byArea[a.area] = byArea[a.area] || []).push(a); });
  assert.ok(byArea['WHS'].length === 1 && byArea['WHS'][0].severity === 'critical');
  assert.ok(byArea['Margin'].some(a => a.severity === 'critical' && a.refId === 'J-ERODE'));
  assert.ok(byArea['Quotes'].some(a => a.severity === 'critical' && a.refId === 'Q-STALE'));
  assert.ok(byArea['Team'].some(a => a.severity === 'critical' && a.refId === 'd')); // downtime 31.6% > 2x target
  assert.ok(byArea['Team'].some(a => a.severity === 'info' && /audit/.test(a.title)));
  assert.ok(byArea['Team'].some(a => a.severity === 'info' && a.refId === 'J-NOTES'));
  assert.ok(byArea['Close-out'].some(a => a.severity === 'warning' && a.refId === 'J-CLOSE'));
  assert.ok(byArea['Clients'].some(a => a.severity === 'warning' && /no contact/.test(a.title)));
  // J-OK realised margin 50.6% >= target -> no realised-margin shortfall alert
  assert.ok(!alerts.some(a => /Realised gross margin/.test(a.title)));
  // healthy quote produced no alert
  assert.ok(!alerts.some(a => a.refId === 'Q-OK'));
});

test('buildAlerts: empty inputs yield an empty queue', () => {
  assert.deepEqual(L.buildAlerts({ jobs: [], quotes: [], technicians: [] }, baseTargets(), today), []);
});

test('demo dataset: internally consistent and produces the expected board', () => {
  const ds = D.buildDemoData(today);

  // targets kept in sync with logic defaults
  assert.deepEqual(ds.targets, L.DEFAULT_TARGETS);

  // referential integrity
  const clientIds = new Set(ds.clients.map(c => c.id));
  const techIds = new Set(ds.technicians.map(t => t.id));
  const validStatus = new Set(['approved', 'scheduled', 'in-progress', 'completed', 'invoiced']);
  ds.jobs.forEach(j => {
    assert.ok(clientIds.has(j.clientId), j.id + ' client missing');
    assert.ok(validStatus.has(j.status), j.id + ' bad status');
    assert.ok(j.techIds.length > 0, j.id + ' no crew');
    j.techIds.forEach(id => assert.ok(techIds.has(id), j.id + ' unknown tech ' + id));
    assert.ok(j.quoted > 0, j.id + ' bad quoted value');
    const v = L.jobMarginView(j, ds.technicians, ds.targets, today);
    assert.ok(Number.isFinite(v.effectiveMarginPct), j.id + ' margin not finite');
    assert.ok(v.effectiveMarginPct > -50 && v.effectiveMarginPct < 100, j.id + ' margin out of plausible range');
  });
  ds.quotes.forEach(q => {
    assert.ok(clientIds.has(q.clientId), q.id + ' client missing');
    assert.ok(q.value > 0, q.id + ' bad value');
  });

  // the demo board tells the intended story
  const alerts = L.buildAlerts({ jobs: ds.jobs, quotes: ds.quotes, technicians: ds.technicians, clients: ds.clients }, ds.targets, today);
  const criticals = alerts.filter(a => a.severity === 'critical');
  assert.ok(alerts.some(a => a.area === 'WHS' && a.refId === 'J-2008'), 'WHS alert expected on J-2008');
  assert.ok(alerts.some(a => a.area === 'Margin' && a.refId === 'J-2006'), 'margin erosion alert expected on J-2006');
  assert.ok(alerts.some(a => a.area === 'Team' && /Daniel Okafor/.test(a.title)), 'downtime alert expected for Daniel');
  assert.ok(alerts.some(a => a.area === 'Quotes' && a.refId === 'Q-3001'), 'stale-quote alert expected for Q-3001');
  assert.equal(criticals.length, 4);

  const k = L.kpiSummary({ jobs: ds.jobs, quotes: ds.quotes, technicians: ds.technicians }, ds.targets, today);
  assert.ok(Number.isFinite(k.realisedMargin.pct) && k.realisedMargin.pct < 32);
  assert.ok(Number.isFinite(k.openMargin.pct));
  assert.equal(k.quotes.overdueCount, 4);
  assert.equal(L.followUpQueue(ds.quotes, ds.targets, today).length, 4);
  assert.equal(k.wipValue, 97350); // quoted value of all approved/scheduled/in-progress jobs
});
