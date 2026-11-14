# 야구 커뮤니티 MVP 구현 계획서

> **For agentic workers:** 이 계획은 Codex가 Task 단위로 구현하고, 마일스톤마다 Claude가 리뷰한 뒤 다음으로 넘어간다. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 글/링크 작성 → 추천 → 추천 5개면 베스트 승격 → 홈 베스트 탭 노출까지 도는 야구 커뮤니티를 만든다.

**Architecture:** Next.js App Router(서버 컴포넌트 + Server Action)가 화면을 맡고, 인증·DB·파일은 Supabase가 맡는다. 카운트·승격·알림·권한 규칙은 전부 Postgres(RLS, 트리거, RPC)에 둔다. 클라이언트는 anon 키만 쓴다.

**Tech Stack:** Next.js(최신 안정판, App Router, TypeScript), Tailwind CSS, `@supabase/supabase-js` + `@supabase/ssr`, Supabase CLI(로컬 Docker), pgTAP(`supabase test db`), Vitest, Playwright, `react-markdown`(rehype-raw 없이).

**Spec:** `docs/superpowers/specs/2026-11-13-community-mvp-design.md` — 구현 전에 반드시 같이 읽는다. 이 계획은 스펙의 결정을 파일·이름·테스트로 옮긴 것이다.

## Global Constraints

- 패키지 매니저 `npm`. 소스는 `src/`, DB는 `supabase/`.
- Supabase는 **로컬 Docker**(`npx supabase start`)로 개발·테스트한다. Docker Desktop이 꺼져 있으면 먼저 켠다. 원격 배포는 이 계획 범위 밖.
- 로컬 `supabase/config.toml`: `[auth.email] enable_confirmations = false` (가입 즉시 로그인).
- 환경변수: `.env.local`에 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`만. `.env.example`을 커밋한다. service role 키는 앱 코드에서 쓰지 않는다.
- 모든 테이블 RLS 활성화, 시간은 `timestamptz`.
- `like_count`·`comment_count`·`view_count`·`is_best`·`best_at`·`author_id`는 클라이언트가 못 바꾼다 → **컬럼 단위 GRANT**로 막는다 (`revoke insert, update on posts from anon, authenticated` 후 허용 컬럼만 grant).
- 카운트를 바꾸는 트리거 함수는 `security definer` + `set search_path = public`.
- 소프트 삭제는 UPDATE가 아니라 **RPC**(`soft_delete_post`, `soft_delete_comment`)로 한다. 이유: SELECT 정책이 `deleted_at is null`이라 본인 UPDATE로 숨기면 RLS와 충돌한다.
- 베스트 기준값은 SQL 함수 `best_threshold()` 한 곳에서 `5`를 반환한다.
- 글 rate limit **10분에 5개**, 댓글 **1분에 10개**. 초과 시 `raise exception '잠시 후 다시 시도해 주세요'`.
- 길이: 닉네임 2~12자, 제목 2~100자, 본문 1~20,000자, 링크 코멘트 0~2,000자, 댓글 1~2,000자 — **DB CHECK와 폼 검증 둘 다**.
- 링크 URL은 `http://`, `https://`만 (DB CHECK `url ~ '^https?://'` + 폼 검증). 서버는 그 URL에 접속하지 않는다.
- 마크다운은 원시 HTML 비활성. 외부 링크는 `target="_blank" rel="noopener noreferrer nofollow"`.
- 사진: 최대 10장, 장당 5MB, jpg/png/webp/gif. 브라우저에서 원본(긴 변 1600px) + 썸네일(240px 정사각 중앙 자르기) 생성. GIF는 원본 그대로, 썸네일만 첫 프레임.
- Storage 경로 `{user_id}/{uuid}.{ext}`, 썸네일 `{user_id}/{uuid}_t.webp`.
- 목록 한 번에 20개, 커서 = 마지막 글의 `(정렬 시각, id)`.
- 외부 레포 코드 복붙 금지. 커밋 메시지는 `feat:`/`test:`/`chore:` 접두사.

