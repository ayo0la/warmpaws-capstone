// Login Page JavaScript

document.addEventListener('DOMContentLoaded', async () => {
    // Check if already logged in
    try {
        const user = await API.auth.getCurrentUser();
        if (user) {
            const redirect = Utils.getQueryParams().redirect || '/index.html';
            window.location.href = redirect;
            return;
        }
    } catch (error) {
        // Not logged in, continue
    }

    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const showRegisterLink = document.getElementById('show-register');
    const showLoginLink = document.getElementById('show-login');
    const loginContainer = document.getElementById('login-container');
    const registerContainer = document.getElementById('register-container');

    // Toggle between login and register
    if (showRegisterLink) {
        showRegisterLink.addEventListener('click', (e) => {
            e.preventDefault();
            loginContainer.style.display = 'none';
            registerContainer.style.display = 'block';
        });
    }

    if (showLoginLink) {
        showLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            registerContainer.style.display = 'none';
            loginContainer.style.display = 'block';
        });
    }

    // Handle login
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            try {
                const submitBtn = loginForm.querySelector('button[type="submit"]');
                submitBtn.disabled = true;
                submitBtn.textContent = 'Logging in...';

                await API.auth.login(email, password);

                Utils.showToast('Login successful!', 'success');

                // Redirect
                const redirect = Utils.getQueryParams().redirect || '/index.html';
                setTimeout(() => {
                    window.location.href = redirect;
                }, 500);

            } catch (error) {
                Utils.showToast(error.message || 'Login failed', 'error');
                const submitBtn = loginForm.querySelector('button[type="submit"]');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Log In';
            }
        });
    }

    // Handle registration
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const firstName = document.getElementById('reg-first-name').value;
            const lastName = document.getElementById('reg-last-name').value;
            const email = document.getElementById('reg-email').value;
            const password = document.getElementById('reg-password').value;
            const confirmPassword = document.getElementById('reg-confirm-password').value;
            const phone = document.getElementById('reg-phone').value;
            const role = document.getElementById('reg-role').value;

            // Validate
            if (password !== confirmPassword) {
                Utils.showToast('Passwords do not match', 'error');
                return;
            }

            if (password.length < 6) {
                Utils.showToast('Password must be at least 6 characters', 'error');
                return;
            }

            if (!Utils.isValidEmail(email)) {
                Utils.showToast('Please enter a valid email', 'error');
                return;
            }

            try {
                const submitBtn = registerForm.querySelector('button[type="submit"]');
                submitBtn.disabled = true;
                submitBtn.textContent = 'Creating account...';

                await API.auth.register({
                    firstName,
                    lastName,
                    email,
                    password,
                    phone,
                    role
                });

                Utils.showToast('Account created successfully!', 'success');

                // Redirect
                setTimeout(() => {
                    window.location.href = '/index.html';
                }, 500);

            } catch (error) {
                Utils.showToast(error.message || 'Registration failed', 'error');
                const submitBtn = registerForm.querySelector('button[type="submit"]');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Create Account';
            }
        });
    }
});
