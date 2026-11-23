/* AmpDesk UI — renders the workspace from the demo dataset via the logic module. */
(function () {
  'use strict';

  var L = window.AmpDeskLogic;
  var D = window.AmpDeskData;

  function todayISO() {
    var t = new Date();
    function p(n) { return String(n).padStart(2, '0'); }
    return t.getFullYear() + '-' + p(t.getMonth() + 1) + '-' + p(t.getDate());
  }

  var today = todayISO();
  var data = D.buildDemoData(today);
  var T = data.targets;

  var money = function (n) {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(n || 0);
  };
  var pctFmt = function (n) { return (Math.round(n * 10) / 10).toFixed(1) + '%'; };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var fmtDate = function (iso) {
    return new Date(L.parseISO(iso)).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  var clientById = {};
  data.clients.forEach(function (c) { clientById[c.id] = c; });
  var techById = {};
  data.technicians.forEach(function (t) { techById[t.id] = t; });
  var cname = function (id) { return clientById[id] ? clientById[id].name : '—'; };
  var tnames = function (ids) {
    return ids.map(function (id) { return techById[id] ? techById[id].name.split(' ')[0] : '?'; }).join(', ');
  };

  var views = {};
  data.jobs.forEach(function (j) { views[j.id] = L.jobMarginView(j, data.technicians, T, today); });

  var kpi = L.kpiSummary({ jobs: data.jobs, quotes: data.quotes, technicians: data.technicians }, T, today);
  var alerts = L.buildAlerts(data, T, today);
  var queue = L.followUpQueue(data.quotes, T, today);
  var clientRows = {};
  L.clientSummaries(data.clients, data.jobs, data.quotes, T, today).forEach(function (s) { clientRows[s.clientId] = s; });

  var JOB_STATUS = {
    approved: ['Approved', 'blue'], scheduled: ['Scheduled', 'violet'],
    'in-progress': ['In progress', 'warn'], completed: ['Completed', 'teal'], invoiced: ['Invoiced', 'ok']
  };
  var Q_STATUS = {
    draft: ['Draft', 'grey'], sent: ['Sent', 'blue'], viewed: ['Viewed', 'violet'],
    'follow-up': ['Follow-up', 'warn'], won: ['Won', 'ok'], lost: ['Lost', 'bad']
  };
  var HEALTH = { strong: ['Strong', 'ok'], stable: ['Stable', 'blue'], 'at-risk': ['At risk', 'bad'] };
  var FLAGS = {
    'hrs-over-budget': 'Hours over budget', 'whs-incomplete': 'WHS docs incomplete',
    'close-out-overdue': 'Close-out overdue', 'notes-not-audited': 'Notes not audited',
    'unscheduled': 'Not yet scheduled'
  };
  var TITLES = {
    board: 'Command Board', jobs: 'Jobs & Margins', quotes: 'Quote Pipeline',
    team: 'Team & Utilisation', clients: 'Client Accounts'
  };

  var pill = function (cls, label) { return '<span class="pill ' + cls + '">' + esc(label) + '</span>'; };
  var jobStatusPill = function (s) { return pill(JOB_STATUS[s][1], JOB_STATUS[s][0]); };
  var qStatusPill = function (s) { return pill(Q_STATUS[s][1], Q_STATUS[s][0]); };
  var marginPill = function (v) {
    var cls = v.status === 'on-target' ? 'ok' : v.status === 'watch' ? 'warn' : 'bad';
    return pill(cls, pctFmt(v.effectiveMarginPct));
  };
  var hrsPill = function (v) {
    var cls = v.hrsUsedPct <= 100 ? 'ok' : v.hrsUsedPct <= 110 ? 'warn' : 'bad';
    return pill(cls, Math.round(v.hrsUsedPct) + '% of budget');
  };
  var agePill = function (d) {
    var cls = d > T.quoteStaleDays ? 'bad' : d > T.quoteFollowUpDays ? 'warn' : 'ok';
    return pill(cls, d + 'd');
  };
  var flagsHtml = function (v) {
    return v.flags.map(function (f) { return '<span class="flag">' + esc(FLAGS[f] || f) + '</span>'; }).join(' ');
  };

  var state = { tab: 'board', jobsFilter: 'all' };

  // ---------- renderers ------------------------------------------------------

  function tile(label, value, target, tone, sub) {
    return '<div class="tile ' + tone + '"><div class="lbl">' + esc(label) + '</div>' +
      '<div class="val">' + esc(value) + '</div>' +
      '<div class="tgt">' + esc(target) + (sub ? ' · ' + esc(sub) : '') + '</div></div>';
  }

  function renderBoard() {
    var alertCards = alerts.map(function (a) {
      return '<button class="alert" data-jump-tab="' + a.tab + '" data-jump-ref="' + esc(a.refId) + '">' +
        '<span class="sev ' + a.severity + '"></span>' +
        '<span class="body"><span class="t">' + esc(a.title) + '</span>' +
        '<span class="d">' + esc(a.detail) + '</span></span>' +
        '<span class="area">' + esc(a.area) + '</span></button>';
    }).join('');

    var rm = kpi.realisedMargin, om = kpi.openMargin, ut = kpi.utilisation, qs = kpi.quotes;
    var tiles = [
      tile('Realised gross margin', pctFmt(rm.pct), 'Target ≥ ' + T.grossMarginPct + '%',
        rm.pct >= T.grossMarginPct ? 'good' : rm.pct >= T.grossMarginPct - T.watchBandPct ? 'mid' : 'bad',
        rm.count + ' invoiced jobs'),
      tile('Open-margin (projected)', pctFmt(om.pct), 'Target ≥ ' + T.grossMarginPct + '%',
        om.pct >= T.grossMarginPct ? 'good' : om.pct >= T.grossMarginPct - T.watchBandPct ? 'mid' : 'bad',
        om.count + ' active jobs · WIP ' + money(kpi.wipValue)),
      tile('Billable utilisation', pctFmt(ut.billablePct), 'Target ≥ ' + T.billableUtilisationPct + '%',
        ut.billablePct >= T.billableUtilisationPct ? 'good' : ut.billablePct >= T.billableUtilisationPct - 6 ? 'mid' : 'bad',
        ut.billableHrs + ' of ' + ut.availableHrs + ' hrs'),
      tile('Non-billable downtime', pctFmt(ut.downtimePct), 'Target ≤ ' + T.downtimePct + '%',
        ut.downtimePct <= T.downtimePct ? 'good' : ut.downtimePct <= T.downtimePct * 1.5 ? 'mid' : 'bad',
        ut.downtimeHrs + ' hrs this week'),
      tile('Quote conversion', pctFmt(qs.conversionPct), 'Target ≥ ' + T.quoteConversionPct + '%',
        qs.conversionPct >= T.quoteConversionPct ? 'good' : qs.conversionPct >= T.quoteConversionPct - 10 ? 'mid' : 'bad',
        qs.won + ' won / ' + qs.lost + ' lost'),
      tile('Follow-ups overdue', String(qs.overdueCount), 'Chase window ' + T.quoteFollowUpDays + 'd',
        qs.overdueCount === 0 ? 'good' : qs.overdueCount <= 2 ? 'mid' : 'bad',
        money(qs.overdueValue) + ' at risk')
    ].join('');

    var watch = data.jobs
      .filter(function (j) { return j.status === 'approved' || j.status === 'scheduled' || j.status === 'in-progress'; })
      .map(function (j) { return views[j.id]; })
      .sort(function (a, b) { return a.effectiveMarginPct - b.effectiveMarginPct; })
      .slice(0, 6);
    var watchRows = watch.map(function (v) {
      var j = data.jobs.find(function (x) { return x.id === v.id; });
      return '<tr data-row="' + v.id + '"><td class="num"><b>' + v.id + '</b></td>' +
        '<td><span class="tt">' + esc(j.title) + '</span><div class="small">' + esc(cname(j.clientId)) + '</div></td>' +
        '<td class="num">' + marginPill(v) + '</td><td class="num">' + hrsPill(v) + '</td></tr>';
    }).join('');

    var queueRows = queue.slice(0, 5).map(function (q) {
      return '<tr data-row="' + q.id + '"><td class="num"><b>' + q.id + '</b></td>' +
        '<td><span class="tt">' + esc(q.title) + '</span><div class="small">' + esc(cname(q.clientId)) + '</div></td>' +
        '<td class="num">' + money(q.value) + '</td><td class="num">' + agePill(q.ageDays) + '</td>' +
        '<td>' + qStatusPill(q.status) + '</td></tr>';
    }).join('');

    return '<div class="card"><h2>Action queue — ' + alerts.length + ' items</h2>' +
      '<div class="alerts">' + alertCards + '</div></div>' +
      '<div class="tiles">' + tiles + '</div>' +
      '<div class="two">' +
      '<div class="card"><h2>Margin watchlist — thinnest projected margin first</h2>' +
      '<table><thead><tr><th>Job</th><th>Work</th><th>Margin</th><th>Hours</th></tr></thead><tbody>' +
      (watchRows || '<tr><td colspan="4" class="small">No open jobs.</td></tr>') +
      '</tbody></table></div>' +
      '<div class="card"><h2>Follow-up queue — value × age</h2>' +
      '<table><thead><tr><th>Quote</th><th>Scope</th><th>Value</th><th>Age</th><th>State</th></tr></thead><tbody>' +
      (queueRows || '<tr><td colspan="5" class="small">Nothing past the follow-up window.</td></tr>') +
      '</tbody></table></div>' +
      '</div>';
  }

  function renderJobs() {
    var statuses = ['all', 'approved', 'scheduled', 'in-progress', 'completed', 'invoiced'];
    var chips = statuses.map(function (s) {
      var n = s === 'all' ? data.jobs.length : data.jobs.filter(function (j) { return j.status === s; }).length;
      var label = s === 'all' ? 'All' : JOB_STATUS[s][0];
      return '<button data-filter="' + s + '" class="' + (state.jobsFilter === s ? 'active' : '') + '">' +
        label + ' <span class="n">' + n + '</span></button>';
    }).join('');

    var rows = data.jobs
      .filter(function (j) { return state.jobsFilter === 'all' || j.status === state.jobsFilter; })
      .sort(function (a, b) {
        var order = { approved: 0, scheduled: 1, 'in-progress': 2, completed: 3, invoiced: 4 };
        if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
        return views[a.id].effectiveMarginPct - views[b.id].effectiveMarginPct;
      })
      .map(function (j) {
        var v = views[j.id];
        var hint = j.status === 'invoiced' ? 'Realised margin' : 'Projected final margin';
        return '<tr data-row="' + j.id + '">' +
          '<td class="num"><b>' + j.id + '</b></td>' +
          '<td><span class="tt">' + esc(j.title) + '</span><div class="small">' + esc(cname(j.clientId)) + '</div></td>' +
          '<td>' + jobStatusPill(j.status) + '</td>' +
          '<td class="small">' + esc(tnames(j.techIds)) + '</td>' +
          '<td class="num"><div>' + j.actualHrs + ' / ' + j.budgetHrs + ' h</div>' + hrsPill(v) + '</td>' +
          '<td class="num">' + money(v.costToDate) + '</td>' +
          '<td class="num">' + money(v.sell) + '</td>' +
          '<td class="num"><span title="' + hint + '">' + marginPill(v) + '</span></td>' +
          '<td>' + (flagsHtml(v) || '<span class="small">—</span>') + '</td></tr>';
      }).join('');

    return '<div class="filters">' + chips + '</div>' +
      '<div class="card"><table><thead><tr>' +
      '<th>Job</th><th>Work</th><th>Status</th><th>Crew</th><th>Hours</th>' +
      '<th>Cost to date</th><th>Sell</th><th>Margin</th><th>Flags</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  function renderQuotes() {
    var qs = kpi.quotes;
    var stats =
      '<span class="chip">Open: ' + qs.open + ' quotes · ' + money(qs.openValue) + '</span>' +
      '<span class="chip">Follow-ups overdue: ' + qs.overdueCount + ' · ' + money(qs.overdueValue) + '</span>' +
      '<span class="chip">Conversion: ' + pctFmt(qs.conversionPct) + ' (' + qs.won + 'W / ' + qs.lost + 'L)</span>';

    var buckets = ['fresh', 'due', 'stale'].map(function (b) {
      var label = b === 'fresh' ? 'Fresh (≤' + T.quoteFollowUpDays + 'd)' :
        b === 'due' ? 'Follow-up due (' + (T.quoteFollowUpDays + 1) + '–' + T.quoteStaleDays + 'd)' :
          'Stale (>' + T.quoteStaleDays + 'd)';
      var cls = b === 'fresh' ? 'ok' : b === 'due' ? 'warn' : 'bad';
      var cards = data.quotes.filter(function (q) {
        return L.quoteBucket(q, T, today) === b;
      }).map(function (q) {
        var age = L.quoteAgeDays(q, today);
        return '<div class="qcard" data-row="' + q.id + '"><div class="qh"><b>' + q.id + '</b>' + qStatusPill(q.status) + '</div>' +
          '<div class="tt">' + esc(q.title) + '</div><div class="small">' + esc(cname(q.clientId)) + '</div>' +
          '<div style="margin-top:6px;display:flex;justify-content:space-between;align-items:baseline">' +
          '<span class="num" style="font-weight:800">' + money(q.value) + '</span>' +
          '<span class="small">sent ' + age + 'd ago · ' + agePill(age) + '</span></div></div>';
      }).join('');
      return '<div class="card"><h2>' + label + ' ' + pill(cls, String(qs.buckets[b])) + '</h2>' +
        (cards || '<div class="small">None.</div>') + '</div>';
    }).join('');

    var closed = data.quotes.filter(function (q) { return q.status === 'won' || q.status === 'lost'; })
      .map(function (q) {
        return '<tr><td class="num"><b>' + q.id + '</b></td>' +
          '<td><span class="tt">' + esc(q.title) + '</span><div class="small">' + esc(cname(q.clientId)) + '</div></td>' +
          '<td class="num">' + money(q.value) + '</td><td>' + qStatusPill(q.status) + '</td>' +
          '<td class="num small">' + fmtDate(q.closedDate) + '</td></tr>';
      }).join('');

    return '<div class="statrow">' + stats + '</div>' +
      '<div class="buckets">' + buckets + '</div>' +
      '<div class="card"><h2>Closed quotes</h2><table><thead><tr><th>Quote</th><th>Scope</th><th>Value</th><th>Outcome</th><th>Closed</th></tr></thead><tbody>' +
      closed + '</tbody></table></div>';
  }

  function renderTeam() {
    var cards = data.technicians.map(function (t) {
      var u = L.technicianUtilisation(t, T);
      var meterCls = t.notesAuditedPct >= T.notesAuditMinPct ? 'ok' : t.notesAuditedPct >= 80 ? 'warn' : 'bad';
      var downCls = u.downtimePct <= T.downtimePct ? 'ok' : u.downtimePct <= T.downtimePct * 2 ? 'warn' : 'bad';
      var activeJobs = data.jobs.filter(function (j) {
        return (j.status === 'approved' || j.status === 'scheduled' || j.status === 'in-progress') &&
          j.techIds.indexOf(t.id) !== -1;
      });
      var chips = activeJobs.map(function (j) {
        return '<span class="chip" data-jump-tab="jobs" data-jump-ref="' + j.id + '">' + j.id + ' · ' + esc(j.title.split('—')[0].trim()) + '</span>';
      }).join(' ');
      return '<div class="tcard" data-row="' + t.id + '">' +
        '<div class="thead"><b>' + esc(t.name) + '</b>' + pill('grey', t.level) + '</div>' +
        '<div class="small" style="margin-top:2px">' + money(t.costRate) + '/h cost · ' + money(t.chargeRate) + '/h charge-out</div>' +
        '<div class="ustack">' +
        '<span class="u-bill" style="width:' + Math.max(0, u.billablePct) + '%"></span>' +
        '<span class="u-down" style="width:' + Math.max(0, u.downtimePct) + '%"></span>' +
        '<span class="u-idle" style="width:' + Math.max(0, u.idlePct) + '%"></span></div>' +
        '<div class="small">Billable <b style="color:var(--ok)">' + pctFmt(u.billablePct) + '</b> · ' +
        'Downtime <b class="' + downCls + '">' + pctFmt(u.downtimePct) + '</b> · ' +
        'Idle ' + pctFmt(u.idlePct) + '</div>' +
        '<div class="small" style="margin-top:6px">' + esc(t.downtimeReason || '') + '</div>' +
        '<div class="small" style="margin-top:8px">Job notes audited: <b>' + t.notesAuditedPct + '%</b> (min ' + T.notesAuditMinPct + '%)</div>' +
        '<div class="meter ' + meterCls + '"><span style="width:' + Math.min(100, t.notesAuditedPct) + '%"></span></div>' +
        '<div class="jchips">' + (chips || '<span class="small">No active jobs.</span>') + '</div>' +
        '</div>';
    }).join('');
    var ut = kpi.utilisation;
    var summary =
      '<span class="chip">Fleet billable: ' + pctFmt(ut.billablePct) + ' (target ≥ ' + T.billableUtilisationPct + '%)</span>' +
      '<span class="chip">Fleet downtime: ' + pctFmt(ut.downtimePct) + ' (target ≤ ' + T.downtimePct + '%)</span>';
    return '<div class="statrow">' + summary + '</div><div class="grid">' + cards + '</div>';
  }

  function renderClients() {
    var cards = data.clients.map(function (c) {
      var s = clientRows[c.id];
      var h = HEALTH[c.health] || ['—', 'grey'];
      var opps = (c.opportunities || []).map(function (o) {
        return '<li><span>' + esc(o.title) + '</span><span class="num">' + money(o.value) + '</span></li>';
      }).join('');
      var contact = 'Last contact ' + s.contactDays + 'd ago · next due ' + fmtDate(s.nextContactDue) + ' ' +
        (s.contactOverdue ? pill('bad', 'Overdue') : pill('ok', 'On cadence'));
      return '<div class="tcard" data-row="' + c.id + '">' +
        '<div class="thead"><b>' + esc(c.name) + '</b>' + pill(h[1], h[0]) + '</div>' +
        '<div class="small" style="margin-top:2px">' + esc(c.sector) + '</div>' +
        '<div class="rows">' +
        '<div class="r"><span class="k">Revenue YTD</span><b class="num">' + money(s.revenueYtd) + '</b></div>' +
        '<div class="r"><span class="k">Open jobs</span><span class="num">' + s.openJobs + ' · ' + money(s.openJobValue) + '</span></div>' +
        '<div class="r"><span class="k">Open quotes</span><span class="num">' + s.openQuoteCount + ' · ' + money(s.openQuoteValue) + '</span></div>' +
        '<div class="r"><span class="k">Growth pipeline</span><b class="num">' + money(s.opportunityValue) + '</b></div>' +
        '</div>' +
        '<div class="small">' + contact + '</div>' +
        (c.note ? '<div class="small" style="margin-top:6px;font-style:italic">' + esc(c.note) + '</div>' : '') +
        '<ul class="opps">' + (opps || '<li><span class="small">No open opportunities.</span></li>') + '</ul>' +
        '</div>';
    }).join('');
    var totalOpp = Object.keys(clientRows).reduce(function (s, id) { return s + clientRows[id].opportunityValue; }, 0);
    return '<div class="statrow"><span class="chip">Total growth pipeline: ' + money(totalOpp) + '</span>' +
      '<span class="chip">6 accounts · targets ≥ ' + T.contactCadenceDays + 'd contact cadence</span></div>' +
      '<div class="grid">' + cards + '</div>';
  }

  var RENDER = { board: renderBoard, jobs: renderJobs, quotes: renderQuotes, team: renderTeam, clients: renderClients };

  // ---------- wiring -----------------------------------------------------------

  function setTab(tab, ref) {
    state.tab = tab;
    render();
    if (ref) {
      var row = document.querySelector('[data-row="' + ref + '"]');
      if (row) {
        row.classList.remove('flash');
        void row.offsetWidth;
        row.classList.add('flash');
        row.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }
  }

  function render() {
    document.querySelectorAll('#nav button').forEach(function (b) {
      b.classList.toggle('active', b.dataset.tab === state.tab);
    });
    document.getElementById('view-title').textContent = TITLES[state.tab];
    document.getElementById('view').innerHTML = RENDER[state.tab]();
  }

  document.getElementById('nav').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-tab]');
    if (b) setTab(b.dataset.tab, null);
  });

  document.getElementById('view').addEventListener('click', function (e) {
    var jump = e.target.closest('[data-jump-tab]');
    if (jump) { setTab(jump.dataset.jumpTab, jump.dataset.jumpRef); return; }
    var f = e.target.closest('[data-filter]');
    if (f) { state.jobsFilter = f.dataset.filter; render(); }
  });

  document.getElementById('today').textContent =
    new Date().toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  render();
})();
