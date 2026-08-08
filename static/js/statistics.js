document.addEventListener('DOMContentLoaded', function () {

  // ---------------------------------------------------------
  // Data layer (same shape as menu.js — swap the inside for a real
  // fetch() call once the Flask backend is ready; nothing that calls
  // api.getState() below needs to change).
  // ---------------------------------------------------------
  var BALANCE_KEY = 'ft_balance';
  var TRANSACTIONS_KEY = 'ft_transactions';

  var api = {
    getState: function () {
      var rawBalance = localStorage.getItem(BALANCE_KEY);
      var balanceValue = rawBalance !== null ? parseFloat(rawBalance) : 0;
      if (isNaN(balanceValue)) balanceValue = 0;

      var transactionsValue = [];
      try {
        var rawTx = localStorage.getItem(TRANSACTIONS_KEY);
        var parsed = rawTx ? JSON.parse(rawTx) : [];
        transactionsValue = Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        transactionsValue = [];
      }

      // TODO(backend): replace the block above with:
      //   return fetch('/api/state').then(function (res) { return res.json(); });
      return Promise.resolve({ balance: balanceValue, transactions: transactionsValue });
    }
  };

  // ---------------------------------------------------------
  // Formatting helpers
  // ---------------------------------------------------------
  var rupiahFormatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });

  function formatRupiah(value) {
    return rupiahFormatter.format(value || 0);
  }

  var MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  var MONTHS_FULL = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  function monthKey(dateStr) {
    // dateStr: 'YYYY-MM-DD' -> 'YYYY-MM'
    return dateStr ? dateStr.slice(0, 7) : '';
  }

  function shiftMonthKey(key, offset) {
    var parts = key.split('-');
    var year = parseInt(parts[0], 10);
    var month = parseInt(parts[1], 10) - 1 + offset;
    year += Math.floor(month / 12);
    month = ((month % 12) + 12) % 12;
    return year + '-' + String(month + 1).padStart(2, '0');
  }

  function todayMonthKey() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }

  function normalizeCategory(cat) {
    return (cat || '').trim().toLowerCase();
  }

  // ---------------------------------------------------------
  // Elements
  // ---------------------------------------------------------
  var emptyStateEl = document.getElementById('emptyState');
  var statsContentEl = document.getElementById('statsContent');

  var hamburgerBtn = document.getElementById('hamburgerBtn');
  var drawerOverlay = document.getElementById('drawerOverlay');
  var drawerCloseBtn = document.getElementById('drawerCloseBtn');

  // Wire up the drawer FIRST, independent of data loading — it should
  // work immediately even while data is still "in flight".
  setupDrawer();

  function setupDrawer() {
    function openDrawer() { drawerOverlay.classList.add('is-open'); }
    function closeDrawer() { drawerOverlay.classList.remove('is-open'); }

    hamburgerBtn.addEventListener('click', openDrawer);
    drawerCloseBtn.addEventListener('click', closeDrawer);
    drawerOverlay.addEventListener('click', function (e) {
      if (e.target === drawerOverlay) closeDrawer();
    });
  }

  var pageSkeletonEl = document.getElementById('pageSkeleton');
  var statisticsContentEl = document.getElementById('statisticsContent');

  // ---------------------------------------------------------
  // Load data, then reveal content + compute everything below.
  // ---------------------------------------------------------
  api.getState().then(function (data) {
    var balance = data.balance;
    var transactions = data.transactions;

    pageSkeletonEl.style.display = 'none';
    statisticsContentEl.classList.remove('is-hidden-init');

    // ---------------------------------------------------------
    // Empty state check
    // ---------------------------------------------------------
    if (transactions.length === 0) {
      emptyStateEl.classList.add('is-visible');
      statsContentEl.classList.remove('is-visible');
      return; // nothing else to compute/render
    }

    emptyStateEl.classList.remove('is-visible');
    statsContentEl.classList.add('is-visible');

    // Everything from here on computes stats and builds the charts —
    // wrap it so one bad value can't take down the whole page.
    try {
      renderStatistics();
    } catch (err) {
      console.error('Gagal menghitung/menampilkan statistik:', err);
    }

    function renderStatistics() {
  var incomeTx = transactions.filter(function (t) { return t.type === 'income'; });
  var expenseTx = transactions.filter(function (t) { return t.type === 'expense'; });

  var totalIncome = incomeTx.reduce(function (sum, t) { return sum + t.amount; }, 0);
  var totalExpense = expenseTx.reduce(function (sum, t) { return sum + t.amount; }, 0);
  var netBalance = totalIncome - totalExpense;

  document.getElementById('statCurrentBalance').textContent = formatRupiah(balance);
  document.getElementById('statTotalIncome').textContent = formatRupiah(totalIncome);
  document.getElementById('statTotalExpense').textContent = formatRupiah(totalExpense);
  document.getElementById('statNetBalance').textContent = formatRupiah(netBalance);

  // ---------------------------------------------------------
  // Monthly income vs expense (last 6 months that have data, chronological)
  // ---------------------------------------------------------
  var monthlyMap = {}; // key -> { income, expense }
  transactions.forEach(function (t) {
    var key = monthKey(t.date);
    if (!key) return;
    if (!monthlyMap[key]) monthlyMap[key] = { income: 0, expense: 0 };
    monthlyMap[key][t.type] += t.amount;
  });

  var sortedMonthKeys = Object.keys(monthlyMap).sort();
  var last6 = sortedMonthKeys.slice(-6);

  var monthlyLabels = last6.map(function (key) {
    var parts = key.split('-');
    var m = parseInt(parts[1], 10) - 1;
    return MONTHS_SHORT[m] + ' ' + parts[0];
  });
  var monthlyIncomeData = last6.map(function (key) { return monthlyMap[key].income; });
  var monthlyExpenseData = last6.map(function (key) { return monthlyMap[key].expense; });

  renderMonthlyChart(monthlyLabels, monthlyIncomeData, monthlyExpenseData);

  // ---------------------------------------------------------
  // Expense by category (pie)
  // ---------------------------------------------------------
  var categoryTotals = {}; // normalized -> { label, amount }
  expenseTx.forEach(function (t) {
    var key = normalizeCategory(t.category);
    if (!key) return;
    if (!categoryTotals[key]) {
      categoryTotals[key] = { label: t.category.trim(), amount: 0 };
    }
    categoryTotals[key].amount += t.amount;
  });

  var categoryList = Object.values(categoryTotals).sort(function (a, b) { return b.amount - a.amount; });

  var TOP_N = 4;
  var pieEntries = categoryList.slice(0, TOP_N);
  var restTotal = categoryList.slice(TOP_N).reduce(function (sum, c) { return sum + c.amount; }, 0);
  if (restTotal > 0) {
    pieEntries.push({ label: 'Lainnya', amount: restTotal });
  }

  renderCategoryChart(pieEntries, totalExpense);

  // ---------------------------------------------------------
  // Most spending / most used category
  // ---------------------------------------------------------
  if (categoryList.length > 0) {
    var mostSpending = categoryList[0];
    document.getElementById('statMostSpendingCategory').textContent = mostSpending.label;
    document.getElementById('statMostSpendingAmount').textContent = formatRupiah(mostSpending.amount);
  }

  var categoryCounts = {}; // normalized -> { label, count }
  transactions.forEach(function (t) {
    var key = normalizeCategory(t.category);
    if (!key) return;
    if (!categoryCounts[key]) categoryCounts[key] = { label: t.category.trim(), count: 0 };
    categoryCounts[key].count += 1;
  });
  var mostUsedList = Object.values(categoryCounts).sort(function (a, b) { return b.count - a.count; });
  if (mostUsedList.length > 0) {
    document.getElementById('statMostUsedCategory').textContent = mostUsedList[0].label;
    document.getElementById('statMostUsedCount').textContent = mostUsedList[0].count + ' Transaksi';
  }

  // ---------------------------------------------------------
  // Largest expense / income
  // ---------------------------------------------------------
  if (expenseTx.length > 0) {
    var largestExpense = expenseTx.reduce(function (max, t) { return t.amount > max.amount ? t : max; });
    document.getElementById('statLargestExpenseCategory').textContent = largestExpense.category;
    document.getElementById('statLargestExpenseAmount').textContent = formatRupiah(largestExpense.amount);
  }

  if (incomeTx.length > 0) {
    var largestIncome = incomeTx.reduce(function (max, t) { return t.amount > max.amount ? t : max; });
    document.getElementById('statLargestIncomeCategory').textContent = largestIncome.category;
    document.getElementById('statLargestIncomeAmount').textContent = formatRupiah(largestIncome.amount);
  }

  // ---------------------------------------------------------
  // Monthly summary (current calendar month)
  // ---------------------------------------------------------
  var currentKey = todayMonthKey();
  var currentMonthData = monthlyMap[currentKey] || { income: 0, expense: 0 };
  var currentMonthNet = currentMonthData.income - currentMonthData.expense;

  var now = new Date();
  document.getElementById('statMonthLabel').textContent = MONTHS_FULL[now.getMonth()] + ' ' + now.getFullYear();
  document.getElementById('statMonthIncome').textContent = formatRupiah(currentMonthData.income);
  document.getElementById('statMonthExpense').textContent = formatRupiah(currentMonthData.expense);
  document.getElementById('statMonthNet').textContent = formatRupiah(currentMonthNet);

  // ---------------------------------------------------------
  // Spending insights (rule-based, no AI)
  // ---------------------------------------------------------
  var insightListEl = document.getElementById('insightNoteList');
  var insights = [];

  // Top category this month
  var currentMonthCategoryTotals = {};
  expenseTx.filter(function (t) { return monthKey(t.date) === currentKey; }).forEach(function (t) {
    var key = normalizeCategory(t.category);
    if (!key) return;
    if (!currentMonthCategoryTotals[key]) currentMonthCategoryTotals[key] = { label: t.category.trim(), amount: 0 };
    currentMonthCategoryTotals[key].amount += t.amount;
  });
  var currentMonthTopCategory = Object.values(currentMonthCategoryTotals).sort(function (a, b) { return b.amount - a.amount; })[0];

  if (currentMonthTopCategory) {
    insights.push({
      text: 'Kamu paling banyak mengeluarkan uang untuk kategori "' + currentMonthTopCategory.label + '" bulan ini.',
      type: 'neutral'
    });
  }

  // Compare current month vs last month expense
  var lastKey = shiftMonthKey(currentKey, -1);
  var lastMonthData = monthlyMap[lastKey];

  if (lastMonthData && lastMonthData.expense > 0) {
    if (currentMonthData.expense > lastMonthData.expense) {
      insights.push({ text: 'Pengeluaranmu meningkat dibanding bulan lalu.', type: 'warning' });
    } else if (currentMonthData.expense < lastMonthData.expense) {
      insights.push({ text: 'Kamu berhasil menghemat lebih banyak bulan ini dibanding bulan lalu.', type: 'success' });
    } else {
      insights.push({ text: 'Pengeluaranmu bulan ini sama dengan bulan lalu.', type: 'neutral' });
    }
  }

  if (insights.length === 0) {
    insights.push({ text: 'Terus catat transaksimu supaya insight keuangan makin akurat.', type: 'neutral' });
  }

  insightListEl.innerHTML = '';
  insights.forEach(function (insight) {
    var div = document.createElement('div');
    div.className = 'insight-note' + (insight.type === 'success' ? ' insight-note--neutral' : insight.type === 'warning' ? ' insight-note--warning' : '');
    div.innerHTML = '<span class="insight-note__icon">💡</span><span>' + insight.text + '</span>';
    insightListEl.appendChild(div);
  });

  // ---------------------------------------------------------
  // Charts
  // ---------------------------------------------------------
  function renderMonthlyChart(labels, incomeData, expenseData) {
    var container = document.getElementById('monthlyChart');
    container.innerHTML = '';

    if (labels.length === 0) {
      container.innerHTML = '<p class="chart-empty-note">Belum ada data bulan untuk ditampilkan.</p>';
      return;
    }

    var maxValue = Math.max.apply(null, incomeData.concat(expenseData).concat([1]));

    labels.forEach(function (label, i) {
      var income = incomeData[i];
      var expense = expenseData[i];

      var monthEl = document.createElement('div');
      monthEl.className = 'bar-chart__month';

      var barsEl = document.createElement('div');
      barsEl.className = 'bar-chart__bars';

      var incomeBar = document.createElement('div');
      incomeBar.className = 'bar-chart__bar bar-chart__bar--income';
      incomeBar.style.height = (income > 0 ? Math.max((income / maxValue) * 100, 3) : 0) + '%';
      incomeBar.title = 'Income: ' + formatRupiah(income);

      var expenseBar = document.createElement('div');
      expenseBar.className = 'bar-chart__bar bar-chart__bar--expense';
      expenseBar.style.height = (expense > 0 ? Math.max((expense / maxValue) * 100, 3) : 0) + '%';
      expenseBar.title = 'Expense: ' + formatRupiah(expense);

      barsEl.appendChild(incomeBar);
      barsEl.appendChild(expenseBar);

      var labelEl = document.createElement('span');
      labelEl.className = 'bar-chart__label';
      labelEl.textContent = label;

      monthEl.appendChild(barsEl);
      monthEl.appendChild(labelEl);
      container.appendChild(monthEl);
    });
  }

  function renderCategoryChart(entries, total) {
    var pieEl = document.getElementById('categoryChart');
    var palette = ['#22C55E', '#3B82F6', '#F59E0B', '#8B5CF6', '#94A3B8'];
    var colors = entries.map(function (_, i) { return palette[i % palette.length]; });

    if (entries.length === 0 || total <= 0) {
      pieEl.parentElement.innerHTML = '<p class="chart-empty-note">Belum ada data pengeluaran berkategori.</p>';
      return;
    }

    var cumulative = 0;
    var gradientParts = entries.map(function (e, i) {
      var pct = (e.amount / total) * 100;
      var start = cumulative;
      var end = cumulative + pct;
      cumulative = end;
      return colors[i] + ' ' + start.toFixed(2) + '% ' + end.toFixed(2) + '%';
    });

    pieEl.style.background = 'conic-gradient(' + gradientParts.join(', ') + ')';

    renderCategoryLegend(entries, colors, total);
  }

  function renderCategoryLegend(entries, colors, total) {
    var legendEl = document.getElementById('categoryLegend');
    legendEl.innerHTML = '';
    entries.forEach(function (e, i) {
      var pct = total > 0 ? Math.round((e.amount / total) * 100) : 0;
      var li = document.createElement('li');
      li.innerHTML =
        '<span class="legend-dot" style="background:' + colors[i] + '"></span>' +
        '<span class="legend-category">' + e.label + '</span>' +
        '<span class="legend-percent">' + pct + '%</span>';
      legendEl.appendChild(li);
    });
  }

  } // end renderStatistics

  }); // end api.getState().then

}); // end DOMContentLoaded

