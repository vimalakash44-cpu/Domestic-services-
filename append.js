function openTaxInvoiceModal(requestId) {
    const req = window.companyRequestsData.find(r => r._id === requestId);
    if (!req || !req.invoice) return;

    const compName = req.company_name || 'Authorized Service Provider';
    const custName = req.customer_name || 'Customer';
    const inv = req.invoice;
    const invDate = inv.generated_at ? new Date(inv.generated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : new Date().toLocaleDateString();

    const container = document.getElementById('printableTaxInvoiceArea');
    if (!container) return;

    let html = \
        <div class='tax-invoice-container'>
            <div class='invoice-meta-header' style='display:flex; justify-content:space-between; margin-bottom:20px;'>
                <div class='invoice-company-info'>
                    <h3 style='margin:0; font-size:18px;'>\</h3>
                    <p style='font-size:12px; color:#64748b; margin:2px 0;'>Licensed & Insured Domestic Service Provider</p>
                    <p style='font-size:12px; color:#64748b; margin:2px 0;'>Billed To: <strong>\</strong></p>
                    <p style='font-size:12px; color:#64748b; margin:2px 0;'>Service Location: \</p>
                </div>
                <div style='text-align:right;'>
                    <h2 style='font-size:18px; color:#0f172a; margin:0 0 4px 0;'>TAX INVOICE</h2>
                    <p style='font-size:12px; color:#475569; margin:2px 0;'>Invoice #: <strong>\</strong></p>
                    <p style='font-size:12px; color:#475569; margin:2px 0;'>Date: \</p>
                    <div style='margin-top:8px;'>
                        <span style='display:inline-block; padding:4px 8px; border-radius:4px; font-size:12px; font-weight:700; background:\; color:\;'>
                            \
                        </span>
                    </div>
                </div>
            </div>

            <table style='width:100%; border-collapse:collapse; margin-bottom:20px; font-size:13px; text-align:left;'>
                <thead>
                    <tr style='background:#f1f5f9; border-bottom:1px solid #e2e8f0;'>
                        <th style='padding:8px;'>Item Description</th>
                        <th style='padding:8px;'>Scope / Qty</th>
                        <th style='padding:8px; text-align:right;'>Amount (₹)</th>
                    </tr>
                </thead>
                <tbody>
    \;

    if (inv.materials_items && inv.materials_items.length > 0) {
        inv.materials_items.forEach(m => {
            html += \
                <tr style='border-bottom:1px solid #e2e8f0;'>
                    <td style='padding:8px;'>
                        <strong>📦 \</strong>
                        <div style='font-size:11px; color:#64748b;'>Material item @ ₹\/unit</div>
                    </td>
                    <td style='padding:8px;'>\</td>
                    <td style='padding:8px; text-align:right; font-weight:600;'>₹\</td>
                </tr>
            \;
        });
    }

    if (inv.labor_items && inv.labor_items.length > 0) {
        inv.labor_items.forEach(l => {
            html += \
                <tr style='border-bottom:1px solid #e2e8f0;'>
                    <td style='padding:8px;'>
                        <strong>👷 \ — Labor</strong>
                        <div style='font-size:11px; color:#64748b;'>\ @ ₹\/day</div>
                    </td>
                    <td style='padding:8px;'>\ Day(s)</td>
                    <td style='padding:8px; text-align:right; font-weight:600;'>₹\</td>
                </tr>
            \;
        });
    }

    if (inv.tax_or_other) {
        html += \
            <tr style='border-bottom:1px solid #e2e8f0;'>
                <td style='padding:8px;'><strong>Taxes & Other Fees</strong></td>
                <td style='padding:8px;'>Statutory</td>
                <td style='padding:8px; text-align:right; font-weight:600;'>₹\</td>
            </tr>
        \;
    }

    html += \
                </tbody>
            </table>
            
            <div style='display:flex; justify-content:flex-end;'>
                <table style='width:300px; font-size:13px; text-align:right; border-collapse:collapse;'>
                    <tr style='border-bottom:1px solid #e2e8f0;'>
                        <td style='padding:6px; color:#64748b;'>Materials Subtotal:</td>
                        <td style='padding:6px; font-weight:600;'>₹\</td>
                    </tr>
                    <tr style='border-bottom:1px solid #e2e8f0;'>
                        <td style='padding:6px; color:#64748b;'>Labor Subtotal:</td>
                        <td style='padding:6px; font-weight:600;'>₹\</td>
                    </tr>
                    <tr style='font-size:16px;'>
                        <td style='padding:8px; font-weight:700;'>Grand Total:</td>
                        <td style='padding:8px; font-weight:700; color:#0f172a;'>₹\</td>
                    </tr>
                </table>
            </div>
        </div>
    \;

    container.innerHTML = html;
    document.getElementById('taxInvoiceModal').classList.add('show');
}

const taxInvoiceModal = document.getElementById('taxInvoiceModal');
const closeTaxInvoiceModal = document.getElementById('closeTaxInvoiceModal');
if (closeTaxInvoiceModal) {
    closeTaxInvoiceModal.addEventListener('click', () => taxInvoiceModal.classList.remove('show'));
}
if (taxInvoiceModal) {
    taxInvoiceModal.addEventListener('click', event => {
        if (event.target === taxInvoiceModal) taxInvoiceModal.classList.remove('show');
    });
}

