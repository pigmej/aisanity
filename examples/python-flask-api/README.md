# Python Flask API Example

A simple Flask REST API demonstrating aisanity usage with Python devcontainers.

## 🚀 Quick Start with Aisanity

1. **Navigate to this example:**
   ```bash
   cd examples/python-flask-api
   ```

2. **Initialize aisanity workspace:**
   ```bash
   aisanity init
   ```

3. **Run the Flask application:**
   ```bash
   aisanity run python app.py
   ```

4. **Test the API:**
   ```bash
   # In another terminal
   aisanity run curl http://localhost:5000
   aisanity run curl http://localhost:5000/health
   aisanity run curl http://localhost:5000/api/users
   ```

5. **Stop containers:**
   ```bash
   aisanity stop
   ```

## 🏗️ Manual Development

1. **Build the container:**
   ```bash
   devcontainer build
   ```

2. **Open in container:**
   ```bash
   devcontainer open
   ```

3. **Install dependencies:**
   ```bash
   uv sync
   ```

4. **Run the application:**
   ```bash
   python app.py
   ```

## 🔧 Opencode Integration

This example includes **opencode** (aisanity CLI) pre-installed in the container! Once the devcontainer is built, you can use opencode commands directly:

```bash
# Use opencode from within the container
opencode --help
opencode status
opencode run echo "Hello from opencode!"

# The container has access to opencode because it's installed globally
# during the postCreateCommand phase
```

## 📋 API Endpoints

- `GET /` - Welcome message with timestamp
- `GET /health` - Health check with uptime
- `GET /api/users` - List all users
- `POST /api/users` - Create a new user

### Example API Usage

```bash
# Get welcome message
curl http://localhost:5000

# Health check
curl http://localhost:5000/health

# Get users
curl http://localhost:5000/api/users

# Create a user
curl -X POST http://localhost:5000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name": "John Doe", "email": "john@example.com"}'
```

## 🛠️ Development Commands

```bash
# Run the Flask app
python app.py

# Run with specific host/port
python app.py --host 0.0.0.0 --port 5000

# Install dependencies
uv sync

# Run in production mode (without debug)
FLASK_ENV=production python app.py
```

## 📁 Project Structure

```
python-flask-api/
├── app.py                 # Main Flask application
├── requirements.txt       # Python dependencies
├── .devcontainer/         # Devcontainer configuration
│   ├── devcontainer.json
│   └── Dockerfile
└── README.md             # This file
```

## 🔧 Technologies Used

- **Python 3.11** - Runtime environment
- **Flask** - Web framework
- **Devcontainers** - Development environment

## 🔒 Sandboxed Development Benefits

Using aisanity provides:
- **Clean Environment** - Isolated Python environment
- **Dependency Management** - No conflicts with system Python
- **Consistent Setup** - Same environment across team members
- **Easy Cleanup** - Clean teardown with `aisanity stop`
- **IDE Integration** - Full VS Code Python support via devcontainers