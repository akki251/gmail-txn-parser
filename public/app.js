const txnListEl = document.getElementById('txnList');
const ledgerListEl = document.getElementById('ledgerList');
const transactionsView = document.getElementById('transactionsView');
const ledgerView = document.getElementById('ledgerView');
const detailView = document.getElementById('detailView');
const detailContent = document.getElementById('detailContent');
const detailBackBtn = document.getElementById('detailBackBtn');
const tabs = document.querySelectorAll('.tab');
const refreshBtn = document.getElementById('refreshBtn');
const toast = document.getElementById('toast');

const categoryFilter = document.getElementById('categoryFilter');

// ---- pill groups (segmented controls) ----
// Each pill-group div holds .pill buttons with data-value; exactly one is
// .active at a time. Returns a getter for the current value and wires up
// click handling that calls onChange.
function initPillGroup(containerId, onChange) {
  const container = document.getElementById(containerId);
  const pills = container.querySelectorAll('.pill');
  pills.forEach((pill) => {
    pill.addEventListener('click', () => {
      pills.forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      onChange(pill.dataset.value);
    });
  });
  return {
    get value() {
      return container.querySelector('.pill.active')?.dataset.value ?? '';
    },
  };
}

const categorySheet = document.getElementById('categorySheet');
const categoryOptions = document.getElementById('categoryOptions');
const categorySheetCancelBtn = document.getElementById('categorySheetCancelBtn');

let allTransactions = [];
let allCategories = [];
let allFriends = [];
let activeDetailId = null;

function money(n) {
  return '₹' + Number(n).toFixed(2);
}

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 2500);
}

