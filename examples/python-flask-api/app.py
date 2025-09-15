from flask import Flask, jsonify, request
import datetime
import time

app = Flask(__name__)

@app.route('/')
def hello():
    return jsonify({
        'message': 'Hello from aisanity sandboxed Python Flask API!',
        'timestamp': datetime.datetime.now().isoformat(),
        'environment': 'development'
    })

@app.route('/health')
def health():
    return jsonify({
        'status': 'OK',
        'uptime': time.time() - app.start_time if hasattr(app, 'start_time') else 0
    })

@app.route('/api/users')
def get_users():
    users = [
        {'id': 1, 'name': 'Alice', 'email': 'alice@aisanity.dev'},
        {'id': 2, 'name': 'Bob', 'email': 'bob@aisanity.dev'},
        {'id': 3, 'name': 'Charlie', 'email': 'charlie@aisanity.dev'}
    ]
    return jsonify({'users': users, 'count': len(users)})

@app.route('/api/users', methods=['POST'])
def create_user():
    data = request.get_json()

    if not data or not data.get('name') or not data.get('email'):
        return jsonify({'error': 'Name and email are required'}), 400

    new_user = {
        'id': int(time.time() * 1000),  # Simple ID generation
        'name': data['name'],
        'email': data['email'],
        'created_at': datetime.datetime.now().isoformat()
    }

    return jsonify({
        'message': 'User created successfully',
        'user': new_user
    }), 201

if __name__ == '__main__':
    app.start_time = time.time()
    print("🚀 Flask API server starting on http://localhost:5000")
    print("📝 Try: curl http://localhost:5000")
    print("💚 Health: curl http://localhost:5000/health")
    print("👥 Users: curl http://localhost:5000/api/users")
    app.run(host='0.0.0.0', port=5000, debug=True)