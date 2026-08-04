document.addEventListener('DOMContentLoaded', function () {

  // ---------------------------------------------------------
  // Storage keys & state
  // ---------------------------------------------------------
  var BALANCE_KEY = 'ft_balance';
  var TRANSACTIONS_KEY = 'ft_transactions';

  var state = {
    balance: loadBalance(),
    transactions: loadTransactions()
  };

  var pendingDeleteId = null;

  // ---------------------------------------------------------
  // Elements
  // ---------------------------------------------------------
  var balanceAmountEl = document.getElementById('balanceAmount');
  var transactionListEl = document.getElementById('transactionList');
  var emptyStateEl = document.getElementById('emptyState');
  var cardTemplate = document.getElementById('transactionCardTemplate');

  var addIncomeBtn = document.getElementById('addIncomeBtn');
  var addExpenseBtn = document.getElementById('addExpenseBtn');
  var editBalanceBtn = document.getElementById('editBalanceBtn');

  // Drawer
  var hamburgerBtn = document.getElementById('hamburgerBtn');
  var drawerOverlay = document.getElementById('drawerOverlay');
  var drawerCloseBtn = document.getElementById('drawerCloseBtn');

  // Transaction modal
  var modalOverlay = document.getElementById('modalOverlay');
  var modalTitle = document.getElementById('modalTitle');
  var modalCloseBtn = document.getElementById('modalCloseBtn');
  var transactionForm = document.getElementById('transactionForm');
  var transactionIdInput = document.getElementById('transactionId');
  var transactionTypeInput = document.getElementById('transactionType');
  var amountInput = document.getElementById('amount');
  var categoryInput = document.getElementById('category');
  var notesInput = document.getElementById('notes');
  var dateInput = document.getElementById('date');

  // Balance modal
  var balanceModalOverlay = document.getElementById('balanceModalOverlay');
  var balanceModalCloseBtn = document.getElementById('balanceModalCloseBtn');
  var balanceForm = document.getElementById('balanceForm');
  var newBalanceInput = document.getElementById('newBalance');

  // Delete modal
  var deleteModalOverlay = document.getElementById('deleteModalOverlay');
  var deleteModalCloseBtn = document.getElementById('deleteModalCloseBtn');
  var cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
  var confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

  // ---------------------------------------------------------
  // Storage helpers
  // ---------------------------------------------------------
  function loadBalance() {
    var raw = localStorage.getItem(BALANCE_KEY);
    var value = raw !== null ? parseFloat(raw) : 0;
    return isNaN(value) ? 0 : value;
  }

  function saveBalance() {
    localStorage.setItem(BALANCE_KEY, String(state.balance));
  }

  function loadTransactions() {
    try {
      var raw = localStorage.getItem(TRANSACTIONS_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveTransactions() {
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(state.transactions));
  }

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

  function formatDate(dateStr) {
    if (!dateStr) return '';
    var parts = dateStr.split('-'); // YYYY-MM-DD
    if (parts.length !== 3) return dateStr;
    var d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
  }

  function todayISO() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  function generateId() {
    return 'tx_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  }

  // ---------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------
  function render() {
    balanceAmountEl.textContent = formatRupiah(state.balance);
    renderTransactionList();
  }

  function renderTransactionList() {
    transactionListEl.innerHTML = '';

    var sorted = state.transactions.slice().sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return b.createdAt - a.createdAt;
    });

    if (sorted.length === 0) {
      emptyStateEl.classList.add('is-visible');
      return;
    }
    emptyStateEl.classList.remove('is-visible');

    sorted.forEach(function (tx) {
      var node = cardTemplate.content.cloneNode(true);
      var card = node.querySelector('.transaction-card');
      card.classList.add(tx.type === 'income' ? 'transaction-card--income' : 'transaction-card--expense');
      card.dataset.id = tx.id;

      node.querySelector('.transaction-card__category').textContent = tx.category;

      var amountEl = node.querySelector('.transaction-card__amount');
      var sign = tx.type === 'income' ? '+' : '\u2212';
      amountEl.textContent = sign + formatRupiah(tx.amount);

      var notesEl = node.querySelector('.transaction-card__notes');
      notesEl.textContent = tx.notes || '';

      node.querySelector('.transaction-card__date').textContent = formatDate(tx.date);

      node.querySelector('.edit-btn').addEventListener('click', function () {
        openTransactionModal(tx.type, tx);
      });

      node.querySelector('.delete-btn').addEventListener('click', function () {
        openDeleteModal(tx.id);
      });

      transactionListEl.appendChild(node);
    });
  }

  // ---------------------------------------------------------
  // Transaction modal (add / edit)
  // ---------------------------------------------------------
  function openTransactionModal(type, existingTx) {
    transactionForm.reset();
    clearFieldErrors(transactionForm);

    transactionTypeInput.value = type;
    modalTitle.textContent = (existingTx ? 'Edit ' : 'Tambah ') + (type === 'income' ? 'Pemasukan' : 'Pengeluaran');

    if (existingTx) {
      transactionIdInput.value = existingTx.id;
      amountInput.value = existingTx.amount;
      categoryInput.value = existingTx.category;
      notesInput.value = existingTx.notes || '';
      dateInput.value = existingTx.date;
    } else {
      transactionIdInput.value = '';
      dateInput.value = todayISO();
    }

    modalOverlay.classList.add('is-open');
    setTimeout(function () { amountInput.focus(); }, 50);
  }

  function closeTransactionModal() {
    modalOverlay.classList.remove('is-open');
  }

  addIncomeBtn.addEventListener('click', function () { openTransactionModal('income'); });
  addExpenseBtn.addEventListener('click', function () { openTransactionModal('expense'); });
  modalCloseBtn.addEventListener('click', closeTransactionModal);
  modalOverlay.addEventListener('click', function (e) {
    if (e.target === modalOverlay) closeTransactionModal();
  });

  transactionForm.addEventListener('submit', function (e) {
    e.preventDefault();
    clearFieldErrors(transactionForm);

    var amount = parseFloat(amountInput.value);
    var category = categoryInput.value.trim();
    var notes = notesInput.value.trim();
    var date = dateInput.value;
    var type = transactionTypeInput.value;
    var id = transactionIdInput.value;

    var valid = true;
    if (!amount || amount <= 0) {
      setFieldError(amountInput, true);
      valid = false;
    }
    if (!category) {
      setFieldError(categoryInput, true);
      valid = false;
    }
    if (!date) {
      setFieldError(dateInput, true);
      valid = false;
    }
    if (!valid) return;

    if (id) {
      // Editing: reverse old effect on balance first
      var existing = state.transactions.find(function (t) { return t.id === id; });
      if (existing) {
        state.balance += existing.type === 'income' ? -existing.amount : existing.amount;
        existing.amount = amount;
        existing.category = category;
        existing.notes = notes;
        existing.date = date;
        state.balance += type === 'income' ? amount : -amount;
      }
    } else {
      // New transaction
      state.transactions.push({
        id: generateId(),
        type: type,
        amount: amount,
        category: category,
        notes: notes,
        date: date,
        createdAt: Date.now()
      });
      state.balance += type === 'income' ? amount : -amount;
    }

    saveBalance();
    saveTransactions();
    render();
    closeTransactionModal();
  });

  // ---------------------------------------------------------
  // Balance modal
  // ---------------------------------------------------------
  editBalanceBtn.addEventListener('click', function () {
    newBalanceInput.value = state.balance;
    clearFieldErrors(balanceForm);
    balanceModalOverlay.classList.add('is-open');
    setTimeout(function () { newBalanceInput.focus(); }, 50);
  });

  function closeBalanceModal() {
    balanceModalOverlay.classList.remove('is-open');
  }

  balanceModalCloseBtn.addEventListener('click', closeBalanceModal);
  balanceModalOverlay.addEventListener('click', function (e) {
    if (e.target === balanceModalOverlay) closeBalanceModal();
  });

  balanceForm.addEventListener('submit', function (e) {
    e.preventDefault();
    clearFieldErrors(balanceForm);

    var value = parseFloat(newBalanceInput.value);
    if (isNaN(value) || value < 0) {
      setFieldError(newBalanceInput, true);
      return;
    }

    state.balance = value;
    saveBalance();
    render();
    closeBalanceModal();
  });

  // ---------------------------------------------------------
  // Delete modal
  // ---------------------------------------------------------
  function openDeleteModal(id) {
    pendingDeleteId = id;
    deleteModalOverlay.classList.add('is-open');
  }

  function closeDeleteModal() {
    pendingDeleteId = null;
    deleteModalOverlay.classList.remove('is-open');
  }

  deleteModalCloseBtn.addEventListener('click', closeDeleteModal);
  cancelDeleteBtn.addEventListener('click', closeDeleteModal);
  deleteModalOverlay.addEventListener('click', function (e) {
    if (e.target === deleteModalOverlay) closeDeleteModal();
  });

  confirmDeleteBtn.addEventListener('click', function () {
    if (!pendingDeleteId) return;
    var idx = state.transactions.findIndex(function (t) { return t.id === pendingDeleteId; });
    if (idx !== -1) {
      var tx = state.transactions[idx];
      state.balance += tx.type === 'income' ? -tx.amount : tx.amount;
      state.transactions.splice(idx, 1);
      saveBalance();
      saveTransactions();
      render();
    }
    closeDeleteModal();
  });

  // ---------------------------------------------------------
  // Shared field-error helpers
  // ---------------------------------------------------------
  function setFieldError(input, hasError) {
    var field = input.closest('.field');
    if (field) field.classList.toggle('has-error', hasError);
  }

  function clearFieldErrors(form) {
    form.querySelectorAll('.field.has-error').forEach(function (f) {
      f.classList.remove('has-error');
    });
  }

  // ---------------------------------------------------------
  // Side drawer
  // ---------------------------------------------------------
  function openDrawer() {
    drawerOverlay.classList.add('is-open');
  }

  function closeDrawer() {
    drawerOverlay.classList.remove('is-open');
  }

  hamburgerBtn.addEventListener('click', openDrawer);
  drawerCloseBtn.addEventListener('click', closeDrawer);
  drawerOverlay.addEventListener('click', function (e) {
    if (e.target === drawerOverlay) closeDrawer();
  });

  // ---------------------------------------------------------
  // Init
  // ---------------------------------------------------------
  render();

});

