const token=localStorage.getItem("token");
if(!token)window.location.href="login.html";

// Browser Back Arrow (<-) handler: navigate to login page and clear all fields
window.history.pushState(null, "", window.location.href);
window.addEventListener("popstate", function() {
    try {
        localStorage.clear();
        sessionStorage.clear();
    } catch(e) {}
    window.location.replace("login.html");
});

let company=null;
let workers=[];

function today(){
    const d=new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

async function loadDashboard(){
    try{
        const r=await fetch("/api/company/dashboard",{headers:{Authorization:`Bearer ${token}`}});
        const d=await r.json();

        if(r.status===401||r.status===403){
            localStorage.removeItem("token");
            window.location.href="login.html";
            return;
        }

        if(!r.ok)throw new Error(d.message||"Unable to load dashboard.");

        company=d.company;

        set("companyName",company.company_name);
        set("welcomeName",company.owner_name);
        set("dashboardOwner",company.owner_name);
        set("profileCompanyName",company.company_name);
        set("profileCity",company.city);
        set("profileCity2",company.city);
        set("ownerName",company.owner_name);
        set("email",company.email);
        set("phone",company.phone);
        set("experience",`${company.experience||0} years`);
        set("profileTotalWorkers",company.total_workers||0);
        set("address",company.address);
        set("description",company.description);
        set("companyDescription",company.description);

        const c=(company.company_name||"C").charAt(0).toUpperCase();
        const o=(company.owner_name||"O").charAt(0).toUpperCase();
        set("topAvatar",c);
        set("profileAvatar",c);
        set("ownerAvatar",o);

        displayServices();

        const date=document.getElementById("workerDate");
        if(date&&!date.value)date.value=today();

        await loadWorkersForDate();
    }catch(e){
        console.error(e);
        alert(e.message);
    }
}

function set(id,value){
    const el=document.getElementById(id);
    if(el)el.textContent=value||"-";
}

function displayServices(){
    const services=company?.services||[];
    const icon={
        Plumbing:"🔧",
        Electrical:"⚡",
        Painting:"🎨",
        Carpentry:"🪚",
        Cleaning:"🧹",
        "Home Repair":"🏠"
    };

    ["dashboardServices","servicesList","serviceCards"].forEach(id=>{
        const el=document.getElementById(id);
        if(el)el.innerHTML="";
    });

    services.forEach(s=>{
        const html=`<div class="service-card"><div style="font-size:30px">${icon[s]||"🛠️"}</div><h3>${s}</h3></div>`;
        ["dashboardServices","servicesList","serviceCards"].forEach(id=>{
            const el=document.getElementById(id);
            if(el)el.innerHTML+=html;
        });
    });
}

async function loadWorkersForDate(){
    const date=document.getElementById("workerDate")?.value;
    if(!date)return;

    const list=document.getElementById("workerList");
    list.innerHTML=`<div class="empty">Loading workers...</div>`;

    try{
        const r=await fetch(`/api/company/workers/availability/${date}`,{
            headers:{Authorization:`Bearer ${token}`}
        });
        const d=await r.json();

        if(r.status===401||r.status===403){
            localStorage.removeItem("token");
            window.location.href="login.html";
            return;
        }

        if(!r.ok)throw new Error(d.message||"Unable to load workers.");

        workers=d.workers||[];
        displayWorkers();
    }catch(e){
        list.innerHTML=`<div class="empty"><h3>Unable to load workers</h3><p>${e.message}</p></div>`;
    }
}

function displayWorkers(){
    const list=document.getElementById("workerList");
    list.innerHTML="";

    let a=0,b=0,w=0,l=0;

    if(!workers.length){
        list.innerHTML=`<div class="empty"><div style="font-size:40px">👷</div><h3>No workers added</h3><p>Add workers to manage availability.</p></div>`;
        updateCounts(0,0,0,0);
        return;
    }

    workers.forEach(x=>{
        const s=x.status||"available";
        if(s==="available")a++;
        if(s==="busy")b++;
        if(s==="wants_work")w++;
        if(s==="on_leave")l++;

        const skills=(x.skills||[]).map(v=>`<span class="skill">${v}</span>`).join("");
        const initial=(x.name||"W").charAt(0).toUpperCase();

        list.innerHTML+=`
        <div class="worker-card">
            <div class="worker-header">
                <div class="worker-info">
                    <div class="worker-avatar">${initial}</div>
                    <div>
                        <h3>${x.name}</h3>
                        <p>${x.phone||"No phone"}</p>
                    </div>
                </div>
                <span class="worker-status status-${s}">${statusText(s)}</span>
            </div>

            <div class="worker-details">
                <div><strong>Experience:</strong> ${x.experience||0} years</div>
                <div><strong>Skills:</strong></div>
                <div class="worker-skills">${skills}</div>
            </div>

            <div class="worker-login-credentials" style="background:#f0fdf4; border:1px solid #86efac; border-radius:8px; padding:10px 12px; margin:12px 0; font-size:13px;">
                <div style="color:#15803d; font-weight:700; margin-bottom:5px; display:flex; align-items:center; gap:6px;">
                    <span>🔑 Worker Portal Login Info:</span>
                </div>
                <div style="color:#1e293b; margin:2px 0; display:flex; justify-content:space-between; align-items:center;">
                    <span style="color:#475569;">Login Phone/User:</span>
                    <strong style="background:#e2e8f0; color:#0f172a; padding:2px 8px; border-radius:4px; font-family:monospace;">${x.phone}</strong>
                </div>
                <div style="color:#1e293b; margin:3px 0; display:flex; justify-content:space-between; align-items:center;">
                    <span style="color:#475569;">Login Password:</span>
                    <strong style="background:#dcfce7; color:#166534; padding:2px 8px; border-radius:4px; font-family:monospace; border:1px solid #86efac;">${x.initial_password || "worker123"}</strong>
                </div>
                <div style="color:#64748b; font-size:11px; margin-top:5px; border-top:1px dashed #bbf7d0; padding-top:4px;">
                    Worker can log in at <a href="login.html" target="_blank" style="color:#0284c7; text-decoration:underline; font-weight:600;">login.html</a> with role <strong>Worker</strong>.
                </div>
            </div>

            <div class="worker-actions">
                <button class="available-btn" onclick="updateWorkerStatus('${x._id}','available')">Available</button>
                <button class="busy-btn" onclick="updateWorkerStatus('${x._id}','busy')">Busy</button>
                <button class="want-btn" onclick="updateWorkerStatus('${x._id}','wants_work')">Want Work</button>
                <button class="leave-btn" onclick="updateWorkerStatus('${x._id}','on_leave')">On Leave</button>
                <button class="busy-btn" style="background:#fee2e2; color:#b91c1c; border:1px solid #fca5a5;" onclick="removeWorker('${x._id}', '${escapeHtml(x.name)}')">🗑️ Remove Worker</button>
            </div>
        </div>`;
    });

    updateCounts(a,b,w,l);
    set("totalWorkers",workers.length);
    set("availableWorkers",a);
    set("busyWorkers",b);
    set("wantWorkers",w);
}

function statusText(s){
    if(s==="available")return"AVAILABLE";
    if(s==="busy")return"BUSY";
    if(s==="wants_work")return"WANT WORK";
    if(s==="on_leave")return"ON LEAVE";
    return"AVAILABLE";
}

function updateCounts(a,b,w,l){
    set("workerAvailable",a);
    set("workerBusy",b);
    set("workerWant",w);
    set("workerLeave",l);
}

async function updateWorkerStatus(id,status){
    const date=document.getElementById("workerDate").value;
    if(!date)return alert("Please select a date.");

    try{
        const r=await fetch(`/api/company/workers/${id}/availability`,{
            method:"PUT",
            headers:{
                "Content-Type":"application/json",
                Authorization:`Bearer ${token}`
            },
            body:JSON.stringify({date,status})
        });

        const d=await r.json();
        if(!r.ok)throw new Error(d.message||"Unable to update status.");

        await loadWorkersForDate();
    }catch(e){
        alert(e.message);
    }
}

async function addWorker(){
    const name=document.getElementById("workerName").value.trim();
    const phone=document.getElementById("workerPhone").value.trim();
    const email=document.getElementById("workerEmail").value.trim();
    const experience=document.getElementById("workerExperience").value;
    const password=(document.getElementById("workerPassword") ? document.getElementById("workerPassword").value.trim() : "") || "worker123";
    const skills=[...document.querySelectorAll(".checkboxes input:checked")].map(x=>x.value);

    if(!name||!phone||!skills.length){
        return alert("Enter name, phone and at least one skill.");
    }

    try{
        const r=await fetch("/api/company/workers",{
            method:"POST",
            headers:{
                "Content-Type":"application/json",
                Authorization:`Bearer ${token}`
            },
            body:JSON.stringify({name,phone,email,experience,skills,password})
        });

        const d=await r.json();
        if(!r.ok)throw new Error(d.message||"Unable to add worker.");

        closeWorker();

        document.getElementById("workerName").value="";
        document.getElementById("workerPhone").value="";
        document.getElementById("workerEmail").value="";
        document.getElementById("workerExperience").value="";
        if(document.getElementById("workerPassword")) document.getElementById("workerPassword").value="worker123";
        document.querySelectorAll(".checkboxes input").forEach(x=>x.checked=false);

        await loadDashboard();
        alert(`Worker added successfully. Worker login password is: ${password}`);
    }catch(e){
        alert(e.message);
    }
}

function openWorker(){
    document.getElementById("workerModal").classList.add("show");
}

function closeWorker(){
    document.getElementById("workerModal").classList.remove("show");
}

function openCompanyEdit(){
    if(!company)return;

    document.getElementById("editCompanyName").value=company.company_name||"";
    document.getElementById("editOwner").value=company.owner_name||"";
    document.getElementById("editPhone").value=company.phone||"";
    document.getElementById("editCity").value=company.city||"";
    document.getElementById("editExperience").value=company.experience||0;
    document.getElementById("editWorkers").value=company.total_workers||0;
    document.getElementById("editAddress").value=company.address||"";
    document.getElementById("editDescription").value=company.description||"";

    document.getElementById("companyModal").classList.add("show");
}

function closeCompanyEdit(){
    document.getElementById("companyModal").classList.remove("show");
}

async function updateCompany(){
    const data={
        company_name:document.getElementById("editCompanyName").value.trim(),
        owner_name:document.getElementById("editOwner").value.trim(),
        phone:document.getElementById("editPhone").value.trim(),
        city:document.getElementById("editCity").value.trim(),
        experience:Number(document.getElementById("editExperience").value),
        total_workers:Number(document.getElementById("editWorkers").value),
        address:document.getElementById("editAddress").value.trim(),
        description:document.getElementById("editDescription").value.trim(),
        services:company.services
    };

    try{
        const r=await fetch("/api/company/update",{
            method:"PUT",
            headers:{
                "Content-Type":"application/json",
                Authorization:`Bearer ${token}`
            },
            body:JSON.stringify(data)
        });

        const d=await r.json();
        if(!r.ok)throw new Error(d.message||"Update failed.");

        closeCompanyEdit();
        await loadDashboard();
        alert("Company details updated successfully.");
    }catch(e){
        alert(e.message);
    }
}

function show(id,button){
    document.querySelectorAll("main section").forEach(x=>x.classList.add("hidden"));
    const target = document.getElementById(id);
    if(target) target.classList.remove("hidden");
    document.querySelectorAll("aside button").forEach(x=>x.classList.remove("active"));
    if(button) button.classList.add("active");

    if(id==="workers"){
        const date=document.getElementById("workerDate");
        if(date && !date.value)date.value=today();
        loadWorkersForDate();
    } else if(id==="requests"){
        loadCompanyRequests();
    } else if(id==="chats"){
        loadCompanyChats();
    }
}

// ===================================================
// COMPANY SERVICE REQUESTS & QUOTATIONS
// ===================================================

let allCompanyRequests = [];
let currentFilter = "all";

async function loadCompanyRequests(){
    try {
        const r = await fetch("/api/company/requests", {
            headers: { Authorization: `Bearer ${token}` }
        });
        if(!r.ok) throw new Error("Unable to load requests.");
        const d = await r.json();
        allCompanyRequests = d.requests || [];
        window.companyRequestsData = allCompanyRequests;

        updateRequestCounts();
        renderCompanyRequests();
    } catch(e){
        console.error("Load company requests error:", e);
        const list = document.getElementById("companyRequestsList");
        if(list) list.innerHTML = `<div class="empty"><h3>Failed to load requests</h3><p>${e.message}</p></div>`;
    }
}

function updateRequestCounts(){
    const pending = allCompanyRequests.filter(r => r.status === "requested").length;
    const confirmed = allCompanyRequests.filter(r => r.status === "confirmed").length;
    const inProg = allCompanyRequests.filter(r => r.status === "in_progress" || r.status === "workers_assigned").length;
    const comp = allCompanyRequests.filter(r => r.status === "completed").length;

    const b = document.getElementById("pendingRequestsBadge");
    if(b){
        if(pending > 0){
            b.textContent = pending;
            b.style.display = "inline-block";
        } else {
            b.style.display = "none";
        }
    }

    const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
    setVal("countAllReqs", allCompanyRequests.length);
    setVal("countPendingReqs", pending);
    setVal("countConfirmedReqs", confirmed);
    setVal("countProgressReqs", inProg);
    setVal("countCompletedReqs", comp);
}

function filterCompanyRequests(status, btn){
    currentFilter = status;
    document.querySelectorAll(".filter-tab-btn").forEach(b => b.classList.remove("active"));
    if(btn) btn.classList.add("active");
    renderCompanyRequests();
}

function renderCompanyRequests(){
    const list = document.getElementById("companyRequestsList");
    if(!list) return;

    let filtered = [...allCompanyRequests];
    if(currentFilter === "requested"){
        filtered = filtered.filter(r => r.status === "requested");
    } else if(currentFilter === "confirmed"){
        filtered = filtered.filter(r => r.status === "confirmed");
    } else if(currentFilter === "in_progress"){
        filtered = filtered.filter(r => r.status === "in_progress" || r.status === "workers_assigned");
    } else if(currentFilter === "completed"){
        filtered = filtered.filter(r => r.status === "completed");
    }

    if(filtered.length === 0){
        list.innerHTML = `
            <div class="empty">
                <div style="font-size:42px;">📋</div>
                <h3>No service requests found</h3>
                <p>New customer requests with damage photos will appear here.</p>
            </div>
        `;
        return;
    }

    list.innerHTML = "";
    filtered.forEach(req => {
        const card = document.createElement("div");
        card.className = "company-request-card";

        const custName = req.customer_name || "Customer";
        const dateStr = new Date(req.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        const custId = req.customer_id ? (req.customer_id._id || req.customer_id) : "";

        card.innerHTML = `
            <div class="c-req-header">
                <div class="c-req-customer">
                    <div class="c-cust-avatar">${custName.charAt(0).toUpperCase()}</div>
                    <div class="c-cust-info">
                        <h3>${escapeHtml(custName)} — <span style="color:#2563eb;">${escapeHtml(req.service)}</span></h3>
                        <small>Submitted ${dateStr} • Priority: <strong style="text-transform:capitalize;">${escapeHtml(req.priority)}</strong> • 📍 ${escapeHtml(req.service_address)}</small>
                        <small style="display:block; margin-top:4px; color:#059669;">📞 Customer Phone: <strong>${escapeHtml(req.customer_phone || (req.customer_id && req.customer_id.phone) || 'Not provided')}</strong></small>
                    </div>
                </div>
                <span class="c-status-badge ${req.status}">${formatReqStatus(req.status)}</span>
            </div>

            <div class="c-req-body">
                <div>
                    <div class="c-problem-desc">
                        <strong>Customer Problem:</strong> ${escapeHtml(req.description)}
                    </div>

                    ${req.photos && req.photos.length > 0 ? `
                        <div class="c-photos-section" style="margin-top:14px;">
                            <label>📷 Submitted Damage Photos (${req.photos.length}) — Click to Inspect:</label>
                            <div class="c-photos-grid">
                                ${req.photos.map(p => `
                                    <img src="${p}" class="c-photo-thumb" onclick="openCompanyLightbox('${p}', 'Damage Inspection Photo')" alt="Damage">
                                `).join("")}
                            </div>
                        </div>
                    ` : ""}
                </div>

                <!-- Quotation & Worker Overview Column -->
                <div>
                    ${renderReqOverviewColumn(req)}
                </div>
            </div>

            <!-- Action Buttons Footer -->
            <div class="c-req-actions">
                ${renderReqActionButtons(req, custId)}
            </div>
        `;

        list.appendChild(card);
    });
}

function formatReqStatus(s){
    if(s === "requested") return "⏳ Needs Quotation";
    if(s === "quoted") return "📋 Quotation Sent";
    if(s === "confirmed") return "✅ Confirmed by Customer";
    if(s === "workers_assigned") return "👷 Workers Assigned";
    if(s === "in_progress") return "🔨 In Progress";
    if(s === "work_submitted") return "🔍 Work Submitted (Awaiting Sign-off)";
    if(s === "rework_needed") return "⚠️ Rework Requested";
    if(s === "completed") return "🎉 Completed & Verified";
    return s;
}

function renderReqOverviewColumn(req){
    let html = `<div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px; font-size:12px; display:flex; flex-direction:column; gap:8px;">`;

    const startDate = req.start_date || (req.quotation ? req.quotation.start_date : null) || req.preferred_date;
    const endDate = req.end_date || (req.quotation ? req.quotation.end_date : null);

    if(startDate){
        html += `
            <div style="background:#eff6ff; color:#1e40af; padding:6px 10px; border-radius:6px; font-weight:700; border-left:3px solid #2563eb;">
                📅 Service Schedule: ${startDate} ${endDate ? `to ${endDate}` : ''}
            </div>
        `;
    }

    if(req.quotation && req.quotation.estimated_cost){
        html += `
            <div style="color:#166534; font-weight:700;">
                📋 Quotation: Labour ₹${req.quotation.labor_daily_rate || 0}/day × ${req.quotation.workers_needed} worker(s) × ~${req.quotation.estimated_days}d = ₹${req.quotation.labor_total || req.quotation.estimated_cost}
            </div>
        `;
    }

    if(req.assigned_workers && req.assigned_workers.length > 0){
        const names = req.assigned_workers.map(w => w.name).join(", ");
        html += `
            <div style="color:#1e40af;">
                👷 Assigned Technicians: <strong>${escapeHtml(names)}</strong>
            </div>
        `;
    }

    if(req.worker_replacements && req.worker_replacements.length > 0){
        html += `
            <div style="background:#fffbeb; color:#92400e; padding:6px 10px; border-radius:6px; font-weight:600; border-left:3px solid #f59e0b;">
                ${req.worker_replacements.map(rep => `
                    <div>🔄 On ${rep.date}: <strong>${escapeHtml(rep.replacement_worker_name)}</strong> substituted for ${escapeHtml(rep.original_worker_name)} (${escapeHtml(rep.reason)})</div>
                `).join('')}
            </div>
        `;
    }

    if(req.assigned_workers && req.assigned_workers.some(w => w.on_site)){
        const onSite = req.assigned_workers.filter(w => w.on_site).map(w => w.name).join(", ");
        html += `
            <div style="background:#ecfeff; color:#155e75; padding:6px 10px; border-radius:6px; font-weight:600; border-left:3px solid #06b6d4;">
                📍 On site now: <strong>${escapeHtml(onSite)}</strong>
            </div>
        `;
    }

    if(req.time_tracking && (req.time_tracking.check_in_time || req.time_tracking.check_out_time)){
        const inTime = req.time_tracking.check_in_time ? new Date(req.time_tracking.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "None";
        const outTime = req.time_tracking.check_out_time ? new Date(req.time_tracking.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Active";
        html += `
            <div style="background:#f0fdf4; color:#166534; padding:6px 10px; border-radius:6px; font-size:11px; border-left:3px solid #22c55e;">
                ⏱️ <strong>Attendance:</strong> Check-In: <strong>${inTime}</strong> | Check-Out: <strong>${outTime}</strong> ${req.time_tracking.total_minutes ? `(${req.time_tracking.total_minutes}m)` : ''}
            </div>
        `;
    }

    if(req.material_requisitions && req.material_requisitions.length > 0){
        html += `
            <div style="background:#f0fdf4; color:#166534; padding:6px 10px; border-radius:6px; border-left:3px solid #10b981;">
                <strong>🧱 Parts used (${req.material_requisitions.length}):</strong>
                <div style="margin-top:2px;">${req.material_requisitions.map(m => {
                    const src = m.source === "local_purchase" ? "shop buy" : "van stock";
                    const cost = Number(m.total_cost || 0) > 0 ? ` · ₹${Number(m.total_cost).toFixed(2)}` : "";
                    return `<span>${escapeHtml(m.item_name)} (${escapeHtml(m.quantity)}, ${src}${cost})</span>`;
                }).join(", ")}</div>
            </div>
        `;
    }

    if(req.daily_updates && req.daily_updates.length > 0){
        html += `
            <div style="color:#b45309;">
                📅 Technician daily logs (${req.daily_updates.length}):
                <div style="margin-top:4px; display:flex; flex-direction:column; gap:4px;">
                    ${req.daily_updates.slice(-3).reverse().map(u => `
                        <div style="font-weight:500; color:#92400e;">Day ${u.day_number} · ${escapeHtml(u.logged_by_worker_name || "Technician")}: ${escapeHtml(u.work_done)}</div>
                    `).join("")}
                </div>
            </div>
        `;
    }

    if(req.status === "work_submitted"){
        html += `
            <div style="background:#fef9c3; color:#854d0e; padding:6px 10px; border-radius:6px; font-weight:700;">
                🔍 Work Submitted — Awaiting Customer Inspection & Sign-off
            </div>
        `;
    }

    if(req.status === "rework_needed" || req.rework_requested){
        html += `
            <div style="background:#fee2e2; color:#991b1b; padding:6px 10px; border-radius:6px; font-weight:700;">
                ⚠️ Free Rework Requested: "${escapeHtml(req.rework_notes || 'Defects reported')}"
            </div>
        `;
    }

    if(req.status === "completed"){
        html += `
            <div style="background:#ecfdf5; color:#065f46; padding:6px 10px; border-radius:6px; font-weight:700;">
                ✅ Verified Completed
            </div>
        `;
    }

    if(req.after_photos && req.after_photos.length > 0){
        html += `
            <div>
                <strong style="color:#0f172a; display:block; margin-bottom:4px;">📸 After-Repair Proof Photos:</strong>
                <div style="display:flex; gap:6px; flex-wrap:wrap;">
                    ${req.after_photos.map(p => `
                        <img src="${p}" style="width:45px; height:45px; object-fit:cover; border-radius:6px; cursor:pointer; border:1px solid #cbd5e1;" onclick="openCompanyLightbox('${p}', 'After Repair Proof Photo')" alt="Proof">
                    `).join("")}
                </div>
            </div>
        `;
    }

    if(req.invoice && req.invoice.total_amount){
        html += `
            <div style="color:#7e22ce; font-weight:700; display:flex; justify-content:space-between; align-items:center;">
                🧾 Invoice: ₹${req.invoice.total_amount} (${req.invoice.payment_status.toUpperCase()})
                <button class="c-action-btn invoice" style="margin-left:10px;background:#0284c7;font-size:12px;padding:4px 10px;color:#fff;border-radius:6px;border:none;cursor:pointer;" onclick="openTaxInvoiceModal('${req._id}')">&#128065;&#65039; View Bill</button>
            </div>
        `;
    }

    if(req.worker_review && req.worker_review.rating){
        html += `
            <div style="color:#2563eb; font-weight:600;">
                👷 Worker Review: ${req.worker_review.rating}/5 ★ (Punctuality: ${req.worker_review.punctuality || 5}, Craft: ${req.worker_review.craftsmanship || 5})
            </div>
        `;
    }

    if(req.company_review && req.company_review.rating){
        html += `
            <div style="color:#b45309; font-weight:600;">
                🏢 Company Review: ${req.company_review.rating}/5 ★ "${escapeHtml(req.company_review.comment || "")}"
            </div>
        `;
    }
    if(req.product_review && req.product_review.rating){
        html += `
            <div style="color:#166534; font-weight:600;">
                🧱 Products: ${req.product_review.rating}/5 ★
            </div>
        `;
    }
    if(req.complaint && req.complaint.has_complaint){
        html += `
            <div style="color:#991b1b; font-weight:600;">
                ⚠️ Complaint (${escapeHtml(req.complaint.about)}): ${escapeHtml(req.complaint.text)}
            </div>
        `;
    } else if(req.review && req.review.rating){
        html += `
            <div style="color:#b45309; font-weight:700;">
                ⭐ Review: ${req.review.rating}/5 Stars "${escapeHtml(req.review.comment || "")}"
            </div>
        `;
    }

    html += `</div>`;
    return html;
}

function renderReqActionButtons(req, custId){
    let btns = ``;

    if(req.status === "requested"){
        btns += `
            <button class="c-action-btn quote" onclick="openQuotationModal('${req._id}', '${escapeHtml(req.customer_name || 'Customer')}', '${escapeHtml(req.service)}')">
                📝 Send Formal Quotation
            </button>
        `;
    } else if(req.status === "confirmed"){
        btns += `
            <button class="c-action-btn assign" onclick="openAssignWorkersModal('${req._id}')">
                👷 Allocate Workers to Job
            </button>
        `;
    } else if(req.status === "workers_assigned" || req.status === "in_progress" || req.status === "rework_needed"){
        btns += `
            <button class="c-action-btn" style="background:#059669; color:#fff;" onclick="openSubmitWorkModal('${req._id}')">
                📸 Submit Work & After Photos
            </button>
            <button class="c-action-btn" style="background:#d97706; color:#fff;" onclick="openReplaceWorkerModal('${req._id}')">
                🔄 Substitute Absent Worker
            </button>
            <button class="c-action-btn" style="background:#0284c7; color:#fff;" onclick="openVerifyOtpModal('${req._id}')">
                🔑 Enter Customer PIN
            </button>
            <button class="c-action-btn invoice" onclick="openInvoiceModal('${req._id}')">
                🧾 Generate Final Bill
            </button>
        `;
    } else if(req.status === "work_submitted"){
        btns += `
            <button class="c-action-btn" style="background:#0284c7; color:#fff;" onclick="openVerifyOtpModal('${req._id}')">
                🔑 Enter Customer PIN
            </button>
            <button class="c-action-btn invoice" onclick="openInvoiceModal('${req._id}')">
                🧾 Generate Final Bill
            </button>
        `;
    } else if(req.status === "completed"){
        if(!req.invoice || !req.invoice.total_amount){
            btns += `
                <button class="c-action-btn invoice" onclick="openInvoiceModal('${req._id}')">
                    🧾 Generate Final Bill
                </button>
            `;
        }
        btns += `
            <button class="c-action-btn" style="background:#fee2e2; color:#b91c1c; border:1px solid #fca5a5;" onclick="deleteCompanyCompletedJob('${req._id}')">
                🗑️ Delete Completed Record
            </button>
        `;
    }

    btns += `
        <button class="c-action-btn chat" onclick="openCustomerChatTab('${custId}')">
            💬 Chat with Customer
        </button>
    `;

    return btns;
}


// ===================================================
// MODAL ACTIONS: QUOTE, ASSIGN, DAILY UPDATE, INVOICE, REPLACE
// ===================================================

// Quotation Modal
function autoCalculateQuoteDays(){
    const startVal = document.getElementById("quoteStartDate").value;
    const endVal = document.getElementById("quoteEndDate").value;
    if(startVal && endVal){
        const s = new Date(startVal);
        const e = new Date(endVal);
        const diffMs = e - s;
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1;
        const calcDays = diffDays > 0 ? diffDays : 1;
        const daysInput = document.getElementById("quoteEstimatedDays");
        if(daysInput){
            daysInput.value = calcDays;
            updateQuoteLaborPreview();
        }
    }
}
window.autoCalculateQuoteDays = autoCalculateQuoteDays;

function openQuotationModal(reqId, custName, service){
    document.getElementById("quoteRequestId").value = reqId;

    // Find requested request details to prefill customer preferred date
    const req = (typeof allCompanyRequests !== "undefined" ? allCompanyRequests : []).find(r => r._id === reqId);
    const prefDate = (req && req.preferred_date) ? req.preferred_date : "";

    document.getElementById("quotationCustomerInfo").textContent = `Service: ${service} for ${custName}.${prefDate ? ` Customer preferred start date: ${prefDate}.` : ""} Set the scheduled start & end dates, required technicians, and pricing.`;

    const todayIso = new Date().toISOString().split("T")[0];
    const sInput = document.getElementById("quoteStartDate");
    const eInput = document.getElementById("quoteEndDate");
    if (sInput) sInput.min = todayIso;
    if (eInput) eInput.min = todayIso;

    let start = prefDate || todayIso;
    if (start < todayIso) start = todayIso;

    const sDate = new Date(start);
    const fDate = new Date(sDate);
    fDate.setDate(fDate.getDate() + 2); // default 3 days (e.g. today to today+2)

    document.getElementById("quoteStartDate").value = start;
    document.getElementById("quoteEndDate").value = fDate.toISOString().split("T")[0];
    document.getElementById("quoteEstimatedCost").value = "0";
    document.getElementById("quoteLaborDailyRate").value = "";
    document.getElementById("quoteNotes").value = "";
    autoCalculateQuoteDays();
    document.getElementById("quotationModal").classList.add("show");
}

function closeQuotationModal(){
    document.getElementById("quotationModal").classList.remove("show");
}

function quoteLaborTotal(){
    const workers = Number(document.getElementById("quoteWorkersNeeded").value) || 0;
    const days = Number(document.getElementById("quoteEstimatedDays").value) || 0;
    const rate = Number(document.getElementById("quoteLaborDailyRate").value) || 0;
    return Number((workers * days * rate).toFixed(2));
}

function updateQuoteLaborPreview(){
    const total = quoteLaborTotal();
    const preview = document.getElementById("quoteLaborPreview");
    const hidden = document.getElementById("quoteEstimatedCost");
    if (preview) preview.textContent = `₹${total.toFixed(2)}`;
    if (hidden) hidden.value = String(total);
}

async function submitQuotation(){
    const reqId = document.getElementById("quoteRequestId").value;
    const start_date = document.getElementById("quoteStartDate").value;
    const end_date = document.getElementById("quoteEndDate").value;
    const workers_needed = document.getElementById("quoteWorkersNeeded").value;
    const estimated_days = document.getElementById("quoteEstimatedDays").value;
    const labor_daily_rate = document.getElementById("quoteLaborDailyRate").value;
    const quotation_notes = document.getElementById("quoteNotes").value.trim();
    const todayIso = new Date().toISOString().split("T")[0];

    if(!start_date || !end_date || !workers_needed || !estimated_days){
        return alert("Please specify start date, end date, workers needed, and estimated days.");
    }
    if(start_date < todayIso){
        return alert("Quotation start date cannot be in the past. Please select today or a future date.");
    }
    if(start_date > end_date){
        return alert("End date cannot be earlier than start date.");
    }
    if(labor_daily_rate === "" || Number(labor_daily_rate) < 0){
        return alert("Enter labour cost per worker per day in ₹. Use 0 if labour is complimentary.");
    }

    updateQuoteLaborPreview();
    const labor_total = quoteLaborTotal();
    const estimated_cost = labor_total;

    try {
        const r = await fetch(`/api/company/requests/${reqId}/quote`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
                start_date,
                end_date,
                workers_needed,
                estimated_days,
                labor_daily_rate: Number(labor_daily_rate),
                labor_total,
                estimated_cost,
                quotation_notes
            })
        });

        const d = await r.json();
        if(!r.ok) {
            if (d.worker_shortage) {
                const wantChange = confirm(`${d.message}\n\nWould you like to ask the customer to change the requested dates?`);
                if (wantChange) {
                    closeQuotationModal();
                    openDateChangeModal(reqId, start_date, end_date, workers_needed);
                    return;
                }
            }
            throw new Error(d.message || "Failed to send quotation.");
        }

        closeQuotationModal();
        showCompanyToast("Formal quotation with scheduled dates sent to customer!");
        await loadCompanyRequests();
    } catch(e){
        alert(e.message);
    }
}

function openDateChangeModal(requestId, defaultStart, defaultEnd, workersNeeded){
    const todayIso = new Date().toISOString().split("T")[0];
    document.getElementById("dateChangeRequestId").value = requestId;
    const sInput = document.getElementById("proposedStartDate");
    const eInput = document.getElementById("proposedEndDate");
    if (sInput) sInput.min = todayIso;
    if (eInput) eInput.min = todayIso;
    if (sInput) sInput.value = defaultStart && defaultStart >= todayIso ? defaultStart : todayIso;
    if (eInput) eInput.value = defaultEnd && defaultEnd >= todayIso ? defaultEnd : todayIso;
    document.getElementById("requestDateChangeModal").dataset.workersNeeded = workersNeeded || "1";
    document.getElementById("requestDateChangeModal").classList.add("show");
}

function closeDateChangeModal(){
    document.getElementById("requestDateChangeModal").classList.remove("show");
}

async function submitDateChangeProposal(){
    const reqId = document.getElementById("dateChangeRequestId").value;
    const proposed_start_date = document.getElementById("proposedStartDate").value;
    const proposed_end_date = document.getElementById("proposedEndDate").value;
    const reason = document.getElementById("dateChangeReason").value.trim();
    const workers_needed = document.getElementById("requestDateChangeModal").dataset.workersNeeded || "1";
    const todayIso = new Date().toISOString().split("T")[0];

    if (!proposed_start_date || !proposed_end_date) {
        return alert("Please specify proposed start and end dates.");
    }
    if (proposed_start_date < todayIso) {
        return alert("Proposed start date cannot be in the past.");
    }
    if (proposed_end_date < proposed_start_date) {
        return alert("Proposed end date cannot be earlier than start date.");
    }

    try {
        const r = await fetch(`/api/company/requests/${reqId}/request-date-change`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
                proposed_start_date,
                proposed_end_date,
                reason,
                workers_needed: Number(workers_needed)
            })
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.message || "Failed to send date change proposal.");

        closeDateChangeModal();
        showCompanyToast("Schedule modification request sent to customer in chat!");
        await loadCompanyRequests();
    } catch (e) {
        alert(e.message);
    }
}

