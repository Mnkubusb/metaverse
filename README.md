# 🌐 VirtuSpace — A 2D Metaverse Platform

Welcome to **VirtuSpace**, a real-time 2D metaverse where users can explore, interact, and collaborate in custom-built virtual spaces. Whether it's virtual classrooms, office rooms, lounges, or event halls, VirtuSpace enables meaningful digital presence through pixel-art environments and seamless multiplayer interactions.

---

## 🚀 Features

- 🗺️ **Interactive 2D Worlds**  
  Walk, sit, and chat in tile-based spaces designed for social and professional engagement.

- 🎨 **Map Editor (ZEP-style)**  
  Build and customize rooms like offices, cafés, or campuses with a drag-and-drop canvas editor.

- 🧍‍♂️ **Multiplayer Avatars**  
  See others in real time. Each user has a pixel avatar with emotes and presence indicators.

- 🧠 **AI-Powered Assistance** *(Coming Soon)*  
  Virtual assistant NPCs and productivity bots using LLMs.

- 💬 **Real-Time Chat & Proximity Voice** *(Coming Soon)*  
  Chat publicly or initiate private voice conversations based on avatar proximity.

- 🔐 **Authentication & Room Permissions**  
  Role-based access for rooms: Admins, Members, Guests.

- 📦 **Plugin Architecture**  
  Extend the platform with custom widgets, games, or tools inside rooms.

---

## 🛠️ Built With

- **Frontend**: Next.js, TailwindCSS, Canvas API
- **Backend**: Node.js, WebSocket
- **Database**: PostgreSQL with Prisma ORM  
- **Realtime**: Liveblocks + Custom WebSocket layers  
- **Assets**: Custom 32×32 pixel sprites (top-down RPG style)

---

## 📸 Preview

![GEC Bilaspur campus map](./tools/campus-map/preview.png)

The default map is a stylized **GEC Bilaspur (Koni) campus**: main gate on Korba Road, admin block with the flag and fountain plaza, the seven department blocks, central library, workshop, auditorium, canteen, dispensary, sports ground, and the boys', girls' and first-year hostels.

---

## 🧪 How to Run Locally

```bash
# 1. Clone the repo
git clone https://github.com/Mnkubusb/metaverse.git
cd metaverse

# 2. Install dependencies
pnpm install

# 3. Setup environment variables
cp .env.example .env
# The default DATABASE_URL points to the local Docker Postgres instance

# 4. Start Postgres
pnpm db:up

# 5. Apply the existing Prisma migrations
pnpm db:migrate

# 6. Generate Prisma client
pnpm db:generate

# 7. Seed the element catalogue, avatars and the default GEC Bilaspur campus map (safe to re-run)
pnpm db:seed

# 8. Run the apps
pnpm start:http
pnpm start:ws
pnpm --dir apps/web run dev
```

The local services will be available at:

- Web app: `http://localhost:3002`
- HTTP API: `http://localhost:3000/api/v1`
- WebSocket server: `ws://localhost:3001`
- Postgres: `postgresql://postgres:postgres@localhost:5433/metaverse`

If you were previously using a Neon connection string, replace it in your local `.env` with the Docker URL from `.env.example`.

### Checks

Every pull request and push to `main` runs `.github/workflows/ci.yml`: typecheck, lint and build all
three apps, migrate and seed a fresh Postgres, start the API and WebSocket servers, and run
`scripts/smoke-test.mjs` (sign-up, permissions, space creation, movement, presence, chat, emotes).
Run the smoke test locally against your own servers with `node scripts/smoke-test.mjs`.

### Admin accounts

Sign-up always creates a regular user. To give an account admin access (map editor, elements, avatars):

```bash
pnpm db:make-admin <username>   # then sign in again to get an admin token
```

### Deploying

| Part | Host | Why |
|---|---|---|
| Web app (`apps/web`) | Vercel | Next.js |
| HTTP API (`apps/http`) | Vercel (serverless function) | Express runs as one function via `apps/http/api/index.ts` |
| WebSocket server (`apps/ws`) | Render (free web service, Docker) | Vercel functions can't hold WebSocket connections open |
| Database | Neon Postgres | reachable from both |

