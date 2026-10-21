const express = require("express");
const ServiceRequest = require("../models/ServiceRequest");
const Company = require("../models/Company");
const User = require("../models/User");
const Worker = require("../models/Worker");
const ChatMessage = require("../models/ChatMessage");
const authMiddleware = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");
const Wallet = require("../models/Wallet");
const PaymentRequest = require("../models/PaymentRequest");
const {
    allocateWorkersOnBookingAdvance,
    releaseWorkerAvailabilityForRequest,
    getDatesInRange,
    normalizeDateStr
} = require("../utils/workerAllocation");

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

function alreadyPaidForRequest(wallet, requestId) {
    return (wallet.transactions || [])
        .filter(
            (t) =>
                t.type === "debit" &&
                t.status === "completed" &&
                t.reference_id &&
                t.reference_id.toString() === requestId.toString()
        )
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);
}

// Transfer / Credit funds directly to the company's wallet
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

// Helper function to check if user is customer
const requireCustomer = (req, res, next) => {
    if (!req.user || req.user.role !== "customer") {
        return res.status(403).json({
            success: false,
            message: "Access restricted to customers only."
        });
    }
    next();
};

function qtyFromString(quantity) {
    const match = String(quantity || "").match(/[\d.]+/);
    return match ? parseFloat(match[0]) : 1;
}

function buildJobInvoiceParts(request) {
    const materials_items = (request.material_requisitions || []).map((m) => {
        const qtyNum = qtyFromString(m.quantity);
        const unit_price = Number(m.unit_price || 0);
        const total_price = Number(m.total_cost || Number((qtyNum * unit_price).toFixed(2)));
        return {
            item_name: m.item_name,
            quantity: String(m.quantity),
            unit_price,
            total_price
        };
    });
    const days = Number(request.quotation && request.quotation.estimated_days) || 1;
    const rate = Number(request.quotation && request.quotation.labor_daily_rate) || 0;
    let workers = request.assigned_workers || [];
    if (workers.length === 0) {
        const n = Number(request.quotation && request.quotation.workers_needed) || 1;
        workers = Array.from({ length: n }, (_, i) => ({ name: `Technician ${i + 1}` }));
    }
    const labor_items = workers.map((w) => ({
        worker_name: w.name || "Technician",
        role: "Technician",
        days,
        daily_rate: rate,
        total_labor: Number((days * rate).toFixed(2))
    }));
    const materials_total = materials_items.reduce((s, m) => s + Number(m.total_price || 0), 0);
    const labor_total = labor_items.reduce((s, l) => s + Number(l.total_labor || 0), 0);
    return {
        materials_items,
        labor_items,
        materials_total: Number(materials_total.toFixed(2)),
        labor_total: Number(labor_total.toFixed(2)),
        total_amount: Number((materials_total + labor_total).toFixed(2))
    };
}

// Create new service request with photos
router.post(
    "/requests",
    authMiddleware,
    upload.array("photos", 5),
    async (req, res) => {
        try {
            const customer_id = req.user.id;
            const customer = await User.findById(customer_id);

            if (!customer) {
                return res.status(404).json({
                    success: false,
                    message: "Customer account not found."
                });
            }

            const {
                company_id,
                service,
                priority,
                description,
                preferred_date,
                preferred_time,
                service_address
            } = req.body;

            if (!company_id || !service || !description || !service_address) {
                return res.status(400).json({
                    success: false,
                    message: "Please provide company, service type, description, and service address."
                });
            }

            if (preferred_date) {
                const normPreferred = normalizeDateStr(preferred_date);
                const todayStr = new Date().toISOString().split("T")[0];
                if (normPreferred && normPreferred < todayStr) {
                    return res.status(400).json({
                        success: false,
                        message: `Preferred date cannot be in the past (${normPreferred} is before today). Please select today or a future date.`
                    });
                }
            }

            const company = await Company.findById(company_id);
            if (!company) {
                return res.status(404).json({
                    success: false,
                    message: "Selected company does not exist."
                });
            }

            const photoPaths = req.files && req.files.length > 0
                ? req.files.map(file => "/uploads/" + file.filename)
                : [];

            const otpCode = Math.floor(1000 + Math.random() * 9000).toString();

            const newRequest = new ServiceRequest({
                customer_id: customer._id,
                customer_name: customer.name || "Customer",
                customer_phone: customer.phone || "",
                company_id: company._id,
                company_name: company.company_name,
                service,
                priority: priority || "normal",
                description,
                photos: photoPaths,
                service_address,
                preferred_date: preferred_date || "",
                preferred_time: preferred_time || "",
                status: "requested",
                completion_otp: otpCode
            });

            await newRequest.save();

            // Create customer chat message card
            const chatMsg = new ChatMessage({
                customer_id: customer._id,
                company_id: company._id,
                sender_id: customer._id,
                sender_role: "customer",
                sender_name: customer.name || "Customer",
                message: `📷 Service Request: ${service}. Problem: "${description}". Uploaded ${photoPaths.length} photo(s).`,
                msg_type: "request",
                request_id: newRequest._id,
                metadata: {
                    service,
                    priority: newRequest.priority,
                    photos: photoPaths,
                    address: service_address,
                    preferred_date
                }
            });
            await chatMsg.save();

            // Create automatic company bot response in chat
            const botMsg = new ChatMessage({
                customer_id: customer._id,
                company_id: company._id,
                sender_role: "bot",
                sender_name: `${company.company_name} Assistant`,
                message: `Hello ${customer.name || "there"}! We have received your service request for "${service}" along with your ${photoPaths.length} damage photo(s). Our team is analyzing the work required and will send a detailed quotation with worker requirements, duration, and expected cost shortly!`,
                msg_type: "text",
                request_id: newRequest._id
            });
            await botMsg.save();

            res.status(201).json({
                success: true,
                message: "Service request submitted successfully.",
                request: newRequest
            });
        } catch (error) {
            console.error("Create service request error:", error);
            res.status(500).json({
                success: false,
                message: error.message || "Failed to submit service request."
            });
        }
    }
);