async function refreshCompanyDashboard(){
    const btn = document.getElementById("companyRefreshBtn");
    if (btn) btn.classList.add("spinning");
    try {
        await Promise.all([
            loadDashboard(),
            typeof loadCompanyRequests === "function" ? loadCompanyRequests() : Promise.resolve(),
            typeof loadCompanyChats === "function" ? loadCompanyChats() : Promise.resolve(),
            typeof loadWorkers === "function" ? loadWorkers() : Promise.resolve()
        ]);
        showCompanyToast("Dashboard refreshed successfully!");
    } catch(err) {
        console.error("Refresh error:", err);
    } finally {
        if (btn) btn.classList.remove("spinning");
    }
}
window.refreshCompanyDashboard = refreshCompanyDashboard;
window.openDateChangeModal = openDateChangeModal;
window.closeDateChangeModal = closeDateChangeModal;
window.submitDateChangeProposal = submitDateChangeProposal;

// Assign Workers Modal (Date Conflict Protected)
async function openAssignWorkersModal(reqId){
    document.getElementById("assignRequestId").value = reqId;
    const list = document.getElementById("companyWorkersChecklist");
    list.innerHTML = `<div class="loading-small">Checking technician availability for scheduled dates...</div>`;
    document.getElementById("assignWorkersModal").classList.add("show");

    try {
        // Fetch workers tagged with real-time schedule conflict status
        const r = await fetch(`/api/company/requests/${reqId}/available-workers`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const d = await r.json();
        const workerList = d.workers || [];

        const subEl = document.getElementById("assignModalSub");
        if(subEl && d.start_date && d.end_date){
            subEl.innerHTML = `Job Schedule: <strong>${d.start_date}</strong> to <strong>${d.end_date}</strong>. Technicians already booked on other jobs during this window are disabled.`;
        }

        if(workerList.length === 0){
            list.innerHTML = `<div style="padding:10px; font-size:12px; color:#ef4444;">No workers registered. Please add workers first.</div>`;
            return;
        }

        list.innerHTML = "";
        workerList.forEach(w => {
            const item = document.createElement("label");
            item.className = "worker-check-item";
            if(!w.is_available){
                item.style.opacity = "0.65";
                item.style.background = "#fff1f2";
                item.style.border = "1px solid #fecdd3";
            }

            const availBadge = w.is_available
                ? `<span style="background:#dcfce7; color:#15803d; font-size:11px; font-weight:700; padding:2px 8px; border-radius:10px; margin-left:8px;">✅ Available</span>`
                : `<span style="background:#fee2e2; color:#b91c1c; font-size:11px; font-weight:700; padding:2px 8px; border-radius:10px; margin-left:8px;">⛔ ${escapeHtml(w.conflict_reason || 'Busy on another job')}</span>`;

            item.innerHTML = `
                <input type="checkbox" value="${w._id}" name="assignWorkersCheck" ${w.is_available ? '' : 'disabled'}>
                <div style="flex:1;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <strong>${escapeHtml(w.name)}</strong>
                        ${availBadge}
                    </div>
                    <small style="color:#64748b; display:block; margin-top:2px;">
                        📞 ${escapeHtml(w.phone || "")} • Skills: ${(w.skills || []).join(", ")} • Rating: ${w.rating || 5.0}★
                    </small>
                </div>
            `;
            list.appendChild(item);
        });
    } catch(e){
        list.innerHTML = `<div style="padding:10px; color:#ef4444;">Failed to load available workers: ${e.message}</div>`;
    }
}

function closeAssignWorkersModal(){
    document.getElementById("assignWorkersModal").classList.remove("show");
}

async function submitAssignWorkers(){
    const reqId = document.getElementById("assignRequestId").value;
    const days = document.getElementById("assignDurationDays").value;

    const checkedBoxes = document.querySelectorAll("input[name='assignWorkersCheck']:checked");
    const worker_ids = Array.from(checkedBoxes).map(cb => cb.value);

    if(worker_ids.length === 0){
        return alert("Please select at least one available technician to assign.");
    }

    try {
        const r = await fetch(`/api/company/requests/${reqId}/assign-workers`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ worker_ids, assigned_days: days })
        });

        const d = await r.json();
        if(!r.ok) throw new Error(d.message || "Failed to allocate workers.");

        closeAssignWorkersModal();
        showCompanyToast("Technicians allocated! Customer notified of crew details.");
        await loadCompanyRequests();
    } catch(e){
        alert(e.message);
    }
}

