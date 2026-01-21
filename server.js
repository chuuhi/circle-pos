const express = require("express");
const app = express();
const db = require("./db");

app.use(express.json());
app.use(express.static("public"));

// CREATE ORDER
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

// GET SINGLE ORDER
app.get("/orders/:id", async (req, res) => {
  try {
    const orderResult = await db.query(
      "SELECT * FROM orders WHERE id = $1",
      [req.params.id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).send("Order not found");
    }

    const itemsResult = await db.query(
      "SELECT * FROM items WHERE order_id = $1 ORDER BY id",
      [req.params.id]
    );

    res.json({
      ...orderResult.rows[0],
      items: itemsResult.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error");
  }
});

// ADD ITEM
app.post("/orders/:id/items", async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).send("Item name required");

  try {
    await db.query(
      `
      INSERT INTO items (order_id, name, status)
      VALUES ($1, $2, 'pending')
      `,
      [req.params.id, name]
    );

    res.status(201).send("Item added");
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error");
  }
});

// SEND ORDER TO KITCHEN
app.post("/orders/:id/send", async (req, res) => {
  try {
    const result = await db.query(
      `
      UPDATE orders
      SET sent_to_kitchen = true,
          sent_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).send("Order not found");
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error");
  }
});

// EDIT ITEM
app.put("/orders/:orderId/items/:itemId", async (req, res) => {
  const { orderId, itemId } = req.params;
  const { name } = req.body;

  if (!name) return res.status(400).send("Item name required");

  try {
    const itemResult = await db.query(
      "SELECT * FROM items WHERE id = $1 AND order_id = $2",
      [itemId, orderId]
    );

    if (itemResult.rows.length === 0) {
      return res.status(404).send("Item not found");
    }

    const oldName = itemResult.rows[0].name;

    await db.query(
      "UPDATE items SET name = $1 WHERE id = $2",
      [name, itemId]
    );

    await db.query(
      `
      INSERT INTO order_changes
      (order_id, item_id, change_type, from_value, to_value)
      VALUES ($1, $2, 'ITEM_EDITED', $3, $4)
      `,
      [orderId, itemId, oldName, name]
    );

    res.json({ message: "Item updated" });
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error");
  }
});

// VOID ITEM
app.delete("/orders/:orderId/items/:itemId", async (req, res) => {
  const { orderId, itemId } = req.params;

  try {
    const itemResult = await db.query(
      "SELECT * FROM items WHERE id = $1 AND order_id = $2",
      [itemId, orderId]
    );

    if (itemResult.rows.length === 0) {
      return res.status(404).send("Item not found");
    }

    const itemName = itemResult.rows[0].name;

    await db.query(
      `
      INSERT INTO order_changes
      (order_id, item_id, change_type, from_value)
      VALUES ($1, $2, 'ITEM_VOIDED', $3)
      `,
      [orderId, itemId, itemName]
    );

    await db.query("DELETE FROM items WHERE id = $1", [itemId]);

    res.json({ message: "Item voided" });
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error");
  }
});

// KITCHEN: VIEW ORDERS
app.get("/kitchen/orders", async (req, res) => {
  try {
    const ordersResult = await db.query(`
      SELECT *
      FROM orders
      WHERE sent_to_kitchen = true
      ORDER BY sent_at ASC
    `);

    const itemsResult = await db.query("SELECT * FROM items");
    const changesResult = await db.query("SELECT * FROM order_changes");

    const kitchenOrders = ordersResult.rows.map(order => {
      const items = itemsResult.rows.filter(
        i => i.order_id === order.id
      );

      const changes = changesResult.rows.filter(
        c => c.order_id === order.id
      );

      const hasUnseenUpdates =
        !order.last_kitchen_viewed_at ||
        changes.some(
          c => new Date(c.created_at) > new Date(order.last_kitchen_viewed_at)
        );

      return {
        id: order.id,
        items,
        hasUnseenUpdates,
      };
    });

    res.json(kitchenOrders);
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error");
  }
});

// KITCHEN: VIEW CHANGES
app.get("/kitchen/orders/:id/changes", async (req, res) => {
  try {
    const result = await db.query(
      `
      SELECT *
      FROM order_changes
      WHERE order_id = $1
      ORDER BY created_at ASC
      `,
      [req.params.id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error");
  }
});

// KITCHEN: MARK VIEWED
app.post("/kitchen/orders/:id/view", async (req, res) => {
  try {
    await db.query(
      `
      UPDATE orders
      SET last_kitchen_viewed_at = NOW()
      WHERE id = $1
      `,
      [req.params.id]
    );

    res.json({ message: "Marked as viewed" });
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error");
  }
});

// ROOT
app.get("/", (req, res) => {
  res.send("POS API running");
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
