// Field Technician Dashboard Client Logic
// Browser Back Arrow (<-) handler: navigate to login page and clear all fields
window.history.pushState(null, "", window.location.href);
window.addEventListener("popstate", function() {
    try {
        localStorage.clear();
        sessionStorage.clear();
    } catch(e) {}
    window.location.replace("login.html");
});

let currentWorker = null;
let currentJobs = [];
let activeFilter = 'active';
let partsCatalog = [];
let selectedCatalogItem = null;

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');

    if (!token || role !== 'worker') {
        window.location.href = 'login.html';
        return;
    }

    // Set today's date default on date inputs
    const todayStr = new Date().toISOString().split('T')[0];
    const logDateEl = document.getElementById('dailyLogDate');
    const leaveDateEl = document.getElementById('leaveDate');
    if (logDateEl) logDateEl.value = todayStr;
    if (leaveDateEl) leaveDateEl.value = todayStr;

    initEventHandlers();
    await loadWorkerProfile();
    await loadPartsCatalog();
    await loadAssignedJobs();
});

function initEventHandlers() {
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.clear();
        window.location.href = 'login.html';
    });

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const target = btn.getAttribute('data-tab');
            const targetEl = document.getElementById(target);
            if (targetEl) targetEl.classList.add('active');
        });
    });

    // Filter controls
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeFilter = btn.getAttribute('data-filter');
            renderJobsList();
        });
    });

    // Open General Leave button in Leave tab
    const openGeneralLeaveBtn = document.getElementById('openGeneralLeaveBtn');
    if (openGeneralLeaveBtn) {
        openGeneralLeaveBtn.addEventListener('click', () => {
            document.getElementById('leaveJobId').value = '';
            openModal('leaveModal');
        });
    }

    // Daily Log Form Submit
    document.getElementById('dailyLogForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await submitDailyLog();
    });

    // Material Requisition Form Submit
    document.getElementById('materialReqForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await submitMaterialRequisition();
    });

    // Submit Work Form
    document.getElementById('submitWorkForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await submitJobCompletion();
    });

    // Leave Form Submit
    document.getElementById('leaveForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await submitLeaveRequest();
    });
}

// Fetch technician profile
async function loadWorkerProfile() {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/worker/profile', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) {
            console.error(data.message);
            return;
        }

        currentWorker = data.worker;
        renderProfile(currentWorker);
    } catch (err) {
        console.error('Error fetching worker profile:', err);
    }
}

function renderProfile(worker) {
    if (!worker) return;

    // Header
    document.getElementById('workerName').textContent = worker.name;
    const ratingVal = Number(worker.rating || 5.0).toFixed(1);
    document.getElementById('workerHeaderRating').innerHTML = `<i class="fas fa-star"></i> ${ratingVal}`;

    if (worker.company_id && worker.company_id.company_name) {
        document.getElementById('companyAffiliation').textContent = worker.company_id.company_name;
    }

    // Profile Card
    document.getElementById('workerAvatar').textContent = (worker.name || 'W').charAt(0).toUpperCase();
    document.getElementById('workerCardName').textContent = worker.name;
    document.getElementById('workerCardPhone').innerHTML = `<i class="fas fa-phone"></i> ${worker.phone} | <i class="fas fa-tools"></i> ${worker.experience || 1} Years Experience`;

    // Skills
    const skillsContainer = document.getElementById('workerSkillsTags');
    skillsContainer.innerHTML = '';
    (worker.skills || []).forEach(skill => {
        const pill = document.createElement('span');
        pill.className = 'skill-tag';
        pill.textContent = skill;
        skillsContainer.appendChild(pill);
    });

    // Rating
    const count = worker.rating_count || (worker.reviews ? worker.reviews.length : 0);
    document.getElementById('ratingDisplay').textContent = `${ratingVal} ★`;
    document.getElementById('reviewCountDisplay').textContent = `(${count} Reviews)`;
    document.getElementById('ratingSummaryPill').innerHTML = `<i class="fas fa-award"></i> Technician Score: <strong>${ratingVal} / 5.0</strong> (${count} Verified Reviews)`;

    // Render Reviews Tab
    renderReviews(worker.reviews || []);

    renderComplaints(worker.complaints || [], worker.reviews || []);

    // Render Leave Tab
    renderLeaveRecords(worker.leave_records || []);
}