function dayLabel(isoDate) {
  if (!isoDate) return 'Unknown date';
  const d = new Date(isoDate);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function dayKey(isoDate) {
  return isoDate ? isoDate.slice(0, 10) : 'unknown';
}

function isDone(t) {
  return t.splitStatus !== 'unsplit' || !!t.acknowledged;
}

// ---- "possibly shareable" heuristic ----
// A transparent, editable rule (not a trained model — there's nowhere near
// enough real split history yet, only 3 real splits as of this writing).
// Flags unsplit debits in categories that tend to be group activities,
// above a starting-guess amount threshold. Revisit and tune the threshold
// once real split-vs-personal history actually exists to learn from.
const SHAREABLE_CATEGORIES = ['Food & Dining', 'Entertainment', 'Travel', 'Groceries'];
const SHAREABLE_AMOUNT_THRESHOLD = 150;

function isLikelyShareable(t) {
  if (t.type !== 'debit' || t.status === 'Declined' || t.needsReview) return false;
  if (t.splitStatus !== 'unsplit') return false;
  if (!SHAREABLE_CATEGORIES.includes(t.category)) return false;
  return t.amount >= SHAREABLE_AMOUNT_THRESHOLD;
}

async function api(path, options) {
  const res = await fetch('/api' + path, {
    method: options?.method || 'GET',
    headers: options?.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ---- filtering ----

function passesDateFilter(isoDate, range) {
  if (range === 'all' || !isoDate) return true;
  const now = new Date();
  const d = new Date(isoDate);
  const diffDays = (now - d) / (1000 * 60 * 60 * 24);
  if (range === 'today') return dayKey(isoDate) === dayKey(now.toISOString());
  if (range === 'week') return diffDays <= 7;
  if (range === 'month') return diffDays <= 30;
  return true;
}

function filteredTransactions() {
  const category = categoryFilter.value;
  const range = dateFilterPills.value;
  const type = typeFilterPills.value;
  return allTransactions.filter((t) => {
    if (category && t.category !== category) return false;
    if (type && t.type !== type) return false;
    if (!passesDateFilter(t.date, range)) return false;
    return true;
  });
}

function populateCategoryFilter() {
  const current = categoryFilter.value;
  categoryFilter.innerHTML = '<option value="">All categories</option>';
  for (const c of allCategories) {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    categoryFilter.appendChild(opt);
  }
  categoryFilter.value = current;
}

// ---- avatars ----

// Deterministic color per bank name — same bank always gets the same
// color, purely decorative (identity is already carried by the bank name
// text beside it), so no CVD/categorical validation needed, just basic
// legibility for the white initials on top.
function avatarColor(label) {
  let hash = 0;
  for (let i = 0; i < label.length; i++) hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  const hue = hash % 360;
  return `hsl(${hue}, 55%, 38%)`;
}

function avatarInitials(label) {
  if (!label) return '?';
  const words = label.trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

// ---- transaction list ----

// Builds one transaction row (wrapper + swipe background + row), wired
// with its click/swipe handlers. Shared between the day-grouped
// Transactions list and the flat, amount-sorted Suggested list.
function buildTxnRow(t) {
  const wrapper = document.createElement('div');
  wrapper.className = 'txn-wrapper';

  const swipeBg = document.createElement('div');
  swipeBg.className = 'swipe-bg';

  const row = document.createElement('div');
  const done = isDone(t);
  row.className = 'txn-row splittable' + (done ? ' done' : '');

  let badgeClass, badgeText, amountHtml, titleText, metaText;
  if (t.needsReview) {
    badgeClass = 'badge review';
    badgeText = '⚠ needs review';
    amountHtml = '';
    titleText = 'Unparsed message';
    metaText = t.sourceParser || t.sender || '';
  } else {
    const sign = t.type === 'credit' ? '+' : '-';
    badgeClass = t.status === 'Declined' ? 'badge declined' : `badge ${t.splitStatus}`;
    badgeText = t.status === 'Declined' ? 'declined' : t.splitStatus;
    amountHtml = `<div class="txn-amount ${t.type}">${sign}${money(t.amount)}</div>`;
    titleText = (done ? '✓ ' : '') + (t.merchant || '(no merchant)');
    metaText = `${t.bank || t.sourceParser || ''} · ${t.category || 'Other'}`;
  }

  const suggestedTag = !t.needsReview && isLikelyShareable(t) ? '<div class="tag-suggested">💡 Suggested</div>' : '';

  row.innerHTML = `
    <div class="txn-avatar" style="background:${avatarColor(t.bank || t.sourceParser || '?')}">${avatarInitials(t.bank || t.sourceParser)}</div>
    <div class="txn-main">
      <div class="txn-merchant">${titleText}</div>
      <div class="txn-meta">${metaText}</div>
    </div>
    <div class="txn-side">
      ${amountHtml}
      ${suggestedTag}
      <div class="${badgeClass}">${badgeText}</div>
    </div>
  `;

  wrapper.appendChild(swipeBg);
  wrapper.appendChild(row);

  if (t.splitStatus === 'unsplit' && !t.needsReview) {
    attachSwipeHandlers(row, swipeBg, t);
  } else {
    row.addEventListener('click', () => openDetail(t.id));
  }

  return wrapper;
}

function renderTransactions() {
  const txns = filteredTransactions();
  txnListEl.innerHTML = '';
  if (txns.length === 0) {
    txnListEl.innerHTML = '<p class="empty">No transactions match this filter.</p>';
    return;
  }

  const groups = new Map();
  for (const t of txns) {
    const key = dayKey(t.date);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }

  for (const [key, items] of groups) {
    const section = document.createElement('section');
    section.className = 'day-group';
    const heading = document.createElement('h4');
    heading.textContent = dayLabel(items[0].date);
    section.appendChild(heading);

    for (const t of items) {
      section.appendChild(buildTxnRow(t));
    }
    txnListEl.appendChild(section);
  }
}

// ---- suggested (possibly shareable) ----

function renderSuggested() {
  const suggestedListEl = document.getElementById('suggestedList');
  const sortBy = suggestedSortPills.value;
  const candidates = allTransactions.filter(isLikelyShareable).sort((a, b) => {
    if (sortBy === 'date') return (b.date || '').localeCompare(a.date || '');
    return b.amount - a.amount;
  });
  suggestedListEl.innerHTML = '';
  if (candidates.length === 0) {
    suggestedListEl.innerHTML = '<p class="empty">Nothing looks like a group expense right now.</p>';
    return;
  }
  for (const t of candidates) {
    suggestedListEl.appendChild(buildTxnRow(t));
  }
}

// ---- swipe-to-acknowledge ----

const SWIPE_THRESHOLD = 70;
const SWIPE_CLICK_TOLERANCE = 10;

function attachSwipeHandlers(row, swipeBg, txn) {
  let startX = null;
  let currentX = 0;
  let dragging = false;
  let dragged = false;

  row.addEventListener('pointerdown', (e) => {
    startX = e.clientX;
    dragging = true;
    dragged = false;
    row.style.transition = 'none';
  });

  row.addEventListener('pointermove', (e) => {
    if (!dragging || startX === null) return;
    const dx = e.clientX - startX;
    currentX = Math.max(-120, Math.min(120, dx));
    if (Math.abs(dx) > SWIPE_CLICK_TOLERANCE) dragged = true;
    row.style.transform = `translateX(${currentX}px)`;

    if (currentX > 0) {
      swipeBg.textContent = '✓ Done';
      swipeBg.className = 'swipe-bg align-left' + (currentX > SWIPE_THRESHOLD ? ' armed' : '');
    } else if (currentX < 0) {
      swipeBg.textContent = '✕ Unmark';
      swipeBg.className = 'swipe-bg align-right' + (-currentX > SWIPE_THRESHOLD ? ' armed' : '');
    } else {
      swipeBg.textContent = '';
      swipeBg.className = 'swipe-bg';
    }
  });

  async function endDrag() {
    if (!dragging) return;
    dragging = false;
    row.style.transition = 'transform 0.2s ease';
    const shouldMark = currentX > SWIPE_THRESHOLD;
    const shouldUnmark = currentX < -SWIPE_THRESHOLD;
    row.style.transform = 'translateX(0)';
    swipeBg.textContent = '';
    swipeBg.className = 'swipe-bg';
    currentX = 0;
    startX = null;

    if (shouldMark || shouldUnmark) {
      try {
        await api('/acknowledge', { method: 'POST', body: { transactionId: txn.id, acknowledged: shouldMark } });
        await loadTransactions();
      } catch (err) {
        showToast('Error: ' + err.message);
      }
    }
  }

  row.addEventListener('pointerup', endDrag);
  row.addEventListener('pointercancel', endDrag);
  row.addEventListener('pointerleave', () => { if (dragging) endDrag(); });

  row.addEventListener('click', (e) => {
    if (dragged) {
      e.stopPropagation();
      dragged = false;
      return;
    }
    openDetail(txn.id);
  });
}

// ---- ledger ----

function renderLedger(balances) {
  ledgerListEl.innerHTML = '';
  const names = Object.keys(balances);
  if (names.length === 0) {
    ledgerListEl.innerHTML = '<p class="empty">Ledger is clear — nobody owes you anything.</p>';
    return;
  }
  for (const name of names) {
    const row = document.createElement('div');
    row.className = 'ledger-row';
    row.innerHTML = `
      <div class="ledger-name">${name}</div>
      <div class="ledger-amount">${money(balances[name])}</div>
      <button class="settle-btn" data-name="${name}">Settle</button>
    `;
    row.querySelector('.settle-btn').addEventListener('click', async () => {
      try {
        await api('/settle', { method: 'POST', body: { friendName: name } });
        showToast(`Settled ${name}'s balance`);
        loadLedger();
      } catch (err) {
        showToast('Error: ' + err.message);
      }
    });
    ledgerListEl.appendChild(row);
  }
}

// ---- detail page ----

const trendsView = document.getElementById('trendsView');
const suggestedView = document.getElementById('suggestedView');

function switchView(target) {
  transactionsView.classList.toggle('hidden', target !== 'transactions');
  ledgerView.classList.toggle('hidden', target !== 'ledger');
  detailView.classList.toggle('hidden', target !== 'detail');
  trendsView.classList.toggle('hidden', target !== 'trends');
  suggestedView.classList.toggle('hidden', target !== 'suggested');
  if (target !== 'detail') {
    tabs.forEach((t) => t.classList.toggle('active', t.dataset.tab === target));
  }
}

async function openDetail(id) {
  activeDetailId = id;
  switchView('detail');
  await renderDetail();
}

async function renderDetail() {
  const t = await api('/transactions/' + encodeURIComponent(activeDetailId));

  if (t.needsReview) {
    detailContent.innerHTML = `
      <div class="review-banner">
        ⚠ This message matched a known sender but couldn't be parsed automatically.
        Nothing was lost — here's the raw text. It'll retry automatically on the
        next scheduled fetch, or you can retry it now.
        ${t.lastFailureReason ? `<br><br><strong>Last error:</strong> ${t.lastFailureReason}` : ''}
      </div>
      <h4>Source</h4>
      <div class="detail-fields">
        <div class="detail-field"><span>Parser</span><strong>${t.sourceParser || '—'}</strong></div>
        <div class="detail-field"><span>Sender</span><strong>${t.sender || '—'}</strong></div>
      </div>
      <h4>Raw message</h4>
      <div class="review-rawtext">${(t.rawText || '').replace(/</g, '&lt;')}</div>
      <div class="sheet-actions">
        <button id="retryReviewBtn" class="primary">Retry now</button>
      </div>
    `;
    document.getElementById('retryReviewBtn').addEventListener('click', async () => {
      try {
        const { healed } = await api('/retry-review', { method: 'POST', body: { transactionId: t.id } });
        showToast(healed ? 'Resolved — extracted successfully' : 'Still failing, will retry again later');
        await loadTransactions();
        await renderDetail();
      } catch (err) {
        showToast('Error: ' + err.message);
      }
    });
    return;
  }

  const fieldRows = [
    ['Amount', money(t.amount)],
    ['Merchant', t.merchant || '(no merchant)'],
    ['Bank', t.bank || t.sourceParser || '—'],
    ['Instrument', t.instrument || '—'],
    ['Account / card', t.last4 || t.account || '—'],
    ['Date', t.rawDate || dayLabel(t.date)],
    ['Status', t.status || '—'],
    ['Type', t.type],
  ];
  if (t.paymentMode) fieldRows.push(['Payment mode', t.paymentMode]);
  if (t.refNo) fieldRows.push(['Reference no.', t.refNo]);

  const fieldsHtml = fieldRows
    .map(([label, value]) => `<div class="detail-field"><span>${label}</span><strong>${value}</strong></div>`)
    .join('');

  const splittable = t.type === 'debit' && t.status !== 'Declined' && t.splitStatus === 'unsplit';

  let actionHtml = '';
  if (t.splitStatus === 'split' && t.splits.length > 0) {
    const rows = t.splits
      .map((s) => `<div class="split-row"><span>${s.friendName}</span><strong>${money(s.shareAmount)}</strong><span class="settle-state">${s.settled ? 'settled' : 'owed'}</span></div>`)
      .join('');
    actionHtml = `<h4>Split with</h4><div class="split-breakdown">${rows}</div>`;
  } else if (splittable) {
    const chipsHtml = allFriends
      .map((f) => `<button class="friend-chip" data-name="${f.name}">${f.name}</button>`)
      .join('');
    const shareableHint = isLikelyShareable(t)
      ? `<div class="shareable-hint">💡 This looks like it might be a group expense — ${t.category.toLowerCase()} over ₹${SHAREABLE_AMOUNT_THRESHOLD}. Just a starting guess, not a trained model — say the word if it's off and I'll adjust the rule.</div>`
      : '';
    actionHtml = `
      <h4>Split this transaction</h4>
      ${shareableHint}
      ${allFriends.length > 0 ? `<div class="friend-chips">${chipsHtml}</div>` : ''}
      <input id="detailFriendsInput" type="text" placeholder="friend1, friend2, ..." />
      <div id="customSplitEditor"></div>
      <div class="sheet-actions">
        <button id="detailSplitBtn" class="primary">Split evenly</button>
        <button id="customSplitToggleBtn">Custom amounts</button>
        <button id="detailPersonalBtn">Mark personal</button>
      </div>
    `;
  } else if (t.splitStatus === 'personal') {
    actionHtml = '<p class="empty">Marked as personal.</p>';
  }

  detailContent.innerHTML = `
    <div class="detail-category" id="detailCategoryChip">${t.category || 'Other'} ✎</div>
    <div class="detail-fields">${fieldsHtml}</div>
    ${actionHtml}
  `;

  document.getElementById('detailCategoryChip').addEventListener('click', openCategorySheet);

  document.querySelectorAll('.friend-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const input = document.getElementById('detailFriendsInput');
      const names = input.value.split(',').map((s) => s.trim()).filter(Boolean);
      const name = chip.dataset.name;
      const idx = names.findIndex((n) => n.toLowerCase() === name.toLowerCase());
      if (idx >= 0) {
        names.splice(idx, 1);
        chip.classList.remove('active');
      } else {
        names.push(name);
        chip.classList.add('active');
      }
      input.value = names.join(', ');
    });
  });

  const splitBtn = document.getElementById('detailSplitBtn');
  if (splitBtn) {
    splitBtn.addEventListener('click', async () => {
      const input = document.getElementById('detailFriendsInput');
      const friends = input.value.split(',').map((s) => s.trim()).filter(Boolean);
      if (friends.length === 0) return showToast('Enter at least one friend name');
      try {
        const { shares } = await api('/split', { method: 'POST', body: { transactionId: t.id, friends } });
        const summary = Object.entries(shares).map(([n, amt]) => `${n} owes ${money(amt)}`).join(', ');
        showToast(summary);
        allFriends = await api('/friends');
        await loadTransactions();
        await renderDetail();
      } catch (err) {
        showToast('Error: ' + err.message);
      }
    });
  }

  const customSplitToggleBtn = document.getElementById('customSplitToggleBtn');
  if (customSplitToggleBtn) {
    customSplitToggleBtn.addEventListener('click', () => {
      const input = document.getElementById('detailFriendsInput');
      const friends = input.value.split(',').map((s) => s.trim()).filter(Boolean);
      if (friends.length === 0) return showToast('Enter at least one friend name first');

      const each = Math.round((t.amount / (friends.length + 1)) * 100) / 100;
      const editor = document.getElementById('customSplitEditor');
      const rows = friends
        .map(
          (name) => `
        <div class="custom-share-row">
          <span>${name}</span>
          <input type="number" step="0.01" min="0" class="custom-share-input" data-name="${name}" value="${each}" />
        </div>`
        )
        .join('');
      editor.innerHTML = `
        <div class="custom-share-editor">
          ${rows}
          <button id="confirmCustomSplitBtn" class="primary">Confirm custom split</button>
        </div>
      `;

      document.getElementById('confirmCustomSplitBtn').addEventListener('click', async () => {
        const customShares = {};
        document.querySelectorAll('.custom-share-input').forEach((el) => {
          customShares[el.dataset.name] = parseFloat(el.value) || 0;
        });
        try {
          const { shares } = await api('/split', { method: 'POST', body: { transactionId: t.id, friends, customShares } });
          const summary = Object.entries(shares).map(([n, amt]) => `${n} owes ${money(amt)}`).join(', ');
          showToast(summary);
          allFriends = await api('/friends');
          await loadTransactions();
          await renderDetail();
        } catch (err) {
          showToast('Error: ' + err.message);
        }
      });
    });
  }

  const personalBtn = document.getElementById('detailPersonalBtn');
  if (personalBtn) {
    personalBtn.addEventListener('click', async () => {
      try {
        await api('/personal', { method: 'POST', body: { transactionId: t.id } });
        showToast('Marked as personal');
        await loadTransactions();
        await renderDetail();
      } catch (err) {
        showToast('Error: ' + err.message);
      }
    });
  }
}

detailBackBtn.addEventListener('click', () => {
  activeDetailId = null;
  switchView('transactions');
});

// ---- category sheet ----

function openCategorySheet() {
  categoryOptions.innerHTML = '';
  for (const c of allCategories) {
    const btn = document.createElement('button');
    btn.className = 'category-option';
    btn.textContent = c;
    btn.addEventListener('click', async () => {
      try {
        await api('/category', { method: 'POST', body: { transactionId: activeDetailId, category: c } });
        categorySheet.classList.add('hidden');
        await loadTransactions();
        await renderDetail();
      } catch (err) {
        showToast('Error: ' + err.message);
      }
    });
    categoryOptions.appendChild(btn);
  }
  categorySheet.classList.remove('hidden');
}

categorySheetCancelBtn.addEventListener('click', () => categorySheet.classList.add('hidden'));

// ---- tabs / filters / refresh ----

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.tab;
    switchView(target);
    if (target === 'ledger') loadLedger();
    if (target === 'trends') renderTrends();
    if (target === 'suggested') renderSuggested();
  });
});

