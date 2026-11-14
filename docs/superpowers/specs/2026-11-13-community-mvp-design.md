# 야구 커뮤니티 MVP 설계

- 작성일: 2026-11-13
- 목적: **공부용** (실서비스 출시 아님)
- 구현: Codex / 설계·리뷰: Claude
- 근거 자료: `research.md`(MLBPARK·에펨코리아 분석), Rhymix 해부도, 커뮤니티 UI 그림판

---

## 1. 한 문장 (Core Function)

> **야구 팬이 글이나 링크를 올리고, 추천을 많이 받은 글이 베스트로 올라가는 커뮤니티.**

## 2. 핵심 루프 (Core Loop)

```
글쓰기(본문/링크) → 추천·댓글 → 추천이 기준값을 넘으면 베스트 승격 → 홈 베스트 탭 노출 → 새 글쓰기
```

- 글쓴이 보상: 베스트 승격 + "베스트에 올랐어요" 알림
- 읽는 사람 보상: 홈에서 검증된 글을 바로 봄
- 재방문 훅: 내 글에 달린 댓글·베스트 알림의 빨간 점 (끝나지 않은 상태)

## 3. 이 프로젝트에서 배우는 것

공부용이므로 기능마다 배울 개념을 명시한다. 기능을 고를 때 "이걸로 무엇을 배우나"를 기준으로 삼는다.

| 기능 | 배우는 개념 |
|---|---|
| 회원가입·로그인 | Supabase Auth, `@supabase/ssr`로 서버/클라이언트 세션 다루기 |
| 글·댓글 CRUD | App Router의 Server Component, Server Action, 캐시 무효화 |
| 남의 글 수정 금지 | Postgres **RLS** 정책 |
| 추천 수·베스트 승격 | Postgres **트리거**, 카운트 캐시 (Rhymix `voted_count` 방식) |
| 1인 1추천 | **UNIQUE 제약**으로 중복 차단 |
| 조회수 | **RPC(DB 함수)**, `security definer`, 중복 방지 |
| 대표 사진 | Supabase **Storage**, 업로드 정책, 클라이언트 이미지 리사이즈 |
| 알림 | 트리거로 이벤트 기록, 읽음 처리 |
| 도배 방지 | DB 함수로 rate limit |

## 4. 목표 / 비목표 / 반목표

**목표**
- 위 핵심 루프가 처음부터 끝까지 실제로 돈다
- 화면 6개 이하
- RLS와 트리거를 직접 설계하고 테스트해 본다

**비목표 (MVP에서 안 함)**
- 포인트·레벨, 이용자 게시판 개설, 실시간(WebSocket) 갱신
- 점수+시간 "핫" 정렬 (베스트는 승격형만)
- 검색, 소셜 로그인, 관리자 화면 (관리는 Supabase 대시보드로)
- 이미지 목록 전환, 다크 모드 토글, 이모지 반응, 경기 기록 연동
- 비회원 글쓰기·추천

**반목표 (기능이 돌아가도 이러면 실패)**
- 다른 사이트 본문·이미지를 서버가 수집해서 저장하는 구조
- 클라이언트가 추천 수·조회수를 직접 바꿀 수 있는 구조
- 광고나 공지를 일반 글처럼 위장
- 남의 글을 수정·삭제할 수 있는 RLS 구멍

## 5. 제약

- Supabase 무료 플랜 기준. 서버 이미지 변환(유료 기능)은 쓰지 않는다
- 공부용이라 트래픽 최적화보다 구조의 명확성을 우선
- 법적 필수 링크(이용약관, 개인정보처리방침, 청소년보호정책, 신고 창구)는 정적 페이지로 둔다. 화면 수에는 세지 않는다
- 외부 레포 코드는 섞지 않는다 (Rhymix는 GPL, 구조만 참고)

## 6. 접근 방식