function renderReviews(reviews) {
    const list = document.getElementById('reviewsList');
    if (!reviews || reviews.length === 0) {
        list.innerHTML = '<div class="empty-state"><i class="fas fa-comment-slash fa-2x" style="margin-bottom:10px;display:block;"></i>No customer reviews yet. Ratings will show here as homeowners review completed jobs.</div>';
        return;
    }

    list.innerHTML = reviews.map(rev => `
        <div class="review-card">
            <div class="review-card-header">
                <div>
                    <span class="review-customer-name">${escapeHtml(rev.customer_name || 'Homeowner')}</span>
                    ${rev.service ? `<span style="font-size:0.75rem; color:#64748b; margin-left:8px;">(${escapeHtml(rev.service)})</span>` : ''}
                </div>
                <div class="review-stars">
                    ${'★'.repeat(rev.rating || 5)}${'☆'.repeat(Math.max(0, 5 - (rev.rating || 5)))}
                    <strong style="margin-left:4px;">${rev.rating}/5</strong>
                </div>
            </div>
            <div class="review-sub-ratings">
                <span><i class="fas fa-clock"></i> Punctuality: ${rev.punctuality || 5}/5</span>
                <span><i class="fas fa-wrench"></i> Craftsmanship: ${rev.craftsmanship || 5}/5</span>
                <span><i class="fas fa-calendar-alt"></i> ${new Date(rev.created_at || Date.now()).toLocaleDateString()}</span>
            </div>
            ${rev.comment ? `<p class="review-comment">"${escapeHtml(rev.comment)}"</p>` : '<p style="font-size:0.85rem; color:#94a3b8; font-style:italic;">Customer rated without extra comments.</p>'}
            ${rev.complaint ? `<p class="review-comment" style="background:#fef2f2; color:#991b1b;">Complaint: ${escapeHtml(rev.complaint)}</p>` : ''}
        </div>
    `).join('');
}

function renderComplaints(complaints, reviews) {
    const list = document.getElementById('complaintsList');
    if (!list) return;
    const fromReviews = (reviews || []).filter(r => r.complaint && String(r.complaint).trim());
    const items = (complaints && complaints.length)
        ? complaints
        : fromReviews.map(r => ({
            customer_name: r.customer_name,
            text: r.complaint,
            about: "worker",
            service: r.service,
            created_at: r.created_at
        }));

    if (!items.length) {
        list.innerHTML = '<div class="empty-state">No customer complaints yet.</div>';
        return;
    }

    list.innerHTML = items.slice().reverse().map(c => `
        <div class="review-card" style="border-color:#fecaca;">
            <div class="review-card-header">
                <span class="review-customer-name">${escapeHtml(c.customer_name || "Homeowner")}</span>
                <span style="background:#fee2e2; color:#991b1b; font-size:0.75rem; font-weight:700; padding:3px 8px; border-radius:12px;">${escapeHtml(c.about || "complaint")}</span>
            </div>
            <p class="review-comment" style="background:#fef2f2; color:#7f1d1d;">${escapeHtml(c.text)}</p>
            <div class="review-sub-ratings">
                ${c.service ? `<span>${escapeHtml(c.service)}</span>` : ""}
                <span>${new Date(c.created_at || Date.now()).toLocaleDateString()}</span>
            </div>
        </div>
    `).join("");
}

function renderLeaveRecords(leaves) {
    const container = document.getElementById('leaveRecordsContainer');
    if (!leaves || leaves.length === 0) {
        container.innerHTML = '<div class="empty-state">No leave applications on file. Use "Request Leave" above if you will be unavailable.</div>';
        return;
    }

    container.innerHTML = `
        <table style="width:100%; border-collapse:collapse; font-size:0.88rem;">
            <thead>
                <tr style="border-bottom:2px solid #e2e8f0; text-align:left; color:#64748b;">
                    <th style="padding:8px;">Date</th>
                    <th style="padding:8px;">Reason</th>
                    <th style="padding:8px;">Status</th>
                    <th style="padding:8px;">Requested On</th>
                </tr>
            </thead>
            <tbody>
                ${leaves.map(l => `
                    <tr style="border-bottom:1px solid #f1f5f9;">
                        <td style="padding:10px 8px; font-weight:600; color:#0f172a;">${l.date}</td>
                        <td style="padding:10px 8px; color:#475569;">${escapeHtml(l.reason)}</td>
                        <td style="padding:10px 8px;">
                            <span style="background:${l.status === 'approved' ? '#d1fae5' : '#fef3c7'}; color:${l.status === 'approved' ? '#065f46' : '#92400e'}; padding:3px 8px; border-radius:12px; font-size:0.75rem; font-weight:700; text-transform:uppercase;">
                                ${l.status}
                            </span>
                        </td>
                        <td style="padding:10px 8px; color:#94a3b8; font-size:0.8rem;">
                            ${new Date(l.requested_at || Date.now()).toLocaleDateString()}
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

// Fetch assigned service jobs
async function loadAssignedJobs() {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/worker/my-jobs', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) {
            console.error(data.message);
            return;
        }

        currentJobs = data.jobs || [];
        updateJobCounts();
        renderJobsList();
    } catch (err) {
        console.error('Error fetching jobs:', err);
    }
}