// Replace Worker Modal
async function openReplaceWorkerModal(reqId){
    document.getElementById("replaceRequestId").value = reqId;
    const req = allCompanyRequests.find(r => r._id === reqId);
    if(!req || !req.assigned_workers || req.assigned_workers.length === 0){
        return alert("No workers are currently assigned to this job.");
    }

    const origSelect = document.getElementById("replaceOriginalWorkerSelect");
    origSelect.innerHTML = req.assigned_workers.map(w => `
        <option value="${w.worker_id}">${escapeHtml(w.name)} (Current Assigned Tech)</option>
    `).join("");

    document.getElementById("replaceDate").value = new Date().toISOString().split("T")[0];
    document.getElementById("replaceReason").value = "Personal / Medical Leave";

    const repSelect = document.getElementById("replaceWorkerSelect");
    repSelect.innerHTML = `<option value="">Loading available technicians...</option>`;
    document.getElementById("replaceWorkerModal").classList.add("show");

    try {
        const r = await fetch(`/api/company/requests/${reqId}/available-workers`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const d = await r.json();
        const availableWorkers = (d.workers || []).filter(w => w.is_available);

        if(availableWorkers.length === 0){
            repSelect.innerHTML = `<option value="">No other certified technicians available</option>`;
            return;
        }

        repSelect.innerHTML = availableWorkers.map(w => `
            <option value="${w._id}">${escapeHtml(w.name)} (📞 ${escapeHtml(w.phone)} - ${(w.skills || []).join(", ")})</option>
        `).join("");
    } catch(e){
        repSelect.innerHTML = `<option value="">Failed to load substitute technicians</option>`;
    }
}

function closeReplaceWorkerModal(){
    document.getElementById("replaceWorkerModal").classList.remove("show");
}

async function submitReplaceWorker(){
    const reqId = document.getElementById("replaceRequestId").value;
    const original_worker_id = document.getElementById("replaceOriginalWorkerSelect").value;
    const replacement_worker_id = document.getElementById("replaceWorkerSelect").value;
    const date = document.getElementById("replaceDate").value;
    const reason = document.getElementById("replaceReason").value.trim();

    if(!original_worker_id || !replacement_worker_id || !date){
        return alert("Please select the absent worker, date, and replacement technician.");
    }

    try {
        const r = await fetch(`/api/company/requests/${reqId}/replace-worker`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ original_worker_id, replacement_worker_id, date, reason })
        });

        const d = await r.json();
        if(!r.ok) throw new Error(d.message || "Failed to replace technician.");

        closeReplaceWorkerModal();
        showCompanyToast(d.message || "Substitute technician assigned!");
        await loadCompanyRequests();
    } catch(e){
        alert(e.message);
    }
}