| 방식 | 내용 | 판단 |
|---|---|---|
| A. 기존 포럼 설치 (Flarum, Discourse) | 바로 운영 가능 | ❌ 공부 목적(직접 설계)에 안 맞음 |
| B. 실서비스 수준 풀스택 (Prisma + 자체 인증 서버) | 백엔드를 전부 직접 만듦 | ❌ 화면 6개짜리 MVP에 과함 |
| **C. Next.js + Supabase, 로직은 DB에** | 인증·DB·파일은 Supabase, 규칙은 RLS·트리거로 | ✅ **채택** |

C를 고른 이유: 지금까지의 리서치(Rhymix 트리거·카운트 캐시)와 바로 연결되고, 서버 코드를 적게 쓰면서 DB 설계를 깊게 배울 수 있다.

---

## 7. 게시판

시드 데이터로 고정. 이용자는 게시판을 만들 수 없다.

| slug | 이름 | 순서 |
|---|---|---|
| `kbo` | KBO | 1 |
| `mlb` | MLB | 2 |
| `free` | 자유 | 3 |

베스트는 게시판이 아니라 **posts의 상태(`is_best`)** 다. 어느 게시판 글이든 승격된다 (에펨코리아 "포텐 터짐" 방식).

## 8. 화면 (6개)

| # | 경로 | 화면 | 내용 |
|---|---|---|---|
| 1 | `/` | 홈 | 탭: **베스트**(best_at 최신순) / **최신**(전체 created_at 최신순) |
| 2 | `/[board]` | 게시판 목록 | 해당 게시판 최신순 |
| 3 | `/[board]/[id]` | 글 보기 | 본문 또는 링크, 추천·신고 버튼, 댓글(2단계) |
| 4 | `/write` | 글쓰기 | 본문 / 링크 전환, 게시판 선택, 수정은 `/write?edit=[id]` |
| 5 | `/login` | 로그인·가입 | 이메일+비밀번호, 가입 시 닉네임 |
| 6 | `/me` | 알림·내 정보 | 알림 목록(읽음 처리), 내가 쓴 글 |

정적 페이지: `/terms`, `/privacy`, `/youth`, `/report-guide` (바닥 링크)

### 공통 레이아웃
```
┌──────────────────────────────┐
│ 로고   [KBO] [MLB] [자유]  🔔● │  ← 알림 점: 안 읽은 알림 있을 때
├──────────────────────────────┤
│           (화면)              │
├──────────────────────────────┤
│ 이용약관 · 개인정보 · 청소년보호 · 신고 │
└──────────────────────────────┘
```

### 목록 한 줄 (홈·게시판 공통)
```
┌──────┐ 제목은 두 줄까지 보이고 넘치면 …   [12]
│ 64px │ ▲23  조회 1,204 · KBO · 14분 전 · 닉네임
└──────┘
```
- 왼쪽 64px 정사각형, 크기 고정 (사진이 늦게 떠도 목록이 흔들리지 않게)
  - 본문 글 + 사진 있음 → 대표 사진 썸네일
  - 본문 글 + 사진 없음 → 게시판 색 블록 + 게시판 이름
  - 링크 글 → 링크 아이콘 + 도메인 (원 사이트 이미지는 쓰지 않음)
- 베스트 글은 제목 앞 `🔥` 딱지
- 추천 칩 `▲N` 색 단계: 0~4 회색 / 5~(기준값-1) 주황 / 베스트 빨강
- 댓글 수 `[N]`은 1 이상일 때만
- 이미 읽은 글은 제목을 흐리게 (브라우저 localStorage에 읽은 글 id 저장, 실패해도 동작에 지장 없게)
- 한 번에 20개, 아래 "더 보기" 버튼 (커서 기반: 마지막 글의 정렬 키 기준)

### 글 보기
- 본문 글: 제목, 메타(닉네임·조회·시간), 본문, 첨부 사진들
- 링크 글: 제목, 링크 카드(도메인 + "원문 보기 ↗", 새 탭), 작성자 코멘트
- 본문 아래 가운데: `[▲ 추천 N]` `[🚩 신고]`
  - 추천 상태면 버튼 강조, 다시 누르면 취소
  - 본인 글이면 추천 버튼 비활성
