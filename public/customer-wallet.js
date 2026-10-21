// ============================================
// CUSTOMER WALLET MODULE
// Domestic Services Platform
// ============================================

const WALLET_API = '/api/wallet';
let currentWalletBalance = 0;
let walletTxnPage = 1;
let walletProcessingTimer = null;
let walletProcessingStepTimer = null;
let walletActionInFlight = false;

function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
}

// ---- Load Wallet Balance ----
async function loadWalletBalance() {
    try {
        const res = await fetch(`${WALLET_API}/balance`, { headers: getAuthHeaders() });
        const data = await res.json();
        if (data.success) {
            currentWalletBalance = data.balance;
            updateWalletDisplays(data.balance);
        }
    } catch (err) {
        console.error('Load wallet balance error:', err);
    }
}

function updateWalletDisplays(balance) {
    const formatted = '₹' + Number(balance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const topbarEl = document.getElementById('topbarWalletBalance');
    const modalEl = document.getElementById('walletBalanceDisplay');
    if (topbarEl) topbarEl.textContent = formatted;
    if (modalEl) modalEl.textContent = formatted;
}

// ---- Open Wallet Modal ----
function openWalletModal() {
    document.getElementById('walletModal').classList.add('show');
    loadWalletBalance();
    loadWalletTransactions();
    loadPaymentRequests();
}

// ---- Add Money ----
async function addMoneyToWallet() {
    const input = document.getElementById('addMoneyAmount');
    const amount = parseFloat(input.value);
    
    if (!amount || amount <= 0) {
        showToast('Please enter a valid amount', 'error');
        return;
    }
    if (amount > 100000) {
        showToast('Maximum ₹1,00,000 can be added at once', 'error');
        return;
    }
    if (walletActionInFlight) return;
    walletActionInFlight = true;

    showProcessingOverlay(`Waiting for payment confirmation of ₹${amount.toLocaleString('en-IN')}...`, 'Recharging wallet');
    simulateProcessingBar(6);

    try {
        const res = await fetch(`${WALLET_API}/add-money`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ amount })
        });
        const data = await res.json();
        
        if (data.success) {
            completeProcessingBar();
            await new Promise((resolve) => setTimeout(resolve, 500));
            hideProcessingOverlay();
            showToast(`₹${amount.toLocaleString('en-IN')} added to wallet successfully!`, 'success');
            input.value = '';
            currentWalletBalance = data.balance;
            updateWalletDisplays(data.balance);
            loadWalletTransactions();
        } else {
            hideProcessingOverlay();
            showToast(data.message || 'Failed to add money', 'error');
        }
    } catch (err) {
        hideProcessingOverlay();
        console.error('Add money error:', err);
        showToast('Failed to add money. Please try again.', 'error');
    } finally {
        walletActionInFlight = false;
    }
}

function setQuickAmount(amount) {
    document.getElementById('addMoneyAmount').value = amount;
    document.getElementById('addMoneyAmount').focus();
}

// ---- Load Transactions ----
async function loadWalletTransactions(page) {
    if (page) walletTxnPage = page;
    const type = document.getElementById('txnFilterType')?.value || 'all';
    
    try {
        const res = await fetch(`${WALLET_API}/transactions?page=${walletTxnPage}&limit=15&type=${type}`, {
            headers: getAuthHeaders()
        });
        const data = await res.json();
        
        if (data.success) {
            renderTransactions(data.transactions, data.total, data.pages);
        }
    } catch (err) {
        console.error('Load transactions error:', err);
    }
}

