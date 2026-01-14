let currentOrderId = null;

const orderInfo = document.getElementById("orderInfo");
const itemsList = document.getElementById("itemsList");

document.getElementById("createOrderBtn").onclick = async () => {
  const res = await fetch("/orders", { method: "POST" });
  const order = await res.json();

  currentOrderId = order.id;
  orderInfo.textContent = `Order #${order.id} created`;
  itemsList.innerHTML = "";
};

document.getElementById("addItemBtn").onclick = async () => {
  if (!currentOrderId) return alert("Create an order first");

  const name = document.getElementById("itemName").value;
  if (!name) return;

  const res = await fetch(`/orders/${currentOrderId}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });

  const order = await res.json();
  renderItems(order.items);
};

document.getElementById("sendKitchenBtn").onclick = async () => {
  if (!currentOrderId) return;

  await fetch(`/orders/${currentOrderId}/send`, { method: "POST" });
  alert("Order sent to kitchen");
};

function renderItems(items) {
  itemsList.innerHTML = "";
  items.forEach(item => {
    const li = document.createElement("li");
    li.textContent = `${item.name} (${item.status || "pending"})`;
    itemsList.appendChild(li);
  });
}
