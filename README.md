# 📋 CollabFlow — Real-Time Project Management Tool

A Jira/Trello-inspired project management platform with real-time collaboration, AI task suggestions, and team analytics. Built with MERN stack, Socket.io, Redis, and JWT-based RBAC.

![CollabFlow Preview](https://via.placeholder.com/1200x600/0f172a/3b82f6?text=CollabFlow+PM+Tool)

## Features

### Core PM Features
- **Kanban Board** — Drag-and-drop task management with custom columns
- **Sprint Planning** — Create sprints, assign story points, track velocity
- **Gantt Chart** — Visual project timeline with dependency mapping
- **Backlog Management** — Priority ordering, bulk actions, story points
- **Epics & Stories** — Hierarchical work breakdown structure

### Real-time Collaboration
- **Live Cursors** — See teammates' cursors on the board in real-time
- **Instant Updates** — Task changes propagate to all users instantly via Socket.io
- **Team Chat** — In-app messaging per project with @mentions
- **Activity Feed** — Live audit log of all project activity
- **Presence Indicators** — See who's online and what they're working on

### Access Control (RBAC)
- **Owner** — Full admin access, billing management
- **Admin** — Manage members, project settings
- **Member** — Create/edit tasks, comment, log time
- **Viewer** — Read-only access

### AI Features
- **Task Auto-suggest** — AI breaks down high-level goals into subtasks
- **Time Estimation** — GPT estimates effort based on task description + historical data
- **Risk Detection** — AI flags overdue tasks and team bottlenecks
- **Meeting Notes Summarizer** — Paste meeting transcript → AI creates action items

### Analytics
- **Burndown Charts** — Sprint progress visualization
- **Team Velocity** — Story points completed per sprint
- **Individual Metrics** — Task completion rate per member
- **Cycle Time** — Average time from "In Progress" to "Done"

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Tailwind CSS, Zustand |
| Real-time | Socket.io (bidirectional events) |
| Backend | Node.js, Express.js |
| Database | MongoDB + Mongoose |
| Cache & Sessions | Redis (ioredis) |
| Auth | JWT + Refresh Token Rotation |
| AI | OpenAI GPT-4o |
| Drag & Drop | @dnd-kit |
| Charts | Recharts |
| File Storage | AWS S3 (attachments) |

## Project Structure

```
├── client/                     # React frontend
│   └── src/
│       ├── components/
│       │   ├── board/
│       │   │   ├── KanbanBoard.tsx    # Drag-and-drop board
│       │   │   ├── TaskCard.tsx
│       │   │   └── ColumnHeader.tsx
│       │   ├── sprint/
│       │   │   ├── SprintPlanning.tsx
│       │   │   └── BurndownChart.tsx
│       │   └── chat/
│       │       └── TeamChat.tsx
│       ├── hooks/
│       │   ├── useSocket.ts          # Socket.io hook
│       │   ├── useBoard.ts
│       │   └── useRealtimeUpdates.ts
│       └── store/
│           ├── boardStore.ts
│           └── authStore.ts
│
├── server/                     # Node.js backend
│   └── src/
│       ├── socket/
│       │   ├── index.ts             # Socket.io server setup
│       │   ├── boardEvents.ts       # Board collaboration events
│       │   └── chatEvents.ts        # Team chat events
│       ├── routes/
│       │   ├── projects.ts
│       │   ├── tasks.ts
│       │   ├── sprints.ts
│       │   └── ai.ts
│       ├── middleware/
│       │   ├── auth.ts              # JWT verification
│       │   └── rbac.ts              # Role-based access control
│       └── models/
│           ├── Project.ts
│           ├── Task.ts
│           ├── Sprint.ts
│           └── User.ts
```

## Getting Started

```bash
# Clone & install
git clone https://github.com/sandeep-dev/collabflow-pm.git
cd collabflow-pm
npm run install:all

# Start Redis (required for sessions)
docker run -p 6379:6379 redis

# Configure env
cp server/.env.example server/.env

# Start development
npm run dev
```

## Socket.io Events

### Board Events
```javascript
// Client emits
socket.emit('task:move', { taskId, fromColumn, toColumn, position })
socket.emit('task:update', { taskId, changes })

// Server broadcasts to project room
socket.to(projectId).emit('task:moved', { taskId, ... })
socket.to(projectId).emit('user:cursor', { userId, position })
```

### Chat Events
```javascript
socket.emit('message:send', { projectId, content, mentions })
socket.on('message:new', (message) => { /* update UI */ })
```

## RBAC Implementation

```typescript
// Middleware example
const requireRole = (minRole: Role) => async (req, res, next) => {
  const member = await ProjectMember.findOne({
    projectId: req.params.projectId,
    userId: req.user.id,
  });

  if (!member || !hasPermission(member.role, minRole)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
};

// Usage
router.delete('/tasks/:id', requireRole('admin'), deleteTask);
router.patch('/tasks/:id', requireRole('member'), updateTask);
```

## 📄 License

MIT License
