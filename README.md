# Store Rating Web Application

A full-stack web application built with **Express.js**, **MySQL**, and **React + Vite** for managing stores, allowing normal users to rate them, and providing store owners and system admins with dedicated dashboard statistics.

---

## Project Structure

- **`/backend`**: Express.js server, MySQL database connection, authentication, and API endpoints.
- **`/frontend`**: React frontend built with Vite, utilizing vanilla CSS variables for a clean, modern UI.

---

## Setup & Running Guide

### 1. Prerequisites

Make sure you have the following installed on your system:
- **Node.js** (v16 or higher recommended)
- **npm** (comes with Node.js)
- **MySQL Server** (ensure the MySQL service is running)

---

### 2. Backend Configuration & Setup

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   A `.env` file is already provided under `/backend`. Open it and verify the database configuration:
   ```env
   PORT=5000
   DB_HOST=127.0.0.1
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   DB_NAME=store_rating_db
   JWT_SECRET=super_secret_jwt_token_for_authentication_123!
   ```
   *Note: Update `DB_USER` and `DB_PASSWORD` to match your local MySQL credentials.*

4. **Start the Backend Server:**
   You can start the backend in development mode (with hot-reloading via `nodemon`):
   ```bash
   npm run dev
   ```
   Or in normal start mode:
   ```bash
   npm start
   ```

   > [!NOTE]
   > On startup, the backend will **automatically** create the database (`store_rating_db`), construct all tables (`users`, `ratings`), and seed the default system administrator account if it doesn't already exist.

---

### 3. Frontend Setup & Run

1. **Open a new terminal and navigate to the frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the Vite Development Server:**
   ```bash
   npm run dev
   ```

4. **Open in Browser:**
   The dev server will output a local URL, typically:
   ```
   http://localhost:5173
   ```
   Open this URL in your web browser.

---

## Seeding & User Roles

When the database is initialized, it seeds a default **System Admin** user:
- **Email:** `admin@admin.com`
- **Password:** `Admin@123!`

### User Types & Capabilities:
1. **System Admin (`SYSTEM_ADMIN`)**:
   - Log in using `admin@admin.com`.
   - Access the Admin Dashboard.
   - Create new stores (created as `STORE_OWNER` accounts) and new normal users.
   - View list of all users, search, and filter.
   - View global system statistics (total users, total stores, total ratings given).

2. **Normal User (`NORMAL_USER`)**:
   - Sign up directly using the Signup page, or be created by an Admin.
   - Browse list of all registered stores with searching/sorting by name, address, or average rating.
   - Submit new ratings (1 to 5 stars) or modify their existing rating for any store.

3. **Store Owner (`STORE_OWNER`)**:
   - Accounts must be created/added by a System Admin.
   - Log in to see their specific store dashboard containing:
     - Average rating of their store.
     - Total number of ratings received.
     - List of users who rated their store along with their individual ratings.