// Get all requests for logged-in customer
router.get("/requests", authMiddleware, async (req, res) => {
    try {
        const customer_id = req.user.id;
        const requests = await ServiceRequest.find({ customer_id })
            .populate("company_id", "company_name phone email address city rating")
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            requests
        });
    } catch (error) {
        console.error("Get customer requests error:", error);
        res.status(500).json({
            success: false,
            message: "Unable to load service requests."
        });
    }
});

// Get single request detail
router.get("/requests/:id", authMiddleware, async (req, res) => {
    try {
        const request = await ServiceRequest.findOne({
            _id: req.params.id,
            customer_id: req.user.id
        }).populate("company_id");

        if (!request) {
            return res.status(404).json({
                success: false,
                message: "Service request not found."
            });
        }

        res.json({
            success: true,
            request
        });
    } catch (error) {
        console.error("Get single request error:", error);
        res.status(500).json({
            success: false,
            message: "Unable to load request details."
        });
    }
});

// Customer accepts/confirms quotation
router.post("/requests/:id/confirm", authMiddleware, async (req, res) => {
    try {
        const request = await ServiceRequest.findOne({
            _id: req.params.id,
            customer_id: req.user.id
        });

        if (!request) {
            return res.status(404).json({
                success: false,
                message: "Request not found."
            });
        }

        if (request.status !== "quoted") {
            return res.status(400).json({
                success: false,
                message: "This request does not have a pending quotation to confirm."
            });
        }

        const advanceAmount = halfAdvanceAmount(request);
        let walletBalance = 0;
        if (advanceAmount > 0) {
            let wallet = await Wallet.findOne({ user_id: req.user.id });
            if (!wallet) {
                wallet = new Wallet({
                    user_id: req.user.id,
                    balance: 0,
                    transactions: []
                });
            }

            if (wallet.balance < advanceAmount) {
                return res.status(400).json({
                    success: false,
                    insufficient_balance: true,
                    required_amount: advanceAmount,
                    balance: wallet.balance,
                    message: `Insufficient wallet balance. Pay 50% advance of ₹${advanceAmount} to continue. Your balance is ₹${wallet.balance}. Please recharge your wallet.`
                });
            }

            await sleep(4000);

            wallet.balance = Number((wallet.balance - advanceAmount).toFixed(2));
            walletBalance = wallet.balance;
            wallet.transactions.push({
                type: "debit",
                amount: advanceAmount,
                description: `Booking confirmation advance (50%) for ${request.service}`,
                reference_id: request._id,
                reference_type: "booking_confirmation",
                status: "completed",
                balance_after: wallet.balance,
                created_at: new Date()
            });
            await wallet.save();

            request.booking_advance_paid = (request.booking_advance_paid || 0) + advanceAmount;
            if (!request.quotation) request.quotation = {};
            request.quotation.advance_paid = (request.quotation.advance_paid || 0) + advanceAmount;
        }

        request.status = "confirmed";
        request.customer_confirmed = true;
        request.confirmed_at = new Date();
        await request.save({ validateModifiedOnly: true });

        try {
            const company = await Company.findById(request.company_id);
            const customer = await User.findById(req.user.id);
            const estCost = request.quotation?.estimated_cost ?? 0;
            const workersNeeded = request.quotation?.workers_needed || 1;
            const estDays = request.quotation?.estimated_days || 1;
            const dailyRate = request.quotation?.labor_daily_rate ?? 0;

            // Credit advance payment to the company's wallet
            if (advanceAmount > 0) {
                await creditCompanyWallet(
                    request.company_id,
                    advanceAmount,
                    `50% Advance received from ${customer?.name || "Customer"} for ${request.service}`,
                    request._id,
                    "booking_confirmation"
                );
            }

            // Allocate available workers based on quotation start and end date
            const allocatedWorkers = await allocateWorkersOnBookingAdvance(request);

            // Notify in chat
            const confMsg = new ChatMessage({
                customer_id: req.user.id,
                company_id: request.company_id,
                sender_id: req.user.id,
                sender_role: "customer",
                sender_name: customer ? customer.name : "Customer",
                message: `✅ Quotation Confirmed & Advance Paid: Customer paid 50% advance of ₹${advanceAmount} from wallet (credited to company wallet). Agreed labour ₹${estCost} (${workersNeeded} worker(s) × ~${estDays} day(s) at ₹${dailyRate}/day). Remaining amount is due after work is completed.`,
                msg_type: "quotation",
                request_id: request._id,
                metadata: {
                    status: request.status,
                    amount_paid: advanceAmount,
                    credited_to_company: true,
                    quotation: request.quotation || {},
                    assigned_workers: request.assigned_workers || []
                }
            });
            await confMsg.save();

            const workerNames = allocatedWorkers && allocatedWorkers.length > 0
                ? allocatedWorkers.map(w => w.name).join(", ")
                : "";

            const botReply = new ChatMessage({
                customer_id: req.user.id,
                company_id: request.company_id,
                sender_role: "bot",
                sender_name: company ? `${company.company_name} Assistant` : "Company Assistant",
                message: allocatedWorkers && allocatedWorkers.length > 0
                    ? `Great news! Customer paid ₹${advanceAmount} (50% advance). Certified technician(s) ${workerNames} are allocated for scheduled dates (${request.start_date} to ${request.end_date}) and marked busy for your job.`
                    : `Great news! Customer paid ₹${advanceAmount} (50% advance) directly to company wallet. ${company ? company.company_name : "The company"} is assigning certified workers to your project.`,
                msg_type: "text",
                request_id: request._id
            });
            await botReply.save();
        } catch (chatErr) {
            console.warn("Notice: Chat confirmation message could not be sent:", chatErr);
        }

        res.json({
            success: true,
            message: advanceAmount > 0
                ? `Quotation confirmed. ₹${advanceAmount} (50%) deducted from wallet.`
                : "Quotation confirmed successfully.",
            request,
            advance_paid: advanceAmount,
            balance: walletBalance
        });
    } catch (error) {
        console.error("Confirm quotation error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to confirm quotation."
        });
    }
});

