const express = require("express");
const app = express();
const db = require("./db");

app.use(express.json());
app.use(express.static("public"));

let orders = [];
let nextOrderId = 1;

// CREATE ORDER (Postgres)
app.post("/orders", async (req, res) => {
  try {
    const result = await db.query(
      "INSERT INTO orders DEFAULT VALUES RETURNING *"
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error");
  }
});

// ADD ITEM TO ORDER (Postgres)
app.post("/orders/:id/items", async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).send("Item name required");
  
    try {
      // verify order exists
      const orderResult = await db.query(
        "SELECT id FROM orders WHERE id = $1",
        [req.params.id]
      );
  
      if (orderResult.rows.length === 0) {
        return res.status(404).send("Order not found");
      }
  
      // insert item
      const itemResult = await db.query(
        `INSERT INTO items (order_id, name, status)
         VALUES ($1, $2, 'pending')
         RETURNING *`,
        [req.params.id, name]
      );
  
      res.status(201).json(itemResult.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).send("Database error");
    }
  });  

// SEND ORDER TO KITCHEN (Postgres)
app.post("/orders/:id/send", async (req, res) => {
    const { id } = req.params;
  
    try {
      const orderResult = await db.query(
        `SELECT * FROM orders WHERE id = $1`,
        [id]
      );
  
      if (orderResult.rows.length === 0) {
        return res.status(404).send("Order not found");
      }
  
      const order = orderResult.rows[0];
  
      if (order.sent_to_kitchen) {
        return res.status(400).send("Order already sent to kitchen");
      }
  
      const updatedOrder = await db.query(
        `
        UPDATE orders
        SET sent_to_kitchen = true,
            sent_at = NOW()
        WHERE id = $1
        RETURNING *
        `,
        [id]
      );
  
      res.json(updatedOrder.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).send("Database error");
    }
  });  

// VIEW ALL ORDERS (Postgres)
app.get("/orders", async (req, res) => {
    try {
      const ordersResult = await db.query(`
        SELECT * FROM orders
        ORDER BY created_at DESC
      `);
  
      const itemsResult = await db.query(`
        SELECT * FROM items
        ORDER BY id
      `);
  
      const orders = ordersResult.rows.map(order => ({
        id: order.id,
        sentToKitchen: order.sent_to_kitchen,
        createdAt: order.created_at,
        lastKitchenViewedAt: order.last_kitchen_viewed_at,
        items: itemsResult.rows.filter(
          item => item.order_id === order.id
        ),
      }));
  
      res.json(orders);
    } catch (err) {
      console.error(err);
      res.status(500).send("Database error");
    }
  });  

// KITCHEN VIEW
app.get("/kitchen/orders", (req, res) => {
    const kitchenOrders = orders
      .filter(o => o.sentToKitchen)
      .map(order => ({
        id: order.id,
        items: order.items,
        hasUnseenUpdates: hasUnseenKitchenUpdates(order),
      }));
  
    res.json(kitchenOrders);
  });  

// KITCHEN VIEWS UPDATES
app.post("/kitchen/orders/:id/view", (req, res) => {
    const order = orders.find(o => o.id === Number(req.params.id));
    if (!order) return res.status(404).send("Order not found");
  
    order.lastKitchenViewedAt = new Date();
    res.json({ message: "Kitchen updates marked as seen" });
  });
  
// EDIT ITEM IN ORDER (Postgres)
app.put("/orders/:orderId/items/:itemIndex", async (req, res) => {
    const { orderId, itemIndex } = req.params;
    const { name } = req.body;
  
    if (!name) return res.status(400).send("Item name required");
  
    try {
      // get items for order
      const itemsResult = await db.query(
        `SELECT * FROM items WHERE order_id = $1 ORDER BY id`,
        [orderId]
      );
  
      if (itemsResult.rows.length === 0) {
        return res.status(404).send("No items found for order");
      }
  
      const item = itemsResult.rows[itemIndex];
      if (!item) {
        return res.status(400).send("Invalid item index");
      }
  
      // update item
      await db.query(
        `UPDATE items SET name = $1 WHERE id = $2`,
        [name, item.id]
      );
  
      res.json({
        message: "Item updated",
        itemId: item.id,
        from: item.name,
        to: name,
      });
    } catch (err) {
      console.error(err);
      res.status(500).send("Database error");
    }
  });  

// VOID (DELETE) ITEM FROM ORDER (Postgres)
app.delete("/orders/:orderId/items/:itemIndex", async (req, res) => {
    const { orderId, itemIndex } = req.params;
  
    try {
      // get items for order
      const itemsResult = await db.query(
        `SELECT * FROM items WHERE order_id = $1 ORDER BY id`,
        [orderId]
      );
  
      if (itemsResult.rows.length === 0) {
        return res.status(404).send("No items found for order");
      }
  
      const item = itemsResult.rows[itemIndex];
      if (!item) {
        return res.status(400).send("Invalid item index");
      }
  
      // delete item
      await db.query(
        `DELETE FROM items WHERE id = $1`,
        [item.id]
      );
  
      res.json({
        message: "Item voided",
        itemId: item.id,
        itemName: item.name,
      });
    } catch (err) {
      console.error(err);
      res.status(500).send("Database error");
    }
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

// function
function hasUnseenKitchenUpdates(order) {
    if (!order.lastKitchenViewedAt) {
      return order.changes.length > 0;
    }
  
    return order.changes.some(
      change => new Date(change.changedAt) > new Date(order.lastKitchenViewedAt)
    );
  }
  