const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");
const Worker = require("../models/Worker");
const ServiceRequest = require("../models/ServiceRequest");
const ChatMessage = require("../models/ChatMessage");

const PARTS_CATALOG = [
    { id: "pvc-pipe-1", name: "1-inch PVC Pipe", unit: "length", category: "Plumbing", typical_price: 180 },
    { id: "pvc-elbow", name: "PVC Elbow / T-Joint", unit: "pcs", category: "Plumbing", typical_price: 25 },
    { id: "thread-tape", name: "Teflon Thread Tape", unit: "roll", category: "Plumbing", typical_price: 20 },
    { id: "faucet", name: "Tap / Faucet", unit: "pcs", category: "Plumbing", typical_price: 450 },
    { id: "pvc-glue", name: "PVC Solvent Cement", unit: "tin", category: "Plumbing", typical_price: 80 },
    { id: "wire-15", name: "1.5mm Electrical Wire", unit: "coil", category: "Electrical", typical_price: 350 },
    { id: "switch", name: "Wall Switch", unit: "pcs", category: "Electrical", typical_price: 80 },
    { id: "socket", name: "Power Socket", unit: "pcs", category: "Electrical", typical_price: 90 },
    { id: "mcb", name: "MCB / Circuit Breaker", unit: "pcs", category: "Electrical", typical_price: 250 },
    { id: "insul-tape", name: "Insulation Tape", unit: "roll", category: "Electrical", typical_price: 25 },
    { id: "putty", name: "Wall Putty", unit: "kg", category: "Painting", typical_price: 80 },
    { id: "primer", name: "Primer Coat", unit: "litre", category: "Painting", typical_price: 180 },
    { id: "paint", name: "Emulsion Paint", unit: "litre", category: "Painting", typical_price: 220 },
    { id: "sandpaper", name: "Sandpaper Pack", unit: "pack", category: "Painting", typical_price: 40 },
    { id: "cement", name: "UltraTech Cement", unit: "bag", category: "Masonry", typical_price: 420 },
    { id: "tile-adhesive", name: "Tile Adhesive", unit: "bag", category: "Masonry", typical_price: 380 },
    { id: "waterproof", name: "Waterproofing Chemical", unit: "litre", category: "Masonry", typical_price: 280 },
    { id: "silicone", name: "Silicone Sealant", unit: "tube", category: "General", typical_price: 90 },
    { id: "screws", name: "Screws & Fasteners Mix", unit: "pack", category: "General", typical_price: 50 },
    { id: "gloves", name: "Work Gloves", unit: "pair", category: "General", typical_price: 40 }
];

function qtyNumber(quantity) {
    const match = String(quantity || "").match(/[\d.]+/);
    return match ? parseFloat(match[0]) : 1;
}

async function getAssignedJob(req, res) {
    const serviceReq = await ServiceRequest.findById(req.params.id);
    if (!serviceReq) {
        res.status(404).json({ success: false, message: "Job order not found." });
        return null;
    }
    const isAssigned = serviceReq.assigned_workers.some(
        w => String(w.worker_id) === String(req.user.id)
    );
    if (!isAssigned) {
        res.status(403).json({ success: false, message: "You are not assigned to this job." });
        return null;
    }
    return serviceReq;
}

// Middleware to ensure user is an authorized technician
const requireWorker = (req, res, next) => {
    if (!req.user || req.user.role !== "worker") {
        return res.status(403).json({
            success: false,
            message: "Access restricted to authorized technicians only."
        });
    }
    next();
};

router.get("/parts-catalog", authMiddleware, requireWorker, (req, res) => {
    res.json({ success: true, catalog: PARTS_CATALOG });
});

// 1. Get Technician Profile & Performance Statistics
router.get("/profile", authMiddleware, requireWorker, async (req, res) => {
    try {
        const worker = await Worker.findById(req.user.id)
            .select("-password")
            .populate("company_id", "company_name phone email address city");

        if (!worker) {
            return res.status(404).json({ success: false, message: "Technician profile not found." });
        }

        const activeJobsCount = await ServiceRequest.countDocuments({
            "assigned_workers.worker_id": worker._id,
            status: { $in: ["workers_assigned", "in_progress", "rework_needed", "work_submitted"] }
        });

        const completedJobsCount = await ServiceRequest.countDocuments({
            "assigned_workers.worker_id": worker._id,
            status: "completed"
        });

        res.json({
            success: true,
            worker,
            stats: {
                active_jobs: activeJobsCount,
                completed_jobs: completedJobsCount,
                rating: worker.rating || 5,
                rating_count: worker.rating_count || 0
            }
        });
    } catch (err) {
        console.error("Worker profile error:", err);
        res.status(500).json({ success: false, message: "Server error loading technician profile." });
    }
});

