const token = localStorage.getItem("token");
if (!token) {
    window.location.href = "login.html";
}

// Browser Back Arrow (<-) handler: navigate to login page and clear all fields
window.history.pushState(null, "", window.location.href);
window.addEventListener("popstate", function() {
    try {
        localStorage.clear();
        sessionStorage.clear();
    } catch(e) {}
    window.location.replace("login.html");
});
let companies = [];
let selectedCompany = null;
let favorites = JSON.parse(
    localStorage.getItem("favoriteCompanies") || "[]"
);
const companyList =document.getElementById("companyList");
const recommendedList =document.getElementById("recommendedList");
const companyCount =document.getElementById("companyCount");
const searchInput =document.getElementById("searchInput");
const serviceFilter =document.getElementById("serviceFilter");
const ratingFilter =document.getElementById("ratingFilter");
const experienceFilter =document.getElementById("experienceFilter");
const sortFilter =document.getElementById("sortFilter");
const companyModal =document.getElementById("companyModal");
const requestModal =document.getElementById("requestModal");
const closeCompanyModal =document.getElementById("closeCompanyModal");
const closeRequestModal =document.getElementById("closeRequestModal");
const requestServiceBtn =document.getElementById("requestServiceBtn");
const requestForm =document.getElementById("requestForm");
const requestPhotos =document.getElementById("requestPhotos");
const photoPreview =document.getElementById("photoPreview");
const logoutBtn =document.getElementById("logoutBtn");
async function loadCustomer() {
    try {
        const response = await fetch(
            "/api/auth/me",
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );
        if (!response.ok) {
            return;
        }
        const data = await response.json();
        const user = data.user || data;
        const name = user.name ||user.username ||"Customer";
        document.getElementById("userName").textContent = name;
        document.getElementById( "userAvatar").textContent =name.charAt(0).toUpperCase();
    } catch (error) {
        console.log("Customer information unavailable.");
    }
}


async function loadCompanies() {

    try {

        companyList.innerHTML = `
            <div class="loading">
                <div class="spinner"></div>
                <p>Loading verified companies...</p>
            </div>
        `;

        const response = await fetch(
            "/api/company/approved",
            {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        const data =
            await response.json();

        if (response.status === 401 ||
            response.status === 403) {

            localStorage.removeItem("token");

            window.location.href =
                "login.html";

            return;
        }

        if (!response.ok) {
            throw new Error(
                data.message ||
                "Unable to load companies."
            );
        }

        companies =
            data.companies || [];

        companies =
            companies.filter(
                company =>
                    company.verification_status ===
                    "approved"
            );

        companyCount.textContent =
            `${companies.length} companies`;

        displayCompanies();

    } catch (error) {

        console.error(error);

        companyList.innerHTML = `
            <div class="empty">
                <h3>Unable to load companies</h3>
                <p>${error.message}</p>
            </div>
        `;
    }
}


function displayCompanies() {

    let filtered =
        [...companies];

    const search =
        searchInput.value
            .trim()
            .toLowerCase();

    const service =
        serviceFilter.value;

    const rating =
        Number(ratingFilter.value || 0);

    const experience =
        Number(
            experienceFilter.value || 0
        );

    if (search) {

        filtered =
            filtered.filter(company => {

                const companyName =
                    (
                        company.company_name ||
                        ""
                    ).toLowerCase();

                const services =
                    Array.isArray(
                        company.services
                    )
                        ? company.services.join(" ").toLowerCase()
                        : "";

                return (
                    companyName.includes(search) ||
                    services.includes(search)
                );
            });
    }

    if (service) {

        filtered =
            filtered.filter(company =>
                Array.isArray(company.services) &&
                company.services.some(
                    item =>
                        item.toLowerCase() ===
                        service.toLowerCase()
                )
            );
    }

    if (rating) {

        filtered =
            filtered.filter(company =>
                Number(
                    company.rating || 0
                ) >= rating
            );
    }

    if (experience) {

        filtered =
            filtered.filter(company =>
                Number(
                    company.experience || 0
                ) >= experience
            );
    }

    filtered.sort(
        (a, b) => {

            if (
                sortFilter.value ===
                "rating"
            ) {
                return (
                    Number(b.rating || 0) -
                    Number(a.rating || 0)
                );
            }

            if (
                sortFilter.value ===
                "experience"
            ) {
                return (
                    Number(b.experience || 0) -
                    Number(a.experience || 0)
                );
            }

            if (
                sortFilter.value ===
                "workers"
            ) {
                return (
                    Number(b.total_workers || 0) -
                    Number(a.total_workers || 0)
                );
            }

            return (
                Number(b.rating || 0) -
                Number(a.rating || 0)
            );
        }
    );

    companyCount.textContent =
        `${filtered.length} companies`;

    renderCompanies(
        companyList,
        filtered
    );

    renderRecommended(
        filtered
    );
}


function renderCompanies(
    container,
    list
) {

    if (list.length === 0) {

        container.innerHTML = `
            <div class="empty">
                <h3>No companies found</h3>
                <p>
                    Try changing your search
                    or filters.
                </p>
            </div>
        `;

        return;
    }

    container.innerHTML = "";

    list.forEach(company => {

        const card =
            createCompanyCard(
                company
            );

        container.appendChild(card);
    });
}


function renderRecommended(list) {

    const recommended =
        [...list]
            .sort(
                (a, b) =>
                    Number(b.rating || 0) -
                    Number(a.rating || 0)
            )
            .slice(0, 3);

    recommendedList.innerHTML = "";

    if (recommended.length === 0) {

        recommendedList.innerHTML = `
            <div class="empty">
                No recommendations available.
            </div>
        `;

        return;
    }

    recommended.forEach(
        company => {

            recommendedList.appendChild(
                createCompanyCard(company)
            );
        }
    );
}


function createCompanyCard(company) {

    const card =
        document.createElement("div");

    card.className =
        "company-card";

    const name =
        company.company_name ||
        "Company";

    const letter =
        name.charAt(0).toUpperCase();

    const services =
        Array.isArray(company.services)
            ? company.services
            : [];

    const rating =
        Number(company.rating || 0);

    const reviews =
        Number(
            company.review_count || company.total_reviews || 0
        );

    const favorite =
        favorites.includes(
            company._id
        );

    card.innerHTML = `

        <span class="verified-badge">
            ✓ VERIFIED
        </span>

        <div class="card-top">

            <div class="company-logo">
                ${letter}
            </div>

            <div>

                <h3>${escapeHtml(name)}</h3>

                <div class="location">
                    📍 ${escapeHtml(
                        company.city || "Location unavailable"
                    )}
                </div>

                <div class="rating">
                    ⭐ ${rating.toFixed(1)}
                    <span>
                        (${reviews} reviews)
                    </span>
                </div>

            </div>

        </div>

        <p class="company-description">
            ${escapeHtml(
                company.description ||
                "Professional domestic services for your home."
            )}
        </p>

        <div class="services">

            ${services
                .slice(0, 4)
                .map(
                    service =>
                        `<span class="service-tag">
                            ${serviceIcon(service)}
                            ${escapeHtml(service)}
                        </span>`
                )
                .join("")}

        </div>

        <div class="card-stats">

            <div class="card-stat">
                <strong>
                    ${company.experience || 0}
                </strong>
                <small>Years</small>
            </div>

            <div class="card-stat">
                <strong>
                    ${company.total_workers || 0}
                </strong>
                <small>Workers</small>
            </div>

            <div class="card-stat">
                <strong>
                    ${rating.toFixed(1)}
                </strong>
                <small>Rating</small>
            </div>

        </div>

        <div class="card-actions">

            <button
                class="view-company-btn"
                onclick="viewCompany('${company._id}')"
            >
                View Details →
            </button>

            <button
                class="chat-card-btn"
                onclick="openChatWithCompany('${company._id}')"
            >
                💬 Chat / Quote
            </button>

            <button
                class="favorite-small"
                onclick="toggleFavorite('${company._id}')"
            >
                ${favorite ? "♥" : "♡"}
            </button>

        </div>
    `;

    return card;
}


function viewCompany(id) {

    selectedCompany =
        companies.find(
            company =>
                company._id === id
        );

    if (!selectedCompany) {
        return;
    }

    const name =
        selectedCompany.company_name ||
        "Company";

    document.getElementById(
        "modalLogo"
    ).textContent =
        name.charAt(0).toUpperCase();

    document.getElementById(
        "modalCompanyName"
    ).textContent = name;

    document.getElementById(
        "modalLocation"
    ).textContent =
        `📍 ${selectedCompany.city || "Location unavailable"}`;

    const rating =
        Number(
            selectedCompany.rating || 0
        );

    document.getElementById(
        "modalRating"
    ).textContent =
        rating.toFixed(1);

    document.getElementById(
        "modalRating2"
    ).textContent =
        rating.toFixed(1);

    document.getElementById(
        "modalReviews"
    ).textContent =
        `(${selectedCompany.review_count || selectedCompany.total_reviews || 0} reviews)`;

    document.getElementById(
        "modalExperience"
    ).textContent =
        selectedCompany.experience || 0;

    document.getElementById(
        "modalWorkers"
    ).textContent =
        selectedCompany.total_workers || 0;

    document.getElementById(
        "modalDescription"
    ).textContent =
        selectedCompany.description ||
        "No company description available.";

    document.getElementById(
        "modalOwner"
    ).textContent =
        selectedCompany.owner_name ||
        "Not available";

    const services =
        Array.isArray(
            selectedCompany.services
        )
            ? selectedCompany.services
            : [];

    document.getElementById(
        "modalServices"
    ).innerHTML =
        services.map(
            service =>
                `<span class="modal-service">
                    ${serviceIcon(service)}
                    ${escapeHtml(service)}
                </span>`
        ).join("");

    const reviewListContainer = document.getElementById("modalReviewsList");
    if (reviewListContainer) {
        const reviews = selectedCompany.reviews || [];
        if (reviews.length === 0) {
            reviewListContainer.innerHTML = `<div style="font-size:12px; color:#94a3b8; font-style:italic; padding:6px 0;">No written reviews yet from completed jobs.</div>`;
        } else {
            reviewListContainer.innerHTML = reviews.map(r => {
                const isNegative = (r.rating <= 2) || (r.complaint && r.complaint.trim().length > 0);
                const starStr = "★".repeat(r.rating || 5) + "☆".repeat(Math.max(0, 5 - (r.rating || 5)));
                return `
                    <div style="background:${isNegative ? '#fff1f2' : '#f8fafc'}; border:1px solid ${isNegative ? '#fecdd3' : '#e2e8f0'}; border-radius:8px; padding:10px; font-size:12px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                            <strong style="color:${isNegative ? '#9f1239' : '#1e293b'};">${escapeHtml(r.customer_name || 'Verified Customer')}</strong>
                            <span style="color:${isNegative ? '#e11d48' : '#eab308'}; font-weight:700;">${starStr} (${r.rating || 5}/5)</span>
                        </div>
                        ${r.comment ? `<p style="margin:4px 0; color:#334155; font-style:italic;">"${escapeHtml(r.comment)}"</p>` : ''}
                        ${r.complaint ? `<div style="background:#fee2e2; color:#991b1b; padding:4px 8px; border-radius:4px; font-size:11px; margin-top:4px;"><strong>Issue/Complaint reported:</strong> ${escapeHtml(r.complaint)}</div>` : ''}
                        <small style="color:#64748b; display:block; margin-top:4px;">Service: ${escapeHtml(r.service || 'Home Service')} • ${new Date(r.created_at || Date.now()).toLocaleDateString()}</small>
                    </div>
                `;
            }).join("");
        }
    }

    updateFavoriteButton();

    companyModal.classList.add("show");
}


requestServiceBtn.addEventListener(
    "click",
    () => {

        if (!selectedCompany) {
            return;
        }

        document.getElementById(
            "requestCompanyName"
        ).textContent =
            selectedCompany.company_name;

        const services =
            Array.isArray(
                selectedCompany.services
            )
                ? selectedCompany.services
                : [];

        const select =
            document.getElementById(
                "requestService"
            );

        select.innerHTML =
            `<option value="">
                Select Service
            </option>`;

        services.forEach(
            service => {

                const option =
                    document.createElement(
                        "option"
                    );

                option.value = service;
                option.textContent =
                    `${serviceIcon(service)} ${service}`;

                select.appendChild(option);
            }
        );

        companyModal.classList.remove(
            "show"
        );

        requestModal.classList.add(
            "show"
        );
    }
);


requestPhotos.addEventListener(
    "change",
    () => {

        photoPreview.innerHTML = "";

        const files =
            Array.from(
                requestPhotos.files
            );

        files.forEach(file => {

            if (!file.type.startsWith(
                "image/"
            )) {
                return;
            }

            const reader =
                new FileReader();

            reader.onload = event => {

                const image =
                    document.createElement(
                        "img"
                    );

                image.src =
                    event.target.result;

                photoPreview.appendChild(
                    image
                );
            };

            reader.readAsDataURL(file);
        });
    }
);


requestForm.addEventListener(
    "submit",
    async event => {

        event.preventDefault();

        if (!selectedCompany) {
            return;
        }

        const formData =
            new FormData();

        formData.append(
            "company_id",
            selectedCompany._id
        );

        formData.append(
            "service",
            document.getElementById(
                "requestService"
            ).value
        );

        formData.append(
            "priority",
            document.getElementById(
                "requestPriority"
            ).value
        );

        formData.append(
            "description",
            document.getElementById(
                "requestDescription"
            ).value
        );

        const prefDateVal = document.getElementById("preferredDate").value;
        const todayIso = new Date().toISOString().split("T")[0];
        if (prefDateVal && prefDateVal < todayIso) {
            showToast("Preferred date cannot be in the past. Please choose today or a future date.");
            return;
        }

        formData.append(
            "preferred_date",
            prefDateVal
        );

        formData.append(
            "preferred_time",
            document.getElementById(
                "preferredTime"
            ).value
        );

        formData.append(
            "service_address",
            document.getElementById(
                "serviceAddress"
            ).value
        );

        const files =
            Array.from(
                requestPhotos.files
            );

        files.forEach(
            file =>
                formData.append(
                    "photos",
                    file
                )
        );

        try {

            const response =
                await fetch(
                    "/api/customer/requests",
                    {
                        method: "POST",
                        headers: {
                            Authorization:
                                `Bearer ${token}`
                        },
                        body: formData
                    }
                );

            const data =
                await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    "Unable to send request."
                );
            }

            requestModal.classList.remove(
                "show"
            );

            requestForm.reset();

            photoPreview.innerHTML = "";

            showToast(
                "Service request & photos sent! Analyzing for quotation..."
            );

            loadMyRequestsCount();

            if (selectedCompany) {
                setTimeout(() => {
                    openChatWithCompany(selectedCompany._id);
                }, 500);
            }

        } catch (error) {

            console.error(error);

            showToast(
                error.message
            );
        }
    }
);


