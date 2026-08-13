document.addEventListener('DOMContentLoaded', function () {

  var form          = document.getElementById('loginForm');
  var usernameInput = document.getElementById('username');
  var passwordInput = document.getElementById('password');
  var passwordToggle = document.getElementById('passwordToggle');
  var eyeIcon        = document.getElementById('eyeIcon');
  var signInBtn      = document.getElementById('signInBtn');
  var formErrorEl    = document.getElementById('formError');
  var rememberMeCheckbox = document.getElementById('rememberMe');

  var REMEMBERED_USERNAME_KEY = 'ft_remembered_username';

  // ----- Pre-fill remembered username (pure UX convenience, not tied
  // to the session/login state itself) -----
  var rememberedUsername = localStorage.getItem(REMEMBERED_USERNAME_KEY);
  if (rememberedUsername) {
    usernameInput.value = rememberedUsername;
    rememberMeCheckbox.checked = true;
  }

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

  usernameInput.addEventListener('input', function () {
    if (usernameInput.value.trim().length > 0) setError(usernameInput, false);
  });

  passwordInput.addEventListener('input', function () {
    if (passwordInput.value.length > 0) setError(passwordInput, false);
  });

  // ----- Submit handling -----
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    formErrorEl.classList.remove('is-visible');

    var username = usernameInput.value.trim();
    var password = passwordInput.value;
    var valid = true;

    if (username.length === 0) {
      setError(usernameInput, true);
      valid = false;
    }

    if (password.length === 0) {
      setError(passwordInput, true);
      valid = false;
    }

    if (!valid) return;

    signInBtn.classList.add('is-loading');
    signInBtn.querySelector('.btn-primary__text').textContent = 'Signing in...';

    var remember = rememberMeCheckbox.checked;

    fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: username,
        password: password,
        remember: remember
      })
    })
      .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (result) {
        if (result.ok && result.data.success) {
          if (remember) {
            localStorage.setItem(REMEMBERED_USERNAME_KEY, username);
          } else {
            localStorage.removeItem(REMEMBERED_USERNAME_KEY);
          }
          window.location.href = result.data.redirect || '/menu';
          return;
        }
        formErrorEl.textContent = result.data.error || 'Gagal masuk. Coba lagi.';
        formErrorEl.classList.add('is-visible');
      })
      .catch(function () {
        formErrorEl.textContent = 'Tidak bisa terhubung ke server. Coba lagi.';
        formErrorEl.classList.add('is-visible');
      })
      .finally(function () {
        signInBtn.classList.remove('is-loading');
        signInBtn.querySelector('.btn-primary__text').textContent = 'Sign In';
      });
  });

});