## Review Focus

1. **없는 게시판 slug·없는(또는 삭제된) 글 id로 직접 접속** → 500이 아니라 404 페이지. → Task 4 테스트
2. **같은 `created_at`을 가진 글이 20개 경계에 걸칠 때 "더 보기"** → 중복·누락 없이 이어짐 (id로 tie-break). → Task 4 테스트
3. **가입 시 닉네임 중복** → 트리거 실패로 가입 전체가 롤백되고, 화면에 "이미 쓰는 닉네임입니다" 표시 (500 아님). → Task 2 테스트
4. **추천 버튼 연타·이미 누른 상태에서 다시 INSERT** → UNIQUE 위반을 잡아 현재 상태만 다시 보여 줌, 에러 페이지 없음. → Task 6 테스트
5. **삭제된 글에 댓글·추천 시도** → DB가 거부. → Task 5, Task 6 테스트

---

## 파일 구조

```
supabase/
  config.toml                      # supabase init
  seed.sql                         # boards 3개
  migrations/
    0001_profiles.sql              # Task 2
    0002_posts.sql                 # Task 3 (boards, posts, 컬럼 GRANT, RLS, soft_delete_post)
    0003_comments.sql              # Task 5
    0004_likes_best.sql            # Task 6 (best_threshold, 승격, best 알림 테이블 의존 → notifications는 여기서 생성)
    0005_images.sql                # Task 7 (post_images, storage 버킷·정책)
    0006_views_notify.sql          # Task 8 (post_views, increment_view, 댓글 알림, mark_notifications_read)
    0007_reports_ratelimit.sql     # Task 9
  tests/
    01_profiles.test.sql … 07_reports_ratelimit.test.sql   # 마이그레이션과 1:1
    _helpers.sql                   # 테스트용 유저 생성·로그인 흉내 함수
src/
  middleware.ts                    # 세션 갱신 + 비회원 viewer_key 쿠키 'vk'
  lib/supabase/{server,client,middleware}.ts
  lib/validate.ts                  # 폼 검증 (순수 함수)
  lib/cursor.ts                    # 커서 인코딩
  lib/posts.ts                     # listPosts, getPost
  lib/images.ts                    # 브라우저 리사이즈
  lib/ui.ts                        # likeChipTone, timeAgo
  components/{Header,Footer,PostRow,PostList,LikeButton,ReportButton,Comments,Markdown}.tsx
  app/layout.tsx, app/page.tsx
  app/[board]/page.tsx, app/[board]/[id]/page.tsx
  app/write/{page.tsx,actions.ts}
  app/login/{page.tsx,actions.ts}
  app/me/page.tsx
  app/{terms,privacy,youth,report-guide}/page.tsx
  app/not-found.tsx
tests/unit/*.test.ts               # Vitest
e2e/core-loop.spec.ts              # Playwright
```

### pgTAP 테스트 헬퍼 (`supabase/tests/_helpers.sql`)

- `tests.create_user(nickname text) returns uuid` — `auth.users`에 `raw_user_meta_data = {"nickname": …}`로 INSERT.
- `tests.login_as(uid uuid)` — `set local role authenticated; set local request.jwt.claims = json_build_object('sub', uid)::text`.
- `tests.logout()` — `set local role anon`.
- 헬퍼는 `supabase/migrations`가 아니라 테스트 파일의 `begin;` 직후에 `\ir _helpers.sql`로 불러온다 (스키마 `tests`, 롤백되므로 남지 않음).

---

## M0–M1 (첫 리뷰 지점: Task 2 끝)

### Task 1: 프로젝트 뼈대 + 로컬 Supabase + 테스트 도구

**Files:**
- Create: Next.js 앱 일체(`create-next-app` — TypeScript, Tailwind, App Router, `src/`, ESLint), `supabase/config.toml`, `.env.example`, `vitest.config.ts`, `tests/unit/smoke.test.ts`
- Modify: `.gitignore`(`supabase/.temp/`, `.env.local` 확인), `README.md`(실행 방법)