function toggleFavorite(id) {

    if (favorites.includes(id)) {

        favorites =
            favorites.filter(
                item => item !== id
            );

        showToast(
            "Removed from favorites."
        );

    } else {

        favorites.push(id);

        showToast(
            "Added to favorites."
        );
    }

    localStorage.setItem(
        "favoriteCompanies",
        JSON.stringify(favorites)
    );

    displayCompanies();

    if (selectedCompany) {
        updateFavoriteButton();
    }
}


function updateFavoriteButton() {

    if (!selectedCompany) {
        return;
    }

    const button =
        document.getElementById(
            "favoriteBtn"
        );

    if (
        favorites.includes(
            selectedCompany._id
        )
    ) {

        button.textContent =
            "♥ Remove from Favorites";

    } else {

        button.textContent =
            "♡ Add to Favorites";
    }
}


closeCompanyModal.addEventListener(
    "click",
    () => {
        companyModal.classList.remove(
            "show"
        );
    }
);


closeRequestModal.addEventListener(
    "click",
    () => {
        requestModal.classList.remove(
            "show"
        );
    }
);


window.addEventListener(
    "click",
    event => {

        if (
            event.target ===
            companyModal
        ) {
            companyModal.classList.remove(
                "show"
            );
        }

        if (
            event.target ===
            requestModal
        ) {
            requestModal.classList.remove(
                "show"
            );
        }
    }
);


searchInput.addEventListener(
    "input",
    displayCompanies
);

serviceFilter.addEventListener(
    "change",
    displayCompanies
);

ratingFilter.addEventListener(
    "change",
    displayCompanies
);

experienceFilter.addEventListener(
    "change",
    displayCompanies
);

sortFilter.addEventListener(
    "change",
    displayCompanies
);


logoutBtn.addEventListener(
    "click",
    () => {

        localStorage.removeItem(
            "token"
        );

        window.location.href =
            "login.html";
    }
);


// ===================================================
// CHATBOT & COMPANY COMMUNICATION LOGIC
// ===================================================

let chatCompanies = [];
let activeChatCompany = null;
let chatPollInterval = null;
let lastRenderedMessagesCount = 0;

const chatbotModal = document.getElementById("chatbotModal");
const closeChatbotModal = document.getElementById("closeChatbotModal");
const chatCompanySearch = document.getElementById("chatCompanySearch");
const chatCompanyList = document.getElementById("chatCompanyList");
const chatActiveLogo = document.getElementById("chatActiveLogo");
const chatActiveName = document.getElementById("chatActiveName");
const chatActiveMeta = document.getElementById("chatActiveMeta");
const chatActiveBadge = document.getElementById("chatActiveBadge");
const chatRequestQuoteBtn = document.getElementById("chatRequestQuoteBtn");
const chatSuggestionChips = document.getElementById("chatSuggestionChips");
const chatMessages = document.getElementById("chatMessages");
const chatInputForm = document.getElementById("chatInputForm");
const chatInputText = document.getElementById("chatInputText");
const chatAttachPhotoBtn = document.getElementById("chatAttachPhotoBtn");
const floatingChatFab = document.getElementById("floatingChatFab");
const fabUnreadBadge = document.getElementById("fabUnreadBadge");

// Open Chatbot Modal
async function openChatbotModal() {
    chatbotModal.classList.add("show");
    await loadChatCompanies();

    if (!activeChatCompany && chatCompanies.length > 0) {
        selectChatCompany(chatCompanies[0]);
    }

    if (!chatPollInterval) {
        chatPollInterval = setInterval(() => {
            if (activeChatCompany && chatbotModal.classList.contains("show")) {
                loadChatHistory(true);
            }
            updateUnreadBadge();
        }, 3500);
    }
}

// Close Chatbot Modal
function closeChatbot() {
    chatbotModal.classList.remove("show");
    if (chatPollInterval) {
        clearInterval(chatPollInterval);
        chatPollInterval = null;
    }
}

closeChatbotModal.addEventListener("click", closeChatbot);

// Open Chat Directly with a Specific Company
async function openChatWithCompany(companyId) {
    await openChatbotModal();
    const targetComp = chatCompanies.find(c => c._id === companyId);
    if (targetComp) {
        selectChatCompany(targetComp);
    } else {
        // Find in companies array
        const found = companies.find(c => c._id === companyId);
        if (found) {
            selectChatCompany(found);
        }
    }
}

// Fetch companies for chat
async function loadChatCompanies(searchQuery = "") {
    try {
        const response = await fetch("/api/chat/companies", {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!response.ok) return;
        const data = await response.json();
        chatCompanies = data.companies || [];

        renderChatCompaniesList(searchQuery);
        updateUnreadBadge();
    } catch (err) {
        console.error("Load chat companies error:", err);
    }
}

// Render company list in chatbot sidebar
function renderChatCompaniesList(searchQuery = "") {
    let filtered = [...chatCompanies];
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(c => 
            (c.company_name || "").toLowerCase().includes(q) ||
            (c.city || "").toLowerCase().includes(q)
        );
    }

    if (filtered.length === 0) {
        chatCompanyList.innerHTML = `<div class="empty" style="padding:15px; font-size:12px;">No companies found</div>`;
        return;
    }

    chatCompanyList.innerHTML = "";
    filtered.forEach(company => {
        const item = document.createElement("div");
        const isActive = activeChatCompany && activeChatCompany._id === company._id;
        item.className = `chat-company-item ${isActive ? "active" : ""}`;
        item.innerHTML = `
            <div class="chat-company-avatar">${(company.company_name || "C").charAt(0).toUpperCase()}</div>
            <div class="chat-company-details">
                <strong>${escapeHtml(company.company_name)}</strong>
                <small>${escapeHtml(company.last_message || "📍 " + (company.city || "Verified"))}</small>
            </div>
            ${company.unread_count > 0 ? `<span class="chat-unread-badge">${company.unread_count}</span>` : ""}
        `;
        item.addEventListener("click", () => selectChatCompany(company));
        chatCompanyList.appendChild(item);
    });
}

// Select a company to chat with
async function selectChatCompany(company) {
    activeChatCompany = company;
    selectedCompany = company; // Sync with dashboard selection
    lastRenderedMessagesCount = 0;

    const name = company.company_name || "Company";
    chatActiveLogo.textContent = name.charAt(0).toUpperCase();
    chatActiveName.textContent = name;
    chatActiveMeta.textContent = `📍 ${company.city || "Verified"} | 📞 ${company.phone || "Direct Support"}`;

    renderChatCompaniesList(chatCompanySearch.value);
    await loadChatHistory();
}

