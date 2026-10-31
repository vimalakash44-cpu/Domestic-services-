const token = localStorage.getItem("token");

if (!token) {
    window.location.href = "login.html";
}

// Active smooth scroll and sidebar tab selection without changing location hash (prevents popstate logout)
document.addEventListener("DOMContentLoaded", () => {
    const navItems = document.querySelectorAll(".sidebar nav .nav-item");
    navItems.forEach(item => {
        item.addEventListener("click", function(e) {
            e.preventDefault();
            navItems.forEach(n => n.classList.remove("active"));
            this.classList.add("active");

            const href = this.getAttribute("href");
            if (!href || href === "#") {
                window.scrollTo({ top: 0, behavior: "smooth" });
                return;
            }

            const targetSection = document.querySelector(href);
            if (targetSection) {
                targetSection.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        });
    });
});

// Browser Back Arrow (<-) handler: only logs out if user navigates away from admin dashboard
let initialPathname = window.location.pathname;
window.history.pushState({ page: "admin-dashboard" }, "", window.location.href);
window.addEventListener("popstate", function(event) {
    // If popstate is just an in-page navigation, do not log out
    if (window.location.pathname === initialPathname && event.state && event.state.page === "admin-dashboard") {
        return;
    }
    try {
        localStorage.clear();
        sessionStorage.clear();
    } catch(e) {}
    window.location.replace("login.html");
});

const companyList =
    document.getElementById("companyList");

const pendingCount =
    document.getElementById("pendingCount");

const sidebarPending =
    document.getElementById("sidebarPending");

const notificationCount =
    document.getElementById("notificationCount");

const modal =document.getElementById("companyModal");

const closeModal =
    document.getElementById("closeModal");

const modalCompanyName =
    document.getElementById("modalCompanyName");

const modalOwner =
    document.getElementById("modalOwner");

const modalEmail =
    document.getElementById("modalEmail");

const modalPhone =
    document.getElementById("modalPhone");

const modalCity =
    document.getElementById("modalCity");

const modalExperience =
    document.getElementById("modalExperience");

const modalWorkers =
    document.getElementById("modalWorkers");

const modalAddress =
    document.getElementById("modalAddress");

const modalServices =
    document.getElementById("modalServices");

const modalDescription =
    document.getElementById("modalDescription");

const modalDocument =
    document.getElementById("modalDocument");

const approveBtn =
    document.getElementById("approveBtn");

const rejectBtn =
    document.getElementById("rejectBtn");

const documentBtn =
    document.getElementById("documentBtn");

const refreshBtn =
    document.getElementById("refreshBtn");

const logoutBtn =
    document.getElementById("logoutBtn");

const refreshComplaintsBtn =
    document.getElementById("refreshComplaintsBtn");

const companyDetailsModal =
    document.getElementById("companyDetailsModal");

const closeCompanyDetailsModal =
    document.getElementById("closeCompanyDetailsModal");

const removeCompanyBtn =
    document.getElementById("removeCompanyBtn");

const complaintDetailsModal =
    document.getElementById("complaintDetailsModal");

const closeComplaintDetailsModal =
    document.getElementById("closeComplaintDetailsModal");

let selectedCompany = null;
let selectedCompanyForRemoval = null;

async function loadCompanies() {
    try {
        companyList.innerHTML = `
            <div class="loading">
                Loading companies...
            </div>
        `;

        const response = await fetch(
            "/api/admin/companies/pending",
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
            window.location.href = "login.html";
            return;
        }

        if (!response.ok) {
            throw new Error(
                data.message ||
                "Unable to load companies."
            );
        }

        const companies =
            data.companies || [];

        pendingCount.textContent =
            companies.length;

        sidebarPending.textContent =
            companies.length;

        notificationCount.textContent =
            companies.length;

        if (companies.length === 0) {
            companyList.innerHTML = `
                <div class="empty">
                    <div class="empty-icon">✓</div>
                    <h3>All caught up</h3>
                    <p>
                        There are no companies
                        waiting for verification.
                    </p>
                </div>
            `;

            return;
        }

        companyList.innerHTML = "";

        companies.forEach(company => {

            const firstLetter =
                company.company_name
                    ? company.company_name
                        .charAt(0)
                        .toUpperCase()
                    : "C";

            const card =
                document.createElement("div");

            card.className =
                "company-card";

            card.innerHTML = `
                <div class="company-logo">
                    ${firstLetter}
                </div>

                <div class="company-info">
                    <h3>
                        ${company.company_name}
                    </h3>

                    <p>
                        Owner: ${company.owner_name}
                    </p>

                    <div class="company-meta">
                        <span>
                            📍 ${company.city}
                        </span>

                        <span>
                            ☎ ${company.phone}
                        </span>

                        <span>
                            👥 ${company.total_workers}
                            workers
                        </span>
                    </div>
                </div>

                <span class="pending-badge">
                    PENDING
                </span>

                <button
                    class="view-btn"
                    onclick="viewCompany('${company._id}')"
                >
                    Review
                </button>
            `;

            companyList.appendChild(card);
        });

        window.companyData = companies;

    } catch (error) {

        console.error(error);

        companyList.innerHTML = `
            <div class="empty">
                <div class="empty-icon">!</div>
                <h3>Unable to load companies</h3>
                <p>${error.message}</p>
            </div>
        `;
    }
}
async function loadStats() {
    try {
        const token = localStorage.getItem("token");

        const response = await fetch("/api/admin/stats", {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (!data.success) {
            console.error(data.message);
            return;
        }

        document.getElementById("pendingCount").textContent =
            data.pendingCount;

        document.getElementById("approvedCount").textContent =
            data.approvedCount;

        document.getElementById("rejectedCount").textContent =
            data.rejectedCount;

        document.getElementById("totalCount").textContent =
            data.totalCount;

    } catch (error) {
        console.error("Error loading statistics:", error);
    }
}
loadStats();
function viewCompany(id) {

    const company =
        window.companyData.find(
            item => item._id === id
        );

    if (!company) {
        return;
    }

    selectedCompany = company;

    modalCompanyName.textContent =
        company.company_name || "-";

    modalOwner.textContent =
        company.owner_name || "-";

    modalEmail.textContent =
        company.email || "-";

    modalPhone.textContent =
        company.phone || "-";

    modalCity.textContent =
        company.city || "-";

    modalExperience.textContent =
        `${company.experience || 0} years`;

    modalWorkers.textContent =
        company.total_workers || "0";

    modalAddress.textContent =
        company.address || "-";

    modalServices.textContent =
        Array.isArray(company.services)
            ? company.services.join(", ")
            : company.services || "-";

    modalDescription.textContent =
        company.description || "-";

    modalDocument.textContent =
        company.verification_document?.filename ||
        "Document";

    modal.classList.add("show");
}

closeModal.addEventListener(
    "click",
    () => {
        modal.classList.remove("show");
    }
);

modal.addEventListener(
    "click",
    event => {
        if (event.target === modal) {
            modal.classList.remove("show");
        }
    }
);

approveBtn.addEventListener(
    "click",
    async () => {

        if (!selectedCompany) {
            return;
        }

        if (
            !confirm(
                `Approve ${selectedCompany.company_name}?`
            )
        ) {
            return;
        }

        try {

            const response =
                await fetch(
                    `/api/admin/companies/${selectedCompany._id}/approve`,
                    {
                        method: "PATCH",
                        headers: {
                            Authorization:
                                `Bearer ${token}`
                        }
                    }
                );

            const data =
                await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message
                );
            }

            modal.classList.remove("show");

            showToast(
                "Company approved successfully."
            );

            loadCompanies();

        } catch (error) {
            showToast(error.message);
        }
    }
);

rejectBtn.addEventListener(
    "click",
    async () => {

        if (!selectedCompany) {
            return;
        }

        if (
            !confirm(
                `Reject ${selectedCompany.company_name}?`
            )
        ) {
            return;
        }

        try {

            const response =
                await fetch(
                    `/api/admin/companies/${selectedCompany._id}/reject`,
                    {
                        method: "PATCH",
                        headers: {
                            Authorization:
                                `Bearer ${token}`
                        }
                    }
                );

            const data =
                await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message
                );
            }

            modal.classList.remove("show");

            showToast(
                "Company rejected successfully."
            );

            loadCompanies();

        } catch (error) {
            showToast(error.message);
        }
    }
);