**Interfaces:**
- Produces: npm 스크립트 `dev`, `build`, `lint`, `test`(vitest run), `test:db`(`supabase test db`), `e2e`(playwright test)

- [ ] **Step 1:** 기존 레포(`README.md`, `research.md`, `docs/`)를 지우지 않고 그 자리에서 Next.js 생성 (임시 폴더에 만든 뒤 옮기는 방식 허용).
- [ ] **Step 2:** `npx supabase init`, config에서 `enable_confirmations = false`. Docker Desktop을 켜고 `npx supabase start` → 출력된 URL·anon 키를 `.env.local`에.
- [ ] **Step 3:** `tests/unit/smoke.test.ts`: `expect(1 + 1).toBe(2)`. `npm test` PASS.
- [ ] **Step 4:** 홈 `/`에 "야구 커뮤니티" 제목만 표시. `npm run build` PASS, `npm run dev` 후 `/` 200.
- [ ] **Step 5:** 커밋 `chore: Next.js + Supabase 로컬 뼈대`

### Task 2: 인증 + profiles + 공통 레이아웃

**Files:**
- Create: `supabase/migrations/0001_profiles.sql`, `supabase/tests/_helpers.sql`, `supabase/tests/01_profiles.test.sql`, `src/lib/supabase/{server,client,middleware}.ts`, `src/middleware.ts`, `src/lib/validate.ts`, `tests/unit/validate.test.ts`, `src/app/login/{page.tsx,actions.ts}`, `src/components/{Header,Footer}.tsx`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Produces:
  - `createClient(): Promise<SupabaseClient>` (`lib/supabase/server.ts`, 쿠키 기반) / `createClient(): SupabaseClient` (`lib/supabase/client.ts`)
  - `updateSession(req: NextRequest): Promise<NextResponse>` (`lib/supabase/middleware.ts`)
  - `validateNickname(s: string): string | null` — 에러 메시지 또는 null (`lib/validate.ts`, 이후 Task가 같은 파일에 함수 추가)
  - Server Actions `signUp(formData)`, `signIn(formData)`, `signOut()` — 실패 시 `{ error: string }` 반환
  - 테이블 `profiles(id uuid pk → auth.users on delete cascade, nickname text unique check 2~12자, created_at)`, 트리거 함수 `handle_new_user()`

- [ ] **Step 1: pgTAP 테스트 작성** `01_profiles.test.sql`
  - `create_user('타이거즈팬')` 후 profiles에 같은 id·닉네임 행 1개 → `is(...)`
  - 닉네임 `'가'`(1자)로 가입 → `throws_ok` (CHECK 위반)
  - 같은 닉네임 두 번 → 두 번째 `throws_ok` (unique), 그리고 `auth.users`에도 남지 않음 (`is(count, 1)`)
  - `login_as(A)`로 B의 닉네임 UPDATE → 영향 행 0 / A 본인 닉네임 UPDATE → 성공
  - anon으로 SELECT → 보임
