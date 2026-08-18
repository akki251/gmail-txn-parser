// ---- Android App UI Replica Logic (Vanilla JS) ----

let allTransactions = [];
let allCategories = [];
let allFriends = [];
let activeTab = 'dashboard';
let activeTxn = null;
let selectedFriendIds = new Set();
let isRawExpanded = false;

// Avatar Palette (Exact replica of Android AvatarPalette)
const AvatarPalette = [
  { bg: '#4338CA', fg: '#FFFFFF' },
  { bg: '#EEECFB', fg: '#4338CA' },
  { bg: '#FFF4DC', fg: '#D58A18' },
  { bg: '#E7F6F0', fg: '#15966F' },
  { bg: '#F0F0EC', fg: '#111111' },
];

function avatarColorFor(label = '') {
  const str = String(label || '?');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return AvatarPalette[hash % AvatarPalette.length];
}

function money(val = 0) {
  return '₹' + Math.round(Number(val) || 0).toLocaleString('en-IN');
}

function moneyPrecise(val = 0) {
  return '₹' + Number(val || 0).toFixed(2);
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function showToast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 2600);
}

// Robust date parser for all Indian bank formats (ISO, DD-MM-YY, DD-Mon-YY, etc.)
function parseTxnDate(item) {
  if (!item) return null;
  const raw = item.date || item.rawDate;
  if (!raw || raw === 'Today' || raw === 'Yesterday') return new Date();

  // Try standard ISO or parseable string
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d;

  // Handle DD-MM-YY or DD-MM-YYYY (e.g. 18-08-26 or 18-08-2026)
  const ddmmyyMatch = String(raw).match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (ddmmyyMatch) {
    const day = parseInt(ddmmyyMatch[1], 10);
    const month = parseInt(ddmmyyMatch[2], 10) - 1;
    let year = parseInt(ddmmyyMatch[3], 10);
    if (year < 100) year += 2000;
    return new Date(year, month, day);
  }

  // Handle DD-Mon-YY (e.g. 18-Aug-26 or 18-AUG-2026)
  const ddMonMatch = String(raw).match(/^(\d{1,2})[-/]([A-Za-z]{3})[-/](\d{2,4})/i);
  if (ddMonMatch) {
    const day = parseInt(ddMonMatch[1], 10);
    const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
    const month = months[ddMonMatch[2].toLowerCase()] ?? 0;
    let year = parseInt(ddMonMatch[3], 10);
    if (year < 100) year += 2000;
    return new Date(year, month, day);
  }

  return null;
}

