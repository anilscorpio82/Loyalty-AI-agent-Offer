# Omnichannel Loyalty AI Agent

An enterprise-ready, AI-driven Loyalty Next Best Offer (NBO) Agent. This project leverages a microservices architecture to provide secure, real-time, and personalized loyalty recommendations. 

The system marries state-of-the-art Large Language Models (LLMs) with traditional, tabular Machine Learning (LightGBM) to create a conversational agent that acts strictly on mathematical conversion probabilities without hallucinating data.

---

## 🏗️ Architecture Architecture

The application is structured into four primary containerized components, working together in a Zero-Trust data flow architecture.

```mermaid
graph TD;
    %% User Interfaces
    User([fa:fa-user User]) -.-> |Interacts via Chat| Frontend;

    %% Services
    subgraph "Docker Compose Ecosystem"
        Frontend(fa:fa-desktop Next.js Frontend)
        Backend(fa:fa-server Node.js API Gateway)
        MLService(fa:fa-brain Python FastAPI ML Engine)
        DB[(fa:fa-database PostgreSQL + PostGIS)]
        Redis[(fa:fa-layer-group Redis Queue)]
    end

    %% External APIs
    LLM{{OpenAI GPT-4o}}
    PushNotifications{{FCM/APNs Mock}}

    %% Data Flow
    Frontend -->|JWT Authenticated Request| Backend;
    
    %% Internal Backend Flow
    subgraph "Backend Processing"
        Vault(fa:fa-shield PII Tokenizer Vault)
        Backend <-->|Strips Name/Email| Vault
        Worker(fa:fa-cogs BullMQ Worker)
    end
    
    Backend -.->|Enqueues Async Jobs| Redis;
    Redis -.->|Processes Jobs| Worker;
    Worker -.->|Sends Notifications| PushNotifications;
    
    Backend -->|1. Fetches User Context| DB;
    Backend -->|2. Requests NBO Probabilities| MLService;
    
    MLService -->|Reads Tabular Analytics| DB;
    MLService -->|Calculates LightGBM Tree Score| MLService;
    
    Backend -->|3. Sends Vaulted Context + ML Data| LLM;
    LLM -->|Streams SSE Response| Backend;
    Backend -->|Streams SSE Response| Frontend;

    %% Styling Elements
    classDef frontend fill:#3178c6,stroke:#fff,stroke-width:2px,color:#fff;
    classDef backend fill:#339933,stroke:#fff,stroke-width:2px,color:#fff;
    classDef ml fill:#3776ab,stroke:#fff,stroke-width:2px,color:#fff;
    classDef db fill:#336791,stroke:#fff,stroke-width:2px,color:#fff;
    classDef redis fill:#dc382d,stroke:#fff,stroke-width:2px,color:#fff;
    classDef vault fill:#e24329,stroke:#fff,stroke-width:2px,color:#fff;
    classDef openai fill:#10a37f,stroke:#fff,stroke-width:2px,color:#fff;
    classDef mobile fill:#fbbc04,stroke:#fff,stroke-width:2px,color:#fff;

    class Frontend frontend;
    class Backend backend;
    class Worker backend;
    class MLService ml;
    class DB db;
    class Redis redis;
    class Vault vault;
    class LLM openai;
    class PushNotifications mobile;
```

---

## 🚀 Key Features

1. **LightGBM NBO Prediction**: The Python microservice simulates a historical dataset, trains a Gradient Boosting Classifier, and dynamically predicts the probability of a user converting on an offer based on point balances and categories.
2. **Server-Sent Events (SSE)**: The backend securely proxies the OpenAI data stream, ensuring the UI feels interactive and real-time.
3. **PII Tokenizer Vault Stubs**: All routes pass through a `Vault.js` middleware. Real emails and names are stripped and replaced with deterministic HMAC-SHA256 tokens before hitting core API logic or external LLMs (GDPR / PCI Compliance).
4. **Asynchronous Push Queue**: A BullMQ/Redis worker runs in the background to handle long-running tasks, simulating out-of-band mobile push notifications without blocking the Express event loop.
5. **Geospatial Readiness**: The PostgreSQL image is injected with the `PostGIS` extension, and the Prisma schema supports `geometry` columns for future geofencing (Location-based offers).
6. **Enterprise Security**: Implements `express-rate-limit` for DoS protection, `helmet` for strict HTTP headers, parameterized SQL queries against SQLi, and explicit user consent scopes.

---

## 💻 Tech Stack

- **Frontend:** Next.js, NextAuth (Auth0 Mock), React, Tailwind
- **Backend:** Node.js, Express.js, Prisma ORM, BullMQ
- **Machine Learning:** Python, FastAPI, LightGBM, Pandas, Scikit-learn
- **Databases:** PostgreSQL 15, PostGIS, Redis 7
- **AI/LLM:** OpenAI Node SDK (`gpt-4o`)
- **DevOps:** Docker, Docker Compose

---

## 🛠️ Local Development Setup

### Prerequisites
- Docker & Docker Compose
- Node.js (v20+)
- Python (v3.10+)

### 1. Start the Data & ML Infrastructure
Boot up the PostgreSQL Database, Redis Queue, and Python ML Service using Docker:
```bash
docker-compose -f docker-compose.prod.yml up -d db redis ml-service
```

### 2. Configure Environment Variables
In the `backend` folder, copy `.env.example` to `.env` (or create one):
```env
DATABASE_URL="postgresql://postgres:postgrespassword@localhost:5432/loyaltydb"
REDIS_URL="redis://localhost:6379"
OPENAI_API_KEY="sk-your-openai-key-here"
FRONTEND_URL="http://localhost:3000"
VAULT_SECRET="your-secure-64-byte-salt"
```

### 3. Run the Backend & Frontend
```bash
# Terminal 1: Backend
cd backend
npm install
npx prisma db push
npm run dev

# Terminal 2: Frontend
cd frontend
npm install
npm run dev
```

### 4. Run the End-to-End Simulation Test
To verify the entire architecture is communicating correctly (Database -> Backend -> Redis -> ML Node -> LLM):
```bash
cd backend
node e2e_test.js
```
*This scripts mocks data seeding, invokes the prediction engine, processes the LLM stream, and outputs the console response.*
