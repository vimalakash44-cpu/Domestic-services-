const express = require("express");
const multer = require("multer");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Worker = require("../models/Worker");
const Company = require("../models/Company");
const User = require("../models/User");
const Wallet = require("../models/Wallet");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            "application/pdf",
            "image/jpeg",
            "image/png"
        ];

        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Only PDF, JPG and PNG files are allowed."));
        }
    }
});
router.get(
    "/status",
    authMiddleware,
    async (req, res) => {
        try {
            const company = await Company.findOne({
                user_id: req.user.id
            });

            if (!company) {
                return res.json({
                    exists: false
                });
            }

            res.json({
                exists: true,
                status: company.verification_status
            });

        } catch (error) {
            console.error(error);

            res.status(500).json({
                message: "Unable to check company status."
            });
        }
    }
);
router.post(
    "/register",
    authMiddleware,
    upload.single("verification_document"),
    async (req, res) => {
        try {
            if (!req.user || !req.user.id) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid authentication token. Please login again."
                });
            }

            const user_id = req.user.id;
            const user = await User.findById(user_id);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User account not found. Please register again."
                });
            }

            if (user.role !== "company") {
                return res.status(403).json({
                    success: false,
                    message: "Only company accounts can register company profiles."
                });
            }

            const {
                company_name,
                owner_name,
                phone,
                address,
                city,
                experience,
                total_workers,
                services,
                description
            } = req.body;

            if (
                !company_name ||
                !owner_name ||
                !phone ||
                !address ||
                !city ||
                !experience ||
                !total_workers ||
                !services ||
                !description
            ) {
                return res.status(400).json({
                    message: "Please fill all required fields."
                });
            }

            if (!req.file) {
                return res.status(400).json({
                    message: "Verification document is required."
                });
            }
            const existingCompany = await Company.findOne({ user_id });
            if (existingCompany) {
                return res.status(400).json({
                    message: "Company profile already exists."
                });
            }

            const serviceArray = Array.isArray(services)
                ? services
                : [services];

            if (!mongoose.connection.db) {
                return res.status(500).json({
                    message: "Database connection is not ready."
                });
            }

            const bucket = new mongoose.mongo.GridFSBucket(
                mongoose.connection.db,
                {
                    bucketName: "verificationDocuments"
                }
            );

            const filename =
                Date.now() + "-" + req.file.originalname;

            const uploadStream = bucket.openUploadStream(
                filename,
                {
                    contentType: req.file.mimetype,
                    metadata: {
                        user_id: user_id,
                        documentType: "company-verification"
                    }
                }
            );

            uploadStream.end(req.file.buffer);

            await new Promise((resolve, reject) => {
                uploadStream.on("finish", resolve);
                uploadStream.on("error", reject);
            });

            const company = new Company({
                user_id: user_id,
                company_name: company_name.trim(),
                owner_name: owner_name.trim(),
                email: user.email,
                phone: phone.trim(),
                address: address.trim(),
                city: city.trim(),
                experience: Number(experience),
                total_workers: Number(total_workers),
                services: serviceArray,
                description: description.trim(),
                verification_document: {
                    file_id: uploadStream.id,
                    filename: req.file.originalname,
                    content_type: req.file.mimetype
                },
                verification_status: "pending"
            });

            await company.save();

            return res.status(201).json({
                success: true,
                message:
                    "Company registration submitted successfully. Waiting for admin verification."
            });

        } catch (error) {
            console.error("Company registration error:", error);

            return res.status(500).json({
                success: false,
                message: "Company registration failed.",
                error: error.message
            });
        }
    }
);
router.put("/update", authMiddleware, async (req, res) => {
    try {

        const company = await Company.findOne({
            user_id: req.user.id
        });

        if (!company) {
            return res.status(404).json({
                message: "Company not found."
            });
        }

        const {
            company_name,
            owner_name,
            phone,
            address,
            city,
            experience,
            total_workers,
            services,
            description
        } = req.body;

        company.company_name = company_name.trim();
        company.owner_name = owner_name.trim();
        company.phone = phone.trim();
        company.address = address.trim();
        company.city = city.trim();
        company.experience = Number(experience);
        company.total_workers = Number(total_workers);
        company.services = Array.isArray(services)
            ? services
            : [services];
        company.description = description.trim();

        await company.save();

        res.json({
            success: true,
            message: "Company details updated successfully.",
            company
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Failed to update company details."
        });
    }
});
router.post(
    "/workers",
    authMiddleware,
    async (req, res) => {

        try {

            const company = await Company.findOne({
                user_id: req.user.id
            });

            if (!company) {
                return res.status(404).json({
                    message: "Company not found."
                });
            }

            if (company.verification_status !== "approved") {
                return res.status(403).json({
                    message: "Company is not approved."
                });
            }


            const {
                name,
                phone,
                email,
                experience,
                skills,
                password
            } = req.body;

            if (!name || !phone || !skills) {
                return res.status(400).json({
                    message: "Name, phone and skills are required."
                });
            }

            const plainPassword = (password && String(password).trim()) || "worker123";
            const hashedPassword = await bcrypt.hash(plainPassword, 10);

            const worker = new Worker({
                company_id: company._id,
                name: name.trim(),
                phone: phone.trim(),
                email: email ? email.trim() : "",
                experience: Number(experience) || 0,
                skills: Array.isArray(skills) ? skills : [skills],
                password: hashedPassword,
                initial_password: plainPassword,
                availability: []
            });

            await worker.save();


            res.status(201).json({
                success: true,

                message:
                    "Worker added successfully.",

                worker
            });


        } catch (error) {

            console.error(
                "Add worker error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Failed to add worker."
            });
        }
    }
);
router.get("/workers", authMiddleware, async (req, res) => {

    try {

        const company = await Company.findOne({
            user_id: req.user.id
        });

        if (!company) {
            return res.status(404).json({
                message: "Company not found."
            });
        }


        const workers = await Worker.find({
            company_id: company._id
        });


        res.json({
            success: true,
            workers
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Unable to fetch workers."
        });
    }
});
router.put(
    "/workers/:workerId/availability",
    authMiddleware,
    async (req, res) => {

        try {

            const {
                date,
                status
            } = req.body;


            if (!date || !status) {
                return res.status(400).json({
                    message:
                        "Date and status are required."
                });
            }


            const allowedStatuses = [
                "available",
                "busy",
                "wants_work",
                "on_leave"
            ];


            if (!allowedStatuses.includes(status)) {
                return res.status(400).json({
                    message:
                        "Invalid worker status."
                });
            }


            const company = await Company.findOne({
                user_id: req.user.id
            });


            if (!company) {
                return res.status(404).json({
                    message:
                        "Company not found."
                });
            }


            const worker = await Worker.findOne({
                _id: req.params.workerId,
                company_id: company._id
            });


            if (!worker) {
                return res.status(404).json({
                    message:
                        "Worker not found."
                });
            }


            const existingDate =
                worker.availability.find(
                    item => item.date === date
                );


            if (existingDate) {

                existingDate.status = status;

                existingDate.booking_id = null;

            } else {

                worker.availability.push({
                    date: date,
                    status: status
                });

            }


            await worker.save();


            res.json({
                success: true,

                message:
                    `Worker status updated for ${date}.`,

                worker
            });


        } catch (error) {

            console.error(
                "Availability error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Unable to update worker availability."
            });
        }
    }
);
router.get(
    "/workers/availability/:date",
    authMiddleware,
    async (req, res) => {

        try {

            const company = await Company.findOne({
                user_id: req.user.id
            });

            if (!company) {
                return res.status(404).json({
                    message:
                        "Company not found."
                });
            }


            const workers = await Worker.find({
                company_id: company._id
            }).lean();


            const date = req.params.date;


            const result = workers.map(worker => {

                const availability =
                    worker.availability.find(
                        item => item.date === date
                    );


                return {
                    _id: worker._id,

                    name: worker.name,

                    phone: worker.phone,

                    email: worker.email,

                    experience: worker.experience,

                    skills: worker.skills,

                    status:
                        availability
                            ? availability.status
                            : "available"
                };

            });


            res.json({
                success: true,
                date: date,
                workers: result
            });


        } catch (error) {

            console.error(error);

            res.status(500).json({
                message:
                    "Unable to fetch worker availability."
            });
        }
    }
);

