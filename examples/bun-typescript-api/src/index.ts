const server = Bun.serve({
  port: process.env.PORT || 3000,
  fetch(req) {
    const url = new URL(req.url);

    // Root endpoint
    if (url.pathname === '/') {
      return Response.json({
        message: 'Hello from aisanity sandboxed Bun API!',
        timestamp: new Date().toISOString(),
        runtime: 'Bun',
        version: Bun.version
      });
    }

    // Health check endpoint
    if (url.pathname === '/health') {
      return Response.json({
        status: 'OK',
        uptime: process.uptime(),
        memory: process.memoryUsage()
      });
    }

    // Users API - GET
    if (url.pathname === '/api/users' && req.method === 'GET') {
      const users = [
        { id: 1, name: 'Alice', email: 'alice@aisanity.dev' },
        { id: 2, name: 'Bob', email: 'bob@aisanity.dev' },
        { id: 3, name: 'Charlie', email: 'charlie@aisanity.dev' }
      ];
      return Response.json({ users, count: users.length });
    }

    // Users API - POST
    if (url.pathname === '/api/users' && req.method === 'POST') {
      return req.json().then((body: any) => {
        const { name, email } = body;

        if (!name || !email) {
          return Response.json(
            { error: 'Name and email are required' },
            { status: 400 }
          );
        }

        const newUser = {
          id: Date.now(),
          name,
          email,
          createdAt: new Date().toISOString()
        };

        return Response.json(
          {
            message: 'User created successfully',
            user: newUser
          },
          { status: 201 }
        );
      });
    }

    // 404 for unknown routes
    return Response.json(
      { error: 'Not found' },
      { status: 404 }
    );
  }
});

console.log(`Bun API server running on http://localhost:${server.port}`);
console.log(`Try: curl http://localhost:${server.port}`);
console.log(`Health: curl http://localhost:${server.port}/health`);
console.log(`Users: curl http://localhost:${server.port}/api/users`);
console.log(`Performance: Bun's native HTTP server for maximum speed`);
