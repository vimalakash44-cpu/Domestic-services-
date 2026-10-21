const mongoose = require("mongoose");
const workerSchema = new mongoose.Schema(
    {
        company_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Company",
            required: true
        },

        name: {
            type: String,
            required: true,
            trim: true
        },

        phone: {
            type: String,
            required: true,
            trim: true
        },

        email: {
            type: String,
            default: "",
            trim: true
        },

        experience: {
            type: Number,
            default: 0
        },

        skills: {
            type: [String],
            required: true
        },

        password: {
            type: String,
            default: ""
        },

        initial_password: {
            type: String,
            default: "worker123"
        },

        rating: {
            type: Number,
            default: 5,
            min: 0,
            max: 5
        },

        rating_count: {
            type: Number,
            default: 0
        },

        reviews: [
            {
                customer_id: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User"
                },
                customer_name: {
                    type: String,
                    default: "Customer"
                },
                rating: {
                    type: Number,
                    required: true
                },
                comment: {
                    type: String,
                    default: ""
                },
                punctuality: {
                    type: Number,
                    default: 5
                },
                craftsmanship: {
                    type: Number,
                    default: 5
                },
                complaint: {
                    type: String,
                    default: ""
                },
                service: {
                    type: String,
                    default: ""
                },
                request_id: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "ServiceRequest"
                },
                created_at: {
                    type: Date,
                    default: Date.now
                }
            }
        ],

        complaints: [
            {
                customer_name: { type: String, default: "Customer" },
                customer_phone: { type: String, default: "Not provided" },
                text: { type: String, required: true },
                about: {
                    type: String,
                    enum: ["worker", "company", "product", "other"],
                    default: "worker"
                },
                service: { type: String, default: "" },
                request_id: { type: mongoose.Schema.Types.ObjectId, ref: "ServiceRequest" },
                created_at: { type: Date, default: Date.now }
            }
        ],

        leave_records: [
            {
                date: {
                    type: String,
                    required: true
                },
                reason: {
                    type: String,
                    default: "Personal / Medical Leave"
                },
                status: {
                    type: String,
                    enum: ["pending", "approved", "rejected"],
                    default: "approved"
                },
                requested_at: {
                    type: Date,
                    default: Date.now
                }
            }
        ],

        availability: [
            {
                date: {
                    type: String,
                    required: true
                },

                status: {
                    type: String,
                    enum: [
                        "available",
                        "busy",
                        "wants_work",
                        "on_leave"
                    ],
                    default: "available"
                },

                booking_id: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Booking",
                    default: null
                }
            }
        ]
    },
    {
        timestamps: true
    }
);
module.exports = mongoose.model("Worker", workerSchema);