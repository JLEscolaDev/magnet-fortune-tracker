export type TaskStatus = 'todo' | 'in_progress' | 'done';

export interface Task {
  id: string;
  user_id: string;
  title: string;
  icon: string;
  status: TaskStatus;
  created_at: string;
  blocked_at: string | null;
  completed_at: string | null;
}
