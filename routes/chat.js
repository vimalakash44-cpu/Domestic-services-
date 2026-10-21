const express = require("express");
const Company = require("../models/Company");
const User = require("../models/User");
const ChatMessage = require("../models/ChatMessage");
const ServiceRequest = require("../models/ServiceRequest");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Get list of approved companies for customer chat
router.get("/companies", authMiddleware, async (req, res) => {
    try {
        const companies = await Company.find({ verification_status: "approved" })
            .select("company_name owner_name email phone city address experience total_workers services description rating product_rating review_count total_reviews")
            .lean();

        // Attach last message snippet and unread count for current customer
        const customerId = req.user.id;
        const result = await Promise.all(
            companies.map(async (comp) => {
                const lastMsg = await ChatMessage.findOne({
                    customer_id: customerId,
                    company_id: comp._id
                }).sort({ createdAt: -1 });

                const unreadCount = await ChatMessage.countDocuments({
                    customer_id: customerId,
                    company_id: comp._id,
                    sender_role: { $in: ["company", "bot"] },
                    read: false
                });

                return {
                    ...comp,
                    last_message: lastMsg ? lastMsg.message : null,
                    last_message_time: lastMsg ? lastMsg.createdAt : null,
                    unread_count: unreadCount
                };
            })
        );

        res.json({
            success: true,
            companies: result
        });
    } catch (error) {
        console.error("Get chat companies error:", error);
        res.status(500).json({
            success: false,
            message: "Unable to load companies for chat."
        });
    }
});

// Get chat history between customer and selected company
router.get("/history/:companyId", authMiddleware, async (req, res) => {
    try {
        const customerId = req.user.id;
        const companyId = req.params.companyId;

        const company = await Company.findById(companyId);
        if (!company) {
            return res.status(404).json({
                success: false,
                message: "Company not found."
            });
        }

        const messages = await ChatMessage.find({
            customer_id: customerId,
            company_id: companyId
        }).sort({ createdAt: 1 });

        // Mark incoming messages as read
        await ChatMessage.updateMany(
            {
                customer_id: customerId,
                company_id: companyId,
                sender_role: { $in: ["company", "bot"] },
                read: false
            },
            { $set: { read: true } }
        );

        // Fetch active request between customer and company if any
        const activeRequest = await ServiceRequest.findOne({
            customer_id: customerId,
            company_id: companyId
        }).sort({ createdAt: -1 });

        res.json({
            success: true,
            company,
            active_request: activeRequest,
            messages
        });
    } catch (error) {
        console.error("Get chat history error:", error);
        res.status(500).json({
            success: false,
            message: "Unable to load chat history."
        });
    }
});