// Customer pays invoice
router.post("/requests/:id/pay", authMiddleware, async (req, res) => {
    try {
        const request = await ServiceRequest.findOne({
            _id: req.params.id,
            customer_id: req.user.id
        });

        if (!request) {
            return res.status(404).json({
                success: false,
                message: "Request not found."
            });
        }

        if (request.status !== "completed" && request.status !== "work_submitted") {
            return res.status(400).json({
                success: false,
                message: "Remaining payment can be made once work is submitted or completed."
            });
        }

        if (!request.invoice || !request.invoice.total_amount) {
            // Build invoice from quotation if not already generated
            const built = buildJobInvoiceParts(request);
            request.invoice = {
                invoice_number: `INV-${Date.now().toString().slice(-6)}`,
                materials_items: built.materials_items,
                materials_total: built.materials_total,
                material_cost: built.materials_total,
                labor_items: built.labor_items,
                labor_total: built.labor_total,
                labor_cost: built.labor_total,
                tax_or_other: 0,
                total_amount: built.total_amount,
                notes: "Final service invoice.",
                generated_at: new Date(),
                payment_status: "unpaid"
            };
        }

        if (request.invoice.payment_status === "paid") {
            return res.status(400).json({
                success: false,
                message: "This invoice has already been paid in full."
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

        const totalAmount = Number(request.invoice.total_amount || quotedJobTotal(request) || 0);
        const alreadyPaidTotal = Math.max(
            Number(request.booking_advance_paid || 0),
            Number(request.quotation?.advance_paid || 0),
            alreadyPaidForRequest(wallet, request._id)
        );
        const remaining = Number((Math.max(0, totalAmount - alreadyPaidTotal)).toFixed(2));

        if (wallet.balance < remaining) {
            return res.status(400).json({
                success: false,
                insufficient_balance: true,
                required_amount: remaining,
                balance: wallet.balance,
                message: `Insufficient wallet balance. Remaining amount to pay is ₹${remaining} (Total: ₹${totalAmount}, Already paid: ₹${alreadyPaidTotal}). Your wallet balance is ₹${wallet.balance}. Please recharge your wallet.`
            });
        }

        if (remaining > 0) {
            wallet.balance = Number((wallet.balance - remaining).toFixed(2));
            wallet.transactions.push({
                type: "debit",
                amount: remaining,
                description: `Final invoice payment (Invoice #${request.invoice.invoice_number || ""}) for ${request.service}`,
                reference_id: request._id,
                reference_type: "final_payment",
                status: "completed",
                balance_after: wallet.balance,
                created_at: new Date()
            });
            await wallet.save();
        }

        await sleep(4000);

        request.status = "completed";
        request.invoice.payment_status = "paid";
        request.invoice.paid_at = new Date();
        request.booking_advance_paid = totalAmount;
        if (!request.quotation) request.quotation = {};
        request.quotation.advance_paid = totalAmount;
        await request.save();

        // Release worker availability back to available
        await releaseWorkerAvailabilityForRequest(request._id);

        const customer = await User.findById(req.user.id);

        // Credit remaining payment directly into the company's wallet
        if (remaining > 0) {
            await creditCompanyWallet(
                request.company_id,
                remaining,
                `Final invoice payment received from ${customer?.name || "Customer"} for ${request.service} (Invoice #${request.invoice.invoice_number || ""})`,
                request._id,
                "final_payment"
            );
        }

        const payMsg = new ChatMessage({
            customer_id: req.user.id,
            company_id: request.company_id,
            sender_id: req.user.id,
            sender_role: "customer",
            sender_name: customer ? customer.name : "Customer",
            message: `💳 Invoice Paid in Full: Customer paid remaining ₹${remaining} from wallet (credited to company wallet). Total billed ₹${totalAmount} (Invoice #${request.invoice.invoice_number}). Review and complaint are now unlocked.`,
            msg_type: "invoice",
            request_id: request._id,
            metadata: {
                payment_status: "paid",
                total_amount: totalAmount,
                remaining_paid: remaining,
                credited_to_company: true,
                invoice_number: request.invoice.invoice_number
            }
        });
        await payMsg.save();

        res.json({
            success: true,
            message: remaining > 0
                ? `Remaining ₹${remaining} paid from wallet. You can now review or raise a complaint.`
                : "Invoice marked as paid successfully.",
            request,
            remaining_paid: remaining,
            balance: wallet.balance
        });
    } catch (error) {
        console.error("Pay invoice error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to process payment."
        });
    }
});

// Customer inspects work on site and approves completion
router.post("/requests/:id/verify-completion", authMiddleware, async (req, res) => {
    try {
        const request = await ServiceRequest.findOne({
            _id: req.params.id,
            customer_id: req.user.id
        });

        if (!request) {
            return res.status(404).json({
                success: false,
                message: "Request not found."
            });
        }

        request.status = "completed";
        request.customer_signed_off = true;
        request.customer_signed_off_at = new Date();
        request.rework_requested = false;

        // If invoice is missing, generate it from the accepted quotation
        if (!request.invoice || !request.invoice.total_amount) {
            const built = buildJobInvoiceParts(request);
            request.invoice = {
                invoice_number: `INV-${Date.now().toString().slice(-6)}`,
                materials_items: built.materials_items,
                materials_total: built.materials_total,
                material_cost: built.materials_total,
                labor_items: built.labor_items,
                labor_total: built.labor_total,
                labor_cost: built.labor_total,
                tax_or_other: 0,
                total_amount: built.total_amount,
                notes: "Official work verified and signed off by customer. 30-Day Warranty Active.",
                generated_at: new Date(),
                payment_status: "unpaid"
            };
        }

        await request.save();

        // Release worker availability back to available
        await releaseWorkerAvailabilityForRequest(request._id);

        const customer = await User.findById(req.user.id);

        // Chat notification
        const verifyMsg = new ChatMessage({
            customer_id: req.user.id,
            company_id: request.company_id,
            sender_id: req.user.id,
            sender_role: "customer",
            sender_name: customer ? customer.name : "Customer",
            message: `✅ Work Inspection Approved & Signed Off! Final invoice is now ready for payment.`,
            msg_type: "invoice",
            request_id: request._id,
            metadata: {
                status: "completed",
                invoice: request.invoice
            }
        });
        await verifyMsg.save();

        res.json({
            success: true,
            message: "Work verified and approved!",
            request
        });
    } catch (error) {
        console.error("Verify completion error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to verify completion."
        });
    }
});

// Customer responds (accept or decline) to modified service dates proposed by company
router.post("/requests/:id/respond-date-change", authMiddleware, async (req, res) => {
    try {
        const { accept } = req.body;
        const request = await ServiceRequest.findOne({
            _id: req.params.id,
            customer_id: req.user.id
        });

        if (!request) {
            return res.status(404).json({ success: false, message: "Service request not found." });
        }

        if (!request.date_change_proposal || request.date_change_proposal.status !== "pending") {
            return res.status(400).json({ success: false, message: "No pending date change proposal found." });
        }

        const pStart = request.date_change_proposal.proposed_start_date;
        const pEnd = request.date_change_proposal.proposed_end_date;
        const customer = await User.findById(req.user.id);

        if (accept) {
            const newDates = getDatesInRange(pStart, pEnd);
            request.start_date = pStart;
            request.end_date = pEnd;
            if (!request.quotation) request.quotation = {};
            request.quotation.start_date = pStart;
            request.quotation.end_date = pEnd;
            request.quotation.estimated_days = newDates.length;

            if (request.quotation.labor_daily_rate && request.quotation.workers_needed) {
                const quotedLabor = Number(
                    (Number(request.quotation.workers_needed) * newDates.length * Number(request.quotation.labor_daily_rate)).toFixed(2)
                );
                request.quotation.labor_total = quotedLabor;
                request.quotation.estimated_cost = quotedLabor;
            }

            request.date_change_proposal.status = "accepted";
            await request.save();

            const acceptMsg = new ChatMessage({
                customer_id: req.user.id,
                company_id: request.company_id,
                sender_id: req.user.id,
                sender_role: "customer",
                sender_name: customer?.name || "Customer",
                message: `✅ Date Change Accepted: Customer agreed to modified work schedule (${pStart} to ${pEnd}, ~${newDates.length} days). Start and end dates updated!`,
                msg_type: "quotation",
                request_id: request._id,
                metadata: {
                    start_date: pStart,
                    end_date: pEnd,
                    estimated_days: newDates.length,
                    quotation: request.quotation
                }
            });
            await acceptMsg.save();

            return res.json({
                success: true,
                message: `Modified dates accepted (${pStart} to ${pEnd})!`,
                request
            });
        } else {
            request.date_change_proposal.status = "rejected";
            await request.save();

            const declineMsg = new ChatMessage({
                customer_id: req.user.id,
                company_id: request.company_id,
                sender_id: req.user.id,
                sender_role: "customer",
                sender_name: customer?.name || "Customer",
                message: `❌ Date Change Declined: Customer declined modified dates ${pStart} to ${pEnd}.`,
                msg_type: "text",
                request_id: request._id
            });
            await declineMsg.save();

            return res.json({
                success: true,
                message: "Date change proposal declined.",
                request
            });
        }
    } catch (err) {
        console.error("Respond date change error:", err);
        res.status(500).json({ success: false, message: "Failed to respond to date change." });
    }
});

// Customer reports dissatisfaction and requests free rework / revision
router.post("/requests/:id/request-revision", authMiddleware, async (req, res) => {
    try {
        const { notes } = req.body;
        if (!notes || !notes.trim()) {
            return res.status(400).json({
                success: false,
                message: "Please specify what needs rectification."
            });
        }

        const request = await ServiceRequest.findOne({
            _id: req.params.id,
            customer_id: req.user.id
        });

        if (!request) {
            return res.status(404).json({
                success: false,
                message: "Request not found."
            });
        }

        request.status = "rework_needed";
        request.rework_requested = true;
        request.rework_notes = notes.trim();
        await request.save();

        const customer = await User.findById(req.user.id);

        // Chat alert to company
        const alertMsg = new ChatMessage({
            customer_id: req.user.id,
            company_id: request.company_id,
            sender_id: req.user.id,
            sender_role: "customer",
            sender_name: customer ? customer.name : "Customer",
            message: `⚠️ Revision / Rework Requested: Customer inspected the job and noted: "${notes.trim()}". Please send technicians to rectify this issue.`,
            msg_type: "text",
            request_id: request._id
        });
        await alertMsg.save();

        res.json({
            success: true,
            message: "Rework request submitted. The company has been alerted.",
            request
        });
    } catch (error) {
        console.error("Request revision error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to submit revision request."
        });
    }
});

