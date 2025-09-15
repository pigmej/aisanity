import express, { Request, Response } from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (_req: Request, res: Response) => {
  res.json({
    message: 'Hello from aisanity sandboxed TypeScript API!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'OK', uptime: process.uptime() });
});

app.get('/api/users', (_req: Request, res: Response) => {
  const users = [
    { id: 1, name: 'Alice', email: 'alice@aisanity.dev' },
    { id: 2, name: 'Bob', email: 'bob@aisanity.dev' },
    { id: 3, name: 'Charlie', email: 'charlie@aisanity.dev' }
  ];
  res.json({ users, count: users.length });
});

app.post('/api/users', (req: Request, res: Response) => {
  const { name, email } = req.body;

  if (!name || !email) {
    return res.status(400).json({
      error: 'Name and email are required'
    });
  }

  const newUser = {
    id: Date.now(),
    name,
    email,
    createdAt: new Date().toISOString()
  };

  res.status(201).json({
    message: 'User created successfully',
    user: newUser
  });
});

app.listen(PORT, () => {
  console.log(`🚀 TypeScript API server running on http://localhost:${PORT}`);
  console.log(`📝 Try: curl http://localhost:${PORT}`);
  console.log(`💚 Health: curl http://localhost:${PORT}/health`);
  console.log(`👥 Users: curl http://localhost:${PORT}/api/users`);
});