const express = require("express");
const ServiceRequest = require("../models/ServiceRequest");
const Company = require("../models/Company");
const Worker = require("../models/Worker");
const ChatMessage = require("../models/ChatMessage");
const authMiddleware = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");
const PaymentRequest = require("../models/PaymentRequest");
const Wallet = require("../models/Wallet");
const {
    getDatesInRange,
    markWorkerBusyForDates,
    checkWorkerAvailabilityForDates,
    normalizeDateStr,
    releaseWorkerAvailabilityForRequest
} = require("../utils/workerAllocation");

const router = express.Router();

// Helper to get company for authenticated user
async function getCompanyForUser(userId) {
    return await Company.findOne({ user_id: userId });
}

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

// Get all service requests for the logged-in company
router.get("/requests", authMiddleware, async (req, res) => {
    try {
        const company = await getCompanyForUser(req.user.id);
        if (!company) {
            return res.status(404).json({
                success: false,
                message: "Company profile not found."
            });
        }

        const requests = await ServiceRequest.find({ company_id: company._id })
            .populate("customer_id", "name email phone")
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            requests
        });
    } catch (error) {
        console.error("Get company requests error:", error);
        res.status(500).json({
            success: false,
            message: "Unable to load service requests."
        });
    }
});

function dateRangesOverlap(startA, endA, startB, endB) {
    if (!startA || !endA || !startB || !endB) return false;
    return (startA <= endB && endA >= startB);
}

// Company sends formal quotation with explicit Start Date and End Date
router.post("/requests/:id/quote", authMiddleware, async (req, res) => {
    try {
        const company = await getCompanyForUser(req.user.id);
        if (!company) {
            return res.status(404).json({
                success: false,
                message: "Company profile not found."
            });
        }

        const {
            start_date,
            end_date,
            workers_needed,
            estimated_days,
            estimated_cost,
            labor_daily_rate,
            labor_total,
            quotation_notes
        } = req.body;

        if (!workers_needed || Number(workers_needed) < 1) {
            return res.status(400).json({
                success: false,
                message: "Please specify how many workers are needed (at least 1)."
            });
        }

        const workersCount = Number(workers_needed);

        if (labor_daily_rate === undefined || labor_daily_rate === null || labor_daily_rate === "") {
            return res.status(400).json({
                success: false,
                message: "Please enter labour cost per worker per day (₹). Use 0 if labour is complimentary."
            });
        }

        const request = await ServiceRequest.findOne({
            _id: req.params.id,
            company_id: company._id
        });

        if (!request) {
            return res.status(404).json({
                success: false,
                message: "Service request not found."
            });
        }

        // Validate dates are not in the past
        const todayStr = new Date().toISOString().split("T")[0];
        const rawStart = start_date || request.preferred_date || "";
        const rawEnd = end_date || rawStart;

        const normStart = normalizeDateStr(rawStart);
        const normEnd = normalizeDateStr(rawEnd);

        if (!normStart) {
            return res.status(400).json({
                success: false,
                message: "Please specify a start date for the quotation."
            });
        }

        if (normStart < todayStr) {
            return res.status(400).json({
                success: false,
                message: `Quotation start date cannot be in the past (${normStart} is before today ${todayStr}). Please choose today or a future date.`
            });
        }

        if (normEnd < normStart) {
            return res.status(400).json({
                success: false,
                message: `Quotation end date (${normEnd}) cannot be earlier than start date (${normStart}).`
            });
        }

        // Validate number of workers present in the company
        const allWorkers = await Worker.find({ company_id: company._id });
        if (allWorkers.length < workersCount) {
            return res.status(400).json({
                success: false,
                message: `Your company only has ${allWorkers.length} worker(s) registered. Cannot prepare quotation for ${workersCount} worker(s). Please add more workers to your team or adjust workers needed.`
            });
        }

        // Validate worker availability across the entire quotation date range
        const dates = getDatesInRange(normStart, normEnd);
        const activeJobs = await ServiceRequest.find({
            _id: { $ne: request._id },
            company_id: company._id,
            status: { $in: ["confirmed", "workers_assigned", "in_progress", "rework_needed"] }
        });

        const availableWorkers = allWorkers.filter(
            (w) => checkWorkerAvailabilityForDates(w, dates, request._id, activeJobs).is_available
        );

        if (availableWorkers.length < workersCount) {
            return res.status(400).json({
                success: false,
                worker_shortage: true,
                available_count: availableWorkers.length,
                workers_needed: workersCount,
                start_date: normStart,
                end_date: normEnd,
                message: `Worker Shortage: Only ${availableWorkers.length} worker(s) available from ${normStart} to ${normEnd}, but ${workersCount} worker(s) required. Please ask the customer to change the requested date.`
            });
        }

        let calcDays = dates.length > 0 ? dates.length : (Number(estimated_days) || 1);

        const dailyRate = Number(labor_daily_rate) || 0;
        const quotedLabor = Number(labor_total) || Number((workersCount * calcDays * dailyRate).toFixed(2));
        const quotedTotal = estimated_cost !== undefined && estimated_cost !== ""
            ? Number(estimated_cost)
            : quotedLabor;

        request.start_date = normStart;
        request.end_date = normEnd;
        request.quotation = {
            start_date: normStart,
            end_date: normEnd,
            workers_needed: workersCount,
            estimated_days: calcDays,
            estimated_cost: quotedTotal,
            labor_daily_rate: dailyRate,
            labor_total: quotedLabor,
            quotation_notes: quotation_notes || "",
            sent_at: new Date()
        };
        request.status = "quoted";
        await request.save();

        const dateRangeStr = (start_date && end_date) ? ` (${start_date} to ${end_date})` : "";

        // Send quotation message card into chat
        const quoteMsg = new ChatMessage({
            customer_id: request.customer_id,
            company_id: company._id,
            sender_id: req.user.id,
            sender_role: "company",
            sender_name: company.company_name,
            message: `📋 Formal Quotation Prepared: ${workers_needed} worker(s), ~${calcDays} day(s)${dateRangeStr}, Labour ₹${dailyRate}/worker/day (Labour total ₹${quotedLabor}). Pay 50% (₹${Number((quotedTotal * 0.5).toFixed(2))}) from your wallet to continue. Remaining amount is due after work is completed. Parts bought on site will be added to the final bill. ${quotation_notes ? `Notes: "${quotation_notes}"` : ""}`,
            msg_type: "quotation",
            request_id: request._id,
            metadata: {
                start_date: start_date || "",
                end_date: end_date || "",
                workers_needed: Number(workers_needed),
                estimated_days: calcDays,
                estimated_cost: quotedTotal,
                labor_daily_rate: dailyRate,
                labor_total: quotedLabor,
                quotation_notes: quotation_notes || "",
                status: "quoted"
            }
        });
        await quoteMsg.save();

        res.json({
            success: true,
            message: "Quotation sent successfully to customer.",
            request
        });
    } catch (error) {
        console.error("Send quotation error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to send quotation."
        });
    }
});

