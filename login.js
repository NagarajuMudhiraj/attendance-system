// login.js
document.addEventListener('DOMContentLoaded', () => {
    // If already logged in, redirect to index
    if (localStorage.getItem('currentUser')) {
        window.location.href = 'index.html';
        return;
    }

    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');
    const loginBtn = loginForm.querySelector('.btn-login');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();

        try {
            loginBtn.textContent = 'Signing in...';
            loginBtn.disabled = true;

            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('currentUser', JSON.stringify(data.user));
                window.location.href = 'index.html';
            } else {
                errorMessage.textContent = data.error || 'Invalid username or password';
                loginBtn.textContent = 'Sign In';
                loginBtn.disabled = false;
            }

        } catch (error) {
            console.error('Error logging in:', error);
            errorMessage.textContent = 'Error connecting to server. Please try again.';
            loginBtn.textContent = 'Sign In';
            loginBtn.disabled = false;
        }
    });

    // Clear error message on input change
    document.getElementById('username').addEventListener('input', () => {
        errorMessage.textContent = '';
    });
    document.getElementById('password').addEventListener('input', () => {
        errorMessage.textContent = '';
    });
});
