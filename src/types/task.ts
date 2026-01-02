export type TaskStatus = 'todo' | 'in_progress' | 'done';

export interface Task {
  id: string;
  title: string;
  icon: string;
  status: TaskStatus;
  created_at: string;
}