// 2. Get All Assigned Jobs (Active & Past)
router.get("/my-jobs", authMiddleware, requireWorker, async (req, res) => {
    try {
        const workerId = req.user.id;

        const jobs = await ServiceRequest.find({
            "assigned_workers.worker_id": workerId
        })
        .populate("customer_id", "name phone email")
        .populate("company_id", "company_name phone email city")
        .sort({ updatedAt: -1 });

        res.json({
            success: true,
            jobs
        });
    } catch (err) {
        console.error("Worker jobs error:", err);
        res.status(500).json({ success: false, message: "Failed to fetch assigned jobs." });
    }
});

// 3. Post Daily Progress Update (Logged directly by Worker)
router.post("/jobs/:id/daily-update", authMiddleware, requireWorker, upload.single("photo"), async (req, res) => {
    try {
        const { id } = req.params;
        const { day_number, date, title, work_done } = req.body;

        if (!day_number || !work_done) {
            return res.status(400).json({
                success: false,
                message: "Day number and work done summary are required."
            });
        }

        const serviceReq = await ServiceRequest.findById(id);
        if (!serviceReq) {
            return res.status(404).json({ success: false, message: "Job order not found." });
        }

        // Verify this worker is assigned
        const isAssigned = serviceReq.assigned_workers.some(
            w => String(w.worker_id) === String(req.user.id)
        );
        if (!isAssigned) {
            return res.status(403).json({ success: false, message: "You are not assigned to this job." });
        }

        // Check if worker has checked in for this job
        const workerAssignment = serviceReq.assigned_workers.find(
            w => String(w.worker_id) === String(req.user.id)
        );
        
        if (!workerAssignment.current_check_in) {
            return res.status(403).json({ 
                success: false, 
                message: "You must check in before posting daily updates." 
            });
        }

        const worker = await Worker.findById(req.user.id);
        const workerName = worker ? worker.name : req.user.name || "Technician";

        const photoPath = req.file ? `/uploads/${req.file.filename}` : "";

        serviceReq.daily_updates.push({
            day_number: Number(day_number),
            date: date || new Date().toISOString().split("T")[0],
            title: title || `Day ${day_number} On-Site Progress`,
            work_done: work_done.trim(),
            photo: photoPath,
            logged_by_worker_id: req.user.id,
            logged_by_worker_name: workerName,
            updated_at: new Date()
        });

        if (serviceReq.status === "workers_assigned" || serviceReq.status === "rework_needed") {
            serviceReq.status = "in_progress";
        }

        await serviceReq.save();

        // Broadcast to customer chat stream
        try {
            await ChatMessage.create({
                customer_id: serviceReq.customer_id,
                company_id: serviceReq.company_id,
                sender_role: "company",
                sender_name: `${workerName} (Technician)`,
                message: `👷 Day ${day_number} Update by ${workerName}: ${work_done.trim()}`,
                message_type: "daily_update",
                card_data: {
                    request_id: serviceReq._id,
                    day_number: Number(day_number),
                    title: title || `Day ${day_number} On-Site Progress`,
                    work_done: work_done.trim(),
                    photo: photoPath
                }
            });
        } catch (e) {
            console.error("Chat sync error for worker update:", e);
        }

        res.json({
            success: true,
            message: "Daily progress log submitted successfully!",
            daily_updates: serviceReq.daily_updates
        });
    } catch (err) {
        console.error("Worker daily update error:", err);
        res.status(500).json({ success: false, message: "Failed to post daily work log." });
    }
});

