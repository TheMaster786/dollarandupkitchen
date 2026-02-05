const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

// Create Express app
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Data storage
let orders = [];
let orderCounter = 1001;

// Serve main POS interface
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve kitchen display
app.get('/kitchen', (req, res) => {
    res.sendFile(path.join(__dirname, 'kitchen.html'));
});

// API: Process checkout
app.post('/api/checkout', async (req, res) => {
    try {
        const order = req.body;
        
        // Assign order number if not provided
        if (!order.orderNumber) {
            order.orderNumber = orderCounter++;
        }
        
        order.timestamp = new Date().toISOString();
        order.status = 'pending';
        
        // Save order
        orders.unshift(order);
        
        // Keep only last 50 orders in memory
        if (orders.length > 50) {
            orders.pop();
        }
        
        // Save to file
        await saveOrder(order);
        
        // Broadcast to kitchen display
        io.emit('new-order', order);
        
        console.log(`✅ Order #${order.orderNumber} received: $${order.total.toFixed(2)}`);
        
        res.json({
            success: true,
            orderNumber: order.orderNumber,
            message: 'Order processed successfully'
        });
        
    } catch (error) {
        console.error('❌ Checkout error:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing order'
        });
    }
});

// API: Get orders
app.get('/api/orders', (req, res) => {
    res.json({
        success: true,
        count: orders.length,
        orders: orders
    });
});

// API: Get sales report
app.get('/api/sales-report', (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const todaySales = orders.filter(order => 
        order.timestamp.startsWith(today)
    );
    
    const totalRevenue = todaySales.reduce((sum, order) => sum + order.total, 0);
    const totalOrders = todaySales.length;
    
    res.json({
        success: true,
        date: today,
        totalOrders: totalOrders,
        totalRevenue: totalRevenue.toFixed(2),
        averageOrder: totalOrders > 0 ? (totalRevenue / totalOrders).toFixed(2) : 0,
        orders: todaySales
    });
});

// API: Clear orders (for testing)
app.post('/api/clear-orders', (req, res) => {
    orders = [];
    orderCounter = 1001;
    res.json({ success: true, message: 'Orders cleared' });
});

// Save order to file
async function saveOrder(order) {
    try {
        const ordersDir = path.join(__dirname, 'orders');
        
        // Create orders directory if it doesn't exist
        await fs.mkdir(ordersDir, { recursive: true });
        
        // Save individual order
        const orderFile = path.join(ordersDir, `order_${order.orderNumber}.json`);
        await fs.writeFile(orderFile, JSON.stringify(order, null, 2));
        
        // Append to daily file
        const date = new Date().toISOString().split('T')[0];
        const dailyFile = path.join(ordersDir, `daily_${date}.json`);
        
        let dailyOrders = [];
        try {
            const data = await fs.readFile(dailyFile, 'utf8');
            dailyOrders = JSON.parse(data);
        } catch (err) {
            // File doesn't exist, that's okay
        }
        
        dailyOrders.push(order);
        await fs.writeFile(dailyFile, JSON.stringify(dailyOrders, null, 2));
        
        console.log(`💾 Order #${order.orderNumber} saved to file`);
        
    } catch (error) {
        console.error('Error saving order:', error);
    }
}

// Socket.io connection
io.on('connection', (socket) => {
    console.log('📱 New device connected to kitchen display');
    
    // Send current orders to new connection
    socket.emit('current-orders', orders);
    
    socket.on('disconnect', () => {
        console.log('📱 Device disconnected from kitchen display');
    });
});

// Start server
server.listen(PORT, () => {
    console.log('\n' + '='.repeat(50));
    console.log('🚀 IFFAT\'S KITCHEN POS SYSTEM STARTED');
    console.log('='.repeat(50));
    console.log(`\n📱 Customer Interface:`);
    console.log(`   ➡️  http://localhost:${PORT}`);
    console.log(`\n👨‍🍳 Kitchen Display:`);
    console.log(`   ➡️  http://localhost:${PORT}/kitchen`);
    console.log(`\n📊 Sales Report:`);
    console.log(`   ➡️  http://localhost:${PORT}/api/sales-report`);
    console.log(`\n🛒 View Orders:`);
    console.log(`   ➡️  http://localhost:${PORT}/api/orders`);
    console.log(`\n✅ Server is ready! Open the links above in your browser.`);
    console.log('\n' + '='.repeat(50));
});