const trendsPeriodPills = initPillGroup('trendsPeriodPills', renderTrends);
const dateFilterPills = initPillGroup('dateFilterPills', renderTransactions);
const typeFilterPills = initPillGroup('typeFilterPills', renderTransactions);
const suggestedSortPills = initPillGroup('suggestedSortPills', renderSuggested);

categoryFilter.addEventListener('change', renderTransactions);

refreshBtn.addEventListener('click', async () => {
  refreshBtn.classList.add('spinning');
  try {
    await api('/refresh', { method: 'POST' });
    showToast('Fetched latest from Gmail');
    await loadTransactions();
  } catch (err) {
    showToast('Refresh failed: ' + err.message);
  } finally {
    refreshBtn.classList.remove('spinning');
  }
});

async function loadTransactions() {
  allTransactions = await api('/transactions');
  renderTransactions();
  renderHeroCard();
}

function renderHeroCard() {
  const monthDebits = allTransactions.filter(
    (t) => t.type === 'debit' && t.status !== 'Declined' && !t.needsReview && passesDateFilter(t.date, 'month')
  );
  const total = monthDebits.reduce((sum, t) => sum + t.amount, 0);
  document.getElementById('heroAmount').textContent = money(total);
  renderSparkline(document.getElementById('heroSparkline'), dailySeries(monthDebits, 'month'));
}