Secrets live only in each host's environment settings, never in git or Docker images.
Generate the JWT secret once with `openssl rand -base64 48` and use the **same** value on Vercel and Render.

**1. Database (Neon).** Run the migrations and seed from your machine with the Neon URL in `.env`:

```bash
pnpm db:migrate && pnpm db:seed
pnpm db:make-admin <your-username>   # after signing up on the live site
```

**2. API on Vercel.** New Project → import this repo → Root Directory `apps/http` (framework: Other;
`apps/http/vercel.json` sets the rest). Environment variables:

```bash
DATABASE_URL=<Neon connection string>
JWT_SECRET=<the shared secret>
ALLOWED_ORIGIN=https://<your-web-app>.vercel.app   # comma-separate extra origins, e.g. a preview URL
```

The API is then served at `https://<api-project>.vercel.app/api/v1`.

**3. WebSocket server on Render.** Dashboard → New → Blueprint → this repo. `render.yaml` creates
`metaverse-ws`; fill in `DATABASE_URL` and `JWT_SECRET`. It's served at `wss://metaverse-ws-xxxx.onrender.com`.
Free Render services sleep after 15 minutes without traffic and take about a minute to wake up.

**4. Web app on Vercel.** In the existing web project, set:

```bash
NEXT_PUBLIC_API_URL=https://<api-project>.vercel.app/api/v1
NEXT_PUBLIC_WS_URL=wss://metaverse-ws-xxxx.onrender.com
```

and redeploy. With `NODE_ENV=production`, the API and WebSocket server refuse to start with a
`JWT_SECRET` shorter than 32 characters.

The Docker images in `docker/` still work on any container host (pass the same variables with
`--env-file`). The old EC2 workflows in `.github/workflows` now only run when started by hand.

### Avatars

The eight avatars (Classic, CSE Blue, Crimson, Forest, Violet, Rose, Charcoal, Teal) are recoloured
versions of `apps/web/public/Characters/WalkAnimations.png`, generated by `tools/avatars/generate.py`
into `apps/web/public/avatars/`. Edit `VARIANTS` there, re-run it, then `pnpm db:seed`.
Players pick one from the **Avatar** button in a space or **My avatar** on the dashboard; the change
shows up live for everyone in the space.

### Editing the campus map

The campus art and layout are generated by `tools/campus-map/generate.py` (needs Python 3 + Pillow).
Edit the `build_layout()` function to move buildings, then:

```bash
python3 tools/campus-map/generate.py   # writes apps/web/public/campus/*.png and packages/db/prisma/maps/gec-bilaspur.json
pnpm db:seed                           # updates the map template in the database
```

The generator checks that nothing overlaps and that every building door can be reached from the spawn point.
New spaces created from the template pick up the changes; existing spaces keep their own copy.

Element layers control drawing order and collision:

| Layer        | Drawn                              | Blocks movement (when `static`) |
|--------------|------------------------------------|---------------------------------|
| `floor`      | first                              | never                           |
| `wall`       | after floor                        | whole footprint                 |
| `objects`    | depth-sorted with players          | bottom row only                 |
| `topObjects` | above players                      | never                           |

---

## 📁 Project Structure

```
/ws                 # WebSocket Layer
/http               # Backend Layer
/web                # Frontend
/public/assets      # Sprites, tilesets, UI icons
/components         # Reusable UI and game logic components
/lib                # Utility functions
/db                 # Database schema and migrations
```

---

## 🧠 Future Roadmap

- 🌍 User-generated worlds with teleportation
- 📱 Mobile support
- 🕹️ Mini-games inside rooms
- 🌐 Public and private metaverse hubs
- 🤖 AI-generated room layout suggestions

---

## 🤝 Contributing

Contributions, ideas, and feedback are welcome!  
1. Fork the project  
2. Create a feature branch  
3. Submit a pull request  
4. Join the Discord (coming soon) to collaborate live!

---

## 📄 License

This project is licensed under the MIT License.

---

## 👨‍💻 Built by Manik Chand Sahu

> Full-stack Web Developer | Next.js Expert | Building immersive digital experiences

[🔗 Portfolio](https://manik-chand-sahu.vercel.app) • [🐦 Twitter](https://twitter.com/ManikChandSahu6) • [💼 LinkedIn](https://linkedin.com/in/manik-chand-sahu)