// Customer favorites management
router.get("/favorites", authMiddleware, requireCustomer, async (req, res) => {
    try {
        const customer = await User.findById(req.user.id)
            .populate("favorites", "company_name owner_name email phone city address experience total_workers services description rating product_rating review_count total_reviews verification_status");

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: "Customer profile not found."
            });
        }

        res.json({
            success: true,
            favorites: customer.favorites || []
        });
    } catch (error) {
        console.error("Get favorites error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch favorites."
        });
    }
});

router.post("/favorites/:companyId", authMiddleware, requireCustomer, async (req, res) => {
    try {
        const { companyId } = req.params;
        const customer = await User.findById(req.user.id);

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: "Customer profile not found."
            });
        }

        const company = await Company.findById(companyId);
        if (!company) {
            return res.status(404).json({
                success: false,
                message: "Company not found."
            });
        }

        if (company.verification_status !== "approved") {
            return res.status(400).json({
                success: false,
                message: "Only approved companies can be added to favorites."
            });
        }

        if (!customer.favorites) {
            customer.favorites = [];
        }

        const isAlreadyFavorite = customer.favorites.some(
            fav => String(fav) === String(companyId)
        );

        if (isAlreadyFavorite) {
            return res.status(400).json({
                success: false,
                message: "Company is already in your favorites."
            });
        }

        customer.favorites.push(companyId);
        await customer.save();

        res.json({
            success: true,
            message: "Company added to favorites successfully.",
            favorites: customer.favorites
        });
    } catch (error) {
        console.error("Add favorite error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to add company to favorites."
        });
    }
});

