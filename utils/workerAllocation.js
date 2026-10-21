const Worker = require("../models/Worker");
const ServiceRequest = require("../models/ServiceRequest");
const ChatMessage = require("../models/ChatMessage");

// Convert various date strings (e.g. "30.09.26", "30.09.2026", "30/09/2026", "2026-09-30") into standard "YYYY-MM-DD"
function normalizeDateStr(dStr) {
    if (!dStr) return "";
    dStr = String(dStr).trim();
    if (!dStr) return "";

    // DD.MM.YY or DD.MM.YYYY
    if (/^\d{1,2}\.\d{1,2}\.\d{2,4}$/.test(dStr)) {
        const parts = dStr.split(".");
        let year = parts[2];
        if (year.length === 2) year = "20" + year;
        const month = parts[1].padStart(2, "0");
        const day = parts[0].padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    // DD/MM/YYYY or DD/MM/YY
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(dStr)) {
        const parts = dStr.split("/");
        let year = parts[2];
        if (year.length === 2) year = "20" + year;
        const month = parts[1].padStart(2, "0");
        const day = parts[0].padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    // Already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(dStr)) {
        return dStr.substring(0, 10);
    }

    const parsed = new Date(dStr);
    if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split("T")[0];
    }

    return dStr;
}

// Generate all dates (inclusive) between startDate and endDate in standard "YYYY-MM-DD"
function getDatesInRange(startDateStr, endDateStr) {
    const startNorm = normalizeDateStr(startDateStr);
    const endNorm = normalizeDateStr(endDateStr || startDateStr);
    const dates = [];
    if (!startNorm) return dates;

    const start = new Date(startNorm);
    const end = new Date(endNorm);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return [startNorm];
    }

    const curr = new Date(start);
    while (curr <= end) {
        dates.push(curr.toISOString().split("T")[0]);
        curr.setDate(curr.getDate() + 1);
    }
    return dates;
}

// Check whether two date ranges [startA, endA] and [startB, endB] overlap
function dateRangesOverlap(startA, endA, startB, endB) {
    const sA = normalizeDateStr(startA);
    const eA = normalizeDateStr(endA || startA);
    const sB = normalizeDateStr(startB);
    const eB = normalizeDateStr(endB || startB);
    if (!sA || !eA || !sB || !eB) return false;
    return sA <= eB && eA >= sB;
}

// Check if a worker is available for a list of dates
function checkWorkerAvailabilityForDates(worker, dates, excludeRequestId = null, activeJobs = []) {
    if (!worker || !dates || dates.length === 0) {
        return { is_available: false, conflict_reason: "Invalid dates or worker" };
    }

    for (const d of dates) {
        // 1. Check worker.availability array
        const av = (worker.availability || []).find((a) => a.date === d);
        if (av && (av.status === "busy" || av.status === "on_leave")) {
            if (!excludeRequestId || String(av.booking_id) !== String(excludeRequestId)) {
                return {
                    is_available: false,
                    conflict_reason: `Technician ${worker.name} is marked ${av.status} on ${d}`
                };
            }
        }

        // 2. Check approved leave records
        const leave = (worker.leave_records || []).find(
            (l) => l.status === "approved" && normalizeDateStr(l.date) === d
        );
        if (leave) {
            return {
                is_available: false,
                conflict_reason: `Technician ${worker.name} is on approved leave on ${d} (${leave.reason || "Leave"})`
            };
        }

        // 3. Check overlapping active jobs
        for (const job of activeJobs) {
            if (excludeRequestId && String(job._id) === String(excludeRequestId)) continue;
            const jStart = normalizeDateStr(job.start_date || job.quotation?.start_date);
            const jEnd = normalizeDateStr(job.end_date || job.quotation?.end_date || jStart);
            if (jStart && jEnd && d >= jStart && d <= jEnd) {
                const isAssigned = (job.assigned_workers || []).some(
                    (aw) => String(aw.worker_id) === String(worker._id)
                );
                if (isAssigned) {
                    return {
                        is_available: false,
                        conflict_reason: `Technician ${worker.name} is booked on ${job.service || "another service"} (${jStart} to ${jEnd})`
                    };
                }
            }
        }
    }

    return { is_available: true, conflict_reason: "" };
}

// Mark worker availability as busy for all dates in range
async function markWorkerBusyForDates(worker, dates, requestId) {
    if (!worker || !dates || dates.length === 0) return;
    worker.availability = worker.availability || [];

    for (const d of dates) {
        const existingIdx = worker.availability.findIndex((a) => a.date === d);
        if (existingIdx >= 0) {
            worker.availability[existingIdx].status = "busy";
            worker.availability[existingIdx].booking_id = requestId;
        } else {
            worker.availability.push({
                date: d,
                status: "busy",
                booking_id: requestId
            });
        }
    }

    await worker.save();
}