- [ ] **Step 2:** `npm run test:db` → FAIL (테이블 없음)
- [ ] **Step 3:** `0001_profiles.sql` 구현. 트리거는 `after insert on auth.users`, `raw_user_meta_data->>'nickname'`. RLS: select 누구나, update `id = auth.uid()`.
- [ ] **Step 4:** `npm run test:db` PASS
- [ ] **Step 5: Vitest** `validate.test.ts`: `validateNickname('a')`·`validateNickname('열세글자닉네임입니다요요')` → 메시지, `validateNickname('엘지팬')` → `null`, 앞뒤 공백은 잘라서 판단. FAIL 확인 → 구현 → PASS
- [ ] **Step 6:** 로그인 화면(이메일·비밀번호, 가입 탭엔 닉네임) + Server Action. 가입 에러 메시지에 `duplicate`/`unique`가 있으면 **"이미 쓰는 닉네임입니다"** 로 바꿔 표시 (Review Focus 3).
- [ ] **Step 7:** 레이아웃: Header(로고 → `/`, `[KBO] [MLB] [자유]` → `/kbo` `/mlb` `/free`, 로그인 시 닉네임·로그아웃·🔔 자리, 비로그인 시 "로그인"), Footer(이용약관·개인정보·청소년보호·신고 링크). middleware는 `updateSession` 호출 (`matcher`에서 정적 파일 제외).
- [ ] **Step 8:** 수동 확인: 가입 → 헤더에 닉네임 → 로그아웃 → 로그인. 같은 닉네임 재가입 시 안내 문구. `npm run build`, `npm test`, `npm run test:db` 모두 PASS
- [ ] **Step 9:** 커밋 `feat: 인증·profiles·공통 레이아웃 (M1)` → **여기서 멈추고 Claude 리뷰**

---

## M2

### Task 3: boards + posts DB 규칙

**Files:** Create `supabase/migrations/0002_posts.sql`, `supabase/seed.sql`, `supabase/tests/02_posts.test.sql`

**Interfaces:**
- Produces: 테이블 `boards`, `posts`(스펙 9절 컬럼·인덱스 그대로), RPC `soft_delete_post(p_id bigint) returns void`, 트리거 `posts_touch_updated_at`
- 시드: `(1,'kbo','KBO',1) (2,'mlb','MLB',2) (3,'free','자유',3)`

- [ ] **Step 1: 테스트** — CHECK: `kind='link'`인데 url null → 거부 / `kind='text'`인데 body null → 거부 / url `'javascript:alert(1)'` → 거부 / 제목 1자 → 거부. 권한: A가 B 글 UPDATE → 0행 / A가 `author_id`를 B로 INSERT → 거부 / A가 자기 글 `like_count = 999` UPDATE → `throws_ok`(권한) / `soft_delete_post`를 남이 호출 → 예외, 본인 호출 → 이후 anon SELECT에서 안 보임 / anon INSERT → 거부.
- [ ] **Step 2:** FAIL 확인
- [ ] **Step 3:** 구현. 컬럼 GRANT — insert: `board_id, author_id, kind, title, body, url, thumb_path` / update: `board_id, title, body, url, thumb_path`. `soft_delete_post`는 `security definer`, `author_id = auth.uid()` 아니면 `raise exception`.
- [ ] **Step 4:** PASS → 커밋 `feat: posts 테이블·RLS·소프트삭제`

### Task 4: 글 작성·목록·보기·수정·삭제 화면

**Files:** Create `src/lib/{cursor,posts,ui}.ts`, `src/components/{PostRow,PostList,Markdown}.tsx`, `src/app/[board]/page.tsx`, `src/app/[board]/[id]/page.tsx`, `src/app/write/{page.tsx,actions.ts}`, `src/app/not-found.tsx`, `tests/unit/{cursor,validate,ui}.test.ts`; Modify `src/app/page.tsx`, `src/lib/validate.ts`

**Interfaces:**
- Produces:
  - `encodeCursor(at: string, id: number): string`, `decodeCursor(s: string): { at: string; id: number } | null` (잘못된 문자열은 null)
  - `listPosts(opts: { board?: string; best?: boolean; cursor?: string }): Promise<{ items: PostListItem[]; nextCursor: string | null }>` — 정렬 `best ? best_at : created_at` desc, id desc, 21개 받아서 20개 + 다음 커서
  - `type PostListItem = { id; board: { slug; name }; kind; title; url; thumb_path; like_count; comment_count; view_count; is_best; created_at; author: { nickname } }`
  - `getPost(id: number): Promise<PostDetail | null>` (없거나 삭제면 null)
  - `validatePost(input: { kind; title; body; url }): Record<string, string>` (빈 객체면 통과)
  - `timeAgo(iso: string, now?: Date): string` — "방금", "14분 전", "3시간 전", "2일 전", 7일 넘으면 `YYYY.MM.DD`
  - Server Actions `createPost(formData)`, `updatePost(id, formData)`, `deletePost(id)` — 성공 시 `revalidatePath` 후 글 화면으로 redirect