router.delete("/favorites/:companyId", authMiddleware, requireCustomer, async (req, res) => {
    try {
        const { companyId } = req.params;
        const customer = await User.findById(req.user.id);

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: "Customer profile not found."
            });
        }

        if (!customer.favorites || customer.favorites.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No favorites found."
            });
        }

        const favoriteIndex = customer.favorites.findIndex(
            fav => String(fav) === String(companyId)
        );

        if (favoriteIndex === -1) {
            return res.status(404).json({
                success: false,
                message: "Company not found in favorites."
            });
        }

        customer.favorites.splice(favoriteIndex, 1);
        await customer.save();

        res.json({
            success: true,
            message: "Company removed from favorites successfully.",
            favorites: customer.favorites
        });
    } catch (error) {
        console.error("Remove favorite error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to remove company from favorites."
        });
    }
});

// Location-based search for companies
router.get("/companies/search", authMiddleware, requireCustomer, async (req, res) => {
    try {
        const { city, service, min_rating } = req.query;

        const searchCriteria = {
            verification_status: "approved"
        };

        if (city && city.trim()) {
            searchCriteria.city = { $regex: city.trim(), $options: "i" };
        }

        if (service && service.trim()) {
            searchCriteria.services = { $regex: service.trim(), $options: "i" };
        }

        if (min_rating && !isNaN(min_rating)) {
            searchCriteria.rating = { $gte: Number(min_rating) };
        }

        const companies = await Company.find(searchCriteria)
            .select("company_name owner_name email phone city address experience total_workers services description rating product_rating review_count total_reviews verification_status")
            .sort({ rating: -1, review_count: -1 });

        res.json({
            success: true,
            companies,
            search_criteria: {
                city: city || null,
                service: service || null,
                min_rating: min_rating || null
            }
        });
    } catch (error) {
        console.error("Company search error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to search companies."
        });
    }
});