function updateJobCounts() {
    const active = currentJobs.filter(j => j.status !== 'completed' && j.status !== 'cancelled').length;
    const completed = currentJobs.filter(j => j.status === 'completed').length;
    document.getElementById('activeJobsCount').textContent = active;
    document.getElementById('completedJobsCount').textContent = completed;
}

function renderJobsList() {
    const grid = document.getElementById('jobsGrid');
    if (!grid) return;

    let filtered = currentJobs;
    if (activeFilter === 'active') {
        filtered = currentJobs.filter(j => j.status !== 'completed' && j.status !== 'cancelled');
    }

    if (filtered.length === 0) {
        grid.innerHTML = '<div class="empty-state" style="grid-column: 1 / -1;"><i class="fas fa-clipboard-check fa-3x" style="color:#cbd5e1; margin-bottom:12px; display:block;"></i>No service jobs currently found in this category.</div>';
        return;
    }

    grid.innerHTML = filtered.map(job => {
        const startDate = job.start_date || (job.quotation ? job.quotation.start_date : null) || job.preferred_date || 'Scheduled Soon';
        const endDate = job.end_date || (job.quotation ? job.quotation.end_date : null) || 'Ongoing';

        // Check if there are replacements
        const replacements = job.worker_replacements || [];
        const myReplacement = replacements.find(r => r.original_worker_id === (currentWorker ? currentWorker._id : null));

        // Daily updates count
        const updates = job.daily_updates || [];
        const requisitions = job.material_requisitions || [];
        const me = (job.assigned_workers || []).find(w => currentWorker && String(w.worker_id) === String(currentWorker._id));
        const onSite = me && me.on_site;

        return `
            <div class="job-card" id="card-${job._id}">
                <div class="job-card-header">
                    <div>
                        <span class="service-title">${escapeHtml(job.service)}</span>
                        <div style="font-size:0.8rem; color:#64748b;">Customer: <strong>${escapeHtml(job.customer_name || 'Homeowner')}</strong></div>
                    </div>
                    <span class="badge badge-${job.status}">${job.status.replace('_', ' ')}</span>
                </div>

                ${onSite ? '<div class="on-site-banner"><i class="fas fa-map-marker-alt"></i> You are checked in on site</div>' : ''}

                <div class="date-window-box">
                    <i class="fas fa-calendar-alt" style="color:var(--primary); margin-right:6px;"></i>
                    Job Schedule: <strong>${startDate}</strong> to <strong>${endDate}</strong>
                </div>

                <div class="job-meta-row">
                    <i class="fas fa-map-marker-alt"></i>
                    <div>
                        <strong>Service Address:</strong>
                        <div>${escapeHtml(job.service_address)}</div>
                    </div>
                </div>

                <div class="job-meta-row">
                    <i class="fas fa-phone-alt"></i>
                    <div>
                        <strong>Customer Contact:</strong>
                        <div>
                            <a href="tel:${job.customer_phone}" style="color:var(--primary); text-decoration:none; font-weight:600;">
                                <i class="fas fa-phone"></i> ${escapeHtml(job.customer_phone || 'N/A')}
                            </a>
                        </div>
                    </div>
                </div>

                <div class="job-description-box">
                    <strong>Reported Issue:</strong> ${escapeHtml(job.description)}
                </div>

                ${myReplacement ? `
                    <div class="replacement-alert-note">
                        <i class="fas fa-info-circle"></i> On ${myReplacement.date}: You took leave. Replacement technician <strong>${escapeHtml(myReplacement.replacement_worker_name)}</strong> was assigned for that day.
                    </div>
                ` : ''}

                <!-- Accordion: Daily Work Logs -->
                <details class="daily-logs-accordion">
                    <summary><i class="fas fa-history"></i> Daily Progress Logs (${updates.length})</summary>
                    <div style="margin-top:8px;">
                        ${updates.length === 0 ? '<div style="color:#94a3b8; font-style:italic;">No daily logs submitted yet.</div>' : updates.map(u => `
                            <div class="log-item">
                                <div class="log-item-header">
                                    <span>Day ${u.day_number} (${u.date})</span>
                                    <span style="font-size:0.75rem; color:#64748b;">${u.logged_by_worker_name || 'Tech'}</span>
                                </div>
                                <div style="color:#334155; margin-top:2px;">${escapeHtml(u.work_done)}</div>
                                ${u.photo ? `<a href="${u.photo}" target="_blank" style="display:inline-block; margin-top:4px; font-size:0.75rem; color:var(--primary);"><i class="fas fa-image"></i> View Site Photo</a>` : ''}
                            </div>
                        `).join('')}
                    </div>
                </details>

                <details class="mat-req-accordion">
                    <summary><i class="fas fa-tools"></i> Parts used (${requisitions.length})</summary>
                    <div style="margin-top:6px;">
                        ${requisitions.length === 0 ? '<div style="color:#166534; font-style:italic;">No parts logged yet. Add van stock or a shop purchase.</div>' : requisitions.map(m => `
                            <span class="mat-item-pill">
                                <strong>${escapeHtml(m.item_name)}</strong>: ${escapeHtml(m.quantity)}
                                <span style="font-size:0.7rem; color:#047857;">(${m.source === 'local_purchase' ? 'shop' : 'van'}${Number(m.total_cost) > 0 ? ' ₹' + Number(m.total_cost).toFixed(2) : ''})</span>
                            </span>
                        `).join('')}
                    </div>
                </details>

                <!-- Actions -->
                <div class="job-actions-row">
                    ${job.status !== 'completed' ? `
                        ${onSite
                            ? `<button class="btn-warning" onclick="toggleSitePresence('${job._id}', 'out')"><i class="fas fa-sign-out-alt"></i> Check out</button>`
                            : `<button class="btn-success" onclick="toggleSitePresence('${job._id}', 'in')"><i class="fas fa-sign-in-alt"></i> Check in</button>`
                        }
                        <button class="btn-primary" onclick="openDailyLogModal('${job._id}')">
                            <i class="fas fa-plus-circle"></i> Post Day Log
                        </button>
                        <button class="btn-secondary" onclick="openMaterialModal('${job._id}')">
                            <i class="fas fa-box-open"></i> Add / Buy Parts
                        </button>
                        <button class="btn-success" onclick="openSubmitWorkModal('${job._id}')">
                            <i class="fas fa-check-circle"></i> Finish Work
                        </button>
                        <button class="btn-warning" onclick="openLeaveModalForJob('${job._id}')" title="Cannot work on a day? Request a replacement">
                            <i class="fas fa-calendar-times"></i> Leave / Off
                        </button>
                    ` : `
                        <span style="color:#059669; font-weight:600; font-size:0.85rem; display:flex; align-items:center; gap:6px;">
                            <i class="fas fa-check-double"></i> Job Finished & Handed Over
                        </span>
                    `}
                </div>
            </div>
        `;
    }).join('');
}