router.get(
    "/dashboard",
    authMiddleware,
    async (req, res) => {
        try {
            const company = await Company.findOne({user_id: req.user.id}).lean();
            if (!company) {
                return res.status(404).json({
                    success: false,
                    message:"Company profile not found."
                });
            }
            if (company.verification_status !=="approved") {
                return res.status(403).json({
                    success: false,
                    message:"Company is not approved."
                });
            }
            const workers =await Worker.find({company_id: company._id}).lean();
            const today =new Date().toISOString().split("T")[0];
            const workersWithStatus =
                workers.map(worker => {
                    const availability =
                        worker.availability.find(
                            item =>
                                item.date === today
                        );
                    return {
                        ...worker,
                        status:
                            availability
                                ? availability.status
                                : "available"
                    };

                });

            // Company wallet
            let compWallet = await Wallet.findOne({ user_id: req.user.id }).lean();
            const walletBalance = compWallet ? compWallet.balance : 0;
            const walletTxns = compWallet ? (compWallet.transactions || []).slice(-15).reverse() : [];

            res.json({
                success: true,
                date: today,
                company: company,
                workers: workersWithStatus,
                wallet_balance: walletBalance,
                wallet_transactions: walletTxns
            });
        } catch (error) {
            console.error(
                "Dashboard error:",
                error
            );
            res.status(500).json({
                success: false,
                message:
                    "Unable to load company dashboard."
            });
        }
    }
);