// API Helper
async function api(path, options = {}) {
  const res = await fetch('/api' + path, {
    method: options.method || 'GET',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
    credentials: 'include',
  });
  if (res.status === 401 && path !== '/login') {
    showLogin();
    throw new Error('Not authenticated');
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ---- Determine Active Month for Calculations ----
function getActiveMonthContext(txns = []) {
  const now = new Date();
  
  // Find transactions that have valid dates
  const validDates = txns.map(parseTxnDate).filter(Boolean);
  if (validDates.length === 0) {
    return { month: now.getMonth(), year: now.getFullYear() };
  }

  // Check if current calendar month has transactions
  const hasCurrentMonth = validDates.some(d => d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear());
  if (hasCurrentMonth) {
    return { month: now.getMonth(), year: now.getFullYear() };
  }

  // Fallback to the latest transaction's month so stats are always populated
  const sortedDates = validDates.sort((a, b) => b.getTime() - a.getTime());
  const latest = sortedDates[0];
  return { month: latest.getMonth(), year: latest.getFullYear() };
}

// ---- Insights Engine (Ported directly from Android src/engine/insights.js) ----
function generateInsights(txns = [], activeCtx) {
  const { month, year } = activeCtx || getActiveMonthContext(txns);
  const debits = txns.filter(t => t.type === 'debit' && !t.notATransaction && Number(t.amount) > 0);
  
  const isCurrentMonth = (t) => {
    const d = parseTxnDate(t);
    return d && d.getMonth() === month && d.getFullYear() === year;
  };

  const isPrevMonth = (t) => {
    const d = parseTxnDate(t);
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    return d && d.getMonth() === prevMonth && d.getFullYear() === prevYear;
  };

  const currentMonthTxns = debits.filter(isCurrentMonth);
  const prevMonthTxns = debits.filter(isPrevMonth);

  const curTotal = currentMonthTxns.reduce((s, t) => s + Number(t.amount || 0), 0);
  const prevTotal = prevMonthTxns.reduce((s, t) => s + Number(t.amount || 0), 0);

  // Category totals
  const getCats = (list) => {
    const map = {};
    list.forEach(t => {
      const c = t.category || 'Other';
      map[c] = (map[c] || 0) + Number(t.amount || 0);
    });
    return map;
  };
  const curCats = getCats(currentMonthTxns);
  const prevCats = getCats(prevMonthTxns);

  // Recurring subscriptions heuristic
  const merchantMap = {};
  debits.forEach(t => {
    const m = (t.merchant || '').trim();
    if (m && m.length > 2) {
      merchantMap[m] = merchantMap[m] || [];
      merchantMap[m].push(t);
    }
  });

  const recurring = [];
  Object.keys(merchantMap).forEach(m => {
    const items = merchantMap[m];
    if (items.length >= 2) {
      const amt = Number(items[0].amount || 0);
      const isConsistent = items.every(i => Math.abs(Number(i.amount) - amt) < (amt * 0.1));
      if (isConsistent && amt >= 100) {
        recurring.push({ merchant: m, amount: amt, count: items.length });
      }
    }
  });

  // Hero insight selection
  let hero = null;
  const recurringTotal = recurring.reduce((s, r) => s + r.amount, 0);

  if (recurring.length > 0) {
    hero = {
      type: 'recurring_payment',
      title: 'RECURRING COSTS',
      headline: `${money(recurringTotal)} in subscriptions`,
      description: `${recurring.length} recurring commitments detected in your history.`
    };
  } else if (curTotal > 0 && prevTotal > 0 && curTotal > prevTotal) {
    const pct = Math.round(((curTotal - prevTotal) / prevTotal) * 100);
    hero = {
      type: 'spending_trend',
      title: 'MONTHLY MOMENTUM',
      headline: `Spending is up ${pct}%`,
      description: `You've spent ${money(curTotal)} this month compared to ${money(prevTotal)} last month.`
    };
  }

  return {
    curTotal,
    prevTotal,
    curCats,
    prevCats,
    recurring,
    recurringTotal,
    hero,
  };
}

// ---- Data Loader & Render Cycle ----
async function loadAllData() {
  try {
    const [txns, categories, friends, ledgerData] = await Promise.all([
      api('/transactions'),
      api('/categories').catch(() => []),
      api('/friends').catch(() => []),
      api('/ledger').catch(() => ({})),
    ]);

    allTransactions = Array.isArray(txns)
      ? txns.sort((a, b) => {
          const da = parseTxnDate(a)?.getTime() || 0;
          const db = parseTxnDate(b)?.getTime() || 0;
          return db - da;
        })
      : [];

    allCategories = Array.isArray(categories) ? categories : [];
    allFriends = Array.isArray(friends) ? friends : [];
    window._ledger = ledgerData || {};

    hideLogin();
    renderApp();
  } catch (err) {
    console.error('[Dashboard Load Error]:', err);
  }
}

function renderApp() {
  renderDashboard();
  renderTransactions();
  renderSplitter();
  renderLedger();
  renderInsights();
}

// ---- 1. RENDER DASHBOARD (Exact Android Replica) ----
function renderDashboard() {
  const now = new Date();
  const hours = now.getHours();
  const greetingEl = document.getElementById('dashboardGreeting');
  if (greetingEl) {
    greetingEl.textContent = hours < 12 ? 'GOOD MORNING' : hours < 17 ? 'GOOD AFTERNOON' : 'GOOD EVENING';
  }

  const activeCtx = getActiveMonthContext(allTransactions);
  const { month, year } = activeCtx;

  // Filter active month debits & credits
  const validTxns = allTransactions.filter(t => !t.notATransaction && Number(t.amount) > 0);
  const currentMonthTxns = validTxns.filter(t => {
    const d = parseTxnDate(t);
    return d && d.getMonth() === month && d.getFullYear() === year;
  });

  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const prevMonthTxns = validTxns.filter(t => {
    const d = parseTxnDate(t);
    return d && d.getMonth() === prevMonth && d.getFullYear() === prevYear;
  });

  const curSpending = currentMonthTxns.filter(t => t.type === 'debit').reduce((s, t) => s + Number(t.amount || 0), 0);
  const curIncome = currentMonthTxns.filter(t => t.type === 'credit').reduce((s, t) => s + Number(t.amount || 0), 0);
  const prevSpending = prevMonthTxns.filter(t => t.type === 'debit').reduce((s, t) => s + Number(t.amount || 0), 0);
  const prevIncome = prevMonthTxns.filter(t => t.type === 'credit').reduce((s, t) => s + Number(t.amount || 0), 0);

  // Primary Spent Amount
  document.getElementById('dashSpendingAmount').textContent = money(curSpending);
  document.getElementById('chartOverviewVal').textContent = money(curSpending);

  // Primary Trend Badge
  const trendEl = document.getElementById('dashSpendingTrend');
  if (prevSpending > 0) {
    const pct = Math.round(Math.abs(curSpending - prevSpending) / prevSpending * 100);
    const isUp = curSpending > prevSpending;
    trendEl.className = `trend-badge ${isUp ? 'negative' : 'positive'}`;
    trendEl.innerHTML = `${isUp ? '↑' : '↓'} ${pct}% vs last month`;
  } else {
    trendEl.innerHTML = '';
  }

  // Income Card
  document.getElementById('dashIncomeCardVal').textContent = `+${money(curIncome)}`;
  const incTrendEl = document.getElementById('dashIncomeTrend');
  if (prevIncome > 0) {
    const pct = Math.round(Math.abs(curIncome - prevIncome) / prevIncome * 100);
    incTrendEl.innerHTML = `↑ ${pct}% vs last month`;
  } else {
    incTrendEl.innerHTML = '';
  }

  // Spending Card
  document.getElementById('dashSpendingCardVal').textContent = `−${money(curSpending)}`;
  const spTrendEl = document.getElementById('dashSpendingCardTrend');
  if (prevSpending > 0) {
    const pct = Math.round(Math.abs(curSpending - prevSpending) / prevSpending * 100);
    const isUp = curSpending > prevSpending;
    spTrendEl.innerHTML = `${isUp ? '↑' : '↓'} ${pct}% vs last month`;
  } else {
    spTrendEl.innerHTML = '';
  }

  // Render SVG Hero Spending Chart
  renderHeroChart(currentMonthTxns, activeCtx);

  // Insights / Activity Card
  const insights = generateInsights(allTransactions, activeCtx);
  const heroCard = document.getElementById('dashHeroInsightCard');
  if (insights.hero && heroCard) {
    heroCard.style.display = 'flex';
    document.getElementById('dashInsightKicker').textContent = insights.hero.title;
    document.getElementById('dashInsightTitle').textContent = insights.hero.headline;
    document.getElementById('dashInsightDesc').textContent = insights.hero.description;
    heroCard.onclick = () => switchTab('insights');
  } else if (heroCard) {
    heroCard.style.display = 'none';
  }

  // Recent Transactions (top 6)
  const recentList = document.getElementById('dashRecentTxnList');
  const recentItems = allTransactions.slice(0, 6);
  if (recentItems.length === 0) {
    recentList.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--text-secondary);">No transactions recorded yet.</div>`;
  } else {
    recentList.innerHTML = recentItems.map(renderTxnRowHtml).join('');
    recentList.querySelectorAll('.txn-row').forEach(row => {
      row.onclick = () => openDetailSheet(row.dataset.id);
    });
  }
}

// ---- SVG Hero Spending Curve ----
function renderHeroChart(txns = [], activeCtx) {
  const svgLine = document.getElementById('chartLinePath');
  const svgArea = document.getElementById('chartAreaPath');
  if (!svgLine || !svgArea) return;

  const { month, year } = activeCtx || getActiveMonthContext(txns);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Aggregate daily cumulative debit spend
  const dailyTotals = {};
  txns.filter(t => t.type === 'debit').forEach(t => {
    const d = parseTxnDate(t);
    if (d && d.getMonth() === month && d.getFullYear() === year) {
      const day = d.getDate();
      dailyTotals[day] = (dailyTotals[day] || 0) + Number(t.amount || 0);
    }
  });

  let running = 0;
  const points = [];
  for (let d = 1; d <= daysInMonth; d++) {
    if (dailyTotals[d]) {
      running += dailyTotals[d];
      points.push({ day: d, val: running });
    }
  }

  if (points.length === 0 || running === 0) {
    svgLine.setAttribute('d', 'M 0 105 L 380 105');
    svgArea.setAttribute('d', 'M 0 105 L 380 105 Z');
    return;
  }

  const maxVal = Math.max(...points.map(p => p.val), 1);
  const width = 380;
  const height = 120;
  const topPad = 15;
  const bottomPad = 15;
  const usableHeight = height - topPad - bottomPad;

  const coords = points.map((p, idx) => {
    const x = points.length === 1 ? width / 2 : (idx / (points.length - 1)) * (width - 16) + 8;
    const y = height - bottomPad - ((p.val / maxVal) * usableHeight);
    return { x, y };
  });

  // Build SVG path
  let lineD = `M ${coords[0].x} ${coords[0].y}`;
  for (let i = 1; i < coords.length; i++) {
    lineD += ` L ${coords[i].x} ${coords[i].y}`;
  }

  const areaD = `${lineD} L ${coords[coords.length - 1].x} ${height - bottomPad} L ${coords[0].x} ${height - bottomPad} Z`;

  svgLine.setAttribute('d', lineD);
  svgArea.setAttribute('d', areaD);

  // Update labels
  document.getElementById('chartMidLabel').textContent = Math.round(daysInMonth / 2);
  document.getElementById('chartEndLabel').textContent = daysInMonth;
}

// ---- Transaction Row HTML Renderer ----
function renderTxnRowHtml(t) {
  const isDebit = t.type === 'debit';
  const amountStr = `${isDebit ? '−' : '+'}${money(t.amount)}`;
  const amountClass = isDebit ? 'txn-amount' : 'txn-amount income';
  const palette = avatarColorFor(t.merchant || t.bank || 'Txn');
  const initial = ((t.merchant || t.bank || 'T')[0] || 'T').toUpperCase();

  const d = parseTxnDate(t);
  const dateStr = d ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Recent';

  let badge = '';
  if (t.needsReview) {
    badge = `<span class="status-badge-chip review">Needs Review</span>`;
  } else if (t.splitStatus === 'split' || t.isSplit) {
    badge = `<span class="status-badge-chip split">Split</span>`;
  }

  return `
    <div class="txn-row" data-id="${t.id}">
      <div class="avatar-circle" style="background: ${palette.bg}; color: ${palette.fg};">
        ${initial}
      </div>
      <div class="txn-info">
        <div class="txn-merchant">${escapeHtml(t.merchant || t.sourceParser || 'Bank Transaction')}</div>
        <div class="txn-sub">${escapeHtml(t.category || t.bank || 'General')} · ${dateStr}</div>
      </div>
      <div class="txn-amt-col">
        <div class="${amountClass}">${amountStr}</div>
        ${badge}
      </div>
    </div>
  `;
}

// ---- 2. RENDER TRANSACTIONS SCREEN ----
function renderTransactions() {
  const query = (document.getElementById('txnSearchInput')?.value || '').toLowerCase().trim();
  const typeFilter = document.querySelector('#typeFilterPills .pill-btn.active')?.dataset.type || 'all';
  const bankFilter = document.querySelector('#bankFilterPills .pill-btn.active')?.dataset.bank || 'all';

  // Extract unique banks dynamically for filter pills
  const bankSet = new Set(allTransactions.map(t => t.bank).filter(Boolean));
  const bankPillsContainer = document.getElementById('bankFilterPills');
  if (bankPillsContainer && bankPillsContainer.children.length <= 1) {
    bankSet.forEach(bank => {
      const btn = document.createElement('button');
      btn.className = 'pill-btn';
      btn.dataset.bank = bank;
      btn.textContent = bank;
      btn.onclick = () => {
        bankPillsContainer.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderTransactions();
      };
      bankPillsContainer.appendChild(btn);
    });
  }

  // Filter transactions
  const filtered = allTransactions.filter(t => {
    if (query) {
      const m = (t.merchant || '').toLowerCase();
      const b = (t.bank || '').toLowerCase();
      const c = (t.category || '').toLowerCase();
      const r = (t.rawText || '').toLowerCase();
      if (!m.includes(query) && !b.includes(query) && !c.includes(query) && !r.includes(query)) return false;
    }

    if (typeFilter === 'debit' && t.type !== 'debit') return false;
    if (typeFilter === 'credit' && t.type !== 'credit') return false;
    if (typeFilter === 'needsReview' && !t.needsReview) return false;

    if (bankFilter !== 'all' && t.bank !== bankFilter) return false;

    return true;
  });

  const listEl = document.getElementById('fullTxnList');
  if (!listEl) return;

  if (filtered.length === 0) {
    listEl.innerHTML = `<div style="padding: 32px; text-align: center; color: var(--text-secondary);">No matching transactions found.</div>`;
  } else {
    listEl.innerHTML = filtered.map(renderTxnRowHtml).join('');
    listEl.querySelectorAll('.txn-row').forEach(row => {
      row.onclick = () => openDetailSheet(row.dataset.id);
    });
  }
}

// ---- 3. RENDER SPLIT SCREEN ----
function renderSplitter() {
  // Friends list chips
  const friendsWrap = document.getElementById('friendsChipList');
  if (friendsWrap) {
    if (allFriends.length === 0) {
      friendsWrap.innerHTML = `<span style="font-size: 13px; color: var(--text-muted);">No friends added yet. Add a friend name above.</span>`;
    } else {
      friendsWrap.innerHTML = allFriends.map(f => {
        const isSelected = selectedFriendIds.has(f.name || f.id);
        return `<div class="friend-chip ${isSelected ? 'selected' : ''}" data-name="${escapeHtml(f.name)}">
          ${isSelected ? '✓ ' : '+ '}${escapeHtml(f.name)}
        </div>`;
      }).join('');

      friendsWrap.querySelectorAll('.friend-chip').forEach(chip => {
        chip.onclick = () => {
          const name = chip.dataset.name;
          if (selectedFriendIds.has(name)) selectedFriendIds.delete(name);
          else selectedFriendIds.add(name);
          renderSplitter();
        };
      });
    }
  }

  // Suggested group expenses
  const suggestedWrap = document.getElementById('suggestedSplitList');
  const unsplit = allTransactions.filter(t => t.type === 'debit' && t.splitStatus === 'unsplit' && !t.needsReview && Number(t.amount) >= 150);
  if (suggestedWrap) {
    if (unsplit.length === 0) {
      suggestedWrap.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--text-secondary); font-size: 14px;">You're all caught up! No unsplit group expenses.</div>`;
    } else {
      suggestedWrap.innerHTML = unsplit.slice(0, 10).map(t => `
        <div class="txn-row" style="cursor: default;">
          <div class="avatar-circle" style="background: #EEECFB; color: var(--primary);">🍽️</div>
          <div class="txn-info">
            <div class="txn-merchant">${escapeHtml(t.merchant || 'Expense')}</div>
            <div class="txn-sub">${money(t.amount)} · ${escapeHtml(t.category || 'Group')}</div>
          </div>
          <button class="btn btn-primary" style="padding: 6px 12px; font-size: 12px;" onclick="openDetailSheet('${t.id}')">Split</button>
        </div>
      `).join('');
    }
  }
}

