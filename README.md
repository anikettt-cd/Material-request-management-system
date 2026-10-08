# Material Request Management System 🏭

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688.svg)
![React](https://img.shields.io/badge/React-18.2.0-61dafb.svg)
![MySQL](https://img.shields.io/badge/MySQL-8.0+-4479A1.svg)

An enterprise-grade, full-stack Master Data Management (MDM) portal developed for Viraj Profiles Limited. This system digitizes, automates, and governs the SAP material request lifecycle. By replacing manual paperwork with a secure, automated digital pipeline, the application ensures high data integrity, eliminates duplicate entries, and strictly enforces organizational approval hierarchies before data reaches the central ERP system.

---

## ✨ Core Features & Capabilities

### 🛡️ Role-Based Access Control (RBAC) & Workflow
Strict permission modeling governs material requests through a multi-stage approval hierarchy:
1.  **Creator:** Initiates the material request with raw specifications.
2.  **Plant Head:** Reviews operational necessity and approves/rejects at the plant level.
3.  **Material Head:** Validates technical specifications and material group classifications.
4.  **Purchase / GST:** Assigns accurate valuation classes, purchasing groups, and GST control codes.
5.  **Store / IT Admin:** Finalizes master data and generates the official SAP Material Code.

### 🧠 Intelligent Duplicate Detection
*   **Fuzzy Matching:** Utilizes the `rapidfuzz` Python library to algorithmically parse text and scan historical database entries.
*   **Proactive Prevention:** Alerts approvers to potential duplicate material descriptions in real-time, preventing cluttered master data.

### 🔒 Enterprise Security
*   **Token-Based Auth:** Secure stateless authentication using JSON Web Tokens (JWT).
*   **Browser Security:** JWTs are stored in `HttpOnly` cookies to prevent Cross-Site Scripting (XSS) attacks, handled automatically by global Axios interceptors.
*   **Cryptography:** Passwords secured via Bcrypt hashing (`passlib`).

### ⚡ High-Performance Architecture
*   **FastAPI Backend:** Fully asynchronous, highly concurrent backend routing.
*   **Relational Mapping:** SQLAlchemy ORM coupled with MySQL connection pooling for efficient data querying (migrated from legacy MSSQL).
*   **Dynamic Frontend:** React and Vite deliver a seamless, Single Page Application (SPA) dashboard experience.

---

## 📂 Project Structure

```text
Material-Request-Management-System/
├── backend/
│   ├── main.py                 # FastAPI application entry point
│   ├── models.py               # SQLAlchemy database models
│   ├── schemas.py              # Pydantic validation schemas
│   ├── database.py             # MySQL connection & session management
│   ├── auth.py                 # JWT, Bcrypt, and Cookie handling
│   ├── .env                    # Backend environment variables
│   └── requirements.txt        # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── components/         # Reusable React UI components
│   │   ├── pages/              # Dashboard, Login, and Request views
│   │   ├── utils/              # apiClient.js (Axios configurations)
│   │   ├── App.jsx             # React router configuration
│   │   └── main.jsx            # React DOM rendering
│   ├── public/                 # Static assets
│   ├── .env                    # Frontend environment variables
│   ├── package.json            # Node.js dependencies
│   └── vite.config.js          # Vite build configuration
├── .gitignore                  # Git untracked files
└── README.md                   # Project documentation
## ⚙️ Installation & Local Setup

### 1. Prerequisites

* **Python 3.8+** installed on your machine.
* **Node.js (v16+)** and `npm` installed.
* **MySQL Server** running locally or remotely.

### 2. Database Initialization

Create a new MySQL database named `viraj_mdm_db`. Then, execute the following SQL to ensure the schema matches the ORM models (specifically handling stage redirection routing):

```sql
CREATE DATABASE viraj_mdm_db;
USE viraj_mdm_db;

-- Ensure the material_requests table can track returned/redirected workflows
ALTER TABLE material_requests 
ADD COLUMN redirected_from VARCHAR(50) DEFAULT NULL;

```

### 3. Backend Environment Setup

Open a terminal in the root directory:

```bash
# Navigate to the backend directory (if structured in a subfolder, otherwise stay in root)
cd backend

# Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate  # macOS/Linux
# .venv\Scripts\activate   # Windows

# Install Python dependencies
pip install -r requirements.txt

```

Create a `.env` file in your backend folder with the following credentials:

```env
# backend/.env
DATABASE_URL=mysql+pymysql://username:password@localhost:3306/viraj_mdm_db
JWT_SECRET_KEY=your_super_secret_jwt_key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=120

```

Start the backend server:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

```

*The FastAPI interactive API documentation will be available at `http://localhost:8000/docs`.*

### 4. Frontend Environment Setup

Open a second terminal window:

```bash
# Navigate to the frontend directory
cd frontend

# Install Node dependencies
npm install

```

Create a `.env` file inside the `frontend/` directory to link Axios to the backend:

```env
# frontend/.env
VITE_API_URL=http://localhost:8000

```

Start the Vite development server:

```bash
npm run dev

```

*The React dashboard will be available at `http://localhost:5173`.*

---

## 📡 API Reference (Core Endpoints)

| Method | Endpoint | Description | Auth Required |
| --- | --- | --- | --- |
| `POST` | `/api/login` | Authenticates user and sets `HttpOnly` cookie | No |
| `POST` | `/api/logout` | Clears the authentication cookie | Yes |
| `GET` | `/api/material_requests` | Fetches material requests based on user role | Yes |
| `POST` | `/api/material_requests` | Submits a new material creation request | Yes |
| `PUT` | `/api/material_requests/{id}` | Updates stage status (Approve/Reject/Redirect) | Yes |
| `POST` | `/api/check_duplicates` | Runs `rapidfuzz` analysis against existing materials | Yes |

---

## 👨‍💻 Author

**Aniket Saini**

*Information Technology Engineering Student (Pillai HOC College of Engineering and Technology, Mumbai University)*

Designed and engineered as a full-stack enterprise data initiative for Viraj Profiles Limited.
