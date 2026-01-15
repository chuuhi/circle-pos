const { Pool } = require("pg");

const pool = new Pool({
  database: "pos_system",
});

module.exports = pool;
