const express = require("express");
const mongoose = require("mongoose");
const Company = require("../models/Company");
const User = require("../models/User");
const Worker = require("../models/Worker");
const adminMiddleware = require("../middleware/adminMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const router = express.Router();

router.get("/companies/pending", adminMiddleware, async (req, res) => {
    try {
        const companies = await Company.find({
            verification_status: "pending"
        }).sort({
            createdAt: -1
        });

        res.status(200).json({
            success: true,
            companies
        });

    } catch (error) {
        console.error("Pending companies error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to fetch pending companies."
        });
    }
});

router.get("/companies/approved", adminMiddleware, async (req, res) => {
    try {
        const companies = await Company.find({
            verification_status: "approved"
        }).select(
            "company_name owner_name email phone city address experience total_workers services description rating product_rating review_count total_reviews verification_status company_complaints"
        ).sort({ createdAt: -1 });

        res.json({
            success: true,
            companies
        });
    } catch (error) {
        console.error("Error fetching approved companies:", error);
        res.status(500).json({
            success: false,
            message: "Unable to fetch approved companies."
        });
    }
});

router.get("/companies/:id", adminMiddleware, async (req, res) => {
    try {
        const company = await Company.findById(req.params.id);

        if (!company) {
            return res.status(404).json({
                success: false,
                message: "Company not found."
            });
        }

        res.status(200).json({
            success: true,
            company
        });

    } catch (error) {
        console.error("Company details error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to fetch company."
        });
    }
});

router.patch(
    "/companies/:id/approve",
    adminMiddleware,
    async (req, res) => {
        try {
            const company =
                await Company.findById(req.params.id);

            if (!company) {
                return res.status(404).json({
                    success: false,
                    message: "Company not found."
                });
            }

            company.verification_status = "approved";

            await company.save();

            res.status(200).json({
                success: true,
                message: "Company approved successfully."
            });

        } catch (error) {
            console.error("Approve error:", error);

            res.status(500).json({
                success: false,
                message: "Unable to approve company."
            });
        }
    }
);

router.patch(
    "/companies/:id/reject",
    adminMiddleware,
    async (req, res) => {
        try {
            const company =
                await Company.findById(req.params.id);

            if (!company) {
                return res.status(404).json({
                    success: false,
                    message: "Company not found."
                });
            }

            company.verification_status = "rejected";

            await company.save();

            res.status(200).json({
                success: true,
                message: "Company rejected successfully."
            });

        } catch (error) {
            console.error("Reject error:", error);

            res.status(500).json({
                success: false,
                message: "Unable to reject company."
            });
        }
    }
);

router.get(
    "/companies/:id/document",
    adminMiddleware,
    async (req, res) => {
        try {
            const company =
                await Company.findById(req.params.id);

            if (!company) {
                return res.status(404).json({
                    success: false,
                    message: "Company not found."
                });
            }

            if (
                !company.verification_document ||
                !company.verification_document.file_id
            ) {
                return res.status(404).json({
                    success: false,
                    message: "Verification document not found."
                });
            }

            const bucket =
                new mongoose.mongo.GridFSBucket(
                    mongoose.connection.db,
                    {
                        bucketName: "verificationDocuments"
                    }
                );

            const fileId =
                new mongoose.Types.ObjectId(
                    company.verification_document.file_id
                );

            const files =
                await bucket.find({
                    _id: fileId
                }).toArray();

            if (files.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Document not found."
                });
            }

            res.set(
                "Content-Type",
                files[0].contentType
            );

            const downloadStream =
                bucket.openDownloadStream(fileId);

            downloadStream.pipe(res);

        } catch (error) {
            console.error("Document error:", error);

            res.status(500).json({
                success: false,
                message: "Unable to open document."
            });
        }
    }
);
router.get("/stats", authMiddleware, async (req, res) => {
    try {
        const pendingCount = await Company.countDocuments({
            verification_status: "pending"
        });

        const approvedCount = await Company.countDocuments({
            verification_status: "approved"
        });

        const rejectedCount = await Company.countDocuments({
            verification_status: "rejected"
        });

        const totalCount = await Company.countDocuments();

        res.json({
            success: true,
            pendingCount,
            approvedCount,
            rejectedCount,
            totalCount
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch company statistics"
        });
    }
});


router.get("/companies/:id/complaints", adminMiddleware, async (req, res) => {
    try {
        const company = await Company.findById(req.params.id);
        if (!company) {
            return res.status(404).json({
                success: false,
                message: "Company not found."
            });
        }

        res.json({
            success: true,
            company_name: company.company_name,
            complaints: company.company_complaints || []
        });
    } catch (error) {
        console.error("Error fetching company complaints:", error);
        res.status(500).json({
            success: false,
            message: "Unable to fetch company complaints."
        });
    }
});

router.delete("/companies/:id", adminMiddleware, async (req, res) => {
    try {
        const company = await Company.findById(req.params.id);
        if (!company) {
            return res.status(404).json({
                success: false,
                message: "Company not found."
            });
        }

        const companyName = company.company_name;
        const companyEmail = company.email;
        const userId = company.user_id;

        await Worker.deleteMany({ company_id: company._id });
        await Company.findByIdAndDelete(req.params.id);
        await User.findByIdAndDelete(userId);

        res.json({
            success: true,
            message: `Company "${companyName}" has been removed from the platform. A notification has been sent to ${companyEmail}. The company dashboard is no longer accessible.`
        });
    } catch (error) {
        console.error("Error removing company:", error);
        res.status(500).json({
            success: false,
            message: "Unable to remove company."
        });
    }
});

module.exports = router;