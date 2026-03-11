const express = require('express');
const axios = require('axios');
const app = express();
const port = 3000;

app.use(express.static('public'));
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Homepage - shows list of todos
app.get('/', async (req, res) => {
  try {
    const response = await axios.get('http://api:5000/todos');
    res.render('index', { todos: response.data, error: null });
  } catch (error) {
    console.error('Error fetching todos:', error.message);
    res.render('index', { todos: [], error: 'Failed to load todos' });
  }
});

// Add todo form submission
app.post('/add-todo', async (req, res) => {
  try {
    const { title, description } = req.body;
    
    if (!title || title.trim() === '') {
      return res.status(400).send('Title is required');
    }
    
    console.log('Adding todo:', { title, description });
    
    const response = await axios.post('http://api:5000/todos', { 
      title: title.trim(),
      description: description ? description.trim() : ''
    });
    
    console.log('Todo added successfully:', response.data);
    res.redirect('/');
  } catch (error) {
    console.error('Error adding todo:', error.response?.data || error.message);
    return res.status(500).send(`Error adding todo: ${error.response?.data?.error || error.message}`);
  }
});

// Mark todo as complete/incomplete
app.post('/complete-todo', async (req, res) => {
  try {
    const { id, completed } = req.body;
    
    if (!id) {
      return res.status(400).json({ error: 'Todo ID is required' });
    }
    
    console.log(`Marking todo ${id} as ${completed ? 'complete' : 'incomplete'}`);
    
    const response = await axios.put(`http://api:5000/todos/${id}`, { 
      completed: completed === 'true' || completed === true
    });
    
    console.log('Todo marked successfully:', response.data);
    res.json({ success: true, data: response.data });
  } catch (error) {
    console.error('Error completing todo:', error.response?.data || error.message);
    return res.status(500).json({ error: error.response?.data?.error || error.message });
  }
});

// Health check for Kubernetes
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`✅ Frontend running on port ${port}`);
  console.log(`🔗 API Backend: http://api:5000`);
  console.log(`🌐 Open browser to: http://localhost:${port}`);
});