// Customer sends message to company (with intelligent chatbot response engine)
router.post("/send", authMiddleware, async (req, res) => {
    try {
        const customerId = req.user.id;
        const { company_id, message } = req.body;

        if (!company_id || !message || !message.trim()) {
            return res.status(400).json({
                success: false,
                message: "Company ID and message content are required."
            });
        }

        const customer = await User.findById(customerId);
        const company = await Company.findById(company_id);

        if (!company) {
            return res.status(404).json({
                success: false,
                message: "Company not found."
            });
        }

        const trimmedMsg = message.trim();

        // 1. Save customer's message
        const userMsg = new ChatMessage({
            customer_id: customerId,
            company_id: company._id,
            sender_id: customerId,
            sender_role: "customer",
            sender_name: customer ? customer.name : "Customer",
            message: trimmedMsg,
            msg_type: "text"
        });
        await userMsg.save();

        // 2. Intelligent Chatbot Analysis & Contextual Response
        const lower = trimmedMsg.toLowerCase();
        let botReplyText = "";
        let botMsgType = "text";
        let botMetadata = null;

        // Fetch latest service request to inform the customer
        const latestRequest = await ServiceRequest.findOne({
            customer_id: customerId,
            company_id: company._id
        }).sort({ createdAt: -1 });

        if (lower.includes("service") || lower.includes("offer") || lower.includes("what do you do") || lower.includes("options")) {
            const serviceList = Array.isArray(company.services) && company.services.length > 0
                ? company.services.join(", ")
                : "General Domestic Maintenance & Repair";
            botReplyText = `🛠️ At ${company.company_name}, we specialize in: ${serviceList}. All jobs are backed by our verified guarantee and ${company.experience} years of hands-on experience! Would you like to request a quotation for one of these services?`;
        } else if (lower.includes("worker") || lower.includes("team") || lower.includes("staff") || lower.includes("technician")) {
            botReplyText = `👷 We maintain a certified workforce of ${company.total_workers || 5}+ vetted technicians. Once you approve a service quotation, we immediately allocate dedicated workers and provide you their contact numbers and skill profiles!`;
        } else if (lower.includes("price") || lower.includes("cost") || lower.includes("rate") || lower.includes("quote") || lower.includes("how much") || lower.includes("charge")) {
            botReplyText = `💰 Our pricing is transparent and based on damage analysis! To get an accurate quote, simply click the "📸 Request Quote / Upload Photo" button. Our team will review the photos and send you a formal quotation with worker requirements, duration, and exact cost!`;
        } else if (lower.includes("location") || lower.includes("address") || lower.includes("where") || lower.includes("city")) {
            botReplyText = `📍 We are based in ${company.city || "your city"}. Main Office: ${company.address || "Main Center"}. We send technicians directly to your doorstep!`;
        } else if (lower.includes("contact") || lower.includes("phone") || lower.includes("call") || lower.includes("email") || lower.includes("number")) {
            botReplyText = `📞 You can reach ${company.company_name} at: Phone: ${company.phone} | Email: ${company.email} | Owner/Manager: ${company.owner_name}.`;
        } else if (lower.includes("status") || lower.includes("update") || lower.includes("tracking") || lower.includes("my request")) {
            if (!latestRequest) {
                botReplyText = `You haven't submitted any service requests to ${company.company_name} yet. Click "📸 Request Quote" to upload photos of your repair needs!`;
            } else if (latestRequest.status === "requested") {
                botReplyText = `⏳ Status Update: Your request for "${latestRequest.service}" is currently being analyzed by our technicians. A quotation with worker count and estimated cost will be sent shortly!`;
            } else if (latestRequest.status === "quoted") {
                botReplyText = `📋 Your Quotation is Ready! Estimated Cost: $${latestRequest.quotation.estimated_cost} for ${latestRequest.quotation.workers_needed} worker(s) over ~${latestRequest.quotation.estimated_days} day(s). Please click "Confirm Quotation" to proceed!`;
            } else if (latestRequest.status === "confirmed") {
                botReplyText = `✅ Your quotation is confirmed! We are in the process of assigning certified workers for your project.`;
            } else if (latestRequest.status === "workers_assigned") {
                const names = latestRequest.assigned_workers.map(w => w.name).join(", ");
                botReplyText = `👷 Workers Allocated! The following technician(s) are assigned: ${names}. They are preparing the work schedule.`;
            } else if (latestRequest.status === "in_progress") {
                botReplyText = `🔨 Work is currently In Progress! Check the daily activity log in 'My Requests' to see the latest progress updates and photos.`;
            } else if (latestRequest.status === "completed") {
                botReplyText = `🎉 Work has been completed! Total Bill: $${latestRequest.invoice.total_amount || 0}. Please review and finalize payment.`;
            }
        } else if (lower.includes("hi") || lower.includes("hello") || lower.includes("hey") || lower.includes("start")) {
            botReplyText = `👋 Hello ${customer ? customer.name : "there"}! Welcome to ${company.company_name}'s live assistance. How can we help you today? You can ask about our services, worker team, pricing estimates, or click "📸 Request Quote" to upload damage photos for an instant assessment!`;
        } else {
            botReplyText = `Thank you for your message! ${company.company_name}'s team has received your message: "${trimmedMsg}". Our staff has been alerted and will respond shortly. If this is urgent, please call us directly at ${company.phone}.`;
        }

        // 3. Save Bot Response
        const botMsg = new ChatMessage({
            customer_id: customerId,
            company_id: company._id,
            sender_role: "bot",
            sender_name: `${company.company_name} Assistant`,
            message: botReplyText,
            msg_type: botMsgType,
            metadata: botMetadata
        });
        await botMsg.save();

        res.json({
            success: true,
            user_message: userMsg,
            bot_reply: botMsg
        });
    } catch (error) {
        console.error("Chat send error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to send message."
        });
    }
});

// Company fetches all customer chat conversations
router.get("/company/conversations", authMiddleware, async (req, res) => {
    try {
        const company = await Company.findOne({ user_id: req.user.id });
        if (!company) {
            return res.status(404).json({
                success: false,
                message: "Company profile not found."
            });
        }

        // Get unique customer IDs who chatted with this company
        const customerIds = await ChatMessage.distinct("customer_id", {
            company_id: company._id
        });

        const conversations = await Promise.all(
            customerIds.map(async (cId) => {
                const customer = await User.findById(cId).select("name email phone");
                const lastMsg = await ChatMessage.findOne({
                    company_id: company._id,
                    customer_id: cId
                }).sort({ createdAt: -1 });

                const unreadCount = await ChatMessage.countDocuments({
                    company_id: company._id,
                    customer_id: cId,
                    sender_role: "customer",
                    read: false
                });

                const latestRequest = await ServiceRequest.findOne({
                    company_id: company._id,
                    customer_id: cId
                }).sort({ createdAt: -1 });

                return {
                    customer_id: cId,
                    customer_name: customer ? customer.name : "Customer",
                    customer_email: customer ? customer.email : "",
                    customer_phone: customer ? customer.phone : "",
                    last_message: lastMsg ? lastMsg.message : "",
                    last_message_time: lastMsg ? lastMsg.createdAt : null,
                    unread_count: unreadCount,
                    latest_request: latestRequest ? {
                        _id: latestRequest._id,
                        service: latestRequest.service,
                        status: latestRequest.status
                    } : null
                };
            })
        );

        conversations.sort((a, b) => new Date(b.last_message_time || 0) - new Date(a.last_message_time || 0));

        res.json({
            success: true,
            conversations
        });
    } catch (error) {
        console.error("Get company conversations error:", error);
        res.status(500).json({
            success: false,
            message: "Unable to load conversations."
        });
    }
});