- 본인 글이면 수정·삭제
- 댓글: 최신 등록순(오래된 것부터). 답글은 1단계까지만 (댓글 → 답글, 답글에 답글 불가 → 화면상 2단계)

### 글쓰기
- 상단 전환: `[본문] [링크]`
- 공통: 게시판 선택, 제목(2~100자)
- 본문: 내용(마크다운 일부, 1~20,000자), 사진 첨부 최대 10장 (장당 5MB 이하, jpg/png/webp/gif). **첫 번째 사진이 대표 사진**, 작성자가 다른 사진을 대표로 지정 가능
- 링크: URL(http/https만), 내 코멘트(선택, 0~2,000자). 서버는 그 URL에 접속하지 않는다 (미리보기 수집 안 함)

---

## 9. 데이터 모델

모든 테이블에 RLS 활성화. 시간은 `timestamptz`.

### profiles
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | `auth.users.id` 참조 |
| nickname | text UNIQUE | 2~12자 |
| created_at | timestamptz | |

가입 시 트리거(`on auth.users insert`)로 생성. 닉네임은 가입 폼에서 받아 `raw_user_meta_data`로 전달.

### boards
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | smallint PK | |
| slug | text UNIQUE | kbo, mlb, free |
| name | text | |
| sort | smallint | |

### posts
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | bigint identity PK | |
| board_id | smallint FK | |
| author_id | uuid FK profiles | |
| kind | text | `'text'` \| `'link'` (CHECK) |
| title | text | 2~100자 |
| body | text null | 본문 글: 필수 / 링크 글: 코멘트(선택) |
| url | text null | 링크 글만 필수 (CHECK: kind와 일치) |
| thumb_path | text null | Storage 경로 |
| like_count | int default 0 | **트리거만 변경** |
| comment_count | int default 0 | **트리거만 변경** |
| view_count | int default 0 | **RPC만 변경** |
| is_best | boolean default false | |
| best_at | timestamptz null | |
| created_at, updated_at | timestamptz | |
| deleted_at | timestamptz null | 소프트 삭제 |

인덱스: `(created_at desc, id desc)`, `(board_id, created_at desc, id desc)`, `(best_at desc, id desc) where is_best`

### post_images
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | bigint PK | |
| post_id | bigint FK | |
| path | text | 원본 경로 |
| thumb_path | text | 240px 썸네일 경로 |
| position | smallint | 순서 |

### comments
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | bigint PK | |
| post_id | bigint FK | |
| author_id | uuid FK | |
| parent_id | bigint null FK comments | 답글이면 부모 댓글. **부모는 parent_id가 null이어야 함** (트리거로 검사) |
| body | text | 1~2,000자 |
| created_at | timestamptz | |
| deleted_at | timestamptz null | 삭제 시 "삭제된 댓글입니다" 표시, 답글은 유지 |

### post_likes
| 컬럼 | 타입 | 비고 |
|---|---|---|
| post_id | bigint | PK(post_id, user_id) — **1인 1추천** |
| user_id | uuid | |
| created_at | timestamptz | |

비추천은 MVP에서 뺀다 (화면 단순화, 다운보트 남용 문제 회피).

### post_views
| 컬럼 | 타입 | 비고 |
|---|---|---|
| post_id | bigint | PK(post_id, viewer_key, viewed_on) |
| viewer_key | text | 회원: user id / 비회원: 쿠키에 저장한 랜덤 id |
| viewed_on | date | 같은 사람 하루 1회만 집계 |

### reports
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | bigint PK | |
| target_type | text | `'post'` \| `'comment'` |
| target_id | bigint | |
| reporter_id | uuid | UNIQUE(target_type, target_id, reporter_id) |
| reason | text | 선택지: 스팸·욕설·음란·저작권·기타 |
| created_at | timestamptz | |

