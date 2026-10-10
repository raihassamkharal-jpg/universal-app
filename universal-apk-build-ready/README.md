# Local Message Hub

A modern international username-based messaging web application inspired by the simplicity of WhatsApp, featuring an original white and warm orange visual design.

---

## Features

- **Username-Based Discovery**: Register with your own unique `@username`. Search and connect with other users directly without revealing phone numbers.
- **Private 1-to-1 Conversations**: Isolated direct messaging protected by PostgreSQL Row Level Security (RLS).
- **Real-Time Delivery**: Sub-second message delivery and updates powered by Supabase Realtime WebSocket engine.
- **Unread Counters & Timestamps**: Accurate unread message indicators and clean localized timestamps.
- **Presence & Last Seen**: Lightweight online status and activity tracking.
- **Secure Authentication**: Email and password authentication with encrypted session tokens.
- **Responsive Interface**: Full-featured desktop layout with split chat view, and seamless mobile full-screen chat with back navigation.

---

## Supabase Database Setup

To initialize or upgrade the database tables, triggers, storage buckets, and Row Level Security policies:

1. Log into your [Supabase Dashboard](https://supabase.com/dashboard).
2. Open your project (or create a new one).
3. In the left navigation, click on **SQL Editor**.
4. Click **New query**.
5. Open `supabase/universal_final_migration.sql` from this repository, copy its entire contents, paste it into the SQL Editor, and click **Run**.
6. Under **Project Settings** → **API**, find:
   - **Project URL**
   - **anon / public key**

*(Note: In your Supabase Authentication settings, you can toggle "Enable email confirmations" on or off according to your preference).*

---

## Local Development Setup

1. Copy `.env.local.example` to `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```
2. Populate the two environment variables with your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```
5. Open `http://localhost:3000` in your browser.

---

## Netlify Deployment

This project is built and optimized for Netlify:

1. Push your repository to GitHub.
2. In [Netlify](https://app.netlify.com), click **Add new site** → **Import an existing project**.
3. Select your GitHub repository.
4. Set build settings:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
5. In **Environment variables**, add the same two variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
6. Click **Deploy Site**.
