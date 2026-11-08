const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', (req, res) => {
    res.send('FAFA Clothing Backend is running successfully!');
});

const TELEGRAM_BOT_TOKEN = '9071654545:AAG6Ur9Nt2k-TQiEhlPu65Ib1gbmdh-7sgs';
const TELEGRAM_CHAT_ID = '7488093549';

let ordersDatabase = {};

// API ទទួលការបញ្ជាទិញ និងរក្សាទុកទិន្នន័យ
app.post('/api/create-order', async (req, res) => {
    try {
        let { orderId, amount, phone, address, shippingFee, cart } = req.body;
        let parsedCart = typeof cart === 'string' ? JSON.parse(cart) : cart;

        ordersDatabase[orderId] = {
            orderId,
            amount,
            phone,
            address,
            shippingFee,
            cart: parsedCart,
            status: 'PENDING'
        };

        // ផ្ដល់ព័ត៌មានគណនី ABA ផ្ទាល់ខ្លួនត្រឡប់ទៅ Frontend ដើម្បីបង្កើត QR Code
        res.json({
            success: true,
            tran_id: orderId,
            accountName: 'SRY VANDY',
            accountNumber: '500258373',
            amount: amount
        });

    } catch (error) {
        console.error("Server Error:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});

// API បញ្ជាក់ការបង់ប្រាក់ និងផ្ញើសារចូល Telegram របស់អ្នក
app.post('/api/confirm-payment', async (req, res) => {
    try {
        const { tran_id } = req.body;

        if (ordersDatabase[tran_id]) {
            ordersDatabase[tran_id].status = 'PAID';
            let orderInfo = ordersDatabase[tran_id];

            let orderText = "🎉 *ការបញ្ជាទិញថ្មី (បង់ប្រាក់រួចរាល់)!*\n\n";
            orderInfo.cart.forEach((item, index) => {
                orderText += `${index + 1}. ${item.name} ($${item.price} x ${item.quantity})\n`;
            });
            
            orderText += `\n📦 *សេវាដឹកជញ្ជូន:* $${orderInfo.shippingFee}`;
            orderText += `\n📞 *លេខទូរសព្ទ:* ${orderInfo.phone}`;
            orderText += `\n📍 *ទីតាំង:* ${orderInfo.address}`;
            orderText += `\n💰 *ទឹកប្រាក់សរុប:* **$${orderInfo.amount}**`;
            orderText += `\n🏦 *គណនី ABA:* SRY VANDY (500258373)`;
            orderText += `\n✅ *ស្ថានភាព:* អតិថិជនបានបញ្ជាក់ការបង់ប្រាក់`;

            await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                chat_id: TELEGRAM_CHAT_ID,
                text: orderText,
                parse_mode: 'Markdown'
            });

            return res.json({ success: true });
        }

        res.json({ success: false, message: 'Order not found' });
    } catch (error) {
        console.error("Confirmation Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
