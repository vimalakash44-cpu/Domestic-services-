const form = document.getElementById("companyForm");
const message = document.getElementById("message");
form.addEventListener("submit", async function (event) {
    event.preventDefault();
    const phone = document.getElementById("phone").value.trim();
    const phonePattern = /^[0-9]{10}$/;
    if (!phonePattern.test(phone)) {
        message.textContent =
            "Please enter a valid 10-digit phone number.";
        message.style.color = "red";
        return;
    }
    const selectedServices = document.querySelectorAll(
        'input[name="services"]:checked'
    );

    if (selectedServices.length === 0) {
        message.textContent =
            "Please select at least one service.";
        message.style.color = "red";
        return;
    }
    const fileInput = document.getElementById("verification_document");
    const file = fileInput.files[0];

    if (!file) {
        message.textContent ="Please upload a verification document.";
        message.style.color = "red";
        return;
    }
    if (file.size > 5 * 1024 * 1024) {
        message.textContent ="File size must be less than 5 MB.";
        message.style.color = "red";
        return;
    }
    const formData = new FormData(form);
    const token = localStorage.getItem("token");

    if (!token) {
        message.textContent ="Please login before registering your company.";
        message.style.color = "red";
        return;
    }
    message.textContent ="Submitting company registration...";
    message.style.color = "#172033";
    try {
        const response = await fetch(
            "/api/company/register",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`
                },
                body: formData
            }
        );

        const data = await response.json();

        if (!response.ok) {
            message.textContent = data.message;
            message.style.color = "red";
            return;
        }

        message.textContent =
            "Registration submitted successfully. Your company is now pending admin verification.";
        message.style.color = "green";

        form.reset();

        setTimeout(() => {
            window.location.href = "login.html";
        }, 3000);

    } catch (error) {
        console.log(error);

        message.textContent =
            "Unable to connect to server.";
        message.style.color = "red";
    }
});