처리는 Supabase 대시보드에서 수동. 자동 숨김은 MVP에서 안 함.

### notifications
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | bigint PK | |
| user_id | uuid | 받는 사람 |
| kind | text | `'comment'`(내 글에 댓글) \| `'reply'`(내 댓글에 답글) \| `'best'`(내 글 베스트) |
| post_id | bigint | |
| comment_id | bigint null | |
| actor_id | uuid null | 행동한 사람 (best는 null) |
| read_at | timestamptz null | |
| created_at | timestamptz | |

### 설정값 (한곳에 모음)
| 이름 | 값 | 비고 |
|---|---|---|
| BEST_THRESHOLD | **5** | 공부용이라 낮게. 테이블 `app_settings` 또는 SQL 함수 상수 |
| POST_RATE_LIMIT | 10분에 글 5개 | |
| COMMENT_RATE_LIMIT | 1분에 댓글 10개 | |

---

## 10. DB 규칙 (트리거·함수)

Rhymix의 "모듈 트리거"를 Postgres 트리거로 옮긴다.

| 이벤트 | 처리 |
|---|---|
| `post_likes` INSERT | 본인 글이면 거부(예외) → `like_count + 1` → 기준값 이상이고 아직 베스트 아니면 `is_best = true, best_at = now()` + `best` 알림 |
| `post_likes` DELETE | `like_count - 1`. **베스트는 한번 승격되면 유지** (취소로 강등하지 않음) |
| `comments` INSERT | 부모 검사(답글의 답글 금지) → `comment_count + 1` → 알림: 글쓴이에게 `comment`, 부모 댓글 작성자에게 `reply` (자기 자신에게는 안 보냄, 같은 사람이면 하나만) |
| `comments` 소프트 삭제 | `comment_count - 1` |
| `posts` INSERT | rate limit 검사 (초과 시 예외 메시지 "잠시 후 다시 시도해 주세요") |
| `comments` INSERT | rate limit 검사 |
| `posts` UPDATE | 클라이언트가 like_count·comment_count·view_count·is_best·best_at·author_id를 바꾸면 거부 (트리거에서 OLD 값 유지 또는 컬럼 권한으로 막기) |
| RPC `increment_view(post_id, viewer_key)` | `security definer`. post_views에 INSERT ON CONFLICT DO NOTHING → 새로 들어갔을 때만 `view_count + 1` |
| RPC `mark_notifications_read()` | 내 알림 전부 `read_at = now()` |

## 11. 권한 (RLS)

| 테이블 | 읽기 | 쓰기 |
|---|---|---|
| profiles | 누구나 | 본인 닉네임만 수정 |
| boards | 누구나 | 없음 (시드만) |
| posts | 누구나 (`deleted_at is null`) | INSERT: 로그인 + `author_id = auth.uid()` / UPDATE·소프트 삭제: 본인 |
| post_images | 누구나 | 글 작성자 본인 |
| comments | 누구나 | INSERT: 로그인 + 본인 / 소프트 삭제: 본인 |
| post_likes | 누구나 (내가 눌렀는지 표시용) | INSERT·DELETE: 본인 행만 |
| post_views | 없음 | RPC로만 |
| reports | 본인 것만 | INSERT: 로그인 + 본인 |
| notifications | 본인 것만 | 클라이언트 쓰기 없음 (트리거·RPC만) |

Storage 버킷 `post-images`: 읽기 공개, 쓰기는 로그인 사용자의 `{user_id}/...` 경로만.

## 12. 이미지 처리

- 업로드 전에 **브라우저에서** 두 벌을 만든다: 원본(긴 변 1600px로 축소) + 썸네일(240px 정사각형 중앙 자르기). 이유: 무료 플랜에서 서버 이미지 변환을 쓰지 않기 위해
- GIF는 원본 그대로 올리고 썸네일만 첫 프레임으로 만든다
- 글 저장 시 대표 사진의 썸네일 경로를 `posts.thumb_path`에 저장