function renderSparkline(container, series) {
  container.innerHTML = '';
  if (series.length < 2) return;

  const W = 300, H = 40;
  const max = Math.max(...series.map((p) => p.amount), 1);
  const stepX = W / (series.length - 1);
  const xAt = (i) => i * stepX;
  const yAt = (v) => H - (v / max) * (H - 4) - 2;

  const linePoints = series.map((p, i) => `${xAt(i)},${yAt(p.amount)}`).join(' ');
  const areaPoints = `0,${H} ${linePoints} ${W},${H}`;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.innerHTML = `
    <polygon points="${areaPoints}" fill="#D7F251" fill-opacity="0.12" stroke="none" />
    <polyline points="${linePoints}" fill="none" stroke="#D7F251" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
  `;
  container.appendChild(svg);
}

async function loadLedger() {
  const balances = await api('/ledger');
  renderLedger(balances);
}

// ---- trends ----

const CHART_GREEN = '#4caf50';
const CHART_GRID = '#23303c';
const CHART_SURFACE = '#16212c';

function shortDayLabel(key) {
  const d = new Date(key + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function dailySeries(txns, period) {
  const now = new Date();
  let start;
  if (period === 'week') {
    start = new Date(now);
    start.setDate(start.getDate() - 6);
  } else if (period === 'month') {
    start = new Date(now);
    start.setDate(start.getDate() - 29);
  } else {
    const dates = txns.map((t) => t.date).filter(Boolean).sort();
    start = dates.length ? new Date(dates[0]) : new Date(now);
  }

  const totals = new Map();
  for (const t of txns) {
    const key = dayKey(t.date);
    totals.set(key, (totals.get(key) || 0) + t.amount);
  }

  const series = [];
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(0, 0, 0, 0);
  while (cursor <= end) {
    const key = dayKey(cursor.toISOString());
    series.push({ key, amount: totals.get(key) || 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return series;
}

function renderLineChart(container, series) {
  container.innerHTML = '';
  if (series.length === 0 || series.every((p) => p.amount === 0)) {
    container.innerHTML = '<p class="empty">No spend in this period.</p>';
    return;
  }

  const W = 320, H = 140, PAD = 8, BASE = H - 20;
  const max = Math.max(...series.map((p) => p.amount), 1);
  const stepX = series.length > 1 ? (W - PAD * 2) / (series.length - 1) : 0;
  const xAt = (i) => PAD + i * stepX;
  const yAt = (v) => BASE - (v / max) * (BASE - PAD);

  const linePoints = series.map((p, i) => `${xAt(i)},${yAt(p.amount)}`).join(' ');
  const areaPoints = `${xAt(0)},${BASE} ${linePoints} ${xAt(series.length - 1)},${BASE}`;

  const lastIdx = series.length - 1;
  const lastX = xAt(lastIdx);
  const lastY = yAt(series[lastIdx].amount);

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'trend-svg');
  svg.innerHTML = `
    <line x1="${PAD}" y1="${BASE}" x2="${W - PAD}" y2="${BASE}" stroke="${CHART_GRID}" stroke-width="1" />
    <polygon points="${areaPoints}" fill="${CHART_GREEN}" fill-opacity="0.1" stroke="none" />
    <polyline points="${linePoints}" fill="none" stroke="${CHART_GREEN}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
    <circle cx="${lastX}" cy="${lastY}" r="4" fill="${CHART_GREEN}" stroke="${CHART_SURFACE}" stroke-width="2" />
    <text x="${Math.max(PAD, lastX - 40)}" y="${Math.max(10, lastY - 8)}" class="chart-label" text-anchor="end">${money(series[lastIdx].amount)}</text>
    <text x="${PAD}" y="${H - 4}" class="chart-axis-label">${shortDayLabel(series[0].key)}</text>
    <text x="${W - PAD}" y="${H - 4}" class="chart-axis-label" text-anchor="end">${shortDayLabel(series[lastIdx].key)}</text>
  `;

  const tooltip = document.createElement('div');
  tooltip.className = 'chart-tooltip hidden';
  container.appendChild(svg);
  container.appendChild(tooltip);

  function showTooltipAt(clientX) {
    const rect = svg.getBoundingClientRect();
    const relX = ((clientX - rect.left) / rect.width) * W;
    const idx = Math.max(0, Math.min(series.length - 1, Math.round((relX - PAD) / (stepX || 1))));
    const p = series[idx];
    tooltip.textContent = `${shortDayLabel(p.key)}: ${money(p.amount)}`;
    tooltip.classList.remove('hidden');
    const leftPct = (xAt(idx) / W) * 100;
    tooltip.style.left = `${leftPct}%`;
    clearTimeout(showTooltipAt._t);
    showTooltipAt._t = setTimeout(() => tooltip.classList.add('hidden'), 2500);
  }

  svg.addEventListener('pointerdown', (e) => showTooltipAt(e.clientX));
}

function renderCategoryChart(container, txns) {
  container.innerHTML = '';
  const totals = new Map();
  for (const t of txns) {
    totals.set(t.category || 'Other', (totals.get(t.category || 'Other') || 0) + t.amount);
  }
  const rows = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  if (rows.length === 0) {
    container.innerHTML = '<p class="empty">No spend in this period.</p>';
    return;
  }
  const max = Math.max(...rows.map((r) => r[1]));

  for (const [category, amount] of rows) {
    const row = document.createElement('div');
    row.className = 'cat-bar-row';
    const pct = Math.max(4, (amount / max) * 100);
    row.innerHTML = `
      <div class="cat-bar-label">${category}</div>
      <div class="cat-bar-track"><div class="cat-bar-fill" style="width:${pct}%"></div></div>
      <div class="cat-bar-value">${money(amount)}</div>
    `;
    container.appendChild(row);
  }
}

function renderStatTiles(txns) {
  const total = txns.reduce((sum, t) => sum + t.amount, 0);
  const count = txns.length;
  const avg = count > 0 ? total / count : 0;
  const totals = new Map();
  for (const t of txns) totals.set(t.category || 'Other', (totals.get(t.category || 'Other') || 0) + t.amount);
  const top = [...totals.entries()].sort((a, b) => b[1] - a[1])[0];

  const tiles = [
    ['Total spent', money(total)],
    ['Transactions', String(count)],
    ['Avg per transaction', money(avg)],
    ['Top category', top ? top[0] : '—'],
  ];

  const statTilesEl = document.getElementById('statTiles');
  statTilesEl.innerHTML = tiles
    .map(([label, value]) => `<div class="stat-tile"><div class="stat-label">${label}</div><div class="stat-value">${value}</div></div>`)
    .join('');
}

function renderTrends() {
  const period = trendsPeriodPills.value;
  const debits = allTransactions.filter((t) => t.type === 'debit' && t.status !== 'Declined' && passesDateFilter(t.date, period));

  renderStatTiles(debits);
  renderLineChart(document.getElementById('trendChart'), dailySeries(debits, period));
  renderCategoryChart(document.getElementById('categoryChart'), debits);
}

async function init() {
  allCategories = await api('/categories');
  populateCategoryFilter();
  allFriends = await api('/friends');
  await loadTransactions();
}

init();