// Get customer dashboard data
router.get("/dashboard", authMiddleware, requireCustomer, async (req, res) => {
    try {
        const customer = await User.findById(req.user.id)
            .populate("favorites", "company_name owner_name email phone city address experience total_workers services description rating product_rating review_count total_reviews verification_status");

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: "Customer profile not found."
            });
        }

        const allRequests = await ServiceRequest.find({ customer_id: req.user.id })
            .populate("company_id", "company_name phone email address city rating")
            .sort({ createdAt: -1 });

        // Separate completed and ongoing requests
        const completedRequests = allRequests.filter(req => 
            req.status === 'completed' || req.status === 'cancelled'
        );
        
        const ongoingRequests = allRequests.filter(req => 
            req.status !== 'completed' && req.status !== 'cancelled'
        );

        const recentRequests = allRequests.slice(0, 5);

        // Get recommended companies based on customer's location
        const locationCriteria = customer.location && customer.location.trim() 
            ? { city: { $regex: customer.location.trim(), $options: "i" }, verification_status: "approved" }
            : { verification_status: "approved" };

        const recommendedCompanies = await Company.find(locationCriteria)
            .select("company_name owner_name email phone city address experience total_workers services description rating product_rating review_count total_reviews verification_status")
            .sort({ rating: -1, review_count: -1 })
            .limit(5);

        res.json({
            success: true,
            customer: {
                name: customer.name,
                email: customer.email,
                phone: customer.phone,
                address: customer.address || "",
                city: customer.city || "",
                state: customer.state || "",
                location: customer.location || "",
                favorites: customer.favorites || []
            },
            recent_requests: recentRequests,
            completed_requests: completedRequests,
            ongoing_requests: ongoingRequests,
            recommended_companies: recommendedCompanies
        });
    } catch (error) {
        console.error("Customer dashboard error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to load customer dashboard."
        });
    }
});

// Get customer profile
router.get("/profile", authMiddleware, requireCustomer, async (req, res) => {
    try {
        const customer = await User.findById(req.user.id).select("-password");
        if (!customer) {
            return res.status(404).json({
                success: false,
                message: "Customer profile not found."
            });
        }
        res.json({
            success: true,
            customer: {
                name: customer.name,
                email: customer.email,
                phone: customer.phone || "",
                address: customer.address || "",
                city: customer.city || "",
                state: customer.state || "",
                location: customer.location || "",
                createdAt: customer.createdAt
            }
        });
    } catch (error) {
        console.error("Get profile error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to load profile."
        });
    }
});

// Update customer profile
router.put("/profile", authMiddleware, requireCustomer, async (req, res) => {
    try {
        const { name, phone, location, address, city, state } = req.body;
        const customer = await User.findById(req.user.id);

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: "Customer profile not found."
            });
        }

        if (name && name.trim()) {
            customer.name = name.trim();
        }
        if (phone && phone.trim()) {
            customer.phone = phone.trim();
        }
        if (location && location.trim()) {
            customer.location = location.trim();
        }
        if (address !== undefined) {
            customer.address = (address || "").trim();
        }
        if (city !== undefined) {
            customer.city = (city || "").trim();
        }
        if (state !== undefined) {
            customer.state = (state || "").trim();
        }

        await customer.save();

        res.json({
            success: true,
            message: "Profile updated successfully.",
            customer: {
                name: customer.name,
                email: customer.email,
                phone: customer.phone,
                address: customer.address || "",
                city: customer.city || "",
                state: customer.state || "",
                location: customer.location || ""
            }
        });
    } catch (error) {
        console.error("Update profile error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update profile."
        });
    }
});

