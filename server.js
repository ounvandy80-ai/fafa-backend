const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cors = require('cors');
const crypto = require('crypto');

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 🟢 Test Route សម្រាប់ពិនិត្យមើលថា Server ដំណើរការ
app.get('/', (req, res) => {
    res.send('FAFA Clothing Backend is running successfully!');
});

// 🟢 ព័ត៌មាន ABA PayWay Sandbox Credentials
const PAYWAY_MERCHANT_ID = 'ec480288';
const PAYWAY_API_KEY = 'D6A95A5622C6F2650D474712EA8294DA4130A7FE';
const PAYWAY_API_URL = 'https://checkout-sandbox.payway.com.kh/api/payment-gateway/v1/payments/purchase';

// ព័ត៌មាន Telegram Bot
const TELEGRAM_BOT_TOKEN = '9071654545:AAG6Ur9Nt2k-TQiEhlPu65Ib1gbmdh-7sgs';
const TELEGRAM_CHAT_ID = '7488093549';

let ordersDatabase = {};

function createHash(merchant_id, tran_id, amount, req_time, api_key) {
    const str = merchant_id + tran_id + amount + req_time;
    return crypto.createHmac('sha512', api_key).update(str).digest('base64');
}

// 1️⃣ API សម្រាប់បង្កើត Checkout URL ផ្ញើឱ្យ Frontend
app.post('/api/create-order', async (req, res) => {
    try {
        const { orderId, amount, phone, address, shippingFee, cart } = req.body;
        
        ordersDatabase[orderId] = {
            orderId,
            amount,
            phone,
            address,
            shippingFee,
            cart,
            status: 'PENDING'
        };

        const req_time = Math.floor(Date.now() / 1000).toString();
        const hash = createHash(PAYWAY_MERCHANT_ID, orderId, amount, req_time, PAYWAY_API_KEY);

        // បង្កើត Checkout URL សម្រាប់ Redirect ទៅកាន់ ABA
        const checkoutUrl = `${PAYWAY_API_URL}?merchant_id=${PAYWAY_MERCHANT_ID}&req_time=${req_time}&tran_id=${orderId}&amount=${amount}&hash=${encodeURIComponent(hash)}`;

        res.json({ 
            success: true, 
            message: "Checkout URL generated successfully", 
            orderId,
            checkoutUrl: checkoutUrl 
        });

    } catch (error) {
        console.error("Server Error:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 2️⃣ ABA PayWay Webhook Endpoint
app.post('/api/payway-webhook', async (req, res) => {
    try {
        const { tran_id, status } = req.body;

        if (ordersDatabase[tran_id] && (status === '0' || status === 'success')) {
            ordersDatabase[tran_id].status = 'PAID';
            let orderInfo = ordersDatabase[tran_id];

            let orderText = "🎉 *ការបញ្ជាទិញ និងទូទាត់ប្រាក់ជោគជ័យតាម ABA!*\n\n";
            orderInfo.cart.forEach((item, index) => {
                orderText += `${index + 1}. ${item.name} ($${item.price} x ${item.quantity})\n`;
            });
            
            orderText += `\n📦 *សេវាដឹកជញ្ជូន:* $${orderInfo.shippingFee}`;
            orderText += `\n📞 *លេខទូរសព្ទ:* ${orderInfo.phone}`;
            orderText += `\n📍 *ទីតាំង:* ${orderInfo.address}`;
            orderText += `\n💰 *ទឹកប្រាក់បានបង់សរុប:* **$${orderInfo.amount}**`;
            orderText += `\n✅ *ស្ថានភាព:* បង់ប្រាក់ជោគជ័យ (ABA Sandbox Verified)`;

            await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                chat_id: TELEGRAM_CHAT_ID,
                text: orderText,
                parse_mode: 'Markdown'
            });
        }

        res.json({ status: 'success' });
    } catch (error) {
        console.error("Webhook Error:", error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
