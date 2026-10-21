const mongoose = require("mongoose");

const companySchema = new mongoose.Schema(
    {
        user_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true
        },
        company_name: {
            type: String,
            required: true,
            trim: true
        },
        owner_name: {
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
            required: true,
            lowercase: true,
            trim: true
        },
        address: {
            type: String,
            required: true,
            trim: true
        },
        city: {
            type: String,
            required: true,
            trim: true
        },
        experience: {
            type: Number,
            required: true,
            min: 0
        },
        total_workers: {
            type: Number,
            required: true,
            min: 1
        },
        services: [
            {
                type: String,
                trim: true
            }
        ],
        description: {
            type: String,
            required: true,
            trim: true
        },
        verification_document: {
            file_id: {
                type: mongoose.Schema.Types.ObjectId,
                required: true
            },
            filename: {
                type: String,
                required: true
            },
            content_type: {
                type: String,
                required: true
            }
        },
        verification_status: {
            type: String,
            enum: ["pending","approved","rejected"],
            default: "pending"
        },
        rejection_reason: {
            type: String,
            default: ""
        },
        rating: {
            type: Number,
            default: 5,
            min: 0,
            max: 5
        },
        product_rating: {
            type: Number,
            default: 5,
            min: 0,
            max: 5
        },
        total_reviews: {
            type: Number,
            default: 0
        },
        review_count: {
            type: Number,
            default: 0
        },
        reviews: [
            {
                customer_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
                customer_name: { type: String, default: "Customer" },
                rating: { type: Number, required: true },
                comment: { type: String, default: "" },
                pricing_rating: { type: Number, default: 5 },
                communication_rating: { type: Number, default: 5 },
                product_rating: { type: Number, default: 5 },
                complaint: { type: String, default: "" },
                would_recommend: { type: Boolean, default: true },
                service: { type: String, default: "" },
                request_id: { type: mongoose.Schema.Types.ObjectId, ref: "ServiceRequest" },
                created_at: { type: Date, default: Date.now }
            }
        ],
        company_complaints: [
            {
                customer_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
                customer_name: { type: String, default: "Customer" },
                customer_phone: { type: String, default: "Not provided" },
                worker_name: { type: String, default: "" },
                worker_phone: { type: String, default: "" },
                text: { type: String, required: true },
                service: { type: String, default: "" },
                request_id: { type: mongoose.Schema.Types.ObjectId, ref: "ServiceRequest" },
                created_at: { type: Date, default: Date.now },
                status: { type: String, enum: ["pending", "reviewed", "resolved"], default: "pending" }
            }
        ]
    },
    {
        timestamps: true
    }
);
module.exports =mongoose.model("Company", companySchema);