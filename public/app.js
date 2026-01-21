let currentOrderId = null;

const orderInfo = document.getElementById("orderInfo");
const itemsList = document.getElementById("itemsList");

// CREATE ORDER
document.getElementById("createOrderBtn").onclick = async () => {
  const res = await fetch("/orders", { method: "POST" });
  const order = await res.json();

  currentOrderId = order.id;
  orderInfo.textContent = `Order #${order.id} created`;
  itemsList.innerHTML = "";
};

// ADD ITEM
document.getElementById("addItemBtn").onclick = async () => {
  if (!currentOrderId) return alert("Create an order first");

  const name = document.getElementById("itemName").value;
  if (!name) return;

  await fetch(`/orders/${currentOrderId}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });

  // Fetch updated order from backend
  const orderRes = await fetch(`/orders/${currentOrderId}`);
  const order = await orderRes.json();
  renderItems(order.items);
};

// SEND TO KITCHEN
document.getElementById("sendKitchenBtn").onclick = async () => {
    if (!currentOrderId) return;
  
    await fetch(`/orders/${currentOrderId}/send`, { method: "POST" });
  
    orderInfo.textContent = `Order #${currentOrderId} sent to kitchen`;
  };
  
// GET SINGLE ORDER (Postgres)
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

    const order = orderResult.rows[0];

    res.json({
      id: order.id,
      sentToKitchen: order.sent_to_kitchen,
      createdAt: order.created_at,
      items: itemsResult.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error");
  }
});

// RENDER ITEMS
function renderItems(items) {
    itemsList.innerHTML = "";
  
    items.forEach((item) => {
      const li = document.createElement("li");
  
      const text = document.createElement("span");
      text.textContent = `${item.name} (${item.status || "pending"})`;
  
      const editBtn = document.createElement("button");
      editBtn.textContent = "Edit";
      editBtn.style.marginLeft = "10px";
      editBtn.onclick = () => editItem(item.id, item.name);
  
      const voidBtn = document.createElement("button");
      voidBtn.textContent = "Void";
      voidBtn.style.marginLeft = "5px";
      voidBtn.onclick = () => voidItem(item.id);
  
      li.appendChild(text);
      li.appendChild(editBtn);
      li.appendChild(voidBtn);
  
      itemsList.appendChild(li);
    });
  }
  
// EDIT ITEM
async function editItem(itemId, oldName) {
  const newName = prompt("Edit item name:", oldName);
  if (!newName || newName === oldName) return;

  await fetch(`/orders/${currentOrderId}/items/${itemId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: newName }),
  });

  const orderRes = await fetch(`/orders/${currentOrderId}`);
  const order = await orderRes.json();
  renderItems(order.items);
}

// VOID ITEM
async function voidItem(itemId) {
  const confirmVoid = confirm("Void this item?");
  if (!confirmVoid) return;

  await fetch(`/orders/${currentOrderId}/items/${itemId}`, {
    method: "DELETE",
  });

  const orderRes = await fetch(`/orders/${currentOrderId}`);
  const order = await orderRes.json();
  renderItems(order.items);
}