// Evaluate Worker Availability & Real-Time Date Conflicts for a Service Request
router.get("/requests/:id/available-workers", authMiddleware, async (req, res) => {
    try {
        const company = await getCompanyForUser(req.user.id);
        if (!company) {
            return res.status(404).json({ success: false, message: "Company profile not found." });
        }

        const request = await ServiceRequest.findOne({ _id: req.params.id, company_id: company._id });
        if (!request) {
            return res.status(404).json({ success: false, message: "Service request not found." });
        }

        const targetStart = request.start_date || (request.quotation ? request.quotation.start_date : "");
        const targetEnd = request.end_date || (request.quotation ? request.quotation.end_date : targetStart);
        const dates = getDatesInRange(targetStart, targetEnd);

        const allWorkers = await Worker.find({ company_id: company._id });

        const activeJobs = await ServiceRequest.find({
            _id: { $ne: request._id },
            company_id: company._id,
            status: { $in: ["confirmed", "workers_assigned", "in_progress", "rework_needed"] }
        });

        const workersWithStatus = allWorkers.map(worker => {
            const check = checkWorkerAvailabilityForDates(worker, dates, request._id, activeJobs);
            return {
                _id: worker._id,
                name: worker.name,
                phone: worker.phone,
                email: worker.email,
                skills: worker.skills,
                rating: worker.rating || 5,
                is_available: check.is_available,
                conflict_reason: check.conflict_reason
            };
        });

        res.json({
            success: true,
            start_date: targetStart,
            end_date: targetEnd,
            workers: workersWithStatus
        });
    } catch (err) {
        console.error("Fetch available workers error:", err);
        res.status(500).json({ success: false, message: "Failed to evaluate worker availability." });
    }
});