// Modal Openers
function openDailyLogModal(reqId) {
    const job = currentJobs.find(j => j._id === reqId);
    const me = (job && job.assigned_workers || []).find(w => currentWorker && String(w.worker_id) === String(currentWorker._id));
    if (!me || !me.on_site) {
        alert("⚠️ Check-In Required: You must check in at the job site before you can post daily work updates.");
        return;
    }

    document.getElementById('dailyLogReqId').value = reqId;
    document.getElementById('dailyLogWorkDone').value = '';
    if (job && job.daily_updates) {
        document.getElementById('dailyLogDayNumber').value = (job.daily_updates.length + 1);
    } else {
        document.getElementById('dailyLogDayNumber').value = 1;
    }
    openModal('dailyLogModal');
}

function openMaterialModal(jobId) {
    document.getElementById('materialReqJobId').value = jobId;
    document.getElementById('matItemName').value = '';
    document.getElementById('matQuantity').value = '';
    document.getElementById('matPurpose').value = '';
    document.getElementById('matShopName').value = '';
    document.getElementById('matUnitPrice').value = '';
    document.getElementById('matReceipt').value = '';
    selectedCatalogItem = null;
    document.getElementById('vanQtyRow').style.display = 'none';
    document.getElementById('vanAddActions').style.display = 'none';

    const job = currentJobs.find(j => j._id === jobId);
    const container = document.getElementById('existingMaterialsList');
    if (job && job.material_requisitions && job.material_requisitions.length > 0) {
        container.innerHTML = job.material_requisitions.map(m => `
            <div style="padding:5px 0; border-bottom:1px dashed #cbd5e1; font-size:0.83rem;">
                <strong>${escapeHtml(m.item_name)}</strong> — ${escapeHtml(m.quantity)}
                <span style="float:right; font-size:0.75rem; color:#2563eb; font-weight:600;">${m.source === 'local_purchase' ? 'Shop buy' : 'Van stock'}</span>
                <div style="color:#64748b; font-size:0.75rem;">
                    ${escapeHtml(m.shop_name || '')}${Number(m.total_cost) > 0 ? ' · ₹' + Number(m.total_cost).toFixed(2) : ''}
                    ${m.receipt_photo ? ` · <a href="${m.receipt_photo}" target="_blank">receipt</a>` : ''}
                </div>
            </div>
        `).join('');
    } else {
        container.innerHTML = '<em>No parts logged yet for this job.</em>';
    }

    renderPartsCatalogGrid();
    openModal('materialReqModal');
}