function renderTransactions(transactions, total, pages) {
    const container = document.getElementById('walletTransactionsList');
    if (!container) return;
    
    if (!transactions || transactions.length === 0) {
        container.innerHTML = `
            <div class="wallet-empty-state">
                <div style="font-size:40px; margin-bottom:10px;">📭</div>
                <p>No transactions found</p>
            </div>`;
        document.getElementById('walletPagination').style.display = 'none';
        return;
    }

    container.innerHTML = transactions.map(txn => {
        const isCredit = txn.type === 'credit';
        const icon = isCredit ? '↓' : '↑';
        const sign = isCredit ? '+' : '-';
        const dateStr = new Date(txn.created_at).toLocaleDateString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        const statusColor = txn.status === 'completed' ? '#16a34a' : txn.status === 'pending' ? '#f59e0b' : '#dc2626';
        
        return `
            <div class="wallet-txn-item">
                <div class="wallet-txn-left">
                    <div class="wallet-txn-icon ${txn.type}">${icon}</div>
                    <div>
                        <div class="wallet-txn-desc">${txn.description || (isCredit ? 'Money Added' : 'Payment')}</div>
                        <div class="wallet-txn-date">${dateStr}</div>
                    </div>
                </div>
                <div class="wallet-txn-right">
                    <div class="wallet-txn-amount ${txn.type}">${sign}₹${Number(txn.amount).toLocaleString('en-IN')}</div>
                    <div class="wallet-txn-status" style="color:${statusColor}">${txn.status.toUpperCase()}</div>
                    <div class="wallet-txn-balance">Bal: ₹${Number(txn.balance_after).toLocaleString('en-IN')}</div>
                </div>
            </div>`;
    }).join('');

    // Pagination
    const pagContainer = document.getElementById('walletPagination');
    if (pages > 1) {
        pagContainer.style.display = 'flex';
        pagContainer.innerHTML = Array.from({ length: pages }, (_, i) => 
            `<button class="wallet-page-btn ${i + 1 === walletTxnPage ? 'active' : ''}" onclick="loadWalletTransactions(${i + 1})">${i + 1}</button>`
        ).join('');
    } else {
        pagContainer.style.display = 'none';
    }
}

// ---- Payment Requests ----
async function loadPaymentRequests() {
    try {
        const res = await fetch(`${WALLET_API}/payment-requests`, { headers: getAuthHeaders() });
        const data = await res.json();
        
        if (data.success && data.payment_requests && data.payment_requests.length > 0) {
            const section = document.getElementById('paymentRequestsSection');
            section.style.display = 'block';
            
            const container = document.getElementById('paymentRequestsList');
            container.innerHTML = data.payment_requests.map(pr => `
                <div class="wallet-pay-req-item">
                    <div class="wallet-pay-req-info">
                        <h4>💰 ${pr.description}</h4>
                        <p>${pr.payment_type.replace(/_/g, ' ').toUpperCase()} · ${new Date(pr.createdAt).toLocaleDateString('en-IN')}</p>
                    </div>
                    <div class="wallet-pay-req-amount">₹${Number(pr.amount).toLocaleString('en-IN')}</div>
                    <button class="wallet-pay-req-btn" onclick="payPaymentRequest('${pr._id}', ${pr.amount}, '${pr.service_request_id}')">Pay Now</button>
                </div>
            `).join('');
            
            // Update notification badge
            updateNotificationBadge(data.payment_requests.length);
        } else {
            document.getElementById('paymentRequestsSection').style.display = 'none';
        }
    } catch (err) {
        console.error('Load payment requests error:', err);
    }
}

async function payPaymentRequest(payReqId, amount, serviceRequestId) {
    if (currentWalletBalance < amount) {
        promptWalletRecharge(amount, dataMessageForShortfall(amount));
        return;
    }
    
    if (!confirm(`Pay ₹${Number(amount).toLocaleString('en-IN')} from your wallet?`)) return;
    
    showProcessingOverlay('Waiting for payment confirmation...', 'Processing payment');
    simulateProcessingBar(5);
    
    try {
        const res = await fetch(`${WALLET_API}/payment-requests/${payReqId}/pay`, {
            method: 'POST',
            headers: getAuthHeaders()
        });
        const data = await res.json();
        
        hideProcessingOverlay();
        
        if (data.success) {
            completeProcessingBar();
            await new Promise((resolve) => setTimeout(resolve, 400));
            hideProcessingOverlay();
            showToast(data.message || 'Payment successful!', 'success');
            currentWalletBalance = data.balance;
            updateWalletDisplays(data.balance);
            loadPaymentRequests();
            loadWalletTransactions();
        } else {
            hideProcessingOverlay();
            if (data.insufficient_balance) {
                promptWalletRecharge(data.required_amount || amount, data.message);
            } else {
                showToast(data.message || 'Payment failed', 'error');
            }
        }
    } catch (err) {
        hideProcessingOverlay();
        console.error('Pay payment request error:', err);
        showToast('Payment failed. Please try again.', 'error');
    }
}

