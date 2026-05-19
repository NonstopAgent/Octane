"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { FileUp, Upload } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, SectionHeader, StatusBadge } from "@/components/modules";
import { formatStatusLabel } from "@/components/modules/badge-tones";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useOctaneStore } from "@/lib/store/octane-store";
import type { Document, DocumentCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

const CATEGORIES: Array<DocumentCategory | "all"> = [
  "all",
  "legal",
  "financial",
  "product",
  "ip",
  "contracts",
  "brand",
  "compliance",
  "notes",
  "other",
];

const tableClass =
  "w-full text-left text-sm [&_th]:border-b [&_th]:border-zinc-800 [&_th]:px-3 [&_th]:py-2 [&_th]:font-medium [&_th]:text-zinc-400 [&_td]:border-b [&_td]:border-zinc-800/60 [&_td]:px-3 [&_td]:py-2.5 [&_tr:last-child_td]:border-0";

export default function DocumentsPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-zinc-500">Loading…</p>}>
      <DocumentsPageContent />
    </Suspense>
  );
}

function DocumentsPageContent() {
  const searchParams = useSearchParams();
  const documents = useOctaneStore((state) => state.documents);
  const ipAssets = useOctaneStore((state) => state.ipAssets);
  const entities = useOctaneStore((state) => state.entities);
  const createDocument = useOctaneStore((state) => state.createDocument);
  const profile = useOctaneStore((state) => state.profile);
  const getProjectById = useOctaneStore((state) => state.getProjectById);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [categoryFilter, setCategoryFilter] = useState<DocumentCategory | "all">(
    "all",
  );
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [metadataOpen, setMetadataOpen] = useState(false);
  const [metadataName, setMetadataName] = useState("");

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setMetadataOpen(true);
    }
    const detail = searchParams.get("detail");
    if (detail) {
      const doc = documents.find((d) => d.id === detail);
      if (doc) setSelectedDocument(doc);
    }
  }, [searchParams, documents]);

  const filteredDocuments = useMemo(() => {
    const sorted = [...documents].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
    if (categoryFilter === "all") return sorted;
    return sorted.filter((document) => document.category === categoryFilter);
  }, [documents, categoryFilter]);

  const getEntityName = (entityId: string) =>
    entities.find((entity) => entity.id === entityId)?.name ?? entityId;

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    createDocument({
      name: file.name,
      category: "other",
      status: "draft",
      tags: ["uploaded"],
      uploadedBy: profile.name,
      notes: `Mock upload (${(file.size / 1024).toFixed(1)} KB)`,
    });
    toast.info("Upload available in Session 2", {
      description: "Added a mock document row to the local store.",
    });
    event.target.value = "";
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Documents"
        description="Legal, product, and operational files plus IP registry."
        actions={
          <>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleUpload}
            />
            <Button
              type="button"
              variant="outline"
              className="border-zinc-700"
              render={<Link href="/holdings#document-ownership" />}
            >
              Holdings
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-zinc-700"
              onClick={() => setMetadataOpen(true)}
            >
              Add metadata
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-zinc-700"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="size-4" />
              Upload
            </Button>
          </>
        }
      />

      <section className="space-y-4">
        <SectionHeader
          title="Document Library"
          description="Filter by category. Click a row for details."
        />
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((category) => (
            <Button
              key={category}
              type="button"
              size="sm"
              variant={categoryFilter === category ? "default" : "outline"}
              className={cn(
                categoryFilter !== category && "border-zinc-700 bg-transparent",
              )}
              onClick={() => setCategoryFilter(category)}
            >
              {category === "all" ? "All" : formatStatusLabel(category)}
            </Button>
          ))}
        </div>
        <Card className="border-zinc-800/80 bg-zinc-900/30 overflow-x-auto">
          <CardContent className="p-0">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Project</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {documents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-0">
                      <EmptyState
                        icon={FileUp}
                        title="No documents yet"
                        description="Track contracts, legal files, and operational docs as metadata. Uploads are mocked locally until file storage ships."
                        action={{
                          label: "Add metadata",
                          onClick: () => setMetadataOpen(true),
                        }}
                        className="border-0 bg-transparent"
                      />
                    </td>
                  </tr>
                ) : filteredDocuments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-zinc-500">
                      No documents in this category.
                    </td>
                  </tr>
                ) : (
                  filteredDocuments.map((document) => {
                    const project = document.projectId
                      ? getProjectById(document.projectId)
                      : undefined;
                    return (
                      <tr
                        key={document.id}
                        className="cursor-pointer hover:bg-zinc-800/30"
                        onClick={() => setSelectedDocument(document)}
                      >
                        <td className="font-medium text-zinc-200">
                          {document.name}
                        </td>
                        <td>{formatStatusLabel(document.category)}</td>
                        <td>
                          <StatusBadge
                            domain="document"
                            status={document.status}
                          />
                        </td>
                        <td className="text-zinc-400">
                          {project?.name ?? "—"}
                        </td>
                        <td className="text-zinc-400">
                          {format(new Date(document.updatedAt), "MMM d, yyyy")}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <SectionHeader
          title="IP Registry"
          description="Trademarks, domains, software, and datasets across entities."
        />
        <Card className="border-zinc-800/80 bg-zinc-900/30 overflow-x-auto">
          <CardContent className="p-0">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Type</th>
                  <th>Owner</th>
                  <th>Project</th>
                  <th>Protection</th>
                </tr>
              </thead>
              <tbody>
                {ipAssets.map((asset) => {
                  const project = asset.projectId
                    ? getProjectById(asset.projectId)
                    : undefined;
                  return (
                    <tr key={asset.id}>
                      <td className="font-medium text-zinc-200">
                        {asset.name}
                      </td>
                      <td>{formatStatusLabel(asset.type)}</td>
                      <td className="text-zinc-400">
                        {getEntityName(asset.ownerEntity)}
                      </td>
                      <td className="text-zinc-400">
                        {project?.name ?? "—"}
                      </td>
                      <td>
                        <Badge
                          variant="outline"
                          className="border-zinc-700 text-zinc-300"
                        >
                          {formatStatusLabel(asset.protectionStatus)}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </section>

      <Dialog open={metadataOpen} onOpenChange={setMetadataOpen}>
        <DialogContent className="border-zinc-800 bg-zinc-950 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Document metadata</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Add a document record without file upload.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!metadataName.trim()) return;
              createDocument({
                name: metadataName.trim(),
                category: "other",
                status: "draft",
                tags: ["metadata"],
                uploadedBy: profile.name,
              });
              toast.success("Document record created");
              setMetadataName("");
              setMetadataOpen(false);
            }}
            className="grid gap-3"
          >
            <div className="grid gap-2">
              <Label htmlFor="doc-meta-name">Name</Label>
              <Input
                id="doc-meta-name"
                value={metadataName}
                onChange={(e) => setMetadataName(e.target.value)}
                className="border-zinc-700 bg-zinc-900"
                required
              />
            </div>
            <DialogFooter>
              <Button type="submit">Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Sheet
        open={Boolean(selectedDocument)}
        onOpenChange={(open) => !open && setSelectedDocument(null)}
      >
        <SheetContent
          side="right"
          className="w-full border-zinc-800 bg-zinc-950 sm:max-w-md"
        >
          {selectedDocument ? (
            <>
              <SheetHeader>
                <SheetTitle className="text-zinc-50">
                  {selectedDocument.name}
                </SheetTitle>
                <SheetDescription className="text-zinc-400">
                  {formatStatusLabel(selectedDocument.category)} · uploaded by{" "}
                  {selectedDocument.uploadedBy}
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 p-4 pt-0">
                <div className="flex flex-wrap gap-2">
                  <StatusBadge
                    domain="document"
                    status={selectedDocument.status}
                  />
                  {selectedDocument.tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="border-zinc-700 text-zinc-400"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
                {selectedDocument.projectId ? (
                  <p className="text-sm text-zinc-400">
                    Project:{" "}
                    <span className="text-zinc-200">
                      {getProjectById(selectedDocument.projectId)?.name}
                    </span>
                  </p>
                ) : null}
                {selectedDocument.notes ? (
                  <p className="text-sm leading-relaxed text-zinc-300">
                    {selectedDocument.notes}
                  </p>
                ) : null}
                <p className="text-xs text-zinc-500">
                  Created{" "}
                  {format(new Date(selectedDocument.createdAt), "PPP")} ·
                  Updated{" "}
                  {format(new Date(selectedDocument.updatedAt), "PPP")}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-zinc-700"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FileUp className="size-4" />
                  Replace (mock)
                </Button>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
