import { Client } from 'pg';

const client = new Client({
  connectionString: 'postgresql://eventify:eventify@localhost:5432/eventify',
});

async function test() {
  try {
    await client.connect();
    const res = await client.query('SELECT current_database(), current_user, version()');
    console.log('Connected successfully!');
    console.log(res.rows[0]);
    await client.end();
  } catch (err) {
    console.error('Connection failed:', err.message);
    console.error(err);
  }
}

test();