## 13. 보안

- 본문 렌더링: 마크다운을 쓰되 **원시 HTML 허용 안 함** (XSS 방지)
- 링크 글 URL: `http://`, `https://`만 허용. 링크에 `rel="noopener noreferrer nofollow"`, 새 탭
- 서버가 이용자 입력 URL에 접속하지 않음 (SSRF와 저작권 문제 동시 회피)
- 비밀 키(service role)는 서버 환경변수에만. 클라이언트에는 anon 키만
- 캡차는 MVP에서 제외 (rate limit으로 대신). 공개 배포 전에 Supabase Auth 캡차 연동 검토

---

## 14. 구현 순서 (마일스톤)

각 단계가 끝나면 Claude 리뷰 후 다음으로.

| 단계 | 내용 | 완료 기준 |
|---|---|---|
| M0 | Next.js + Tailwind + Supabase 연결, 마이그레이션 폴더 | 로컬 실행, 빈 홈 표시 |
| M1 | 인증 + profiles 트리거 + 공통 레이아웃 | 가입(닉네임) → 로그인 → 로그아웃 |
| M2 | boards 시드, posts(본문·링크) 작성·목록·보기·수정·삭제 + RLS | 남의 글 수정이 DB에서 거부됨을 테스트로 확인 |
| M3 | 댓글·답글 + comment_count 트리거 | 답글의 답글이 거부됨 |
| M4 | 추천 + like_count + **베스트 승격** | 5명이 추천하면 홈 베스트 탭에 뜸, 본인 추천 거부 |
| M5 | 사진 업로드·썸네일·목록 한 줄 완성 | 목록에 썸네일/색 블록/링크 아이콘 3종 표시 |
| M6 | 조회수 RPC + 알림 + 🔔 점 + `/me` | 같은 사람 새로고침해도 조회수 1회, 댓글 달리면 알림 점 |
| M7 | 신고, rate limit, 정적 법적 페이지, 마무리 | 도배 시 에러 메시지 |

## 15. 테스트

- **DB 테스트 (가장 중요)**: RLS와 트리거를 SQL로 검증 (Supabase CLI `supabase test db` + pgTAP)
  - 남의 글 UPDATE 거부, 본인 추천 거부, 중복 추천 거부, 기준값 도달 시 승격, 답글의 답글 거부, 클라이언트의 like_count 변경 거부, 조회수 하루 1회
- **E2E 1개**: Playwright로 핵심 루프 — 가입 → 글쓰기 → 다른 계정 5개로 추천 → 홈 베스트 탭 확인 → 글쓴이 알림 확인

## 16. 구현자에게 맡기는 것

- Next.js·라이브러리 버전 (최신 안정판), 폴더 구조, 컴포넌트 분리
- 마크다운 렌더러 선택 (원시 HTML 비활성 조건만 지킬 것)
- Supabase 로컬 개발(Docker) vs 원격 프로젝트 사용 — Windows에 Docker가 없으면 원격 무료 프로젝트 + 마이그레이션 `db push`
- 스타일 세부 (위 와이어프레임의 구조·크기 고정 원칙만 지킬 것)

## 17. Claude가 정한 것 (확인 필요)

사용자가 질문 없이 진행을 요청해서 아래는 Claude가 정했다. 바꾸고 싶으면 알려줄 것.

1. 게시판: KBO / MLB / 자유 3개
2. 베스트 기준값 5 (공부용), 추천 취소해도 베스트 유지
3. 비추천 없음, 비회원 글쓰기·추천 없음
4. 댓글 화면상 2단계까지
5. 조회수: 같은 사람 하루 1회
6. 링크 글은 원 사이트 이미지 대신 도메인 표시
7. 이미지 리사이즈는 브라우저에서 (무료 플랜)
8. 캡차 대신 rate limit
9. 목록은 페이지 번호 대신 "더 보기"
