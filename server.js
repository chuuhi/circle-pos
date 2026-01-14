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
        changes: [],
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
    order.items.push({
        name,
        status: "pending", // pending | cooking | done
      });

    res.json(order);
});

// SEND ORDER TO KITCHEN
app.post("/orders/:id/send", (req, res) => {
    const order = orders.find(o => o.id === Number(req.params.id));
    if (!order) return res.status(404).send("Order not found");

    order.sentToKitchen = true;
    order.sentAt = new Date();

    res.json(order);
});

// VIEW ALL ORDERS
app.get("/orders", (req, res) => {
    res.json(orders);
});

// KITCHEN VIEW
app.get("/kitchen/orders", (req, res) => {
    const kitchenOrders = orders.filter(o => o.sentToKitchen);
    res.json(kitchenOrders);
  });

// EDIT ITEM IN ORDER
app.put("/orders/:orderId/items/:itemIndex", (req, res) => {
    const order = orders.find(o => o.id === Number(req.params.orderId));
    if (!order) return res.status(404).send("Order not found");

    const index = Number(req.params.itemIndex);
    if (index < 0 || index >= order.items.length) {
        return res.status(400).send("Invalid item index");
    }

    const { name } = req.body;
    if (!name) return res.status(400).send("Item name required");

    const oldName = order.items[index].name = name;
    order.items[index].name = name;

    order.changes.push({
        type: "ITEM_EDITED",
        itemIndex: index,
        from: oldName,
        to: name,
        changedAt: new Date(),
    });

    res.json(order);
});

// VOID (DELETE) ITEM FROM ORDER
app.delete("/orders/:orderId/items/:itemIndex", (req, res) => {
    const order = orders.find(o => o.id === Number(req.params.orderId));
    if (!order) return res.status(404).send("Order not found");
  
    const index = Number(req.params.itemIndex);
    if (index < 0 || index >= order.items.length) {
      return res.status(400).send("Invalid item index");
    }
  
    const removedItem = order.items[index];
  
    // remove item
    order.items.splice(index, 1);
  
    // log the change
    order.changes.push({
      type: "ITEM_VOIDED",
      itemIndex: index,
      itemName: removedItem.name,
      changedAt: new Date(),
    });
  
    res.json(order);
  });  

// VIEW CHANGE LOG FOR A SINGLE ORDER (KITCHEN)
app.get("/kitchen/orders/:id/changes", (req, res) => {
    const order = orders.find(o => o.id === Number(req.params.id));
    if (!order) return res.status(404).send("Order not found");

    res.json(order.changes);
});

// UPDATE ITEM STATUS (KITCHEN)
app.put("/orders/:orderId/items/:itemIndex/status", (req, res) => {
    const order = orders.find(o => o.id === Number(req.params.orderId));
    if (!order) return res.status(404).send("Order not found");
  
    const index = Number(req.params.itemIndex);
    if (index < 0 || index >= order.items.length) {
      return res.status(400).send("Invalid item index");
    }
  
    const { status } = req.body;
    if (!["pending", "cooking", "done"].includes(status)) {
      return res.status(400).send("Invalid status");
    }
  
    const oldStatus = order.items[index].status;
    order.items[index].status = status;
  
    order.changes.push({
      type: "ITEM_STATUS_CHANGED",
      itemIndex: index,
      from: oldStatus,
      to: status,
      changedAt: new Date(),
    });
  
    res.json(order);
  });  

app.get("/", (req, res) => {
    res.send("POS API running");
});

app.listen(3000, () => {
    console.log("Server running on port 3000");
});