// Company proposes modified dates to customer due to worker shortage
router.post("/requests/:id/request-date-change", authMiddleware, async (req, res) => {
    try {
        const company = await getCompanyForUser(req.user.id);
        if (!company) {
            return res.status(404).json({ success: false, message: "Company profile not found." });
        }

        const { proposed_start_date, proposed_end_date, reason } = req.body;
        const todayStr = new Date().toISOString().split("T")[0];
        const normStart = normalizeDateStr(proposed_start_date);
        const normEnd = normalizeDateStr(proposed_end_date || proposed_start_date);

        if (!normStart || normStart < todayStr) {
            return res.status(400).json({
                success: false,
                message: `Proposed start date cannot be in the past (${normStart || "empty"} is before today).`
            });
        }
        if (normEnd < normStart) {
            return res.status(400).json({
                success: false,
                message: `Proposed end date (${normEnd}) cannot be earlier than start date (${normStart}).`
            });
        }

        const request = await ServiceRequest.findOne({ _id: req.params.id, company_id: company._id });
        if (!request) {
            return res.status(404).json({ success: false, message: "Service request not found." });
        }

        const workersNeeded = Number(request.quotation?.workers_needed) || Number(req.body.workers_needed) || 1;
        const allWorkers = await Worker.find({ company_id: company._id });
        const newDates = getDatesInRange(normStart, normEnd);
        const activeJobs = await ServiceRequest.find({
            _id: { $ne: request._id },
            company_id: company._id,
            status: { $in: ["confirmed", "workers_assigned", "in_progress", "rework_needed"] }
        });
        const availWorkers = allWorkers.filter(w => checkWorkerAvailabilityForDates(w, newDates, request._id, activeJobs).is_available);

        if (availWorkers.length < workersNeeded) {
            return res.status(400).json({
                success: false,
                message: `Worker shortage on proposed dates: Only ${availWorkers.length} worker(s) available from ${normStart} to ${normEnd} (needed: ${workersNeeded}). Please choose dates when ${workersNeeded} workers are free.`
            });
        }

        request.date_change_proposal = {
            proposed_start_date: normStart,
            proposed_end_date: normEnd,
            reason: reason || "Worker availability shortage on originally requested dates",
            status: "pending",
            requested_at: new Date()
        };
        await request.save();

        const changeMsg = new ChatMessage({
            customer_id: request.customer_id,
            company_id: company._id,
            sender_id: req.user.id,
            sender_role: "company",
            sender_name: company.company_name,
            message: `⚠️ Worker Shortage Notice: Company requests to modify service dates to ${normStart} - ${normEnd} (~${newDates.length} days) due to technician availability. ${reason ? `Reason: "${reason}". ` : ""}Please accept or decline this schedule change.`,
            msg_type: "date_reschedule_proposal",
            request_id: request._id,
            metadata: {
                proposed_start_date: normStart,
                proposed_end_date: normEnd,
                estimated_days: newDates.length,
                workers_needed: workersNeeded,
                reason: reason || ""
            }
        });
        await changeMsg.save();

        res.json({
            success: true,
            message: `Schedule modification request sent to customer for dates ${normStart} to ${normEnd}.`,
            proposal: request.date_change_proposal
        });
    } catch (err) {
        console.error("Date change request error:", err);
        res.status(500).json({ success: false, message: "Failed to request date change." });
    }
});