// ---- Pay from Wallet (for booking confirmation & final payment) ----
async function payFromWallet(requestId, amount, paymentType, description) {
    if (currentWalletBalance < amount) {
        promptWalletRecharge(amount, `Insufficient balance. Recharge your wallet to pay ₹${Number(amount).toLocaleString('en-IN')}.`);
        return;
    }
    
    if (!confirm(`Pay ₹${Number(amount).toLocaleString('en-IN')} from your wallet for ${description}?`)) return;
    
    showProcessingOverlay(`Waiting for payment: ${description}`, 'Waiting for payment');
    simulateProcessingBar(6);
    
    try {
        const res = await fetch(`${WALLET_API}/pay/${requestId}`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ amount, payment_type: paymentType, description })
        });
        const data = await res.json();
        
        hideProcessingOverlay();
        
        if (data.success) {
            completeProcessingBar();
            await new Promise((resolve) => setTimeout(resolve, 400));
            hideProcessingOverlay();
            showToast(data.message || 'Payment successful!', 'success');
            currentWalletBalance = data.balance;
            updateWalletDisplays(data.balance);
            
            // Refresh the requests view if it's open
            if (typeof loadMyRequests === 'function') loadMyRequests();
            if (typeof loadCustomerRequests === 'function') loadCustomerRequests();
            if (typeof loadDashboardData === 'function') loadDashboardData();
        } else {
            hideProcessingOverlay();
            if (data.insufficient_balance) {
                promptWalletRecharge(data.required_amount || amount, data.message);
            } else {
                showToast(data.message || 'Payment failed', 'error');
            }
        }
    } catch (err) {
        hideProcessingOverlay();
        console.error('Wallet pay error:', err);
        showToast('Payment failed. Please try again.', 'error');
    }
}

function dataMessageForShortfall(amount) {
    return `Insufficient balance. You need ₹${Number(amount).toLocaleString('en-IN')} but have ₹${Number(currentWalletBalance).toLocaleString('en-IN')}. Please recharge your wallet.`;
}

function promptWalletRecharge(requiredAmount, message) {
    const need = Number(requiredAmount) || 0;
    const shortfall = Math.max(1, Math.ceil(need - Number(currentWalletBalance || 0)));
    showToast(message || dataMessageForShortfall(need), 'error');
    openWalletModal();
    const input = document.getElementById('addMoneyAmount');
    if (input) {
        input.value = shortfall;
        input.focus();
    }
}

window.promptWalletRecharge = promptWalletRecharge;

// ---- Processing Overlay ----
function showProcessingOverlay(msg, title) {
    const overlay = document.getElementById('walletProcessingOverlay');
    const titleEl = document.getElementById('walletProcessingTitle');
    if (titleEl) titleEl.textContent = title || 'Waiting for payment';
    document.getElementById('walletProcessingMsg').textContent = msg || 'Waiting for payment confirmation...';
    document.getElementById('walletProcessingBarFill').style.width = '0%';
    overlay.style.display = 'flex';
    updateProcessingSteps(1);
}

function hideProcessingOverlay() {
    if (walletProcessingTimer) {
        clearInterval(walletProcessingTimer);
        walletProcessingTimer = null;
    }
    if (walletProcessingStepTimer) {
        clearInterval(walletProcessingStepTimer);
        walletProcessingStepTimer = null;
    }
    document.getElementById('walletProcessingOverlay').style.display = 'none';
    document.getElementById('walletProcessingBarFill').style.width = '0%';
    updateProcessingSteps(0);
}

