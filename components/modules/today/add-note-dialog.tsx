"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useOctaneStore } from "@/lib/store/octane-store";

export function AddNoteDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const createFounderNote = useOctaneStore((s) => s.createFounderNote);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    createFounderNote({
      title: trimmedTitle,
      body: body.trim() || trimmedTitle,
      tags: ["today"],
    });
    setTitle("");
    setBody("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-zinc-800 bg-zinc-950">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add founder note</DialogTitle>
            <DialogDescription>
              Quick capture from Today — stored locally with your workspace.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="note-title">Title</Label>
              <Input
                id="note-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What&apos;s on your mind?"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="note-body">Body</Label>
              <Textarea
                id="note-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Optional details…"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Save note</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
