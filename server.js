const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const MONGO_URI = "mongodb+srv://ounvandy80_db_user:Ounvandy25012003@cluster0.v5i9ayl.mongodb.net/fafa_shop?retryWrites=true&w=majority";

mongoose.connect(MONGO_URI)
    .then(() => console.log('Connected to MongoDB Atlas successfully!'))
    .catch(err => console.error('MongoDB connection error:', err));

const productSchema = new mongoose.Schema({
    id: Number,
    name: String,
    price: Number,
    stock: Number,
    image: String,
    colors: Array
});
const Product = mongoose.model('Product', productSchema);

const orderSchema = new mongoose.Schema({
    telegramId: String,
    orderId: String,
    amount: Number,
    name: String,
    phone: String,
    address: String,
    location: Object, // 📍 រក្សាទុកទីតាំង GPS (Latitude, Longitude)
    shippingFee: Number,
    shippingName: String,
    cart: Array,
    status: String, 
    date: String
});
const Order = mongoose.model('Order', orderSchema);

// 👤 Schema សម្រាប់គ្រប់គ្រង User និងสถานະ Block
const userSchema = new mongoose.Schema({
    telegramId: String,
    name: String,
    phone: String,
    isBlocked: { type: Boolean, default: false },
    lastActive: String
});
const User = mongoose.model('User', userSchema);

// 💬 Schema សម្រាប់រក្សាទុកសារសន្ទនា Omnichannel Chat (FB & Telegram)
const chatMessageSchema = new mongoose.Schema({
    platform: String, // 'facebook' ឬ 'telegram'
    userId: String,   // PSID របស់ FB ឬ Chat ID របស់ Telegram
    name: String,     // ឈ្មោះអតិថិជន
    messages: [{
        sender: String, // 'user' ឬ 'admin'
        text: String,
        time: String
    }],
    lastTime: String
});
const ChatConversation = mongoose.model('ChatConversation', chatMessageSchema);

app.get('/', (req, res) => {
    res.send('FAFA Clothing Backend with Advanced Admin features is running!');
});

const TELEGRAM_BOT_TOKEN = '9071654545:AAG6Ur9Nt2k-TQiEhlPu65Ib1gbmdh-7sgs';
const TELEGRAM_CHAT_ID = '7488093549';

// ⚙️ Facebook Messenger Configuration
const FB_PAGE_ACCESS_TOKEN = 'EAAYLrrD3aaMBS1AR7WqLJ8GE6WC8ZCFO6xLZC3eOZA9bi4PhOO4WUSi4iXcmdZCksYm64j4TegfH6QR3uVRJJORH5ZCGYXzyqj6FEFn1ZC3IDqarDxmHJfGuCVYPYPyxYI0wq9mVs2WekpnzEV9ZCmdc9HUpp8Od8SbdHiWyTB6k8OvVO8GlXSz5YvkVbVZB7eMWOjwyZBzZAOtwZDZD';
const FB_VERIFY_TOKEN = 'fafa_clothing_verify_token_123';

