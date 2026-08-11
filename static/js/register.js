document.addEventListener('DOMContentLoaded', function () {

  var form          = document.getElementById('registerForm');
  var usernameInput = document.getElementById('username');
  var passwordInput = document.getElementById('password');
  var passwordToggle = document.getElementById('passwordToggle');
  var eyeIcon        = document.getElementById('eyeIcon');
  var registerBtn    = document.getElementById('registerBtn');
  var formErrorEl    = document.getElementById('formError');

  var MAX_LEN = 6;

  var EYE_OPEN =
    '<path d="M1 12C1 12 5 5 12 5C19 5 23 12 23 12C23 12 19 19 12 19C5 19 1 12 1 12Z" stroke="#6B7280" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<circle cx="12" cy="12" r="3" stroke="#6B7280" stroke-width="1.6"/>';

  var EYE_CLOSED =
    '<path d="M3 3L21 21" stroke="#6B7280" stroke-width="1.6" stroke-linecap="round"/>' +
    '<path d="M10.6 5.2C11 5.1 11.5 5 12 5C19 5 23 12 23 12C22.6 12.7 21.8 13.9 20.6 15.1M6.3 6.6C3.4 8.5 1 12 1 12C1 12 5 19 12 19C13.9 19 15.5 18.5 16.8 17.8" stroke="#6B7280" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M9.9 10C9.3 10.5 9 11.2 9 12C9 13.7 10.3 15 12 15C12.8 15 13.5 14.7 14 14.2" stroke="#6B7280" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>';

  // ----- Password visibility toggle -----
  passwordToggle.addEventListener('click', function () {
    var isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';
    eyeIcon.innerHTML = isPassword ? EYE_CLOSED : EYE_OPEN;
    passwordToggle.setAttribute('aria-label', isPassword ? 'Sembunyikan password' : 'Tampilkan password');
  });

  // ----- Field error helpers -----
  function setError(input, hasError) {
    var field = input.closest('.field');
    field.classList.toggle('has-error', hasError);
  }

  function isValid(value) {
    return value.length > 0 && value.length <= MAX_LEN;
  }

  usernameInput.addEventListener('input', function () {
    if (isValid(usernameInput.value.trim())) setError(usernameInput, false);
  });

  passwordInput.addEventListener('input', function () {
    if (isValid(passwordInput.value)) setError(passwordInput, false);
  });

  // ----- Submit handling -----
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    formErrorEl.classList.remove('is-visible');

    var username = usernameInput.value.trim();
    var password = passwordInput.value;
    var valid = true;

    if (!isValid(username)) {
      setError(usernameInput, true);
      valid = false;
    }

    if (!isValid(password)) {
      setError(passwordInput, true);
      valid = false;
    }

    if (!valid) return;

    registerBtn.classList.add('is-loading');
    registerBtn.querySelector('.btn-primary__text').textContent = 'Mendaftarkan...';

    fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username, password: password })
    })
      .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (result) {
        if (result.ok && result.data.success) {
          window.location.href = result.data.redirect || '/menu';
          return;
        }
        formErrorEl.textContent = result.data.error || 'Gagal mendaftar. Coba lagi.';
        formErrorEl.classList.add('is-visible');
      })
      .catch(function () {
        formErrorEl.textContent = 'Tidak bisa terhubung ke server. Coba lagi.';
        formErrorEl.classList.add('is-visible');
      })
      .finally(function () {
        registerBtn.classList.remove('is-loading');
        registerBtn.querySelector('.btn-primary__text').textContent = 'Daftar';
      });
  });

});