// Company allocates/assigns workers (with strict date conflict enforcement)
router.post("/requests/:id/assign-workers", authMiddleware, async (req, res) => {
    try {
        const company = await getCompanyForUser(req.user.id);
        if (!company) {
            return res.status(404).json({
                success: false,
                message: "Company profile not found."
            });
        }

        const { worker_ids, assigned_days, start_date, end_date } = req.body;

        if (!worker_ids || !Array.isArray(worker_ids) || worker_ids.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Please select at least one worker to assign."
            });
        }

        const request = await ServiceRequest.findOne({
            _id: req.params.id,
            company_id: company._id
        });

        if (!request) {
            return res.status(404).json({
                success: false,
                message: "Service request not found."
            });
        }

        const workersNeeded = Number(request.quotation?.workers_needed) || 1;
        if (worker_ids.length !== workersNeeded) {
            return res.status(400).json({
                success: false,
                message: `This quotation specified ${workersNeeded} worker(s) needed. You must assign exactly ${workersNeeded} worker(s). You selected ${worker_ids.length}.`
            });
        }

        const targetStart = start_date || request.start_date || (request.quotation ? request.quotation.start_date : "");
        const targetEnd = end_date || request.end_date || (request.quotation ? request.quotation.end_date : targetStart);
        const dates = getDatesInRange(targetStart, targetEnd);

        // Fetch selected workers
        const workers = await Worker.find({
            _id: { $in: worker_ids },
            company_id: company._id
        });

        if (workers.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No valid workers found from your company roster."
            });
        }

        // Strict Server-Side Date Overlap Conflict Check
        const activeJobs = await ServiceRequest.find({
            _id: { $ne: request._id },
            company_id: company._id,
            status: { $in: ["confirmed", "workers_assigned", "in_progress", "rework_needed"] }
        });

        for (const w of workers) {
            const check = checkWorkerAvailabilityForDates(w, dates, request._id, activeJobs);
            if (!check.is_available) {
                return res.status(400).json({
                    success: false,
                    message: `Booking Conflict: ${check.conflict_reason}. Cannot double-book.`
                });
            }
        }

        if (dates.length > 0) {
            request.start_date = dates[0];
            request.end_date = dates[dates.length - 1];
        }

        request.assigned_workers = workers.map(w => ({
            worker_id: w._id,
            name: w.name,
            phone: w.phone,
            skills: w.skills || [],
            assigned_days: assigned_days ? Number(assigned_days) : (request.quotation?.estimated_days || dates.length || 1)
        }));

        request.status = "workers_assigned";
        await request.save();

        // Lock worker availability as 'busy' for all dates in the range
        for (const w of workers) {
            await markWorkerBusyForDates(w, dates, request._id);
        }

        const workerNames = workers.map(w => w.name).join(", ");

        // Post worker allocation card into chat
        const workerCardMsg = new ChatMessage({
            customer_id: request.customer_id,
            company_id: company._id,
            sender_id: req.user.id,
            sender_role: "company",
            sender_name: company.company_name,
            message: `👷 Workers Allocated: ${workers.length} technician(s) assigned to your service (${workerNames}). They are scheduled for ~${request.quotation.estimated_days || 1} day(s).`,
            msg_type: "worker_details",
            request_id: request._id,
            metadata: {
                workers: request.assigned_workers
            }
        });
        await workerCardMsg.save();

        res.json({
            success: true,
            message: "Workers assigned successfully.",
            request
        });
    } catch (error) {
        console.error("Assign workers error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to allocate workers."
        });
    }
});

// Post daily work update
router.post(
    "/requests/:id/daily-update",
    authMiddleware,
    upload.single("photo"),
    async (req, res) => {
        try {
            const company = await getCompanyForUser(req.user.id);
            if (!company) {
                return res.status(404).json({
                    success: false,
                    message: "Company profile not found."
                });
            }

            const { day_number, date, title, work_done } = req.body;

            if (!day_number || !work_done) {
                return res.status(400).json({
                    success: false,
                    message: "Please provide Day # and a description of the work completed."
                });
            }

            const request = await ServiceRequest.findOne({
                _id: req.params.id,
                company_id: company._id
            });

            if (!request) {
                return res.status(404).json({
                    success: false,
                    message: "Service request not found."
                });
            }

            const photoPath = req.file ? `/uploads/${req.file.filename}` : "";
            const todayDate = date || new Date().toISOString().split("T")[0];

            const newUpdate = {
                day_number: Number(day_number),
                date: todayDate,
                title: title || `Day ${day_number} Progress`,
                work_done,
                photo: photoPath,
                updated_at: new Date()
            };

            request.daily_updates.push(newUpdate);
            if (request.status === "workers_assigned" || request.status === "confirmed") {
                request.status = "in_progress";
            }
            await request.save();

            // Post progress update card to chat
            const updateMsg = new ChatMessage({
                customer_id: request.customer_id,
                company_id: company._id,
                sender_id: req.user.id,
                sender_role: "company",
                sender_name: company.company_name,
                message: `📅 Day ${day_number} Status Update: "${work_done}"`,
                msg_type: "daily_update",
                request_id: request._id,
                metadata: newUpdate
            });
            await updateMsg.save();

            res.json({
                success: true,
                message: "Daily work update posted successfully.",
                request
            });
        } catch (error) {
            console.error("Daily update error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to post daily work update."
            });
        }
    }
);