// ==========================================
// Granular Itemized Invoice (Materials & Labor)
// ==========================================

function addMaterialInvoiceRow(name = "", qty = "1", unitPrice = 0){
    const tbody = document.getElementById("invMaterialsBody");
    const tr = document.createElement("tr");
    tr.style.borderBottom = "1px solid #f1f5f9";
    tr.innerHTML = `
        <td style="padding:4px;"><input type="text" class="inv-mat-name" value="${escapeHtml(name)}" placeholder="e.g. UltraTech Cement" style="width:100%; padding:4px 6px; font-size:12px;" required></td>
        <td style="padding:4px;"><input type="text" class="inv-mat-qty" value="${escapeHtml(qty)}" placeholder="e.g. 5 Bags" style="width:100%; padding:4px 6px; font-size:12px;" required></td>
        <td style="padding:4px;"><input type="number" min="0" step="any" class="inv-mat-price" value="${unitPrice}" oninput="calculateInvoiceTotal()" style="width:100%; padding:4px 6px; font-size:12px;" required></td>
        <td style="padding:4px; font-weight:700; color:#0f172a;" class="inv-mat-row-total">₹0</td>
        <td style="padding:4px; text-align:center;"><button type="button" onclick="this.closest('tr').remove(); calculateInvoiceTotal();" style="color:#ef4444; background:none; border:none; cursor:pointer; font-weight:700;">×</button></td>
    `;
    tbody.appendChild(tr);
    calculateInvoiceTotal();
}

