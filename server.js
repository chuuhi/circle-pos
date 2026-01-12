const express = require("express");
const app = express();

app.use(express.json());

let orders = [];
let nextOrderId = 1;

// CREATE ORDER
app.post("/orders", (req, res) => {
    const newOrder = {
        id: nextOrderId++,
        items: [],
        sentToKitchen: false,
        createdAt: new Date(),
    };

    orders.push(newOrder);
    res.status(201).json(newOrder);
});

// ADD ITEM TO ORDER
app.post("/orders/:id/items", (req, res) => {
    const order = orders.find(o => o.id === Number(req.params.id));
    if (!order) return res.status(404).send("Order not found");

    const { name } = req.body;
    order.items.push({ name });

    res.json(order);
});

// VIEW ALL ORDERS
app.get("/orders", (req, res) => {
    res.json(orders);
});

app.get("/", (req, res) => {
    res.send("POS API running");
});



app.listen(3000, () => {
    console.log("Server running on port 3000");
});