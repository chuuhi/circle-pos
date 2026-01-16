const express = require("express");
const app = express();
const db = require("./db"); // your Postgres client

app.use(express.json());
app.use(express.static("public"));

// -------------------- CREATE ORDER --------------------
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

// -------------------- ADD ITEM TO ORDER --------------------
app.post("/orders/:id/items", async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).send("Item name required");

  try {
    const orderResult = await db.query(
      "SELECT id FROM orders WHERE id = $1",
      [req.params.id]
    );

    if (orderResult.rows.length === 0)
      return res.status(404).send("Order not found");

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

// -------------------- SEND ORDER TO KITCHEN --------------------
app.post("/orders/:id/send", async (req, res) => {
  const { id } = req.params;

  try {
    const orderResult = await db.query(
      "SELECT * FROM orders WHERE id = $1",
      [id]
    );
    if (orderResult.rows.length === 0) return res.status(404).send("Order not found");

    const order = orderResult.rows[0];
    if (order.sent_to_kitchen) return res.status(400).send("Order already sent");

    const updatedOrder = await db.query(
      `UPDATE orders
       SET sent_to_kitchen = TRUE, sent_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    res.json(updatedOrder.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error");
  }
});

// -------------------- VIEW ALL ORDERS --------------------
app.get("/orders", async (req, res) => {
  try {
    const ordersResult = await db.query("SELECT * FROM orders ORDER BY created_at DESC");
    const itemsResult = await db.query("SELECT * FROM items ORDER BY id");

    const orders = ordersResult.rows.map(order => ({
      id: order.id,
      sentToKitchen: order.sent_to_kitchen,
      createdAt: order.created_at,
      lastKitchenViewedAt: order.last_kitchen_viewed_at,
      items: itemsResult.rows.filter(item => item.order_id === order.id),
    }));

    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error");
  }
});

// -------------------- VIEW SINGLE ORDER --------------------
app.get("/orders/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const orderResult = await db.query("SELECT * FROM orders WHERE id = $1", [id]);
    if (orderResult.rows.length === 0) return res.status(404).send("Order not found");

    const itemsResult = await db.query(
      "SELECT * FROM items WHERE order_id = $1 ORDER BY id",
      [id]
    );

    res.json({ ...orderResult.rows[0], items: itemsResult.rows });
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error");
  }
});

// -------------------- EDIT ITEM --------------------
app.put("/orders/:orderId/items/:itemId", async (req, res) => {
  const { orderId, itemId } = req.params;
  const { name } = req.body;

  if (!name) return res.status(400).send("Item name required");

  try {
    const itemResult = await db.query(
      "SELECT * FROM items WHERE id = $1 AND order_id = $2",
      [itemId, orderId]
    );

    if (itemResult.rows.length === 0) return res.status(404).send("Item not found");

    const item = itemResult.rows[0];

    await db.query("UPDATE items SET name = $1 WHERE id = $2", [name, itemId]);

    await db.query(
      `INSERT INTO order_changes (order_id, item_id, change_type, from_value, to_value)
       VALUES ($1, $2, $3, $4, $5)`,
      [orderId, itemId, "ITEM_EDITED", item.name, name]
    );

    res.json({ message: "Item updated", itemId, from: item.name, to: name });
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error");
  }
});

// -------------------- VOID ITEM --------------------
app.delete("/orders/:orderId/items/:itemId", async (req, res) => {
  const { orderId, itemId } = req.params;

  try {
    const itemResult = await db.query(
      "SELECT * FROM items WHERE id = $1 AND order_id = $2",
      [itemId, orderId]
    );

    if (itemResult.rows.length === 0) return res.status(404).send("Item not found");

    const item = itemResult.rows[0];

    await db.query(
      `INSERT INTO order_changes (order_id, item_id, change_type, from_value)
       VALUES ($1, $2, $3, $4)`,
      [orderId, itemId, "ITEM_VOIDED", item.name]
    );

    await db.query("DELETE FROM items WHERE id = $1", [itemId]);

    res.json({ message: "Item voided", itemId, itemName: item.name });
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error");
  }
});

// -------------------- KITCHEN VIEW --------------------
app.get("/kitchen/orders", async (req, res) => {
  try {
    const ordersResult = await db.query("SELECT * FROM orders WHERE sent_to_kitchen = TRUE ORDER BY created_at DESC");
    const itemsResult = await db.query("SELECT * FROM items ORDER BY id");
    const changesResult = await db.query("SELECT * FROM order_changes ORDER BY created_at");

    const kitchenOrders = ordersResult.rows.map(order => {
      const items = itemsResult.rows.filter(item => item.order_id === order.id);
      const changes = changesResult.rows.filter(change => change.order_id === order.id);

      const hasUnseenUpdates = !order.last_kitchen_viewed_at ||
        changes.some(change => new Date(change.created_at) > new Date(order.last_kitchen_viewed_at));

      return { id: order.id, items, hasUnseenUpdates };
    });

    res.json(kitchenOrders);
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error");
  }
});

// -------------------- KITCHEN VIEW CHANGES --------------------
app.get("/kitchen/orders/:id/changes", async (req, res) => {
  const { id } = req.params;

  try {
    const changesResult = await db.query(
      "SELECT * FROM order_changes WHERE order_id = $1 ORDER BY created_at",
      [id]
    );

    res.json(changesResult.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error");
  }
});

// -------------------- MARK KITCHEN UPDATES SEEN --------------------
app.post("/kitchen/orders/:id/view", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.query(
      "UPDATE orders SET last_kitchen_viewed_at = NOW() WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) return res.status(404).send("Order not found");

    res.json({ message: "Kitchen updates marked as seen" });
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error");
  }
});

// -------------------- UPDATE ITEM STATUS --------------------
app.put("/orders/:orderId/items/:itemId/status", async (req, res) => {
  const { orderId, itemId } = req.params;
  const { status } = req.body;

  if (!["pending", "cooking", "done"].includes(status))
    return res.status(400).send("Invalid status");

  try {
    const itemResult = await db.query(
      "SELECT * FROM items WHERE id = $1 AND order_id = $2",
      [itemId, orderId]
    );

    if (itemResult.rows.length === 0) return res.status(404).send("Item not found");

    const item = itemResult.rows[0];
    const oldStatus = item.status;

    await db.query("UPDATE items SET status = $1 WHERE id = $2", [status, itemId]);

    await db.query(
      `INSERT INTO order_changes (order_id, item_id, change_type, from_value, to_value)
       VALUES ($1, $2, $3, $4, $5)`,
      [orderId, itemId, "ITEM_STATUS_CHANGED", oldStatus, status]
    );

    res.json({ message: "Item status updated", itemId, from: oldStatus, to: status });
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error");
  }
});

// -------------------- ROOT --------------------
app.get("/", (req, res) => res.send("POS API running"));

// -------------------- SERVER --------------------
app.listen(3000, () => console.log("Server running on port 3000"));
