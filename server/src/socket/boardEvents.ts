import { Server, Socket } from 'socket.io';
import { verifySocketToken } from '../middleware/auth';
import { Task } from '../models/Task';
import { Project } from '../models/Project';
import { ActivityLog } from '../models/ActivityLog';
import { redisClient } from '../services/redis';

interface MoveTaskPayload {
  taskId: string;
  fromColumn: string;
  toColumn: string;
  newPosition: number;
  projectId: string;
}

interface UpdateTaskPayload {
  taskId: string;
  projectId: string;
  changes: Partial<{
    title: string;
    description: string;
    assigneeId: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    storyPoints: number;
    dueDate: string;
    labels: string[];
  }>;
}

export function registerBoardEvents(io: Server, socket: Socket) {
  const userId = socket.data.userId;

  // Join a project room
  socket.on('board:join', async (projectId: string) => {
    try {
      // Verify user has access to project
      const hasAccess = await checkProjectAccess(userId, projectId);
      if (!hasAccess) {
        socket.emit('error', { message: 'Access denied' });
        return;
      }

      socket.join(`project:${projectId}`);

      // Track user presence in Redis
      await redisClient.sadd(`presence:${projectId}`, userId);
      await redisClient.expire(`presence:${projectId}`, 3600);

      // Broadcast updated online users list
      const onlineUsers = await redisClient.smembers(`presence:${projectId}`);
      io.to(`project:${projectId}`).emit('board:presence', { onlineUsers });

      socket.emit('board:joined', { projectId });
    } catch (err) {
      console.error('[Socket] board:join error', err);
    }
  });

  // Handle task drag-and-drop
  socket.on('task:move', async (payload: MoveTaskPayload) => {
    try {
      const { taskId, fromColumn, toColumn, newPosition, projectId } = payload;

      // Update in DB
      const task = await Task.findByIdAndUpdate(
        taskId,
        { status: toColumn, position: newPosition },
        { new: true }
      ).lean();

      if (!task) {
        socket.emit('error', { message: 'Task not found' });
        return;
      }

      // Log activity
      await ActivityLog.create({
        projectId,
        userId,
        action: 'task_moved',
        entityType: 'task',
        entityId: taskId,
        metadata: { fromColumn, toColumn },
      });

      // Broadcast to all users in the project room (including sender)
      io.to(`project:${projectId}`).emit('task:moved', {
        taskId,
        fromColumn,
        toColumn,
        newPosition,
        movedBy: userId,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[Socket] task:move error', err);
      socket.emit('error', { message: 'Failed to move task' });
    }
  });

  // Handle task field updates (title, assignee, priority etc.)
  socket.on('task:update', async (payload: UpdateTaskPayload) => {
    try {
      const { taskId, projectId, changes } = payload;

      const task = await Task.findByIdAndUpdate(taskId, changes, { new: true })
        .populate('assignee', 'name avatar')
        .lean();

      // Broadcast update to all other users in project
      socket.to(`project:${projectId}`).emit('task:updated', {
        taskId,
        changes,
        updatedBy: userId,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[Socket] task:update error', err);
    }
  });

  // Real-time cursor position (for live collaboration feel)
  socket.on('cursor:move', (payload: { projectId: string; x: number; y: number }) => {
    socket.to(`project:${payload.projectId}`).emit('cursor:updated', {
      userId,
      x: payload.x,
      y: payload.y,
    });
  });

  // Handle disconnect — remove from presence
  socket.on('disconnecting', async () => {
    const rooms = Array.from(socket.rooms).filter((r) => r.startsWith('project:'));
    for (const room of rooms) {
      const projectId = room.replace('project:', '');
      await redisClient.srem(`presence:${projectId}`, userId);
      const onlineUsers = await redisClient.smembers(`presence:${projectId}`);
      io.to(room).emit('board:presence', { onlineUsers });
    }
  });
}

async function checkProjectAccess(userId: string, projectId: string): Promise<boolean> {
  const cacheKey = `access:${userId}:${projectId}`;
  const cached = await redisClient.get(cacheKey);
  if (cached !== null) return cached === '1';

  const project = await Project.findOne({
    _id: projectId,
    $or: [{ ownerId: userId }, { 'members.userId': userId }],
  });

  const hasAccess = !!project;
  await redisClient.setex(cacheKey, 300, hasAccess ? '1' : '0');
  return hasAccess;
}
