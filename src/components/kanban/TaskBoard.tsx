import { useState, useEffect } from 'react';
import { Task } from '@/types/task';
import { TaskItem } from './TaskItem';
import { Plus, ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';

const STORAGE_KEY = 'fortune-tasks';

const generateId = () => Math.random().toString(36).substring(2, 9);

export function TaskBoard() {
  const [tasks, setTasks] = useState<Task[]>([]);

  // Load tasks from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setTasks(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse stored tasks:', e);
      }
    }
  }, []);

  // Save tasks to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  const handleAddTask = () => {
    const newTask: Task = {
      id: generateId(),
      title: '',
      icon: '📝',
      status: 'todo',
      created_at: new Date().toISOString(),
    };
    setTasks((prev) => [...prev, newTask]);
  };

  const handleDeleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const handleUpdateTask = (id: string, updates: Partial<Task>) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        
        const newUpdates = { ...updates };
        
        // Track status change timestamps
        if (updates.status && updates.status !== t.status) {
          if (updates.status === 'in_progress') {
            newUpdates.blocked_at = new Date().toISOString();
            newUpdates.completed_at = undefined;
          } else if (updates.status === 'done') {
            newUpdates.completed_at = new Date().toISOString();
          } else if (updates.status === 'todo') {
            newUpdates.blocked_at = undefined;
            newUpdates.completed_at = undefined;
          }
        }
        
        return { ...t, ...newUpdates };
      })
    );
  };

  // Group tasks by status
  const todoTasks = tasks.filter((t) => t.status === 'todo');
  const inProgressTasks = tasks.filter((t) => t.status === 'in_progress');
  const doneTasks = tasks.filter((t) => t.status === 'done');

  const activeTasks = [...inProgressTasks, ...todoTasks];
  const hasNoTasks = tasks.length === 0;

  return (
    <div className="luxury-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-heading font-medium">Today's Tasks</h3>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleAddTask}
          className="h-8 w-8 p-0 hover:bg-gold/20"
        >
          <Plus size={18} className="text-gold" />
        </Button>
      </div>

      {hasNoTasks ? (
        <div className="text-center py-8">
          <ListChecks size={48} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No tasks yet</p>
          <p className="text-sm text-muted-foreground">
            Tap the + button to add your first task
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Active Tasks (In Progress + To Do) */}
          {activeTasks.length > 0 && (
            <div className="space-y-2">
              {activeTasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onDelete={handleDeleteTask}
                  onUpdate={handleUpdateTask}
                />
              ))}
            </div>
          )}

          {/* Completed Tasks */}
          {doneTasks.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Completed ({doneTasks.length})
              </p>
              {doneTasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onDelete={handleDeleteTask}
                  onUpdate={handleUpdateTask}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