- [ ] **Step 1: Vitest** — `decodeCursor(encodeCursor(t, 7))`가 원값 / `decodeCursor('garbage')` → null / `validatePost`: link인데 `ftp://x` → `url` 에러, text인데 body 빈칸 → `body` 에러, 제목 101자 → `title` 에러 / `timeAgo` 경계값(59초→"방금", 60분→"1시간 전", 8일→날짜).
- [ ] **Step 2:** FAIL → 구현 → PASS
- [ ] **Step 3: pgTAP 추가(`02_posts.test.sql`)** — 같은 `created_at` 25개 글 삽입 후, 커서 쿼리와 같은 조건(`(created_at, id) < (at, id)`)으로 두 번 나눠 읽으면 합쳐서 25개·중복 0 (Review Focus 2).
- [ ] **Step 4:** 화면 구현. `[board]`는 boards에 slug가 없으면 `notFound()`, `[id]`는 숫자가 아니거나 `getPost`가 null이면 `notFound()` (Review Focus 1). 글쓰기는 비로그인 시 `/login`으로 redirect, `?edit=id`면 본인 글만 불러옴. 홈은 `?tab=best|new`(기본 best), 베스트가 0개면 "아직 베스트 글이 없어요" 표시. 이 단계의 PostRow는 썸네일 자리에 게시판 색 블록/링크 도메인만 (사진은 Task 7).
- [ ] **Step 5:** 수동 확인: 본문 글·링크 글 작성 → 목록 → 보기 → 수정 → 삭제. `/nope`, `/kbo/999999`, `/kbo/abc` → 404. 링크 글 "원문 보기 ↗"가 새 탭.
- [ ] **Step 6:** 커밋 `feat: 글 CRUD 화면 (M2)` → **Claude 리뷰**

## M3

### Task 5: 댓글·답글

**Files:** Create `supabase/migrations/0003_comments.sql`, `supabase/tests/03_comments.test.sql`, `src/components/Comments.tsx`, actions `addComment(postId, parentId|null, formData)`, `deleteComment(id)` (`src/app/[board]/[id]/actions.ts`)

**Interfaces:** Produces 테이블 `comments`, RPC `soft_delete_comment(p_id bigint)`, 트리거가 `posts.comment_count` 유지

- [ ] **Step 1: 테스트** — 댓글 INSERT → `comment_count` 1 / 답글 → 2 / 답글의 답글 → 거부 / 다른 글의 댓글을 parent로 → 거부 / 삭제된 글에 댓글 → 거부 (Review Focus 5) / `soft_delete_comment` 본인 → count 감소, 행은 남음 / 같은 댓글 두 번 삭제해도 count 한 번만 감소 / 남의 댓글 삭제 → 예외 / 클라이언트가 `comment_count` 직접 UPDATE → 거부(Task 3 GRANT로 이미 막힘 확인).
- [ ] **Step 2:** FAIL → 구현 → PASS
- [ ] **Step 3:** UI: 오래된 순, 답글은 부모 아래 들여쓰기, 답글에는 "답글" 버튼 없음, 삭제된 댓글은 "삭제된 댓글입니다"(답글 유지).
- [ ] **Step 4:** 커밋 `feat: 댓글·답글 (M3)` → **Claude 리뷰**

## M4

### Task 6: 추천 + 베스트 승격

**Files:** Create `supabase/migrations/0004_likes_best.sql`, `supabase/tests/04_likes_best.test.sql`, `src/components/LikeButton.tsx`, action `toggleLike(postId)`; Modify `src/lib/ui.ts`, `src/components/PostRow.tsx`, `tests/unit/ui.test.ts`