// Load conversation history with active company
async function loadChatHistory(silent = false) {
    if (!activeChatCompany) return;

    try {
        const response = await fetch(`/api/chat/history/${activeChatCompany._id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!response.ok) return;
        const data = await response.json();
        const messages = data.messages || [];
        const activeRequest = data.active_request || null;

        // Render messages
        if (!silent || messages.length !== lastRenderedMessagesCount) {
            renderChatMessages(messages, activeRequest);
            lastRenderedMessagesCount = messages.length;
        }
    } catch (err) {
        console.error("Load chat history error:", err);
    }
}

// Immediate manual refresh for chat
async function refreshActiveChat() {
    if (!activeChatCompany) {
        showToast("Please select a company chat to refresh.");
        return;
    }
    const btn = document.getElementById("chatRefreshBtn");
    if (btn) {
        btn.disabled = true;
        btn.textContent = "⏳ Updating...";
    }
    try {
        lastRenderedMessagesCount = 0; // force re-render
        await loadChatHistory(false);
        showToast("Chat refreshed!");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = "🔄 Refresh";
        }
    }
}
window.refreshActiveChat = refreshActiveChat;

// Render message bubbles and interactive cards
function renderChatMessages(messages, activeRequest) {
    if (messages.length === 0) {
        chatMessages.innerHTML = `
            <div class="chat-placeholder">
                <div class="chat-placeholder-icon">🤖</div>
                <h4>Chat with ${escapeHtml(activeChatCompany.company_name)}</h4>
                <p>Ask about services, worker availability, pricing, or click <strong>"📸 Request Quote"</strong> to send photos of damage!</p>
            </div>
        `;
        return;
    }

    chatMessages.innerHTML = "";

    messages.forEach(msg => {
        const row = document.createElement("div");
        row.className = `chat-bubble-row ${msg.sender_role}`;

        let avatarText = (msg.sender_name || "U").charAt(0).toUpperCase();
        let isBot = msg.sender_role === "bot";
        if (isBot) avatarText = "🤖";

        const timeStr = new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

        let innerContent = `
            <div class="chat-bubble-avatar ${isBot ? "bot-avatar" : ""}">${avatarText}</div>
            <div class="chat-bubble-content">
                <span class="chat-sender-tag">${escapeHtml(msg.sender_name)}</span>
                <div class="chat-bubble">
                    ${escapeHtml(msg.message)}
                    ${renderMessageCard(msg, activeRequest)}
                </div>
                <span class="chat-bubble-time">${timeStr}</span>
            </div>
        `;

        row.innerHTML = innerContent;
        chatMessages.appendChild(row);
    });

    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Render rich interactive card inside chat bubbles
function renderMessageCard(msg, activeRequest) {
    if (!msg.msg_type || msg.msg_type === "text") return "";

    // 1. Quotation Card
    if (msg.msg_type === "quotation" && msg.metadata) {
        const q = msg.metadata;
        const reqId = msg.request_id || (activeRequest ? activeRequest._id : "");
        const isPending = activeRequest && activeRequest.status === "quoted";

        return `
            <div class="chat-card quotation-card">
                <div class="chat-card-header">📋 Formal Quotation Prepared</div>
                <div class="quote-grid">
                    <div class="quote-item">
                        <small>Workers</small>
                        <strong>👷 ${q.workers_needed || 0}</strong>
                    </div>
                    <div class="quote-item">
                        <small>Duration</small>
                        <strong>⏱️ ~${q.estimated_days || 0}d</strong>
                    </div>
                    <div class="quote-item">
                        <small>₹ / worker / day</small>
                        <strong>₹${q.labor_daily_rate || 0}</strong>
                    </div>
                    <div class="quote-item">
                        <small>Quoted labour</small>
                        <strong>₹${q.labor_total || q.estimated_cost || 0}</strong>
                    </div>
                </div>
                ${q.quotation_notes ? `<div class="quote-notes">💬 ${escapeHtml(q.quotation_notes)}</div>` : ""}
                ${isPending && reqId ? `
                    <div style="font-size:12px; color:#92400e; margin:8px 0;">Pay 50% (₹${halfQuoteAdvanceFromMeta(q)}) from wallet to continue. Remaining after work is done.</div>
                    <button class="card-action-btn" onclick="confirmQuotation('${reqId}')">
                        💳 Pay 50% & Confirm Quotation
                    </button>
                ` : `<div style="font-size:11px; color:#166534; font-weight:700;">✓ Quotation Received / Confirmed</div>`}
            </div>
        `;
    }

    // 2. Worker Details Card
    if (msg.msg_type === "worker_details" && msg.metadata && Array.isArray(msg.metadata.workers)) {
        const workers = msg.metadata.workers;
        return `
            <div class="chat-card worker-card">
                <div class="chat-card-header">👷 Assigned Technicians</div>
                <div class="chat-worker-list">
                    ${workers.map(w => `
                        <div class="chat-worker-item">
                            <span class="w-icon">👷</span>
                            <div class="w-info">
                                <strong>${escapeHtml(w.name)}</strong>
                                <small>📞 ${escapeHtml(w.phone || "Phone verified")} | Skills: ${escapeHtml((w.skills || []).join(", ") || "General")}</small>
                            </div>
                        </div>
                    `).join("")}
                </div>
            </div>
        `;
    }

    // 3. Daily Progress Card
    if (msg.msg_type === "daily_update" && msg.metadata) {
        const u = msg.metadata;
        return `
            <div class="chat-card" style="border-left: 4px solid #f59e0b; background:#fffbeb;">
                <div class="chat-card-header">📅 Day ${u.day_number} Work Log</div>
                <p style="font-size:13px; color:#1e293b; margin-bottom:8px;">${escapeHtml(u.work_done)}</p>
                ${u.photo ? `
                    <img src="${u.photo}" class="damage-photo-thumb" onclick="openLightbox('${u.photo}', 'Day ${u.day_number} Work Completed')" alt="Day ${u.day_number}">
                ` : ""}
            </div>
        `;
    }

    // 4. Final Invoice Card
    if (msg.msg_type === "invoice" && msg.metadata) {
        const inv = msg.metadata;
        const reqId = msg.request_id || (activeRequest ? activeRequest._id : "");
        const isUnpaid = inv.payment_status === "unpaid";

        return `
            <div class="chat-card" style="border-left: 4px solid #a855f7; background:#faf5ff;">
                <div class="chat-card-header">🧾 Final Invoice #${escapeHtml(inv.invoice_number || "")}</div>
                <div style="font-size:14px; font-weight:800; color:#7e22ce; margin-bottom:8px;">
                    Total Due: ₹${inv.total_amount || 0}
                </div>
                ${isUnpaid && reqId ? `
                    <button class="card-action-btn" style="background:#9333ea;" onclick="payInvoice('${reqId}')">
                        💳 Pay Remaining Amount
                    </button>
                ` : `<span style="color:#15803d; font-weight:700; font-size:12px;">✓ Paid in Full</span>`}
            </div>
        `;
    }

    // 5. Request Photos Card
    if (msg.msg_type === "request" && msg.metadata && Array.isArray(msg.metadata.photos)) {
        const photos = msg.metadata.photos;
        if (photos.length === 0) return "";
        return `
            <div class="chat-card" style="border-left: 4px solid #3b82f6;">
                <div class="chat-card-header">📷 Uploaded Damage Photos (${photos.length})</div>
                <div class="damage-photos-gallery">
                    ${photos.map(p => `
                        <img src="${p}" class="damage-photo-thumb" onclick="openLightbox('${p}', 'Inspection Photo')" alt="Damage">
                    `).join("")}
                </div>
            </div>
        `;
    }

    // 6. Daily Update Complaint Card
    if (msg.msg_type === "complaint" && msg.metadata) {
        const c = msg.metadata;
        return `
            <div class="chat-card" style="border-left: 4px solid #dc2626; background:#fef2f2;">
                <div class="chat-card-header" style="color:#991b1b;">⚠️ Complaint Logged on Day ${c.day_number || ""}</div>
                <p style="font-size:13px; color:#7f1d1d; margin:6px 0;">"${escapeHtml(c.complaint_text || msg.message || "")}"</p>
                <small style="color:#b91c1c; font-weight:600;">Notified to company and assigned technicians</small>
            </div>
        `;
    }

    // 7. Date Change Proposal Card
    if (msg.msg_type === "date_reschedule_proposal" && msg.metadata) {
        const p = msg.metadata;
        const reqId = msg.request_id || (activeRequest ? activeRequest._id : "");
        return `
            <div class="chat-card" style="border-left: 4px solid #f97316; background:#fff7ed;">
                <div class="chat-card-header" style="color:#c2410c;">⚠️ Schedule Modification Request</div>
                <p style="font-size:13px; color:#9a3412; margin:6px 0;">
                    Company requested new dates: <strong>${escapeHtml(p.proposed_start_date || "")}</strong> to <strong>${escapeHtml(p.proposed_end_date || "")}</strong> (~${p.estimated_days || 1}d) due to technician availability.
                </p>
                ${p.reason ? `<div style="font-size:12px; color:#7c2d12; margin-bottom:8px; font-style:italic;">Reason: "${escapeHtml(p.reason)}"</div>` : ""}
                ${reqId ? `
                    <div style="display:flex; gap:8px; margin-top:8px;">
                        <button class="card-action-btn" style="background:#16a34a; flex:1; padding:8px 12px;" onclick="respondDateChange('${reqId}', true)">
                            ✓ Accept New Dates
                        </button>
                        <button class="card-action-btn" style="background:#dc2626; flex:1; padding:8px 12px;" onclick="respondDateChange('${reqId}', false)">
                            ✗ Decline
                        </button>
                    </div>
                ` : ""}
            </div>
        `;
    }

    return "";
}

async function respondDateChange(requestId, accept) {
    if (!requestId) return;
    const confirmPrompt = accept
        ? "Accept modified work schedule proposed by company?"
        : "Decline proposed date change?";
    if (!confirm(confirmPrompt)) return;

    try {
        const response = await fetch(`/api/customer/requests/${requestId}/respond-date-change`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ accept })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Failed to respond to date change.");

        showToast(data.message || "Schedule updated!", "success");
        if (typeof loadCustomerRequests === "function") await loadCustomerRequests();
        if (typeof refreshActiveChat === "function") await refreshActiveChat();
    } catch (err) {
        showToast(err.message || "Failed to update schedule.", "error");
    }
}
window.respondDateChange = respondDateChange;

// Send Message via Chat Input Form
chatInputForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = chatInputText.value.trim();
    if (!text || !activeChatCompany) return;

    chatInputText.value = "";

    try {
        const response = await fetch("/api/chat/send", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
                company_id: activeChatCompany._id,
                message: text
            })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.message || "Failed to send message.");
        }

        await loadChatHistory();
        await loadChatCompanies();
    } catch (err) {
        showToast(err.message);
    }
});

// Suggestion Chips Click
chatSuggestionChips.addEventListener("click", (e) => {
    const btn = e.target.closest(".chip-btn");
    if (!btn || !activeChatCompany) return;

    const queryType = btn.dataset.query;
    let queryText = "";

    if (queryType === "services") queryText = "What services do you offer?";
    else if (queryType === "workers") queryText = "Tell me about your workers and experience.";
    else if (queryType === "pricing") queryText = "How do you calculate pricing and quotations?";
    else if (queryType === "contact") queryText = "What is your contact number and office address?";
    else if (queryType === "status") queryText = "What is the status of my service request?";

    if (queryText) {
        chatInputText.value = queryText;
        chatInputForm.dispatchEvent(new Event("submit"));
    }
});

// Attach Photo Shortcut Button -> Opens Service Request Form
chatAttachPhotoBtn.addEventListener("click", () => {
    if (!activeChatCompany) {
        showToast("Please select a company first.");
        return;
    }
    openRequestModalForCompany(activeChatCompany);
});

chatRequestQuoteBtn.addEventListener("click", () => {
    if (!activeChatCompany) {
        showToast("Please select a company first.");
        return;
    }
    openRequestModalForCompany(activeChatCompany);
});

function openRequestModalForCompany(company) {
    selectedCompany = company;
    document.getElementById("requestCompanyName").textContent = company.company_name;

    const select = document.getElementById("requestService");
    select.innerHTML = `<option value="">Select Service</option>`;
    const services = Array.isArray(company.services) ? company.services : [];
    services.forEach(service => {
        const opt = document.createElement("option");
        opt.value = service;
        opt.textContent = `${serviceIcon(service)} ${service}`;
        select.appendChild(opt);
    });

    chatbotModal.classList.remove("show");
    const prefDateInput = document.getElementById("preferredDate");
    if (prefDateInput) prefDateInput.min = new Date().toISOString().split("T")[0];
    requestModal.classList.add("show");
}

// Company Search Filter
chatCompanySearch.addEventListener("input", (e) => {
    renderChatCompaniesList(e.target.value.trim());
});

// Floating Chat FAB Click
floatingChatFab.addEventListener("click", openChatbotModal);

// Sidebar Messages Button Click
document.getElementById("messagesBtn").addEventListener("click", openChatbotModal);

// Modal "Chat with Company" Button Click
document.getElementById("modalChatBtn").addEventListener("click", () => {
    if (selectedCompany) {
        companyModal.classList.remove("show");
        openChatWithCompany(selectedCompany._id);
    }
});

// Update Unread Badge Count
async function updateUnreadBadge() {
    let totalUnread = chatCompanies.reduce((sum, c) => sum + (c.unread_count || 0), 0);
    if (totalUnread > 0) {
        fabUnreadBadge.textContent = totalUnread;
        fabUnreadBadge.style.display = "inline-block";
    } else {
        fabUnreadBadge.style.display = "none";
    }
}


// ===================================================
// MY SERVICE REQUESTS & TRACKING LOGIC
// ===================================================

const myRequestsModal = document.getElementById("myRequestsModal");
const closeMyRequestsModal = document.getElementById("closeMyRequestsModal");
const myRequestsContainer = document.getElementById("myRequestsContainer");
const requestCountEl = document.getElementById("requestCount");

let currentRequestsView = "current"; // 'current' or 'completed'

const currentRequestsBtn = document.getElementById("currentRequestsBtn");
if (currentRequestsBtn) {
    currentRequestsBtn.addEventListener("click", () => {
        switchRequestsView("current");
        myRequestsModal.classList.add("show");
    });
}

document.getElementById("requestsBtn").addEventListener("click", () => {
    switchRequestsView("completed");
    myRequestsModal.classList.add("show");
});
closeMyRequestsModal.addEventListener("click", () => myRequestsModal.classList.remove("show"));

function switchRequestsView(view) {
    currentRequestsView = view;
    const tabCur = document.getElementById("tabCurrentReqs");
    const tabComp = document.getElementById("tabCompletedReqs");
    const title = document.getElementById("requestsModalTitle");

    if (view === "current") {
        if (tabCur) { tabCur.style.background = "#2563eb"; tabCur.style.color = "#ffffff"; }
        if (tabComp) { tabComp.style.background = "#f1f5f9"; tabComp.style.color = "#475569"; }
        if (title) title.textContent = "⚡ Current Ongoing Requests";
    } else {
        if (tabCur) { tabCur.style.background = "#f1f5f9"; tabCur.style.color = "#475569"; }
        if (tabComp) { tabComp.style.background = "#2563eb"; tabComp.style.color = "#ffffff"; }
        if (title) title.textContent = "📋 My Requests (Completed Archives)";
    }
    loadMyRequests();
}
window.switchRequestsView = switchRequestsView;

async function openMyRequestsModal() {
    myRequestsModal.classList.add("show");
    await loadMyRequests();
}

async function loadMyRequestsCount() {
    try {
        const response = await fetch("/api/customer/requests", {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!response.ok) return;
        const data = await response.json();
        const all = data.requests || [];
        const ongoing = all.filter(r => r.status !== "completed" && r.status !== "cancelled");
        const completed = all.filter(r => r.status === "completed" || r.status === "cancelled");

        if (requestCountEl) requestCountEl.textContent = completed.length;
        const curCountEl = document.getElementById("currentRequestCount");
        if (curCountEl) curCountEl.textContent = ongoing.length;

        const tabCurCount = document.getElementById("tabCurrentReqsCount");
        const tabCompCount = document.getElementById("tabCompletedReqsCount");
        if (tabCurCount) tabCurCount.textContent = ongoing.length;
        if (tabCompCount) tabCompCount.textContent = completed.length;
    } catch (e) {}
}

let cachedMyRequests = [];

async function loadMyRequests() {
    try {
        myRequestsContainer.innerHTML = `
            <div class="loading">
                <div class="spinner"></div>
                <p>Loading your ${currentRequestsView === "current" ? "ongoing" : "completed"} requests & live tracking...</p>
            </div>
        `;

        const response = await fetch("/api/customer/requests", {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!response.ok) throw new Error("Unable to fetch requests.");
        const data = await response.json();
        const allRequests = data.requests || [];
        cachedMyRequests = allRequests;

        const ongoing = allRequests.filter(r => r.status !== "completed" && r.status !== "cancelled");
        const completed = allRequests.filter(r => r.status === "completed" || r.status === "cancelled");

        if (requestCountEl) requestCountEl.textContent = completed.length;
        const curCountEl = document.getElementById("currentRequestCount");
        if (curCountEl) curCountEl.textContent = ongoing.length;

        const tabCurCount = document.getElementById("tabCurrentReqsCount");
        const tabCompCount = document.getElementById("tabCompletedReqsCount");
        if (tabCurCount) tabCurCount.textContent = ongoing.length;
        if (tabCompCount) tabCompCount.textContent = completed.length;

        const filtered = currentRequestsView === "current" ? ongoing : completed;

        if (filtered.length === 0) {
            myRequestsContainer.innerHTML = `
                <div class="empty">
                    <h3>No ${currentRequestsView === "current" ? "ongoing" : "completed"} requests found</h3>
                    <p>${currentRequestsView === "current" 
                        ? 'Select any verified company and click <strong>"Request Quote with Photo"</strong> to book a service!' 
                        : 'Your finalized jobs will be safely archived here for your reference.'}</p>
                </div>
            `;
            return;
        }

        renderMyRequestsList(filtered);
    } catch (err) {
        myRequestsContainer.innerHTML = `<div class="empty"><h3>Failed to load requests</h3><p>${err.message}</p></div>`;
    }
}

function renderMyRequestsList(requests) {
    myRequestsContainer.innerHTML = "";

    requests.forEach(req => {
        const card = document.createElement("div");
        card.className = "tracking-card";

        const compName = req.company_name || (req.company_id ? req.company_id.company_name : "Service Company");
        const dateStr = new Date(req.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        const compId = req.company_id ? (req.company_id._id || req.company_id) : "";

        // Check in / Check out display
        let attendanceHtml = "";
        if (req.time_tracking && (req.time_tracking.check_in_time || req.time_tracking.check_out_time)) {
            const inTime = req.time_tracking.check_in_time ? new Date(req.time_tracking.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Not yet";
            const outTime = req.time_tracking.check_out_time ? new Date(req.time_tracking.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "On site";
            attendanceHtml = `
                <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:10px 12px; margin:8px 0; font-size:12px; display:flex; gap:16px; align-items:center;">
                    <span style="font-size:18px;">⏱️</span>
                    <div>
                        <strong style="color:#166534;">Daily Worker Attendance:</strong>
                        <span style="color:#1e293b; margin-left:8px;">Check-In: <strong>${inTime}</strong></span>
                        <span style="color:#1e293b; margin-left:12px;">Check-Out: <strong>${outTime}</strong></span>
                        ${req.time_tracking.total_minutes ? `<span style="color:#047857; margin-left:12px;">(Duration: ${req.time_tracking.total_minutes} mins)</span>` : ""}
                    </div>
                </div>
            `;
        }

        card.innerHTML = `
            <div class="tracking-card-header">
                <div class="tracking-company-row">
                    <div class="tracking-logo">${compName.charAt(0).toUpperCase()}</div>
                    <div class="tracking-meta">
                        <h3>${escapeHtml(compName)} — <span style="color:#2563eb;">${escapeHtml(req.service)}</span></h3>
                        <small>Submitted on ${dateStr} • Priority: <strong style="text-transform:capitalize;">${escapeHtml(req.priority)}</strong> • 📍 ${escapeHtml(req.service_address)}</small>
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                    <span class="status-pill ${req.status}">${formatStatus(req.status)}</span>
                    ${(req.status === "completed" || req.status === "cancelled") ? `
                        <button class="chat-card-btn" style="background:#fee2e2; color:#b91c1c; border-color:#fca5a5; padding:4px 8px; font-size:11px;" onclick="deleteCustomerRequest('${req._id}')" title="Delete this completed record">
                            🗑️ Delete Record
                        </button>
                    ` : ""}
                </div>
            </div>

            <!-- Worker Attendance Bar -->
            ${attendanceHtml}

            <!-- Stepper Progress Tracker -->
            ${renderStepper(req.status)}

            <!-- Problem Description -->
            <div style="background:#f8fafc; padding:12px; border-radius:8px; font-size:13px; color:#334155;">
                <strong>Problem Details:</strong> ${escapeHtml(req.description)}
            </div>

            <!-- Real-Life Job Schedule & Materials Requisitions -->
            ${renderJobExecutionOverview(req)}

            <!-- Uploaded Damage Photos -->
            ${req.photos && req.photos.length > 0 ? `
                <div>
                    <label style="font-size:12px; font-weight:700; color:#475569; display:block; margin-bottom:6px;">
                        📷 Submitted Damage Photos (${req.photos.length}):
                    </label>
                    <div class="damage-photos-gallery">
                        ${req.photos.map(p => `
                            <img src="${p}" class="damage-photo-thumb" onclick="openLightbox('${p}', 'Damage Inspection Photo')" alt="Damage">
                        `).join("")}
                    </div>
                </div>
            ` : ""}

            <!-- Formal Quotation Section -->
            ${renderQuotationSection(req)}

            <!-- Allocated Workers Section -->
            ${renderWorkersSection(req)}

            <!-- Secure On-Site OTP PIN, Inspection & Warranty Section -->
            ${renderOtpAndInspectionSection(req)}

            <!-- Daily Work Updates Section -->
            ${renderDailyUpdatesSection(req)}

            <!-- Final Invoice -->
            ${renderInvoiceSection(req)}

            ${req.status === "completed" ? renderReviewSection(req) : ""}

            <!-- Action Buttons -->
            <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:8px;">
                <button class="chat-card-btn" onclick="openChatWithCompany('${compId}')">
                    💬 Chat with ${escapeHtml(compName)}
                </button>
            </div>
        `;

        myRequestsContainer.appendChild(card);
    });
}


function formatStatus(status) {
    if (status === "requested") return "⏳ Reviewing Request";
    if (status === "quoted") return "📋 Quotation Ready";
    if (status === "confirmed") return "✅ Confirmed";
    if (status === "workers_assigned") return "👷 Workers Assigned";
    if (status === "in_progress") return "🔨 In Progress";
    if (status === "work_submitted") return "🔍 Inspection Needed";
    if (status === "rework_needed") return "⚠️ Rework in Progress";
    if (status === "completed") return "🎉 Work Completed & Verified";
    return status;
}

// Render Multi-Step Stepper Pipeline (including On-Site Inspection & Verification)
function renderStepper(status) {
    const steps = [
        { key: "requested", label: "Requested" },
        { key: "quoted", label: "Quoted" },
        { key: "confirmed", label: "Confirmed" },
        { key: "workers_assigned", label: "Workers Assigned" },
        { key: "in_progress", label: "In Progress" },
        { key: "work_submitted", label: "Inspection" },
        { key: "completed", label: "Verified & Warranty" }
    ];

    const order = ["requested", "quoted", "confirmed", "workers_assigned", "in_progress", "work_submitted", "completed"];
    let effectiveStatus = status;
    if (status === "rework_needed") effectiveStatus = "in_progress";
    const curIdx = order.indexOf(effectiveStatus);

    const percent = curIdx >= 0 ? (curIdx / (steps.length - 1)) * 100 : 0;

    return `
        <div class="stepper-pipeline">
            <div class="stepper-line">
                <div class="stepper-line-fill" style="width: ${percent}%;"></div>
            </div>
            ${steps.map((s, idx) => {
                const isCompleted = curIdx > idx;
                const isActive = curIdx === idx;
                const stateClass = isCompleted ? "completed" : (isActive ? "active" : "");
                return `
                    <div class="step-node ${stateClass}">
                        <div class="step-circle">${isCompleted ? "✓" : idx + 1}</div>
                        <span class="step-title">${s.label}</span>
                    </div>
                `;
            }).join("")}
        </div>
    `;
}

// Render Formal Quotation Section with Scheduled Start & End Dates
function renderQuotationSection(req) {
    if (!req.quotation || (!req.quotation.estimated_cost && !req.quotation.labor_daily_rate && req.quotation.labor_daily_rate !== 0 && !req.quotation.workers_needed)) {
        return `
            <div style="background:#fef3c7; border:1px solid #fde68a; border-radius:10px; padding:12px; font-size:13px; color:#92400e;">
                ⏳ <strong>Awaiting Company Quotation:</strong> The company is evaluating your request and will provide scheduled work dates, required technicians, and estimated cost shortly.
            </div>
        `;
    }

    const q = req.quotation;
    const isQuoted = req.status === "quoted";
    const startDate = q.start_date || req.start_date;
    const endDate = q.end_date || req.end_date;
    const dailyRate = Number(q.labor_daily_rate || 0);
    const laborTotal = Number(q.labor_total || q.estimated_cost || 0);
    const halfAdvance = getHalfAdvanceAmount(req);
    const advancePaid = Number(req.booking_advance_paid || q.advance_paid || 0);

    return `
        <div class="quotation-banner">
            <div class="quotation-banner-header">
                <strong>📋 Formal Quotation from Company</strong>
                <span style="font-size:11px; color:#15803d; font-weight:700;">
                    ${req.customer_confirmed ? "✓ CONFIRMED BY YOU" : "PENDING YOUR ACCEPTANCE"}
                </span>
            </div>

            ${startDate ? `
                <div style="background:#eff6ff; color:#1e40af; padding:8px 12px; border-radius:8px; font-size:13px; margin:8px 0; border-left:4px solid #2563eb;">
                    📅 <strong>Scheduled Execution Window:</strong> <strong>${startDate}</strong> to <strong>${endDate || 'Completion'}</strong>
                </div>
            ` : ""}

            <div class="quotation-stats-row">
                <div class="q-stat">
                    <small>Required Workers</small>
                    <strong>👷 ${q.workers_needed} Worker(s)</strong>
                </div>
                <div class="q-stat">
                    <small>Estimated Duration</small>
                    <strong>⏱️ ~${q.estimated_days} Day(s)</strong>
                </div>
                <div class="q-stat">
                    <small>Labour / worker / day</small>
                    <strong>₹${dailyRate}</strong>
                </div>
                <div class="q-stat">
                    <small>Quoted labour</small>
                    <strong>₹${laborTotal}</strong>
                </div>
            </div>
            <p style="font-size:12px; color:#64748b; margin:8px 0 0;">Quoted labour only. Cement, pipes and other parts used on site are added on the final bill.</p>
            <div style="background:#fff7ed; border:1px solid #fdba74; border-radius:8px; padding:10px; margin-top:10px; font-size:13px; color:#9a3412;">
                <strong>Payment to continue:</strong> 50% advance ₹${halfAdvance} must be paid from your wallet.
                Remaining 50% (plus on-site parts) is due after work is completed.
                ${advancePaid > 0 ? `<div style="margin-top:4px; color:#166534;">✓ Advance paid: ₹${advancePaid}</div>` : ""}
            </div>
            ${q.quotation_notes ? `
                <div style="font-size:13px; color:#166534; background:#ffffff; padding:10px; border-radius:8px; border:1px solid #bbf7d0;">
                    <strong>Company Notes:</strong> ${escapeHtml(q.quotation_notes)}
                </div>
            ` : ""}
            ${isQuoted ? `
                <button class="confirm-quote-btn" onclick="confirmQuotation('${req._id}')">
                    💳 Pay 50% (₹${halfAdvance}) & continue
                </button>
            ` : ""}
        </div>
    `;
}

// Action: Customer accepts & confirms quotation
function getQuotedTotal(req) {
    return Number(req?.quotation?.estimated_cost || req?.quotation?.labor_total || 0);
}

function getHalfAdvanceAmount(req) {
    return Number((getQuotedTotal(req) * 0.5).toFixed(2));
}

function halfQuoteAdvanceFromMeta(q) {
    const inner = q?.quotation || q || {};
    const total = Number(inner.estimated_cost || inner.labor_total || q?.estimated_cost || q?.labor_total || 0);
    return Number((total * 0.5).toFixed(2));
}

function getAlreadyPaidAmount(req) {
    return Number(req?.booking_advance_paid || req?.quotation?.advance_paid || 0);
}

function getRemainingDue(req) {
    if (isJobFullyPaid(req)) return 0;
    const total = Number(req?.invoice?.total_amount || getQuotedTotal(req) || 0);
    return Number(Math.max(0, total - getAlreadyPaidAmount(req)).toFixed(2));
}

function isJobFullyPaid(req) {
    return !!(req?.invoice && req.invoice.payment_status === "paid");
}

async function confirmQuotation(requestId) {
    if (!requestId) {
        showToast("Invalid service request ID.");
        return;
    }
    const req = (typeof cachedMyRequests !== "undefined" ? cachedMyRequests : []).find((r) => r._id === requestId);
    const halfAdvance = req ? getHalfAdvanceAmount(req) : 0;

    if (typeof loadWalletBalance === "function") {
        await loadWalletBalance();
    }

    if (halfAdvance > 0 && typeof currentWalletBalance !== "undefined" && currentWalletBalance < halfAdvance) {
        if (typeof promptWalletRecharge === "function") {
            promptWalletRecharge(halfAdvance, `Insufficient wallet balance. Recharge to pay 50% advance of ₹${halfAdvance}.`);
        } else {
            showToast(`Insufficient wallet balance. Recharge to pay 50% advance of ₹${halfAdvance}.`);
        }
        return;
    }

    const confirmed = confirm(`Pay 50% advance of ₹${halfAdvance} from your wallet to confirm this quotation and continue?`);
    if (!confirmed) return;

    if (typeof showProcessingOverlay === "function") {
        showProcessingOverlay(`Waiting for payment of ₹${halfAdvance}...`, "Waiting for payment");
        if (typeof simulateProcessingBar === "function") simulateProcessingBar(6);
    }

    try {
        const response = await fetch(`/api/customer/requests/${requestId}/confirm`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            }
        });

        const data = await response.json();
        if (!response.ok) {
            if (typeof hideProcessingOverlay === "function") hideProcessingOverlay();
            if (data.insufficient_balance && typeof promptWalletRecharge === "function") {
                promptWalletRecharge(data.required_amount || halfAdvance, data.message);
                return;
            }
            throw new Error(data.message || "Failed to confirm quotation.");
        }

        if (typeof completeProcessingBar === "function") completeProcessingBar();
        await new Promise((resolve) => setTimeout(resolve, 400));
        if (typeof hideProcessingOverlay === "function") hideProcessingOverlay();
        if (typeof data.balance === "number" && typeof updateWalletDisplays === "function") {
            currentWalletBalance = data.balance;
            updateWalletDisplays(data.balance);
        } else if (typeof loadWalletBalance === "function") {
            await loadWalletBalance();
        }

        showToast("✅ 50% paid from wallet. Quotation confirmed. Remaining amount is due after work is completed.");
        await loadMyRequests();
        if (typeof loadChatHistory === "function" && typeof activeChatCompany !== "undefined" && activeChatCompany) {
            await loadChatHistory(true);
        }
    } catch (err) {
        if (typeof hideProcessingOverlay === "function") hideProcessingOverlay();
        console.error("Confirm quotation error:", err);
        showToast(err.message || "Failed to confirm quotation.");
    }
}
window.confirmQuotation = confirmQuotation;

async function payInvoice(requestId) {
    if (!requestId) {
        showToast("Invalid service request ID.");
        return;
    }

    const req = (typeof cachedMyRequests !== "undefined" ? cachedMyRequests : []).find((r) => r._id === requestId);
    if (!req) {
        showToast("Request not found. Please refresh and try again.");
        return;
    }

    if (req.status !== "completed") {
        showToast("Remaining payment is available only after the work is fully completed.");
        return;
    }

    if (isJobFullyPaid(req)) {
        showToast("This invoice is already paid in full.");
        return;
    }

    const remaining = getRemainingDue(req);
    if (typeof loadWalletBalance === "function") {
        await loadWalletBalance();
    }

    if (remaining > 0 && typeof currentWalletBalance !== "undefined" && currentWalletBalance < remaining) {
        if (typeof promptWalletRecharge === "function") {
            promptWalletRecharge(remaining, `Insufficient wallet balance. Recharge to pay remaining ₹${remaining}.`);
        } else {
            showToast(`Insufficient wallet balance. Recharge to pay remaining ₹${remaining}.`);
        }
        return;
    }

    if (!confirm(`Pay remaining ₹${remaining} from your wallet?`)) return;

    if (typeof showProcessingOverlay === "function") {
        showProcessingOverlay(`Waiting for payment of remaining ₹${remaining}...`, "Waiting for payment");
        if (typeof simulateProcessingBar === "function") simulateProcessingBar(6);
    }

    try {
        const response = await fetch(`/api/customer/requests/${requestId}/pay`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            }
        });
        const data = await response.json();
        if (!response.ok) {
            if (typeof hideProcessingOverlay === "function") hideProcessingOverlay();
            if (data.insufficient_balance && typeof promptWalletRecharge === "function") {
                promptWalletRecharge(data.required_amount || remaining, data.message);
                return;
            }
            throw new Error(data.message || "Failed to process remaining payment.");
        }

        if (typeof completeProcessingBar === "function") completeProcessingBar();
        await new Promise((resolve) => setTimeout(resolve, 400));
        if (typeof hideProcessingOverlay === "function") hideProcessingOverlay();
        if (typeof data.balance === "number" && typeof updateWalletDisplays === "function") {
            currentWalletBalance = data.balance;
            updateWalletDisplays(data.balance);
        } else if (typeof loadWalletBalance === "function") {
            await loadWalletBalance();
        }

        showToast("✅ Remaining amount paid. Review and complaint are now available.");
        await loadMyRequests();
        if (typeof loadChatHistory === "function" && typeof activeChatCompany !== "undefined" && activeChatCompany) {
            await loadChatHistory(true);
        }
    } catch (err) {
        if (typeof hideProcessingOverlay === "function") hideProcessingOverlay();
        showToast(err.message || "Failed to process remaining payment.");
    }
}
window.payInvoice = payInvoice;

// Render Allocated Workers Section with Substitution Notices
function renderWorkersSection(req) {
    if (!req.assigned_workers || req.assigned_workers.length === 0) return "";

    return `
        <div class="workers-allocated-card">
            <h4>👷 Allocated Service Technicians (${req.assigned_workers.length}):</h4>
            <div class="worker-pills">
                ${req.assigned_workers.map(w => `
                    <div class="worker-badge-item">
                        <span class="w-icon">👷</span>
                        <div>
                            <strong>${escapeHtml(w.name)}</strong>
                            <small>📞 ${escapeHtml(w.phone || "Verified")} • Skills: ${escapeHtml((w.skills || []).join(", ") || "Certified")}</small>
                        </div>
                    </div>
                `).join("")}
            </div>

            ${req.worker_replacements && req.worker_replacements.length > 0 ? `
                <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:10px; margin-top:10px; font-size:12px; color:#92400e;">
                    ${req.worker_replacements.map(rep => `
                        <div>🔄 <strong>Technician Replacement Notice:</strong> On ${rep.date}, technician <em>${escapeHtml(rep.original_worker_name)}</em> was on leave (${escapeHtml(rep.reason)}). Substitute technician <strong>${escapeHtml(rep.replacement_worker_name)}</strong> (📞 ${escapeHtml(rep.replacement_worker_phone)}) was assigned for that date.</div>
                    `).join("")}
                </div>
            ` : ""}
        </div>
    `;
}

// Real-Life Job Execution & On-Site Materials Overview
function renderJobExecutionOverview(req) {
    const startDate = req.start_date || (req.quotation ? req.quotation.start_date : null);
    const endDate = req.end_date || (req.quotation ? req.quotation.end_date : null);
    const requisitions = req.material_requisitions || [];

    if (!startDate && requisitions.length === 0) return "";

    return `
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px; margin:8px 0; font-size:13px;">
            ${startDate ? `
                <div style="color:#1e293b; margin-bottom:6px;">
                    📅 <strong>Service Dates:</strong> ${startDate} to ${endDate || 'Ongoing'}
                </div>
            ` : ""}

            ${requisitions.length > 0 ? `
                <div style="margin-top:6px; padding-top:6px; border-top:1px dashed #cbd5e1;">
                    <strong style="color:#0f172a;"><i class="fas fa-boxes"></i> Parts used on your job:</strong>
                    <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:4px;">
                        ${requisitions.map(m => `
                            <span style="background:#dcfce7; color:#14532d; padding:2px 8px; border-radius:12px; font-size:12px; border:1px solid #86efac;">
                                <strong>${escapeHtml(m.item_name)}</strong>: ${escapeHtml(m.quantity)}
                                <small style="color:#047857;">(${m.source === "local_purchase" ? "bought locally" : "van stock"})</small>
                            </span>
                        `).join("")}
                    </div>
                </div>
            ` : ""}
        </div>
    `;
}

// Render OTP Box, Dual Sign-Off Inspection & Digital Warranty Banner
function renderOtpAndInspectionSection(req) {
    let html = "";

    // Show 4-digit PIN during active work & inspection
    const showOtp = ["workers_assigned", "in_progress", "work_submitted"].includes(req.status);
    if (showOtp && req.completion_otp) {
        html += `
            <div class="otp-security-box">
                <div>
                    <small>🔒 YOUR SECURE 4-DIGIT ON-SITE COMPLETION PIN</small>
                    <div class="otp-code-text">${escapeHtml(req.completion_otp)}</div>
                </div>
                <div style="font-size:12px; color:#065f46; max-width:320px; text-align:right;">
                    Share this PIN with your technician <strong>only after</strong> you personally inspect and approve the completed repair.
                </div>
            </div>
        `;
    }

    // Work submitted — inspection required banner
    if (req.status === "work_submitted") {
        html += `
            <div style="background:#fefce8; border:2px solid #eab308; border-radius:12px; padding:16px; margin:12px 0;">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                    <div>
                        <strong style="color:#854d0e; font-size:15px; display:flex; align-items:center; gap:6px;">
                            🔔 Work Completed by Technician — On-Site Inspection Required!
                        </strong>
                        <p style="font-size:13px; color:#a16207; margin-top:4px;">
                            The technician has submitted repair photos. Please physically inspect the work before signing off.
                        </p>
                    </div>
                    <button class="confirm-quote-btn" style="background:#ca8a04; padding:10px 18px;" onclick="openInspectionModal('${req._id}')">
                        🔍 Inspect Work & Sign Off →
                    </button>
                </div>

                <!-- Before vs After photo comparison preview -->
                ${renderBeforeAfterPreview(req)}
            </div>
        `;
    }

    // Rework requested banner
    if (req.status === "rework_needed" || req.rework_requested) {
        html += `
            <div style="background:#fff1f2; border:1px solid #fda4af; border-radius:10px; padding:12px; margin:12px 0; font-size:13px; color:#9f1239;">
                <strong>⚠️ Free Rework / Revision Requested:</strong>
                <p style="margin-top:4px;">"${escapeHtml(req.rework_notes || "Correction requested.")}"</p>
                <small style="color:#be123c; margin-top:4px; display:block;">The company and technician have been alerted and will address the issues at zero additional cost.</small>
            </div>
        `;
    }

    // Invoice Banner if completed with invoice
    if (req.status === "completed" && req.invoice && req.invoice.total_amount) {
        html += `
            <div style="background:linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border:1px solid #bae6fd; border-radius:12px; padding:14px; margin:12px 0; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                <div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-size:22px;">🧾</span>
                        <div>
                            <strong style="color:#0369a1; font-size:14px;">${req.invoice.payment_status === "paid" ? "Invoice Paid in Full" : "Pay remaining amount to continue"}</strong>
                            <small style="display:block; color:#0284c7; font-weight:700;">Total: ₹${req.invoice.total_amount} · Remaining: ₹${getRemainingDue(req)}</small>
                            ${req.invoice.payment_status === "paid"
                                ? (`${!(req.company_review && req.company_review.rating) ? `<small style="display:block; color:#075985; margin-top:4px;">You can now rate the company, workers, and products or raise a complaint.</small>` : ""}`)
                                : `<small style="display:block; color:#075985; margin-top:4px;">Review and complaint unlock only after the remaining amount is paid from your wallet.</small>`}
                        </div>
                    </div>
                </div>
                <div style="display:flex; gap:8px;">
                    <button class="chat-card-btn" style="background:#0284c7; color:#ffffff; border:none;" onclick="openTaxInvoiceModal('${req._id}')">
                        🧾 View Tax Invoice
                    </button>
                </div>
            </div>
        `;
    }

    return html;
}

function renderBeforeAfterPreview(req) {
    const beforePhoto = (req.photos && req.photos[0]) || "";
    const afterPhoto = (req.after_photos && req.after_photos[0]) || "";
    if (!beforePhoto && !afterPhoto) return "";

    return `
        <div class="before-after-grid" style="margin-top:12px;">
            <div class="photo-compare-box">
                <div class="compare-label before">
                    <span>BEFORE REPAIR</span>
                    <span>Initial Damage</span>
                </div>
                <div class="compare-img-wrap" onclick="openLightbox('${beforePhoto}', 'Before Repair - Customer Upload')">
                    ${beforePhoto ? `<img src="${beforePhoto}" alt="Before Repair">` : `<div style="padding:20px; color:#94a3b8;">No photo</div>`}
                </div>
            </div>
            <div class="photo-compare-box">
                <div class="compare-label after">
                    <span>AFTER REPAIR</span>
                    <span>Technician Proof</span>
                </div>
                <div class="compare-img-wrap" onclick="openLightbox('${afterPhoto}', 'After Repair - Technician Proof')">
                    ${afterPhoto ? `<img src="${afterPhoto}" alt="After Repair">` : `<div style="padding:20px; color:#94a3b8;">No photo</div>`}
                </div>
            </div>
        </div>
    `;
}

// Render Daily Work Updates Timeline
function renderDailyUpdatesSection(req) {
    if (!req.daily_updates || req.daily_updates.length === 0) return "";

    return `
        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <h4 style="font-size:14px; margin:0; color:#1e293b;">📅 Daily Work Progress & Attendance:</h4>
            </div>
            <div class="daily-log-timeline">
                ${req.daily_updates.map(u => {
                    const resp = u.customer_response || {};
                    const hasResp = resp.has_complaint !== undefined && resp.responded_at;
                    return `
                        <div class="daily-log-item" style="border-left:3px solid ${resp.has_complaint ? '#ef4444' : '#22c55e'}; padding-left:12px; margin-bottom:14px;">
                            <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:6px;">
                                <strong>Day ${u.day_number} (${escapeHtml(u.date)}): ${escapeHtml(u.title || "Work in Progress")}</strong>
                                <span style="font-size:11px; color:#64748b;">Logged by: <strong>${escapeHtml(u.logged_by_worker_name || 'Technician')}</strong></span>
                            </div>
                            <p style="margin:6px 0; color:#334155;">${escapeHtml(u.work_done)}</p>
                            ${u.photo ? `
                                <img src="${u.photo}" class="damage-photo-thumb" style="margin-top:6px;" onclick="openLightbox('${u.photo}', 'Day ${u.day_number} Progress Photo')" alt="Day ${u.day_number}">
                            ` : ""}

                            <!-- Customer Review / Complaint Action on Daily Update -->
                            <div style="margin-top:10px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:8px 12px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
                                <div style="font-size:12px;">
                                    ${hasResp ? (
                                        resp.has_complaint
                                            ? `<span style="color:#b91c1c; font-weight:700;">⚠️ Complaint Logged: "${escapeHtml(resp.complaint_text)}"</span>`
                                            : `<span style="color:#15803d; font-weight:700;">✅ Approved: You confirmed this day's work is OK.</span>`
                                    ) : `
                                        <span style="color:#475569;">Is today's work satisfactory?</span>
                                    `}
                                </div>
                                ${!hasResp ? `
                                    <div style="display:flex; gap:8px;">
                                        <button class="card-action-btn" style="background:#16a34a; color:#fff; font-size:11px; padding:4px 10px;" onclick="approveDailyUpdate('${req._id}', ${u.day_number})">
                                            ✓ OK (Approve)
                                        </button>
                                        <button class="card-action-btn" style="background:#dc2626; color:#fff; font-size:11px; padding:4px 10px;" onclick="openDailyComplaintModal('${req._id}', ${u.day_number})">
                                            ⚠️ Raise Complaint
                                        </button>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    `;
                }).join("")}
            </div>
        </div>
    `;
}


// Render Final Invoice & Review Section with Granular Materials and Labor Tables
function renderInvoiceSection(req) {
    if (!req.invoice || !req.invoice.total_amount) return "";

    const inv = req.invoice;
    const isPaid = inv.payment_status === "paid";

    return `
        <div class="final-invoice-box">
            <div class="invoice-header">
                <strong>🧾 Official Service Invoice #${escapeHtml(inv.invoice_number || 'INV')}</strong>
                <span class="status-pill ${isPaid ? 'completed' : 'quoted'}">
                    ${isPaid ? '✓ PAID IN FULL' : 'PENDING PAYMENT'}
                </span>
            </div>

            <!-- Granular Itemized Materials (e.g. UltraTech Cement, Pipes, etc.) -->
            ${inv.materials_items && inv.materials_items.length > 0 ? `
                <div style="margin:12px 0 8px 0;">
                    <strong style="font-size:12px; color:#475569; display:block; margin-bottom:4px;">🧱 Itemized Materials & Supplies:</strong>
                    <table style="width:100%; border-collapse:collapse; font-size:12px; background:#f8fafc; border-radius:6px; overflow:hidden;">
                        <thead>
                            <tr style="background:#f1f5f9; text-align:left; color:#475569; border-bottom:1px solid #e2e8f0;">
                                <th style="padding:6px;">Item Name</th>
                                <th style="padding:6px;">Quantity</th>
                                <th style="padding:6px; text-align:right;">Unit Price</th>
                                <th style="padding:6px; text-align:right;">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${inv.materials_items.map(m => `
                                <tr style="border-bottom:1px dashed #e2e8f0;">
                                    <td style="padding:6px; font-weight:600; color:#1e293b;">${escapeHtml(m.item_name)}</td>
                                    <td style="padding:6px; color:#64748b;">${escapeHtml(m.quantity)}</td>
                                    <td style="padding:6px; text-align:right; color:#64748b;">₹${m.unit_price}</td>
                                    <td style="padding:6px; text-align:right; font-weight:700; color:#0f172a;">₹${m.total_price}</td>
                                </tr>
                            `).join('')}
                            <tr style="background:#f8fafc;">
                                <td colspan="3" style="padding:6px; text-align:right; font-weight:700; color:#166534;">Materials Subtotal:</td>
                                <td style="padding:6px; text-align:right; font-weight:700; color:#166534;">₹${inv.materials_total || 0}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            ` : ""}

            <!-- Granular Technician Labor Breakdown -->
            ${inv.labor_items && inv.labor_items.length > 0 ? `
                <div style="margin:8px 0 12px 0;">
                    <strong style="font-size:12px; color:#475569; display:block; margin-bottom:4px;">👷 Technician Labor Rates:</strong>
                    <table style="width:100%; border-collapse:collapse; font-size:12px; background:#f8fafc; border-radius:6px; overflow:hidden;">
                        <thead>
                            <tr style="background:#f1f5f9; text-align:left; color:#475569; border-bottom:1px solid #e2e8f0;">
                                <th style="padding:6px;">Technician</th>
                                <th style="padding:6px;">Days</th>
                                <th style="padding:6px; text-align:right;">Daily Rate</th>
                                <th style="padding:6px; text-align:right;">Labor Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${inv.labor_items.map(l => `
                                <tr style="border-bottom:1px dashed #e2e8f0;">
                                    <td style="padding:6px; font-weight:600; color:#1e293b;">${escapeHtml(l.worker_name)} <small style="color:#64748b;">(${escapeHtml(l.role || 'Tech')})</small></td>
                                    <td style="padding:6px; color:#64748b;">${l.days} Day(s)</td>
                                    <td style="padding:6px; text-align:right; color:#64748b;">₹${l.daily_rate}/day</td>
                                    <td style="padding:6px; text-align:right; font-weight:700; color:#0f172a;">₹${l.total_labor}</td>
                                </tr>
                            `).join('')}
                            <tr style="background:#f8fafc;">
                                <td colspan="3" style="padding:6px; text-align:right; font-weight:700; color:#1e40af;">Labor Subtotal:</td>
                                <td style="padding:6px; text-align:right; font-weight:700; color:#1e40af;">₹${inv.labor_total || 0}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            ` : ""}

            <table class="invoice-table">
                ${!inv.labor_items || inv.labor_items.length === 0 ? `
                    <tr>
                        <td>Labor & Worker Fees:</td>
                        <td style="text-align:right;">₹${inv.labor_cost || 0}</td>
                    </tr>
                ` : ""}
                ${!inv.materials_items || inv.materials_items.length === 0 ? `
                    <tr>
                        <td>Materials & Parts:</td>
                        <td style="text-align:right;">₹${inv.material_cost || 0}</td>
                    </tr>
                ` : ""}
                ${inv.tax_or_other ? `
                    <tr>
                        <td>Taxes / Extra:</td>
                        <td style="text-align:right;">₹${inv.tax_or_other}</td>
                    </tr>
                ` : ""}
                <tr class="total-row">
                    <td>Total Amount:</td>
                    <td style="text-align:right; font-size:16px;">₹${inv.total_amount}</td>
                </tr>
            </table>

            <div class="billing-summary-card" style="margin-top:12px;">
                <div class="billing-row paid"><span>Already paid (advance / wallet)</span><span>₹${getAlreadyPaidAmount(req)}</span></div>
                <div class="billing-row remaining"><span>Remaining due</span><span>₹${getRemainingDue(req)}</span></div>
            </div>
            ${!isPaid ? `
                <button class="pay-bill-btn" onclick="payInvoice('${req._id}')">
                    💳 Pay remaining ₹${getRemainingDue(req)} from wallet
                </button>
            ` : `<div style="margin-top:10px; color:#15803d; font-weight:700; font-size:13px;">✓ Paid in full. Review and complaint are now available.</div>`}
        </div>
    `;
}

// Render Separate Worker & Company Reviews
function renderReviewSection(req) {
    if (!isJobFullyPaid(req)) {
        return `
            <div style="margin-top:14px; background:#fff7ed; border:1px solid #fdba74; border-radius:10px; padding:14px;">
                <h4 style="font-size:14px; color:#9a3412; margin-bottom:6px;">🔒 Review & complaint locked</h4>
                <p style="font-size:13px; color:#9a3412; margin:0;">Pay the remaining ₹${getRemainingDue(req)} from your wallet. If your balance is low, recharge the wallet first. Review and complaint appear only after the total amount is paid.</p>
            </div>
        `;
    }

    const hasWorkerReview = req.worker_review && req.worker_review.rating;
    const hasCompanyReview = req.company_review && req.company_review.rating;
    const hasProductReview = req.product_review && req.product_review.rating;
    const hasLegacyReview = req.review && req.review.rating;

    if (hasWorkerReview || hasCompanyReview || hasProductReview || hasLegacyReview) {
        return `
            <div style="background:#ffffff; border-radius:10px; padding:12px; border:1px solid #d8b4fe; margin-top:12px;">
                <h4 style="font-size:13px; color:#581c87; margin-bottom:8px;">⭐ Your ratings (updates company average)</h4>
                ${hasCompanyReview ? `
                    <div style="background:#fef3c7; border:1px solid #fde68a; border-radius:6px; padding:8px 10px; margin-bottom:6px; font-size:12px;">
                        <strong style="color:#92400e;">🏢 Company: ${req.company_review.rating}/5 ★</strong>
                        ${req.company_review.comment ? `<p style="margin-top:4px; color:#334155; font-style:italic;">"${escapeHtml(req.company_review.comment)}"</p>` : ""}
                    </div>
                ` : ""}
                ${hasWorkerReview ? `
                    <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:6px; padding:8px 10px; margin-bottom:6px; font-size:12px;">
                        <strong style="color:#1e40af;">👷 Workers: ${req.worker_review.rating}/5 ★</strong>
                        ${req.worker_review.comment ? `<p style="margin-top:4px; color:#334155; font-style:italic;">"${escapeHtml(req.worker_review.comment)}"</p>` : ""}
                    </div>
                ` : ""}
                ${hasProductReview ? `
                    <div style="background:#ecfdf5; border:1px solid #bbf7d0; border-radius:6px; padding:8px 10px; margin-bottom:6px; font-size:12px;">
                        <strong style="color:#166534;">🧱 Products / materials: ${req.product_review.rating}/5 ★</strong>
                        ${req.product_review.comment ? `<p style="margin-top:4px; color:#334155; font-style:italic;">"${escapeHtml(req.product_review.comment)}"</p>` : ""}
                    </div>
                ` : ""}
                ${req.complaint && req.complaint.has_complaint ? `
                    <div style="background:#fee2e2; border:1px solid #fecaca; border-radius:6px; padding:8px 10px; font-size:12px; color:#991b1b;">
                        <strong>Complaint (${escapeHtml(req.complaint.about || "other")}):</strong> ${escapeHtml(req.complaint.text)}
                    </div>
                ` : ""}
            </div>
        `;
    }

    return `
        <div class="review-box" id="reviewBox-${req._id}" style="margin-top:14px; background:#faf5ff; border:1px solid #e9d5ff; border-radius:10px; padding:14px;">
            <h4 style="font-size:14px; color:#581c87; margin-bottom:10px;">⭐ Rate company, workers and products</h4>
            <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; padding:10px; margin-bottom:10px;">
                <strong style="color:#0f172a; font-size:13px; display:block; margin-bottom:6px;">🏢 Company (${escapeHtml(req.company_name || "Service Provider")})</strong>
                <select id="companyRatingSelect-${req._id}" style="padding:4px 8px; font-size:12px; border-radius:6px; border:1px solid #cbd5e1; width:100%; margin-bottom:6px;">
                    <option value="5">5 ★ Exceptional</option>
                    <option value="4">4 ★ Very good</option>
                    <option value="3">3 ★ Satisfactory</option>
                    <option value="2">2 ★ Needs improvement</option>
                    <option value="1">1 ★ Poor</option>
                </select>
                <input type="text" id="companyComment-${req._id}" placeholder="Communication, quotation accuracy, coordination..." style="width:100%; padding:6px 10px; border:1px solid #cbd5e1; border-radius:6px; font-size:12px;">
            </div>
            <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; padding:10px; margin-bottom:10px;">
                <strong style="color:#0f172a; font-size:13px; display:block; margin-bottom:6px;">👷 Workers (${(req.assigned_workers || []).map(w => w.name).join(", ") || "Technician"})</strong>
                <select id="workerRatingSelect-${req._id}" style="padding:4px 8px; font-size:12px; border-radius:6px; border:1px solid #cbd5e1; width:100%; margin-bottom:6px;">
                    <option value="5">5 ★ Exceptional</option>
                    <option value="4">4 ★ Very good</option>
                    <option value="3">3 ★ Satisfactory</option>
                    <option value="2">2 ★ Needs improvement</option>
                    <option value="1">1 ★ Poor</option>
                </select>
                <input type="text" id="workerComment-${req._id}" placeholder="Punctuality, craftsmanship, site cleanup..." style="width:100%; padding:6px 10px; border:1px solid #cbd5e1; border-radius:6px; font-size:12px;">
            </div>
            <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; padding:10px; margin-bottom:10px;">
                <strong style="color:#0f172a; font-size:13px; display:block; margin-bottom:6px;">🧱 Products & materials used</strong>
                <select id="productRatingSelect-${req._id}" style="padding:4px 8px; font-size:12px; border-radius:6px; border:1px solid #cbd5e1; width:100%; margin-bottom:6px;">
                    <option value="5">5 ★ Quality parts</option>
                    <option value="4">4 ★ Good</option>
                    <option value="3">3 ★ Average</option>
                    <option value="2">2 ★ Cheap / weak</option>
                    <option value="1">1 ★ Defective</option>
                </select>
                <input type="text" id="productComment-${req._id}" placeholder="Cement, pipes, fittings quality..." style="width:100%; padding:6px 10px; border:1px solid #cbd5e1; border-radius:6px; font-size:12px;">
            </div>
            <div style="background:#fff7ed; border:1px solid #fed7aa; border-radius:8px; padding:10px; margin-bottom:10px;">
                <strong style="color:#9a3412; font-size:13px; display:block; margin-bottom:6px;">Any other complaint?</strong>
                <select id="complaintAbout-${req._id}" style="padding:4px 8px; font-size:12px; border-radius:6px; border:1px solid #fdba74; width:100%; margin-bottom:6px;">
                    <option value="none">No complaint</option>
                    <option value="worker">About the worker</option>
                    <option value="company">About the company</option>
                    <option value="product">About products / materials</option>
                    <option value="other">Something else</option>
                </select>
                <textarea id="complaintText-${req._id}" rows="2" placeholder="If yes, describe the issue. This is shown on the worker dashboard." style="width:100%; padding:6px 10px; border:1px solid #fdba74; border-radius:6px; font-size:12px;"></textarea>
                <label style="display:flex; align-items:center; gap:6px; margin-top:8px; font-size:12px; color:#475569;">
                    <input type="checkbox" id="wouldRecommend-${req._id}" checked> I would hire this company again
                </label>
            </div>
            <button class="card-action-btn" style="background:#7e22ce; width:100%; padding:9px;" onclick="submitDualReview('${req._id}')">Submit ratings</button>
        </div>
    `;
}

async function submitDualReview(requestId) {
    try {
        const worker_rating = Number(document.getElementById("workerRatingSelect-" + requestId)?.value) || 5;
        const worker_comment = document.getElementById("workerComment-" + requestId)?.value.trim() || "";
        const company_rating = Number(document.getElementById("companyRatingSelect-" + requestId)?.value) || 5;
        const company_comment = document.getElementById("companyComment-" + requestId)?.value.trim() || "";
        const product_rating = Number(document.getElementById("productRatingSelect-" + requestId)?.value) || 5;
        const product_comment = document.getElementById("productComment-" + requestId)?.value.trim() || "";
        const complaint_about = document.getElementById("complaintAbout-" + requestId)?.value || "none";
        const complaint_text = document.getElementById("complaintText-" + requestId)?.value.trim() || "";
        const would_recommend = !!(document.getElementById("wouldRecommend-" + requestId)?.checked);

        if (complaint_about !== "none" && !complaint_text) {
            showToast("Please describe the complaint, or choose No complaint.");
            return;
        }

        const response = await fetch("/api/customer/requests/" + requestId + "/review", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer " + token
            },
            body: JSON.stringify({
                worker_rating,
                worker_comment,
                company_rating,
                company_comment,
                product_rating,
                product_comment,
                complaint_about,
                complaint_text,
                would_recommend
            })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Failed to submit reviews.");
        showToast(data.message || "Ratings saved. Company average updated.");
        await loadMyRequests();
    } catch (err) {
        showToast(err.message);
    }
}

const inspectionModal = document.getElementById("inspectionModal");
const closeInspectionModal = document.getElementById("closeInspectionModal");


const taxInvoiceModal = document.getElementById("taxInvoiceModal");
const closeTaxInvoiceModal = document.getElementById("closeTaxInvoiceModal");

function openInspectionModal(requestId) {
    const req = cachedMyRequests.find(r => r._id === requestId);
    if (!req) return;

    document.getElementById("inspectRequestId").value = requestId;
    document.getElementById("inspectOtpDisplay").textContent = req.completion_otp || "----";
    const reworkBox = document.getElementById("reworkFormBox");
    if (reworkBox) reworkBox.style.display = "none";
    const notesInput = document.getElementById("reworkNotesInput");
    if (notesInput) notesInput.value = "";

    // Render Before vs After photos side-by-side in modal
    const grid = document.getElementById("inspectionPhotosGrid");
    if (grid) {
        const beforePhotos = req.photos || [];
        const afterPhotos = req.after_photos || [];
        const maxPhotos = Math.max(beforePhotos.length, afterPhotos.length, 1);
        let photoHtml = "";
        for (let i = 0; i < maxPhotos; i++) {
            const b = beforePhotos[i] || beforePhotos[0] || "";
            const a = afterPhotos[i] || afterPhotos[0] || "";
            photoHtml += `
                <div class="photo-compare-box">
                    <div class="compare-label before">
                        <span>BEFORE REPAIR #${i + 1}</span>
                        <span>Initial Damage</span>
                    </div>
                    <div class="compare-img-wrap" onclick="openLightbox('${b}', 'Before Repair #${i + 1}')">
                        ${b ? `<img src="${b}" alt="Before Repair">` : `<div style="padding:20px; color:#94a3b8;">No photo</div>`}
                    </div>
                </div>
                <div class="photo-compare-box">
                    <div class="compare-label after">
                        <span>AFTER REPAIR #${i + 1}</span>
                        <span>Completed Work Proof</span>
                    </div>
                    <div class="compare-img-wrap" onclick="openLightbox('${a}', 'After Repair Proof #${i + 1}')">
                        ${a ? `<img src="${a}" alt="After Repair Proof">` : `<div style="padding:20px; color:#94a3b8;">No proof photo yet</div>`}
                    </div>
                </div>
            `;
        }
        grid.innerHTML = photoHtml;
    }

    if (inspectionModal) inspectionModal.classList.add("show");
}

async function confirmInspectionSignOff() {
    const requestId = document.getElementById("inspectRequestId").value;
    if (!requestId) return;

    try {
        const response = await fetch(`/api/customer/requests/${requestId}/verify-completion`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
                satisfaction_notes: "Customer on-site inspection passed and verified."
            })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Failed to verify completion.");

        if (inspectionModal) inspectionModal.classList.remove("show");
        showToast("Work verified. Pay the remaining amount from your wallet to unlock review and complaint.");
        await loadMyRequests();
    } catch (err) {
        showToast(err.message);
    }
}

function toggleReworkForm() {
    const box = document.getElementById("reworkFormBox");
    if (!box) return;
    box.style.display = box.style.display === "none" ? "block" : "none";
}

async function submitReworkRequest() {
    const requestId = document.getElementById("inspectRequestId").value;
    const notesInput = document.getElementById("reworkNotesInput");
    const notes = notesInput ? notesInput.value.trim() : "";

    if (!notes) {
        showToast("Please enter what work was left incomplete or needs correction.");
        return;
    }

    try {
        const response = await fetch(`/api/customer/requests/${requestId}/request-revision`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ rework_notes: notes })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Failed to submit rework request.");

        if (inspectionModal) inspectionModal.classList.remove("show");
        showToast("Rework request sent to company. The technician will return to resolve this.");
        await loadMyRequests();
    } catch (err) {
        showToast(err.message);
    }
}

function openTaxInvoiceModal(requestId) {
    const req = cachedMyRequests.find(r => r._id === requestId);
    if (!req || !req.invoice) return;

    const compName = req.company_name || (req.company_id ? req.company_id.company_name : "Authorized Service Provider");
    const custName = req.customer_name || document.getElementById("userName").textContent || "Customer";
    const inv = req.invoice;
    const invDate = inv.issued_at ? new Date(inv.issued_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : new Date().toLocaleDateString();

    const container = document.getElementById("printableTaxInvoiceArea");
    if (!container) return;

    container.innerHTML = `
        <div class="tax-invoice-container">
            <div class="invoice-meta-header">
                <div class="invoice-company-info">
                    <h3>${escapeHtml(compName)}</h3>
                    <p style="font-size:12px; color:#64748b;">Licensed & Insured Domestic Service Provider</p>
                    <p style="font-size:12px; color:#64748b;">Billed To: <strong>${escapeHtml(custName)}</strong></p>
                    <p style="font-size:12px; color:#64748b;">Service Location: ${escapeHtml(req.service_address)}</p>
                </div>
                <div style="text-align:right;">
                    <h2 style="font-size:18px; color:#0f172a; margin-bottom:4px;">TAX INVOICE</h2>
                    <p style="font-size:12px; color:#475569;">Invoice #: <strong>${escapeHtml(inv.invoice_number)}</strong></p>
                    <p style="font-size:12px; color:#475569;">Date: ${invDate}</p>
                    <div style="margin-top:8px;">
                        <span class="invoice-badge-paid">${inv.payment_status === 'paid' ? '✓ PAID IN FULL' : 'PENDING PAYMENT'}</span>
                    </div>
                </div>
            </div>

            <table class="invoice-line-items">
                <thead>
                    <tr>
                        <th>Item Description</th>
                        <th>Scope / Qty</th>
                        <th style="text-align:right;">Amount (₹)</th>
                    </tr>
                </thead>
                <tbody>
                    ${inv.materials_items && inv.materials_items.length > 0 ? inv.materials_items.map(m => `
                        <tr>
                            <td>
                                <strong>🧱 ${escapeHtml(m.item_name)}</strong>
                                <div style="font-size:11px; color:#64748b;">Physical material item @ ₹${m.unit_price}/unit</div>
                            </td>
                            <td>${escapeHtml(m.quantity)}</td>
                            <td style="text-align:right; font-weight:600;">₹${m.total_price}</td>
                        </tr>
                    `).join('') : `
                        <tr>
                            <td>
                                <strong>Materials, Parts & Consumables</strong>
                                <div style="font-size:11px; color:#64748b;">Hardware, pipes, cement, putty</div>
                            </td>
                            <td>Site Requirements</td>
                            <td style="text-align:right;">₹${inv.material_cost || 0}</td>
                        </tr>
                    `}

                    ${inv.labor_items && inv.labor_items.length > 0 ? inv.labor_items.map(l => `
                        <tr>
                            <td>
                                <strong>👷 ${escapeHtml(l.worker_name)} — Labor & Craftsmanship</strong>
                                <div style="font-size:11px; color:#64748b;">${escapeHtml(l.role || 'Certified Technician')} @ ₹${l.daily_rate}/day</div>
                            </td>
                            <td>${l.days} Day(s)</td>
                            <td style="text-align:right; font-weight:600;">₹${l.total_labor}</td>
                        </tr>
                    `).join('') : `
                        <tr>
                            <td>
                                <strong>${escapeHtml(req.service)} — Skilled Labor & Repair Service</strong>
                                <div style="font-size:11px; color:#64748b;">${escapeHtml(req.description)}</div>
                            </td>
                            <td>${(req.assigned_workers || []).length || 1} Technician(s)</td>
                            <td style="text-align:right;">₹${inv.labor_cost || 0}</td>
                        </tr>
                    `}

                    ${inv.tax_or_other ? `
                        <tr>
                            <td><strong>Service Tax & Platform Compliance Fees</strong></td>
                            <td>Statutory</td>
                            <td style="text-align:right;">₹${inv.tax_or_other}</td>
                        </tr>
                    ` : ""}
                </tbody>
            </table>

            <div class="invoice-summary-box">
                <table class="invoice-summary-table">
                    <tr>
                        <td>Materials Subtotal:</td>
                        <td style="text-align:right;">₹${inv.materials_total || inv.material_cost || 0}</td>
                    </tr>
                    <tr>
                        <td>Labor Subtotal:</td>
                        <td style="text-align:right;">₹${inv.labor_total || inv.labor_cost || 0}</td>
                    </tr>
                    ${inv.tax_or_other ? `
                        <tr>
                            <td>Taxes:</td>
                            <td style="text-align:right;">₹${inv.tax_or_other}</td>
                        </tr>
                    ` : ""}
                    <tr class="total-due">
                        <td>Grand Total Billed:</td>
                        <td style="text-align:right;">₹${inv.total_amount}</td>
                    </tr>
                </table>
            </div>

            <div style="margin-top:20px; padding-top:12px; border-top:1px solid #e2e8f0; font-size:11px; color:#94a3b8; display:flex; justify-content:space-between;">
                <span>Payment Method: Domestic Services Platform Escrow</span>
                <span>Protected under 30-Day Quality Guarantee</span>
            </div>
        </div>
    `;

    if (taxInvoiceModal) taxInvoiceModal.classList.add("show");
}

if (closeInspectionModal) closeInspectionModal.addEventListener("click", () => inspectionModal.classList.remove("show"));
if (closeTaxInvoiceModal) closeTaxInvoiceModal.addEventListener("click", () => taxInvoiceModal.classList.remove("show"));

window.addEventListener("click", (e) => {
    if (e.target === inspectionModal) inspectionModal.classList.remove("show");
    if (e.target === taxInvoiceModal) taxInvoiceModal.classList.remove("show");
});

// ===================================================
// PHOTO LIGHTBOX VIEWER
// ===================================================

const lightboxModal = document.getElementById("lightboxModal");
const lightboxImage = document.getElementById("lightboxImage");
const lightboxCaption = document.getElementById("lightboxCaption");
const closeLightbox = document.getElementById("closeLightbox");

function openLightbox(src, caption = "") {
    if (!lightboxModal) return;
    lightboxImage.src = src;
    lightboxCaption.textContent = caption;
    lightboxModal.classList.add("show");
}

if (closeLightbox) {
    closeLightbox.addEventListener("click", () => lightboxModal.classList.remove("show"));
}


// ===================================================
// UTILITY & INITIAL LOAD
// ===================================================

document.getElementById("bookingsBtn").addEventListener("click", () => {
    openMyRequestsModal();
});

document.getElementById("favoritesBtn").addEventListener("click", () => {
    showToast("Favorites view is integrated into your dashboard filter.");
});

document.getElementById("profileBtn").addEventListener("click", () => {
    openCustomerProfile();
});

function serviceIcon(service) {
    const name = String(service || "").toLowerCase();
    if (name.includes("plumb")) return "🔧";
    if (name.includes("electric")) return "⚡";
    if (name.includes("paint")) return "🎨";
    if (name.includes("carpent")) return "🪚";
    if (name.includes("clean")) return "🧹";
    return "🏠";
}

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function showToast(message) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => {
        toast.classList.remove("show");
    }, 3200);
}

// Customer deletes completed request from records
async function deleteCustomerRequest(id) {
    if (!confirm("Are you sure you want to delete this completed service request from your records? This cannot be undone.")) {
        return;
    }

    try {
        const response = await fetch(`/api/customer/requests/${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Failed to delete request.");

        showToast(data.message || "Request record removed.");
        await loadMyRequests();
        await loadMyRequestsCount();
    } catch (err) {
        alert(err.message);
    }
}
window.deleteCustomerRequest = deleteCustomerRequest;

// Customer deletes active chat history with selected company
async function deleteActiveChatHistory() {
    if (!activeChatCompany) {
        return alert("Please select a company chat to delete.");
    }

    if (!confirm(`Are you sure you want to delete all chat messages with ${activeChatCompany.company_name}? This will permanently remove them from the database.`)) {
        return;
    }

    try {
        const response = await fetch(`/api/chat/history/${activeChatCompany._id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Failed to delete chat.");

        showToast(data.message || "Chat history cleared.");
        await loadChatHistory();
        await loadChatCompanies();
    } catch (err) {
        alert(err.message);
    }
}
window.deleteActiveChatHistory = deleteActiveChatHistory;

// Customer approves daily update (OK)
async function approveDailyUpdate(requestId, dayNumber) {
    if (!confirm(`Confirm that Day ${dayNumber} work progress is OK and satisfactory? Further proceedings will continue.`)) {
        return;
    }

    try {
        const response = await fetch(`/api/customer/requests/${requestId}/daily-update/${dayNumber}/respond`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ has_complaint: false })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Failed to approve work.");

        showToast("Day " + dayNumber + " work approved! Proceeding with work handover.");
        await loadMyRequests();
    } catch (err) {
        alert(err.message);
    }
}
window.approveDailyUpdate = approveDailyUpdate;

// Open Daily Complaint Modal
function openDailyComplaintModal(requestId, dayNumber) {
    document.getElementById("complaintRequestId").value = requestId;
    document.getElementById("complaintDayNumber").value = dayNumber;
    document.getElementById("complaintDescription").value = "";
    document.getElementById("complaintCategory").value = "technician";
    const modal = document.getElementById("dailyComplaintModal");
    if (modal) modal.classList.add("show");
}
window.openDailyComplaintModal = openDailyComplaintModal;

function closeDailyComplaintModal() {
    const modal = document.getElementById("dailyComplaintModal");
    if (modal) modal.classList.remove("show");
}
window.closeDailyComplaintModal = closeDailyComplaintModal;

// Submit Daily Complaint (alerts company and worker)
async function submitDailyComplaint() {
    const requestId = document.getElementById("complaintRequestId").value;
    const dayNumber = document.getElementById("complaintDayNumber").value;
    const category = document.getElementById("complaintCategory").value;
    const text = document.getElementById("complaintDescription").value.trim();

    if (!text) {
        return alert("Please describe the issue or defect.");
    }

    const fullComplaint = `[Category: ${category.toUpperCase()}] ${text}`;

    try {
        const response = await fetch(`/api/customer/requests/${requestId}/daily-update/${dayNumber}/respond`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
                has_complaint: true,
                complaint_text: fullComplaint
            })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Failed to submit complaint.");

        closeDailyComplaintModal();
        showToast("Complaint submitted. Company and worker have been alerted.");
        await loadMyRequests();
    } catch (err) {
        alert(err.message);
    }
}
window.submitDailyComplaint = submitDailyComplaint;

// Start loads
loadCustomer();
loadCompanies();
loadMyRequestsCount();
loadChatCompanies();
setInterval(updateUnreadBadge, 10000);


// ========================
// CUSTOMER PROFILE SYSTEM
// ========================
var customerProfileData = {};

async function openCustomerProfile() {
    document.getElementById('profileModal').style.display = 'flex';
    try {
        const response = await fetch('/api/customer/profile', {
            headers: { Authorization: 'Bearer ' + token }
        });
        const data = await response.json();
        if (data.success && data.customer) {
            customerProfileData = data.customer;
            document.getElementById('profileName').value = data.customer.name || '';
            document.getElementById('profileEmail').textContent = data.customer.email || '—';
            document.getElementById('profilePhone').value = data.customer.phone || '';
            document.getElementById('profileLocation').value = data.customer.location || '';
            document.getElementById('profileAddress').value = data.customer.address || '';
            document.getElementById('profileCity').value = data.customer.city || '';
            document.getElementById('profileState').value = data.customer.state || '';
            document.getElementById('profileAvatar').textContent = (data.customer.name || 'C').charAt(0).toUpperCase();
            document.getElementById('profileDisplayName').textContent = data.customer.name || 'Customer';
            if (data.customer.createdAt) {
                var d = new Date(data.customer.createdAt);
                document.getElementById('profileMemberSince').textContent = 'Member since ' + d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            }
        }
    } catch (err) {
        console.error('Load profile error:', err);
    }
}

async function saveCustomerProfile() {
    var body = {
        name: document.getElementById('profileName').value.trim(),
        phone: document.getElementById('profilePhone').value.trim(),
        location: document.getElementById('profileLocation').value.trim(),
        address: document.getElementById('profileAddress').value.trim(),
        city: document.getElementById('profileCity').value.trim(),
        state: document.getElementById('profileState').value.trim()
    };
    try {
        var response = await fetch('/api/customer/profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer ' + token
            },
            body: JSON.stringify(body)
        });
        var data = await response.json();
        if (data.success) {
            showToast('✅ Profile updated successfully!');
            customerProfileData = data.customer || body;
            document.getElementById('userName').textContent = body.name || 'Customer';
            document.getElementById('userAvatar').textContent = (body.name || 'C').charAt(0).toUpperCase();
            document.getElementById('profileDisplayName').textContent = body.name || 'Customer';
            document.getElementById('profileAvatar').textContent = (body.name || 'C').charAt(0).toUpperCase();
        } else {
            alert(data.message || 'Failed to update profile.');
        }
    } catch (err) {
        alert('Error saving profile: ' + err.message);
    }
}
window.saveCustomerProfile = saveCustomerProfile;
window.openCustomerProfile = openCustomerProfile;

// Auto-fill service address from profile when opening request modal
var _origRequestServiceBtnClick = null;
(function() {
    var reqBtn = document.getElementById('requestServiceBtn');
    if (reqBtn) {
        reqBtn.addEventListener('click', function() {
            // Auto-fill address from profile if service address field is empty
            setTimeout(function() {
                var addrField = document.getElementById('serviceAddress');
                if (addrField && !addrField.value.trim() && customerProfileData) {
                    var parts = [];
                    if (customerProfileData.address) parts.push(customerProfileData.address);
                    if (customerProfileData.city) parts.push(customerProfileData.city);
                    if (customerProfileData.state) parts.push(customerProfileData.state);
                    if (customerProfileData.location && !parts.length) parts.push(customerProfileData.location);
                    if (parts.length > 0) {
                        addrField.value = parts.join(', ');
                    }
                }
            }, 200);
        });
    }
})();

// Load profile data on page load for auto-fill
(async function preloadProfile() {
    try {
        var response = await fetch('/api/customer/profile', {
            headers: { Authorization: 'Bearer ' + token }
        });
        var data = await response.json();
        if (data.success && data.customer) {
            customerProfileData = data.customer;
        }
    } catch(e) {}
})();
