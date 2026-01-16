CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  sent_to_kitchen BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  last_kitchen_viewed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS order_changes (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  item_id INTEGER REFERENCES items(id) ON DELETE SET NULL,
  change_type TEXT NOT NULL,
  from_value TEXT,
  to_value TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