// Worker Leave & Replacement: Company assigns substitute technician when worker is on leave
router.post("/requests/:id/replace-worker", authMiddleware, async (req, res) => {
    try {
        const company = await getCompanyForUser(req.user.id);
        if (!company) {
            return res.status(404).json({ success: false, message: "Company profile not found." });
        }

        const { original_worker_id, replacement_worker_id, date, reason } = req.body;
        if (!original_worker_id || !replacement_worker_id || !date) {
            return res.status(400).json({
                success: false,
                message: "Original worker, replacement worker, and date are required."
            });
        }

        const request = await ServiceRequest.findOne({
            _id: req.params.id,
            company_id: company._id
        });
        if (!request) {
            return res.status(404).json({ success: false, message: "Job order not found." });
        }

        const origWorker = await Worker.findById(original_worker_id);
        const repWorker = await Worker.findById(replacement_worker_id);
        if (!origWorker || !repWorker) {
            return res.status(404).json({ success: false, message: "Worker not found in system." });
        }

        // Verify replacement worker is not booked elsewhere on that date
        const conflict = await ServiceRequest.findOne({
            _id: { $ne: request._id },
            company_id: company._id,
            "assigned_workers.worker_id": repWorker._id,
            status: { $in: ["confirmed", "workers_assigned", "in_progress", "rework_needed"] },
            start_date: { $lte: date },
            end_date: { $gte: date }
        });
        if (conflict) {
            return res.status(400).json({
                success: false,
                message: `Technician ${repWorker.name} is already booked on ${conflict.service} (${conflict.start_date} to ${conflict.end_date}).`
            });
        }

        // Update assigned_workers roster
        const existingIdx = request.assigned_workers.findIndex(w => String(w.worker_id) === String(origWorker._id));
        if (existingIdx !== -1) {
            request.assigned_workers[existingIdx] = {
                worker_id: repWorker._id,
                name: repWorker.name,
                phone: repWorker.phone,
                skills: repWorker.skills || [],
                assigned_days: request.assigned_workers[existingIdx].assigned_days || 1
            };
        } else {
            request.assigned_workers.push({
                worker_id: repWorker._id,
                name: repWorker.name,
                phone: repWorker.phone,
                skills: repWorker.skills || [],
                assigned_days: 1
            });
        }

        // Record leave & replacement audit trail
        request.worker_replacements.push({
            date,
            original_worker_id: origWorker._id,
            original_worker_name: origWorker.name,
            reason: reason || "Leave / Absence",
            replacement_worker_id: repWorker._id,
            replacement_worker_name: repWorker.name,
            replacement_worker_phone: repWorker.phone,
            replaced_at: new Date(),
            customer_notified: true
        });

        await request.save();

        // Broadcast replacement notification into customer chat
        const alertMsg = new ChatMessage({
            customer_id: request.customer_id,
            company_id: company._id,
            sender_id: req.user.id,
            sender_role: "company",
            sender_name: company.company_name,
            message: `⚠️ Technician Replacement Alert: On ${date}, technician ${origWorker.name} is on leave (${reason || "Personal Leave"}). Certified technician ${repWorker.name} (📞 ${repWorker.phone}, Skills: ${(repWorker.skills || []).join(", ")}) has been assigned as replacement.`,
            msg_type: "worker_details",
            request_id: request._id,
            metadata: {
                replacement: true,
                original_worker: origWorker.name,
                replacement_worker: repWorker.name,
                replacement_phone: repWorker.phone,
                date
            }
        });
        await alertMsg.save();

        res.json({
            success: true,
            message: `Substitute technician ${repWorker.name} allocated and customer notified!`,
            assigned_workers: request.assigned_workers,
            worker_replacements: request.worker_replacements
        });
    } catch (err) {
        console.error("Replace worker error:", err);
        res.status(500).json({ success: false, message: "Failed to allocate replacement technician." });
    }
});