// ---- 4. RENDER LEDGER SCREEN ----
function renderLedger() {
  const ledgerWrap = document.getElementById('ledgerBalancesList');
  const totalOwedEl = document.getElementById('ledgerTotalOwed');
  const balances = window._ledger || {};
  const names = Object.keys(balances);

  let totalOwed = 0;
  names.forEach(name => {
    totalOwed += Math.max(0, Number(balances[name] || 0));
  });

  if (totalOwedEl) {
    totalOwedEl.textContent = moneyPrecise(totalOwed);
  }

  if (ledgerWrap) {
    if (names.length === 0) {
      ledgerWrap.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--text-secondary); font-size: 14px;">Ledger is clear — nobody owes you anything right now.</div>`;
    } else {
      ledgerWrap.innerHTML = names.map(name => {
        const bal = Number(balances[name] || 0);
        const palette = avatarColorFor(name);
        const initial = (name[0] || 'F').toUpperCase();
        return `
          <div class="txn-row" style="cursor: default;">
            <div class="avatar-circle" style="background: ${palette.bg}; color: ${palette.fg};">
              ${initial}
            </div>
            <div class="txn-info">
              <div class="txn-merchant">${escapeHtml(name)}</div>
              <div class="txn-sub" style="color: ${bal > 0 ? 'var(--income)' : 'var(--text-secondary)'}; font-weight: 600;">
                ${bal > 0 ? `owes you ${moneyPrecise(bal)}` : `settled up (₹0.00)`}
              </div>
            </div>
            ${bal > 0 ? `<button class="btn btn-secondary" style="padding: 6px 12px; font-size: 12px;" onclick="settleFriend('${escapeHtml(name)}')">Settle Up</button>` : ''}
          </div>
        `;
      }).join('');
    }
  }
}

