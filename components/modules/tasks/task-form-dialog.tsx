"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Task } from "@/lib/types";

import { TaskForm } from "./task-form";

type TaskFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task;
  onSaved: (task: Task) => void;
};

export function TaskFormDialog({
  open,
  onOpenChange,
  task,
  onSaved,
}: TaskFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{task ? "Edit task" : "New task"}</DialogTitle>
          <DialogDescription>
            {task
              ? "Update task details. Changes persist across refresh."
              : "Add a task to your board."}
          </DialogDescription>
        </DialogHeader>
        <TaskForm
          task={task}
          onCancel={() => onOpenChange(false)}
          onSuccess={(saved) => {
            onSaved(saved);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