function addLaborInvoiceRow(techName = "Technician", days = 1, dailyRate = 0){
    const tbody = document.getElementById("invLaborBody");
    const tr = document.createElement("tr");
    tr.style.borderBottom = "1px solid #f1f5f9";
    tr.innerHTML = `
        <td style="padding:4px;"><input type="text" class="inv-lab-name" value="${escapeHtml(techName)}" placeholder="Worker Name" style="width:100%; padding:4px 6px; font-size:12px;" required></td>
        <td style="padding:4px;"><input type="number" min="1" class="inv-lab-days" value="${days}" oninput="calculateInvoiceTotal()" style="width:100%; padding:4px 6px; font-size:12px;" required></td>
        <td style="padding:4px;"><input type="number" min="0" step="any" class="inv-lab-rate" value="${dailyRate}" oninput="calculateInvoiceTotal()" style="width:100%; padding:4px 6px; font-size:12px;" required></td>
        <td style="padding:4px; font-weight:700; color:#0f172a;" class="inv-lab-row-total">₹0</td>
        <td style="padding:4px; text-align:center;"><button type="button" onclick="this.closest('tr').remove(); calculateInvoiceTotal();" style="color:#ef4444; background:none; border:none; cursor:pointer; font-weight:700;">×</button></td>
    `;
    tbody.appendChild(tr);
    calculateInvoiceTotal();
}

