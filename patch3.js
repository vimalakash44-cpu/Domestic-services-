const fs = require('fs');
let js = fs.readFileSync('public/company-dashboard.js', 'utf8');

// ──────────────────────────────────────────────────────────────────
// 1. Add "View Bill" button - use the exact line endings from the file
// ──────────────────────────────────────────────────────────────────
// Find the invoice block precisely and inject the button
const searchStr = `🧾 Invoice: ₹\${req.invoice.total_amount} (\${req.invoice.payment_status.toUpperCase()})
            </div>`;

const replaceStr = `🧾 Invoice: ₹\${req.invoice.total_amount} (\${req.invoice.payment_status.toUpperCase()})
                <button class="c-action-btn invoice" style="margin-left:10px;background:#0284c7;font-size:12px;padding:4px 10px;color:#fff;border-radius:6px;border:none;cursor:pointer;" onclick="openTaxInvoiceModal('\${req._id}')">&#128065;&#65039; View Bill</button>
            </div>`;

if (js.includes(searchStr)) {
    js = js.replace(searchStr, replaceStr);
    console.log('✅ Step 1: View Bill button injected');
} else {
    // try with Windows CRLF
    const searchCRLF = searchStr.replace(/\n/g, '\r\n');
    if (js.includes(searchCRLF)) {
        js = js.replace(searchCRLF, replaceStr);
        console.log('✅ Step 1 (CRLF): View Bill button injected');
    } else {
        console.log('❌ Step 1 failed - printing nearest 300 chars for debugging:');
        const i = js.indexOf('req.invoice.total_amount');
        console.log(JSON.stringify(js.substring(i - 5, i + 250)));
    }
}

// ──────────────────────────────────────────────────────────────────
// 2. Store requests on window when loaded
// ──────────────────────────────────────────────────────────────────
if (!js.includes('window.companyRequestsData')) {
    // The pattern from the file is: allCompanyRequests = d.requests || [];
    const assignPattern = 'allCompanyRequests = d.requests || [];';
    if (js.includes(assignPattern)) {
        js = js.replace(assignPattern, assignPattern + '\n        window.companyRequestsData = allCompanyRequests;');
        console.log('✅ Step 2: window.companyRequestsData wired to allCompanyRequests');
    } else {
        console.log('⚠️  Step 2: Could not wire companyRequestsData - will fall back to allCompanyRequests in function');
    }
} else {
    console.log('✅ Step 2: window.companyRequestsData already present');
}

// ──────────────────────────────────────────────────────────────────
// 3. Append openTaxInvoiceModal function + close handlers
// ──────────────────────────────────────────────────────────────────
if (!js.includes('function openTaxInvoiceModal')) {
    const TAX_INVOICE_FUNC = `

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
`;

    js += TAX_INVOICE_FUNC;
    console.log('✅ Step 3: openTaxInvoiceModal function appended');
} else {
    console.log('✅ Step 3: openTaxInvoiceModal already exists');
}

fs.writeFileSync('public/company-dashboard.js', js);
console.log('\n✅ patch3.js complete — company-dashboard.js updated');
