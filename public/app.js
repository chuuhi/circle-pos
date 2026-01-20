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
  

// RENDER ITEMS
function renderItems(items) {