**Interfaces:**
- Produces: `best_threshold() returns int` (= 5), 테이블 `post_likes`, `notifications`(스펙 9절 컬럼 전체 — 이후 Task 8이 같은 테이블에 comment/reply를 넣음), `likeChipTone(count: number, isBest: boolean, threshold = 5): 'gray' | 'orange' | 'red'`
- `toggleLike(postId): Promise<{ liked: boolean; count: number } | { error: string }>`

- [ ] **Step 1: pgTAP** — 본인 글 추천 → 거부 / 같은 사람 두 번 → 두 번째 거부 / 4명 → `is_best` false / 5번째 → `is_best` true, `best_at` not null, 글쓴이에게 `kind='best'` 알림 1개 / 1명 취소 → `like_count` 4, `is_best` 여전히 true / 다시 5 도달해도 best 알림 추가 안 됨 / 삭제된 글 추천 → 거부 (Review Focus 5) / 클라이언트가 `is_best` UPDATE → 거부.
- [ ] **Step 2: Vitest** — 스펙 규칙(0~4 회색 / 5~기준값-1 주황 / 베스트 빨강). 기준값 5에선 주황 구간이 비지만 기준값을 바꿀 수 있게 인자로 받는다: `likeChipTone(4, false, 5)` gray / `likeChipTone(7, false, 10)` orange / `likeChipTone(4, false, 10)` gray / `likeChipTone(1, true, 5)` red. (시그니처를 `likeChipTone(count, isBest, threshold = 5)`로)
- [ ] **Step 3:** FAIL → 구현 → PASS
- [ ] **Step 4:** `toggleLike`: 이미 눌렀으면 DELETE, 아니면 INSERT. INSERT에서 unique 위반(23505)은 "이미 누름"으로 보고 현재 상태 반환 (Review Focus 4). 본인 글이면 버튼 disabled. 비로그인이면 `/login`.
- [ ] **Step 5:** 수동 확인: 계정 5개로 추천 → 홈 베스트 탭에 🔥 딱지와 함께 노출. 버튼 연타해도 에러 화면 없음.
- [ ] **Step 6:** 커밋 `feat: 추천·베스트 승격 (M4)` → **Claude 리뷰**

## M5

### Task 7: 사진 업로드·썸네일·목록 한 줄 완성

**Files:** Create `supabase/migrations/0005_images.sql`, `supabase/tests/05_images.test.sql`, `src/lib/images.ts`; Modify `src/app/write/*`, `src/components/PostRow.tsx`, `src/app/[board]/[id]/page.tsx`

**Interfaces:**
- Produces: 테이블 `post_images`, 버킷 `post-images`(public read), `resizeImage(file: File, maxEdge: 1600): Promise<Blob>`, `makeThumb(file: File, size: 240): Promise<Blob>` (canvas, webp 출력; GIF 원본은 `resizeImage`를 건너뜀)
- `createPost`/`updatePost`가 `images: { path; thumb_path }[]`와 대표 인덱스를 받아 `post_images.position` 저장, 대표 썸네일을 `posts.thumb_path`에

- [ ] **Step 1: pgTAP** — 남의 글에 `post_images` INSERT → 거부 / storage.objects: A가 `B_id/x.webp` 경로에 INSERT → 거부, `A_id/x.webp` → 허용.
- [ ] **Step 2:** FAIL → 구현 → PASS
- [ ] **Step 3:** 글쓰기: 파일 선택 시 형식·5MB·10장 검사(`validateImages(files: File[]): string | null`을 `validate.ts`에 추가, Vitest로 11장·6MB·`.bmp` 거부 테스트) → 브라우저 변환 → 업로드 → 미리보기에서 대표 지정.
- [ ] **Step 4:** PostRow 64px 고정 3종: 사진 썸네일 / 게시판 색 블록+이름 / 링크 아이콘+도메인. 제목 2줄 말줄임, `[N]`은 1 이상만, 읽은 글 흐리게(localStorage `readPosts`, try/catch).
- [ ] **Step 5:** 커밋 `feat: 사진 업로드·목록 한 줄 (M5)` → **Claude 리뷰**

