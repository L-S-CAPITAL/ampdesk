/* AmpDesk core logic — pure functions, no DOM, no dependencies.
 * Runs in the browser (window.AmpDeskLogic) and in Node (module.exports) for tests. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AmpDeskLogic = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DEFAULT_TARGETS = {
    grossMarginPct: 32,        // target gross margin per job
    watchBandPct: 5,           // points below target before a job counts as eroded
    billableUtilisationPct: 78,
    downtimePct: 10,           // max acceptable non-billable downtime share
    quoteFollowUpDays: 5,      // chase a sent quote after this many days
    quoteStaleDays: 10,        // a quote older than this is stale
    quoteConversionPct: 55,
    closeOutDays: 7,           // completed -> invoiced within this window
    unscheduleAlertDays: 5,    // approved but unscheduled after this many days
    contactCadenceDays: 30,    // minimum client touch frequency
    notesAuditMinPct: 90       // min share of technician job notes audited
  };

  var OPEN_QUOTE = { sent: 1, viewed: 1, 'follow-up': 1 };
  var SEVERITY_RANK = { critical: 0, warning: 1, info: 2 };
  var fmtAUD = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });
  function money(n) { return fmtAUD.format(n || 0); }

  // --- dates ---------------------------------------------------------------
  function parseISO(iso) {
    var p = String(iso).split('-');
    return Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }
  function daysBetween(fromISO, toISO) {
    return Math.round((parseISO(toISO) - parseISO(fromISO)) / 86400000);
  }
  function addDaysISO(iso, n) {
    return new Date(parseISO(iso) + n * 86400000).toISOString().slice(0, 10);
  }

  // --- small helpers --------------------------------------------------------
  function round2(n) { return Math.round(n * 100) / 100; }
  function pctOf(part, whole) { return whole > 0 ? (part / whole) * 100 : 0; }
  function isOpenJob(job) {
    return job.status === 'approved' || job.status === 'scheduled' || job.status === 'in-progress';
  }
  function isClosedJob(job) { return job.status === 'completed' || job.status === 'invoiced'; }
  function statusForMargin(marginPct, targets) {
    var floor = targets.grossMarginPct - targets.watchBandPct;
    if (marginPct >= targets.grossMarginPct) return 'on-target';
    if (marginPct >= floor) return 'watch';
    return 'eroded';
  }

  function avgCostRate(techIds, technicians) {
    if (!techIds || techIds.length === 0) throw new Error('Job has no assigned technicians');
    var byId = {};
    technicians.forEach(function (t) { byId[t.id] = t; });
    var sum = 0;
    for (var i = 0; i < techIds.length; i++) {
      var t = byId[techIds[i]];
      if (!t) throw new Error('Unknown technician id: ' + techIds[i]);
      sum += t.costRate;
    }
    return sum / techIds.length;
  }

  // --- job costing ----------------------------------------------------------
  function computeJobCost(job, technicians) {
    var blended = avgCostRate(job.techIds, technicians);
    var labourCost = round2(job.actualHrs * blended);
    var materialsCost = round2(job.materialsCost || 0);
    return {
      blendedCostRate: blended,
      labourCost: labourCost,
      materialsCost: materialsCost,
      costToDate: round2(labourCost + materialsCost)
    };
  }

  /* Estimate-to-complete: actual cost so far + remaining hours at the blended
   * crew rate + materials still to come. Drives projected margin on open jobs
   * so erosion is caught during delivery, not at post-job review. */
  function projectedCost(job, technicians) {
    var c = computeJobCost(job, technicians);
    var etc = job.estToComplete || { hrs: 0, materials: 0 };
    return round2(c.costToDate + etc.hrs * c.blendedCostRate + (etc.materials || 0));
  }

  function jobMarginView(job, technicians, targets, todayISO) {
    var cost = computeJobCost(job, technicians);
    var projected = projectedCost(job, technicians);
    var sell = job.status === 'invoiced' && job.invoiceAmount != null ? job.invoiceAmount : job.quoted;
    var effectiveCost = isClosedJob(job) ? cost.costToDate : projected;
    var effectiveMargin = sell - effectiveCost;
    var effectiveMarginPct = round2(pctOf(effectiveMargin, sell));
    var marginToDatePct = round2(pctOf(sell - cost.costToDate, sell));

    var flags = [];
    if ((job.status === 'in-progress' || job.status === 'completed') && job.actualHrs > job.budgetHrs) {
      flags.push('hrs-over-budget');
    }
    if (job.whs) {
      var missing = [];
      if (job.status === 'scheduled' || job.status === 'in-progress') {
        if (!job.whs.swms) missing.push('SWMS');
        if (!job.whs.jsa) missing.push('JSA');
      }
      if (job.status === 'completed' && !job.whs.testResults) missing.push('test results');
      if (missing.length) flags.push('whs-incomplete');
    }
    if (job.status === 'completed' && job.completedDate && todayISO &&
        daysBetween(job.completedDate, todayISO) > targets.closeOutDays) {
      flags.push('close-out-overdue');
    }
    if (job.status === 'completed' && job.notesAudited === false) {
      flags.push('notes-not-audited');
    }
    if (job.status === 'approved' && !job.scheduledDate && job.approvedDate && todayISO &&
        daysBetween(job.approvedDate, todayISO) > targets.unscheduleAlertDays) {
      flags.push('unscheduled');
    }

    return {
      id: job.id,
      sell: sell,
      costToDate: cost.costToDate,
      projectedCost: projected,
      effectiveMargin: effectiveMargin,
      effectiveMarginPct: effectiveMarginPct,
      marginToDatePct: marginToDatePct,
      status: statusForMargin(effectiveMarginPct, targets),
      hrsUsedPct: pctOf(job.actualHrs, job.budgetHrs),
      hrsRemaining: Math.max(0, job.budgetHrs - job.actualHrs),
      flags: flags
    };
  }

  // --- technician utilisation -------------------------------------------------
  function technicianUtilisation(tech, targets) {
    var avail = tech.availableHrsPerWeek || 0;
    var billablePct = pctOf(tech.billableHrsThisWeek, avail);
    var downtimePct = pctOf(tech.downtimeHrsThisWeek, avail);
    var flags = [];
    if (downtimePct > targets.downtimePct * 2) flags.push('downtime-critical');
    else if (downtimePct > targets.downtimePct) flags.push('downtime-over-target');
    if ((tech.notesAuditedPct || 0) < targets.notesAuditMinPct) flags.push('notes-audit-gap');
    return {
      billablePct: round2(billablePct),
      downtimePct: round2(downtimePct),
      idlePct: round2(Math.max(0, 100 - billablePct - downtimePct)),
      flags: flags
    };
  }

  function fleetUtilisation(technicians) {
    var avail = 0, bill = 0, down = 0;
    (technicians || []).forEach(function (t) {
      avail += t.availableHrsPerWeek || 0;
      bill += t.billableHrsThisWeek || 0;
      down += t.downtimeHrsThisWeek || 0;
    });
    return {
      availableHrs: avail,
      billableHrs: bill,
      downtimeHrs: down,
      billablePct: round2(pctOf(bill, avail)),
      downtimePct: round2(pctOf(down, avail))
    };
  }

  // --- quote pipeline -----------------------------------------------------------
  function quoteAgeDays(quote, todayISO) {
    var ref = quote.status === 'won' || quote.status === 'lost'
      ? (quote.closedDate || quote.sentDate)
      : quote.sentDate;
    return daysBetween(ref, todayISO);
  }
  function quoteBucket(quote, targets, todayISO) {
    if (!OPEN_QUOTE[quote.status]) return 'closed';
    var age = daysBetween(quote.sentDate, todayISO);
    if (age > targets.quoteStaleDays) return 'stale';
    if (age > targets.quoteFollowUpDays) return 'due';
    return 'fresh';
  }
  /* Follow-up queue: open quotes past the chase window, weighted by value x age. */
  function followUpQueue(quotes, targets, todayISO) {
    return quotes
      .filter(function (q) { return OPEN_QUOTE[q.status] && daysBetween(q.sentDate, todayISO) > targets.quoteFollowUpDays; })
      .map(function (q) {
        var age = daysBetween(q.sentDate, todayISO);
        return {
          id: q.id, clientId: q.clientId, title: q.title, value: q.value,
          status: q.status, ageDays: age,
          priority: round2(q.value * age / targets.quoteFollowUpDays)
        };
      })
      .sort(function (a, b) { return b.priority - a.priority; });
  }
  function quoteStats(quotes, targets, todayISO) {
    var open = 0, openValue = 0, overdue = 0, overdueValue = 0, won = 0, lost = 0;
    var buckets = { fresh: 0, due: 0, stale: 0 };
    (quotes || []).forEach(function (q) {
      if (OPEN_QUOTE[q.status]) {
        open++; openValue += q.value;
        buckets[quoteBucket(q, targets, todayISO)]++;
        if (daysBetween(q.sentDate, todayISO) > targets.quoteFollowUpDays) {
          overdue++; overdueValue += q.value;
        }
      } else if (q.status === 'won') won++;
      else if (q.status === 'lost') lost++;
    });
    var closed = won + lost;
    return {
      open: open, openValue: round2(openValue),
      overdueCount: overdue, overdueValue: round2(overdueValue),
      buckets: buckets, won: won, lost: lost,
      conversionPct: closed ? round2((won / closed) * 100) : 0
    };
  }

  // --- margin aggregates -----------------------------------------------------------
  function realisedMargin(jobs, technicians) {
    var sell = 0, cost = 0, count = 0;
    (jobs || []).forEach(function (j) {
      if (j.status !== 'invoiced') return;
      count++;
      sell += j.invoiceAmount != null ? j.invoiceAmount : j.quoted;
      cost += computeJobCost(j, technicians).costToDate;
    });
    return { count: count, sell: round2(sell), cost: round2(cost), pct: round2(pctOf(sell - cost, sell)) };
  }
  function activeMargin(jobs, technicians) {
    var quoted = 0, proj = 0, count = 0;
    (jobs || []).forEach(function (j) {
      if (!isOpenJob(j)) return;
      count++;
      quoted += j.quoted;
      proj += projectedCost(j, technicians);
    });
    return { count: count, quoted: round2(quoted), projectedCost: round2(proj), pct: round2(pctOf(quoted - proj, quoted)) };
  }

  // --- client accounts ------------------------------------------------------------
  function clientSummary(c, jobs, quotes, targets, todayISO) {
    var cj = jobs.filter(function (j) { return j.clientId === c.id; });
    var open = cj.filter(isOpenJob);
    var oq = quotes.filter(function (q) { return q.clientId === c.id && OPEN_QUOTE[q.status]; });
    var contactDays = daysBetween(c.lastContact, todayISO);
    return {
      clientId: c.id, name: c.name, sector: c.sector, health: c.health,
      revenueYtd: c.revenueYtd || 0,
      openJobs: open.length,
      openJobValue: round2(open.reduce(function (s, j) { return s + j.quoted; }, 0)),
      openQuoteCount: oq.length,
      openQuoteValue: round2(oq.reduce(function (s, q) { return s + q.value; }, 0)),
      opportunityValue: round2((c.opportunities || []).reduce(function (s, o) { return s + (o.value || 0); }, 0)),
      contactDays: contactDays,
      contactOverdue: contactDays > targets.contactCadenceDays,
      nextContactDue: addDaysISO(c.lastContact, targets.contactCadenceDays)
    };
  }
  function clientSummaries(clients, jobs, quotes, targets, todayISO) {
    return (clients || []).map(function (c) { return clientSummary(c, jobs, quotes, targets, todayISO); });
  }

  // --- KPI roll-up -------------------------------------------------------------------
  function kpiSummary(data, targets, todayISO) {
    return {
      realisedMargin: realisedMargin(data.jobs, data.technicians),
      openMargin: activeMargin(data.jobs, data.technicians),
      utilisation: fleetUtilisation(data.technicians),
      quotes: quoteStats(data.quotes, targets, todayISO),
      wipValue: activeMargin(data.jobs, data.technicians).quoted
    };
  }

  // --- alerts (the AM's action queue) ------------------------------------------------
  function buildAlerts(data, targets, todayISO) {
    var alerts = [];
    var jobs = data.jobs || [], quotes = data.quotes || [], technicians = data.technicians || [];
    var clients = data.clients || [];

    jobs.forEach(function (j) {
      var v = jobMarginView(j, technicians, targets, todayISO);
      if (isOpenJob(j) && (v.status === 'eroded' || (v.status === 'watch' && v.flags.indexOf('hrs-over-budget') !== -1))) {
        var hrs = v.flags.indexOf('hrs-over-budget') !== -1
          ? ' Hours are ' + Math.round(v.hrsUsedPct) + '% of budget — re-forecast before further labour is committed.'
          : '';
        alerts.push({
          severity: j.status === 'approved' ? 'warning' : 'critical',
          area: 'Margin',
          title: j.id + ' projected margin ' + v.effectiveMarginPct.toFixed(1) + '% vs ' + targets.grossMarginPct + '% target',
          detail: (j.title || '') + hrs,
          tab: 'jobs', refId: j.id
        });
      }
      if (j.whs && (j.status === 'scheduled' || j.status === 'in-progress')) {
        var missing = [];
        if (!j.whs.swms) missing.push('SWMS');
        if (!j.whs.jsa) missing.push('JSA');
        if (missing.length) {
          alerts.push({
            severity: 'critical', area: 'WHS',
            title: j.id + ' ' + j.status.replace('-', ' ') + ' without ' + missing.join(' + '),
            detail: j.title || '',
            tab: 'jobs', refId: j.id
          });
        }
      }
      if (v.flags.indexOf('close-out-overdue') !== -1) {
        var days = daysBetween(j.completedDate, todayISO);
        alerts.push({
          severity: days > targets.closeOutDays * 2 ? 'critical' : 'warning',
          area: 'Close-out',
          title: j.id + ' completed ' + days + 'd ago — not invoiced',
          detail: (j.title || '') + (v.flags.indexOf('notes-not-audited') !== -1 ? ' Job notes not yet audited.' : ''),
          tab: 'jobs', refId: j.id
        });
      } else if (v.flags.indexOf('notes-not-audited') !== -1) {
        alerts.push({
          severity: 'info', area: 'Team',
          title: j.id + ' job notes not audited',
          detail: j.title || '',
          tab: 'jobs', refId: j.id
        });
      }
      if (v.flags.indexOf('unscheduled') !== -1) {
        alerts.push({
          severity: 'warning', area: 'Delivery',
          title: j.id + ' approved ' + daysBetween(j.approvedDate, todayISO) + 'd ago — still unscheduled',
          detail: j.title || '',
          tab: 'jobs', refId: j.id
        });
      }
    });

    technicians.forEach(function (t) {
      var u = technicianUtilisation(t, targets);
      if (u.flags.indexOf('downtime-critical') !== -1 || u.flags.indexOf('downtime-over-target') !== -1) {
        alerts.push({
          severity: u.flags.indexOf('downtime-critical') !== -1 ? 'critical' : 'warning',
          area: 'Team',
          title: t.name + ' — ' + u.downtimePct.toFixed(0) + '% non-billable downtime this week',
          detail: t.downtimeReason || 'Review allocation and plan ahead to reduce avoidable downtime.',
          tab: 'team', refId: t.id
        });
      }
      if (u.flags.indexOf('notes-audit-gap') !== -1) {
        alerts.push({
          severity: 'info', area: 'Team',
          title: t.name + ' — notes audit ' + (t.notesAuditedPct || 0) + '% (min ' + targets.notesAuditMinPct + '%)',
          detail: 'Schedule a job-note audit session.',
          tab: 'team', refId: t.id
        });
      }
    });

    quotes.forEach(function (q) {
      if (!OPEN_QUOTE[q.status]) return;
      var age = daysBetween(q.sentDate, todayISO);
      if (age > targets.quoteStaleDays) {
        alerts.push({
          severity: q.value >= 10000 ? 'critical' : 'warning',
          area: 'Quotes',
          title: q.id + ' stale ' + age + 'd — ' + money(q.value),
          detail: (q.title || '') + (q.status === 'follow-up'
            ? ' Follow-up sent, no response — escalate or close out.'
            : ' Past the follow-up window — chase or formally close.'),
          tab: 'quotes', refId: q.id
        });
      } else if (age > targets.quoteFollowUpDays) {
        alerts.push({
          severity: 'warning', area: 'Quotes',
          title: q.id + ' follow-up due (' + age + 'd since sent)',
          detail: q.title || '',
          tab: 'quotes', refId: q.id
        });
      }
    });

    clients.forEach(function (c) {
      var cs = clientSummary(c, jobs, quotes, targets, todayISO);
      if (cs.contactOverdue) {
        alerts.push({
          severity: 'warning', area: 'Clients',
          title: c.name + ' — no contact for ' + cs.contactDays + 'd',
          detail: 'Cadence target is ' + targets.contactCadenceDays + 'd. Book a site visit or call.',
          tab: 'clients', refId: c.id
        });
      }
      if (c.health === 'at-risk' && cs.openQuoteValue > 0) {
        alerts.push({
          severity: 'warning', area: 'Clients',
          title: c.name + ' at risk with ' + money(cs.openQuoteValue) + ' of open quotes',
          detail: c.note || 'Rebuild confidence before pushing commercial opportunities.',
          tab: 'clients', refId: c.id
        });
      }
    });

    var rm = realisedMargin(jobs, technicians);
    if (rm.count > 0 && rm.pct < targets.grossMarginPct) {
      var worst = null;
      jobs.forEach(function (j) {
        if (j.status !== 'invoiced') return;
        var v = jobMarginView(j, technicians, targets, todayISO);
        if (!worst || v.effectiveMarginPct < worst.pct) worst = { id: j.id, pct: v.effectiveMarginPct };
      });
      alerts.push({
        severity: 'info', area: 'Margin',
        title: 'Realised gross margin ' + rm.pct.toFixed(1) + '% below ' + targets.grossMarginPct + '% target',
        detail: 'Largest erosion: ' + worst.id + ' at ' + worst.pct.toFixed(1) + '% — schedule a root-cause review.',
        tab: 'jobs', refId: worst.id
      });
    }

    return alerts.sort(function (a, b) { return SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]; });
  }

  return {
    DEFAULT_TARGETS: DEFAULT_TARGETS,
    parseISO: parseISO,
    daysBetween: daysBetween,
    addDaysISO: addDaysISO,
    avgCostRate: avgCostRate,
    computeJobCost: computeJobCost,
    projectedCost: projectedCost,
    jobMarginView: jobMarginView,
    technicianUtilisation: technicianUtilisation,
    fleetUtilisation: fleetUtilisation,
    quoteAgeDays: quoteAgeDays,
    quoteBucket: quoteBucket,
    followUpQueue: followUpQueue,
    quoteStats: quoteStats,
    realisedMargin: realisedMargin,
    activeMargin: activeMargin,
    clientSummary: clientSummary,
    clientSummaries: clientSummaries,
    kpiSummary: kpiSummary,
    buildAlerts: buildAlerts,
    money: money
  };
});
