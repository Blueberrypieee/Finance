document.addEventListener('DOMContentLoaded', function () {

  var TRANSACTIONS_KEY = 'ft_transactions';

  // ---------------------------------------------------------
  // Elements
  // ---------------------------------------------------------
  var exportCsvBtn = document.getElementById('exportCsvBtn');
  var csvEmptyNote = document.getElementById('csvEmptyNote');

  var logoutBtn = document.getElementById('logoutBtn');
  var logoutModalOverlay = document.getElementById('logoutModalOverlay');
  var logoutModalCloseBtn = document.getElementById('logoutModalCloseBtn');
  var cancelLogoutBtn = document.getElementById('cancelLogoutBtn');
  var confirmLogoutBtn = document.getElementById('confirmLogoutBtn');

  var hamburgerBtn = document.getElementById('hamburgerBtn');
  var drawerOverlay = document.getElementById('drawerOverlay');
  var drawerCloseBtn = document.getElementById('drawerCloseBtn');

  // ---------------------------------------------------------
  // Drawer (same pattern as dashboard/statistics)
  // ---------------------------------------------------------
  function openDrawer() { drawerOverlay.classList.add('is-open'); }
  function closeDrawer() { drawerOverlay.classList.remove('is-open'); }

  hamburgerBtn.addEventListener('click', openDrawer);
  drawerCloseBtn.addEventListener('click', closeDrawer);
  drawerOverlay.addEventListener('click', function (e) {
    if (e.target === drawerOverlay) closeDrawer();
  });

  // ---------------------------------------------------------
  // Load transactions
  // ---------------------------------------------------------
  function loadTransactions() {
    try {
      var raw = localStorage.getItem(TRANSACTIONS_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  var transactions = loadTransactions();

  if (transactions.length === 0) {
    csvEmptyNote.classList.add('is-visible');
    exportCsvBtn.disabled = true;
    exportCsvBtn.style.opacity = '0.5';
    exportCsvBtn.style.cursor = 'not-allowed';
  }

  // ---------------------------------------------------------
  // Export to CSV
  // ---------------------------------------------------------
  function csvEscape(value) {
    var str = String(value === undefined || value === null ? '' : value);
    if (str.indexOf(',') !== -1 || str.indexOf('"') !== -1 || str.indexOf('\n') !== -1) {
      str = '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  function buildCsv(rows) {
    var header = ['Tanggal', 'Tipe', 'Kategori', 'Jumlah', 'Catatan'];
    var sorted = rows.slice().sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });

    var lines = [header.map(csvEscape).join(',')];
    sorted.forEach(function (tx) {
      var typeLabel = tx.type === 'income' ? 'Pemasukan' : 'Pengeluaran';
      lines.push([
        csvEscape(tx.date),
        csvEscape(typeLabel),
        csvEscape(tx.category),
        csvEscape(tx.amount),
        csvEscape(tx.notes || '')
      ].join(','));
    });

    return lines.join('\r\n');
  }

  exportCsvBtn.addEventListener('click', function () {
    if (transactions.length === 0) return;

    var csvContent = buildCsv(transactions);
    var blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);

    var today = new Date();
    var filename = 'finance-tracker-transaksi-' +
      today.getFullYear() +
      String(today.getMonth() + 1).padStart(2, '0') +
      String(today.getDate()).padStart(2, '0') +
      '.csv';

    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  });

  // ---------------------------------------------------------
  // Logout (frontend only — no backend/session yet)
  // ---------------------------------------------------------
  function openLogoutModal() { logoutModalOverlay.classList.add('is-open'); }
  function closeLogoutModal() { logoutModalOverlay.classList.remove('is-open'); }

  logoutBtn.addEventListener('click', openLogoutModal);
  logoutModalCloseBtn.addEventListener('click', closeLogoutModal);
  cancelLogoutBtn.addEventListener('click', closeLogoutModal);
  logoutModalOverlay.addEventListener('click', function (e) {
    if (e.target === logoutModalOverlay) closeLogoutModal();
  });

  confirmLogoutBtn.addEventListener('click', function () {
    // No real session yet — this just sends the user back to the login page.
    // Transaction data in localStorage is intentionally left untouched.
    window.location.href = '/login';
  });

});