app.get('/api/products', async (req, res) => {
    try {
        let products = await Product.find({});
        res.json(products);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 🟢 ពិនិត្យសិទ្ធិ User ពេលបើក App និងាប់យករបាយការណ៍ Online
app.post('/api/user/ping', async (req, res) => {
    try {
        let { telegramId, name, phone } = req.body;
        if (!telegramId) return res.json({ success: false });

        let user = await User.findOne({ telegramId });
        if (!user) {
            user = new User({ telegramId, name: name || 'Guest', phone: phone || '', isBlocked: false, lastActive: new Date() });
        } else {
            user.lastActive = new Date();
            if (name) user.name = name;
            if (phone) user.phone = phone;
        }
        await user.save();

        res.json({ success: true, isBlocked: user.isBlocked });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/create-order', async (req, res) => {
    try {
        let { telegramId, orderId, amount, name, phone, address, location, shippingFee, shippingName, cart } = req.body;
        
        let userCheck = await User.findOne({ telegramId });
        if (userCheck && userCheck.isBlocked) {
            return res.status(403).json({ success: false, message: 'គណនីរបស់អ្នកត្រូវបានបិទសិទ្ធិ (Blocked) មិនអាចបញ្ជាទិញได้ទេ!' });
        }

        let parsedCart = typeof cart === 'string' ? JSON.parse(cart) : cart;

        let newOrder = new Order({
            telegramId: telegramId || 'guest',
            orderId,
            amount,
            name,          
            phone,
            address,
            location: location || null,
            shippingFee,
            shippingName,  
            cart: parsedCart,
            status: 'PENDING',
            date: new Date().toLocaleString('en-GB')
        });

        await newOrder.save();
        res.json({ success: true, tran_id: orderId, amount: amount });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/orders/:telegramId', async (req, res) => {
    try {
        let orders = await Order.find({ telegramId: req.params.telegramId }).sort({ _id: -1 });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/confirm-payment', async (req, res) => {
    try {
        const { tran_id } = req.body;
        let orderInfo = await Order.findOne({ orderId: tran_id });
        if (orderInfo) {
            orderInfo.status = 'PENDING';
            await orderInfo.save();
            return res.json({ success: true, message: 'Order submitted.' });
        }
        res.json({ success: false, message: 'Order not found' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==========================================
// 🛠️ ADMIN APIs (Advanced Management)
// ==========================================

app.get('/api/admin/users', async (req, res) => {
    try {
        let users = await User.find({}).sort({ lastActive: -1 });
        let fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        let onlineCount = await User.countDocuments({ lastActive: { $gte: fiveMinutesAgo } });

        res.json({ success: true, onlineCount, users });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/admin/toggle-block', async (req, res) => {
    try {
        let { telegramId } = req.body;
        let user = await User.findOne({ telegramId });
        if (!user) return res.json({ success: false, message: 'រកមិនឃើញ User ទេ' });

        user.isBlocked = !user.isBlocked;
        await user.save();
        res.json({ success: true, isBlocked: user.isBlocked, message: user.isBlocked ? 'ได้ Block ជោគជ័យ!' : 'ได้ Unblock ជោគជ័យ!' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/admin/search-user', async (req, res) => {
    try {
        let phoneQuery = req.query.phone;
        let orders = await Order.find({ phone: { $regex: phoneQuery, $options: 'i' } }).sort({ _id: -1 });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.put('/api/admin/update-product', async (req, res) => {
    try {
        const { id, name, price, stock, image, colors } = req.body;
        let product = await Product.findOne({ id: id });
        if (!product) return res.json({ success: false, message: 'រកមិនឃើញផលិតផលទេ' });
        product.name = name;
        product.price = Number(price);
        product.stock = Number(stock);
        product.image = image;
        product.colors = colors || [];
        await product.save();
        res.json({ success: true, message: 'បានកែប្រែផលិតផលជោគជ័យ!' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/admin/add-product', async (req, res) => {
    try {
        const { id, name, price, stock, image, colors } = req.body;
        let exist = await Product.findOne({ id: id });
        if (exist) return res.json({ success: false, message: 'ID ផលិតផលนี้มีแล้ว!' });
        let newProd = new Product({ id, name, price, stock, image, colors: colors || [] });
        await newProd.save();
        res.json({ success: true, message: 'Product added successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.delete('/api/admin/delete-product/:id', async (req, res) => {
    try {
        let productId = req.params.id;
        await Product.deleteOne({ id: productId });
        res.json({ success: true, message: 'Deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/admin/pending-orders', async (req, res) => {
    try {
        let pendingOrders = await Order.find({ status: 'PENDING' }).sort({ _id: -1 });
        res.json(pendingOrders);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/admin/order-action', async (req, res) => {
    try {
        const { orderId, action } = req.body;
        let orderInfo = await Order.findOne({ orderId: orderId });
        if (!orderInfo) return res.json({ success: false, message: 'រកមិនឃើញ Order នេះទេ។' });

        if (action === 'APPROVE') {
            orderInfo.status = 'PAID';
            await orderInfo.save();

            for (let cartItem of orderInfo.cart) {
                let product = await Product.findOne({ id: cartItem.id });
                if (product) {
                    product.stock = Math.max(0, product.stock - cartItem.quantity);
                    if (cartItem.selectedColor && product.colors && product.colors.length > 0) {
                        let targetColor = cartItem.selectedColor.trim().toLowerCase();
                        let colorObj = product.colors.find(c => {
                            let dbColor = c.colorName.trim().toLowerCase();
                            return dbColor === targetColor || dbColor.includes(targetColor) || targetColor.includes(dbColor);
                        });
                        if (colorObj) {
                            colorObj.stock = Math.max(0, (colorObj.stock || 0) - cartItem.quantity);
                        }
                    }
                    product.markModified('colors');
                    await product.save();
                }
            }

            try {
                let orderText = "🎉 *ការបញ្ជាទិញជោគជ័យ (Admin បាន Approve រួចរាល់)!*\n\n";
                orderText += `📦 *កូដបញ្ជាទិញ:* \`${orderInfo.orderId}\`\n\n`;
                orderInfo.cart.forEach((item, index) => {
                    orderText += `${index + 1}. ${item.name} ${item.selectedColor ? `(ពណ៌: ${item.selectedColor})` : ''} ($${item.price} x ${item.quantity})\n`;
                });
                orderText += `\n👤 *ឈ្មោះអ្នកទិញ:* ${orderInfo.name || 'មិនមានឈ្មោះ'}`;
                orderText += `\n📞 *លេខទូរសព្ទ:* ${orderInfo.phone}`;
                orderText += `\n📍 *ទីតាំង:* ${orderInfo.address}`;
                if (orderInfo.location) {
                    orderText += `\n🗺️ *Google Maps:* [ចុចទីនេះដើម្បីមើលទីតាំង](https://maps.google.com/?q=${orderInfo.location.lat},${orderInfo.location.lng})`;
                }
                orderText += `\n🚚 *សេវាដឹកជញ្ជូន:* ${orderInfo.shippingName} ($${orderInfo.shippingFee})`;
                orderText += `\n💰 *ទឹកប្រាក់សរុប:* **$${orderInfo.amount}**`;

                await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                    chat_id: TELEGRAM_CHAT_ID,
                    text: orderText,
                    parse_mode: 'Markdown'
                });
            } catch (telegramErr) {
                console.error("Telegram Send Error:", telegramErr.message);
            }

            return res.json({ success: true, message: 'បាន Approve និងកាត់ស្តុកជោគជ័យ!' });
        } 
        else if (action === 'REJECT') {
            orderInfo.status = 'REJECTED';
            await orderInfo.save();
            return res.json({ success: true, message: 'ได้ปฏิเสธ (Reject) ការបញ្ជាទិញนี้!' });
        }

        res.json({ success: false, message: 'Action មិនត្រឹមត្រូវ។' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==========================================
// 💬 OMNICHANNEL LIVE CHAT APIs (FB & Telegram)
// ==========================================

// 1. ទាញយកបញ្ជីរាយឈ្មោះសន្ទនាទាំងអស់សម្រាប់ Admin Panel
app.get('/api/admin/chats', async (req, res) => {
    try {
        let conversations = await ChatConversation.find({}).sort({ lastTime: -1 });
        res.json({ success: true, conversations });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 2. Admin ផ្ញើសារឆ្លើយតបទៅកាន់អតិថិជន (FB Messenger ឬ Telegram)
app.post('/api/admin/chats/send', async (req, res) => {
    try {
        let { platform, userId, text } = req.body;
        if (!platform || !userId || !text) {
            return res.json({ success: false, message: 'ព័ត៌មានមិនគ្រប់គ្រាន់' });
        }

        let timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        if (platform === 'facebook') {
            // ส่งข้อความออกไปหา Facebook Messenger ຜ່ານ Graph API
            await axios.post(`https://graph.facebook.com/v18.0/me/messages?access_token=${FB_PAGE_ACCESS_TOKEN}`, {
                recipient: { id: userId },
                message: { text: text }
            });
        } else if (platform === 'telegram') {
            // ส่งข้อความออกไปหา Telegram Bot ຜ່ານ Telegram API
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                chat_id: userId,
                text: text
            });
        }

        // บันทึกลงฐานข้อมูล ChatConversation
        let conv = await ChatConversation.findOne({ platform, userId });
        if (conv) {
            conv.messages.push({ sender: 'admin', text, time: timeStr });
            conv.lastTime = timeStr;
            await conv.save();
        }

        res.json({ success: true, message: 'ส่งข้อความสำเร็จ' });
    } catch (error) {
        console.error('Send Chat Error:', error.response?.data || error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 3. Facebook Messenger Webhook (Verify GET)
app.get('/webhook/facebook', (req, res) => {
    let mode = req.query['hub.mode'];
    let token = req.query['hub.verify_token'];
    let challenge = req.query['hub.challenge'];

    if (mode && token === FB_VERIFY_TOKEN) {
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

// 4. Facebook Messenger Webhook (Receive POST - Updated for both Standard & Test Payloads)
app.post('/webhook/facebook', async (req, res) => {
    try {
        let body = req.body;
        console.log("FB Webhook Received:", JSON.stringify(body, null, 2));

        if (body.object === 'page') {
            for (let entry of body.entry) {
                // A. ករណី Test Payload ឬ Messages Field ថ្មី (changes)
                if (entry.changes && entry.changes.length > 0) {
                    for (let change of entry.changes) {
                        if (change.field === 'messages' && change.value) {
                            let val = change.value;
                            let sender_psid = val.sender?.id || val.from?.id || "test_user_123";
                            let incomingText = val.message?.text || "Test Message";

                            let timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            let customerName = 'Facebook Test User';

                            let conv = await ChatConversation.findOne({ platform: 'facebook', userId: sender_psid });
                            if (!conv) {
                                conv = new ChatConversation({
                                    platform: 'facebook',
                                    userId: sender_psid,
                                    name: customerName,
                                    messages: [],
                                    lastTime: timeStr
                                });
                            }
                            conv.name = customerName;
                            conv.messages.push({ sender: 'user', text: incomingText, time: timeStr });
                            conv.lastTime = timeStr;
                            await conv.save();
                        }
                    }
                }

                // B. ករណីសារធម្មតាពីអតិថិជនពិតប្រាកដ (messaging array)
                if (entry.messaging && entry.messaging.length > 0) {
                    let webhook_event = entry.messaging[0];
                    let sender_psid = webhook_event.sender.id;

                    if (webhook_event.message && webhook_event.message.text) {
                        let incomingText = webhook_event.message.text;
                        let timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                        let customerName = 'Facebook Customer';
                        try {
                            let profileRes = await axios.get(`https://graph.facebook.com/v18.0/${sender_psid}?fields=first_name,last_name&access_token=${FB_PAGE_ACCESS_TOKEN}`);
                            if (profileRes.data && profileRes.data.first_name) {
                                customerName = `${profileRes.data.first_name} ${profileRes.data.last_name || ''}`;
                            }
                        } catch (e) {
                            console.error('Fetch FB Profile error:', e.message);
                        }

                        let conv = await ChatConversation.findOne({ platform: 'facebook', userId: sender_psid });
                        if (!conv) {
                            conv = new ChatConversation({
                                platform: 'facebook',
                                userId: sender_psid,
                                name: customerName,
                                messages: [],
                                lastTime: timeStr
                            });
                        }
                        conv.name = customerName;
                        conv.messages.push({ sender: 'user', text: incomingText, time: timeStr });
                        conv.lastTime = timeStr;
                        await conv.save();
                    }
                }
            }
            return res.status(200).send('EVENT_RECEIVED');
        }
        res.sendStatus(404);
    } catch (err) {
        console.error("FB Webhook Error:", err.message);
        res.sendStatus(500);
    }
});

// 5. Telegram Webhook / Message Listener
app.post('/webhook/telegram', async (req, res) => {
    try {
        let update = req.body;
        if (update.message && update.message.text) {
            let chatId = update.message.chat.id.toString();
            let text = update.message.text;
            let firstName = update.message.from.first_name || 'Telegram User';
            let timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            let conv = await ChatConversation.findOne({ platform: 'telegram', userId: chatId });
            if (!conv) {
                conv = new ChatConversation({
                    platform: 'telegram',
                    userId: chatId,
                    name: firstName,
                    messages: [],
                    lastTime: timeStr
                });
            }
            conv.name = firstName;
            conv.messages.push({ sender: 'user', text: text, time: timeStr });
            conv.lastTime = timeStr;
            await conv.save();
        }
        res.sendStatus(200);
    } catch (error) {
        console.error('Telegram Webhook Error:', error.message);
        res.sendStatus(500);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
