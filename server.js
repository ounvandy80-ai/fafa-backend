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

// 🟢 Schema សម្រាប់ផលិតផល (colors មាន stock ផ្ទាល់ខ្លួន)
const productSchema = new mongoose.Schema({
    id: Number,
    name: String,
    price: Number,
    stock: Number, // ស្តុកសរុប
    image: String,
    colors: Array // [{ colorName: "ពណ៌ខ្មៅ", image: "...", stock: 1 }, ...]
});
const Product = mongoose.model('Product', productSchema);

const orderSchema = new mongoose.Schema({
    telegramId: String,
    orderId: String,
    amount: Number,
    name: String,
    phone: String,
    address: String,
    shippingFee: Number,
    shippingName: String,
    cart: Array,
    status: String, 
    date: String
});
const Order = mongoose.model('Order', orderSchema);

app.get('/', (req, res) => {
    res.send('FAFA Clothing Backend with MongoDB is running successfully!');
});

const TELEGRAM_BOT_TOKEN = '9071654545:AAG6Ur9Nt2k-TQiEhlPu65Ib1gbmdh-7sgs';
const TELEGRAM_CHAT_ID = '7488093549';

app.get('/api/products', async (req, res) => {
    try {
        let products = await Product.find({});
        res.json(products);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/create-order', async (req, res) => {
    try {
        let { telegramId, orderId, amount, name, phone, address, shippingFee, shippingName, cart } = req.body;
        let parsedCart = typeof cart === 'string' ? JSON.parse(cart) : cart;

        let newOrder = new Order({
            telegramId: telegramId || 'guest',
            orderId,
            amount,
            name,         
            phone,
            address,
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
// 🛠️ ADMIN APIs
// ==========================================

// API សម្រាប់ Admin កែប្រែព័ត៌មានផលិតផល (ឈ្មោះ តម្លៃ ស្តុកសរុប និងរូបភាព)
app.put('/api/admin/update-product', async (req, res) => {
    try {
        const { id, name, price, stock, image } = req.body;
        let product = await Product.findOne({ id: id });
        
        if (!product) return res.json({ success: false, message: 'រកមិនឃើញផលិតផលទេ' });

        product.name = name;
        product.price = Number(price);
        product.stock = Number(stock);
        product.image = image;

        await product.save();
        res.json({ success: true, message: 'បានកែប្រែផលិតផលជោគជ័យ!' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// API សម្រាប់កែស្តុកដាច់ដោយឡែក (រក្សាទុកเผื่อ compatibility)
app.put('/api/admin/update-stock', async (req, res) => {
    try {
        const { id, stock } = req.body;
        let product = await Product.findOne({ id: id });
        if (!product) return res.json({ success: false, message: 'រកមិនឃើញផលិតផលទេ' });
        product.stock = stock;
        await product.save();
        res.json({ success: true, message: 'Updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/admin/add-product', async (req, res) => {
    try {
        const { id, name, price, stock, image, colors } = req.body;
        let exist = await Product.findOne({ id: id });
        if (exist) return res.json({ success: false, message: 'ID ផលិតផលនេះមានរួចហើយ!' });

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

            // កាត់ស្តុកសរុប និងស្តុកតាមពណ៌នីមួយៗ (ដោយស្វែងរកពណ៌តាមកម្រិតបត់បែនខ្ពស់)
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
                orderText += `\n🚚 *សេវាដឹកជញ្ជូន:* ${orderInfo.shippingName} ($${orderInfo.shippingFee})`;
                orderText += `\n💰 *ទឹកប្រាក់សរុប:* **$${orderInfo.amount}**`;

                await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                    chat_id: TELEGRAM_CHAT_ID,
                    text: orderText,
                    parse_mode: 'Markdown'
                });
            } catch (telegramErr) {
                console.error("Telegram Send Error (Ignored):", telegramErr.message);
            }

            return res.json({ success: true, message: 'បាន Approve និងកាត់ស្តុកតាមពណ៌ជោគជ័យ!' });
        } 
        else if (action === 'REJECT') {
            orderInfo.status = 'REJECTED';
            await orderInfo.save();
            return res.json({ success: true, message: 'បានបដិសេធ (Reject) ការបញ្ជាទិញនេះ!' });
        }

        res.json({ success: false, message: 'Action មិនត្រឹមត្រូវ។' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