// Customer responds to daily worker update with complaint or no complaint
router.post("/requests/:id/daily-update/:dayNumber/respond", authMiddleware, async (req, res) => {
    try {
        const { dayNumber } = req.params;
        const { has_complaint, complaint_text } = req.body;

        const request = await ServiceRequest.findOne({
            _id: req.params.id,
            customer_id: req.user.id
        });

        if (!request) {
            return res.status(404).json({
                success: false,
                message: "Service request not found."
            });
        }

        // Find the specific daily update
        const dailyUpdate = request.daily_updates.find(
            update => update.day_number === Number(dayNumber)
        );

        if (!dailyUpdate) {
            return res.status(404).json({
                success: false,
                message: "Daily update not found."
            });
        }

        // Update the customer response
        dailyUpdate.customer_response = {
            has_complaint: has_complaint === true,
            complaint_text: has_complaint ? (complaint_text || "").trim() : "",
            responded_at: new Date()
        };

        await request.save();

        // If there's a complaint, notify the company and the assigned worker(s)
        if (has_complaint && complaint_text) {
            try {
                const customer = await User.findById(req.user.id);
                const customerName = (customer && customer.name) ? customer.name : "Customer";
                const customerPhone = (customer && customer.phone && customer.phone.trim()) ? customer.phone.trim() : "Not provided";
                const cleanComplaint = complaint_text.trim();

                // 1. Notify company via chat message
                const complaintMsg = new ChatMessage({
                    customer_id: req.user.id,
                    company_id: request.company_id,
                    sender_id: req.user.id,
                    sender_role: "customer",
                    sender_name: customerName,
                    message: `⚠️ Complaint on Day ${dayNumber}: Customer reported an issue with today's work: "${cleanComplaint}"`,
                    msg_type: "complaint",
                    request_id: request._id,
                    metadata: {
                        day_number: Number(dayNumber),
                        complaint_text: cleanComplaint
                    }
                });
                await complaintMsg.save();

                // 2. Identify the specific worker who logged this daily update (or all assigned workers)
                const workerIdToNotify = dailyUpdate.logged_by_worker_id || 
                    (request.assigned_workers && request.assigned_workers[0] ? request.assigned_workers[0].worker_id : null);

                if (workerIdToNotify) {
                    const targetWorker = await Worker.findById(workerIdToNotify);
                    if (targetWorker) {
                        targetWorker.complaints = targetWorker.complaints || [];
                        targetWorker.complaints.push({
                            customer_name: customerName,
                            customer_phone: customerPhone,
                            text: `Day ${dayNumber} Complaint: ${cleanComplaint}`,
                            about: "worker",
                            service: request.service || "",
                            request_id: request._id,
                            created_at: new Date()
                        });
                        await targetWorker.save();
                    }
                } else if (request.assigned_workers && request.assigned_workers.length > 0) {
                    for (const aw of request.assigned_workers) {
                        if (!aw.worker_id) continue;
                        const w = await Worker.findById(aw.worker_id);
                        if (w) {
                            w.complaints = w.complaints || [];
                            w.complaints.push({
                                customer_name: customerName,
                                customer_phone: customerPhone,
                                text: `Day ${dayNumber} Complaint: ${cleanComplaint}`,
                                about: "worker",
                                service: request.service || "",
                                request_id: request._id,
                                created_at: new Date()
                            });
                            await w.save();
                        }
                    }
                }

                // 3. Record in company's complaints ledger so company dashboard sees it immediately
                const companyObj = await Company.findById(request.company_id);
                if (companyObj) {
                    companyObj.company_complaints = companyObj.company_complaints || [];
                    const workerInfo = request.assigned_workers && request.assigned_workers[0] 
                        ? request.assigned_workers[0] 
                        : { name: dailyUpdate.logged_by_worker_name || "Technician", phone: "" };

                    companyObj.company_complaints.push({
                        customer_id: req.user.id,
                        customer_name: customerName,
                        customer_phone: customerPhone,
                        worker_name: workerInfo.name || "Technician",
                        worker_phone: workerInfo.phone || "",
                        text: `Day ${dayNumber} Complaint: ${cleanComplaint}`,
                        service: request.service || "",
                        request_id: request._id,
                        created_at: new Date(),
                        status: "pending"
                    });
                    await companyObj.save();
                }
            } catch (chatErr) {
                console.warn("Notification error for daily update complaint:", chatErr);
            }
        }

        res.json({
            success: true,
            message: has_complaint 
                ? "Complaint recorded and company has been notified."
                : "Response recorded. No complaints reported for today's work.",
            daily_update: dailyUpdate
        });
    } catch (error) {
        console.error("Daily update response error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to record response to daily update."
        });
    }
});

