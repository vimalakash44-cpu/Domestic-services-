const fs = require('fs');
let js = fs.readFileSync('public/company-dashboard.js', 'utf8');

// 1. Add "View Bill" button next to invoice amount
const oldInvoiceBlock = `if(req.invoice && req.invoice.total_amount){
            html += \`
                <div style="color:#7e22ce; font-weight:700;">
                    🧾 Invoice: ₹\${req.invoice.total_amount} (\${req.invoice.payment_status.toUpperCase()})
                </div>
            \`;
        }`;

const newInvoiceBlock = `if(req.invoice && req.invoice.total_amount){
            html += \`
                <div style="color:#7e22ce; font-weight:700; display:flex; justify-content:space-between; align-items:center;">
                    <span>🧾 Invoice: ₹\${req.invoice.total_amount} (\${req.invoice.payment_status.toUpperCase()})</span>
                    <button class="c-action-btn invoice" style="margin-left:10px;background:#0284c7;font-size:12px;padding:4px 10px;color:#fff;" onclick="openTaxInvoiceModal('\${req._id}')">👁️ View Bill</button>
                </div>
            \`;
        }`;

if (js.includes(oldInvoiceBlock)) {
    js = js.replace(oldInvoiceBlock, newInvoiceBlock);
    console.log('✅ Invoice display updated with View Bill button');
} else {
    console.log('⚠️  Invoice block not found - checking current content...');
    const idx = js.indexOf('req.invoice && req.invoice.total_amount');
    if (idx !== -1) {
        console.log('Found at index:', idx);
        console.log(js.substring(idx - 20, idx + 300));
    }
}

// 2. Also store fetched requests on window so modal can find them
js = js.replace(
    'window.companyRequestsData = requests;',
    'window.companyRequestsData = requests;'
);

// If not already stored, add storage when requests are loaded
if (!js.includes('window.companyRequestsData')) {
    // Find where we set allRequests or process the requests array
    js = js.replace(
        /const requests = data\.requests \|\| data \|\| \[\];/,
        'const requests = data.requests || data || [];\n    window.companyRequestsData = requests;'
    );
    if (!js.includes('window.companyRequestsData')) {
        // Try alternative pattern
        js = js.replace(
            /const requests = data \|\| \[\];/,
            'const requests = data || [];\n    window.companyRequestsData = requests;'
        );
    }
}