function updateProcessingSteps(activeStep) {
    const steps = document.querySelectorAll('#walletProcessingSteps .wallet-step');
    steps.forEach((step) => {
        const n = Number(step.getAttribute('data-step'));
        step.classList.remove('active', 'done');
        if (activeStep <= 0) return;
        if (n < activeStep) step.classList.add('done');
        else if (n === activeStep) step.classList.add('active');
    });
}

function simulateProcessingBar(durationSec) {
    const bar = document.getElementById('walletProcessingBarFill');
    if (walletProcessingTimer) clearInterval(walletProcessingTimer);
    if (walletProcessingStepTimer) clearInterval(walletProcessingStepTimer);
    let progress = 0;
    const ticks = Math.max(1, durationSec * 10);
    walletProcessingTimer = setInterval(() => {
        progress += 100 / ticks;
        if (progress >= 92) {
            clearInterval(walletProcessingTimer);
            walletProcessingTimer = null;
            bar.style.width = '92%';
            updateProcessingSteps(4);
        } else {
            bar.style.width = progress + '%';
            if (progress < 25) updateProcessingSteps(1);
            else if (progress < 50) updateProcessingSteps(2);
            else if (progress < 75) updateProcessingSteps(3);
            else updateProcessingSteps(4);
        }
    }, 100);
}

function completeProcessingBar() {
    const bar = document.getElementById('walletProcessingBarFill');
    if (walletProcessingTimer) {
        clearInterval(walletProcessingTimer);
        walletProcessingTimer = null;
    }
    updateProcessingSteps(5);
    if (bar) bar.style.width = '100%';
    const titleEl = document.getElementById('walletProcessingTitle');
    if (titleEl) titleEl.textContent = 'Payment successful';
    const msgEl = document.getElementById('walletProcessingMsg');
    if (msgEl) msgEl.textContent = 'Wallet updated. You can continue.';
}

// ---- Notifications ----
function updateNotificationBadge(count) {
    const badge = document.getElementById('notifBadge');
    if (badge) {
        if (count > 0) {
            badge.textContent = count;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }
}

function openNotificationsPanel() {
    document.getElementById('notificationsModal').classList.add('show');
    loadNotifications();
}

async function loadNotifications() {
    try {
        const res = await fetch(`${WALLET_API}/payment-requests`, { headers: getAuthHeaders() });
        const data = await res.json();
        const container = document.getElementById('notificationsList');
        
        if (data.success && data.payment_requests && data.payment_requests.length > 0) {
            container.innerHTML = data.payment_requests.map(pr => `
                <div class="notif-item unread">
                    <div class="notif-icon">💰</div>
                    <div class="notif-content" style="flex:1;">
                        <h4>Payment Requested</h4>
                        <p>${pr.description} — ₹${Number(pr.amount).toLocaleString('en-IN')}</p>
                        <small>${new Date(pr.createdAt).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}</small>
                    </div>
                    <button class="notif-pay-btn" onclick="document.getElementById('notificationsModal').classList.remove('show'); payPaymentRequest('${pr._id}', ${pr.amount}, '${pr.service_request_id}')">Pay ₹${Number(pr.amount).toLocaleString('en-IN')}</button>
                </div>
            `).join('');
        } else {
            container.innerHTML = `
                <div class="wallet-empty-state">
                    <div style="font-size:32px; margin-bottom:8px;">✅</div>
                    <p>You're all caught up!</p>
                </div>`;
        }
    } catch (err) {
        console.error('Load notifications error:', err);
    }
}

// ---- Init: Load wallet on page load ----
document.addEventListener('DOMContentLoaded', function() {
    const token = localStorage.getItem('token');
    if (token) {
        loadWalletBalance();
        // Poll for payment requests every 30 seconds
        setInterval(() => {
            loadPaymentRequests();
        }, 30000);
    }
    
    // Wallet sidebar button handler
    const walletBtn = document.getElementById('walletBtn');
    if (walletBtn) {
        walletBtn.addEventListener('click', function() {
            // Remove active from all sidebar items
            document.querySelectorAll('.side-item').forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            openWalletModal();
        });
    }
});