function openSubmitWorkModal(reqId) {
    document.getElementById('submitWorkReqId').value = reqId;
    document.getElementById('submitWorkNotes').value = '';
    openModal('submitWorkModal');
}

function openLeaveModalForJob(jobId) {
    document.getElementById('leaveJobId').value = jobId;
    openModal('leaveModal');
}

function openModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.add('active');
}

function closeModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.remove('active');
}

// Submissions
async function submitDailyLog() {
    const reqId = document.getElementById('dailyLogReqId').value;
    const date = document.getElementById('dailyLogDate').value;
    const day_number = document.getElementById('dailyLogDayNumber').value;
    const work_done = document.getElementById('dailyLogWorkDone').value.trim();
    const photoFile = document.getElementById('dailyLogPhoto').files[0];

    if (!date || !work_done) {
        alert('Please fill out the work date and work done description.');
        return;
    }

    const formData = new FormData();
    formData.append('date', date);
    formData.append('day_number', day_number);
    formData.append('work_done', work_done);
    if (photoFile) {
        formData.append('photo', photoFile);
    }

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/worker/jobs/${reqId}/daily-update`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        const data = await res.json();
        if (!res.ok) {
            alert(data.message || 'Failed to post daily work log.');
            return;
        }

        alert('Daily work progress successfully logged!');
        closeModal('dailyLogModal');
        await loadAssignedJobs();
    } catch (err) {
        console.error(err);
        alert('Error posting work log.');
    }
}

async function loadPartsCatalog() {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/worker/parts-catalog', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok) partsCatalog = data.catalog || [];
    } catch (err) {
        console.error('Catalog load error:', err);
    }
}

function renderPartsCatalogGrid() {
    const grid = document.getElementById('partsCatalogGrid');
    if (!grid) return;
    const grouped = {};
    partsCatalog.forEach(p => {
        grouped[p.category] = grouped[p.category] || [];
        grouped[p.category].push(p);
    });
    grid.innerHTML = Object.keys(grouped).map(cat => `
        <div class="catalog-group">
            <div class="catalog-group-title">${escapeHtml(cat)}</div>
            <div class="catalog-chips">
                ${grouped[cat].map(p => `
                    <button type="button" class="catalog-chip ${selectedCatalogItem && selectedCatalogItem.id === p.id ? 'selected' : ''}" onclick="selectCatalogPart('${p.id}')">
                        ${escapeHtml(p.name)}
                        <small>₹${p.typical_price}/${escapeHtml(p.unit)}</small>
                    </button>
                `).join('')}
            </div>
        </div>
    `).join('');
}

function selectCatalogPart(id) {
    selectedCatalogItem = partsCatalog.find(p => p.id === id) || null;
    if (!selectedCatalogItem) return;
    document.getElementById('vanSelectedName').value = selectedCatalogItem.name;
    document.getElementById('vanQuantity').value = `1 ${selectedCatalogItem.unit}`;
    document.getElementById('vanQtyRow').style.display = 'flex';
    document.getElementById('vanAddActions').style.display = 'flex';
    renderPartsCatalogGrid();
}

async function submitVanStockPart() {
    const jobId = document.getElementById('materialReqJobId').value;
    const quantity = document.getElementById('vanQuantity').value.trim();
    if (!selectedCatalogItem || !quantity) {
        alert('Select a van-stock part and enter quantity.');
        return;
    }
    await postMaterial(jobId, {
        source: 'van_stock',
        catalog_id: selectedCatalogItem.id,
        item_name: selectedCatalogItem.name,
        quantity,
        unit_price: selectedCatalogItem.typical_price
    });
}

async function submitMaterialRequisition() {
    const jobId = document.getElementById('materialReqJobId').value;
    const item_name = document.getElementById('matItemName').value.trim();
    const quantity = document.getElementById('matQuantity').value.trim();
    const purpose = document.getElementById('matPurpose').value.trim();
    const shop_name = document.getElementById('matShopName').value.trim();
    const unit_price = document.getElementById('matUnitPrice').value;
    const receipt = document.getElementById('matReceipt').files[0];

    if (!item_name || !quantity) {
        alert('Enter the product name and quantity you bought.');
        return;
    }

    const formData = new FormData();
    formData.append('source', 'local_purchase');
    formData.append('item_name', item_name);
    formData.append('quantity', quantity);
    formData.append('purpose', purpose);
    formData.append('shop_name', shop_name);
    formData.append('unit_price', unit_price || '0');
    if (receipt) formData.append('receipt', receipt);

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/worker/jobs/${jobId}/requisition`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        const data = await res.json();
        if (!res.ok) {
            alert(data.message || 'Failed to log shop purchase.');
            return;
        }
        alert(data.message || 'Shop purchase saved.');
        closeModal('materialReqModal');
        await loadAssignedJobs();
    } catch (err) {
        console.error(err);
        alert('Error saving shop purchase.');
    }
}