// GET /api/company/wallet - Get company wallet details and full transactions
router.get("/wallet", authMiddleware, async (req, res) => {
    try {
        let compWallet = await Wallet.findOne({ user_id: req.user.id });
        if (!compWallet) {
            compWallet = new Wallet({
                user_id: req.user.id,
                balance: 0,
                transactions: []
            });
            await compWallet.save();
        }

        const sortedTxns = [...(compWallet.transactions || [])].sort(
            (a, b) => new Date(b.created_at) - new Date(a.created_at)
        );

        res.json({
            success: true,
            balance: compWallet.balance,
            transactions: sortedTxns
        });
    } catch (err) {
        console.error("Get company wallet error:", err);
        res.status(500).json({
            success: false,
            message: "Unable to load company wallet."
        });
    }
});
router.get(
    "/approved",
    authMiddleware,
    async (req, res) => {
        try {
            const companies = await Company.find({
                verification_status: "approved"
            }).select(
                "company_name owner_name email phone city address experience total_workers services description rating product_rating review_count total_reviews verification_status"
            );

            res.json({
                success: true,
                companies
            });

        } catch (error) {
            console.error(
                "Error loading approved companies:",
                error
            );

            res.status(500).json({
                success: false,
                message: "Unable to load companies."
            });
        }
    }
);

router.get("/complaints", authMiddleware, async (req, res) => {
    try {
        const company = await Company.findOne({ user_id: req.user.id });
        if (!company) {
            return res.status(404).json({
                success: false,
                message: "Company not found."
            });
        }

        const workers = await Worker.find({ company_id: company._id });
        const allWorkerComplaints = [];
        
        for (const worker of workers) {
            if (worker.complaints && worker.complaints.length > 0) {
                worker.complaints.forEach(complaint => {
                    allWorkerComplaints.push({
                        worker_name: worker.name,
                        worker_phone: worker.phone,
                        worker_id: worker._id,
                        customer_name: complaint.customer_name,
                        customer_phone: complaint.customer_phone,
                        text: complaint.text,
                        about: complaint.about,
                        service: complaint.service,
                        request_id: complaint.request_id,
                        created_at: complaint.created_at
                    });
                });
            }
        }

        res.json({
            success: true,
            complaints: allWorkerComplaints
        });
    } catch (error) {
        console.error("Error fetching worker complaints:", error);
        res.status(500).json({
            success: false,
            message: "Unable to fetch worker complaints."
        });
    }
});

// Remove / Delete Worker permanently from database
router.delete("/workers/:workerId", authMiddleware, async (req, res) => {
    try {
        const company = await Company.findOne({ user_id: req.user.id });
        if (!company) {
            return res.status(404).json({
                success: false,
                message: "Company not found."
            });
        }

        const worker = await Worker.findOne({
            _id: req.params.workerId,
            company_id: company._id
        });

        if (!worker) {
            return res.status(404).json({
                success: false,
                message: "Worker not found or does not belong to this company."
            });
        }

        await Worker.deleteOne({ _id: worker._id });

        // Update company total_workers counter if available
        const remaining = await Worker.countDocuments({ company_id: company._id });
        company.total_workers = remaining;
        await company.save();

        res.json({
            success: true,
            message: `Worker ${worker.name} removed permanently from database.`,
            remaining_workers: remaining
        });
    } catch (error) {
        console.error("Remove worker error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to remove worker."
        });
    }
});

module.exports = router;