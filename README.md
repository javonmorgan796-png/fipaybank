# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

---

## Backend (optional) — Node + MongoDB 🔧

This project includes a small Express + Mongoose server in `server/` to persist users in MongoDB. To run it locally:

1. Install server dependencies:

```sh
cd server
npm i
```

2. Create `server/.env` or copy `server/.env.example` and set `MONGODB_URI`.

Example MongoDB Atlas connection (replace `<db_password>` with your DB password):

```sh
MONGODB_URI=mongodb+srv://fipay-wallet_db:<db_password>@fipay-wallet.vrhx15k.mongodb.net/?appName=Fipay-wallet
```

```sh
cp server/.env.example server/.env
# or create server/.env and set MONGODB_URI as shown above
```

3. Start the server:

```sh
npm run dev --workspace ./server
# or, from server/ folder:
cd server && npm run dev
```

The frontend expects the API base URL at `VITE_API_BASE` (defaults to `http://localhost:5000`). You can add `VITE_API_BASE` to a root `.env.local` or use the example below.

### Environment example (root)

```
# .env.example (project root)
VITE_API_BASE=http://localhost:5000
```

After this, signing up in the app will create a user in MongoDB and the frontend `AuthContext` will use the API instead of localStorage.

Debugging: to list saved users when you're testing, enable debug mode before starting the server by adding `ENABLE_DEBUG=true` to `server/.env` and then visit `GET /api/debug/users` (only enabled when `ENABLE_DEBUG=true`). Do not enable this in production.

### Pending transfers (admin approval required)

Sending money now creates a pending transfer document in MongoDB that must be approved by an admin before balances are updated.

Key endpoints:

- POST `/api/transactions/send` — create a pending transfer
  - body: `{ senderId, recipientEmail, amount, crypto, symbol }`
  - returns: `{ success: true, status: 'pending', pending }`
- GET `/api/pending?recipientEmail=<email>` — list pendings for an email
- GET `/api/admin/pending` — list all pendings (admin)
- PUT `/api/admin/pending/:id/approve` — approve a pending transfer (admin)
- PUT `/api/admin/pending/:id/cancel` — cancel a pending transfer (admin)

Example (create pending):

```sh
curl -X POST http://localhost:5000/api/transactions/send -H "Content-Type: application/json" \
  -d '{"senderId":"<SENDER_ID>","recipientEmail":"bob@example.com","amount":10,"crypto":"btc","symbol":"BTC"}'
```

Example (approve as admin):

```sh
curl -X PUT http://localhost:5000/api/admin/pending/<PENDING_ID>/approve -H "Content-Type: application/json" \
  -H "x-admin: admin"
```
