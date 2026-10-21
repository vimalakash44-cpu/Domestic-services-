const express = require("express");
const Wallet = require("../models/Wallet");
const PaymentRequest = require("../models/PaymentRequest");
const ServiceRequest = require("../models/ServiceRequest");
const Company = require("../models/Company");
const User = require("../models/User");
const ChatMessage = require("../models/ChatMessage");
const authMiddleware = require("../middleware/authMiddleware");
const { allocateWorkersOnBookingAdvance, releaseWorkerAvailabilityForRequest } = require("../utils/workerAllocation");

const router = express.Router();

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function quotedJobTotal(request) {
    return Number(request.quotation?.estimated_cost || request.quotation?.labor_total || 0);
}

function halfAdvanceAmount(request) {
    return Number((quotedJobTotal(request) * 0.5).toFixed(2));
}

// Transfer / Credit funds directly to company wallet
async function creditCompanyWallet(companyId, amount, description, referenceId, referenceType) {
    if (!companyId || !amount || amount <= 0) return null;
    try {
        const company = await Company.findById(companyId);
        if (!company || !company.user_id) return null;

        let compWallet = await Wallet.findOne({ user_id: company.user_id });
        if (!compWallet) {
            compWallet = new Wallet({
                user_id: company.user_id,
                balance: 0,
                transactions: []
            });
        }

        const validAmt = Number(Number(amount).toFixed(2));
        compWallet.balance = Number((compWallet.balance + validAmt).toFixed(2));
        compWallet.transactions.push({
            type: "credit",
            amount: validAmt,
            description: description || `Payment received: ₹${validAmt}`,
            reference_id: referenceId,
            reference_type: referenceType || "final_payment",
            status: "completed",
            balance_after: compWallet.balance,
            created_at: new Date()
        });
        await compWallet.save();
        return compWallet;
    } catch (err) {
        console.warn("Failed to credit company wallet:", err);
        return null;
    }
}

// Helper middleware to check if user is customer
const requireCustomer = (req, res, next) => {
    if (!req.user || req.user.role !== "customer") {
        return res.status(403).json({
            success: false,
            message: "Access restricted to customers only."
        });
    }
    next();
};

// GET /api/wallet/balance
router.get("/balance", authMiddleware, requireCustomer, async (req, res) => {
    try {
        let wallet = await Wallet.findOne({ user_id: req.user.id });

        if (!wallet) {
            wallet = new Wallet({
                user_id: req.user.id,
                balance: 0,
                transactions: []
            });
            await wallet.save();
        }

        res.json({
            success: true,
            balance: wallet.balance,
            wallet_id: wallet._id
        });
    } catch (error) {
        console.error("Get wallet balance error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to retrieve wallet balance."
        });
    }
});

// POST /api/wallet/add-money
router.post("/add-money", authMiddleware, requireCustomer, async (req, res) => {
    try {
        const { amount } = req.body;
        const numAmount = Number(amount);

        if (amount === undefined || amount === null || isNaN(numAmount) || numAmount <= 0 || numAmount > 100000) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid amount between ₹1 and ₹1,00,000."
            });
        }

        let wallet = await Wallet.findOne({ user_id: req.user.id });
        if (!wallet) {
            wallet = new Wallet({
                user_id: req.user.id,
                balance: 0,
                transactions: []
            });
        }

        const validAmount = Number(numAmount.toFixed(2));
        await sleep(5000);
        const newBalance = Number((wallet.balance + validAmount).toFixed(2));
        wallet.balance = newBalance;

        const newTx = {
            type: "credit",
            amount: validAmount,
            description: `Added ₹${validAmount} to wallet`,
            reference_type: "add_money",
            status: "completed",
            balance_after: newBalance,
            created_at: new Date()
        };

        wallet.transactions.push(newTx);
        await wallet.save();

        const savedTx = wallet.transactions[wallet.transactions.length - 1];

        res.json({
            success: true,
            message: `₹${validAmount} added to wallet successfully.`,
            balance: newBalance,
            transaction: savedTx
        });
    } catch (error) {
        console.error("Add money error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to add money to wallet."
        });
    }
});

// GET /api/wallet/transactions
router.get("/transactions", authMiddleware, requireCustomer, async (req, res) => {
    try {
        let wallet = await Wallet.findOne({ user_id: req.user.id });

        if (!wallet) {
            wallet = new Wallet({
                user_id: req.user.id,
                balance: 0,
                transactions: []
            });
            await wallet.save();
        }

        let txs = [...(wallet.transactions || [])];

        const { type } = req.query;
        if (type && type !== "all") {
            if (type === "credit" || type === "debit") {
                txs = txs.filter((t) => t.type === type);
            }
        }

        // Sort by created_at desc
        txs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.max(1, parseInt(req.query.limit, 10) || 20);
        const total = txs.length;
        const pages = Math.ceil(total / limit) || 1;
        const startIndex = (page - 1) * limit;
        const paginatedTransactions = txs.slice(startIndex, startIndex + limit);

        res.json({
            success: true,
            transactions: paginatedTransactions,
            total,
            page,
            pages
        });
    } catch (error) {
        console.error("Get transactions error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch transactions."
        });
    }
});

