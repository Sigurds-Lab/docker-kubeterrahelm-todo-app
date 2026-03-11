const express = require('express');
const { Pool } = require('pg');
const redis = require('redis');
const app = express();
const port = 5000;

app.use(express.json());

// PostgreSQL connection
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  host: process.env.DB_HOST || 'db',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'todos'
});

// Redis client
const redisClient = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST || 'cache',
    port: parseInt(process.env.REDIS_PORT || '6379')
  }
});

redisClient.on('error', (err) => console.log('Redis Client Error', err));

// Connect to Redis with retry
redisClient.connect().catch(err => {
  console.error('Redis connection failed:', err);
});

// Initialize database
async function initDatabase() {
  const maxRetries = 10;
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS todos (
          id SERIAL PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          completed BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Database initialized - todos table ready');
      return;
    } catch (error) {
      attempt++;
      console.error(`⏳ Database init attempt ${attempt}/${maxRetries}:`, error.message);
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  console.error('❌ Failed to initialize database after max retries');
}

// GET /todos - Retrieve all todos (with caching)
app.get('/todos', async (req, res) => {
  try {
    // Check Redis cache first
    const cached = await redisClient.get('todos:all');
    if (cached) {
      console.log('📦 Serving from Redis cache');
      return res.json(JSON.parse(cached));
    }

    // If not in cache, query database
    console.log('🗄️  Fetching from database');
    const result = await pool.query('SELECT * FROM todos ORDER BY completed ASC, created_at DESC');
    const todos = result.rows;
    
    console.log(`📝 Found ${todos.length} todos`);

    // Store in Redis cache (expires in 60 seconds)
    await redisClient.setEx('todos:all', 60, JSON.stringify(todos));
    console.log('💾 Cached for 60 seconds');

    res.json(todos);
  } catch (error) {
    console.error('❌ Error fetching todos:', error);
    res.status(500).json({ error: 'Failed to fetch todos', details: error.message });
  }
});

// POST /todos - Create a new todo
app.post('/todos', async (req, res) => {
  const { title, description } = req.body;
  
  if (!title || title.trim() === '') {
    return res.status(400).json({ error: 'Title is required' });
  }

  try {
    console.log('Inserting todo:', { title, description });
    
    const result = await pool.query(
      'INSERT INTO todos (title, description) VALUES ($1, $2) RETURNING *',
      [title.trim(), (description || '').trim()]
    );

    console.log('Todo inserted successfully:', result.rows[0]);
    
    // Invalidate cache
    await redisClient.del('todos:all');
    console.log('Cache invalidated');

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Database error creating todo:', error);
    res.status(500).json({ error: 'Failed to create todo', details: error.message });
  }
});

// PUT /todos/:id - Mark todo as complete/incomplete
app.put('/todos/:id', async (req, res) => {
  const { id } = req.params;
  const { completed } = req.body;

  if (typeof completed !== 'boolean') {
    return res.status(400).json({ error: 'completed must be a boolean' });
  }

  try {
    console.log(`⏳ Marking todo ${id} as ${completed ? 'completed' : 'incomplete'}`);
    
    const result = await pool.query(
      'UPDATE todos SET completed = $1 WHERE id = $2 RETURNING *',
      [completed, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Todo not found' });
    }

    console.log(`✅ Todo ${id} updated:`, result.rows[0]);
    
    // Invalidate cache
    await redisClient.del('todos:all');
    console.log('Cache invalidated');

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Database error updating todo:', error);
    res.status(500).json({ error: 'Failed to update todo', details: error.message });
  }
});

// Health check
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    await pool.query('SELECT 1');
    // Check Redis connection
    await redisClient.ping();
    res.status(200).json({ 
      status: 'healthy',
      database: 'connected',
      cache: 'connected'
    });
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', error: error.message });
  }
});

// Start server
async function startServer() {
  await initDatabase();
  
  // Verify table exists
  try {
    const tableCheck = await pool.query(
      "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'todos')"
    );
    console.log('Todos table exists:', tableCheck.rows[0].exists);
  } catch (error) {
    console.error('Error verifying table:', error);
  }
  
  app.listen(port, '0.0.0.0', () => {
    console.log(`✅ API backend running on port ${port}`);
    console.log(`📦 Database: ${process.env.DB_HOST || 'db'}`);
    console.log(`💾 Cache: ${process.env.REDIS_HOST || 'cache'}`);
  });
}

startServer().catch(err => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});
