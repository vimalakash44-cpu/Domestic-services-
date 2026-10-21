const mongoose = require("mongoose");

const paymentRequestSchema = new mongoose.Schema(
    {
        service_request_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ServiceRequest",
            required: true
        },
        customer_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        company_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Company",
            required: true
        },
        amount: {
            type: Number,
            required: true
        },
        description: {
            type: String,
            required: true
        },
        payment_type: {
            type: String,
            enum: ["booking_advance", "material_purchase", "milestone_payment"],
            required: true
        },
        status: {
            type: String,
            enum: ["pending", "paid", "cancelled"],
            default: "pending"
        },
        paid_at: {
            type: Date
        },
        wallet_transaction_id: {
            type: mongoose.Schema.Types.ObjectId
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("PaymentRequest", paymentRequestSchema);