// Release worker busy status for a request - set availability back to 'available'
async function releaseWorkerAvailabilityForRequest(requestId) {
    if (!requestId) return;
    try {
        const reqDoc = await ServiceRequest.findById(requestId);
        const assignedIds = (reqDoc?.assigned_workers || []).map(a => a.worker_id).filter(Boolean);
        const workers = await Worker.find({
            $or: [
                { "availability.booking_id": requestId },
                { _id: { $in: assignedIds } }
            ]
        });
        for (const w of workers) {
            let changed = false;
            w.availability = (w.availability || []).map((a) => {
                if (String(a.booking_id) === String(requestId)) {
                    changed = true;
                    return {
                        date: a.date,
                        status: "available",
                        booking_id: null
                    };
                }
                return a;
            });
            if (changed) {
                await w.save();
            }
        }
    } catch (err) {
        console.warn("Failed to release worker availability:", err);
    }
}

// Automatically allocate available workers when customer pays 50% advance
async function allocateWorkersOnBookingAdvance(request) {
    if (!request || !request.company_id) return null;

    const startRaw = request.quotation?.start_date || request.start_date || "";
    const endRaw = request.quotation?.end_date || request.end_date || startRaw;
    const dates = getDatesInRange(startRaw, endRaw);

    if (dates.length === 0) {
        console.warn("Cannot allocate workers: No quotation dates set for request", request._id);
        return null;
    }

    const workersNeeded = Number(request.quotation?.workers_needed) || 1;

    // Fetch all workers belonging to this company
    const allWorkers = await Worker.find({ company_id: request.company_id });
    if (!allWorkers || allWorkers.length === 0) {
        console.warn("No workers found for company", request.company_id);
        return null;
    }

    // Active jobs for overlapping conflict check
    const activeJobs = await ServiceRequest.find({
        _id: { $ne: request._id },
        company_id: request.company_id,
        status: { $in: ["confirmed", "workers_assigned", "in_progress", "rework_needed"] }
    });

    // Check availability for all dates
    const availableWorkers = [];
    for (const worker of allWorkers) {
        const check = checkWorkerAvailabilityForDates(worker, dates, request._id, activeJobs);
        if (check.is_available) {
            availableWorkers.push(worker);
        }
    }

    if (availableWorkers.length === 0) {
        console.warn(`No available workers found for request ${request._id} on dates ${dates[0]} to ${dates[dates.length - 1]}`);
        return null;
    }

    // Prioritize workers whose skills match the requested service
    const targetService = (request.service || "").toLowerCase();
    availableWorkers.sort((a, b) => {
        const aHasSkill = (a.skills || []).some((s) => s.toLowerCase().includes(targetService) || targetService.includes(s.toLowerCase()));
        const bHasSkill = (b.skills || []).some((s) => s.toLowerCase().includes(targetService) || targetService.includes(s.toLowerCase()));
        if (aHasSkill && !bHasSkill) return -1;
        if (!aHasSkill && bHasSkill) return 1;
        return (b.rating || 5) - (a.rating || 5);
    });

    const selectedWorkers = availableWorkers.slice(0, workersNeeded);

    // Assign workers to the service request
    request.assigned_workers = selectedWorkers.map((w) => ({
        worker_id: w._id,
        name: w.name,
        phone: w.phone,
        skills: w.skills || [],
        assigned_days: dates.length
    }));

    request.start_date = dates[0];
    request.end_date = dates[dates.length - 1];
    request.status = "workers_assigned";
    await request.save({ validateModifiedOnly: true });

    // Mark each worker as 'busy' for the scheduled dates
    for (const w of selectedWorkers) {
        await markWorkerBusyForDates(w, dates, request._id);
    }

    // Send chat notification with allocated technician details
    try {
        const workerNames = selectedWorkers.map((w) => w.name).join(", ");
        const workerCardMsg = new ChatMessage({
            customer_id: request.customer_id,
            company_id: request.company_id,
            sender_role: "company",
            sender_name: "Service Team",
            message: `👷 Technicians Allocated: ${selectedWorkers.length} technician(s) (${workerNames}) allocated for ${dates[0]} to ${dates[dates.length - 1]}. Their schedule is locked for your service.`,
            msg_type: "worker_details",
            request_id: request._id,
            metadata: {
                workers: request.assigned_workers,
                start_date: dates[0],
                end_date: dates[dates.length - 1]
            }
        });
        await workerCardMsg.save();
    } catch (msgErr) {
        console.warn("Could not send chat notification for worker allocation:", msgErr);
    }

    return selectedWorkers;
}

module.exports = {
    normalizeDateStr,
    getDatesInRange,
    dateRangesOverlap,
    checkWorkerAvailabilityForDates,
    markWorkerBusyForDates,
    releaseWorkerAvailabilityForRequest,
    allocateWorkersOnBookingAdvance
};
