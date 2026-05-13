const { Client } = require('pg');
const client = new Client({
  connectionString: "postgresql://postgres.eyiesvjnhntwcjqjrdap:Unihub%40123321%23@aws-1-ap-south-1.pooler.supabase.com:6543/postgres"
});
async function run() {
  await client.connect();
  const res = await client.query("SELECT id, title, ai_summary_status FROM workshops");
  console.log(res.rows);
  await client.end();
}
run().catch(console.error);
