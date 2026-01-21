let currentOrderId = null;

const orderInfo = document.getElementById("orderInfo");
const itemsList = document.getElementById("itemsList");

// CREATE ORDER
document.getElementById("createOrderBtn").onclick = async () => {
  const res = await fetch("/orders", { method: "POST" });
  const order = await res.json();

  currentOrderId = order.id;
  orderInfo.textContent = `Order #${order.id} created`;

  await loadOrder();
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

  await loadOrder();
};

// SEND TO KITCHEN
document.getElementById("sendKitchenBtn").onclick = async () => {
  if (!currentOrderId) return;

  await fetch(`/orders/${currentOrderId}/send`, { method: "POST" });
  orderInfo.textContent = `Order #${currentOrderId} sent to kitchen`;
};

// EDIT ITEM
async function editItem(itemId, oldName) {
  const newName = prompt("Edit item name:", oldName);
  if (!newName || newName === oldName) return;

  await fetch(`/orders/${currentOrderId}/items/${itemId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: newName }),
  });

  await loadOrder();
}

// VOID ITEM
async function voidItem(itemId) {
  const confirmVoid = confirm("Void this item?");
  if (!confirmVoid) return;

  await fetch(`/orders/${currentOrderId}/items/${itemId}`, { method: "DELETE" });
  await loadOrder();
}

// LOAD ORDER + CHANGES
async function loadOrder() {
  if (!currentOrderId) return;

  try {
    const res = await fetch(`/orders/${currentOrderId}`);
    const order = await res.json();

    const changesRes = await fetch(`/kitchen/orders/${currentOrderId}/changes`);
    const changes = await changesRes.json();

    renderItems(order.items, changes);
  } catch (err) {
    console.error(err);
  }
}

// RENDER ITEMS
function renderItems(items, changes) {
  itemsList.innerHTML = "";

  items.forEach(item => {
    const li = document.createElement("li");

    // Check if item was edited
    const editChange = changes.find(
      c => c.change_type === "ITEM_EDITED" && c.to_value === item.name
    );

    const voidChange = changes.find(
      c => c.change_type === "ITEM_VOIDED" && c.from_value === item.name
    );

    if (editChange) {
      // show old value crossed out
      const oldSpan = document.createElement("span");
      oldSpan.textContent = editChange.from_value;
      oldSpan.className = "item-voided";

      const arrow = document.createElement("span");
      arrow.textContent = " → ";

      const newSpan = document.createElement("span");
      newSpan.textContent = editChange.to_value;
      newSpan.className = "item-edited";

      li.appendChild(oldSpan);
      li.appendChild(arrow);
      li.appendChild(newSpan);
    } else if (voidChange) {
      li.textContent = item.name;
      li.className = "item-voided";
    } else {
      li.textContent = item.name;
    }

    // Status
    li.textContent += ` (${item.status || "pending"})`;

    // Buttons
    const editBtn = document.createElement("button");
    editBtn.textContent = "Edit";
    editBtn.onclick = () => editItem(item.id, item.name);
    editBtn.style.marginLeft = "10px";

    const voidBtn = document.createElement("button");
    voidBtn.textContent = "Void";
    voidBtn.onclick = () => voidItem(item.id);
    voidBtn.style.marginLeft = "5px";

    li.appendChild(editBtn);
    li.appendChild(voidBtn);

    itemsList.appendChild(li);
  });
}

// AUTO-REFRESH EVERY 2 SECONDS
setInterval(loadOrder, 2000);