// Generate Granular Final Invoice / Bill (Cement, Pipes, Putty, Labor breakdown)
router.post("/requests/:id/invoice", authMiddleware, async (req, res) => {
    try {
        const company = await getCompanyForUser(req.user.id);
        if (!company) {
            return res.status(404).json({
                success: false,
                message: "Company profile not found."
            });
        }

        const {
            materials_items,
            labor_items,
            labor_cost,
            material_cost,
            tax_or_other,
            notes
        } = req.body;

        const request = await ServiceRequest.findOne({
            _id: req.params.id,
            company_id: company._id
        });

        if (!request) {
            return res.status(404).json({
                success: false,
                message: "Service request not found."
            });
        }

        // Granular Material Calculation
        let calculatedMaterialsTotal = 0;
        let finalMaterialsItems = [];

        if (Array.isArray(materials_items) && materials_items.length > 0) {
            finalMaterialsItems = materials_items.map(m => {
                const unit = Number(m.unit_price) || 0;
                const qtyNum = qtyFromString(m.quantity);
                const tot = Number(m.total_price) || Number((unit * qtyNum).toFixed(2));
                calculatedMaterialsTotal += tot;
                return {
                    item_name: m.item_name.trim(),
                    quantity: String(m.quantity).trim(),
                    unit_price: unit,
                    total_price: tot
                };
            });
        } else if (request.material_requisitions && request.material_requisitions.length > 0) {
            const built = buildJobInvoiceParts(request);
            finalMaterialsItems = built.materials_items;
            calculatedMaterialsTotal = built.materials_total;
        } else {
            calculatedMaterialsTotal = Number(material_cost) || 0;
            if (calculatedMaterialsTotal > 0) {
                finalMaterialsItems.push({
                    item_name: "Service Materials & Replacement Hardware",
                    quantity: "1 Package",
                    unit_price: calculatedMaterialsTotal,
                    total_price: calculatedMaterialsTotal
                });
            }
        }

        // Granular Labor Calculation
        let calculatedLaborTotal = 0;
        let finalLaborItems = [];

        if (Array.isArray(labor_items) && labor_items.length > 0) {
            finalLaborItems = labor_items.map(l => {
                const days = Number(l.days) || 1;
                const rate = Number(l.daily_rate) || 0;
                const tot = Number(l.total_labor) || (days * rate);
                calculatedLaborTotal += tot;
                return {
                    worker_name: (l.worker_name || "Technician").trim(),
                    role: (l.role || "Technician").trim(),
                    days,
                    daily_rate: rate,
                    total_labor: tot
                };
            });
        } else {
            const built = buildJobInvoiceParts(request);
            if (built.labor_items.length > 0) {
                finalLaborItems = built.labor_items;
                calculatedLaborTotal = built.labor_total;
            } else {
                calculatedLaborTotal = Number(labor_cost) || 0;
                if (calculatedLaborTotal >= 0) {
                    finalLaborItems.push({
                        worker_name: (request.assigned_workers && request.assigned_workers[0] ? request.assigned_workers[0].name : "Service Technician"),
                        role: request.service + " Specialist",
                        days: request.quotation ? (request.quotation.estimated_days || 1) : 1,
                        daily_rate: request.quotation ? (request.quotation.labor_daily_rate || calculatedLaborTotal) : calculatedLaborTotal,
                        total_labor: calculatedLaborTotal
                    });
                }
            }
        }

        const extra = Number(tax_or_other) || 0;
        const grandTotal = Number((calculatedMaterialsTotal + calculatedLaborTotal + extra).toFixed(2));

        const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;

        request.invoice = {
            invoice_number: invoiceNumber,
            materials_items: finalMaterialsItems,
            materials_total: calculatedMaterialsTotal,
            material_cost: calculatedMaterialsTotal,
            labor_items: finalLaborItems,
            labor_total: calculatedLaborTotal,
            labor_cost: calculatedLaborTotal,
            tax_or_other: extra,
            total_amount: grandTotal,
            notes: notes || "All domestic repairs executed to certified standards.",
            generated_at: new Date(),
            payment_status: "unpaid"
        };

        if (request.status !== "work_submitted" && request.status !== "completed") {
            request.status = "work_submitted";
        }

        await request.save();

        // Send detailed invoice summary card into customer chat
        const invMsg = new ChatMessage({
            customer_id: request.customer_id,
            company_id: company._id,
            sender_id: req.user.id,
            sender_role: "company",
            sender_name: company.company_name,
            message: `🧾 Itemized Tax Invoice #${invoiceNumber} Issued: Total ₹${grandTotal}. Materials: ₹${calculatedMaterialsTotal} (${finalMaterialsItems.length} items), Labour: ₹${calculatedLaborTotal}${extra ? `, Taxes: ₹${extra}` : ""}.`,
            msg_type: "invoice",
            request_id: request._id,
            metadata: request.invoice
        });
        await invMsg.save();

        res.json({
            success: true,
            message: "Granular itemized invoice issued to customer successfully!",
            invoice: request.invoice
        });
    } catch (error) {
        console.error("Generate invoice error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to generate invoice."
        });
    }
});

