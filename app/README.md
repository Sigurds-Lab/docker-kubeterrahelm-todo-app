# Multi-Service Todo Application

A simple **4-service** application demonstrating a microservices architecture with:
- **Frontend** (Node.js/Express UI)
- **API Backend** (Node.js/Express REST API)
- **PostgreSQL Database** (data persistence)
- **Redis Cache** (performance optimization)

All services communicate through Kubernetes networking.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   LoadBalancer Service             │
│                    :80 → frontend:3000             │
└──────────────────────┬──────────────────────────────┘
                       │
            ┌──────────▼──────────┐
            │   Frontend Pod      │
            │  (Node.js/Express)  │
            │   Port: 3000        │
            │  (serves HTML UI)   │
            └──────────┬──────────┘
                       │ http://api:5000
            ┌──────────▼──────────┐
            │    API Pod          │
            │  (Node.js/Express)  │
            │   Port: 5000        │
            │  (REST endpoints)   │
            └──────────┬──────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
┌───────▼────────┐          ┌────────▼─────────┐
│  PostgreSQL    │          │    Redis Cache   │
│   Database     │          │  (in-memory)     │
│   Port: 5432   │          │   Port: 6379     │
│  (todos table) │          │ (caches results) │
└────────────────┘          └──────────────────┘
```

## Services Breakdown

### 1. Frontend Service
**Role:** User Interface  
**Technology:** Node.js + Express + EJS templates  
**Port:** 3000  
**Responsibilities:**
- Serves HTML web interface
- Displays list of todos
- Handles form submissions (add todo)
- Makes HTTP calls to API backend

### 2. API Backend Service
**Role:** Business Logic  
**Technology:** Node.js + Express + PostgreSQL client + Redis client  
**Port:** 5000  
**Responsibilities:**
- REST API endpoints (`GET /todos`, `POST /todos`)
- Database queries (read/write todos)
- Redis caching (70% of reads served from cache)
- Health check endpoint

### 3. PostgreSQL Database Service
**Role:** Data Persistence  
**Technology:** PostgreSQL 15 (Alpine)  
**Port:** 5432  
**Responsibilities:**
- Stores all todos in a table
- ACID compliance
- Automatic schema creation

### 4. Redis Cache Service
**Role:** Performance Optimization  
**Technology:** Redis 7 (Alpine)  
**Port:** 6379  
**Responsibilities:**
- In-memory caching of todo lists
- 60-second TTL on cache entries
- Automatic cache invalidation on writes

## Quick Start

### Local Deployment with Docker Compose

```bash
# Navigate to app directory
cd app

# Build and start all services
docker-compose up --build

# Access the app
# Open http://localhost:3000 in your browser
```

**Expected output:**
```
frontend_1  | Frontend running on port 3000
api_1       | API backend running on port 5000
db_1        | database system is ready to accept connections
cache_1     | The server is now ready to accept connections on port 6379
```

### Kubernetes Deployment

```bash
# Deploy to local cluster (Docker Desktop / minikube / kind)
kubectl apply -k app/k8s/

# Check services
kubectl get all -n todo-app

# Get LoadBalancer IP (or localhost)
kubectl get svc frontend -n todo-app -w

# Access the app
# Open http://localhost (or EXTERNAL-IP) in your browser
```

**Verify all services:**
```bash
# Check pod status
kubectl get pods -n todo-app

# Check services running
kubectl get svc -n todo-app

# Watch HPA scaling
kubectl get hpa -n todo-app -w

# Check pod resource usage
kubectl top pods -n todo-app
```

## Service Communication

### Frontend → API
```javascript
// Frontend calls API at http://api:5000
const response = await axios.get('http://api:5000/todos');
```

### API → Database
```javascript
// API queries PostgreSQL
const result = await pool.query('SELECT * FROM todos');
```

### API → Cache
```javascript
// API checks Redis first before hitting database
const cached = await redisClient.get('todos:all');
```

### Show the Structure
```bash
# Show application code
tree app/
```

Output:
```
app/
├── frontend/              # UI Service
│   ├── index.js           # Express app
│   ├── views/index.ejs    # HTML template
│   ├── package.json
│   └── Dockerfile
├── api/                   # API Service
│   ├── index.js           # REST endpoints
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml     # Local orchestration
└── k8s/                   # Kubernetes manifests
    ├── 00-namespace-config.yaml
    ├── 01-database.yaml       # PostgreSQL
    ├── 02-cache.yaml          # Redis
    ├── 03-api.yaml            # API backend
    ├── 04-frontend.yaml       # Frontend UI
    ├── 05-hpa.yaml            # Autoscaling
    └── kustomization.yaml
```

### Show Local Deployment
```bash
# Start with docker-compose
cd app
docker-compose up --build

# Test the app
curl http://localhost:3000
curl http://localhost:5000/todos

# Show logs
docker-compose logs -f frontend
```

### Show Kubernetes Deployment
```bash
# Deploy to cluster
kubectl apply -k app/k8s/

# Show all resources
kubectl get all -n todo-app

# Show service dependencies
kubectl describe pod frontend-xxx -n todo-app   # Shows init container waits for API
kubectl describe pod api-xxx -n todo-app        # Shows init container waits for DB

# Test autoscaling
kubectl port-forward svc/frontend 80:80 -n todo-app
# In another terminal, generate load
while true; do curl http://localhost; sleep 0.1; done

# Watch HPA scale up
kubectl get hpa frontend-hpa -n todo-app -w
```

## Performance Notes

### Cache Hit Rate
- First request: Hits database (slow)
- Subsequent requests: Served from Redis (fast)
- Cache invalidates after 60 seconds OR on write

### Typical Performance
- Uncached request: 50-100ms (database query)
- Cached request: 1-5ms (Redis fetch)
- **Performance improvement: 10-50x faster**

## Scaling Example

### Local (Docker Compose)
```bash
# Scale API to 3 replicas
docker-compose up --scale api=3
```

### Kubernetes (Automatic)
```bash
# HPA automatically scales when CPU > 70% or Memory > 80%
kubectl get hpa -n todo-app -w

# Manual scaling (for testing)
kubectl scale deployment api --replicas=3 -n todo-app
```

## File Sizes
- Frontend: ~5MB (Node.js image + code)
- API: ~5MB (Node.js image + code)
- Database: ~180MB (PostgreSQL image)
- Cache: ~8MB (Redis image)
- **Total: ~200MB**

## Troubleshooting

### Frontend can't reach API
```bash
# Check if API service is running
kubectl get svc api -n todo-app

# Check frontend logs
kubectl logs -l app=frontend -n todo-app
```

### API can't reach database
```bash
# Check if database pod is ready
kubectl get pods -n todo-app

# Check API logs
kubectl logs -l app=api -n todo-app
```

### Redis not working
```bash
# Check cache pod
kubectl describe pod -l app=cache -n todo-app
```