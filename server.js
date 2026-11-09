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

let products = [
    { id: 1, name: "អាវយឺត FREE SIZE", price: 3.75, stock: 1, image: "https://i.postimg.cc/0NrGyrGt/858535232-122143330293104345-8003998162307616562-n.jpg" },
    { id: 2, name: "អាវយឺត FREE SIZE", price: 3.75, stock: 1, image: "https://i.postimg.cc/HkY4F6rY/858998600-122143328523104345-9154920380344446311-n.jpg" },
    { id: 3, name: "អាវយឺត FREE SIZE", price: 3.75, stock: 1, image: "https://i.postimg.cc/T1R3T7By/859090829-122143330215104345-4641336911256672944-n.jpg" },
    { id: 4, name: "អាវយឺត FREE SIZE", price: 3.75, stock: 1, image: "https://i.postimg.cc/k4CnyYJL/859396177-122143328499104345-4898313489564552661-n.jpg" },
    { id: 5, name: "អាវយឺត FREE SIZE", price: 3.75, stock: 1, image: "https://i.postimg.cc/kG1qqnQn/859396179-122143328535104345-7526329722242687048-n.jpg" },
    { id: 6, name: "អាវយឺត FREE SIZE", price: 3.75, stock: 1, image: "https://i.postimg.cc/sXKR4V0f/859784793-122143328547104345-5525957976114747478-n.jpg" },
    { id: 7, name: "អាវយឺត FREE SIZE", price: 3.75, stock: 1, image: "https://i.postimg.cc/brJf6KKV/859980286-122143330197104345-5978106523108566575-n.jpg" },
    { id: 8, name: "អាវយឺត FREE SIZE", price: 3.75, stock: 1, image: "https://i.postimg.cc/XqzStsWV/863325406-122143330281104345-4670333600097983632-n.jpg" }
];

let ordersDatabase = {};

app.get('/api/products', (req, res) => {
    res.json(products);
});

app.post('/api/create-order', async (req, res) => {
    try {
        let { orderId, amount, name, phone, address, shippingFee, shippingName, cart } = req.body;
        let parsedCart = typeof cart === 'string' ? JSON.parse(cart) : cart;

        ordersDatabase[orderId] = {
            orderId,
            amount,
            name,          
            phone,
            address,
            shippingFee,
            shippingName,  
            cart: parsedCart,
            status: 'PENDING'
        };

        res.json({
            success: true,
            tran_id: orderId,
            amount: amount
        });

    } catch (error) {
        console.error("Server Error:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/confirm-payment', async (req, res) => {
    try {
        const { tran_id } = req.body;

        if (ordersDatabase[tran_id]) {
            ordersDatabase[tran_id].status = 'PAID';
            let orderInfo = ordersDatabase[tran_id];

            orderInfo.cart.forEach(cartItem => {
                let product = products.find(p => p.id === cartItem.id);
                if (product) {
                    product.stock = Math.max(0, product.stock - cartItem.quantity);
                }
            });

            let orderText = "🎉 *ការបញ្ជាទិញថ្មី (បង់ប្រាក់រួចរាល់)!*\n\n";
            // 🟢 បន្ថែមការបង្ហាញលេខកូដបញ្ជាទិញ (Order ID) ត្រង់នេះ
            orderText += `📦 *កូដបញ្ជាទិញ:* \`${orderInfo.orderId}\`\n\n`;

            orderInfo.cart.forEach((item, index) => {
                orderText += `${index + 1}. ${item.name} ($${item.price} x ${item.quantity})\n`;
            });
            
            orderText += `\n👤 *ឈ្មោះអ្នកទិញ:* ${orderInfo.name || 'មិនមានឈ្មោះ'}`;
            orderText += `\n📞 *លេខទូរសព្ទ:* ${orderInfo.phone}`;
            orderText += `\n📍 *ទីតាំង:* ${orderInfo.address}`;
            orderText += `\n🚚 *សេវាដឹកជញ្ជូន:* ${orderInfo.shippingName} ($${orderInfo.shippingFee})`;
            orderText += `\n💰 *ទឹកប្រាក់សរុប:* **$${orderInfo.amount}**`;
            orderText += `\n🏦 *គណនី ABA:* SRY VANDY (500258373)`;
            orderText += `\n✅ *ស្ថានភាព:* អតិថិជនបានបញ្ជាក់ការបង់ប្រាក់ (កាត់ស្តុកជោគជ័យ)`;

            await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                chat_id: TELEGRAM_CHAT_ID,
                text: orderText,
                parse_mode: 'Markdown'
            });

            return res.json({ success: true, products });
        }

        res.json({ success: false, message: 'Order not found' });
    } catch (error) {
        console.error("Confirmation Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