function calculateInvoiceTotal(){
    // Materials subtotal
    let matSub = 0;
    document.querySelectorAll("#invMaterialsBody tr").forEach(tr => {
        const qtyStr = tr.querySelector(".inv-mat-qty")?.value || "1";
        // parse leading number from qty string if possible, e.g. "5 Bags" -> 5
        const numMatch = qtyStr.match(/^[\d.]+/);
        const qtyNum = numMatch ? parseFloat(numMatch[0]) : 1;
        const price = parseFloat(tr.querySelector(".inv-mat-price")?.value) || 0;
        const rowTotal = Number((qtyNum * price).toFixed(2));
        matSub += rowTotal;
        const totalCell = tr.querySelector(".inv-mat-row-total");
        if(totalCell) totalCell.textContent = `₹${rowTotal.toFixed(2)}`;
    });
    document.getElementById("invMaterialsSubtotal").textContent = `₹${matSub.toFixed(2)}`;

    // Labor subtotal
    let labSub = 0;
    document.querySelectorAll("#invLaborBody tr").forEach(tr => {
        const days = parseFloat(tr.querySelector(".inv-lab-days")?.value) || 1;
        const rate = parseFloat(tr.querySelector(".inv-lab-rate")?.value) || 0;
        const rowTotal = Number((days * rate).toFixed(2));
        labSub += rowTotal;
        const totalCell = tr.querySelector(".inv-lab-row-total");
        if(totalCell) totalCell.textContent = `₹${rowTotal.toFixed(2)}`;
    });
    document.getElementById("invLaborSubtotal").textContent = `₹${labSub.toFixed(2)}`;

    const tax = parseFloat(document.getElementById("invTaxCost").value) || 0;
    const grandTotal = matSub + labSub + tax;
    document.getElementById("invTotalDisplay").textContent = `₹${grandTotal.toFixed(2)}`;
}

function openInvoiceModal(reqId){
    document.getElementById("invoiceRequestId").value = reqId;
    document.getElementById("invMaterialsBody").innerHTML = "";
    document.getElementById("invLaborBody").innerHTML = "";
    document.getElementById("invTaxCost").value = 0;

    const req = allCompanyRequests.find(r => r._id === reqId);

    const dailyRate = Number(req && req.quotation && req.quotation.labor_daily_rate) || 0;
    const days = Number(req && req.quotation && req.quotation.estimated_days) || 1;

    // 1. Prefill materials from van stock + shop purchases (cement, pipes, etc.)
    if(req && req.material_requisitions && req.material_requisitions.length > 0){
        req.material_requisitions.forEach(m => {
            addMaterialInvoiceRow(m.item_name, m.quantity, m.unit_price || 0);
        });
    } else {
        addMaterialInvoiceRow("", "1", 0);
    }

    // 2. Prefill labour from quoted daily rate × days
    if(req && req.assigned_workers && req.assigned_workers.length > 0){
        req.assigned_workers.forEach(w => {
            addLaborInvoiceRow(w.name, days, dailyRate);
        });
    } else {
        const needed = Number(req && req.quotation && req.quotation.workers_needed) || 1;
        for(let i = 0; i < needed; i++){
            addLaborInvoiceRow(`Technician ${i + 1}`, days, dailyRate);
        }
    }

    calculateInvoiceTotal();
    document.getElementById("invoiceModal").classList.add("show");
}

function closeInvoiceModal(){
    document.getElementById("invoiceModal").classList.remove("show");
}

async function submitInvoice(){
    const reqId = document.getElementById("invoiceRequestId").value;

    const materials_items = [];
    document.querySelectorAll("#invMaterialsBody tr").forEach(tr => {
        const name = tr.querySelector(".inv-mat-name")?.value.trim();
        const qty = tr.querySelector(".inv-mat-qty")?.value.trim();
        const numMatch = qty ? qty.match(/^[\d.]+/) : null;
        const qtyNum = numMatch ? parseFloat(numMatch[0]) : 1;
        const price = parseFloat(tr.querySelector(".inv-mat-price")?.value) || 0;
        if(name && qty){
            materials_items.push({
                item_name: name,
                quantity: qty,
                unit_price: price,
                total_price: Number((qtyNum * price).toFixed(2))
            });
        }
    });

    const labor_items = [];
    document.querySelectorAll("#invLaborBody tr").forEach(tr => {
        const name = tr.querySelector(".inv-lab-name")?.value.trim();
        const days = parseFloat(tr.querySelector(".inv-lab-days")?.value) || 1;
        const rate = parseFloat(tr.querySelector(".inv-lab-rate")?.value) || 0;
        if(name){
            labor_items.push({
                worker_name: name,
                role: "Technician",
                days,
                daily_rate: rate,
                total_labor: Number((days * rate).toFixed(2))
            });
        }
    });

    const tax_or_other = parseFloat(document.getElementById("invTaxCost").value) || 0;
    const notes = document.getElementById("invNotes").value.trim();

    try {
        const r = await fetch(`/api/company/requests/${reqId}/invoice`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ materials_items, labor_items, tax_or_other, notes })
        });

        const d = await r.json();
        if(!r.ok) throw new Error(d.message || "Failed to generate invoice.");

        closeInvoiceModal();
        showCompanyToast("Itemized bill generated and sent to customer!");
        await loadCompanyRequests();
    } catch(e){
        alert(e.message);
    }
}

// Submit Completed Work & After Photos Modal
function openSubmitWorkModal(reqId){
    document.getElementById("submitWorkRequestId").value = reqId;
    document.getElementById("submitWorkPhotosInput").value = "";
    document.getElementById("submitWorkNotes").value = "";
    document.getElementById("submitWorkModal").classList.add("show");
}

function closeSubmitWorkModal(){
    document.getElementById("submitWorkModal").classList.remove("show");
}

async function submitCompletedWork(){
    const reqId = document.getElementById("submitWorkRequestId").value;
    const notes = document.getElementById("submitWorkNotes").value.trim();
    const files = document.getElementById("submitWorkPhotosInput").files;

    if(!files || files.length === 0){
        return alert("Please upload at least one After-Repair proof photo for customer inspection.");
    }

    const formData = new FormData();
    formData.append("work_notes", notes);
    for(let i = 0; i < files.length; i++){
        formData.append("after_photos", files[i]);
    }

    try {
        const r = await fetch(`/api/company/requests/${reqId}/submit-work`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formData
        });

        const d = await r.json();
        if(!r.ok) throw new Error(d.message || "Failed to submit work.");

        closeSubmitWorkModal();
        showCompanyToast("Work & photos submitted! Customer notified for on-site inspection.");
        await loadCompanyRequests();
    } catch(e){
        alert(e.message);
    }
}

// Verify Customer On-Site PIN Modal
function openVerifyOtpModal(reqId){
    document.getElementById("verifyOtpRequestId").value = reqId;
    document.getElementById("verifyOtpInput").value = "";
    document.getElementById("verifyOtpModal").classList.add("show");
}

function closeVerifyOtpModal(){
    document.getElementById("verifyOtpModal").classList.remove("show");
}

async function submitVerifyOtp(){
    const reqId = document.getElementById("verifyOtpRequestId").value;
    const otp = document.getElementById("verifyOtpInput").value.trim();

    if(!otp || otp.length !== 4){
        return alert("Please enter the 4-digit PIN provided by the customer.");
    }

    try {
        const r = await fetch(`/api/company/requests/${reqId}/verify-otp`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ otp })
        });

        const d = await r.json();
        if(!r.ok) throw new Error(d.message || "PIN verification failed.");

        closeVerifyOtpModal();
        showCompanyToast("🎉 Customer PIN verified! Job completed and 30-Day Warranty issued!");
        await loadCompanyRequests();
    } catch(e){
        alert(e.message);
    }
}


// ===================================================
// COMPANY CUSTOMER CHATS INTERFACE
// ===================================================

let companyConversations = [];
let activeCustomerId = null;
let companyChatPoll = null;

async function loadCompanyChats(){
    try {
        const r = await fetch("/api/chat/company/conversations", {
            headers: { Authorization: `Bearer ${token}` }
        });
        if(!r.ok) return;
        const d = await r.json();
        companyConversations = d.conversations || [];

        renderCompanyConvList();

        if(!activeCustomerId && companyConversations.length > 0){
            selectCustomerChat(companyConversations[0].customer_id);
        }

        if(!companyChatPoll){
            companyChatPoll = setInterval(() => {
                const chatsSec = document.getElementById("chats");
                if(chatsSec && !chatsSec.classList.contains("hidden") && activeCustomerId){
                    loadActiveCustomerChatHistory(true);
                }
            }, 3500);
        }
    } catch(e){
        console.error("Load company chats error:", e);
    }
}

