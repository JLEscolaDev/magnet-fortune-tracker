import { useState, useRef, useEffect } from 'react';
import { Task, TaskStatus } from '@/types/task';
import { EmojiPicker } from './EmojiPicker';
import { TaskActionsModal } from './TaskActionsModal';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';

interface TaskItemProps {
  task: Task;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Task>) => void;
}

export function TaskItem({ task, onDelete, onUpdate }: TaskItemProps) {
  const [isEditing, setIsEditing] = useState(task.title === '');
  const [title, setTitle] = useState(task.title);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleSave = () => {
    if (title.trim()) {
      onUpdate(task.id, { title: title.trim() });
      setIsEditing(false);
    } else {
      onDelete(task.id);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      if (task.title) {
        setTitle(task.title);
        setIsEditing(false);
      } else {
        onDelete(task.id);
      }
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    onUpdate(task.id, { icon: emoji });
    setShowEmojiPicker(false);
  };

  const handleStatusChange = (status: TaskStatus) => {
    onUpdate(task.id, { status });
    setShowActionsModal(false);
  };

  const handleTaskClick = () => {
    if (!isEditing) {
      setShowActionsModal(true);
    }
  };

  const handleUpdateTitle = (newTitle: string) => {
    onUpdate(task.id, { title: newTitle });
    setShowActionsModal(false);
  };

  const handleConfirmDelete = () => {
    onDelete(task.id);
    setShowDeleteConfirm(false);
  };

  return (
    <>
      <div className="relative flex items-center gap-2 bg-card border border-border rounded-lg p-2 group hover:border-gold/50 transition-colors">
        {/* Icon Button */}
        <button
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className="flex-shrink-0 w-9 h-9 flex items-center justify-center text-xl hover:bg-accent active:bg-accent/80 rounded-lg transition-colors"
        >
          {task.icon}
        </button>

        {/* Task Title */}
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            placeholder="Task name..."
            className="flex-1 px-2 py-1 text-sm text-foreground focus:outline-none bg-transparent"
          />
        ) : (
          <button
            onClick={handleTaskClick}
            className={`flex-1 text-left px-2 py-1 text-sm rounded hover:bg-accent/50 active:bg-accent transition-colors ${
              task.status === 'done'
                ? 'text-muted-foreground line-through'
                : 'text-foreground'
            }`}
          >
            {task.title}
          </button>
        )}

        {/* Status indicator dot */}
        <div
          className={`w-2 h-2 rounded-full flex-shrink-0 ${
            task.status === 'done'
              ? 'bg-emerald'
              : task.status === 'in_progress'
              ? 'bg-gold'
              : 'bg-muted-foreground/30'
          }`}
        />
      </div>

      {/* Emoji Picker */}
      {showEmojiPicker && (
        <EmojiPicker
          onSelect={handleEmojiSelect}
          onClose={() => setShowEmojiPicker(false)}
        />
      )}

      {/* Task Actions Modal */}
      {showActionsModal && (
        <TaskActionsModal
          task={task}
          onClose={() => setShowActionsModal(false)}
          onStatusChange={handleStatusChange}
          onUpdateTitle={handleUpdateTitle}
          onDelete={() => {
            setShowActionsModal(false);
            setShowDeleteConfirm(true);
          }}
        />
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <DeleteConfirmDialog
          taskTitle={task.title}
          onConfirm={handleConfirmDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </>
  );
}