function buildMaterialEntry(body, worker, receiptPath) {
    const source = body.source === "local_purchase" ? "local_purchase" : "van_stock";
    const catalogItem = body.catalog_id
        ? PARTS_CATALOG.find(p => p.id === body.catalog_id)
        : null;
    const item_name = (body.item_name || (catalogItem && catalogItem.name) || "").trim();
    const quantity = (body.quantity || "").trim();
    if (!item_name || !quantity) return null;

    const catalogPrice = catalogItem ? catalogItem.typical_price : 0;
    const unit_price = source === "local_purchase"
        ? Number(body.unit_price || 0)
        : Number(body.unit_price || catalogPrice || 0);
    const total_cost = Number((qtyNumber(quantity) * unit_price).toFixed(2));

    return {
        item_name,
        quantity,
        purpose: (body.purpose || "").trim(),
        source,
        catalog_id: body.catalog_id || (catalogItem ? catalogItem.id : ""),
        shop_name: source === "local_purchase" ? (body.shop_name || "").trim() : "Company van stock",
        receipt_photo: receiptPath || "",
        requested_by_worker_id: worker._id,
        requested_by_name: worker.name,
        requested_at: new Date(),
        status: source === "local_purchase" ? "purchased" : "from_stock",
        unit_price,
        total_cost
    };
}

router.post("/jobs/:id/requisition", authMiddleware, requireWorker, upload.single("receipt"), async (req, res) => {
    try {
        const serviceReq = await getAssignedJob(req, res);
        if (!serviceReq) return;

        const worker = await Worker.findById(req.user.id);
        const workerName = worker ? worker.name : req.user.name || "Technician";
        const receiptPath = req.file ? `/uploads/${req.file.filename}` : "";

        const itemsToAdd = [];
        let itemsPayload = req.body.items;
        if (typeof itemsPayload === "string") {
            try { itemsPayload = JSON.parse(itemsPayload); } catch (e) { itemsPayload = []; }
        }

        if (Array.isArray(itemsPayload) && itemsPayload.length > 0) {
            itemsPayload.forEach(it => {
                const entry = buildMaterialEntry(it, { _id: req.user.id, name: workerName }, receiptPath);
                if (entry) itemsToAdd.push(entry);
            });
        } else {
            const entry = buildMaterialEntry(req.body, { _id: req.user.id, name: workerName }, receiptPath);
            if (entry) itemsToAdd.push(entry);
        }

        if (itemsToAdd.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Please specify the product name and quantity."
            });
        }

        serviceReq.material_requisitions.push(...itemsToAdd);
        await serviceReq.save();

        const isShop = itemsToAdd.some(i => i.source === "local_purchase");
        res.json({
            success: true,
            message: isShop
                ? "Shop purchase logged. Amount will appear on the customer invoice."
                : "Van-stock part added to this job.",
            material_requisitions: serviceReq.material_requisitions
        });
    } catch (err) {
        console.error("Worker requisition error:", err);
        res.status(500).json({ success: false, message: "Failed to log material / purchase." });
    }
});

router.post("/jobs/:id/check-in", authMiddleware, requireWorker, async (req, res) => {
    try {
        const serviceReq = await getAssignedJob(req, res);
        if (!serviceReq) return;

        const assignment = serviceReq.assigned_workers.find(
            w => String(w.worker_id) === String(req.user.id)
        );
        assignment.on_site = true;
        assignment.check_in_time = new Date();
        assignment.check_out_time = undefined;
        assignment.current_check_in = true;
        assignment.last_check_in_time = new Date();

        serviceReq.time_tracking = serviceReq.time_tracking || {};
        serviceReq.time_tracking.check_in_time = assignment.check_in_time;

        if (serviceReq.status === "workers_assigned" || serviceReq.status === "rework_needed") {
            serviceReq.status = "in_progress";
        }

        await serviceReq.save();
        res.json({
            success: true,
            message: "Checked in at the job site.",
            check_in_time: assignment.check_in_time,
            status: serviceReq.status
        });
    } catch (err) {
        console.error("Worker check-in error:", err);
        res.status(500).json({ success: false, message: "Failed to check in." });
    }
});

