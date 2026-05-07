"use client";

import { useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import {
  Bold,
  Italic,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Link as LinkIcon,
  Image as ImageIcon,
  Save,
  X,
  Undo2,
  Redo2,
} from "lucide-react";
import { markdownToHtml, htmlToMarkdown } from "@/lib/markdown";

type Props = {
  initialMarkdown: string;
  onSave: (markdown: string) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
};

export function RichBodyEditor({ initialMarkdown, onSave, onCancel, saving }: Props) {
  const [dirty, setDirty] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: { HTMLAttributes: { class: "code-block" } },
      }),
      Image.configure({ HTMLAttributes: { class: "rounded-md border border-border" } }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          rel: "noopener noreferrer",
          target: "_blank",
        },
      }),
      Placeholder.configure({ placeholder: "Write a claim body in markdown-ish prose…" }),
      Typography,
    ],
    content: markdownToHtml(initialMarkdown),
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "prose-tight max-w-none focus:outline-none min-h-[60vh] p-4 text-[13.5px]",
      },
    },
    onUpdate: () => setDirty(true),
  });

  if (!editor) {
    return <div className="mt-8 text-[12px] text-muted">Loading editor…</div>;
  }

  async function save() {
    if (!editor) return;
    const html = editor.getHTML();
    const md = htmlToMarkdown(html);
    await onSave(md);
  }

  return (
    <div className="mt-8">
      <Toolbar editor={editor} />
      <div className="rounded-b-md border border-t-0 border-border bg-panel">
        <EditorContent editor={editor} />
      </div>
      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-subtle px-2.5 py-1 text-[12px] text-muted transition-colors hover:bg-border hover:text-fg disabled:opacity-50"
        >
          <X className="h-3 w-3" />
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving || !dirty}
          className="inline-flex items-center gap-1 rounded-md bg-fg px-2.5 py-1 text-[12px] font-medium text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          <Save className="h-3 w-3" />
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const btn = (active: boolean, disabled: boolean) =>
    [
      "rounded p-1 transition-colors",
      active ? "bg-fg text-canvas" : "text-muted hover:bg-subtle hover:text-fg",
      disabled ? "opacity-40 cursor-not-allowed" : "",
    ].join(" ");

  function promptLink() {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL (empty to remove):", prev ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  function promptImage() {
    const url = window.prompt("Image URL:");
    if (!url) return;
    editor.chain().focus().setImage({ src: url }).run();
  }

  return (
    <div className="flex flex-wrap items-center gap-0.5 rounded-t-md border border-border bg-subtle p-1 text-[11px]">
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={btn(editor.isActive("bold"), false)}
        title="Bold (⌘B)"
      >
        <Bold className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={btn(editor.isActive("italic"), false)}
        title="Italic (⌘I)"
      >
        <Italic className="h-3.5 w-3.5" />
      </button>
      <Divider />
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={btn(editor.isActive("heading", { level: 2 }), false)}
        title="Heading 2"
      >
        <Heading2 className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={btn(editor.isActive("heading", { level: 3 }), false)}
        title="Heading 3"
      >
        <Heading3 className="h-3.5 w-3.5" />
      </button>
      <Divider />
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={btn(editor.isActive("bulletList"), false)}
        title="Bulleted list"
      >
        <List className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={btn(editor.isActive("orderedList"), false)}
        title="Numbered list"
      >
        <ListOrdered className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={btn(editor.isActive("blockquote"), false)}
        title="Quote"
      >
        <Quote className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleCode().run()}
        className={btn(editor.isActive("code"), false)}
        title="Inline code"
      >
        <Code className="h-3.5 w-3.5" />
      </button>
      <Divider />
      <button
        type="button"
        onClick={promptLink}
        className={btn(editor.isActive("link"), false)}
        title="Link"
      >
        <LinkIcon className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={promptImage}
        className={btn(false, false)}
        title="Image"
      >
        <ImageIcon className="h-3.5 w-3.5" />
      </button>
      <Divider />
      <button
        type="button"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        className={btn(false, !editor.can().undo())}
        title="Undo (⌘Z)"
      >
        <Undo2 className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        className={btn(false, !editor.can().redo())}
        title="Redo (⇧⌘Z)"
      >
        <Redo2 className="h-3.5 w-3.5" />
      </button>
      <span className="ml-2 text-[10px] uppercase tracking-widest text-muted">
        rich-text · saves as markdown
      </span>
    </div>
  );
}

function Divider() {
  return <span className="mx-0.5 h-4 w-px bg-border" />;
}