// 3. Append openTaxInvoiceModal function before the last loadDashboard() call
const taxInvoiceFunction = `
// =========================================================
// VIEW DETAILED TAX INVOICE MODAL (Company Side)
// =========================================================
function openTaxInvoiceModal(requestId) {
    const allReqs = window.companyRequestsData || [];
    const req = allReqs.find(r => r._id === requestId);
    if (!req || !req.invoice) {
        showToast('Invoice data not available.', 'error');
        return;
    }

    const compName = req.company_name || 'Authorized Service Provider';
    const custName = req.customer_name || 'Customer';
    const inv = req.invoice;
    const invDate = inv.generated_at
        ? new Date(inv.generated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
        : new Date().toLocaleDateString('en-IN');

    const container = document.getElementById('printableTaxInvoiceArea');
    if (!container) return;

    let materialsRows = '';
    if (inv.materials_items && inv.materials_items.length > 0) {
        inv.materials_items.forEach(m => {
            materialsRows += \`
                <tr style="border-bottom:1px solid #e2e8f0;">
                    <td style="padding:8px 10px;">
                        <strong>📦 \${escapeHtml(m.item_name)}</strong>
                        <div style="font-size:11px;color:#64748b;">Material @ ₹\${m.unit_price}/unit</div>
                    </td>
                    <td style="padding:8px;text-align:center;">\${escapeHtml(String(m.quantity))}</td>
                    <td style="padding:8px;text-align:right;font-weight:600;">₹\${Number(m.unit_price||0).toFixed(2)}</td>
                    <td style="padding:8px;text-align:right;font-weight:600;color:#0f172a;">₹\${Number(m.total_price||0).toFixed(2)}</td>
                </tr>
            \`;
        });
    }

    let laborRows = '';
    if (inv.labor_items && inv.labor_items.length > 0) {
        inv.labor_items.forEach(l => {
            laborRows += \`
                <tr style="border-bottom:1px solid #e2e8f0;">
                    <td style="padding:8px 10px;">
                        <strong>👷 \${escapeHtml(l.worker_name)} — Labor</strong>
                        <div style="font-size:11px;color:#64748b;">\${escapeHtml(l.role || 'Technician')} @ ₹\${l.daily_rate}/day</div>
                    </td>
                    <td style="padding:8px;text-align:center;">\${l.days} day(s)</td>
                    <td style="padding:8px;text-align:right;font-weight:600;">₹\${Number(l.daily_rate||0).toFixed(2)}</td>
                    <td style="padding:8px;text-align:right;font-weight:600;color:#0f172a;">₹\${Number(l.total_labor||0).toFixed(2)}</td>
                </tr>
            \`;
        });
    }

    let taxRow = '';
    if (inv.tax_or_other) {
        taxRow = \`
            <tr style="border-bottom:1px solid #e2e8f0;background:#fffbeb;">
                <td style="padding:8px 10px;" colspan="3"><strong>Taxes &amp; Other Charges</strong></td>
                <td style="padding:8px;text-align:right;font-weight:600;">₹\${Number(inv.tax_or_other||0).toFixed(2)}</td>
            </tr>
        \`;
    }

    const paidBadge = inv.payment_status === 'paid'
        ? \`<span style="display:inline-block;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;background:#dcfce7;color:#166534;">✅ PAID IN FULL</span>\`
        : \`<span style="display:inline-block;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;background:#fef3c7;color:#92400e;">⏳ PENDING PAYMENT</span>\`;

    container.innerHTML = \`
        <div style="font-family:sans-serif;">
            <!-- Header -->
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid #e2e8f0;">
                <div>
                    <h3 style="margin:0 0 4px 0;font-size:18px;color:#0f172a;">\${escapeHtml(compName)}</h3>
                    <p style="margin:2px 0;font-size:12px;color:#64748b;">Licensed &amp; Insured Domestic Service Provider</p>
                    <p style="margin:2px 0;font-size:12px;color:#64748b;">Billed To: <strong>\${escapeHtml(custName)}</strong></p>
                    <p style="margin:2px 0;font-size:12px;color:#64748b;">Location: \${escapeHtml(req.service_address || '')}</p>
                    <p style="margin:2px 0;font-size:12px;color:#64748b;">Service: <strong>\${escapeHtml(req.service || '')}</strong></p>
                </div>
                <div style="text-align:right;">
                    <h2 style="margin:0 0 6px 0;font-size:20px;color:#1e40af;letter-spacing:1px;">TAX INVOICE</h2>
                    <p style="margin:2px 0;font-size:12px;color:#475569;">Invoice #: <strong>\${escapeHtml(inv.invoice_number || 'N/A')}</strong></p>
                    <p style="margin:2px 0;font-size:12px;color:#475569;">Date: \${invDate}</p>
                    <div style="margin-top:8px;">\${paidBadge}</div>
                </div>
            </div>

            <!-- Line Items Table -->
            <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px;">
                <thead>
                    <tr style="background:#f1f5f9;border-bottom:2px solid #cbd5e1;">
                        <th style="padding:8px 10px;text-align:left;">Description</th>
                        <th style="padding:8px;text-align:center;">Qty / Days</th>
                        <th style="padding:8px;text-align:right;">Unit Rate (₹)</th>
                        <th style="padding:8px;text-align:right;">Total (₹)</th>
                    </tr>
                </thead>
                <tbody>
                    \${materialsRows || '<tr><td colspan="4" style="padding:8px;color:#94a3b8;font-style:italic;">No materials listed</td></tr>'}
                    \${laborRows || '<tr><td colspan="4" style="padding:8px;color:#94a3b8;font-style:italic;">No labor items listed</td></tr>'}
                    \${taxRow}
                </tbody>
            </table>

            <!-- Totals -->
            <div style="display:flex;justify-content:flex-end;">
                <table style="width:280px;font-size:13px;border-collapse:collapse;">
                    <tr style="border-bottom:1px solid #e2e8f0;">
                        <td style="padding:6px 8px;color:#64748b;">Materials Subtotal</td>
                        <td style="padding:6px 8px;text-align:right;font-weight:600;">₹\${Number(inv.materials_total||0).toFixed(2)}</td>
                    </tr>
                    <tr style="border-bottom:1px solid #e2e8f0;">
                        <td style="padding:6px 8px;color:#64748b;">Labour Subtotal</td>
                        <td style="padding:6px 8px;text-align:right;font-weight:600;">₹\${Number(inv.labor_total||0).toFixed(2)}</td>
                    </tr>
                    \${inv.tax_or_other ? \`<tr style="border-bottom:1px solid #e2e8f0;">
                        <td style="padding:6px 8px;color:#64748b;">Tax / Other</td>
                        <td style="padding:6px 8px;text-align:right;font-weight:600;">₹\${Number(inv.tax_or_other||0).toFixed(2)}</td>
                    </tr>\` : ''}
                    <tr style="background:#0f172a;color:#fff;font-size:15px;">
                        <td style="padding:10px 8px;font-weight:700;border-radius:4px 0 0 4px;">Grand Total</td>
                        <td style="padding:10px 8px;text-align:right;font-weight:700;border-radius:0 4px 4px 0;">₹\${Number(inv.total_amount||0).toFixed(2)}</td>
                    </tr>
                </table>
            </div>

            <p style="margin-top:20px;font-size:11px;color:#94a3b8;text-align:center;">Thank you for choosing our service. Please contact us for any billing queries.</p>
        </div>
    \`;

    document.getElementById('taxInvoiceModal').classList.add('show');
}

// Close handlers for Tax Invoice Modal
(function() {
    const modal = document.getElementById('taxInvoiceModal');
    const closeBtn = document.getElementById('closeTaxInvoiceModal');
    if (closeBtn) closeBtn.addEventListener('click', () => modal && modal.classList.remove('show'));
    if (modal) modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('show'); });
})();
`;

js = js.replace('loadDashboard();\nloadCompanyRequests();\nloadCompanyChats();', 
    taxInvoiceFunction + '\nloadDashboard();\nloadCompanyRequests();\nloadCompanyChats();');

fs.writeFileSync('public/company-dashboard.js', js);
console.log('✅ patch.js complete');