// POST /api/wallet/pay/:requestId
router.post("/pay/:requestId", authMiddleware, requireCustomer, async (req, res) => {
    try {
        const { amount, payment_type, description } = req.body;
        const numAmount = Number(amount);

        if (!numAmount || isNaN(numAmount) || numAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Please specify a valid payment amount greater than 0."
            });
        }

        const validTypes = [
            "booking_advance",
            "booking_confirmation",
            "material_purchase",
            "milestone_payment",
            "final_payment"
        ];
        if (!payment_type || !validTypes.includes(payment_type)) {
            return res.status(400).json({
                success: false,
                message: "Invalid payment type provided."
            });
        }

        const request = await ServiceRequest.findOne({
            _id: req.params.requestId,
            customer_id: req.user.id
        });

        if (!request) {
            return res.status(404).json({
                success: false,
                message: "Service request not found."
            });
        }

        let wallet = await Wallet.findOne({ user_id: req.user.id });
        if (!wallet) {
            wallet = new Wallet({
                user_id: req.user.id,
                balance: 0,
                transactions: []
            });
        }

        const payAmount = Number(numAmount.toFixed(2));
        if (wallet.balance < payAmount) {
            return res.status(400).json({
                success: false,
                insufficient_balance: true,
                required_amount: payAmount,
                balance: wallet.balance,
                message: `Insufficient wallet balance. Available: ₹${wallet.balance}, Required: ₹${payAmount}. Please recharge your wallet.`
            });
        }

        let refType = "material_payment";
        let messageText = "";

        if (payment_type === "booking_confirmation" || payment_type === "booking_advance") {
            if (request.status !== "quoted") {
                return res.status(400).json({
                    success: false,
                    message: "This request does not have a pending quotation to confirm."
                });
            }

            const requiredAdvance = halfAdvanceAmount(request);
            if (Number(payAmount.toFixed(2)) < requiredAdvance) {
                return res.status(400).json({
                    success: false,
                    required_amount: requiredAdvance,
                    message: `50% advance of ₹${requiredAdvance} is required to continue with this quotation.`
                });
            }

            await sleep(4000);

            request.status = "confirmed";
            request.customer_confirmed = true;
            request.confirmed_at = new Date();
            request.booking_advance_paid = (request.booking_advance_paid || 0) + payAmount;
            if (!request.quotation) request.quotation = {};
            request.quotation.advance_paid = (request.quotation.advance_paid || 0) + payAmount;
            await request.save({ validateModifiedOnly: true });

            // Auto-allocate available workers based on quotation start and end date
            const allocatedWorkers = await allocateWorkersOnBookingAdvance(request);

            refType = "booking_confirmation";
            const workerInfoStr = allocatedWorkers && allocatedWorkers.length > 0
                ? ` Technician(s) ${allocatedWorkers.map(w => w.name).join(", ")} allocated for ${request.start_date} to ${request.end_date}.`
                : "";
            messageText = `✅ Booking Confirmed & 50% Advance Paid: Customer paid ₹${payAmount} from wallet. Amount credited to company wallet.${workerInfoStr} Remaining amount is due after work is completed.`;
        } else if (payment_type === "material_purchase" || payment_type === "milestone_payment") {
            const pReqQuery = {
                service_request_id: request._id,
                customer_id: req.user.id,
                status: "pending"
            };
            if (req.body.payment_request_id) {
                pReqQuery._id = req.body.payment_request_id;
            }

            const paymentRequest = await PaymentRequest.findOne(pReqQuery);
            refType = "material_payment";
            const purposeLabel = description || (payment_type === "material_purchase" ? "materials purchase" : "milestone payment");
            messageText = `💰 Mid-work Payment Paid: Customer paid ₹${payAmount} for "${purposeLabel}" from wallet. Amount credited to company wallet.`;

            // Deduct from wallet
            const newBalance = Number((wallet.balance - payAmount).toFixed(2));
            wallet.balance = newBalance;

            const tx = {
                type: "debit",
                amount: payAmount,
                description: description || `Payment for ${payment_type.replace(/_/g, " ")}`,
                reference_id: request._id,
                reference_type: refType,
                status: "completed",
                balance_after: newBalance,
                created_at: new Date()
            };
            wallet.transactions.push(tx);
            await wallet.save();

            const savedTx = wallet.transactions[wallet.transactions.length - 1];

            if (paymentRequest) {
                paymentRequest.status = "paid";
                paymentRequest.paid_at = new Date();
                paymentRequest.wallet_transaction_id = savedTx._id;
                await paymentRequest.save();
            }

            // Transfer / credit directly into the company's wallet
            await creditCompanyWallet(
                request.company_id,
                payAmount,
                `Mid-work payment received from customer for ${purposeLabel}`,
                request._id,
                refType
            );

            // Chat Notification
            try {
                const customer = await User.findById(req.user.id);
                const payMsg = new ChatMessage({
                    customer_id: req.user.id,
                    company_id: request.company_id,
                    sender_id: req.user.id,
                    sender_role: "customer",
                    sender_name: customer ? customer.name : "Customer",
                    message: messageText,
                    msg_type: "text",
                    request_id: request._id,
                    metadata: {
                        payment_type,
                        amount: payAmount,
                        credited_to_company: true,
                        payment_request_id: paymentRequest ? paymentRequest._id : null
                    }
                });
                await payMsg.save();
            } catch (chatErr) {
                console.warn("Notice: Chat message notification could not be sent:", chatErr);
            }

            return res.json({
                success: true,
                message: `Payment of ₹${payAmount} processed and credited to company wallet.`,
                balance: newBalance,
                transaction: savedTx
            });
        } else if (payment_type === "final_payment") {
            if (request.status !== "completed" && request.status !== "work_submitted") {
                return res.status(400).json({
                    success: false,
                    message: "Remaining payment can be made once work is submitted or completed."
                });
            }

            if (!request.invoice || !request.invoice.total_amount) {
                return res.status(400).json({
                    success: false,
                    message: "No invoice has been issued for this request yet."
                });
            }

            if (request.invoice.payment_status === "paid") {
                return res.status(400).json({
                    success: false,
                    message: "This invoice has already been paid in full."
                });
            }

            await sleep(4000);

            request.status = "completed";
            request.invoice.payment_status = "paid";
            request.invoice.paid_at = new Date();
            const totalAmount = Number(request.invoice.total_amount || 0);
            request.booking_advance_paid = totalAmount;
            if (!request.quotation) request.quotation = {};
            request.quotation.advance_paid = totalAmount;
            await request.save({ validateModifiedOnly: true });

            // Release worker availability back to available
            await releaseWorkerAvailabilityForRequest(request._id);

            refType = "final_payment";
            messageText = `💳 Invoice Paid in Full: Customer paid remaining ₹${payAmount} from wallet. Amount credited to company wallet (Invoice #${request.invoice.invoice_number || ""}). Review and complaint are now unlocked.`;
        }

        // Deduct from wallet for booking_confirmation or final_payment
        const newBalance = Number((wallet.balance - payAmount).toFixed(2));
        wallet.balance = newBalance;

        const tx = {
            type: "debit",
            amount: payAmount,
            description: description || (refType === "booking_confirmation" ? `Booking advance (₹${payAmount}) for ${request.service}` : `Final payment for invoice #${request.invoice?.invoice_number || ""}`),
            reference_id: request._id,
            reference_type: refType,
            status: "completed",
            balance_after: newBalance,
            created_at: new Date()
        };
        wallet.transactions.push(tx);
        await wallet.save();

        const savedTx = wallet.transactions[wallet.transactions.length - 1];

        // Transfer / credit directly into company wallet
        await creditCompanyWallet(
            request.company_id,
            payAmount,
            description || (refType === "booking_confirmation" ? `Booking advance (50%) received for ${request.service}` : `Final payment received for invoice #${request.invoice?.invoice_number || ""}`),
            request._id,
            refType
        );

        // Chat notification
        try {
            const customer = await User.findById(req.user.id);
            const msgType = refType === "booking_confirmation" ? "quotation" : "invoice";
            const payMsg = new ChatMessage({
                customer_id: req.user.id,
                company_id: request.company_id,
                sender_id: req.user.id,
                sender_role: "customer",
                sender_name: customer ? customer.name : "Customer",
                message: messageText,
                msg_type: msgType,
                request_id: request._id,
                metadata: {
                    status: request.status,
                    payment_type,
                    amount: payAmount,
                    credited_to_company: true
                }
            });
            await payMsg.save();
        } catch (chatErr) {
            console.warn("Notice: Chat message notification could not be sent:", chatErr);
        }

        return res.json({
            success: true,
            message: "Payment processed successfully.",
            balance: newBalance,
            transaction: savedTx
        });
    } catch (error) {
        console.error("Pay request error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to process payment."
        });
    }
});

