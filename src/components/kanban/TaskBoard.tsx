import { useState, useEffect } from 'react';
import { Task, TaskStatus } from '@/types/task';
import { TaskItem } from './TaskItem';
import { Plus, ListChecks, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/auth/AuthProvider';
import { toast } from 'sonner';

export function TaskBoard() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // Load tasks from Supabase
  useEffect(() => {
    if (!user) return;

    const fetchTasks = async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .neq('status', 'done')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching tasks:', error);
        toast.error('Failed to load tasks');
      } else {
        setTasks((data || []).map(t => ({ ...t, status: t.status as TaskStatus })));
      }
      setLoading(false);
    };

    fetchTasks();
  }, [user]);

  const handleAddTask = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        user_id: user.id,
        title: '',
        icon: '📝',
        status: 'todo',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating task:', error);
      toast.error('Failed to create task');
    } else if (data) {
      setTasks((prev) => [{ ...data, status: data.status as TaskStatus }, ...prev]);
    }
  };

  const handleDeleteTask = async (id: string) => {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting task:', error);
      toast.error('Failed to delete task');
    } else {
      setTasks((prev) => prev.filter((t) => t.id !== id));
    }
  };

  const handleUpdateTask = async (id: string, updates: Partial<Task>) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    const newUpdates: Partial<Task> = { ...updates };

    // Track status change timestamps
    if (updates.status && updates.status !== task.status) {
      if (updates.status === 'in_progress') {
        newUpdates.blocked_at = new Date().toISOString();
        newUpdates.completed_at = null;
      } else if (updates.status === 'done') {
        newUpdates.completed_at = new Date().toISOString();
      } else if (updates.status === 'todo') {
        newUpdates.blocked_at = null;
        newUpdates.completed_at = null;
      }
    }

    // If marking as done, convert to Fortune and remove from tasks
    if (updates.status === 'done' && task.title.trim()) {
      try {
        // Create fortune with "Tasks" category
        const { error: fortuneError } = await supabase.rpc('fortune_add', {
          p_text: task.title,
          p_category: 'Tasks',
          p_level: 1,
          p_impact_level: 'small_step',
        });

        if (fortuneError) {
          console.error('Error creating fortune:', fortuneError);
          toast.error('Failed to convert task to fortune');
          return;
        }

        // Delete the task after converting to fortune
        const { error: deleteError } = await supabase
          .from('tasks')
          .delete()
          .eq('id', id);

        if (deleteError) {
          console.error('Error deleting completed task:', deleteError);
        }

        // Remove from local state
        setTasks((prev) => prev.filter((t) => t.id !== id));
        toast.success('Task completed and added to Fortunes!');
        return;
      } catch (err) {
        console.error('Error completing task:', err);
        toast.error('Failed to complete task');
        return;
      }
    }

    // Regular update (not completing)
    const { error } = await supabase
      .from('tasks')
      .update(newUpdates)
      .eq('id', id);

    if (error) {
      console.error('Error updating task:', error);
      toast.error('Failed to update task');
    } else {
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...newUpdates } : t))
      );
    }
  };

  // Group tasks by status
  const todoTasks = tasks.filter((t) => t.status === 'todo');
  const inProgressTasks = tasks.filter((t) => t.status === 'in_progress');

  const activeTasks = [...inProgressTasks, ...todoTasks];
  const hasNoTasks = tasks.length === 0;

  if (loading) {
    return (
      <div className="luxury-card p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gold" />
        </div>
      </div>
    );
  }

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
    </div>
  );
}
