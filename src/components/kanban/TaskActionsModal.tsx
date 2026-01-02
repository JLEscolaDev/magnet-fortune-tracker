import { useState, useRef, useEffect } from 'react';
import { Task, TaskStatus } from '@/types/task';
import { X, Check, Clock, ListTodo, Trash } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TaskActionsModalProps {
  task: Task;
  onClose: () => void;
  onStatusChange: (status: TaskStatus) => void;
  onUpdateTitle: (title: string) => void;
  onDelete: () => void;
}

const STATUS_OPTIONS: { value: TaskStatus; label: string; icon: React.ReactNode }[] = [
  { value: 'todo', label: 'To Do', icon: <ListTodo size={16} /> },
  { value: 'in_progress', label: 'In Progress', icon: <Clock size={16} /> },
  { value: 'done', label: 'Done', icon: <Check size={16} /> },
];

export function TaskActionsModal({
  task,
  onClose,
  onStatusChange,
  onUpdateTitle,
  onDelete,
}: TaskActionsModalProps) {
  const [title, setTitle] = useState(task.title);
  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        handleSave();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [title]);

  const handleSave = () => {
    if (title.trim() && title !== task.title) {
      onUpdateTitle(title.trim());
    } else {
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        ref={modalRef}
        className="w-full max-w-sm bg-popover border border-border rounded-xl p-4 space-y-4 shadow-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-lg">{task.icon}</span>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-accent transition-colors"
          >
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>

        {/* Title Input */}
        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Task name..."
          className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/50 text-foreground"
        />

        {/* Status Options */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Status</p>
          <div className="grid grid-cols-3 gap-2">
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => onStatusChange(option.value)}
                className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all ${
                  task.status === option.value
                    ? 'border-gold bg-gold/10 text-gold'
                    : 'border-border hover:border-gold/50 text-muted-foreground hover:text-foreground'
                }`}
              >
                {option.icon}
                <span className="text-xs">{option.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Delete Button */}
        <Button
          variant="ghost"
          onClick={onDelete}
          className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash size={16} className="mr-2" />
          Delete Task
        </Button>
      </div>
    </div>
  );
}