documentBtn.addEventListener(
    "click",
    () => {

        if (!selectedCompany) {
            return;
        }

        const url =
            `/api/admin/companies/${selectedCompany._id}/document`;

        window.open(
            `${url}?token=${encodeURIComponent(token)}`,
            "_blank"
        );
    }
);

refreshBtn.addEventListener(
    "click",
    loadCompanies
);

logoutBtn.addEventListener(
    "click",
    () => {
        localStorage.removeItem("token");
        window.location.href = "login.html";
    }
);

function showToast(message) {

    const toast =
        document.getElementById("toast");

    toast.textContent = message;

    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}

loadCompanies();
loadApprovedCompanies();
loadComplaints();

async function loadApprovedCompanies() {
    try {
        const list = document.getElementById("approvedCompaniesList");
        list.innerHTML = '<div class="loading">Loading companies...</div>';

        const response = await fetch("/api/admin/companies/approved", {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem("token");
            window.location.href = "login.html";
            return;
        }

        if (!response.ok) {
            throw new Error(data.message || "Unable to load companies.");
        }

        const companies = data.companies || [];

        if (companies.length === 0) {
            list.innerHTML = `
                <div class="empty">
                    <div class="empty-icon">✓</div>
                    <h3>No approved companies</h3>
                    <p>There are no approved companies yet.</p>
                </div>
            `;
            return;
        }

        list.innerHTML = "";

        companies.forEach(company => {
            const firstLetter = company.company_name ? company.company_name.charAt(0).toUpperCase() : "C";
            const card = document.createElement("div");
            card.className = "company-card";
            card.innerHTML = `
                <div class="company-logo">${firstLetter}</div>
                <div class="company-info">
                    <h3>${company.company_name}</h3>
                    <p>Owner: ${company.owner_name}</p>
                    <div class="company-meta">
                        <span>📍 ${company.city}</span>
                        <span>☎ ${company.phone}</span>
                        <span>⭐ ${company.rating || 5.0}</span>
                    </div>
                </div>
                <button class="view-btn" onclick="viewCompanyDetails('${company._id}')">View Details</button>
            `;
            list.appendChild(card);
        });

        window.approvedCompanyData = companies;

    } catch (error) {
        console.error(error);
        const list = document.getElementById("approvedCompaniesList");
        list.innerHTML = `
            <div class="empty">
                <div class="empty-icon">!</div>
                <h3>Unable to load companies</h3>
                <p>${error.message}</p>
            </div>
        `;
    }
}

async function loadComplaints() {
    try {
        const list = document.getElementById("complaintsList");
        list.innerHTML = '<div class="loading">Loading complaints...</div>';

        const response = await fetch("/api/admin/companies/approved", {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem("token");
            window.location.href = "login.html";
            return;
        }

        if (!response.ok) {
            throw new Error(data.message || "Unable to load complaints.");
        }

        const companies = data.companies || [];
        const allComplaints = [];

        for (const company of companies) {
            if (company.company_complaints && company.company_complaints.length > 0) {
                company.company_complaints.forEach(complaint => {
                    allComplaints.push({
                        ...complaint,
                        company_id: company._id,
                        company_name: company.company_name
                    });
                });
            }
        }

        document.getElementById("sidebarComplaints").textContent = allComplaints.length;

        if (allComplaints.length === 0) {
            list.innerHTML = `
                <div class="empty">
                    <div class="empty-icon">✓</div>
                    <h3>No complaints</h3>
                    <p>There are no company complaints to review.</p>
                </div>
            `;
            return;
        }

        list.innerHTML = "";

        allComplaints.forEach(complaint => {
            const card = document.createElement("div");
            card.className = "company-card";
            card.innerHTML = `
                <div class="company-logo">⚠</div>
                <div class="company-info">
                    <h3>${complaint.company_name}</h3>
                    <p>Customer: ${complaint.customer_name} (${complaint.customer_phone})</p>
                    <div class="company-meta">
                        <span>📅 ${new Date(complaint.created_at).toLocaleDateString()}</span>
                        <span style="color: ${complaint.status === 'pending' ? '#dc2626' : '#16a34a'}">
                            ${complaint.status.toUpperCase()}
                        </span>
                    </div>
                </div>
                <button class="view-btn" onclick="viewComplaintDetails('${complaint.company_id}', '${complaint._id}')">View</button>
            `;
            list.appendChild(card);
        });

        window.complaintsData = allComplaints;

    } catch (error) {
        console.error(error);
        const list = document.getElementById("complaintsList");
        list.innerHTML = `
            <div class="empty">
                <div class="empty-icon">!</div>
                <h3>Unable to load complaints</h3>
                <p>${error.message}</p>
            </div>
        `;
    }
}

function viewCompanyDetails(id) {
    const company = window.approvedCompanyData.find(item => item._id === id);
    if (!company) return;

    selectedCompanyForRemoval = company;

    document.getElementById("companyDetailsName").textContent = company.company_name || "-";
    document.getElementById("companyDetailsOwner").textContent = company.owner_name || "-";
    document.getElementById("companyDetailsEmail").textContent = company.email || "-";
    document.getElementById("companyDetailsPhone").textContent = company.phone || "-";
    document.getElementById("companyDetailsCity").textContent = company.city || "-";
    document.getElementById("companyDetailsRating").textContent = company.rating || "5.0";
    document.getElementById("companyDetailsReviews").textContent = company.total_reviews || "0";
    document.getElementById("companyDetailsAddress").textContent = company.address || "-";
    document.getElementById("companyDetailsServices").textContent = Array.isArray(company.services) ? company.services.join(", ") : company.services || "-";

    companyDetailsModal.classList.add("show");
}

function viewComplaintDetails(companyId, complaintId) {
    const company = window.approvedCompanyData.find(item => item._id === companyId);
    if (!company) return;

    const complaint = company.company_complaints.find(c => c._id === complaintId);
    if (!complaint) return;

    document.getElementById("complaintDetailsCompany").textContent = company.company_name;
    
    const content = document.getElementById("complaintDetailsContent");
    content.innerHTML = `
        <div class="detail"><span>Customer Name</span><strong>${complaint.customer_name}</strong></div>
        <div class="detail"><span>Customer Phone</span><strong>${complaint.customer_phone}</strong></div>
        <div class="detail"><span>Worker Name</span><strong>${complaint.worker_name || "N/A"}</strong></div>
        <div class="detail"><span>Worker Phone</span><strong>${complaint.worker_phone || "N/A"}</strong></div>
        <div class="detail"><span>Service</span><strong>${complaint.service || "N/A"}</strong></div>
        <div class="detail"><span>Date</span><strong>${new Date(complaint.created_at).toLocaleDateString()}</strong></div>
        <div class="detail"><span>Status</span><strong>${complaint.status.toUpperCase()}</strong></div>
        <div class="detail full"><span>Complaint</span><strong>${complaint.text}</strong></div>
    `;

    complaintDetailsModal.classList.add("show");
}

closeCompanyDetailsModal.addEventListener("click", () => {
    companyDetailsModal.classList.remove("show");
});

companyDetailsModal.addEventListener("click", event => {
    if (event.target === companyDetailsModal) {
        companyDetailsModal.classList.remove("show");
    }
});

closeComplaintDetailsModal.addEventListener("click", () => {
    complaintDetailsModal.classList.remove("show");
});

complaintDetailsModal.addEventListener("click", event => {
    if (event.target === complaintDetailsModal) {
        complaintDetailsModal.classList.remove("show");
    }
});

removeCompanyBtn.addEventListener("click", async () => {
    if (!selectedCompanyForRemoval) return;

    if (!confirm(`Are you sure you want to remove "${selectedCompanyForRemoval.company_name}" from the platform? This action cannot be undone.`)) {
        return;
    }

    try {
        const response = await fetch(`/api/admin/companies/${selectedCompanyForRemoval._id}`, {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Unable to remove company.");
        }

        companyDetailsModal.classList.remove("show");
        showToast(data.message);
        loadApprovedCompanies();
        loadComplaints();
        loadStats();

    } catch (error) {
        showToast(error.message);
    }
});

refreshComplaintsBtn.addEventListener("click", loadComplaints);