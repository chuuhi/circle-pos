const ordersDiv = document.getElementById("orders");

async function loadKitchenOrders() {
  try {
    const res = await fetch("/kitchen/orders");
    const orders = await res.json();

    ordersDiv.innerHTML = "";

    if (orders.length === 0) {
      ordersDiv.innerHTML = "<p>No orders in kitchen.</p>";
      return;
    }

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

      // Items list
      const ul = document.createElement("ul");
      order.items.forEach(item => {
        const li = document.createElement("li");
        li.textContent = `${item.name} (${item.status})`;

        // Highlight edited items
        const editedChanges = order.changes?.filter(
          c => c.change_type === "ITEM_EDITED" && c.item_id === item.id
        );
        if (editedChanges && editedChanges.length > 0) {
          li.classList.add("item-edited");
        }

        ul.appendChild(li);
      });
      div.appendChild(ul);

      // Inline change log
      if (order.changes && order.changes.length > 0) {
        const changesTitle = document.createElement("p");
        changesTitle.textContent = "Recent changes:";
        changesTitle.style.fontWeight = "bold";
        div.appendChild(changesTitle);

        const changesUl = document.createElement("ul");
        changesUl.className = "changes";

        order.changes.forEach(change => {
          const li = document.createElement("li");

          if (change.change_type === "ITEM_EDITED") {
            li.textContent = `✏️ Edited: ${change.from_value} → ${change.to_value}`;
          }

          if (change.change_type === "ITEM_VOIDED") {
            li.textContent = `❌ Voided: ${change.from_value}`;
          }

          if (change.change_type === "ITEM_STATUS_CHANGED") {
            li.textContent = `🍳 Status: ${change.from_value} → ${change.to_value}`;
          }

          changesUl.appendChild(li);
        });

        div.appendChild(changesUl);
      }

      // Mark as viewed button
      const viewBtn = document.createElement("button");
      viewBtn.textContent = "Mark as Viewed";
      viewBtn.onclick = async () => {
        await fetch(`/kitchen/orders/${order.id}/view`, { method: "POST" });
        loadKitchenOrders();
      };

      div.appendChild(viewBtn);
      ordersDiv.appendChild(div);
    }
  } catch (err) {
    console.error(err);
    ordersDiv.innerHTML = "<p>Error loading kitchen orders.</p>";
  }
}

// Auto-fetch change logs (optional if not included in /kitchen/orders)
async function loadOrderChanges(orderId) {
  const res = await fetch(`/kitchen/orders/${orderId}/changes`);
  return await res.json();
}

// Initial load + polling every 5 seconds
loadKitchenOrders();
setInterval(loadKitchenOrders, 5000);