async function postMaterial(jobId, payload) {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/worker/jobs/${jobId}/requisition`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) {
            alert(data.message || 'Failed to add part.');
            return;
        }
        alert(data.message || 'Part added.');
        closeModal('materialReqModal');
        await loadAssignedJobs();
    } catch (err) {
        console.error(err);
        alert('Error adding part.');
    }
}

async function toggleSitePresence(jobId, action) {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/worker/jobs/${jobId}/check-${action === 'out' ? 'out' : 'in'}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) {
            alert(data.message || 'Could not update site presence.');
            return;
        }
        alert(data.message);
        await loadAssignedJobs();
    } catch (err) {
        console.error(err);
        alert('Error updating check-in.');
    }
}

async function submitJobCompletion() {
    const reqId = document.getElementById('submitWorkReqId').value;
    const completion_notes = document.getElementById('submitWorkNotes').value.trim();
    const files = document.getElementById('submitWorkPhotos').files;

    if (!completion_notes) {
        alert('Please enter completion notes.');
        return;
    }

    const formData = new FormData();
    formData.append('work_notes', completion_notes);
    for (let i = 0; i < files.length; i++) {
        formData.append('after_photos', files[i]);
    }

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/worker/jobs/${reqId}/submit-work`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        const data = await res.json();
        if (!res.ok) {
            alert(data.message || 'Failed to submit work.');
            return;
        }

        alert('Service work marked complete and submitted for customer signoff!');
        closeModal('submitWorkModal');
        await loadAssignedJobs();
    } catch (err) {
        console.error(err);
        alert('Error submitting work.');
    }
}

async function submitLeaveRequest() {
    const date = document.getElementById('leaveDate').value;
    const reason = document.getElementById('leaveReason').value.trim();
    const jobId = document.getElementById('leaveJobId').value;

    if (!date || !reason) {
        alert('Please provide the date and reason for absence.');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/worker/jobs/${jobId || 'general'}/request-leave`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ date, reason })
        });
        const data = await res.json();
        if (!res.ok) {
            alert(data.message || 'Failed to apply for leave.');
            return;
        }

        alert('Leave application submitted. Company notified to arrange substitute technician if needed.');
        closeModal('leaveModal');
        await loadWorkerProfile();
        await loadAssignedJobs();
    } catch (err) {
        console.error(err);
        alert('Error applying for leave.');
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, function (m) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[m];
    });
}
