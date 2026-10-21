// Clear all fields on login page load and pageshow (when user comes back via browser ← arrow)
function resetAndClearLoginForm() {
    try {
        const loginForm = document.getElementById('loginForm');
        if (loginForm && typeof loginForm.reset === 'function') {
            loginForm.reset();
        }
        const emailEl = document.getElementById('email');
        const passwordEl = document.getElementById('password');
        const roleEl = document.getElementById('role');
        const msgEl = document.getElementById('message');
        if (emailEl) emailEl.value = '';
        if (passwordEl) passwordEl.value = '';
        if (roleEl) roleEl.value = '';
        if (msgEl) msgEl.textContent = '';
        localStorage.clear();
        sessionStorage.clear();
    } catch (e) {
        console.warn('Form reset error:', e);
    }
}
window.addEventListener('DOMContentLoaded', resetAndClearLoginForm);
window.addEventListener('pageshow', resetAndClearLoginForm);

const form = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const roleInput = document.getElementById("role");
const message = document.getElementById("message");
const togglePassword =document.getElementById("togglePassword");
togglePassword.addEventListener("click", () => {
    if (passwordInput.type === "password") {
        passwordInput.type = "text";
        togglePassword.textContent = "Hide";
    } else {
        passwordInput.type = "password";
        togglePassword.textContent = "Show";
    }
});
form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const role = roleInput.value;
    message.textContent = "Signing in...";
    try {
        const response = await fetch("/api/auth/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email,
                password,
                role
            })
        });
        const data = await response.json();
        if (!response.ok) {
            message.textContent = data.message;
            return;
        }
        localStorage.setItem("token", data.token);
        localStorage.setItem("role", data.role);
        localStorage.setItem("name", data.name);
        message.textContent ="Login successful";
        if (data.role === "customer") {
            window.location.href = "customer-dashboard.html";
        }
        else if (data.role === "worker") {
            window.location.href = "worker-dashboard.html";
        }
        else if (data.role === "company") {
            if (data.exists === false) {
                window.location.href = "company-register.html";
                return;
            }

            if (data.status === "pending") {
                window.location.href = "company-pending.html";
                return;
            }

            if (data.status === "rejected") {
                window.location.href = "company-register.html";
                return;
            }

            if (data.status === "approved") {
                localStorage.setItem("token", data.token);
                window.location.href = "company-dashboard.html";
                return;
            }
        }
        else if (data.role === "admin") {
            window.location.href = "admin-dashboard.html";
        }
    } catch (error) {
         console.log(error);
        message.textContent ="Unable to connect to server";
    }
});