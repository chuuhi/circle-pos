const ordersDiv = document.getElementById("orders");

// Load all kitchen orders
async function loadKitchenOrders() {
  const res = await fetch("/kitchen/orders");
  const orders = await res.json();

  ordersDiv.innerHTML = "";

  for (const order of orders) {
    const div = document.createElement("div");
    div.className = "order";

    if (order.hasUnseenUpdates) {
      div.classList.add("updated");
    }

    const title = document.createElement("h3");
    title.textContent = `Order #${order.id}`;

    if (order.hasUnseenUpdates) {
      const badge = document.createElement("span");
      badge.textContent = "UPDATED";
      badge.className = "badge";
      title.appendChild(badge);
    }

    div.appendChild(title);

    const ul = document.createElement("ul");
    order.items.forEach(item => {
      const li = document.createElement("li");
      li.textContent = `${item.name} (${item.status})`;
      ul.appendChild(li);
    });

    div.appendChild(ul);

    // Load changes (edits and voids)
    await loadOrderChanges(order.id, div);

    const viewBtn = document.createElement("button");
    viewBtn.textContent = "Mark as Viewed";
    viewBtn.onclick = async () => {
      await fetch(`/kitchen/orders/${order.id}/view`, { method: "POST" });
      loadKitchenOrders();
    };

    div.appendChild(viewBtn);
    ordersDiv.appendChild(div);
  }
}

// Load changes for a single order
async function loadOrderChanges(orderId, container) {
  const res = await fetch(`/kitchen/orders/${orderId}/changes`);
  const changes = await res.json();

  if (changes.length === 0) return;

  const ul = document.createElement("ul");
  ul.className = "changes";

  changes.forEach(change => {
    const li = document.createElement("li");

    if (change.change_type === "ITEM_EDITED") {
      // old item crossed out
      const oldSpan = document.createElement("span");
      oldSpan.textContent = change.from_value;
      oldSpan.className = "strikethrough";
      li.appendChild(oldSpan);

      li.appendChild(document.createTextNode(" → "));

      // new item highlighted
      const newSpan = document.createElement("span");
      newSpan.textContent = change.to_value;
      newSpan.className = "item-edited";
      li.appendChild(newSpan);
    }

    if (change.change_type === "ITEM_VOIDED") {
      const voidSpan = document.createElement("span");
      voidSpan.textContent = change.from_value + " (Voided)";
      voidSpan.className = "strikethrough";
      li.appendChild(voidSpan);
    }

    if (change.change_type === "ITEM_STATUS_CHANGED") {
      li.textContent = `🍳 Status: ${change.from_value} → ${change.to_value}`;
    }

    ul.appendChild(li);
  });

  container.appendChild(ul);
}

// Refresh every 5 seconds
loadKitchenOrders();
setInterval(loadKitchenOrders, 5000);
