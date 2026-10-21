const express = require('express');
const router = express.Router();
const Complaint = require('../models/Complaint');
const ServiceRequest = require('../models/ServiceRequest');
const authMiddleware = require('../middleware/authMiddleware');

// Create complaint
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { serviceRequestId, complaintType, description, dayNumber, severity } = req.body;
        
        const serviceRequest = await ServiceRequest.findById(serviceRequestId);
        if (!serviceRequest) {
            return res.status(404).json({ message: 'Service request not found' });
        }

        // Create complaint
        const complaint = new Complaint({
            serviceRequest: serviceRequestId,
            customer: req.user._id,
            company: serviceRequest.company_id,
            worker: serviceRequest.assigned_workers[0]?.worker_id || null,
            complaintType,
            description,
            dayNumber,
            severity: severity || 'medium'
        });

        await complaint.save();

        // Add complaint to service request
        serviceRequest.complaint.has_complaint = true;
        serviceRequest.complaint.text = description;
        serviceRequest.complaint.about = complaintType === 'technician' ? 'worker' : 
                                           complaintType === 'quality' ? 'product' : 'other';
        await serviceRequest.save();

        res.status(201).json({ message: 'Complaint created successfully', complaint });
    } catch (error) {
        console.error('Error creating complaint:', error);
        res.status(500).json({ message: 'Error creating complaint', error: error.message });
    }
});

// Get complaints for customer
router.get('/customer', authMiddleware, async (req, res) => {
    try {
        const complaints = await Complaint.find({ customer: req.user._id })
            .populate('serviceRequest')
            .populate('company')
            .populate('worker')
            .sort({ createdAt: -1 });
        
        res.json(complaints);
    } catch (error) {
        console.error('Error fetching customer complaints:', error);
        res.status(500).json({ message: 'Error fetching complaints', error: error.message });
    }
});

// Get complaints for company
router.get('/company', authMiddleware, async (req, res) => {
    try {
        const complaints = await Complaint.find({ company: req.user._id })
            .populate('serviceRequest')
            .populate('customer')
            .populate('worker')
            .sort({ createdAt: -1 });
        
        res.json(complaints);
    } catch (error) {
        console.error('Error fetching company complaints:', error);
        res.status(500).json({ message: 'Error fetching complaints', error: error.message });
    }
});

// Get complaints for worker
router.get('/worker', authMiddleware, async (req, res) => {
    try {
        const complaints = await Complaint.find({ worker: req.user._id })
            .populate('serviceRequest')
            .populate('customer')
            .populate('company')
            .sort({ createdAt: -1 });
        
        res.json(complaints);
    } catch (error) {
        console.error('Error fetching worker complaints:', error);
        res.status(500).json({ message: 'Error fetching complaints', error: error.message });
    }
});

// Update complaint status (for company/admin)
router.put('/:id/status', authMiddleware, async (req, res) => {
    try {
        const { status, response } = req.body;
        
        const complaint = await Complaint.findById(req.params.id);
        if (!complaint) {
            return res.status(404).json({ message: 'Complaint not found' });
        }

        complaint.status = status;
        complaint.response = response;
        
        if (status === 'resolved') {
            complaint.resolvedAt = Date.now();
        }

        await complaint.save();

        res.json({ message: 'Complaint status updated', complaint });
    } catch (error) {
        console.error('Error updating complaint:', error);
        res.status(500).json({ message: 'Error updating complaint', error: error.message });
    }
});

// Get complaint by ID
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const complaint = await Complaint.findById(req.params.id)
            .populate('serviceRequest')
            .populate('customer')
            .populate('company')
            .populate('worker');
        
        if (!complaint) {
            return res.status(404).json({ message: 'Complaint not found' });
        }

        res.json(complaint);
    } catch (error) {
        console.error('Error fetching complaint:', error);
        res.status(500).json({ message: 'Error fetching complaint', error: error.message });
    }
});

module.exports = router;