// Worker submits completed work with "After Repair" photos for customer inspection
router.post(
    "/requests/:id/submit-work",
    authMiddleware,
    upload.array("after_photos", 4),
    async (req, res) => {
        try {
            const company = await getCompanyForUser(req.user.id);
            if (!company) {
                return res.status(404).json({
                    success: false,
                    message: "Company profile not found."
                });
            }

            const request = await ServiceRequest.findOne({
                _id: req.params.id,
                company_id: company._id
            });

            if (!request) {
                return res.status(404).json({
                    success: false,
                    message: "Service request not found."
                });
            }

            const photoPaths = req.files && req.files.length > 0
                ? req.files.map(f => "/uploads/" + f.filename)
                : [];

            request.after_photos = photoPaths;
            request.work_submitted_at = new Date();
            request.status = "work_submitted";
            request.rework_requested = false;

            // Generate invoice draft if not already generated
            if (!request.invoice || !request.invoice.invoice_number) {
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
                    notes: "Final work submitted for physical on-site customer inspection.",
                    generated_at: new Date(),
                    payment_status: "unpaid"
                };
            }

            await request.save();

            // Post dual-signoff inspection card into chat
            const submitMsg = new ChatMessage({
                customer_id: request.customer_id,
                company_id: company._id,
                sender_id: req.user.id,
                sender_role: "company",
                sender_name: company.company_name,
                message: `👷 Work Finished & Submitted for Your Inspection! Our technicians have finished the repairs and uploaded ${photoPaths.length} after-repair proof photo(s). Please physically inspect the work on site and provide your 4-Digit Completion PIN or click "Inspect & Sign Off".`,
                msg_type: "daily_update",
                request_id: request._id,
                metadata: {
                    status: "work_submitted",
                    after_photos: photoPaths
                }
            });
            await submitMsg.save();

            res.json({
                success: true,
                message: "Work submitted with proof photos! Awaiting customer inspection.",
                request
            });
        } catch (error) {
            console.error("Submit work error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to submit completed work."
            });
        }
    }
);

// Worker verifies completion on site using customer's 4-digit PIN
router.post("/requests/:id/verify-otp", authMiddleware, async (req, res) => {
    try {
        const company = await getCompanyForUser(req.user.id);
        if (!company) {
            return res.status(404).json({
                success: false,
                message: "Company profile not found."
            });
        }

        const { otp } = req.body;
        if (!otp) {
            return res.status(400).json({
                success: false,
                message: "Please enter the 4-digit Customer Completion PIN."
            });
        }

        const request = await ServiceRequest.findOne({
            _id: req.params.id,
            company_id: company._id
        });

        if (!request) {
            return res.status(404).json({
                success: false,
                message: "Service request not found."
            });
        }

        if (String(otp).trim() !== String(request.completion_otp).trim()) {
            return res.status(400).json({
                success: false,
                message: "Invalid PIN! Please check the 4-digit code shown on the customer's screen."
            });
        }

        request.status = "completed";
        request.customer_signed_off = true;
        request.customer_signed_off_at = new Date();
        request.rework_requested = false;

        await request.save();

        // Release worker availability back to available
        await releaseWorkerAvailabilityForRequest(request._id);

        const successMsg = new ChatMessage({
            customer_id: request.customer_id,
            company_id: company._id,
            sender_id: req.user.id,
            sender_role: "company",
            sender_name: company.company_name,
            message: `🔐 Completion PIN Verified On-Site! Work is officially marked Completed.`,
            msg_type: "invoice",
            request_id: request._id,
            metadata: {
                status: "completed",
                warranty: request.warranty
            }
        });
        await successMsg.save();

        res.json({
            success: true,
            message: "PIN verified successfully! Work marked Completed.",
            request
        });
    } catch (error) {
        console.error("Verify OTP error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to verify completion PIN."
        });
    }
});

// Technician on-site check-in / check-out time tracking
router.post("/requests/:id/time-log", authMiddleware, async (req, res) => {
    try {
        const company = await getCompanyForUser(req.user.id);
        if (!company) {
            return res.status(404).json({
                success: false,
                message: "Company profile not found."
            });
        }

        const { action } = req.body; // "check_in" or "check_out"
        const request = await ServiceRequest.findOne({
            _id: req.params.id,
            company_id: company._id
        });

        if (!request) {
            return res.status(404).json({
                success: false,
                message: "Service request not found."
            });
        }

        if (!request.time_tracking) {
            request.time_tracking = {};
        }

        const now = new Date();
        if (action === "check_in") {
            request.time_tracking.check_in_time = now;
            request.status = "in_progress";
        } else if (action === "check_out") {
            request.time_tracking.check_out_time = now;
            if (request.time_tracking.check_in_time) {
                const diffMs = now - new Date(request.time_tracking.check_in_time);
                request.time_tracking.total_minutes = Math.round(diffMs / (1000 * 60));
            }
        }

        await request.save();

        const actionText = action === "check_in" ? "Technicians checked in on-site" : `Technicians completed daily shift (Total on-site: ${request.time_tracking.total_minutes || 0} mins)`;
        const timeMsg = new ChatMessage({
            customer_id: request.customer_id,
            company_id: company._id,
            sender_id: req.user.id,
            sender_role: "company",
            sender_name: company.company_name,
            message: `⏱️ Technician Attendance Log: ${actionText} at ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`,
            msg_type: "text",
            request_id: request._id
        });
        await timeMsg.save();

        res.json({
            success: true,
            message: `Technician ${action === "check_in" ? "checked in" : "checked out"} successfully.`,
            request
        });
    } catch (error) {
        console.error("Time log error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to record time log."
        });
    }
});