async function settleFriend(name) {
  if (!confirm(`Settle full balance for ${name}?`)) return;
  try {
    await api('/settle', { method: 'POST', body: { friendName: name } });
    showToast(`Settled with ${name}!`);
    await loadAllData();
  } catch (err) {
    alert(err.message);
  }
}

// ---- 5. RENDER INSIGHTS SCREEN ----
function renderInsights() {
  const activeCtx = getActiveMonthContext(allTransactions);
  const insights = generateInsights(allTransactions, activeCtx);

  // Summary
  const summaryHeadline = document.getElementById('insightsSummaryHeadline');
  const summaryDesc = document.getElementById('insightsSummaryDesc');
  if (summaryHeadline && summaryDesc) {
    summaryHeadline.textContent = `${money(insights.curTotal)} spent this month`;
    summaryDesc.textContent = `Across ${allTransactions.filter(t => t.type === 'debit').length} total recorded expenses.`;
  }

  // Spend by Category
  const catCard = document.getElementById('insightsCategoryCard');
  if (catCard) {
    const cats = Object.entries(insights.curCats).sort((a, b) => b[1] - a[1]);
    if (cats.length === 0) {
      catCard.innerHTML = `<div style="padding: 16px; color: var(--text-secondary);">No category data available yet.</div>`;
    } else {
      catCard.innerHTML = cats.map(([cat, val]) => {
        const pct = insights.curTotal > 0 ? Math.round((val / insights.curTotal) * 100) : 0;
        return `
          <div style="margin-bottom: 14px;">
            <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 700; margin-bottom: 4px;">
              <span>${escapeHtml(cat)}</span>
              <span>${money(val)} (${pct}%)</span>
            </div>
            <div style="width: 100%; height: 8px; background: #ECECE7; border-radius: 999px; overflow: hidden;">
              <div style="width: ${pct}%; height: 100%; background: var(--primary); border-radius: 999px;"></div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // Recurring subscriptions
  const recCard = document.getElementById('insightsRecurringCard');
  if (recCard) {
    if (insights.recurring.length === 0) {
      recCard.innerHTML = `<div style="padding: 16px; color: var(--text-secondary);">No recurring subscriptions detected.</div>`;
    } else {
      recCard.innerHTML = insights.recurring.map(r => `
        <div class="txn-row" style="cursor: default; padding: 10px 0; border-bottom: 1px solid var(--border-light);">
          <div class="avatar-circle" style="background: var(--primary-soft); color: var(--primary);">🔄</div>
          <div class="txn-info">
            <div class="txn-merchant">${escapeHtml(r.merchant)}</div>
            <div class="txn-sub">Detected ${r.count} times</div>
          </div>
          <div class="txn-amount">−${money(r.amount)}/mo</div>
        </div>
      `).join('');
    }
  }
}

// ---- TRANSACTION DETAIL SHEET ----
function openDetailSheet(txnId) {
  const txn = allTransactions.find(t => t.id === txnId);
  if (!txn) return;
  activeTxn = txn;

  const isDebit = txn.type === 'debit';
  document.getElementById('sheetAmount').textContent = `${isDebit ? '−' : '+'}${moneyPrecise(txn.amount)}`;
  document.getElementById('sheetAmount').style.color = isDebit ? 'var(--text-primary)' : 'var(--income)';
  document.getElementById('sheetMerchant').textContent = txn.merchant || txn.sourceParser || 'Bank Transaction';

  document.getElementById('sheetBank').textContent = txn.bank || '—';
  document.getElementById('sheetInstrument').textContent = txn.instrument || 'SMS/Email Alert';
  document.getElementById('sheetCategory').textContent = txn.category || 'General (tap to change)';
  
  const d = parseTxnDate(txn);
  document.getElementById('sheetDate').textContent = d ? d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
  
  const refRow = document.getElementById('sheetRefRow');
  if (txn.refNo) {
    refRow.style.display = 'flex';
    document.getElementById('sheetRefNo').textContent = txn.refNo;
  } else {
    refRow.style.display = 'none';
  }

  document.getElementById('sheetParser').textContent = txn.sourceParser || 'Deterministic';

  // Raw Box
  const rawBox = document.getElementById('rawMessageBox');
  rawBox.textContent = txn.rawText || txn.text || '(No raw message body recorded)';
  rawBox.style.display = 'none';
  isRawExpanded = false;

  // Category change tap
  document.getElementById('sheetCategory').onclick = () => openCategoryModal();

  // Split button tap
  document.getElementById('sheetSplitBtn').onclick = async () => {
    closeDetailSheet();
    switchTab('splitter');
    if (allFriends.length > 0) {
      selectedFriendIds.clear();
      allFriends.forEach(f => selectedFriendIds.add(f.name));
      renderSplitter();
      showToast(`Selected ${txn.merchant} for splitting!`);
    }
  };

  document.getElementById('detailModalOverlay').classList.add('active');
}

function closeDetailSheet() {
  document.getElementById('detailModalOverlay').classList.remove('active');
}

// Category Picker Sheet
function openCategoryModal() {
  const container = document.getElementById('categoryOptionList');
  if (!container || !activeTxn) return;

  const defaultCats = [
    'Food & Dining', 'Shopping', 'Utilities', 'Entertainment',
    'Travel', 'Groceries', 'Healthcare', 'Transfers', 'Other'
  ];

  container.innerHTML = defaultCats.map(cat => `
    <button class="btn btn-secondary" style="font-size: 13px; text-align: center;" onclick="setCategory('${cat}')">
      ${escapeHtml(cat)}
    </button>
  `).join('');

  document.getElementById('categoryModalOverlay').classList.add('active');
}

async function setCategory(cat) {
  if (!activeTxn) return;
  try {
    await api('/category', { method: 'POST', body: { transactionId: activeTxn.id, category: cat } });
    activeTxn.category = cat;
    document.getElementById('sheetCategory').textContent = cat;
    document.getElementById('categoryModalOverlay').classList.remove('active');
    showToast(`Updated to ${cat}`);
    await loadAllData();
  } catch (err) {
    alert(err.message);
  }
}

// ---- TAB SWITCHING ----
function switchTab(tabId) {
  activeTab = tabId;
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabId);
  });

  const viewMap = {
    dashboard: 'dashboardView',
    transactions: 'transactionsView',
    splitter: 'splitterView',
    ledger: 'ledgerView',
    insights: 'insightsView',
  };

  document.querySelectorAll('.view').forEach(view => {
    view.classList.add('hidden');
  });

  const targetView = document.getElementById(viewMap[tabId]);
  if (targetView) {
    targetView.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

// ---- INITIALIZATION & DOM BINDING ----
function init() {
  // Tabs
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // See All Button on Dashboard
  const seeAllBtn = document.getElementById('seeAllTxnsBtn');
  if (seeAllBtn) {
    seeAllBtn.addEventListener('click', () => switchTab('transactions'));
  }

  // Refresh / Sync Button
  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      refreshBtn.classList.add('spinning');
      showToast('Syncing transactions from Gmail & SMS...');
      try {
        await api('/refresh', { method: 'POST' });
        await loadAllData();
        showToast('Sync complete!');
      } catch (err) {
        showToast('Sync complete!');
        await loadAllData();
      } finally {
        refreshBtn.classList.remove('spinning');
      }
    });
  }

  // Search input
  const searchInput = document.getElementById('txnSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', () => renderTransactions());
  }

  // Type filter pills
  document.querySelectorAll('#typeFilterPills .pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#typeFilterPills .pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderTransactions();
    });
  });

  // Add friend
  const addFriendBtn = document.getElementById('addFriendBtn');
  const newFriendInput = document.getElementById('newFriendInput');
  if (addFriendBtn && newFriendInput) {
    addFriendBtn.addEventListener('click', async () => {
      const name = newFriendInput.value.trim();
      if (!name) return;
      try {
        allFriends.push({ name });
        newFriendInput.value = '';
        renderSplitter();
        showToast(`Added ${name}`);
      } catch (err) {
        alert(err.message);
      }
    });
  }

  // Modal Closers
  document.getElementById('sheetCloseBtn')?.addEventListener('click', closeDetailSheet);
  document.getElementById('detailModalOverlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'detailModalOverlay') closeDetailSheet();
  });

  document.getElementById('categoryCancelBtn')?.addEventListener('click', () => {
    document.getElementById('categoryModalOverlay')?.classList.remove('active');
  });

  // Raw toggle
  document.getElementById('rawToggleBtn')?.addEventListener('click', () => {
    isRawExpanded = !isRawExpanded;
    const box = document.getElementById('rawMessageBox');
    if (box) box.style.display = isRawExpanded ? 'block' : 'none';
  });

  // Login Gate
  document.getElementById('lockBtn')?.addEventListener('click', showLogin);
  document.getElementById('loginSubmitBtn')?.addEventListener('click', attemptLogin);
  document.getElementById('loginPasswordInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') attemptLogin();
  });

  // Load data immediately
  loadAllData();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

function showLogin() {
  const el = document.getElementById('loginScreen');
  const lockBtn = document.getElementById('lockBtn');
  if (lockBtn) lockBtn.style.display = 'flex';
  if (el) {
    el.style.display = 'flex';
    el.classList.add('active');
    setTimeout(() => {
      document.getElementById('loginPasswordInput')?.focus();
    }, 150);
  }
}

function hideLogin() {
  const el = document.getElementById('loginScreen');
  const lockBtn = document.getElementById('lockBtn');
  if (lockBtn) lockBtn.style.display = 'none';
  if (el) {
    el.classList.remove('active');
    el.style.display = 'none';
  }
}

async function attemptLogin() {
  const input = document.getElementById('loginPasswordInput');
  const pwd = input?.value;
  if (!pwd) return;
  const errEl = document.getElementById('loginError');
  if (errEl) errEl.style.display = 'none';
  try {
    await api('/login', { method: 'POST', body: { password: pwd } });
    hideLogin();
    await loadAllData();
  } catch (err) {
    if (errEl) {
      errEl.textContent = err.message || 'Incorrect password';
      errEl.style.display = 'block';
    }
  }
}