router.post("/jobs/:id/check-out", authMiddleware, requireWorker, async (req, res) => {
    try {
        const serviceReq = await getAssignedJob(req, res);
        if (!serviceReq) return;

        const assignment = serviceReq.assigned_workers.find(
            w => String(w.worker_id) === String(req.user.id)
        );
        if (!assignment.on_site || !assignment.check_in_time) {
            return res.status(400).json({
                success: false,
                message: "Check in at the site before checking out."
            });
        }

        assignment.on_site = false;
        assignment.check_out_time = new Date();
        assignment.current_check_in = false;
        const minutes = Math.max(
            1,
            Math.round((assignment.check_out_time - new Date(assignment.check_in_time)) / 60000)
        );
        serviceReq.time_tracking = serviceReq.time_tracking || {};
        serviceReq.time_tracking.check_out_time = assignment.check_out_time;
        serviceReq.time_tracking.total_minutes = (serviceReq.time_tracking.total_minutes || 0) + minutes;

        await serviceReq.save();
        res.json({
            success: true,
            message: `Checked out. Time on site: ${minutes} minute(s).`,
            minutes_on_site: minutes
        });
    } catch (err) {
        console.error("Worker check-out error:", err);
        res.status(500).json({ success: false, message: "Failed to check out." });
    }
});

// 5. Worker Requests Leave for a Specific Date on Assigned Job
router.post("/jobs/:id/request-leave", authMiddleware, requireWorker, async (req, res) => {
    try {
        const { id } = req.params;
        const { date, reason } = req.body;

        if (!date) {
            return res.status(400).json({ success: false, message: "Leave date is required." });
        }

        const serviceReq = await ServiceRequest.findById(id);
        if (!serviceReq) {
            return res.status(404).json({ success: false, message: "Job order not found." });
        }

        const worker = await Worker.findById(req.user.id);
        if (!worker) {
            return res.status(404).json({ success: false, message: "Worker not found." });
        }

        // Record leave in worker's personal record
        worker.leave_records.push({
            date: date.trim(),
            reason: reason ? reason.trim() : "Personal / Health leave",
            status: "approved",
            requested_at: new Date()
        });
        await worker.save();

        // Flag the request so company sees the replacement prompt
        res.json({
            success: true,
            message: `Leave recorded for ${date}. The company has been alerted to allocate a substitute technician.`
        });
    } catch (err) {
        console.error("Worker leave request error:", err);
        res.status(500).json({ success: false, message: "Failed to request leave." });
    }
});

// 6. Worker Submits Completed Work with After-Repair Photos
router.post("/jobs/:id/submit-work", authMiddleware, requireWorker, upload.fields([
    { name: "after_photos", maxCount: 5 },
    { name: "photos", maxCount: 5 }
]), async (req, res) => {
    try {
        const { id } = req.params;
        const { work_notes, completion_notes } = req.body;

        const serviceReq = await ServiceRequest.findById(id);
        if (!serviceReq) {
            return res.status(404).json({ success: false, message: "Job order not found." });
        }

        const isAssigned = serviceReq.assigned_workers.some(
            w => String(w.worker_id) === String(req.user.id)
        );
        if (!isAssigned) {
            return res.status(403).json({ success: false, message: "You are not assigned to this job." });
        }

        const uploaded = [
            ...((req.files && req.files.after_photos) || []),
            ...((req.files && req.files.photos) || [])
        ];
        const afterPhotoPaths = uploaded.map(f => `/uploads/${f.filename}`);
        const notes = (work_notes || completion_notes || "").trim();

        if (afterPhotoPaths.length === 0 && (!serviceReq.after_photos || serviceReq.after_photos.length === 0)) {
            return res.status(400).json({
                success: false,
                message: "Please attach at least one photo showing completed repairs."
            });
        }

        if (afterPhotoPaths.length > 0) {
            serviceReq.after_photos.push(...afterPhotoPaths);
        }

        serviceReq.status = "work_submitted";
        serviceReq.work_submitted_at = new Date();

        if (notes) {
            const worker = await Worker.findById(req.user.id);
            const workerName = worker ? worker.name : "Technician";
            serviceReq.daily_updates.push({
                day_number: serviceReq.daily_updates.length + 1,
                date: new Date().toISOString().split("T")[0],
                title: "Final Completion & Quality Inspection Handover",
                work_done: `Completed repairs verified by ${workerName}. Notes: ${notes}`,
                photo: afterPhotoPaths[0] || "",
                logged_by_worker_id: req.user.id,
                logged_by_worker_name: workerName,
                updated_at: new Date()
            });
        }

        await serviceReq.save();

        res.json({
            success: true,
            message: "Repairs submitted successfully! Customer is now notified for on-site inspection.",
            status: serviceReq.status
        });
    } catch (err) {
        console.error("Worker submit work error:", err);
        res.status(500).json({ success: false, message: "Failed to submit completed repairs." });
    }
});

module.exports = router;
