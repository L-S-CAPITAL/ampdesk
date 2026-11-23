/* AmpDesk demo dataset — an illustrative electrical service portfolio.
 * All dates are offsets from the day the app is opened, so the workspace
 * always looks current. Keep targets in sync with DEFAULT_TARGETS in logic.js. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AmpDeskData = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function buildDemoData(referenceISO) {
    function d(offset) {
      var base = referenceISO.split('-');
      var t = Date.UTC(Number(base[0]), Number(base[1]) - 1, Number(base[2])) + offset * 86400000;
      return new Date(t).toISOString().slice(0, 10);
    }

    var targets = {
      grossMarginPct: 32,
      watchBandPct: 5,
      billableUtilisationPct: 78,
      downtimePct: 10,
      quoteFollowUpDays: 5,
      quoteStaleDays: 10,
      quoteConversionPct: 55,
      closeOutDays: 7,
      unscheduleAlertDays: 5,
      contactCadenceDays: 30,
      notesAuditMinPct: 90
    };

    var clients = [
      {
        id: 'c1', name: 'Meridian Retail Group', sector: 'Retail portfolio — 5 QLD sites',
        contact: 'Dana Whitfield, Facilities Manager', health: 'stable',
        revenueYtd: 96400, lastContact: d(-6),
        opportunities: [
          { title: 'LED retrofit — Level 3 & fire stair (quote open)', value: 16200, stage: 'Quoted' },
          { title: 'Lighting maintenance contract FY27', value: 38000, stage: 'Scoping' }
        ]
      },
      {
        id: 'c2', name: 'Bayside Cold Logistics', sector: 'Cold-chain logistics — 2 sites',
        contact: 'Ray Chen, Operations Manager', health: 'strong',
        revenueYtd: 74200, lastContact: d(-3),
        opportunities: [
          { title: 'Genset ATS replacement (quote open)', value: 9800, stage: 'Quoted' },
          { title: 'Refrigeration plant maintenance contract FY27', value: 52000, stage: 'Proposal' }
        ]
      },
      {
        id: 'c3', name: "St Martin's College", sector: 'Independent school — GP & science blocks',
        contact: 'Alison Gray, Business Manager', health: 'strong',
        revenueYtd: 58600, lastContact: d(-14),
        opportunities: [
          { title: 'Science block power upgrade (quote open)', value: 21000, stage: 'Quoted' },
          { title: 'Classroom LED program — stage 2', value: 18500, stage: 'Scoping' }
        ]
      },
      {
        id: 'c4', name: 'Kedron Medical Centre', sector: 'Medical — practice & imaging suites',
        contact: 'Helen Voss, Practice Manager', health: 'stable',
        revenueYtd: 41300, lastContact: d(-38),
        opportunities: [
          { title: 'Solar & battery monitoring install (quote open)', value: 31500, stage: 'Quoted' }
        ]
      },
      {
        id: 'c5', name: 'Northgate Foods Manufacturing', sector: 'Food manufacturing — 3 production lines',
        contact: 'Greg Sands, Engineering Manager', health: 'at-risk',
        revenueYtd: 88900, lastContact: d(-19),
        note: 'Response-time concerns raised Oct 2026 — recovery plan in progress.',
        opportunities: [
          { title: 'Compressed air ring main circuit (quote open)', value: 14800, stage: 'Quoted' },
          { title: 'Switchboard maintenance contract FY27 (quote open)', value: 46000, stage: 'Quoted' }
        ]
      },
      {
        id: 'c6', name: 'Hamilton Point Commercial Towers', sector: 'Commercial towers — 2 buildings',
        contact: 'Marta Kilby, Building Manager', health: 'stable',
        revenueYtd: 63700, lastContact: d(-9),
        opportunities: [
          { title: 'Atrium feature lighting — Level 12 (quote open)', value: 27500, stage: 'Quoted' },
          { title: 'EV charging — phase 2, 6 bays', value: 42000, stage: 'Proposal' }
        ]
      }
    ];

    var technicians = [
      { id: 't1', name: 'Marcus Reed', level: 'A-Grade Electrician', costRate: 58, chargeRate: 128, availableHrsPerWeek: 38, billableHrsThisWeek: 35, downtimeHrsThisWeek: 2, downtimeReason: 'Unplanned parts run.', notesAuditedPct: 100 },
      { id: 't2', name: 'Priya Nair', level: 'Electrician', costRate: 52, chargeRate: 118, availableHrsPerWeek: 38, billableHrsThisWeek: 37, downtimeHrsThisWeek: 1, downtimeReason: 'Travel between sites.', notesAuditedPct: 92 },
      { id: 't3', name: 'Daniel Okafor', level: '4th Year Apprentice', costRate: 38, chargeRate: 72, availableHrsPerWeek: 38, billableHrsThisWeek: 22, downtimeHrsThisWeek: 12, downtimeReason: 'Idle 2 days awaiting switchboard delivery (J-2005).', notesAuditedPct: 70 },
      { id: 't4', name: 'Sophie Tran', level: '2nd Year Apprentice', costRate: 30, chargeRate: 58, availableHrsPerWeek: 38, billableHrsThisWeek: 30, downtimeHrsThisWeek: 3, downtimeReason: 'Site standby — client access delays.', notesAuditedPct: 88 },
      { id: 't5', name: 'Jack Morris', level: 'Trades Assistant', costRate: 28, chargeRate: 48, availableHrsPerWeek: 38, billableHrsThisWeek: 26, downtimeHrsThisWeek: 5, downtimeReason: 'Cable jointing course (approved training).', notesAuditedPct: 95 }
    ];

    /* Jobs. Coherence notes: Q-3008 (won) became J-2012; Q-3010 (won) became J-2011. */
    var jobs = [
      // --- invoiced (realised margin) ---
      { id: 'J-2001', clientId: 'c3', title: 'Exit & emergency lighting test — AS 2293 annual round', status: 'invoiced', quoted: 4950, invoiceAmount: 4950, budgetHrs: 48, actualHrs: 50, estToComplete: { hrs: 0, materials: 0 }, materialsCost: 950, techIds: ['t1', 't4'], approvedDate: d(-70), scheduledDate: d(-52), completedDate: d(-45), invoiceDate: d(-40), whs: { swms: true, jsa: true, testResults: true }, notesAudited: true },
      { id: 'J-2002', clientId: 'c4', title: 'RCD compliance testing & equipment tagging round', status: 'invoiced', quoted: 3100, invoiceAmount: 3100, budgetHrs: 32, actualHrs: 28, estToComplete: { hrs: 0, materials: 0 }, materialsCost: 420, techIds: ['t2'], approvedDate: d(-55), scheduledDate: d(-40), completedDate: d(-33), invoiceDate: d(-28), whs: { swms: true, jsa: true, testResults: true }, notesAudited: true },
      { id: 'J-2003', clientId: 'c1', title: 'LED retrofit — Level 2 & carparks (Riverlink store)', status: 'invoiced', quoted: 24750, invoiceAmount: 24750, budgetHrs: 96, actualHrs: 118, estToComplete: { hrs: 0, materials: 0 }, materialsCost: 14800, techIds: ['t1', 't2', 't4'], approvedDate: d(-48), scheduledDate: d(-36), completedDate: d(-17), invoiceDate: d(-12), whs: { swms: true, jsa: true, testResults: true }, notesAudited: true },
      { id: 'J-2004', clientId: 'c2', title: 'Backup generator annual service & load-bank test', status: 'invoiced', quoted: 5750, invoiceAmount: 5750, budgetHrs: 24, actualHrs: 22, estToComplete: { hrs: 0, materials: 0 }, materialsCost: 2100, techIds: ['t1'], approvedDate: d(-44), scheduledDate: d(-30), completedDate: d(-25), invoiceDate: d(-20), whs: { swms: true, jsa: true, testResults: true }, notesAudited: true },
      { id: 'J-2014', clientId: 'c3', title: 'Classroom lighting circuit repair — Block C', status: 'invoiced', quoted: 900, invoiceAmount: 900, budgetHrs: 10, actualHrs: 9, estToComplete: { hrs: 0, materials: 0 }, materialsCost: 120, techIds: ['t3'], approvedDate: d(-75), scheduledDate: d(-64), completedDate: d(-60), invoiceDate: d(-55), whs: { swms: true, jsa: true, testResults: true }, notesAudited: true },

      // --- in progress ---
      { id: 'J-2005', clientId: 'c5', title: 'Switchboard upgrade — ACB & busbar replacement (Line 4 MDB)', status: 'in-progress', quoted: 44500, budgetHrs: 140, actualHrs: 66, estToComplete: { hrs: 74, materials: 0 }, materialsCost: 22400, techIds: ['t1', 't2'], approvedDate: d(-21), scheduledDate: d(-9), whs: { swms: true, jsa: true, testResults: false }, notesAudited: false },
      { id: 'J-2006', clientId: 'c6', title: 'Level 7 fit-out — distribution boards & submains', status: 'in-progress', quoted: 9900, budgetHrs: 64, actualHrs: 71, estToComplete: { hrs: 12, materials: 0 }, materialsCost: 3900, techIds: ['t2', 't3'], approvedDate: d(-30), scheduledDate: d(-16), whs: { swms: true, jsa: true, testResults: false }, notesAudited: false },
      { id: 'J-2007', clientId: 'c1', title: 'Car park lighting circuit fault-finding — South Bank store', status: 'in-progress', quoted: 1850, budgetHrs: 16, actualHrs: 9, estToComplete: { hrs: 5, materials: 120 }, materialsCost: 240, techIds: ['t3'], approvedDate: d(-12), scheduledDate: d(-4), whs: { swms: true, jsa: true, testResults: false }, notesAudited: false },

      // --- scheduled ---
      { id: 'J-2008', clientId: 'c2', title: 'Cold store LED & emergency light upgrade', status: 'scheduled', quoted: 12400, budgetHrs: 58, actualHrs: 0, estToComplete: { hrs: 58, materials: 4400 }, materialsCost: 0, techIds: ['t2', 't4'], approvedDate: d(-6), scheduledDate: d(3), whs: { swms: false, jsa: false, testResults: false }, notesAudited: false },
      { id: 'J-2009', clientId: 'c4', title: '6-monthly RCD & emergency lighting round — Q1 FY27', status: 'scheduled', quoted: 4600, budgetHrs: 40, actualHrs: 0, estToComplete: { hrs: 40, materials: 250 }, materialsCost: 0, techIds: ['t2', 't4'], approvedDate: d(-10), scheduledDate: d(6), whs: { swms: true, jsa: true, testResults: false }, notesAudited: false },

      // --- approved, awaiting schedule ---
      { id: 'J-2010', clientId: 'c5', title: 'Thermographic scan — MCC & main distribution boards', status: 'approved', quoted: 2600, budgetHrs: 20, actualHrs: 0, estToComplete: { hrs: 20, materials: 0 }, materialsCost: 0, techIds: ['t1'], approvedDate: d(-9), scheduledDate: null, whs: { swms: true, jsa: true, testResults: false }, notesAudited: false },
      { id: 'J-2011', clientId: 'c6', title: 'EV charger installation — basement P2 (4 bays)', status: 'approved', quoted: 21500, budgetHrs: 90, actualHrs: 0, estToComplete: { hrs: 90, materials: 11500 }, materialsCost: 0, techIds: ['t1', 't3', 't5'], approvedDate: d(-3), scheduledDate: null, whs: { swms: true, jsa: true, testResults: false }, notesAudited: false },

      // --- completed, awaiting close-out ---
      { id: 'J-2012', clientId: 'c1', title: 'Shopfront feature lighting repair — South Bank store', status: 'completed', quoted: 2550, budgetHrs: 14, actualHrs: 15, estToComplete: { hrs: 0, materials: 0 }, materialsCost: 680, techIds: ['t1'], approvedDate: d(-26), scheduledDate: d(-13), completedDate: d(-9), whs: { swms: true, jsa: true, testResults: true }, notesAudited: false },
      { id: 'J-2013', clientId: 'c2', title: 'BMS fault — condenser fans hunting (dock 3)', status: 'completed', quoted: 1250, budgetHrs: 12, actualHrs: 11, estToComplete: { hrs: 0, materials: 0 }, materialsCost: 150, techIds: ['t1', 't3'], approvedDate: d(-14), scheduledDate: d(-6), completedDate: d(-2), whs: { swms: true, jsa: true, testResults: true }, notesAudited: false }
    ];

    var quotes = [
      { id: 'Q-3001', clientId: 'c5', title: 'Compressed air ring main — new circuit & isolators', value: 14800, sentDate: d(-12), status: 'sent' },
      { id: 'Q-3002', clientId: 'c6', title: 'Atrium feature lighting upgrade — Level 12', value: 27500, sentDate: d(-8), status: 'viewed' },
      { id: 'Q-3003', clientId: 'c3', title: 'Science block power upgrade — new sub-board', value: 21000, sentDate: d(-6), status: 'viewed' },
      { id: 'Q-3004', clientId: 'c2', title: 'Genset ATS replacement', value: 9800, sentDate: d(-11), status: 'follow-up', lastTouch: d(-6) },
      { id: 'Q-3005', clientId: 'c4', title: 'Solar & battery monitoring install', value: 31500, sentDate: d(-3), status: 'viewed' },
      { id: 'Q-3006', clientId: 'c1', title: 'LED retrofit — Level 3 & fire stair', value: 16200, sentDate: d(-2), status: 'sent' },
      { id: 'Q-3007', clientId: 'c5', title: 'Switchboard maintenance contract — FY27', value: 46000, sentDate: d(-4), status: 'sent' },
      { id: 'Q-3008', clientId: 'c1', title: 'Shopfront feature lighting repair — South Bank store', value: 2550, sentDate: d(-28), closedDate: d(-21), status: 'won' },
      { id: 'Q-3009', clientId: 'c2', title: 'Dock lighting replacement — warehouse 2', value: 3400, sentDate: d(-24), closedDate: d(-15), status: 'lost' },
      { id: 'Q-3010', clientId: 'c6', title: 'EV charging phase 1 — basement P2', value: 21500, sentDate: d(-10), closedDate: d(-3), status: 'won' }
    ];

    return { clients: clients, technicians: technicians, jobs: jobs, quotes: quotes, targets: targets };
  }

  return { buildDemoData: buildDemoData };
});
