"use client";

import { useActionState, useRef, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { imageUrl, makeThumb, resizeImage, type UploadedImage } from "@/lib/images";
import { validateImages } from "@/lib/validate";
import { createPost, updatePost } from "./actions";
import type { PostDetail } from "@/lib/posts";

type FormState = { error?: string; errors?: Record<string, string> } | null;
export default function PostForm({ boards, post, initialBoard, initialImages = [] }: {
  boards: { slug: string; name: string }[]; post: PostDetail | null; initialBoard?: string; initialImages?: UploadedImage[];
}) {
  const [kind, setKind] = useState(post?.kind ?? "text");
  const [images, setImages] = useState(initialImages);
  const [representative, setRepresentative] = useState(Math.max(0, initialImages.findIndex((image) => image.thumb_path === post?.thumb_path)));
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const staged = useRef(new Set<string>());
  const [state, action, pending] = useActionState<FormState, FormData>(
    async (_previous, data) => post ? updatePost(post.id, data, images, representative) : createPost(data, kind === "text" ? images : [], kind === "text" ? representative : 0), null,
  );
  async function upload(files: File[]) {
    const validation = validateImages(files);
    if (validation || files.length + images.length > 10) {
      setUploadError(validation ?? "사진은 최대 10장까지 첨부할 수 있습니다");
      return;
    }
    if (!files.length) return;
    setUploading(true); setUploadError(null);
    const supabase = createClient();
    const uploadedPaths: string[] = [];
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) throw new Error("로그인 후 사진을 첨부해 주세요");
      const next: UploadedImage[] = [];
      for (const file of files) {
        const original = file.type === "image/gif" ? file : await resizeImage(file, 1600);
        const thumb = await makeThumb(file, 240);
        if (original.size > 5 * 1024 * 1024 || thumb.size > 5 * 1024 * 1024) throw new Error("변환한 사진이 5MB를 넘습니다. 더 작은 사진을 선택해 주세요");
        const base = `${data.user.id}/${crypto.randomUUID()}`;
        const image = { path: `${base}.${file.type === "image/gif" ? "gif" : "webp"}`, thumb_path: `${base}_t.webp` };
        for (const [path, blob] of [[image.path, original], [image.thumb_path, thumb]] as const) {
          const { error } = await supabase.storage.from("post-images").upload(path, blob, { contentType: blob.type, upsert: false });
          if (error) throw new Error("사진 업로드에 실패했습니다. 다시 시도해 주세요");
          uploadedPaths.push(path);
        }
        next.push(image);
      }
      uploadedPaths.forEach((path) => staged.current.add(path));
      setImages((current) => [...current, ...next]);
    } catch (error) {
      if (uploadedPaths.length) await supabase.storage.from("post-images").remove(uploadedPaths).catch(() => undefined);
      setUploadError(error instanceof Error ? error.message : "사진을 업로드하지 못했습니다");
    } finally { setUploading(false); }
  }

  async function removeImage(index: number) {
    const image = images[index];
    setImages((current) => current.filter((_, i) => i !== index));
    setRepresentative((current) => current === index ? 0 : current > index ? current - 1 : current);
    if (staged.current.has(image.path)) {
      staged.current.delete(image.path); staged.current.delete(image.thumb_path);
      await createClient().storage.from("post-images").remove([image.path, image.thumb_path]).catch(() => undefined);
    }
  }
  return <form action={action} className="mt-6 flex flex-col gap-4">
    <fieldset disabled={pending || uploading} className="flex min-w-0 flex-col gap-4">
    <fieldset className="flex gap-5" disabled={!!post}>
      <legend className="mb-2">글 종류{post && " (수정 시 변경 불가)"}</legend>
      <label><input type="radio" checked={kind === "text"} onChange={() => setKind("text")} /> 본문</label>
      <label><input type="radio" checked={kind === "link"} onChange={() => setKind("link")} /> 링크</label>
    </fieldset>
    <input type="hidden" name="kind" value={kind} />
    <label className="flex flex-col gap-1">게시판<select name="board" className="rounded border p-2" defaultValue={post?.board.slug ?? initialBoard ?? boards[0]?.slug} required>
      {boards.map((board) => <option key={board.slug} value={board.slug}>{board.name}</option>)}
    </select></label>
    <label className="flex flex-col gap-1">제목 (2~100자)<input name="title" className="rounded border p-2" defaultValue={post?.title} required /></label>
    {state?.errors?.title && <p role="alert" className="text-red-700">{state.errors.title}</p>}
    {kind === "link" && <label className="flex flex-col gap-1">URL<input name="url" type="url" className="rounded border p-2" defaultValue={post?.url ?? ""} required /></label>}
    {state?.errors?.url && <p role="alert" className="text-red-700">{state.errors.url}</p>}
    <label className="flex flex-col gap-1">{kind === "text" ? "본문 (마크다운, 1~20,000자)" : "내 코멘트 (선택, 2,000자 이내)"}
      <textarea name="body" className="min-h-64 rounded border p-2" defaultValue={post?.body ?? ""} required={kind === "text"} />
    </label>
    {state?.errors?.body && <p role="alert" className="text-red-700">{state.errors.body}</p>}
    {kind === "text" && <section aria-label="첨부 사진">
      <label className="flex flex-col gap-2">사진 (최대 10장, 장당 5MB)
        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={(event) => { const files = Array.from(event.target.files ?? []); event.target.value = ""; void upload(files); }} />
      </label>
      <p className="mt-2 text-sm text-zinc-500">첫 사진이 대표 사진입니다. 미리보기에서 대표 사진을 바꿀 수 있습니다.</p>
      <div className="mt-3 flex flex-wrap gap-4">{images.map((image, index) => <div key={image.path} className="flex flex-col gap-2">
        <Image src={imageUrl(image.thumb_path)} alt={`첨부 사진 ${index + 1}`} width={96} height={96} unoptimized className="h-24 w-24 rounded object-cover" />
        <label><input type="radio" name="representative" value={index} checked={representative === index} onChange={() => setRepresentative(index)} /> 대표 {index + 1}</label>
        <button type="button" className="text-sm underline" aria-label={`사진 ${index + 1} 제거`} onClick={() => { void removeImage(index); }}>제거</button>
      </div>)}</div>
    </section>}
    </fieldset>
    {uploading && <p role="status">사진 변환·업로드 중…</p>}
    {uploadError && <p role="alert" className="text-red-700">{uploadError}</p>}
    {state?.error && <p role="alert" className="text-red-700">{state.error}</p>}
    <button className="rounded bg-zinc-900 p-3 text-white disabled:opacity-50" disabled={pending || uploading}>{pending ? "저장 중…" : post ? "수정하기" : "등록하기"}</button>
  </form>;
}
