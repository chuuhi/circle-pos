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

    orders.forEach(order => {
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

      const viewBtn = document.createElement("button");
      viewBtn.textContent = "Mark as Viewed";
      viewBtn.onclick = async () => {
        await fetch(`/kitchen/orders/${order.id}/view`, {
          method: "POST",
        });
        loadKitchenOrders();
      };

      div.appendChild(viewBtn);
      ordersDiv.appendChild(div);
    });
  } catch (err) {
    console.error(err);
    ordersDiv.innerHTML = "<p>Error loading kitchen orders.</p>";
  }
}

loadKitchenOrders();
setInterval(loadKitchenOrders, 5000);
