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

![VirtuSpace Screenshot](./assets/virtu-preview.gif)

---

## 🧪 How to Run Locally

```bash
# 1. Clone the repo
git clone https://github.com/Mnkubusb/metaverse.git
cd metaverse

# 2. Install dependencies
npm install

# 3. Setup environment variables
cp .env.example .env
# Fill in your DB credentials and Liveblocks API keys

# 4. Run the development server
npm run dev
```

> The app will be available at `http://localhost:3000`

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
