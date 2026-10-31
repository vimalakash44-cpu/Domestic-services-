const mongoose = require("mongoose");

const serviceRequestSchema = new mongoose.Schema(
    {
        customer_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        customer_name: {
            type: String,
            required: true,
            trim: true
        },
        customer_phone: {
            type: String,
            default: "",
            trim: true
        },
        company_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Company",
            required: true
        },
        company_name: {
            type: String,
            default: "",
            trim: true
        },
        service: {
            type: String,
            required: true,
            trim: true
        },
        priority: {
            type: String,
            enum: ["normal", "urgent", "emergency"],
            default: "normal"
        },
        description: {
            type: String,
            required: true,
            trim: true
        },
        photos: [
            {
                type: String
            }
        ],
        // Realistic field requirements
        site_access_notes: {
            type: String,
            default: ""
        },
        site_inspection_notes: {
            type: String,
            default: ""
        },
        service_address: {
            type: String,
            required: true,
            trim: true
        },
        preferred_date: {
            type: String,
            default: ""
        },
        preferred_time: {
            type: String,
            default: ""
        },
        // Job Execution Window (Scheduled between Company & Customer)
        start_date: {
            type: String,
            default: ""
        },
        end_date: {
            type: String,
            default: ""
        },
        date_change_proposal: {
            proposed_start_date: { type: String, default: "" },
            proposed_end_date: { type: String, default: "" },
            reason: { type: String, default: "" },
            status: {
                type: String,
                enum: ["none", "pending", "accepted", "rejected"],
                default: "none"
            },
            requested_at: { type: Date }
        },
        status: {
            type: String,
            enum: [
                "requested",
                "quoted",
                "confirmed",
                "workers_assigned",
                "in_progress",
                "work_submitted",
                "rework_needed",
                "completed",
                "cancelled"
            ],
            default: "requested"
        },
        quotation: {
            start_date: {
                type: String,
                default: ""
            },
            end_date: {
                type: String,
                default: ""
            },
            workers_needed: {
                type: Number,
                default: 0
            },
            estimated_days: {
                type: Number,
                default: 0
            },
            estimated_cost: {
                type: Number,
                default: 0
            },
            labor_daily_rate: {
                type: Number,
                default: 0
            },
            labor_total: {
                type: Number,
                default: 0
            },
            quotation_notes: {
                type: String,
                default: ""
            },
            sent_at: {
                type: Date
            },
            advance_paid: {
                type: Number,
                default: 0
            }
        },
        booking_advance_paid: {
            type: Number,
            default: 0
        },
        customer_confirmed: {
            type: Boolean,
            default: false
        },
        confirmed_at: {
            type: Date
        },
        // Secure 4-Digit Completion PIN / OTP
        completion_otp: {
            type: String,
            default: ""
        },
        assigned_workers: [
            {
                worker_id: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Worker"
                },
                name: {
                    type: String,
                    default: ""
                },
                phone: {
                    type: String,
                    default: ""
                },
                skills: [
                    {
                        type: String
                    }
                ],
                assigned_days: {
                    type: Number,
                    default: 1
                },
                on_site: {
                    type: Boolean,
                    default: false
                },
                check_in_time: {
                    type: Date
                },
                check_out_time: {
                    type: Date
                },
                current_check_in: {
                    type: Boolean,
                    default: false
                },
                last_check_in_time: {
                    type: Date
                },
                total_worked_seconds: {
                    type: Number,
                    default: 0
                },
                work_sessions: [
                    {
                        check_in_time: { type: Date, required: true },
                        check_out_time: { type: Date },
                        duration_seconds: { type: Number, default: 0 },
                        duration_text: { type: String, default: "" },
                        date: { type: String, default: "" }
                    }
                ]
            }
        ],
        // Worker Replacements & Leave Tracking
        worker_replacements: [
            {
                date: {
                    type: String,
                    required: true
                },
                original_worker_id: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Worker"
                },
                original_worker_name: {
                    type: String,
                    default: ""
                },
                reason: {
                    type: String,
                    default: "Leave / Absence"
                },
                replacement_worker_id: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Worker"
                },
                replacement_worker_name: {
                    type: String,
                    default: ""
                },
                replacement_worker_phone: {
                    type: String,
                    default: ""
                },
                replaced_at: {
                    type: Date,
                    default: Date.now
                },
                customer_notified: {
                    type: Boolean,
                    default: true
                }
            }
        ],
        // Parts used on site: van stock or local hardware-shop purchase
        material_requisitions: [
            {
                item_name: {
                    type: String,
                    required: true,
                    trim: true
                },
                quantity: {
                    type: String,
                    required: true,
                    trim: true
                },
                purpose: {
                    type: String,
                    default: ""
                },
                source: {
                    type: String,
                    enum: ["van_stock", "local_purchase"],
                    default: "van_stock"
                },
                catalog_id: {
                    type: String,
                    default: ""
                },
                shop_name: {
                    type: String,
                    default: ""
                },
                receipt_photo: {
                    type: String,
                    default: ""
                },
                requested_by_worker_id: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Worker"
                },
                requested_by_name: {
                    type: String,
                    default: ""
                },
                requested_at: {
                    type: Date,
                    default: Date.now
                },
                status: {
                    type: String,
                    enum: ["requested", "approved_by_company", "procured", "purchased", "from_stock"],
                    default: "from_stock"
                },
                unit_price: {
                    type: Number,
                    default: 0
                },
                total_cost: {
                    type: Number,
                    default: 0
                }
            }
        ],
        // On-Site Time Tracking
        time_tracking: {
            check_in_time: {
                type: Date
            },
            check_out_time: {
                type: Date
            },
            total_minutes: {
                type: Number,
                default: 0
            }
        },
        daily_updates: [
            {
                day_number: {
                    type: Number,
                    required: true
                },
                date: {
                    type: String,
                    required: true
                },
                title: {
                    type: String,
                    default: "Work in Progress"
                },
                work_done: {
                    type: String,
                    required: true
                },
                photo: {
                    type: String,
                    default: ""
                },
                logged_by_worker_id: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Worker"
                },
                logged_by_worker_name: {
                    type: String,
                    default: ""
                },
                updated_at: {
                    type: Date,
                    default: Date.now
                },
                customer_response: {
                    has_complaint: {
                        type: Boolean,
                        default: false
                    },
                    complaint_text: {
                        type: String,
                        default: ""
                    },
                    responded_at: {
                        type: Date
                    }
                }
            }
        ],
        // Dual-Signoff Work Submission
        after_photos: [
            {
                type: String
            }
        ],
        work_submitted_at: {
            type: Date
        },
        customer_signed_off: {
            type: Boolean,
            default: false
        },
        customer_signed_off_at: {
            type: Date
        },
        rework_requested: {
            type: Boolean,
            default: false
        },
        rework_notes: {
            type: String,
            default: ""
        },
        // Granular Itemized Bill (Cement, PVC pipes, Putty, Labor lines)
        invoice: {
            invoice_number: {
                type: String,
                default: ""
            },
            materials_items: [
                {
                    item_name: { type: String, required: true },
                    quantity: { type: String, required: true },
                    unit_price: { type: Number, required: true, default: 0 },
                    total_price: { type: Number, required: true, default: 0 }
                }
            ],
            materials_total: {
                type: Number,
                default: 0
            },
            labor_items: [
                {
                    worker_name: { type: String, required: true },
                    role: { type: String, default: "Technician" },
                    days: { type: Number, default: 1 },
                    daily_rate: { type: Number, default: 0 },
                    total_labor: { type: Number, default: 0 }
                }
            ],
            labor_total: {
                type: Number,
                default: 0
            },
            tax_or_other: {
                type: Number,
                default: 0
            },
            total_amount: {
                type: Number,
                default: 0
            },
            notes: {
                type: String,
                default: ""
            },
            generated_at: {
                type: Date
            },
            payment_status: {
                type: String,
                enum: ["unpaid", "paid"],
                default: "unpaid"
            },
            paid_at: {
                type: Date
            }
        },
        // Separate Customer Reviews: Worker vs Company
        worker_review: {
            rating: {
                type: Number,
                min: 1,
                max: 5
            },
            punctuality: {
                type: Number,
                default: 5
            },
            craftsmanship: {
                type: Number,
                default: 5
            },
            comment: {
                type: String,
                default: ""
            },
            submitted_at: {
                type: Date
            }
        },
        company_review: {
            rating: {
                type: Number,
                min: 1,
                max: 5
            },
            pricing: {
                type: Number,
                default: 5
            },
            communication: {
                type: Number,
                default: 5
            },
            comment: {
                type: String,
                default: ""
            },
            submitted_at: {
                type: Date
            }
        },
        product_review: {
            rating: {
                type: Number,
                min: 1,
                max: 5
            },
            comment: {
                type: String,
                default: ""
            },
            submitted_at: {
                type: Date
            }
        },
        complaint: {
            has_complaint: {
                type: Boolean,
                default: false
            },
            text: {
                type: String,
                default: ""
            },
            about: {
                type: String,
                enum: ["none", "worker", "company", "product", "other"],
                default: "none"
            }
        },
        would_recommend: {
            type: Boolean,
            default: true
        },
        review: {
            rating: {
                type: Number,
                min: 1,
                max: 5
            },
            comment: {
                type: String,
                default: ""
            },
            submitted_at: {
                type: Date
            }
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("ServiceRequest", serviceRequestSchema);
