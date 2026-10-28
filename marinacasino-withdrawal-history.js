/*
 * MarinaCasino - Withdrawal History
 *
 * Browser-injected, JavaScript-only enhancement for the existing account modal.
 * Run this script while authenticated on marinacasino771.com.
 */
(function marinaCasinoWithdrawalHistory() {
  'use strict';

  var BUNDLE_VERSION = '2026-10-28-tr10';
  if (window.__marinaCasinoWithdrawalHistory) {
    if (window.__marinaCasinoWithdrawalHistory.version === BUNDLE_VERSION) return;
    if (typeof window.__marinaCasinoWithdrawalHistory.destroy === 'function') {
      window.__marinaCasinoWithdrawalHistory.destroy();
    }
  }

  var CONFIG = {
    endpoint: '/api/payment-operations/api/v1.0/userTransactions',
    operationType: 'withdrawal',
    defaultPageSize: 20
  };

  var COPY = {
    en: {
      locale: 'en-US',
      sectionLabels: ['finances'],
      paymentLabels: ['payment history'],
      menuLabel: 'Withdrawal History',
      paymentRoute: '/en/casino?m=account&t=financial',
      dateRange: 'Date Range',
      operationType: 'Operation Type',
      today: 'Today',
      lastMonth: 'Last month',
      withdrawal: 'Withdrawal',
      headers: ['Date Time', 'Operation Type', 'Status', 'Amount', 'Action'],
      rowsPerPage: 'Rows per page',
      noData: 'No data available',
      loading: 'Loading…',
      view: 'View',
      error: 'Unable to load withdrawal history.'
    },
    tr: {
      locale: 'tr-TR',
      sectionLabels: ['bakiye yönetimi', 'finanslar'],
      paymentLabels: ['finansal', 'ödeme geçmişi'],
      menuLabel: 'Para Çekme Geçmişi',
      paymentRoute: '/tr/?m=account&t=financial',
      dateRange: 'Tarih Aralığı',
      operationType: 'İşlem Türü',
      today: 'Bugün',
      lastMonth: 'Geçen ay',
      withdrawal: 'Çekim',
      headers: ['Tarih Saat', 'İşlem Türü', 'Durum', 'Tutar', 'İşlem'],
      rowsPerPage: 'Sayfa başına satır',
      noData: 'Veri yok',
      loading: 'Yükleniyor…',
      view: 'Görüntüle',
      error: 'Para çekme geçmişi yüklenemedi.'
    }
  };

  var state = {
    from: startOfDay(new Date(Date.now() - 24 * 60 * 60 * 1000)),
    to: new Date(),
    page: 1,
    pageSize: CONFIG.defaultPageSize,
    total: 0,
    root: null,
    loading: false,
    requestId: 0,
    menuOpening: false
  };

  window.__marinaCasinoWithdrawalHistory = {
    version: BUNDLE_VERSION,
    open: openWithdrawalHistory,
    refresh: function () { return loadTransactions(); },
    destroy: destroy
  };

  injectStyles();
  boot();

  function boot() {
    ensureMenuItem();

    ['pointerdown', 'mousedown', 'click'].forEach(function (type) {
      document.addEventListener(type, handleWithdrawalLink, true);
    });

    var observer = new MutationObserver(function () {
      ensureMenuItem();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    state.observer = observer;

    // The account modal is mounted lazily, so make a few inexpensive retries.
    var attempts = 0;
    var timer = window.setInterval(function () {
      ensureMenuItem();
      attempts += 1;
      if (attempts >= 30) window.clearInterval(timer);
    }, 1000);
    state.timer = timer;
  }

  function ensureMenuItem() {
    var menu = document.querySelector('[data-mj="account-menu"]');
    if (!menu) return false;

    var copy = getCopy(menu);

    var financesLink = Array.prototype.find.call(menu.querySelectorAll('a'), function (link) {
      return copy.sectionLabels.indexOf(normalizedText(link)) !== -1;
    });
    if (!financesLink) return false;

    var financesItem = financesLink.closest('li');
    var submenuContainer = financesItem && financesItem.nextElementSibling;
    var submenu = submenuContainer && submenuContainer.querySelector('ul');
    if (!submenu) return false;

    // Remove a copy created by an older bundle under another section.
    Array.prototype.forEach.call(document.querySelectorAll('[data-marinacasino-withdrawal-history]'), function (oldItem) {
      if (!submenu.contains(oldItem)) oldItem.remove();
    });

    if (submenu.querySelector('[data-marinacasino-withdrawal-history]')) return true;

    var item = document.createElement('li');
    item.setAttribute('data-mj', 'account-menu-item');
    item.setAttribute('data-marinacasino-withdrawal-history', 'true');
    item.className = 'app-ltr-1kgiy7l';

    var wrapper = document.createElement('div');
    wrapper.className = 'app-ltr-8atqhb';

    var link = document.createElement('a');
    // The site knows how to open its Financial History modal, not our custom route.
    link.href = copy.paymentRoute;
    link.className = 'sl-navlink app-ltr-1bacv49';
    link.setAttribute('data-marinacasino-withdrawal-link', 'true');

    var label = document.createElement('div');
    label.className = 'app-ltr-1eqbxal';
    label.appendChild(document.createTextNode(copy.menuLabel));

    link.appendChild(label);
    wrapper.appendChild(link);
    item.appendChild(wrapper);

    var paymentHistoryItem = Array.prototype.find.call(submenu.querySelectorAll('[data-mj="account-menu-item"]'), function (candidate) {
      return copy.paymentLabels.indexOf(normalizedText(candidate)) !== -1;
    });
    if (paymentHistoryItem) paymentHistoryItem.insertAdjacentElement('afterend', item);
    else submenu.appendChild(item);
    return true;
  }

  function handleWithdrawalLink(event) {
    var target = event.target;
    var link = target && target.closest && target.closest('[data-marinacasino-withdrawal-link]');
    if (!link) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    if (state.menuOpening) return;

    state.menuOpening = true;
    window.setTimeout(function () { state.menuOpening = false; }, 1000);
    openWithdrawalHistory();
  }

  function openWithdrawalHistory() {
    var modal = document.querySelector('[role="alertdialog"], .modal');
    var copy = getCopy(document.querySelector('[data-mj="account-menu"]') || document.body);

    // The compact player menu exists before the account modal. Open the real
    // Financial History route first, then retry after React mounts the modal.
    if (!modal) {
      var paymentLink = findPaymentLink(document, copy);
      if (paymentLink) {
        openPaymentHistoryRoute(paymentLink, copy);
        waitForAccountModal();
        return true;
      }
      window.location.href = copy.paymentRoute;
      return true;
    }

    ensureMenuItem();
    setActiveMenuItem(modal);
    copy = getCopy(modal);

    var closeButton = modal.querySelector('button[name="close"], button[aria-label="close"]');
    var headingScope = closeButton && closeButton.parentElement;
    var heading = headingScope && Array.prototype.find.call(headingScope.querySelectorAll('span, h1, h2, h3'), function (node) {
      return copy.paymentLabels.indexOf(normalizedText(node)) !== -1 || normalizedText(node) === copy.menuLabel.toLowerCase();
    });
    if (heading) heading.textContent = copy.menuLabel;

    var table = Array.prototype.find.call(modal.querySelectorAll('table'), function (candidate) {
      var text = normalizedText(candidate);
      return (text.indexOf('date time') !== -1 || text.indexOf('tarih') !== -1) &&
        (text.indexOf('operation type') !== -1 || text.indexOf('işlem') !== -1);
    });
    var host = findPaymentHistoryHost(table, modal, copy);
    if (!host) {
      // If the user clicked from another account tab, let the existing React
      // route mount Payment History first, then replace its content.
      var paymentLink = findPaymentLink(modal, copy);
      if (paymentLink) {
        openPaymentHistoryRoute(paymentLink, copy);
        waitForAccountModal();
        return true;
      }
      return false;
    }

    selectWithdrawalOperation(modal, copy);

    // The Turkish build owns this modal more aggressively than the English
    // build. Keep its React-managed DOM intact and use the native selected
    // operation filter instead of replacing the modal body; replacing it is
    // what causes the Turkish modal to unmount and return to the homepage.
    return true;

    var root = document.createElement('section');
    root.className = 'mc-withdrawal-history';
    root.setAttribute('data-marinacasino-withdrawal-history-root', 'true');
    return true; host.replaceChildren(root);
    state.root = root;

    renderShell(copy);
    loadTransactions();
    return true;
  }

  function findPaymentLink(scope, copy) {
    return Array.prototype.find.call(scope.querySelectorAll('a'), function (link) {
      if (link.hasAttribute('data-marinacasino-withdrawal-link')) return false;
      return copy.paymentLabels.indexOf(normalizedText(link)) !== -1 ||
        /[?&]t=financial(?:&|$)/.test(link.getAttribute('href') || '');
    });
  }

  function openPaymentHistoryRoute(paymentLink, copy) { var route = paymentLink.getAttribute('href') || copy.paymentRoute; if (window.history && typeof window.history.pushState === 'function') { window.history.pushState({}, '', route); window.dispatchEvent(new PopStateEvent('popstate')); waitForAccountModal(); return; } paymentLink.click(); waitForAccountModal(); } function waitForAccountModal(attempt) {
    attempt = attempt || 0;
    window.setTimeout(function () {
      if (document.querySelector('[role="alertdialog"], .modal')) {
        openWithdrawalHistory();
      } else if (attempt < 20) {
        waitForAccountModal(attempt + 1);
      }
    }, 250);
  }

  function selectWithdrawalOperation(modal, copy, attempt) {    attempt = attempt || 0;    var needle = normalizedText(copy.operationType);    var selector = 'select, [role="combobox"], input[aria-haspopup="listbox"], input[aria-haspopup="true"]';    var label = Array.prototype.find.call(modal.querySelectorAll('label'), function (node) {      return normalizedText(normalizedText(node)) === needle;    });    var field = label && label.getAttribute('for') && document.getElementById(label.getAttribute('for'));    var control = (field && field.querySelector(selector)) || (label && label.parentElement.querySelector(selector));    if (!control) control = Array.prototype.find.call(modal.querySelectorAll(selector), function (candidate) {      var node = candidate;      for (var depth = 0; node && depth < 8; depth += 1, node = node.parentElement) {        var text = normalizedText(normalizedText(node));        if (text.indexOf(needle) !== -1 || text.indexOf('operation type') !== -1 || text.indexOf('islem turu') !== -1) return true;      }      return false;    });    if (!control) {      if (attempt < 20) window.setTimeout(function () { selectWithdrawalOperation(modal, copy, attempt + 1); }, 150);      return false;    }    var clickable = control.closest('[class*="control"]') || control;    if (isWithdrawalText(normalizedText(clickable), copy)) return true;    if (control.tagName.toLowerCase() === 'select') {      var option = Array.prototype.find.call(control.options, function (item) { return isWithdrawalText(normalizedText(item), copy); });      if (option) { control.value = option.value; control.dispatchEvent(new Event('change', { bubbles: true })); }      return true;    }    clickable.click();    chooseWithdrawalOption(copy, 0);    return true;  }  function chooseWithdrawalOption(copy, attempt) {
    window.setTimeout(function () {
      var option = Array.prototype.find.call(document.querySelectorAll('[role="option"], [class*="option"]'), function (candidate) {
        var text = normalizedText(candidate);
        return text === copy.withdrawal.toLowerCase() ||
          text === 'withdrawal' || text === 'para çekme' ||
          text.indexOf(copy.withdrawal.toLowerCase()) === 0;
      });
      if (option) {
        option.click();
        var control = Array.prototype.find.call(document.querySelectorAll('[role="combobox"], input[aria-haspopup="listbox"], input[aria-haspopup="true"]'), function (candidate) {
          return normalizedText(candidate.closest('[class*="control"]') || candidate).indexOf(copy.withdrawal.toLowerCase()) !== -1;
        });
        if (control) control.setAttribute('data-mc-withdrawal-selected', 'true');
      } else if (attempt < 8) {
        chooseWithdrawalOption(copy, attempt + 1);
      }
    }, 50);
  }

  function normalizedText(value){var text=typeof value==='string'?value:(value&&value.textContent||'');return text.replace(/\s+/g,' ').trim().toLowerCase();} function isWithdrawalText(text,copy){var value=normalizedText(text);var labels=copy.locale==='tr-TR'?['para çekme','çekim','cekim']:['withdrawal'];return labels.some(function(label){var candidate=normalizedText(label);return value===candidate||value.indexOf(candidate)!==-1;});} function findPaymentHistoryHost(table, modal, copy) {
    if (table) {
      var node = table.parentElement;
      while (node && node !== modal) {
        var hasDatePicker = node.querySelector('.react-daterange-picker, #date-range-picker');
        if (hasDatePicker && node.contains(table)) return node;
        node = node.parentElement;
      }

      // Fallback for a future build where the date picker class changes.
      return table.parentElement && table.parentElement.parentElement
        ? table.parentElement.parentElement
        : table.parentElement;
    }

    // This site renders the payment-history grid with divs in some builds,
    // not a semantic <table>. Find the smallest shared body that contains both
    // filter labels, then replace only that body with our stable view.
    var dateNeedle = copy.dateRange.toLowerCase();
    var operationNeedle = copy.operationType.toLowerCase();
    var candidates = modal.querySelectorAll('label, span, p, div, section');
    var match = Array.prototype.find.call(candidates, function (candidate) {
      var text = normalizedText(candidate);
      if (text.indexOf(dateNeedle) === -1 || text.indexOf(operationNeedle) === -1) return false;
      return candidate !== modal && candidate.querySelectorAll('input, button, [role="combobox"]').length >= 2;
    });
    if (!match) return false;

    // Prefer the nearest body wrapper instead of the individual filter row.
    var body = match;
    while (body.parentElement && body.parentElement !== modal) {
      var parentText = normalizedText(body.parentElement);
      if (parentText.indexOf(dateNeedle) === -1 || parentText.indexOf(operationNeedle) === -1) break;
      var parent = body.parentElement;
      body = parent;
      if (parent.querySelectorAll('input, button, [role="combobox"]').length > 5) break;
    }
    return body;
  }

  function renderShell(copy) {
    if (!state.root) return;

    state.root.replaceChildren();

    var filters = document.createElement('div');
    filters.className = 'mc-withdrawal-filters';

    var quickActions = document.createElement('div');
    quickActions.className = 'mc-withdrawal-quick-actions';
    quickActions.appendChild(button(copy.today, function () {
      state.from = startOfDay(new Date());
      state.to = new Date();
      state.page = 1;
      syncDateInputs();
      loadTransactions();
    }));
    quickActions.appendChild(button(copy.lastMonth, function () {
      var now = new Date();
      state.from = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      state.to = now;
      state.page = 1;
      syncDateInputs();
      loadTransactions();
    }));
    filters.appendChild(quickActions);

    var dateField = document.createElement('label');
    dateField.className = 'mc-withdrawal-field';
    dateField.appendChild(fieldCaption(copy.dateRange));
    var dateRange = document.createElement('div');
    dateRange.className = 'mc-withdrawal-date-range';

    var fromInput = document.createElement('input');
    fromInput.type = 'date';
    fromInput.setAttribute('data-mc-from', 'true');
    fromInput.addEventListener('change', function () {
      state.from = parseDateInput(fromInput.value, state.from);
      state.page = 1;
      loadTransactions();
    });

    var toInput = document.createElement('input');
    toInput.type = 'date';
    toInput.setAttribute('data-mc-to', 'true');
    toInput.addEventListener('change', function () {
      state.to = endOfDay(parseDateInput(toInput.value, state.to));
      state.page = 1;
      loadTransactions();
    });

    dateRange.appendChild(fromInput);
    dateRange.appendChild(document.createTextNode('–'));
    dateRange.appendChild(toInput);
    dateField.appendChild(dateRange);
    filters.appendChild(dateField);

    var typeField = document.createElement('label');
    typeField.className = 'mc-withdrawal-field';
    typeField.appendChild(fieldCaption(copy.operationType));
    var typeSelect = document.createElement('select');
    typeSelect.className = 'mc-withdrawal-type-select';
    typeSelect.setAttribute('aria-label', copy.operationType);
    typeSelect.disabled = true;
    var withdrawalOption = document.createElement('option');
    withdrawalOption.value = CONFIG.operationType;
    withdrawalOption.textContent = copy.withdrawal;
    withdrawalOption.selected = true;
    typeSelect.appendChild(withdrawalOption);
    typeField.appendChild(typeSelect);
    filters.appendChild(typeField);

    state.root.appendChild(filters);
    state.root.appendChild(createTable(copy));
    state.root.appendChild(createFooter(copy));
    syncDateInputs();
  }

  function createTable(copy) {
    var wrapper = document.createElement('div');
    wrapper.className = 'mc-withdrawal-table-wrapper';

    var table = document.createElement('table');
    table.className = 'mc-withdrawal-table';
    var head = document.createElement('thead');
    var row = document.createElement('tr');
    copy.headers.forEach(function (title) {
      var cell = document.createElement('th');
      cell.textContent = title;
      row.appendChild(cell);
    });
    head.appendChild(row);
    table.appendChild(head);

    var body = document.createElement('tbody');
    body.setAttribute('data-mc-rows', 'true');
    var emptyRow = document.createElement('tr');
    var emptyCell = document.createElement('td');
    emptyCell.colSpan = 5;
    emptyCell.className = 'mc-withdrawal-empty';
    emptyCell.textContent = copy.loading;
    emptyRow.appendChild(emptyCell);
    body.appendChild(emptyRow);
    table.appendChild(body);
    wrapper.appendChild(table);
    return wrapper;
  }

  function createFooter(copy) {
    var footer = document.createElement('div');
    footer.className = 'mc-withdrawal-footer';

    var rowsLabel = document.createElement('span');
    rowsLabel.textContent = copy.rowsPerPage;
    footer.appendChild(rowsLabel);

    var pageSize = document.createElement('select');
    pageSize.setAttribute('data-mc-page-size', 'true');
    [20, 50, 100].forEach(function (size) {
      var option = document.createElement('option');
      option.value = String(size);
      option.textContent = String(size);
      pageSize.appendChild(option);
    });
    pageSize.value = String(state.pageSize);
    pageSize.addEventListener('change', function () {
      state.pageSize = Number(pageSize.value) || CONFIG.defaultPageSize;
      state.page = 1;
      loadTransactions();
    });
    footer.appendChild(pageSize);

    var count = document.createElement('span');
    count.setAttribute('data-mc-count', 'true');
    count.textContent = '0';
    footer.appendChild(count);

    var previous = button('‹', function () {
      if (state.page > 1) {
        state.page -= 1;
        loadTransactions();
      }
    });
    previous.setAttribute('aria-label', 'Previous page');
    previous.setAttribute('data-mc-prev', 'true');

    var next = button('›', function () {
      if (state.page * state.pageSize < state.total) {
        state.page += 1;
        loadTransactions();
      }
    });
    next.setAttribute('aria-label', 'Next page');
    next.setAttribute('data-mc-next', 'true');

    footer.appendChild(previous);
    footer.appendChild(next);
    return footer;
  }

  async function loadTransactions() {
    if (!state.root) return;
    var requestId = ++state.requestId;
    state.loading = true;
    setLoading(true);

    var params = new URLSearchParams({
      creationDateFrom: formatApiDate(state.from),
      creationDateTo: formatApiDate(state.to),
      transactionTypes: CONFIG.operationType,
      page: String(state.page),
      countPerPage: String(state.pageSize)
    });

    try {
      var response = await fetch(CONFIG.endpoint + '?' + params.toString(), {
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json' }
      });
      if (!response.ok) throw new Error('Transactions request failed (' + response.status + ')');

      var payload = await response.json();
      if (requestId !== state.requestId) return;

      var normalized = normalizeResponse(payload);
      state.total = normalized.total;
      renderRows(normalized.items);
      updateFooter();
    } catch (error) {
      if (requestId !== state.requestId) return;
      state.total = 0;
      renderMessage(error.message || getCopy(state.root).error);
      updateFooter();
    } finally {
      if (requestId === state.requestId) {
        state.loading = false;
        setLoading(false);
      }
    }
  }

  function normalizeResponse(payload) {
    if (Array.isArray(payload)) return { items: payload, total: payload.length };
    if (!payload || typeof payload !== 'object') return { items: [], total: 0 };

    var items = payload.items || payload.data || payload.transactions || payload.records || payload.results || [];
    if (!Array.isArray(items)) items = [];
    var total = Number(payload.totalCount || payload.total || payload.count || payload.totalRecords);
    return { items: items, total: Number.isFinite(total) ? total : items.length };
  }

  function renderRows(items) {
    var body = state.root && state.root.querySelector('[data-mc-rows]');
    if (!body) return;
    var copy = getCopy(state.root);
    body.replaceChildren();

    if (!items.length) {
      var row = document.createElement('tr');
      var cell = document.createElement('td');
      cell.colSpan = 5;
      cell.className = 'mc-withdrawal-empty';
      cell.textContent = getCopy(state.root).noData;
      row.appendChild(cell);
      body.appendChild(row);
      return;
    }

    items.forEach(function (transaction) {
      var row = document.createElement('tr');
      addCell(row, formatTransactionDate(transaction, copy.locale));
      addCell(row, transaction.operationType || transaction.transactionType || transaction.type || copy.withdrawal);
      addCell(row, transaction.status || transaction.state || '—');
      addCell(row, formatAmount(transaction.amount == null ? transaction.value : transaction.amount, transaction.currency));

      var actionCell = document.createElement('td');
      var id = transaction.id || transaction.transactionId || transaction.operationId;
      if (id) {
        var action = document.createElement('button');
        action.type = 'button';
        action.className = 'mc-withdrawal-action';
        action.textContent = copy.view;
        action.title = 'Transaction ' + id;
        action.addEventListener('click', function () {
          window.dispatchEvent(new CustomEvent('marinacasino:withdrawal-selected', { detail: transaction }));
        });
        actionCell.appendChild(action);
      } else {
        actionCell.textContent = '—';
      }
      row.appendChild(actionCell);
      body.appendChild(row);
    });
  }

  function renderMessage(message) {
    var body = state.root && state.root.querySelector('[data-mc-rows]');
    if (!body) return;
    body.replaceChildren();
    var row = document.createElement('tr');
    var cell = document.createElement('td');
    cell.colSpan = 5;
    cell.className = 'mc-withdrawal-empty mc-withdrawal-error';
    cell.textContent = message;
    row.appendChild(cell);
    body.appendChild(row);
  }

  function updateFooter() {
    if (!state.root) return;
    var count = state.root.querySelector('[data-mc-count]');
    var previous = state.root.querySelector('[data-mc-prev]');
    var next = state.root.querySelector('[data-mc-next]');
    if (count) count.textContent = String(state.total);
    if (previous) previous.disabled = state.page <= 1 || state.loading;
    if (next) next.disabled = state.page * state.pageSize >= state.total || state.loading;
  }

  function setLoading(loading) {
    if (!state.root) return;
    state.root.classList.toggle('mc-withdrawal-loading', loading);
    updateFooter();
  }

  function setActiveMenuItem(modal) {
    Array.prototype.forEach.call(modal.querySelectorAll('[data-mj="account-menu-item"] a'), function (link) {
      link.classList.remove('active');
    });
    var link = modal.querySelector('[data-marinacasino-withdrawal-link]');
    if (link) link.classList.add('active');
  }

  function syncDateInputs() {
    if (!state.root) return;
    var fromInput = state.root.querySelector('[data-mc-from]');
    var toInput = state.root.querySelector('[data-mc-to]');
    if (fromInput) fromInput.value = inputDate(state.from);
    if (toInput) toInput.value = inputDate(state.to);
  }

  function addCell(row, value) {
    var cell = document.createElement('td');
    cell.textContent = value == null ? '—' : String(value);
    row.appendChild(cell);
  }

  function button(label, onClick) {
    var element = document.createElement('button');
    element.type = 'button';
    element.className = 'mc-withdrawal-button';
    element.textContent = label;
    element.addEventListener('click', onClick);
    return element;
  }

  function fieldCaption(text) {
    var caption = document.createElement('span');
    caption.className = 'mc-withdrawal-field-caption';
    caption.textContent = text;
    return caption;
  }

  function getCopy(scope) {
    var path = String(window.location.pathname || '').toLowerCase();
    var text = scope ? normalizedText(scope) : '';
    var documentLanguage = String(document.documentElement.lang || '').toLowerCase();
    var isTurkish = path === '/tr' || path.indexOf('/tr/') === 0 ||
      text.indexOf('bakiye yönetimi') !== -1 || text.indexOf('geçmiş') !== -1 ||
      documentLanguage.indexOf('tr') === 0;
    return isTurkish ? COPY.tr : COPY.en;
  }

  function formatTransactionDate(transaction, locale) {
    var raw = transaction.creationDate || transaction.createdAt || transaction.transactionDate || transaction.date || transaction.createdOn;
    if (!raw) return '—';
    var date = new Date(raw);
    return Number.isNaN(date.getTime()) ? String(raw) : date.toLocaleString(locale || 'en-US');
  }

  function formatAmount(value, currency) {
    if (value == null || value === '') return '—';
    return String(value) + (currency ? ' ' + currency : '');
  }

  function normalizedText(node) { var text = typeof node === 'string' ? node : (node && node.textContent || '');
    return text.replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function endOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
  }

  function parseDateInput(value, fallback) {
    var parts = String(value || '').split('-').map(Number);
    return parts.length === 3 && parts.every(function (part) { return Number.isFinite(part); })
      ? new Date(parts[0], parts[1] - 1, parts[2])
      : fallback;
  }

  function inputDate(date) {
    return [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join('-');
  }

  function formatApiDate(date) {
    return [pad(date.getMonth() + 1), pad(date.getDate()), date.getFullYear()].join('.') + ' ' +
      [pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())].join(':');
  }

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function injectStyles() {
    if (document.getElementById('marinacasino-withdrawal-history-styles')) return;
    var style = document.createElement('style');
    style.id = 'marinacasino-withdrawal-history-styles';
    style.textContent = [
      '.mc-withdrawal-history{color:#f7f8ff;width:100%;font-family:inherit}',
      '.mc-withdrawal-filters{display:grid;grid-template-columns:auto minmax(220px,1fr) minmax(240px,1fr);gap:16px;align-items:end;margin-bottom:24px}',
      '.mc-withdrawal-quick-actions{display:flex;gap:14px}',
      '.mc-withdrawal-button{border:1px solid #63708e;border-radius:9px;background:transparent;color:#f7f8ff;cursor:pointer;font:inherit;min-height:40px;padding:0 22px}',
      '.mc-withdrawal-button:hover{border-color:#fff}',
      '.mc-withdrawal-field{display:flex;flex-direction:column;gap:7px;min-width:0}',
      '.mc-withdrawal-field-caption{font-size:14px;color:#c4c8d8}',
      '.mc-withdrawal-date-range,.mc-withdrawal-type-select{border:1px solid #aab1c5;border-radius:18px;min-height:40px;display:flex;align-items:center;gap:8px;padding:0 14px;box-sizing:border-box}',
      '.mc-withdrawal-date-range input{background:transparent;border:0;color:#fff;min-width:0;font:inherit;flex:1}',
      '.mc-withdrawal-type-select{background:#080f2b;color:#fff;font:inherit;width:100%;appearance:auto}',
      '.mc-withdrawal-type-select:disabled{opacity:1;cursor:default}',
      '.mc-withdrawal-table-wrapper{overflow:auto}',
      '.mc-withdrawal-table{border-collapse:collapse;width:100%;font-size:13px}',
      '.mc-withdrawal-table th{text-align:left;font-weight:600;color:#fff;padding:0 16px 15px;border-bottom:1px solid #2a3553}',
      '.mc-withdrawal-table td{padding:16px;border-bottom:1px solid rgba(42,53,83,.7);color:#e9ebf3}',
      '.mc-withdrawal-table th:first-child,.mc-withdrawal-table td:first-child{padding-left:0}',
      '.mc-withdrawal-empty{text-align:center!important;color:#8b91a6!important;height:160px}',
      '.mc-withdrawal-error{color:#ff9d9d!important}',
      '.mc-withdrawal-footer{display:flex;align-items:center;justify-content:flex-end;gap:16px;margin-top:18px;color:#fff;font-size:13px}',
      '.mc-withdrawal-footer select{background:#080f2b;border:1px solid #aab1c5;border-radius:18px;color:#fff;padding:10px 28px 10px 14px;font:inherit}',
      '.mc-withdrawal-footer button{min-width:38px;padding:0 10px}',
      '.mc-withdrawal-footer button:disabled{cursor:not-allowed;opacity:.35}',
      '.mc-withdrawal-action{border:0;background:transparent;color:#a9bfff;cursor:pointer;font:inherit}',
      '.mc-withdrawal-loading{opacity:.75;pointer-events:none}',
      '@media (max-width:900px){.mc-withdrawal-filters{grid-template-columns:1fr 1fr}.mc-withdrawal-quick-actions{grid-column:1/-1}.mc-withdrawal-field:last-child{grid-column:1/-1}}'
    ].join('');
    document.head.appendChild(style);
  }

  function destroy() {
    if (state.observer) state.observer.disconnect();
    if (state.timer) window.clearInterval(state.timer);
    ['pointerdown', 'mousedown', 'click'].forEach(function (type) {
      document.removeEventListener(type, handleWithdrawalLink, true);
    });
    var menuItem = document.querySelector('[data-marinacasino-withdrawal-history]');
    if (menuItem) menuItem.remove();
    var style = document.getElementById('marinacasino-withdrawal-history-styles');
    if (style) style.remove();
    delete window.__marinaCasinoWithdrawalHistory;
  }
})();

/* 1) BONUS TALEP -> marinaotobonus.com/bonustalep yonlendirme */
(function bonusRequestRedirect() {
  'use strict';

  var TARGET = 'https://marinaotobonus.com/bonustalep';
  var LINKS = { 'BONUS TALEP': TARGET };

  function go(event) {
    var target = event.target;
    var nav = target.closest && target.closest('a[href*="t=bonus_offers"]');
    if (nav) {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.location.href = TARGET;
      return;
    }

    var item = target.closest && target.closest('[data-mj="widget-pages-item"]');
    if (!item) return;
    var image = item.querySelector('img[alt]');
    if (!image) return;
    var url = LINKS[image.getAttribute('alt')];
    if (!url) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    window.location.href = url;
  }

  ['pointerdown', 'mousedown', 'click'].forEach(function (type) {
    document.addEventListener(type, go, true);
  });
})();

/* 2) CANLI DESTEK tiklaninca secili gorunsun (sohbet route degil) */
(function supportActiveState() {
  'use strict';

  function isSupport(item) {
    return item && item.querySelector && item.querySelector('span[style*="e4c0aa2d"]');
  }

  document.addEventListener('click', function (event) {
    var item = event.target.closest && event.target.closest('[data-mj="bottom-nav-item"]');
    if (!item) return;
    if (isSupport(item)) document.documentElement.classList.add('mj-support-active');
    else document.documentElement.classList.remove('mj-support-active');
  }, true);
})();

/* 3) Ana sayfa: kisayol butonlarini Son Kazananlar'in yerine tasi */
(function reorderHomepageWidgets() {
  'use strict';

  function reorder() {
    var banner = document.querySelector('[data-mj="widget-banner-container"]');
    var winners = document.querySelector('[data-mj="widget-bet-win-container"]');
    var shortcutA = document.querySelector('[data-mj="widget-pages"] a[href*="beniara"]');
    var vipA = document.querySelector('[data-mj="widget-pages"] a[href*="vipclub"]');
    if (!banner || !winners || !shortcutA || !vipA) return;

    var shortcut = shortcutA.closest('[data-mj="widget-pages"]');
    var vip = vipA.closest('[data-mj="widget-pages"]');
    if (!shortcut || !vip) return;

    // Desired order on desktop and mobile: banner -> shortcut -> VIP -> winners.
    if (banner.nextElementSibling === shortcut && shortcut.nextElementSibling === vip && vip.nextElementSibling === winners) return;
    banner.insertAdjacentElement('afterend', vip);
    banner.insertAdjacentElement('afterend', shortcut);
    vip.insertAdjacentElement('afterend', winners);
  }

  reorder();
  if (window.MutationObserver) {
    new MutationObserver(reorder).observe(document.body, { childList: true, subtree: true });
  }
})();

/* 4) Lisans/verification banner -> yeni sekme */
(function verificationBannerNewTab() {
  'use strict';

  var MATCH = 'verification.anjuoangamingbaord';

  function apply() {
    document.querySelectorAll('a[href*="' + MATCH + '"]').forEach(function (anchor) {
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
    });
  }

  apply();
  if (window.MutationObserver) {
    new MutationObserver(apply).observe(document.documentElement, { childList: true, subtree: true });
  }

  // Handle only click: pointerdown + click can open two tabs.
  document.addEventListener('click', function (event) {
    var anchor = event.target.closest && event.target.closest('a[href*="' + MATCH + '"]');
    if (!anchor) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.open(anchor.href, '_blank');
  }, true);
})();