function renderCompanyConvList(searchQuery = ""){
    const list = document.getElementById("companyConversationsList");
    if(!list) return;

    let filtered = [...companyConversations];
    if(searchQuery){
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(c => (c.customer_name || "").toLowerCase().includes(q));
    }

    if(filtered.length === 0){
        list.innerHTML = `<div style="padding:15px; font-size:12px; color:#64748b; text-align:center;">No active chats</div>`;
        return;
    }

    list.innerHTML = "";
    filtered.forEach(c => {
        const item = document.createElement("div");
        const isActive = activeCustomerId === c.customer_id;
        item.className = `company-conv-item ${isActive ? "active" : ""}`;
        item.innerHTML = `
            <div class="c-conv-avatar">${(c.customer_name || "C").charAt(0).toUpperCase()}</div>
            <div class="c-conv-meta">
                <strong>${escapeHtml(c.customer_name)}</strong>
                <small>${escapeHtml(c.last_message || "Active customer thread")}</small>
            </div>
            ${c.unread_count > 0 ? `<span class="sidebar-pill">${c.unread_count}</span>` : ""}
        `;
        item.addEventListener("click", () => selectCustomerChat(c.customer_id));
        list.appendChild(item);
    });
}

const companyChatSearchInput = document.getElementById("companyChatSearch");
if(companyChatSearchInput){
    companyChatSearchInput.addEventListener("input", (e) => {
        renderCompanyConvList(e.target.value.trim());
    });
}

function openCustomerChatTab(customerId){
    const chatsBtn = document.querySelector("aside button[onclick*='chats']");
    show("chats", chatsBtn);
    if(customerId){
        selectCustomerChat(customerId);
    }
}

async function selectCustomerChat(customerId){
    activeCustomerId = customerId;
    renderCompanyConvList(companyChatSearchInput ? companyChatSearchInput.value : "");
    await loadActiveCustomerChatHistory();
}

async function loadActiveCustomerChatHistory(silent = false){
    if(!activeCustomerId) return;

    const win = document.getElementById("companyActiveChatWindow");
    if(!win) return;

    try {
        const r = await fetch(`/api/chat/company/history/${activeCustomerId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if(!r.ok) return;
        const d = await r.json();

        const cust = d.customer || { name: "Customer" };
        const messages = d.messages || [];

        if(!silent || !win.querySelector(".c-chat-messages")){
            renderCompanyChatWindow(cust, messages);
        } else {
            const stream = win.querySelector(".c-chat-messages");
            if(stream && messages.length !== stream.children.length){
                renderCompanyChatMessages(stream, messages);
            }
        }
    } catch(e){
        console.error("Load customer chat history error:", e);
    }
}

function renderCompanyChatWindow(cust, messages){
    const win = document.getElementById("companyActiveChatWindow");
    if(!win) return;

    win.innerHTML = `
        <div class="c-chat-header">
            <div class="c-chat-header-info">
                <div class="c-conv-avatar">${(cust.name || "C").charAt(0).toUpperCase()}</div>
                <div>
                    <strong>${escapeHtml(cust.name)}</strong>
                    <small style="color:#64748b; display:block;">📞 ${escapeHtml(cust.phone || "Direct Support")} | ✉️ ${escapeHtml(cust.email || "")}</small>
                </div>
            </div>
            <div style="display:flex; gap:8px;">
                <button class="c-action-btn" id="companyChatRefreshBtn" style="background:#eff6ff; color:#2563eb; border-color:#bfdbfe;" onclick="refreshCompanyActiveChat()" title="Refresh conversation immediately">
                    🔄 Refresh
                </button>
                <button class="c-action-btn" style="background:#fee2e2; color:#b91c1c; border-color:#fca5a5;" onclick="deleteCompanyChatHistory()">
                    🗑️ Delete Chat
                </button>
                <button class="c-action-btn quote" onclick="show('requests', document.querySelector('aside button[onclick*=\\'requests\\']'))">
                    📋 View Requests
                </button>
            </div>
        </div>

        <div class="c-chat-messages" id="companyChatMsgStream"></div>

        <form class="c-chat-input-bar" id="companyChatReplyForm">
            <input type="text" id="companyReplyText" placeholder="Type direct reply to ${escapeHtml(cust.name)}..." autocomplete="off">
            <button type="submit">Send Reply ➤</button>
        </form>
    `;

    const stream = win.querySelector("#companyChatMsgStream");
    renderCompanyChatMessages(stream, messages);

    const form = win.querySelector("#companyChatReplyForm");
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const input = document.getElementById("companyReplyText");
        const text = input.value.trim();
        if(!text) return;

        input.value = "";

        try {
            const r = await fetch("/api/chat/company/reply", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    customer_id: activeCustomerId,
                    message: text
                })
            });

            if(!r.ok){
                const err = await r.json();
                throw new Error(err.message || "Failed to send reply.");
            }

            await loadActiveCustomerChatHistory();
            await loadCompanyChats();
        } catch(err){
            alert(err.message);
        }
    });
}

async function refreshCompanyActiveChat(){
    if(!activeCustomerId) return;
    const btn = document.getElementById("companyChatRefreshBtn");
    if(btn){
        btn.disabled = true;
        btn.textContent = "⏳ Updating...";
    }
    try {
        await loadActiveCustomerChatHistory(false);
        await loadCompanyChats();
    } finally {
        if(btn){
            btn.disabled = false;
            btn.textContent = "🔄 Refresh";
        }
    }
}
window.refreshCompanyActiveChat = refreshCompanyActiveChat;

function renderCompanyChatMessages(stream, messages){
    if(!stream) return;
    stream.innerHTML = "";

    messages.forEach(m => {
        const row = document.createElement("div");
        const isComp = m.sender_role === "company";
        const isComplaint = m.msg_type === "complaint";
        row.style.display = "flex";
        row.style.flexDirection = isComp ? "row-reverse" : "row";
        row.style.gap = "8px";
        row.style.maxWidth = "80%";
        row.style.marginLeft = isComp ? "auto" : "0";

        const bg = isComp ? "#2563eb" : (isComplaint ? "#fef2f2" : (m.sender_role === "bot" ? "#f1f5f9" : "#ffffff"));
        const color = isComp ? "#ffffff" : (isComplaint ? "#991b1b" : "#1e293b");
        const border = isComp ? "none" : (isComplaint ? "1px solid #fecaca" : "1px solid #e2e8f0");

        row.innerHTML = `
            <div style="padding:10px 14px; border-radius:12px; background:${bg}; color:${color}; border:${border}; font-size:13px; line-height:1.4;">
                <span style="font-size:10px; color:${isComp ? 'rgba(255,255,255,0.75)' : (isComplaint ? '#b91c1c' : '#64748b')}; display:block; margin-bottom:3px; font-weight:${isComplaint ? '700' : 'normal'};">
                    ${isComplaint ? '⚠️ ' : ''}${escapeHtml(m.sender_name)}
                </span>
                ${escapeHtml(m.message)}
            </div>
        `;
        stream.appendChild(row);
    });

    stream.scrollTop = stream.scrollHeight;
}

// Company deletes chat history with selected customer
async function deleteCompanyChatHistory() {
    if (!activeCustomerId) {
        return alert("Please select a customer chat to delete.");
    }

    if (!confirm("Are you sure you want to delete all chat messages with this customer? This will permanently remove them from the database.")) {
        return;
    }

    try {
        const r = await fetch(`/api/chat/company/delete/${activeCustomerId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!r.ok) {
            const err = await r.json();
            throw new Error(err.message || "Failed to delete chat history");
        }

        const d = await r.json();
        alert(d.message || "Chat history deleted successfully");

        // Reload chat window
        await loadActiveCustomerChatHistory();
        await renderCompanyConvList(companyChatSearchInput ? companyChatSearchInput.value : "");
    } catch (err) {
        alert(err.message);
    }
}
window.deleteCompanyChatHistory = deleteCompanyChatHistory;


// ===================================================
// LIGHTBOX & TOAST
// ===================================================

function openCompanyLightbox(src, caption = ""){
    const modal = document.getElementById("companyLightboxModal");
    const img = document.getElementById("companyLightboxImg");
    const cap = document.getElementById("companyLightboxCap");
    if(!modal) return;
    img.src = src;
    cap.textContent = caption;
    modal.classList.add("show");
}

function showCompanyToast(msg){
    const t = document.getElementById("toast");
    if(!t) return;
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 3200);
}