// Company deletes service request - ONLY completed or cancelled jobs allowed; active/started jobs cannot be deleted
router.delete("/requests/:id", authMiddleware, async (req, res) => {
    try {
        const company = await getCompanyForUser(req.user.id);
        if (!company) {
            return res.status(404).json({
                success: false,
                message: "Company profile not found."
            });
        }

        const request = await ServiceRequest.findOne({
            _id: req.params.id,
            company_id: company._id
        });

        if (!request) {
            return res.status(404).json({
                success: false,
                message: "Service request not found."
            });
        }

        // Active/started statuses cannot be deleted
        const activeStatuses = ["workers_assigned", "in_progress", "work_submitted", "rework_needed", "confirmed", "quoted", "requested"];
        if (activeStatuses.includes(request.status)) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete active or started work (Status: ${request.status}). Only completed jobs can be deleted.`
            });
        }

        if (request.status !== "completed" && request.status !== "cancelled") {
            return res.status(400).json({
                success: false,
                message: "Only completed jobs can be deleted."
            });
        }

        await ServiceRequest.deleteOne({ _id: request._id });

        res.json({
            success: true,
            message: "Completed service request deleted successfully from records."
        });
    } catch (error) {
        console.error("Company delete request error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete service request."
        });
    }
});

// Company requests payment from customer
router.post("/requests/:id/request-payment", authMiddleware, async (req, res) => {
    try {
        const company = await getCompanyForUser(req.user.id);
        if (!company) {
            return res.status(404).json({
                success: false,
                message: "Company profile not found."
            });
        }

        const { amount, description, payment_type } = req.body;
        const numAmount = Number(amount);

        if (!numAmount || isNaN(numAmount) || numAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Payment amount must be greater than 0."
            });
        }

        if (!description || !description.trim()) {
            return res.status(400).json({
                success: false,
                message: "Please provide a description for the payment request."
            });
        }

        const validTypes = ["material_purchase", "milestone_payment"];
        if (!payment_type || !validTypes.includes(payment_type)) {
            return res.status(400).json({
                success: false,
                message: "Invalid payment type. Must be material_purchase or milestone_payment."
            });
        }

        const request = await ServiceRequest.findOne({
            _id: req.params.id,
            company_id: company._id
        });

        if (!request) {
            return res.status(404).json({
                success: false,
                message: "Service request not found."
            });
        }

        const inProgressStatuses = ["in_progress", "workers_assigned", "confirmed"];
        if (!inProgressStatuses.includes(request.status)) {
            return res.status(400).json({
                success: false,
                message: `Payment request can only be created for requests that are in progress. Current status: ${request.status}.`
            });
        }

        const paymentRequest = new PaymentRequest({
            service_request_id: request._id,
            customer_id: request.customer_id,
            company_id: company._id,
            amount: numAmount,
            description: description.trim(),
            payment_type,
            status: "pending"
        });

        await paymentRequest.save();

        const chatMsg = new ChatMessage({
            customer_id: request.customer_id,
            company_id: company._id,
            sender_id: req.user.id,
            sender_role: "company",
            sender_name: company.company_name,
            message: `💰 Payment Request: Company requests ₹${numAmount} for "${description.trim()}". Please pay from your wallet.`,
            msg_type: "text",
            request_id: request._id,
            metadata: {
                payment_request_id: paymentRequest._id,
                amount: numAmount,
                payment_type,
                description: description.trim()
            }
        });
        await chatMsg.save();

        res.json({
            success: true,
            message: "Payment request sent successfully.",
            payment_request: paymentRequest
        });
    } catch (error) {
        console.error("Payment request error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create payment request."
        });
    }
});

module.exports = router;