// Customer reviews company, workers, products, and optional complaints
router.post("/requests/:id/review", authMiddleware, async (req, res) => {
    try {
        const {
            worker_rating,
            worker_comment,
            worker_punctuality,
            worker_craftsmanship,
            company_rating,
            company_comment,
            company_pricing,
            company_communication,
            product_rating,
            product_comment,
            complaint_about,
            complaint_text,
            would_recommend,
            rating,
            comment
        } = req.body;

        const effectiveWorkerRating = Number(worker_rating || rating);
        const effectiveCompanyRating = Number(company_rating || rating);
        const effectiveProductRating = Number(product_rating || rating || 5);

        if (
            (!effectiveWorkerRating || effectiveWorkerRating < 1 || effectiveWorkerRating > 5) &&
            (!effectiveCompanyRating || effectiveCompanyRating < 1 || effectiveCompanyRating > 5)
        ) {
            return res.status(400).json({
                success: false,
                message: "Please provide valid ratings between 1 and 5."
            });
        }

        const request = await ServiceRequest.findOne({
            _id: req.params.id,
            customer_id: req.user.id
        });

        if (!request) {
            return res.status(404).json({
                success: false,
                message: "Request not found."
            });
        }

        if (request.status !== "completed" || !request.invoice || request.invoice.payment_status !== "paid") {
            return res.status(400).json({
                success: false,
                message: "Pay the remaining invoice amount in full before submitting a review or complaint."
            });
        }

        if (request.company_review && request.company_review.rating) {
            return res.status(400).json({
                success: false,
                message: "You have already submitted ratings for this job."
            });
        }

        const customer = await User.findById(req.user.id);
        const customerName = customer ? customer.name : (request.customer_name || "Customer");
        const about = complaint_about && complaint_about !== "none" ? complaint_about : "none";
        const complaintText = (complaint_text || "").trim();
        const hasComplaint = about !== "none" && complaintText.length > 0;

        request.worker_review = {
            rating: effectiveWorkerRating || 5,
            punctuality: Number(worker_punctuality) || 5,
            craftsmanship: Number(worker_craftsmanship) || 5,
            comment: worker_comment || comment || "",
            submitted_at: new Date()
        };

        request.company_review = {
            rating: effectiveCompanyRating || 5,
            pricing: Number(company_pricing) || 5,
            communication: Number(company_communication) || 5,
            comment: company_comment || comment || "",
            submitted_at: new Date()
        };

        request.product_review = {
            rating: effectiveProductRating || 5,
            comment: product_comment || "",
            submitted_at: new Date()
        };

        request.complaint = {
            has_complaint: hasComplaint,
            text: hasComplaint ? complaintText : "",
            about: hasComplaint ? about : "none"
        };
        request.would_recommend = would_recommend !== false;

        request.review = {
            rating: effectiveCompanyRating || effectiveWorkerRating || 5,
            comment: [company_comment, worker_comment, product_comment, complaintText].filter(Boolean).join(" | "),
            submitted_at: new Date()
        };

        await request.save();

        const assigned = (request.assigned_workers && request.assigned_workers.length)
            ? request.assigned_workers
            : (request.allocated_workers || []);

        if (assigned.length > 0 && effectiveWorkerRating) {
            for (const alloc of assigned) {
                if (!alloc.worker_id) continue;
                const worker = await Worker.findById(alloc.worker_id);
                if (!worker) continue;
                worker.reviews.push({
                    customer_id: req.user.id,
                    customer_name: customerName,
                    rating: effectiveWorkerRating,
                    comment: worker_comment || comment || "",
                    punctuality: Number(worker_punctuality) || 5,
                    craftsmanship: Number(worker_craftsmanship) || 5,
                    complaint: hasComplaint ? complaintText : "",
                    service: request.service || "",
                    request_id: request._id,
                    created_at: new Date()
                });
                if (hasComplaint && about === "worker") {
                    worker.complaints = worker.complaints || [];
                    worker.complaints.push({
                        customer_name: customerName,
                        customer_phone: (customer && customer.phone && customer.phone.trim()) ? customer.phone.trim() : "Not provided",
                        text: complaintText,
                        about,
                        service: request.service || "",
                        request_id: request._id,
                        created_at: new Date()
                    });
                }
                const totalScore = worker.reviews.reduce((sum, r) => sum + (r.rating || 0), 0);
                worker.rating_count = worker.reviews.length;
                worker.rating = worker.reviews.length > 0 ? Number((totalScore / worker.reviews.length).toFixed(1)) : 5.0;
                await worker.save();
            }
        }

        const company = await Company.findById(request.company_id);
        if (company && effectiveCompanyRating) {
            company.reviews = company.reviews || [];
            company.reviews.push({
                customer_id: req.user.id,
                customer_name: customerName,
                rating: effectiveCompanyRating,
                comment: company_comment || comment || "",
                pricing_rating: Number(company_pricing) || 5,
                communication_rating: Number(company_communication) || 5,
                product_rating: effectiveProductRating || 5,
                complaint: hasComplaint ? complaintText : "",
                would_recommend: would_recommend !== false,
                service: request.service || "",
                request_id: request._id,
                created_at: new Date()
            });

            if (hasComplaint && about === "company") {
                company.company_complaints = company.company_complaints || [];
                const workerInfo = assigned.length > 0 ? assigned[0] : { name: "", phone: "" };
                company.company_complaints.push({
                    customer_id: req.user.id,
                    customer_name: customerName,
                    customer_phone: (customer && customer.phone && customer.phone.trim()) ? customer.phone.trim() : "Not provided",
                    worker_name: workerInfo.name || "",
                    worker_phone: workerInfo.phone || "",
                    text: complaintText,
                    service: request.service || "",
                    request_id: request._id,
                    created_at: new Date(),
                    status: "pending"
                });
            }

            const n = company.reviews.length;
            const compTotal = company.reviews.reduce((sum, r) => sum + (r.rating || 0), 0);
            const prodTotal = company.reviews.reduce((sum, r) => sum + (r.product_rating || r.rating || 0), 0);
            company.total_reviews = n;
            company.review_count = n;
            company.rating = n > 0 ? Number((compTotal / n).toFixed(1)) : 5.0;
            company.product_rating = n > 0 ? Number((prodTotal / n).toFixed(1)) : 5.0;
            await company.save();
        }

        res.json({
            success: true,
            message: hasComplaint
                ? (about === "worker" 
                    ? "Ratings saved. Complaint about worker sent to the company dashboard. Company average updated."
                    : "Ratings saved. Complaint about company sent to admin for review. Company average updated.")
                : "Thank you! Company, worker and product ratings saved. Company average updated.",
            request,
            company_rating: company ? company.rating : effectiveCompanyRating,
            review_count: company ? company.review_count : 0
        });
    } catch (error) {
        console.error("Submit review error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to submit review."
        });
    }
});

// Customer deletes completed service request
router.delete("/requests/:id", authMiddleware, requireCustomer, async (req, res) => {
    try {
        const request = await ServiceRequest.findOne({
            _id: req.params.id,
            customer_id: req.user.id
        });

        if (!request) {
            return res.status(404).json({
                success: false,
                message: "Service request not found."
            });
        }

        if (request.status !== "completed" && request.status !== "cancelled") {
            return res.status(400).json({
                success: false,
                message: "Only completed or cancelled requests can be deleted from your records."
            });
        }

        await ServiceRequest.deleteOne({ _id: request._id });

        res.json({
            success: true,
            message: "Completed service request removed successfully."
        });
    } catch (error) {
        console.error("Delete customer request error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete request."
        });
    }
});

module.exports = router;