function escapeHtml(value){
    return String(value||"")
        .replace(/&/g,"&amp;")
        .replace(/</g,"&lt;")
        .replace(/>/g,"&gt;")
        .replace(/"/g,"&quot;")
        .replace(/'/g,"&#039;");
}

function logout(){
    localStorage.removeItem("token");
    window.location.href="login.html";
}

loadDashboard();
loadCompanyRequests();
loadCompanyChats();


// =========================================================
// VIEW DETAILED TAX INVOICE (Company Dashboard)
// =========================================================
function openTaxInvoiceModal(requestId) {
    // use allCompanyRequests (global) or window.companyRequestsData
    var allReqs = window.companyRequestsData || (typeof allCompanyRequests !== 'undefined' ? allCompanyRequests : []);
    var req = allReqs.find(function(r){ return r._id === requestId; });
    if (!req || !req.invoice) {
        showToast('Invoice data not available.', 'error');
        return;
    }

    var compName = req.company_name || 'Authorized Service Provider';
    var custName = req.customer_name || 'Customer';
    var inv = req.invoice;
    var invDate = inv.generated_at
        ? new Date(inv.generated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
        : new Date().toLocaleDateString('en-IN');

    var container = document.getElementById('printableTaxInvoiceArea');
    if (!container) return;

    var materialsRows = '';
    if (inv.materials_items && inv.materials_items.length > 0) {
        inv.materials_items.forEach(function(m) {
            materialsRows += '<tr style="border-bottom:1px solid #e2e8f0;">' +
                '<td style="padding:8px 10px;"><strong>&#128230; ' + escapeHtml(m.item_name) + '</strong>' +
                '<div style="font-size:11px;color:#64748b;">Material item @ &#8377;' + (m.unit_price||0) + '/unit</div></td>' +
                '<td style="padding:8px;text-align:center;">' + escapeHtml(String(m.quantity)) + '</td>' +
                '<td style="padding:8px;text-align:right;">&#8377;' + Number(m.unit_price||0).toFixed(2) + '</td>' +
                '<td style="padding:8px;text-align:right;font-weight:700;color:#0f172a;">&#8377;' + Number(m.total_price||0).toFixed(2) + '</td>' +
                '</tr>';
        });
    }

    var laborRows = '';
    if (inv.labor_items && inv.labor_items.length > 0) {
        inv.labor_items.forEach(function(l) {
            laborRows += '<tr style="border-bottom:1px solid #e2e8f0;">' +
                '<td style="padding:8px 10px;"><strong>&#128119; ' + escapeHtml(l.worker_name) + ' &mdash; Labour</strong>' +
                '<div style="font-size:11px;color:#64748b;">' + escapeHtml(l.role||'Technician') + ' @ &#8377;' + (l.daily_rate||0) + '/day</div></td>' +
                '<td style="padding:8px;text-align:center;">' + (l.days||0) + ' day(s)</td>' +
                '<td style="padding:8px;text-align:right;">&#8377;' + Number(l.daily_rate||0).toFixed(2) + '</td>' +
                '<td style="padding:8px;text-align:right;font-weight:700;color:#0f172a;">&#8377;' + Number(l.total_labor||0).toFixed(2) + '</td>' +
                '</tr>';
        });
    }

    var taxRow = '';
    if (inv.tax_or_other) {
        taxRow = '<tr style="border-bottom:1px solid #e2e8f0;background:#fffbeb;">' +
            '<td style="padding:8px 10px;" colspan="3"><strong>Taxes &amp; Other Charges</strong></td>' +
            '<td style="padding:8px;text-align:right;font-weight:700;">&#8377;' + Number(inv.tax_or_other||0).toFixed(2) + '</td></tr>';
    }

    var paidBadge = inv.payment_status === 'paid'
        ? '<span style="display:inline-block;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;background:#dcfce7;color:#166534;">&#10003; PAID IN FULL</span>'
        : '<span style="display:inline-block;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;background:#fef3c7;color:#92400e;">PENDING PAYMENT</span>';

    container.innerHTML =
        '<div style="font-family:sans-serif;">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid #e2e8f0;">' +
            '<div>' +
                '<h3 style="margin:0 0 4px 0;font-size:18px;color:#0f172a;">' + escapeHtml(compName) + '</h3>' +
                '<p style="margin:2px 0;font-size:12px;color:#64748b;">Licensed &amp; Insured Domestic Service Provider</p>' +
                '<p style="margin:2px 0;font-size:12px;color:#64748b;">Billed To: <strong>' + escapeHtml(custName) + '</strong></p>' +
                '<p style="margin:2px 0;font-size:12px;color:#64748b;">Location: ' + escapeHtml(req.service_address||'') + '</p>' +
                '<p style="margin:2px 0;font-size:12px;color:#64748b;">Service: <strong>' + escapeHtml(req.service||'') + '</strong></p>' +
            '</div>' +
            '<div style="text-align:right;">' +
                '<h2 style="margin:0 0 6px 0;font-size:20px;color:#1e40af;letter-spacing:1px;">TAX INVOICE</h2>' +
                '<p style="margin:2px 0;font-size:12px;color:#475569;">Invoice #: <strong>' + escapeHtml(inv.invoice_number||'N/A') + '</strong></p>' +
                '<p style="margin:2px 0;font-size:12px;color:#475569;">Date: ' + invDate + '</p>' +
                '<div style="margin-top:8px;">' + paidBadge + '</div>' +
            '</div>' +
        '</div>' +
        '<table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px;">' +
            '<thead><tr style="background:#f1f5f9;border-bottom:2px solid #cbd5e1;">' +
                '<th style="padding:8px 10px;text-align:left;">Description</th>' +
                '<th style="padding:8px;text-align:center;">Qty / Days</th>' +
                '<th style="padding:8px;text-align:right;">Unit Rate (&#8377;)</th>' +
                '<th style="padding:8px;text-align:right;">Total (&#8377;)</th>' +
            '</tr></thead>' +
            '<tbody>' +
                (materialsRows || '<tr><td colspan="4" style="padding:10px;color:#94a3b8;font-style:italic;">No materials listed</td></tr>') +
                (laborRows || '<tr><td colspan="4" style="padding:10px;color:#94a3b8;font-style:italic;">No labour items listed</td></tr>') +
                taxRow +
            '</tbody>' +
        '</table>' +
        '<div style="display:flex;justify-content:flex-end;">' +
            '<table style="width:280px;font-size:13px;border-collapse:collapse;">' +
                '<tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:6px 8px;color:#64748b;">Materials Subtotal</td><td style="padding:6px 8px;text-align:right;font-weight:600;">&#8377;' + Number(inv.materials_total||0).toFixed(2) + '</td></tr>' +
                '<tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:6px 8px;color:#64748b;">Labour Subtotal</td><td style="padding:6px 8px;text-align:right;font-weight:600;">&#8377;' + Number(inv.labor_total||0).toFixed(2) + '</td></tr>' +
                (inv.tax_or_other ? '<tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:6px 8px;color:#64748b;">Tax / Other</td><td style="padding:6px 8px;text-align:right;font-weight:600;">&#8377;' + Number(inv.tax_or_other||0).toFixed(2) + '</td></tr>' : '') +
                '<tr style="background:#0f172a;color:#fff;font-size:15px;"><td style="padding:10px 8px;font-weight:700;border-radius:4px 0 0 4px;">Grand Total</td><td style="padding:10px 8px;text-align:right;font-weight:700;border-radius:0 4px 4px 0;">&#8377;' + Number(inv.total_amount||0).toFixed(2) + '</td></tr>' +
            '</table>' +
        '</div>' +
        '<p style="margin-top:20px;font-size:11px;color:#94a3b8;text-align:center;">Thank you for choosing our service. Please contact us for any billing queries.</p>' +
        '</div>';

    document.getElementById('taxInvoiceModal').classList.add('show');
}

// Close Tax Invoice Modal
(function() {
    var modal = document.getElementById('taxInvoiceModal');
    var closeBtn = document.getElementById('closeTaxInvoiceModal');
    if (closeBtn) closeBtn.addEventListener('click', function(){ if(modal) modal.classList.remove('show'); });
    if (modal) modal.addEventListener('click', function(e){ if(e.target === modal) modal.classList.remove('show'); });
})();

// Company deletes a completed service job (cannot delete started/active work)
async function deleteCompanyCompletedJob(requestId) {
    if (!confirm("Are you sure you want to delete this completed service request from company records? This action cannot be undone.")) {
        return;
    }

    try {
        const response = await fetch(`/api/company/requests/${requestId}`, {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || "Unable to delete request.");
        }

        alert(data.message || "Completed request deleted from records.");
        await loadCompanyRequests();
    } catch (err) {
        alert(err.message);
    }
}
window.deleteCompanyCompletedJob = deleteCompanyCompletedJob;

// Company removes worker permanently from database
async function removeWorker(workerId, workerName) {
    if (!confirm(`Are you sure you want to permanently remove technician "${workerName}" from your workforce? This will delete the worker from the database.`)) {
        return;
    }

    try {
        const response = await fetch(`/api/company/workers/${workerId}`, {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || "Failed to remove worker.");
        }

        alert(data.message || "Worker removed successfully.");
        await loadWorkersForDate();
        await loadDashboard();
    } catch (err) {
        alert(err.message);
    }
}
window.removeWorker = removeWorker;