// GET /api/wallet/payment-requests
router.get("/payment-requests", authMiddleware, requireCustomer, async (req, res) => {
    try {
        const paymentRequests = await PaymentRequest.find({
            customer_id: req.user.id,
            status: "pending"
        })
            .populate("service_request_id", "service description status quotation invoice")
            .populate("company_id", "company_name phone")
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            payment_requests: paymentRequests
        });
    } catch (error) {
        console.error("Get payment requests error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch payment requests."
        });
    }
});

// POST /api/wallet/payment-requests/:id/pay
router.post("/payment-requests/:id/pay", authMiddleware, requireCustomer, async (req, res) => {
    try {
        const paymentRequest = await PaymentRequest.findOne({
            _id: req.params.id,
            customer_id: req.user.id,
            status: "pending"
        });

        if (!paymentRequest) {
            return res.status(404).json({
                success: false,
                message: "Payment request not found or already paid."
            });
        }

        let wallet = await Wallet.findOne({ user_id: req.user.id });
        if (!wallet) {
            wallet = new Wallet({
                user_id: req.user.id,
                balance: 0,
                transactions: []
            });
        }

        const payAmount = paymentRequest.amount;
        if (wallet.balance < payAmount) {
            return res.status(400).json({
                success: false,
                insufficient_balance: true,
                required_amount: payAmount,
                balance: wallet.balance,
                message: `Insufficient wallet balance. Available: ₹${wallet.balance}, Required: ₹${payAmount}. Please recharge your wallet.`
            });
        }

        const newBalance = Number((wallet.balance - payAmount).toFixed(2));
        wallet.balance = newBalance;

        let refType = "material_payment";
        if (paymentRequest.payment_type === "booking_advance") {
            refType = "booking_confirmation";
        }

        const tx = {
            type: "debit",
            amount: payAmount,
            description: paymentRequest.description || `Payment for ${paymentRequest.payment_type.replace(/_/g, " ")}`,
            reference_id: paymentRequest.service_request_id,
            reference_type: refType,
            status: "completed",
            balance_after: newBalance,
            created_at: new Date()
        };

        wallet.transactions.push(tx);
        await wallet.save();

        const savedTx = wallet.transactions[wallet.transactions.length - 1];

        paymentRequest.status = "paid";
        paymentRequest.paid_at = new Date();
        paymentRequest.wallet_transaction_id = savedTx._id;
        await paymentRequest.save();

        // Transfer / credit directly to company wallet
        await creditCompanyWallet(
            paymentRequest.company_id,
            payAmount,
            `Payment request received: ₹${payAmount} for "${paymentRequest.description || paymentRequest.payment_type}"`,
            paymentRequest._id,
            refType
        );

        const serviceRequest = await ServiceRequest.findById(paymentRequest.service_request_id);
        if (serviceRequest) {
            if (paymentRequest.payment_type === "booking_advance" && serviceRequest.status === "quoted") {
                serviceRequest.status = "confirmed";
                serviceRequest.customer_confirmed = true;
                serviceRequest.confirmed_at = new Date();
                serviceRequest.booking_advance_paid = (serviceRequest.booking_advance_paid || 0) + payAmount;
                if (!serviceRequest.quotation) serviceRequest.quotation = {};
                serviceRequest.quotation.advance_paid = (serviceRequest.quotation.advance_paid || 0) + payAmount;
                await serviceRequest.save({ validateModifiedOnly: true });

                // Auto-allocate available workers for scheduled dates
                await allocateWorkersOnBookingAdvance(serviceRequest);
            } else {
                serviceRequest.booking_advance_paid = (serviceRequest.booking_advance_paid || 0) + payAmount;
                if (!serviceRequest.quotation) serviceRequest.quotation = {};
                serviceRequest.quotation.advance_paid = (serviceRequest.quotation.advance_paid || 0) + payAmount;
                await serviceRequest.save({ validateModifiedOnly: true });
            }

            try {
                const customer = await User.findById(req.user.id);
                const payMsg = new ChatMessage({
                    customer_id: req.user.id,
                    company_id: paymentRequest.company_id,
                    sender_id: req.user.id,
                    sender_role: "customer",
                    sender_name: customer ? customer.name : "Customer",
                    message: `💰 Payment Request Paid: Customer paid ₹${payAmount} for "${paymentRequest.description}" from wallet. Amount credited to company wallet.`,
                    msg_type: "text",
                    request_id: serviceRequest._id,
                    metadata: {
                        payment_request_id: paymentRequest._id,
                        payment_type: paymentRequest.payment_type,
                        amount: payAmount,
                        credited_to_company: true
                    }
                });
                await payMsg.save();
            } catch (chatErr) {
                console.warn("Notice: Chat message notification could not be sent:", chatErr);
            }
        }

        res.json({
            success: true,
            message: `Payment of ₹${payAmount} completed successfully.`,
            balance: newBalance,
            transaction: savedTx
        });
    } catch (error) {
        console.error("Pay payment request error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to process payment request."
        });
    }
});

module.exports = router;