## M6

### Task 8: 조회수 + 알림 + `/me`

**Files:** Create `supabase/migrations/0006_views_notify.sql`, `supabase/tests/06_views_notify.test.sql`, `src/app/me/page.tsx`; Modify `src/middleware.ts`(쿠키 `vk` 없으면 `crypto.randomUUID()`로 1년 httpOnly 설정), `src/app/[board]/[id]/page.tsx`, `src/components/Header.tsx`

**Interfaces:**
- Produces: `increment_view(p_post_id bigint, p_viewer_key text) returns void` (`security definer`; 로그인 상태면 `p_viewer_key` 대신 `auth.uid()::text` 사용), `mark_notifications_read() returns void`, 댓글 트리거가 `comment`/`reply` 알림 생성

- [ ] **Step 1: pgTAP** — 같은 viewer_key 두 번 → `view_count` 1 / 다른 key → 2 / 다음 날짜(`viewed_on` 다름) → 증가 / 클라이언트가 `post_views` 직접 INSERT → 거부 / B가 A 글에 댓글 → A에게 `comment` 1개 / C가 B 댓글에 답글(글쓴이 A) → A에게 `comment`, B에게 `reply` / A가 자기 글에 댓글 → 알림 0 / B가 자기 댓글에 답글 → B 알림 0, A에게 `comment`만 / 글쓴이가 곧 부모 댓글 작성자면 하나만 / A가 B 알림 SELECT → 0행 / `mark_notifications_read` 후 A의 안 읽은 알림 0.
- [ ] **Step 2:** FAIL → 구현 → PASS
- [ ] **Step 3:** UI: 글 보기 서버 렌더에서 `increment_view` 호출. 헤더 🔔에 안 읽은 알림 있으면 빨간 점. `/me`: 알림 목록(누르면 글로 이동) + "모두 읽음" + 내가 쓴 글.
- [ ] **Step 4:** 커밋 `feat: 조회수·알림 (M6)` → **Claude 리뷰**

## M7

### Task 9: 신고 + rate limit + 법적 페이지 + E2E

**Files:** Create `supabase/migrations/0007_reports_ratelimit.sql`, `supabase/tests/07_reports_ratelimit.test.sql`, `src/components/ReportButton.tsx`, `src/app/{terms,privacy,youth,report-guide}/page.tsx`, `playwright.config.ts`, `e2e/core-loop.spec.ts`

**Interfaces:** Produces 테이블 `reports`, action `reportTarget(type: 'post'|'comment', id, reason)`, rate limit 트리거 `posts_rate_limit`, `comments_rate_limit`

- [ ] **Step 1: pgTAP** — 같은 대상 두 번 신고 → 거부 / 남의 신고 SELECT → 0행 / 10분 안에 글 6번째 → `throws_ok(..., '잠시 후 다시 시도해 주세요')` / 1분 안에 댓글 11번째 → 같은 메시지.
- [ ] **Step 2:** FAIL → 구현 → PASS
- [ ] **Step 3:** 신고 버튼(사유: 스팸·욕설·음란·저작권·기타), 이미 신고했으면 "신고됨". rate limit 에러는 폼에 그대로 표시. 정적 페이지 4개는 짧은 안내 문구.
- [ ] **Step 4: E2E** `core-loop.spec.ts` — 가입(A) → 글쓰기 → 계정 B~F 5개 가입·추천 → 홈 베스트 탭에 그 글 → A로 로그인 시 🔔 점과 `/me`에 베스트 알림. `npm run e2e -- --trace off` PASS.
- [ ] **Step 5:** 전체 `npm run build && npm test && npm run test:db` PASS → 커밋 `feat: 신고·도배방지·E2E (M7)` → **최종 Claude 리뷰**