// Company fetches message history with a specific customer
router.get("/company/history/:customerId", authMiddleware, async (req, res) => {
    try {
        const company = await Company.findOne({ user_id: req.user.id });
        if (!company) {
            return res.status(404).json({
                success: false,
                message: "Company profile not found."
            });
        }

        const customerId = req.params.customerId;
        const customer = await User.findById(customerId).select("name email phone");

        const messages = await ChatMessage.find({
            company_id: company._id,
            customer_id: customerId
        }).sort({ createdAt: 1 });

        // Mark customer messages as read
        await ChatMessage.updateMany(
            {
                company_id: company._id,
                customer_id: customerId,
                sender_role: "customer",
                read: false
            },
            { $set: { read: true } }
        );

        const requests = await ServiceRequest.find({
            company_id: company._id,
            customer_id: customerId
        }).sort({ createdAt: -1 });

        res.json({
            success: true,
            customer,
            company,
            requests,
            messages
        });
    } catch (error) {
        console.error("Get company customer history error:", error);
        res.status(500).json({
            success: false,
            message: "Unable to load chat history."
        });
    }
});

// Company replies directly to customer
router.post("/company/reply", authMiddleware, async (req, res) => {
    try {
        const company = await Company.findOne({ user_id: req.user.id });
        if (!company) {
            return res.status(404).json({
                success: false,
                message: "Company profile not found."
            });
        }

        const { customer_id, message } = req.body;

        if (!customer_id || !message || !message.trim()) {
            return res.status(400).json({
                success: false,
                message: "Customer ID and message are required."
            });
        }

        const replyMsg = new ChatMessage({
            customer_id,
            company_id: company._id,
            sender_id: req.user.id,
            sender_role: "company",
            sender_name: company.company_name,
            message: message.trim(),
            msg_type: "text"
        });
        await replyMsg.save();

        res.json({
            success: true,
            message: "Reply sent successfully.",
            chat_message: replyMsg
        });
    } catch (error) {
        console.error("Company reply error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to send reply."
        });
    }
});

// Company deletes chat history with a specific customer
router.delete("/company/delete/:customerId", authMiddleware, async (req, res) => {
    try {
        const company = await Company.findOne({ user_id: req.user.id });
        if (!company) {
            return res.status(404).json({
                success: false,
                message: "Company profile not found."
            });
        }

        const customerId = req.params.customerId;

        const result = await ChatMessage.deleteMany({
            company_id: company._id,
            customer_id: customerId
        });

        res.json({
            success: true,
            message: `Deleted ${result.deletedCount} chat messages.`
        });
    } catch (error) {
        console.error("Delete company chat history error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete chat history."
        });
    }
});

// Customer deletes chat conversation with a specific company
router.delete("/history/:companyId", authMiddleware, async (req, res) => {
    try {
        const customerId = req.user.id;
        const companyId = req.params.companyId;

        const result = await ChatMessage.deleteMany({
            customer_id: customerId,
            company_id: companyId
        });

        res.json({
            success: true,
            message: `Deleted ${result.deletedCount} chat messages.`
        });
    } catch (error) {
        console.error("Delete customer chat history error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete chat history."
        });
    }
});

// Delete single chat message
router.delete("/message/:id", authMiddleware, async (req, res) => {
    try {
        const msg = await ChatMessage.findById(req.params.id);
        if (!msg) {
            return res.status(404).json({ success: false, message: "Message not found." });
        }

        // Only sender or receiver can delete
        const isCustomer = String(msg.customer_id) === String(req.user.id);
        const company = await Company.findOne({ user_id: req.user.id });
        const isCompany = company && String(msg.company_id) === String(company._id);

        if (!isCustomer && !isCompany) {
            return res.status(403).json({ success: false, message: "Unauthorized to delete this message." });
        }

        await ChatMessage.deleteOne({ _id: msg._id });

        res.json({ success: true, message: "Message deleted successfully." });
    } catch (error) {
        console.error("Delete message error:", error);
        res.status(500).json({ success: false, message: "Failed to delete message." });
    }
});

module.exports = router;
