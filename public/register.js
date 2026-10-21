const form = document.getElementById("registerForm");
const nameInput = document.getElementById("name");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const confirmPasswordInput =
    document.getElementById("confirmPassword");
const roleInput = document.getElementById("role");
const message = document.getElementById("message");
const togglePassword =
    document.getElementById("togglePassword");
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
    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword =
        confirmPasswordInput.value;
    const role = roleInput.value;
    if (password !== confirmPassword) {
        message.textContent =
            "Passwords do not match.";
        message.style.color = "red";
        return;
    }
    if (password.length < 6) {
        message.textContent =
            "Password must contain at least 6 characters.";
        message.style.color = "red";
       return;
    }
    message.textContent = "Creating account...";
    message.style.color = "#172033";
    try {
        const response = await fetch(
            "/api/auth/register",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    name,
                    email,
                    password,
                    role
                })
            }
        );
        const data = await response.json();
        if (!response.ok) {
            message.textContent =
                data.message;
            message.style.color = "red";
            return;
        }
        message.textContent =
            "Account created successfully!";
        message.style.color = "green";
        form.reset();
        setTimeout(() => {
            window.location.href =
                "login.html";
        }, 1500);
    } catch (error) {
        console.log(error);
        message.textContent =
            "Unable to connect to server.";
        message.style.color = "red";
    }
});